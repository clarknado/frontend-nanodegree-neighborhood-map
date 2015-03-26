function initMap(location, element) {

	// Sets default element if no element is passed into function
	if (!element) {
		element = document.getElementById('map-canvas');
	}
	
	// Sets default location if no location is passed into function
	if (!location) {
		location = {lat: '37.7386972', lng: '-122.4104775', zoom: '12'};
	}

	// Parses location object to mapOptions for map parameters
	var mapOptions = {
	  center: { lat: parseFloat(location.lat), lng: parseFloat(location.lng)},
	  zoom: parseInt(location.zoom)
	};
	
	// returns new map object with defined location and zoom parameters
	return new google.maps.Map(element, mapOptions);
}



var viewModel = function () {
	var self = this;

	// sets current map for marker reference
	self.currentMap = initMap(location, mapElement);

	// Initialize marker array for Google Map Marker objects
	self.markers = ko.observableArray([]);

	// Add markers to map from data array
	markerList.forEach(function(markerItem) {
		var marker = new google.maps.Marker({
			position : markerItem.position,
			map : currentMap,
			title : markerItem.title
		});
	});
};

google.maps.event.addDomListener(window, 'load', initMap());