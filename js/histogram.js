var histogramSeriesMethod = 'avg';

function loadHistogram(target, dashboardTitle, graphTitle) {

	$("#histogram").html("");
	$("#histogramMultipleSeriesWarning").hide();
	$("#histogramTitle").text("Histogram of " + dashboardTitle + " - " + graphTitle);
	$("#histogramProgress").show();
	$("#histogramProgressText").text("Accessing Graphite metrics API");
	loadGraphiteData(target, function(json) {
		$("#histogramProgressText").text("Rendering histogram");
		renderHistogram(graphTitle, json);
		$("#histogramProgress").hide();
	});
}

function renderHistogram(graphTitle, data) {
	if(data.length > 1){
		$("#histogramMultipleSeriesWarning").show();
	}

	var w = parseInt($(".lightbox-content").css("width")) - 30;
	var h = parseInt($(".lightbox-content").css("height")) - 150;

	var histogramData = [];
	_.each(data, function(graphiteDataSeries) {
		var xValues = _.map(graphiteDataSeries.datapoints, function(item) {
			return item[0];
		});
		for (var i = 0; i < xValues.length; i++) {
			histogramData[i] = histogramData[i] ? (histogramData[i] + xValues[i]) : xValues[i];
		};
	});

	for (var i = 0; i < histogramData.length; i++) {
		histogramData[i] = histogramData[i] / data.length;
	}
	var buckets = parseInt(w/76);

	drawHistogram(w, h, histogramData, buckets, graphTitle, "Frequency");
}


function drawHistogram(w, h, arr, buckets, xax, yax) {

	//remove
	d3.select("svg").remove();

	if (!buckets) {
		buckets = 10;
	}
	// A formatter for counts.
	var formatCount = d3.format(",.0f");

	var margin = {
		top: 10,
		right: 30,
		bottom: 40,
		left: 30
	},
		width = w - margin.left - margin.right,
		height = h - margin.top - margin.bottom;

	//max
	var max = Number(d3.max(arr)) + 1;

	var x = d3.scale.linear()
		.domain([0, max])
		.range([0, width]);


	var data = d3.layout.histogram()
		.bins(x.ticks(buckets))
	(arr);

	var y = d3.scale.linear()
		.domain([0, d3.max(data, function(d) {
			return d.y;
			histogram
		})])
		.range([height, 0]);


	var xAxis = d3.svg.axis()
		.scale(x)
		.ticks(buckets)
		.orient("bottom")
		.tickFormat(function(d) {
			return formatBase1024KMGTPShort(d);
		});

	var svg = d3.select("#histogram").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");


	var bar = svg.selectAll(".bar")
		.data(data)
		.enter().append("g")
		.attr("class", "bar")
		.attr("transform", function(d) {
			return "translate(" + x(d.x) + "," + y(d.y) + ")";
		});

	bar.append("rect")
		.attr("x", 1)
		.attr("width", x(data[0].dx) - 1)
		.attr("height", function(d) {
			return height - y(d.y);
		});

	bar.append("text")
		.attr("dy", ".75em")
		.attr("y", 6)
		.attr("x", x(data[0].dx) / 2)
		.attr("text-anchor", "middle")
		.attr("style", "fill: #808080")
		.text(function(d) {
			return d.y > 2 ? formatCount(d.y) : "";
		});

	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis);

	//draw the axis labels
	svg.append("text")
		.attr("text-anchor", "middle")
		.attr("class", "black")
		.attr("transform", "translate(" + (width / 2) + "," + (height + 40) + ")")
		.text(xax);

	svg.append("text")
		.attr("text-anchor", "middle")
		.attr("class", "black")
		.attr("transform", "translate(" + (-10) + "," + (height / 2) + ")rotate(-90)")
		.text(yax);


}