
function loadDashboards(){
    $.ajax({
        type: "get",
        url: graphitusConfig.dashboardListUrl,
        dataType:'json',
        success: function(json) {
            console.log("Loaded dashboards: " + JSON.stringify(json));
            var dashboards = new Array();
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

            renderDashboards(dashboards);
        },
        error:function (xhr, ajaxOptions, thrownError){
            console.log(thrownError);
        }
    });
}

function renderDashboards(dashboards){
    var tmplMarkup = $('#tmpl-group').html();
    for(group in dashboards){
        var compiledTmpl = _.template(tmplMarkup, { group : group, items: dashboards[group] });
        $("#dashboards").append(compiledTmpl);
    }
}