var graphitusConfig = null;

function loadGraphitusConfig(callback){
    $.ajax({
        type: "get",
        url: "config.json",
        dataType:'json',
        success: function(json) {
            graphitusConfig = json;
            console.log("Loaded configuration: " + JSON.stringify(graphitusConfig));
            callback();
        },
        error:function (xhr, ajaxOptions, thrownError){
            console.log(thrownError);
        }
    });
}