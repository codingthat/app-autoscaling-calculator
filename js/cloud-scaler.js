function OnLoad() {
	// displaying back the selected cloud provider options
	SelectCloudProvider(document.getElementById("form-cloud-provider"));
}

(function($) {
	"use strict";
	// Smooth scrolling using jQuery easing
	$('a.js-scroll-trigger[href*="#"]:not([href="#"])').click(function() {
		if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
			var target = $(this.hash);
			target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
			if (target.length) {
				$('html, body').animate({
					scrollTop: (target.offset().top)
				}, 1000, "easeInOutExpo");
				return false;
			}
		}
	});
})(jQuery);

function Run() {
	// hiding results & displaying loading gif
	document.getElementById('results').style.display = "none";
	document.getElementById("loading-gif").style.display = "flex";

	// parsing load function
	var userLoadFunctionParts = [];
	for (var i=0; i<=loadFunctionNbRows; i++) {
		if (document.getElementById("form-loadfunction-row" + i) == null) {
			continue;
		}
		// hidding error
		document.getElementById("form-loadfunction-error-row" + i).style.display = "none";

		var from = parseFloat(document.getElementById("form-loadfunction-from" + i).value);
		if (isNaN(from)) {
			LoadFunctionError(i, "'From' value is not a number.");
			return false;
		}
		var to = parseFloat(document.getElementById("form-loadfunction-to" + i).value);
		if (isNaN(to)) {
			LoadFunctionError(i, "'To' value is not a number.");
			return false;
		}

		var loadFunction = null;
		try {
			eval("loadFunction =  " + document.getElementById("form-loadfunction-function" + i).value);
			if (typeof loadFunction !== "function") {
				LoadFunctionError(i, "Load function is not a function.");
				return false;
			}
		} catch(e) {
			LoadFunctionError(i, "Could parse load function: " + e);
			return false;
		}

		userLoadFunctionParts.push(new UserLoadFunctionPart(from, to, loadFunction));
	}
	// var userLoadFunction = new UserLoadFunction(userLoadFunctionParts);
	var userLoadFunction = new UserLoadFunction([
		new UserLoadFunctionPart(-Infinity, 0, function(time){return 0;}),
		new UserLoadFunctionPart(0, 0.8, function(time){return 0.1;}),
		new UserLoadFunctionPart(0.8, 1, function(time){return 0;}),
		new UserLoadFunctionPart(1, 1.8, function(time){return 0.1;}),
		new UserLoadFunctionPart(1.8, 2, function(time){return 0;}),
		new UserLoadFunctionPart(2, Infinity, function(time){return 0.01;})
	]);

	/* FORM */
	// application
	var instanceMaxLoad = parseFloat(document.getElementById("form-instance-max-load").value);
	var instanceStartDuration = parseInt(document.getElementById("form-instance-start-duration").value);
	var minNbInstances = parseInt(document.getElementById("form-min-number-instances").value);
	// load test
	var nbUsers = parseInt(document.getElementById("form-number-users").value);
	var loadDuration = parseInt(document.getElementById("form-loadtest-duration").value);
	// computation & graphics
	var nbIterations = parseInt(document.getElementById("form-number-iterations").value);
	var nbCoordonates = Math.ceil(loadDuration); // !!TODO

	/* COMPUTING */
	// calculating load
	var loadCoordonates = null;
	switch(document.getElementById("form-loadtest-distribution").value) {
		case "gauss":
			loadCoordonates = LoadCalculator.Gauss(nbUsers, userLoadFunction, loadDuration, nbCoordonates, nbIterations);
			break;
		case "constant":
			loadCoordonates = LoadCalculator.Constant(nbUsers, userLoadFunction, loadDuration, nbCoordonates, nbIterations);
			break;
		case "linear":
			loadCoordonates = LoadCalculator.Linear(nbUsers, userLoadFunction, loadDuration, nbCoordonates, nbIterations);
			console.log("Linear");
			break;
	}
	// displaying load chart
	ChartsDesigner.DrawLoadOverTime('chart-load-time', loadCoordonates);

	// cloud providers
	var rowsClass = null;
	var resultCoordonates = null;
	switch(document.getElementById("form-cloud-provider").value) {
		// kubernetes 1.12
		case "kubernetes-1.12":
			var horizontalPodAutoscalerSyncPeriod = parseInt(document.getElementById("form-k8s-1-12-hpasp").value);
			var horizontalPodAutoscalerTolerance = parseFloat(document.getElementById("form-k8s-1-12-hpat").value);
			var scaleUpPercent = AutoScaler.findScaleUpPercentKubernetes_1_12(loadCoordonates, instanceMaxLoad, instanceStartDuration, minNbInstances, horizontalPodAutoscalerSyncPeriod, horizontalPodAutoscalerTolerance);

			rowsClass = "results_kubernetes-1-12";
			document.getElementById("results_kubernetes-1-12_targetAverageValue").innerHTML = Math.floor(scaleUpPercent * 1000) / 1000; // should I add instanceMaxLoad?

			resultCoordonates = Kubernetes_1_12.instancesStatusOverTime(loadCoordonates, instanceMaxLoad, scaleUpPercent, instanceStartDuration, minNbInstances, horizontalPodAutoscalerSyncPeriod, horizontalPodAutoscalerTolerance);
			break;

		default: break;
	}
	// displaying cloud provider results rows
	if (rowsClass != null) {
		var rows = document.getElementsByClassName(rowsClass);
		for (var i=0; i<rows.length; i++) {
			rows[i].style.display = "flex"; // back to default
		}
	}

	// displaying metrics results
	var maxNbInstances = 0;
	var maxLoadInstance = 0;
	for (var i=0; i<resultCoordonates.length; i++) {
		if (maxNbInstances < resultCoordonates[i].instancesReady) {
			maxNbInstances = resultCoordonates[i].instancesReady;
		}
		if (maxLoadInstance < resultCoordonates[i].instanceLoadPercent) {
			maxLoadInstance = resultCoordonates[i].instanceLoadPercent;
		}
	}
	document.getElementById("results_max-nb-instance").innerHTML = maxNbInstances;
	document.getElementById("results_max-instance-load").innerHTML = (Math.round(maxLoadInstance * instanceMaxLoad * 1000) / 1000) + ' (' + (Math.round(maxLoadInstance * 1000) / 10) + '%)';

	// drawing result graphs
	ChartsDesigner.DrawResults('chart-results', resultCoordonates);

	// showing results
	document.getElementById("loading-gif").style.display = "none";
	document.getElementById('results').style.display = "block";

	// scrolling to results
	(function($) {
		"use strict";
		$('html, body').animate({
			scrollTop: ($('#results').offset().top)
		}, 1000, "easeInOutExpo");
	})(jQuery);
}

/* FORM */
var loadFunctionNbRows = 0;
function LoadFunctionAddRow() {
	// searching for next row id
	var rowId = 0;
	while(true) {
		if (document.getElementById("form-loadfunction-row" + rowId) == null) {
			if (loadFunctionNbRows < rowId) {
				loadFunctionNbRows = rowId;
			}
			break;
		}
		rowId++;
	}
	// from to
	var fromInput = document.createElement("input");
	fromInput.type = "text";
	fromInput.size = "10";
	fromInput.id = "form-loadfunction-from" + rowId;
	var fromSpan = document.createElement("span");
	fromSpan.innerHTML = "From: "
	var fromToSpaceSpan = document.createElement("span");
	fromToSpaceSpan.innerHTML = "&nbsp;"
	var toInput = document.createElement("input");
	toInput.type = "text";
	toInput.size = "10";
	toInput.id = "form-loadfunction-to" + rowId;
	var toSpan = document.createElement("span");
	toSpan.innerHTML = "To: "
	var fromTo = document.createElement("div");
	fromTo.className = "col-lg-4";
	fromTo.appendChild(fromSpan);
	fromTo.appendChild(fromInput);
	fromTo.appendChild(fromToSpaceSpan);
	fromTo.appendChild(toSpan);
	fromTo.appendChild(toInput);

	// function label
	var functionSpan = document.createElement("span");
	functionSpan.innerHTML = "Function: "
	var functionSpanCol = document.createElement("div");
	functionSpanCol.className = "col-lg-1";
	functionSpanCol.appendChild(functionSpan);
	// function textarea
	var functionTextarea = document.createElement("textarea");
	functionTextarea.className = "form-control";
	functionTextarea.id = "form-loadfunction-function" + rowId;
	functionTextarea.innerHTML = "function(time) {return 1;}";
	var functionCol = document.createElement("div");
	functionCol.className = "col-lg-6";
	functionCol.appendChild(functionTextarea);

	// buttons
	var buttonRemove = document.createElement("input");
	buttonRemove.type = "button";
	buttonRemove.className = "btn btn-secondary";
	buttonRemove.setAttribute("onclick", "LoadFunctionRemoveRow(" + rowId + ");");
	buttonRemove.value = "-";
	var buttonsCol = document.createElement("div");
	buttonsCol.className = "col-lg-1 text-center";
	buttonsCol.appendChild(buttonRemove);

	// row
	var row = document.createElement("div");
	row.className = "row";
	row.id = "form-loadfunction-row" + rowId;
	row.appendChild(fromTo);
	row.appendChild(functionSpanCol);
	row.appendChild(functionCol);
	row.appendChild(buttonsCol);

	// error row
	var errorSpan = document.createElement("span");
	errorSpan.id = "form-loadfunction-error" + rowId;
	var errorDiv = document.createElement("div");
	errorDiv.className = "col-lg-12";
	errorDiv.appendChild(errorSpan)
	var errorRow = document.createElement("div");
	errorRow.id = "form-loadfunction-error-row" + rowId;
	errorRow.className = "row error-row";
	errorRow.appendChild(errorDiv);

	// displaying HTML
	document.getElementById("form-loadfunction-rows").appendChild(errorRow);
	document.getElementById("form-loadfunction-rows").appendChild(row);
}

function LoadFunctionRemoveRow(rowIndex) {
	RemoveHTML('form-loadfunction-error-row' + rowIndex);
	RemoveHTML('form-loadfunction-row' + rowIndex);
}

function LoadFunctionError(rowIndex, error) {
	document.getElementById("form-loadfunction-error" + rowIndex).innerHTML = "&darr; " + error;
	document.getElementById("form-loadfunction-error-row" + rowIndex).style.display = "flex";
	//displaying loading gif
	document.getElementById("loading-gif").style.display = "none";
}

function SelectCloudProvider(selectElement) {
	// undisplay every rows
	["kubernetes-1-12"].forEach(element => {
		var rows = document.getElementsByClassName(element);
		for (var i=0; i<rows.length; i++) {
			rows[i].style.display = "none";
		}
	});

	// selecting rows to display
	var rowsClass = null;
	switch (selectElement.value) {
		case "kubernetes-1.12": rowsClass = "kubernetes-1-12";
			break;

		default: break;
	}

	// displaying rows
	var rows = document.getElementsByClassName(rowsClass);
	for (var i=0; i<rows.length; i++) {
		rows[i].style.display = "flex"; // back to default
	}
}

function ResetForm() {
	SelectCloudProvider(document.getElementById("form-cloud-provider"));
	document.getElementById("loading-gif").style.display = "none";
	document.getElementById('results').style.display = "none";
}

/* COMMON */
function RemoveHTML(id) {
	var elem = document.getElementById(id);
	elem.parentNode.removeChild(elem);
	return false;
}