Introduction
============
A simple, client-side, JSON-based [Graphite](http://graphite.wikidot.com/) dashboard system build with [bootstrap](http://twitter.github.com/bootstrap/) and [underscore.js](http://underscorejs.org/)

Installation
============
Graphitus is pure client side, all you have to do to run it is put it under a web-server that can serve http requests.

Configuration
=============

Graphitus dashboards are defined using JSON notation. These configuration files can be stored in a document database like [couchdb](http://couchdb.apache.org/) or [mongo](http://www.mongodb.org/) and can also be placed on the file system where dashboards are served.

* Below is an example of global configuration (a file named config.json) using static local JSON files (the dashboards ids are the file names with a .json extension):

    	{
    		"graphiteUrl": "http://graphite.mysite.com",
    		"dashboardListUrl": "dashboard-index.json",
    		"dashboardUrlTemplate": "${dashboardId}.json"
    	}

* Below is an example of global configuration (a file named config.json) using couch db:

    	{
    		"graphiteUrl": "http://graphite.mysite.com",
    		"dashboardListUrl": "http://couch.mysite.com:5984/_utils/database.html?graphitus-dashboards", <-- must return a JSON with a "rows" element containing an array of rows with dashboard id ("id" attribute)
    		"dashboardUrlTemplate": "http://couch.mysite.com:5984/_utils/document.html?graphitus-dashboards/${dashboardId}"
    	}



* Below is an example dashboard configuration:

    	{
    		"_id": "ops.MySQL", <-- the groupd.id of the document, provides an easy scheme for grouping dashboards
    		"title": "MySQL Production Cluster", <-- give a title to page	
    		"columns": 2, <-- the number of charts in a row side by side, mostly 2 or 4
    		"user": "erezmazor", <-- owner	 
    		"timeBack": 12h, <-- time range back from current time (can be expressed in minutes/hours/days/weeks e.g., 30m/12h/1d/2w)	 
    		"theme": "humanity",	<-- themeing and colors based on google CDN hosted jquery-ui theming		
    		"from": "", <-- start date for the date range, prefer timeBack as any date you choose will become stale	 
    		"until": "", <-- end date for the date range, prefer timeBack as any date you choose will become stale	 
    		"width": 700, <-- width of each chart image, should correlate with # columns defined
    		"height": 450,<-- height of each chart image
    		"legend": true, <-- show the legend in chart
    		"refresh": true, <-- auto refresh
    		"refreshIntervalSeconds": 90, <-- auto refresh interval in seconds
    		"averageSeries": false, <-- for targets that aggregate a lot of metrics prefer setting this to true as it will average many lines into one
    		"defaultLineWidth": 2, <-- line width for chart lines
    		"data": [ <-- actual data for chart image
    			{
    				"title": "Slow Queries", <-- a title for the chart image
    				"target": "groupByNode(machines.${dc}dc1.mysql*.Slow_queries,2,\"nonNegativeDerivative\")" <-- the graphite target/function which defines the chart content			 
    			},{
    				"title": "Seconds Behind Master",
    				"target": "groupByNode(machines.${dc}dc1.mysql*.Seconds_Behind_Master,2,\"averageSeries\")"
    			},{
    				"title": "Queries Per Second",
    				"target": "groupByNode(machines.${dc}dc1.mysql*.Qps,2,\"averageSeries\")"
    			}
    			],
    			"parameters": { <-- parameters to tokens expressed in targets with ${paramName} format	
    				"datacetner" : { <-- label for a select box in the UI
    				"All": {	 <-- display name for a select box in the UI
    					"dc": "*" <-- the token name (dc) as specified in the target name and the actual token value (*)			
    				},
    				"New York": {		 
    					"dc": "ny" 
    				},
    				"LA": {
    					"dc": "la"
    				},
    				"Chicago": {
    					"dc": "chi"
    				}
    			}
    		}

* This will generate the screen below:

![Screenshot](https://raw.github.com/erezmazor/graphitus/master/doc/screenshot.png)