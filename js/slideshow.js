var slidesJs = null;

function startSlideshow() {
	console.log('Starting slideshow')
	$('#dashboards-view').hide();
	$('#slideProgress').show();
	$("#slideShow").show();
	if (null == slidesJs) {
		var container = $('#slidesContainer');
		var width = $(window).width() - 200;
		var height = $(window).height() - 250;
		container.empty();

		var slides = $('<div id="slides"></div>');

		_.each(config.data, function(graph, idx) {
			var img = $('<img/>').attr({
				id: "slide" + idx,
				alt: config.data[idx].title,
				src: buildSlideshowUrl(idx, width, height),
				width: width,
				height: height
			});

			img.on("mouseenter", function() {
				$('#stopSlideshow').removeClass('fa-stop');
				$('#stopSlideshow').addClass('fa-pause');
				$('#stopSlideshow').css('color', '#FFFACD');
			});
			img.on("mouseleave", function() {
				$('#stopSlideshow').addClass('fa-stop');
				$('#stopSlideshow').removeClass('fa-pause');
				$('#stopSlideshow').css('color', '#E9967A');
			});
			slides.append(img);
		});

		container.append(slides);

		$('#slidesContainer').waitForImages(function() {
			$('#slideProgress').hide();
			slidesJs = $("#slides").slidesjs({
				width: width,
				height: height,
				pagination: {
					active: true
				},
				play: {
					active: false,
					effect: "slide",
					interval: 5000,
					auto: true,
					swap: false,
					pauseOnHover: true,
					pause: 2000,
					restartDelay: 6000
				},
				callback: {
					loaded: function(idx) {
						$('#slideTitle').html(config.data[idx - 1].title);
						$("#slides").show();
						console.log('slideshow loaded');
					},
					start: function(idx) {
						$("#slideShow").show();
						setSlide(idx, width, height);
					},
					complete: function(number) {}
				}
			});
		});

		$("#playSlideshow").hide();
		$("#stopSlideshow").show();
	} else {
		$('#slideProgress').hide();
		var pluginInstance = $('#slides').data('plugin_slidesjs');
		pluginInstance.play(false);
		$("#playSlideshow").hide();
		$("#stopSlideshow").show();
	}

}

function buildSlideshowUrl(idx, width, height){
	var url = buildUrl(idx, config.data[idx], '', width, height, "render");
	if(config.slideshowParameters){
		url += "&" + config.slideshowParameters;
	}
	if(config.data[idx].slideshowParameters){
		url += "&" + config.data[idx].slideshowParameters;
	}
	return url;
}

function setSlide(idx, width, height) {
	$('#slideTitle').html(config.data[idx].title);
	var src = buildSlideshowUrl(idx, width, height);
	$('#slide' + idx).attr('src', src);
	console.log("Slide loaded [" + config.data[idx].title + "]");
}

function stopSlideshow() {
	console.log('Stopping slideshow')
	$('#dashboards-view').show();
	$("#playSlideshow").show();
	$("#stopSlideshow").hide();
	$("#slideShow").hide();

	var pluginInstance = $('#slides').data('plugin_slidesjs');
	pluginInstance.stop(false);
}