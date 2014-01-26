var grafanaDashboardTmpl, grafanaRowTmpl, grafanaFilterTmpl, grafanaPanelTmpl;

function generateGrafanaConfig() {
	loadTemplates();
	var template = generateTemplate();
	writeDashboardToElasticSearch(template);
	return false;
}

function downloadGrafanaConfig() {
	loadTemplates();
	var template = generateTemplate();
	window.open("data:application/json;charset=UTF-8," + template, "_blank");
	return false;
}

function writeDashboardToElasticSearch(template) {
	var url = graphitusConfig.grafanaElasticSearch + encodeURIComponent(config.title);
	console.log("Posting dashboard to elastic search as grafana config");
	$.ajax({
		url: url,
		contentType: "application/json; charset=utf-8",
		method: 'PUT',
		async: false,
		contentType: 'json',
		data: JSON.stringify({
			dashboard: template
		}),
		dataType: "json",
		success: function(msg) {
			console.log(msg);
			window.open(graphitusConfig.grafanaUrl + encodeURIComponent(config.title), '_blank');
		},
		error: function(err) {
			console.log(err);
		}
	});
}

function loadTemplates() {
	grafanaDashboardTmpl = loadTemplate('grafana.dashboard');
	grafanaRowTmpl = loadTemplate('grafana.row');
	grafanaFilterTmpl = loadTemplate('grafana.filter');
	grafanaPanelTmpl = loadTemplate('grafana.panel');
}

function generateTemplate() {
	return _.template(grafanaDashboardTmpl, {
		title: config.title,
		timeBack: $('#timeBack').val(),
		filters: generateFilters(),
		rows: generateRows()
	});
}

function generateRows() {
	var idx = 0;
	var rowIdx = [];
	var rows = [];

	for (idx in config.data) {
		for (col = 0; col < config.columns; col++) {
			if ((idx % config.columns) == col) {
				if (!rowIdx[col]) {
					rowIdx[col] = [];
				}
				if (config.data[idx]) {
					rowIdx[col].push(idx);
				}
			}
		}
	}
	var rowConfig = _.zip.apply(_, rowIdx);
	for (idx in rowConfig) {
		console.log("generating row: " + idx + " with indexes: " + JSON.stringify(rowConfig[idx]));
		rows.push(generateRow(rowConfig[idx]));
	}
	return rows;
}

function generateRow(graphIndexes) {
	return _.template(grafanaRowTmpl, {
		title: queryParam("id") + idx,
		panels: generatePanels(graphIndexes)
	});
}

function generatePanels(graphIndexes) {
	var panels = [];
	for (idx in graphIndexes) {
		if (graphIndexes[idx]) {
			console.log("generating graph index: " + graphIndexes[idx]);
			panels.push(generatePanel(graphIndexes[idx]));
		}
	}
	return panels;
}


function generatePanel(idx) {
	return _.template(grafanaPanelTmpl, {
		span: 12 / config.columns,
		title: config.data[idx].title,
		targets: generateTargets(config.data[idx])
	});
}

function generateTargets(graph) {
	var targets = []
	if (typeof(graph.target) == 'array' || typeof(graph.target) == 'object') {
		for (idx in graph.target) {
			targets.push({
				target: generateGrafanaParams(graph.target[idx])
			})
		}
	} else {
		targets.push({
			target: generateGrafanaParams(graph.target)
		})
	}
	return JSON.stringify(targets);
}

function generateGrafanaParams(target) {
	target = target.replace(/\${(.*?)}/g, "[[$1]]");
	target = target.replace("[[regex]]", "(.*)");
	return target;
}

function generateFilters() {
	var filters = [];
	for (idx in config.parameters) {
		var parameter = config.parameters[idx];
		filters.push(generateFilter(idx, parameter));
	}
	return filters;
}

function generateFilter(idx, parameter) {
	var query = "",
		name = "",
		options = [],
		showAll = false;
	if (dynamicParams[idx]) {
		name = idx;
		showAll = dynamicParams[idx].showAll && dynamicParams[idx].showAll == true;
		query = dynamicParams[idx].query;
		options = generateDynamicOptions(idx, parameter);
	} else {
		_.each(parameter, function(value, key) {
			name = _.keys(parameter[key])[0];
			options.push({
				value: _.values(parameter[key])[0],
				text: key
			})
		});
	}
	return _.template(grafanaFilterTmpl, {
		name: name,
		query: generateGrafanaParams(query),
		showAll: showAll,
		options: JSON.stringify(options),
		selectedOption: JSON.stringify(options[0])
	});
}

function generateDynamicOptions(idx, parameter) {
	// console.log("Generating options for dynamic parameter: " + idx);
	var options = [];
	_.each($('#' + idx + ' option'), function(opt) {
		options.push({
			value: $(opt).val(),
			text: $(opt).html()
		});
	});
	return options;
}

function loadTemplate(templateName) {
	var template = '';
	$.ajax({
		url: './grafana/' + templateName + '.tmpl',
		method: 'GET',
		async: false,
		contentType: 'text',
		success: function(data) {
			template = data;
		}
	});
	// console.log(template);
	return template;
}