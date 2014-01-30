var lastUpdate = new Date();
var lastExecution = 0;
var autoRefershRef = null;
var refreshIntervalRef = null;
var config = null;
var autoRefreshEnabled = false;
var parameterDependencies = new Array();
var dynamicParams = new Array();
var rawTargets = new Array();

function renderGraphitus() {
	$('#dashboards-view').hide();
	$('#parameters-toolbar').hide();
	loadDashboards();
}

function renderView() {
	renderParamToolbar();
	var tmplToolbarMarkup = $('#tmpl-toolbar').html();
	var tmplDashboardViewMarkup = $('#tmpl-dashboards-view').html();
	var dashboardsMenu = generateDashboardsMenus();
	var title = (config.title.length < 15) ? config.title : config.title.substring(0, 15) + "...";
	$("#toolbar").append(_.template(tmplToolbarMarkup, {
		config: config,
		title: title,
		dashboardsMenu: dashboardsMenu
	}));
	loadTimezone();
	initializeSearch();
	console.log("rendered toolbar");
	$("#dashboards-view").append(_.template(tmplDashboardViewMarkup, {
		config: config
	}));
	$('.dropdown-menu input, .dropdown-menu label, .dropdown-menu select').click(function(e) {
		e.stopPropagation();
	});

	$("[rel='tooltip']").tooltip();

	initializeGraphParams();

	console.log("rendered dashboard view");
}

function loadView() {
	updateGraphs();
	toggleAutoRefresh();
	renderSource();
	document.title = config.title + " Dashboard";
	$("#start").datetimepicker({
		timeFormat: 'hh:mm',
		dateFormat: 'yymmdd',
		hourGrid: 4,
		minuteGrid: 10
	});
	$("#end").datetimepicker({
		timeFormat: 'hh:mm',
		dateFormat: 'yymmdd',
		hourGrid: 4,
		minuteGrid: 10
	});

}

function loadDashboard() {
	var dashId = queryParam('id');
	var dashboardUrl = applyParameter(graphitusConfig.dashboardUrlTemplate, "dashboardId", dashId);
	$.ajax({
		type: "get",
		url: dashboardUrl,
		dataType: 'json',
		cache: false,
		success: function(data) {
			if (data.error) {
				alert("No dashboard information " + dashId);
				return;
			}
			console.log("fetched [" + dashboardUrl + "]");
			config = data;

			//backward compatibility
			if (!config.timeBack && config.hoursBack) {
				config.timeBack = config.hoursBack + 'h';
			}
			// end
			mergeUrlParamsWithConfig(config);
			//console.log("effective config: " + JSON.stringify(config));
			renderView();
			console.log("rendered view");
			loadView();
			console.log("view loaded");
			$("#loader").hide();

			if (config.slideshow == "true") {
				startSlideshow();
			} else {
				$('#dashboards-view').show();
			}
		},
		error: function(xhr, ajaxOptions, thrownError) {
			console.log("error [" + dashboardUrl + "]");
			var tmplError = $('#tmpl-warning-dashboard').html();
			$('#message').html(_.template(tmplError, {
				dashboardId: dashId
			}));
			$('#message').show();
			$("#loader").hide();
		}
	});
}

function updateGraphs() {
	console.log("Updating graphs, start time: " + lastUpdate);
	showProgress();

	$("#permalink").attr("href", generatePermalink());
	for (var i = 0; i < config.data.length; i++) {
		updateGraph(i);
	}

	$('#dashboards-view').waitForImages(function() {
		lastExecution = Math.floor((new Date() - lastUpdate) / 1000);
		lastUpdate = new Date();
		hideProgress();
	});
	console.log("Update complete in: " + (new Date() - lastUpdate) + "ms");
}

function updateGraph(idx) {
	var graph = config.data[idx];
	$('#title' + idx).html(applyParameters(graph.title));
	$('#sLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width / 2, config.height / 2, "render"));
	$('#mLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width, config.height, "render"));
	$('#lLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width * 2, config.height * 2, "render"));
	$('#gLink' + idx).attr('href', buildUrl(idx, graph, graph.title, 0, 0, "graphlot"));
	$('#img' + idx).attr('src', buildUrl(idx, graph, "", config.width, config.height, "render"));
	rawTargets[idx] = buildUrl(idx, graph, graph.title, config.width, config.height, "render");
	$('#source' + idx).val(getGraphSource(graph));
}

function buildUrl(idx, graph, chartTitle, width, height, graphiteOperation) {
	var params = "&lineWidth=" + config.defaultLineWidth + "&title=" + encodeURIComponent(chartTitle) + "&tz=" + $("#tz").val();
	if (config.defaultParameters) {
		params = params + "&" + config.defaultParameters;
	}
	if ($('#graphParams' + idx).val()) {
		params += "&" + $('#graphParams' + idx).val();
	}
	if (config.defaultColorList) {
		params += "&colorList=" + config.defaultColorList;
	}
	var range = "";
	var timeBack = $('#timeBack').val();
	var start = $('#start').val();
	var end = $('#end').val();
	if (timeBack != "") {
		range = "&from=-" + parseTimeBackValue(timeBack);
	} else if (start != "" && end != "") {
		var startParts = start.split(" ");
		var endParts = end.split(" ");
		range = "&from=" + startParts[1] + "_" + startParts[0] + "&until=" + endParts[1] + "_" + endParts[0];
	}

	var legend = "&hideLegend=" + !($("#legend").prop('checked'));
	var size = "&width=" + width + "&height=" + height;

	targetUri = "";
	var targets = (typeof graph.target == 'string') ? new Array(graph.target) : graph.target;
	for (i = 0; i < targets.length; i++) {
		var effectiveTarget = encodeURIComponent(calculateEffectiveTarget(targets[i]));

		if ($("#average").prop('checked')) {
			targetUri = targetUri + "target=averageSeries(" + effectiveTarget + ")";
		} else if ($("#sum").prop('checked')) {
			targetUri = targetUri + "target=sumSeries(" + effectiveTarget + ")";
		} else {
			targetUri = targetUri + "target=" + effectiveTarget;
		}
		if (i < targets.length - 1) {
			targetUri = targetUri + "&";
		}
	}
	if ($("#events").prop('checked') && config.events) {
		for (i = 0; i < config.events.length; i++) {
			targetUri = targetUri + "&target=drawAsInfinite(" + config.events[i] + ")";
		}
	}
	var userParams = getUserUrlParams(idx);

	return getGraphiteServer() + "/" + graphiteOperation + "/?" + targetUri + range + legend + params + userParams + size;
}

function getGraphiteServer() {
	return graphitusConfig.graphiteUrl;
}

function getUserUrlParams(idx) {
	var userUrlParams = "";
	userUrlParams += ($("#yMin" + idx).val() != "") ? "&yMin=" + $("#yMin" + idx).val() : "";
	userUrlParams += ($("#yMax" + idx).val() != "") ? "&yMax=" + $("#yMax" + idx).val() : "";
	userUrlParams += ($("#otherUrlParamName" + idx).val() != "" && $("#otherUrlParamValue" + idx).val() != "") ? "&" + $("#otherUrlParamName" + idx).val() + "=" + $("#otherUrlParamValue" + idx).val() : "";
	return userUrlParams;
}

function calculateEffectiveTarget(target) {
	return applyParameters(target);
}

function renderParamToolbar() {
	if (config.parameters) {
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			var tmplParamSel = $('#tmpl-parameter-sel').html();
			$("#parametersToolbarContent").append(_.template(tmplParamSel, {
				group: paramGroupName
			}));
			$("#" + paramGroupName).select2({
				placeholder: "Loading " + paramGroupName
			});
			if (paramGroup.type && paramGroup.type == "dynamic") {
				dynamicParams[paramGroupName] = paramGroup;
				loadParameterDependencies(paramGroupName, paramGroup.query);
				renderDynamicParamGroup(paramGroupName, paramGroup);
			} else {
				renderValueParamGroup(paramGroupName, paramGroup);
			}
		});
		$('#parameters-toolbar').show();
	}
}

function generatePermalink() {
	var href = "dashboard.html?id=" + queryParam("id");
	href = href + "&legend=" + $("#legend").prop('checked');
	href = href + "&average=" + $("#average").prop('checked');
	href = href + "&sum=" + $("#sum").prop('checked');
	href = href + "&showEvents=" + $("#events").prop('checked');
	var timeBack = $('#timeBack').val();
	var start = $('#start').val();
	var end = $('#end').val();
	if (timeBack != "") {
		href = href + "&timeBack=" + timeBack;
	} else if (start != "" && end != "") {
		href = href + "&from=" + start + "&until=" + end;
	}

	if (config.parameters) {
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			if ($('#' + paramGroupName)) {
				var selectedParamText = $('#' + paramGroupName + " option:selected").text();
				href = href + "&" + paramGroupName + "=" + encodeURIComponent(selectedParamText);
			}
		});
	}
	return href;
}

function renderValueParamGroup(paramGroupName, paramGroup) {
	var tmplParamSelItem = $('#tmpl-parameter-sel-item').html();
	$("#" + paramGroupName).html("");
	$("#" + paramGroupName).append(_.template(tmplParamSelItem, {
		group: paramGroupName,
		params: paramGroup,
		selected: getDefaultValue(paramGroupName, paramGroup)
	}));
	$("#" + paramGroupName).select2({
		placeholder: "Select a " + paramGroupName,
		dropdownAutoWidth: true
	});
	$("#" + paramGroupName).off("change");
	$("#" + paramGroupName).on("change", function(e) {
		updateDependantParameters(paramGroupName);
		updateGraphs();
	});
}

function getDefaultValue(paramGroupName, paramGroup) {
	if (queryParam(paramGroupName)) {
		return queryParam(paramGroupName);
	} else if (dynamicParams[paramGroupName] && dynamicParams[paramGroupName].defaultValue) {
		return dynamicParams[paramGroupName].defaultValue;
	} else if (paramGroup && paramGroup.defaultValue) {
		return paramGroup.defaultValue
	} else {
	    return ""
	}
}

function updateDependantParameters(paramGroupName) {
	var dependencies = parameterDependencies[paramGroupName];
	if (dependencies) {
		for (idx in dependencies) {
			var dep = dependencies[idx];
			var paramGroup = dynamicParams[dep];
			if (paramGroup.type && paramGroup.type == "dynamic") {
				renderDynamicParamGroup(dep, paramGroup);
			}
		}
	}
}

function loadParameterDependencies(paramGroupName, path) {
	var dependencies = getDependenciesFromPath(path);
	for (idx in dependencies) {
		if (!parameterDependencies[dependencies[idx]]) {
			parameterDependencies[dependencies[idx]] = new Array();
		}
		parameterDependencies[dependencies[idx]].push(paramGroupName);
	}
}

function getDependenciesFromPath(path) {
	var dependencies = new Array();
	path.replace(/\{(.*?)\}/g, function(g0, g1) {
		dependencies.push(g1);
	});
	return dependencies;
}

function generateDynamicQuery(paramGroupName) {
	var query = dynamicParams[paramGroupName].query;
	var dependencies = getDependenciesFromPath(query);
	for (idx in dependencies) {
		var dependsOn = dependencies[idx];
		dependValue = $('#' + dependsOn).val();
		if (!dependValue) {
			dependValue = "*";
		}
		query = applyParameter(query, dependsOn, dependValue);
	}
	return encodeURIComponent(query);
}

function getMetricsQueryUrl() {
	if (graphitusConfig.metricsQueryUrl) {
		return graphitusConfig.metricsQueryUrl;
	}
	return getGraphiteServer() + "/metrics/find?format=completer&query=";
}

function renderDynamicParamGroup(paramGroupName, paramGroup) {
	var query = generateDynamicQuery(paramGroupName);
	if (!endsWith(query, ".*")) {
		query = query + ".*";
	}
	var queryUrl = getMetricsQueryUrl() + query;
	$.ajax({
		type: 'GET',
		url: queryUrl,
		dataType: 'json',
		success: function(data) {
			var parameters = new Array();
			if (paramGroup.showAll) {
				parameters["All"] = new Array();
				parameters["All"][paramGroupName] = new Array();
				parameters["All"][paramGroupName] = (paramGroup.showAllValue) ? applyParameters(paramGroup.showAllValue) : "*";
			}
			$.each(data.metrics, function(i, metric) {
				var paramValue = getParamValueFromPath(paramGroup, metric);
				parameters[paramValue] = new Array();
				parameters[paramValue][paramGroupName] = new Array();
				parameters[paramValue][paramGroupName] = paramValue;
				parameters.sort();
			});
			config.parameters[paramGroupName] = parameters;
			renderValueParamGroup(paramGroupName, parameters);
		},
		error: function(xhr, ajaxOptions, thrownError) {
			console.log("error [" + xhr + "]");
			var tmplError = $('#tmpl-warning-parameters').html();
			$('#message').html(_.template(tmplError, {
				message: "Could not load graphite parameters from url [" + queryUrl + "]: " + JSON.stringify(xhr.statusText) + "<br/>"
			}));
			$('#message').show();
			$("#loader").hide();
		},
		async: false
	});
}


function endsWith(str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function getParamValueFromPath(paramGroup, metric) {
	var result = "";

	if (paramGroup.index != undefined) {
		var pathParts = metric.path.split(".");
		result = pathParts[paramGroup.index];
	} else {
		result = metric.name;
	}

	return applyRegexToName(paramGroup, result);
}

function applyRegexToName(paramGroup, metric) {
	var result = metric;
	if (paramGroup.regex) {
		var regEx = applyParameters(paramGroup.regex);
		var regexResult = result.match(new RegExp(regEx));
		result = (regexResult) ? regexResult[1] : "";
	}
	return result;
}

function applyParameters(target) {
	if (config.parameters) {
		$.each(config.parameters, function(paramGroupName, paramGroup) {

			for (tokenKey in paramGroup[paramGroupName]) {
				var tokenValue = paramGroup[paramGroupName][tokenKey];
				target = applyParameter(target, tokenKey, tokenValue);
			}
			var selectedParamText = $('#' + paramGroupName + " option:selected").text();
			for (tokenKey in paramGroup[selectedParamText]) {
				var tokenValue = paramGroup[selectedParamText][tokenKey];
				target = applyParameter(target, tokenKey, tokenValue);
			}
		});
	}
	return target;
}

function multiReplace(str, match, repl) {
	do {
		str = str.replace(match, repl);
	} while (str.indexOf(match) !== -1);
	return str;
}

function applyParameter(originalString, paramName, paramValue) {
	return multiReplace(originalString, "${" + paramName + "}", paramValue);
}

function toggleAutoRefresh() {
	if (config.refresh) {
		enableAutoRefresh();
	} else {
		disableAutoRefresh();
	}
	config.refresh = !config.refresh;
}

function enableAutoRefresh() {
	config.refreshIntervalSeconds = (config.refreshIntervalSeconds > graphitusConfig.minimumRefresh) ? config.refreshIntervalSeconds : graphitusConfig.minimumRefresh;
	console.log("Setting refresh interval to " + config.refreshIntervalSeconds);
	autoRefershRef = window.setInterval("updateGraphs()", config.refreshIntervalSeconds * 1000);
	refreshIntervalRef = window.setInterval("updateRefreshCounter()", 1000);
}

function disableAutoRefresh() {
	window.clearInterval(refreshIntervalRef);
	window.clearInterval(autoRefershRef);
}

function updateRefreshCounter() {
	var remaining = config.refreshIntervalSeconds - Math.floor(((new Date().getTime()) - lastUpdate.getTime()) / 1000);
	$("#refreshCounter").html('<label class="badge badge-success">update in ' + remaining + 's<br/>' + "</label>");
}

function showProgress() {
	$("#refreshCounter").hide();
	$("#loadingProgress").show();
}

function hideProgress() {
	$("#refreshCounter").show();
	$("#loadingProgress").hide();
}

function useHours() {
	$("#start,#end").val("");
	if ($("#timeBack").val() != "") {
		updateGraphs();
	}
}

function useDateRange() {
	$("#timeBack").val("");
	if ($("#start").val() != "" && $("#end").val() != "") {
		updateGraphs();
	}
}

function parseTimeBackValue(timeBack) {
	var delimiterIdx = timeBack.length - 1;
	if (timeBack.lastIndexOf('w') == delimiterIdx) {
		return timeBack.replace('w', 'weeks');
	} else if (timeBack.lastIndexOf('d') == delimiterIdx) {
		return timeBack.replace('d', 'days');
	} else if (timeBack.lastIndexOf('h') == delimiterIdx) {
		return timeBack.replace('h', 'hours');
	} else if (timeBack.lastIndexOf('m') == delimiterIdx) {
		return timeBack.replace('m', 'minutes');
	} else {
		return timeBack + 'hours';
	}
}

function queryParam(name) {
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regexS = "[\\?&]" + name + "=([^&#]*)";
	var regex = new RegExp(regexS);
	var results = regex.exec(window.location.search);
	if (results == null) {
		return null;
	} else {
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	}
}

function mergeUrlParamsWithConfig(config) {
	if (queryParam('hoursBack') != null) {
		config.hoursBack = queryParam('hoursBack');
	}
	if (queryParam('timeBack') != null) {
		config.timeBack = queryParam('timeBack');
	}
	if (queryParam('from') != null && queryParam('until') != null) {
		config.from = queryParam('from');
		config.until = queryParam('until');
		config.hoursBack = null;
		config.timeBack = null;
	}
	if (queryParam('columns') != null) {
		config.columns = queryParam('columns');
	}
	if (queryParam('theme') != null) {
		config.theme = queryParam('theme');
	}
	if (queryParam('width') != null) {
		config.width = queryParam('width');
	}
	if (queryParam('height') != null) {
		config.height = queryParam('height');
	}
	if (queryParam('legend') != null) {
		config.legend = queryParam('legend');
	}
	if (queryParam('showEvents') != null) {
		config.showEvents = queryParam('showEvents');
	}
	if (queryParam('averageSeries') != null) {
		config.averageSeries = queryParam('averageSeries');
	}
	if (queryParam('sumSeries') != null) {
		config.sumSeries = queryParam('sumSeries');
	}
	if (queryParam('defaultLineWidth') != null) {
		config.defaultLineWidth = queryParam('defaultLineWidth');
	}
	if (queryParam('defaultParameters') != null) {
		config.defaultParameters = queryParam('defaultParameters');
	}
	if (queryParam('slideshow') != null) {
		config.slideshow = queryParam('slideshow');
	}
}

function getGraphSource(graph) {
	var result = new Array();
	if ((typeof graph.target) === 'string') {
		result.push(calculateEffectiveTarget(graph.target));
	} else {
		for (idx in graph.target) {
			result.push(calculateEffectiveTarget(graph.target[idx]));
		}
	}
	return result.join("\n");
}

function renderSource() {
	$('.source').width(config.width - 10);
}

function toggleSource(idx) {
	if ($('#sourceContainer' + idx).is(":visible")) {
		$('#sourceContainer' + idx).hide();
		$('#img' + idx).show();
	} else {
		$('#sourceContainer' + idx).show();
		$('#img' + idx).hide();
	}
}

function updateSource(idx) {
	config.data[idx].target = $('#source' + idx).val();
	updateGraph(idx);
	toggleSource(idx);
	return false;
}

function initializeSearch() {
	$('#search').typeahead({
		source: searchIndex,
		updater: function(selection) {
			document.location.href = "dashboard.html?id=" + selection;
		}
	});
}

function initializeGraphParams() {
	for (var i = 0; i < config.data.length; i++) {
		$('#graphParams' + i).val(config.data[i].params);
	}
}

function setTimezone() {
	console.log("timezone set: " + $("#tz").val());
	$.cookie('graphitus.timezone', $("#tz").val());
}

function loadTimezone() {
	var tz = "";
	if (queryParam("tz")) {
		tz = queryParam("tz");
		console.log("timezone loaded from url param: [" + tz + "]");
	} else if (config.tz) {
		tz = config.tz;
		console.log("timezone loaded from dashboard config: [" + tz + "]");
	} else {
		tz = $.cookie('graphitus.timezone');
		console.log("timezone loaded from cookie: [" + tz + "]");
	}
	if (tz && tz !== "") {
		$("#tz").val(tz);
	}
}

function showExtendedGraph(idx) {
	$(".lightbox-content").css("width", $(window).width() - 100);
	$(".lightbox-content").css("height", $(window).height() - 100);
	$('#extendedGraph').lightbox({
		resizeToFit: false
	});
	loadExtendedGraph(rawTargets[idx], config.title, config.data[idx].title);
	$(".rickshaw_legend").css("height", $(window).height() - 220);
}

function showHistogram(idx) {
	$(".lightbox-content").css("width", $(window).width() - 200);
	$(".lightbox-content").css("height", $(window).height() - 200);
	$('#hitogramLightbox').lightbox({
		resizeToFit: false
	});
	loadHistogram(rawTargets[idx], config.title, config.data[idx].title);
}

function togglePinnedParametersToolbar() {
	if ($("#parametersToolbarPin i").hasClass("fa-lock")) {
		$("#parametersToolbarPin").html("<i class='fa fa-lg fa-unlock'/>");
		$("#parameters-toolbar").css("position", "fixed");
		$("#parameters-toolbar").css("width", "100%");
		$("#parameters-toolbar").css("opacity", ".85");
	} else {
		$("#parametersToolbarPin").html("<i class='fa fa-lg fa-lock'/>");
		$("#parameters-toolbar").css("position", "relative");
		$("#parameters-toolbar").css("opacity", "1");
	}
}
