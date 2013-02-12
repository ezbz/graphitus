var lastUpdate = new Date();
var lastExecution = 0;
var autoRefershRef = null;
var refreshIntervalRef = null;
var config = null;
var autoRefreshEnabled = false;
var dashboards = new Array();
var searchIndex = new Array();
var parameterDependencies = new Array();
var dynamicParams = new Array();

function renderGraphitus(){
	$('#dashboards-view').hide();
	$('#parameters-toolbar').hide();
	loadDashboards();
}

function renderView() {
	renderParamToolbar();
	var tmplToolbarMarkup = $('#tmpl-toolbar').html();
	var tmplDashboardViewMarkup = $('#tmpl-dashboards-view').html();
	var title = (config.title.length < 15) ? config.title : config.title.substring(0,15) + "...";
	$("#toolbar").append(_.template(tmplToolbarMarkup, {
		config : config, 
		title: title,
		dashboardGroups : dashboards
	}));
	initializeSearch();
	console.log("rendered toolbar");
	$("#dashboards-view").append(_.template(tmplDashboardViewMarkup, {
		config : config
	}));
	$('.dropdown-menu input, .dropdown-menu label, .dropdown-menu select').click(function(e) {
	    e.stopPropagation();
	});
	console.log("rendered dashboard view");
}

function loadView() {
	updateGraphs();
	toggleAutoRefresh();
	renderSource();
	document.title = config.title + " Dashboard";
	$("#start").datetimepicker({
		timeFormat : 'hh:mm',
		dateFormat : 'yymmdd',
		hourGrid: 4,
		minuteGrid: 10
	});
	$("#end").datetimepicker({
		timeFormat : 'hh:mm',
		dateFormat : 'yymmdd',
		hourGrid: 4,
		minuteGrid: 10
	});
}

function loadDashboard() {
	var dashId = queryParam('id');
	var dashboardUrl = applyParameter(graphitusConfig.dashboardUrlTemplate, "dashboardId", dashId);
	$.ajax({
		type : "get",
		url : dashboardUrl,
		dataType : 'json',
		cache: false,
		success : function(data) {
			if(data.error){
				alert("No dashboard information "+dashId);
				return;
			}
			console.log("fetched [" + dashboardUrl + "]");
			config = data;

			//backward compatibility
			if(!config.timeBack){
				config.timeBack = config.hoursBack+'h';
			}
			// end
			mergeUrlParamsWithConfig(config);
			console.log("effective config: " + JSON.stringify(config));
			renderView();
			console.log("rendered view");
			loadView();
			console.log("view loaded");
			$("#loader").hide();
			$('#dashboards-view').show();
		},
		error : function(xhr, ajaxOptions, thrownError) {
			console.log("error [" + dashboardUrl + "]");
			var tmplError = $('#tmpl-warning-dashboard').html();
			$('#message').html(_.template(tmplError, {
				dashboardId : dashId
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
	for ( var i = 0; i < config.data.length; i++) {
		updateGraph(i);
	}

	$('#dashboards-view').waitForImages(function() {
		lastExecution = Math.floor((new Date() - lastUpdate)/1000);
		lastUpdate = new Date();
		hideProgress();
	});
	console.log("Update complete in: "+ (new Date() - lastUpdate) +"ms");
}

function updateGraph(idx){
	var graph = config.data[idx];
	$('#sLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width/2, config.height/2, "render"));
	$('#mLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width, config.height, "render"));
	$('#lLink' + idx).attr('href', buildUrl(idx, graph, graph.title, config.width*2, config.height*2, "render"));
	$('#gLink' + idx).attr('href', buildUrl(idx, graph, graph.title, 0, 0, "graphlot"));
	$('#img' + idx).attr('src', buildUrl(idx, graph, "", config.width, config.height, "render"));
	$('#lightboxImg' + idx).attr('_src', buildUrl(idx, graph, graph.title, config.width*1.5, config.height*1.5, "render"));
	$('#source' + idx).val(getGraphSource(graph));
}

function buildUrl(idx, graph, chartTitle, width, height, graphiteOperation) {
	var params = "&lineWidth=" + config.defaultLineWidth + "&title=" + encodeURIComponent(chartTitle) + "&tz=" + $("#tz").val();
	params += (graph.params) ? "&" + graph.params : "";

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
		}else if ($("#sum").prop('checked')) {
			targetUri = targetUri + "target=sumSeries(" + effectiveTarget + ")";
		} else {
			targetUri = targetUri + "target=" + effectiveTarget;
		}
		if (i < targets.length - 1) {
			targetUri = targetUri + "&";
		}
	}
	var userUrlParams = getUserUrlParams(idx);

	return graphitusConfig.graphiteUrl + "/" + graphiteOperation + "/?" + targetUri + range + legend + params + userUrlParams + size;
}

function getUserUrlParams(idx){
	var userUrlParams ="";
	userUrlParams += ($("#yMin"+idx).val() !="") ? "&yMin=" + $("#yMin"+idx).val() : "";
	userUrlParams += ($("#yMax"+idx).val() !="") ? "&yMax=" + $("#yMax"+idx).val() : "";
	userUrlParams += ($("#otherUrlParamName"+idx).val() !="" && $("#otherUrlParamValue"+idx).val() !="") ? "&"+$("#otherUrlParamName"+idx).val() +"=" + $("#otherUrlParamValue"+idx).val() : "";
	return userUrlParams;
}

function calculateEffectiveTarget(target){
	return applyParameters(target);
}

function renderParamToolbar(){
	if(config.parameters){
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			var tmplParamSel = $('#tmpl-parameter-sel').html();
			$("#parametersToolbar").append(_.template(tmplParamSel, {
				group : paramGroupName
			}));
			$("#"+paramGroupName).select2({
				 placeholder: "Loading " + paramGroupName
			});
		    if(paramGroup.type && paramGroup.type == "dynamic"){
				 dynamicParams[paramGroupName] = paramGroup;
				 loadParameterDependencies(paramGroupName, paramGroup.query);
				 renderDynamicParamGroup(paramGroupName, paramGroup);
			}else{
				renderValueParamGroup(paramGroupName, paramGroup);
			}
		});	
		$('#parameters-toolbar').show();
	}
}

function generatePermalink(){
	var href = "dashboard.html?id=" + queryParam("id");
	href = href + "&legend=" + $("#legend").prop('checked');
	href = href + "&average=" + $("#average").prop('checked');
	href = href + "&sum=" + $("#sum").prop('checked');
	var timeBack = $('#timeBack').val();
	var start = $('#start').val();
	var end = $('#end').val();
	if (timeBack != "") {
		href = href + "&timeBack=" + timeBack;
	} else if (start != "" && end != "") {
		href = href + "&start=" + start + "&end=" + end;
	}
	
	if(config.parameters){
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			var selectedParamText = $('#'+paramGroupName +" option[value='"+$('#'+paramGroupName).val()+"']").text();
			var group = $(this).attr("id");
			href = href + "&" + paramGroupName + "=" + encodeURIComponent(selectedParamText);
		});
	}
	return href;
}

function renderValueParamGroup(paramGroupName, paramGroup){
	var tmplParamSelItem = $('#tmpl-parameter-sel-item').html();
	$("#"+paramGroupName).html("");
	$("#"+paramGroupName).append(_.template(tmplParamSelItem, {
		group : paramGroupName,
		params: paramGroup,
		selected: getDefaultValue(paramGroupName)
	}));
	$("#"+paramGroupName).select2({
		 placeholder: "Select a " + paramGroupName
	});
	 $("#"+paramGroupName).on("change", function(e) { 
		 updateDependantParameters(paramGroupName);
		 updateGraphs();
	 });
}

function getDefaultValue(paramGroupName){
	if(queryParam(paramGroupName)){
		return queryParam(paramGroupName);
	}else if(dynamicParams[paramGroupName] && dynamicParams[paramGroupName].defaultValue){
		return dynamicParams[paramGroupName].defaultValue;
	}else{
		return "";
	}
}

function updateDependantParameters(paramGroupName){
	var dependencies = parameterDependencies[paramGroupName]; 
	 if(dependencies){
		 for(idx in dependencies){
			 var dep = dependencies[idx];
			 var paramGroup = dynamicParams[dep];
			 if(paramGroup.type && paramGroup.type == "dynamic"){
				 renderDynamicParamGroup(dep, paramGroup);					 
			 }
		 }
	 }
}

function loadParameterDependencies(paramGroupName, path){
	var dependencies = getDependenciesFromPath(path);
	for(idx in dependencies){
		if(!parameterDependencies[dependencies[idx]]){
			parameterDependencies[dependencies[idx]] = new Array();
		}
		parameterDependencies[dependencies[idx]].push(paramGroupName);
	}
}

function getDependenciesFromPath(path){
	var dependencies =  new Array();
	path.replace(/\{(.*?)\}/g, function(g0,g1){
		dependencies.push(g1);
	});
	return dependencies;
}

function generateDynamicQuery(paramGroupName){
	var query = dynamicParams[paramGroupName].query;
	var dependencies = getDependenciesFromPath(query);
	for(idx in dependencies){
		var dependsOn = dependencies[idx];
		dependValue = $('#'+dependsOn).val();
		if(!dependValue){
			dependValue = "*";
		}
		query = applyParameter(query, dependsOn, dependValue);
	}
	return query;
}

function renderDynamicParamGroup(paramGroupName, paramGroup){
	var url = graphitusConfig.graphiteUrl +"/metrics/find?format=completer&query=";
	var query = generateDynamicQuery(paramGroupName);
	$.ajax({
	    type: 'GET',
	    url: url+query +".*",
	    dataType: 'json',
	    success: function(data) { 
	    	var parameters = new Array();
	    	if(paramGroup.showAll){
	    		parameters["All"] = new Array();
	    		parameters["All"][paramGroupName] = new Array();
	    		parameters["All"][paramGroupName] = "*";
	    	}
	    	$.each(data.metrics, function(i, metric) {
	    		var paramValue = getParamValueFromPath(paramGroup, metric);
	    		parameters[paramValue] = new Array();
	    		parameters[paramValue][paramGroupName] = new Array();
	    		parameters[paramValue][paramGroupName] = paramValue;
	    	});
	    	config.parameters[paramGroupName] = parameters;
			renderValueParamGroup(paramGroupName, parameters);
	    },
	    async: false
	});
}

function getParamValueFromPath(paramGroup, metric){
	var result ="";

	if(paramGroup.index){
		var pathParts = metric.path.split(".");
		result =  pathParts[paramGroup.index];
	}else{
		result =  metric.name;
	}

	return applyRegexToName(paramGroup, result);
}

function applyRegexToName(paramGroup, metric){
	var result = metric;
	if(paramGroup.regex){
		var regexResult = result.match(new RegExp(paramGroup.regex));
		result = (regexResult) ? regexResult[1] : "";
	}
	return result;
}

function applyParameters(target){
	if(config.parameters){
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			var selectedParamText = $('#'+paramGroupName +" option[value='"+$('#'+paramGroupName).val()+"']").text();
			for(tokenKey in paramGroup[paramGroupName]){
				var tokenValue = paramGroup[paramGroupName][tokenKey];
				target = applyParameter(target, tokenKey, tokenValue);
			}
			for(tokenKey in paramGroup[selectedParamText]){
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
    } while(str.indexOf(match) !== -1);
    return str;
}

function applyParameter(originalString, paramName, paramValue){
	return multiReplace(originalString,"${"+paramName +"}", paramValue);
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
	autoRefershRef = window.setInterval("updateGraphs()", config.refreshIntervalSeconds * 1000);
	refreshIntervalRef = window.setInterval("updateRefreshCounter()", 1000);
}
function disableAutoRefresh() {
	window.clearInterval(refreshIntervalRef);
	window.clearInterval(autoRefershRef);
}

function updateRefreshCounter() {
	var remaining = config.refreshIntervalSeconds - Math.floor(((new Date().getTime()) - lastUpdate.getTime()) / 1000);
	$("#refreshCounter").html('<label class="badge badge-success">update in ' + remaining + ' seconds<br/>' +"</label>");
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

function parseTimeBackValue(timeBack){
	var delimiterIdx = timeBack.length - 1;
	if(timeBack.lastIndexOf('w') == delimiterIdx) {
		return timeBack.replace('w', 'weeks');
	} else if(timeBack.lastIndexOf('d') == delimiterIdx) {
		return timeBack.replace('d', 'days');
	} else if(timeBack.lastIndexOf('h') == delimiterIdx) {
		return timeBack.replace('h', 'hours');
	} else if(timeBack.lastIndexOf('m') == delimiterIdx) {
		return timeBack.replace('m', 'minutes');
	} else {
		return timeBack + 'hours';
	}
}

function queryParam(name){
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(window.location.search);
  if(results == null){
    return null;
  }else{
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  }
}

function mergeUrlParamsWithConfig(config){
	if(queryParam('hoursBack') != null){
		config.hoursBack = queryParam('hoursBack');
	}
	if(queryParam('timeBack') != null){
		config.timeBack = queryParam('timeBack');
	}	
	if(queryParam('from') != null && queryParam('until') != null){
		config.from = queryParam('from');
		config.until = queryParam('until');
		config.hoursBack = null;
		config.timeBack = null;
	}
	if(queryParam('columns') != null){
		config.columns = queryParam('columns');
	}
	if(queryParam('theme') != null){
		config.theme = queryParam('theme');
	}
	if(queryParam('width') != null){
		config.width = queryParam('width');
	}
	if(queryParam('height') != null){
		config.height = queryParam('height');
	}
	if(queryParam('legend') != null){
		config.legend = queryParam('legend');
	}
	if(queryParam('averageSeries') != null){
		config.averageSeries = queryParam('averageSeries');
	}
	if(queryParam('sumSeries') != null){
		config.sumSeries = queryParam('sumSeries');
	}
	if(queryParam('defaultLineWidth') != null){
		config.defaultLineWidth = queryParam('defaultLineWidth');
	}
}

function getGraphSource(graph){
	var result = new Array();
	if((typeof graph.target) === 'string') { 
		result.push(calculateEffectiveTarget(graph.target));
	}else{
		for(idx in graph.target){
			result.push(calculateEffectiveTarget(graph.target[idx]));
		}
	}
	return result.join("\n");
}

function renderSource(){
	$('.source').width(config.width-10);
}

function toggleSource(idx){	
	if($('#sourceContainer'+idx).is(":visible")){
		$('#sourceContainer'+idx).hide();
		$('#img'+idx).show();
	}else{
		$('#sourceContainer'+idx).show();
		$('#img'+idx).hide();
	}
}

function updateSource(idx){
	config.data[idx].target = $('#source'+idx).val();
	updateGraph(idx);
	toggleSource(idx);
	return false;
}

function loadDashboards(){
    $.ajax({
        type: "get",
        url: graphitusConfig.dashboardListUrl,
        dataType:'json',
        success: function(json) {
            console.log("Loaded "+json.rows.length+" dashboards");
            var data = json.rows;
            for(var i=0; i<data.length; i++){
                var group = data[i].id.split('.')[0];
                if(!dashboards[group]){
                    dashboards[group] = new Array();
                }
                dashboards[group].push( data[i] );
            }
            dashboards.sort();
			for(i in json.rows){
				searchIndex.push(json.rows[i].id);
			}
			loadDashboard();
        },
        error:function (xhr, ajaxOptions, thrownError){
            console.log(thrownError);
        }
    });
}

function initializeSearch(){
	$('#search').typeahead({
		source: searchIndex,
		updater: function (selection) {
			document.location.href = "dashboard.html?id=" + selection;
		}
	});
}


function applyLightboxImage(idx){
	$('#img'+idx).css('cursor','wait');
	$('#lightboxImg'+idx).attr('src', $('#lightboxImg'+idx).attr('_src'));
	$('#lightboxLink'+idx).attr('href', $('#lightboxImg'+idx).attr('_src'));
	$('#lightbox'+idx).lightbox({resizeToFit:false});
	$('#lightbox'+idx).waitForImages(function() {
		$('#lightboxProgress'+idx).hide();
		$('#img'+idx).css('cursor','default');
	});	
}
