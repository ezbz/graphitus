var lastUpdate = new Date();
var lastExecution = 0;
var autoRefershRef = null;
var refreshIntervalRef = null;
var config = null;
var autoRefreshEnabled = false;
var dashboards = new Array();

function renderGraphitus(){
	loadDashboards();
}

function renderView() {
	renderParamToolbar();
	var tmplToolbarMarkup = $('#tmpl-toolbar').html();
	var tmplDashboardViewMarkup = $('#tmpl-dashboards-view').html();
	$("#toolbar").append(_.template(tmplToolbarMarkup, {
		config : config, 
		dashboardGroups : dashboards
	}));
	console.log("rendered toolbar");
	$("#dashboards-view").append(_.template(tmplDashboardViewMarkup, {
		config : config
	}));
	console.log("rendered dashboard view");
}

function loadView() {
	updateGraphs();
	toggleAutoRefresh();
	renderSource();
	document.title = config.title + " Dashboard";
	if(config.theme){
		$('head').append(
			'<link rel="stylesheet" href="//netdna.bootstrapcdn.com/bootswatch/2.1.1/' + config.theme
					+ '/bootstrap.min.css" type="text/css" />');
	}
	$("#start").datetimepicker({
		timeFormat : 'hh:mm',
		dateFormat : 'yymmdd'
	});
	$("#end").datetimepicker({
		timeFormat : 'hh:mm',
		dateFormat : 'yymmdd'
	});
}

function loadDashboard() {
	var dashId = queryParam('id');
	var dashboardUrl = applyParameter(graphitusConfig.dashboardUrlTemplate, "dashboardId", dashId);
	$.ajax({
		type : "get",
		url : dashboardUrl,
		dataType : 'json',
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
		},
		error : function(xhr, ajaxOptions, thrownError) {
			console.log("error [" + dashboardUrl + "]");
		}
	});
}

function updateGraphs() {
	console.log("Updating graphs, start time: " + lastUpdate);
	showProgress();
	
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
	$('#link' + idx).attr('href', buildUrl(graph, graph.title, config.width*2, config.height*2, "render"));
	$('#sLink' + idx).attr('href', buildUrl(graph, graph.title, config.width/2, config.height/2, "render"));
	$('#mLink' + idx).attr('href', buildUrl(graph, graph.title, config.width, config.height, "render"));
	$('#lLink' + idx).attr('href', buildUrl(graph, graph.title, config.width*2, config.height*2, "render"));
	$('#gLink' + idx).attr('href', buildUrl(graph, graph.title, 0, 0, "graphlot"));
	$('#img' + idx).attr('src', buildUrl(graph, "", config.width, config.height, "render"));
	$('#source' + idx).val(getGraphSource(graph));
}

function buildUrl(graph, chartTitle, width, height, graphiteOperation) {
	var params = "&lineWidth=" + config.defaultLineWidth + "&title=" + encodeURIComponent(chartTitle);
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

	var legend = "&hideLegend=" + !($("#legend").attr('checked'));
	var size = "&width=" + width + "&height=" + height;

	targetUri = "";
	var targets = (typeof graph.target == 'string') ? new Array(graph.target) : graph.target;
	for (i = 0; i < targets.length; i++) {
		if ($("#average").attr('checked')) {
			targetUri = targetUri + "target=averageSeries(" + encodeURIComponent(applyParameters(targets[i])) + ")";
		} else {
			targetUri = targetUri + "target=" + encodeURIComponent(applyParameters(targets[i]));
		}
		if (i < targets.length - 1) {
			targetUri = targetUri + "&";
		}
	}

	return graphitusConfig.graphiteUrl + graphiteOperation + "/" + "?" + targetUri + range + legend + params + size;
}

function renderParamToolbar(){
	if(config.parameters){
		var tmplParamSel = $('#tmpl-parameter-sel').html();

		$.each(config.parameters, function(paramGroupName, paramGroup) {
			$("#parametersToolbar").append(_.template(tmplParamSel, {
				group : paramGroupName,
				params: paramGroup,
				selected: queryParam(paramGroupName)
			}));
		});		
	}else{
		$('#parametersNavBar').hide();
	}
}

function applyParameters(target){
	if(config.parameters){
		$.each(config.parameters, function(paramGroupName, paramGroup) {
			var selectedParamValue = $('#'+paramGroupName).val();
			$.each(paramGroup[selectedParamValue], function(tokenKey, tokenValue) {
				target = applyParameter(target, tokenKey, tokenValue);
			});
	    });	
	}
	return target;
}

function applyParameter(originalString, paramName, paramValue){
	return originalString.replace("${"+paramName +"}", paramValue);
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
	$("#refreshCounter").html('<label class="badge badge-success">graphs will update in ' + remaining + ' seconds<br/>' +"</label>");
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
	if(queryParam('defaultLineWidth') != null){
		config.defaultLineWidth = queryParam('defaultLineWidth');
	}
}

function getGraphSource(graph){
	var result = new Array();
	if((typeof graph.target) === 'string') { 
		result.push(applyParameters(graph.target));
	}else{
		for(idx in graph.target){
			result.push(applyParameters(graph.target[idx]));
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
            console.log("Loaded dashboards: " + JSON.stringify(json));
            var data = json.rows;
            for(var i=0; i<data.length; i++){
                var group = data[i].id.split('.')[0];
                if(!dashboards[group]){
                    dashboards[group] = new Array();
                }
                dashboards[group].push( data[i] );
            }
            dashboards.sort();
            $("#loader").hide();
			loadDashboard();
        },
        error:function (xhr, ajaxOptions, thrownError){
            console.log(thrownError);
        }
    });
}
