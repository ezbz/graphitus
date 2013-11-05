function loadDashboard() {
    renderDashboards();
    $("#loader").hide();
}

function renderDashboards(){
    var dashboardsMenu = generateDashboardsMenus();
    $("#dashboards").append(dashboardsMenu);
    $("#dashboards").masonry({
        itemSelector: '.box',
        isAnimated: true
    });
}