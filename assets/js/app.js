
// Creates global-esque variables for function access
var map;
var geocoder = new google.maps.Geocoder();

function initMap(element) {

	// Sets default element if no element is passed into function
	if (!element) {
		element = document.getElementById('map-canvas');
	}

	// Creates map object
	var map = new google.maps.Map(element);

	// Sets default location
	var location = new google.maps.LatLng(-34.397, 150.644);
	
	// Calls updateMap function to set map to default location
	updateMap(map, location);
	
	// returns map object
	return map
}

function updateMap(map, location) {
	map.setCenter(location);
	map.setZoom(10);
}

function codeAddress(map, address) {

	// Geocodes address to provide support for string addresses
	geocoder.geocode({ 'address': address }, function(results, status) {
  		if (status == google.maps.GeocoderStatus.OK) {
	    	updateMap(map, results[0].geometry.location);
	  	} else {
	  		errorReturn('geocoder');
	  	}
  	});
}

function errorReturn(error) {
	if (error === 'geocoder') {
		console.log(error);
	} else {
		console.log(error);
	}
}

var ViewModel = function () {
	var self = this;

	self.init = function() {
		self.currentMap = initMap();
	};

	self.googleSearch = ko.observable();

	self.googleCode = function() {
		codeAddress(self.currentMap, self.googleSearch());
	};

	self.checkEnter = function(data, e) {
		if (e.keyCode === 13) {
			self.googleCode();
		}
		return true;
	};

	// wikipedia results
	self.wikiResult = function() {
		var wikiRequestTimeout = setTimeout(function(){
        	$wikiElem.text("failed to get wikipedia resources");
    	}, 8000);

		var wikiAPIurl = "http://en.wikipedia.org/w/api.php?format=json&action=query&list=search&srsearch=" + address;
	    $.ajax( {
	        url: wikiAPIurl,
	        dataType: 'jsonp',
	        success: function (data, textStatus, jqXHR) {
	            var items = [];
	            console.log(data);
	            $.each(data.query.search, function ( index, article) {
	                items.push('<li class=article><a href="http://en.wikipedia.org/wiki/'+ article.title + '">' +
	                    article.title + '</a></li>');
	            });
	            clearTimeout(wikiRequestTimeout);
	            $wikiElem.append(items.join( "" ));

	        },
	    } );
	};

	// Initialize marker array for Google Map Marker objects
	//self.markers = ko.observableArray([]);

	// Add markers to map from data array
	/*markerList.forEach(function(markerItem) {
		var marker = new google.maps.Marker({
			position : markerItem.position,
			map : currentMap,
			title : markerItem.title
		});
	});*/

	google.maps.event.addDomListener(window, 'load', self.init());
};

ko.applyBindings(new ViewModel());