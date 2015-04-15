var yelpSearch = function() {
	var self = this;

	self.base = "/v2/search?";
	self.term = ko.observable("food");
	self.location = ko.observable();
	self.cll = ko.observable();
	self.bounds = ko.observable();
	self.prop = {
		term : ['term', self.term],
		location : ['location', self.location],
		cll : ['cll', self.cll],
		bounds : ['bounds', self.bounds]
	};
	self.url = ko.observable();

	self.update = function(center, bounds, location) {
		// parses response elements from Google to update for new map location parameters
		self.location(location.split(/ /).join("+"));		
		self.cll(center.split(/[() ]/).join(""));
		self.bounds(bounds.split(/\), \(/).join("|").split(/[() ]/).join(""));
		self.url(self.base + self.urlGen());
	};

	self.urlGen = function() {
		// joins additional variables for Yelp API to be placed into url request
		var properties = [];
		for (var key in self.prop) {
			if (self.prop.hasOwnProperty(key)) {
				properties.push(self.prop[key][0] + '=' + self.prop[key][1]());
			}
		}
		return properties.join('&');
	};

	self.ajax = function(callback) {
		$.ajax({
			type: 'GET',
			url: '/yelp' + self.url(),
			dataType: 'json',
			success: callback
		});
	};

	self.responseParse = function(data, textStatus, jqXHR) {
		console.log(data.location.coordinate);
	};

	self.yelp = function() {
		self.ajax(self.responseParse);
	};
};

var ViewModel = function () {
	var self = this;
	self.googleSearch = ko.observable();
	self.geocoder = new google.maps.Geocoder();
	self.yelpSearch = new yelpSearch();

	self.init = function(element) {

		// Sets default element if no element is passed into function
		if (!element) {
			element = document.getElementById('map-canvas');
		}

		// Creates map object
		self.currentMap = new google.maps.Map(element);

		// Sets default location with bounds
		var location = new google.maps.LatLng(-34.397, 150.644);
		var southwest = new google.maps.LatLng(-34.64592382130048, 147.9138974609375);
		var northeast = new google.maps.LatLng(-34.14733356336124, 153.3741025390625);
		var bounds = new google.maps.LatLngBounds(southwest, northeast);
		
		// Calls updateMap function to set map to default location
		self.updateMap(self.currentMap, location, bounds);
	};

	self.googleCode = function() {
		self.geocoder.geocode({ 'address': self.googleSearch() }, function(results, status) {
	  		if (status == google.maps.GeocoderStatus.OK) {
	  			updates = results[0].geometry;
	  			self.yelpSearch.update(updates.location.toString(), updates.viewport.toString(), results[0].formatted_address);
		    	self.updateMap(self.currentMap, updates.location, updates.viewport);
		  	} else {
		  		self.errorReturn('geocoder');
		  	}
  		});
	};

	self.updateMap = function(map, location, bounds) {
		google.maps.event.addListenerOnce(map, 'idle', function() {
			// Run Some Function after Map is initialized. (LIKE YELPLING?)
			self.yelpSearch.yelp();
		});
		map.setCenter(location);
		map.fitBounds(bounds);	
	};

	self.checkEnter = function(data, e) {
		if (e.keyCode === 13) {
			self.googleCode();
		}
		return true;
	};

	self.errorReturn = function(error) {
		if (error === 'geocoder') {
			console.log(error);
		} else {
			console.log(error);
		}
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