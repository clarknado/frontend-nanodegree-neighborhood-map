var yelpSearch = function() {
	var self = this;

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
	self.url = '/yelp';
	self.markerList = ko.observableArray();
	self.parameters = ko.observable();
	self.searchResults = ko.observableArray();


	self.update = function(center, bounds, location) {
		// parses response elements from Google to update for new map location parameters
		self.location(location.split(/ /).join("+"));		
		self.cll(center.split(/[() ]/).join(""));
		self.bounds(bounds.split(/\), \(/).join("|").split(/[() ]/).join(""));
		self.parameters(self.parameterGen());
	};

	self.parameterGen = function() {
		// creates current dictionary of parameters for Yelp API to be used in url request
		var properties = {};
		for (var key in self.prop) {
			if (self.prop.hasOwnProperty(key)) {
				properties[self.prop[key][0]] = self.prop[key][1]();
			}
		}
		return properties;
	};

};

var ViewModel = function () {
	var self = this;
	self.googleSearch = ko.observable("San Francsico, CA");
	self.geocoder = new google.maps.Geocoder();
	self.yelpSearch = new yelpSearch();
	self.input = document.getElementById('pac-input');
	

	self.init = function(element) {

		// Sets default element if no element is passed into function
		if (!element) {
			element = document.getElementById('map-canvas');
		}

		// Creates map object
		self.currentMap = new google.maps.Map(element);
		self.currentMap.controls[google.maps.ControlPosition.TOP_LEFT].push(self.input);
		self.searchBox = new google.maps.places.SearchBox((self.input));

		// Creates initial call to Geocoding to initialize map at default location
		self.googleCode();
		google.maps.event.addListener(self.searchBox, 'places_changed', function() {
			var places = self.searchBox.getPlaces();
			self.currentMap.fitBounds(self.yelpSearch)
		});

		google.maps.event.addListener(self.currentMap, 'bounds_changed', function() {
			var map = self.currentMap;
			self.searchBox.setBounds(map.getBounds());
		});

	};

	self.googleCode = function() {
		self.geocoder.geocode({ 'address': self.googleSearch() }, function(results, status) {
	  		if (status == google.maps.GeocoderStatus.OK) {
	  			updates = results[0].geometry;
	  			self.yelpSearch.update(updates.location.toString(), updates.viewport.toString(), results[0].formatted_address);
	  			self.ajax(self.yelpSearch, self.markerPopulate);
		    	self.updateMap(self.currentMap, updates.location, updates.viewport);
		  	} else {
		  		self.errorReturn('geocoder');
		  	}
  		});
	};

	self.updateMap = function(map, location, bounds) {
		google.maps.event.addListenerOnce(map, 'idle', function() {
			// Run Some Function after Map is initialized. (LIKE YELPLING?)
		});
		self.searchBox.setBounds(bounds); 
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

	self.ajax = function(obj, callback) {
		$.ajax({
			type: 'GET',
			url: obj.url,
			contentType: 'json',
			data: $.param(obj.parameters()),
			// beforeSend: "Loading Function"
			dataType: 'json',
			success: callback
		});
	};

	// Initialize marker array for Google Map Marker objects
	self.markers = ko.observableArray([]);

	self.markerPopulate = function(markerList) {
		// Add markers to map from data array
		markerList.forEach(function(markerItem) {
			var loc = markerItem.location.coordinate;
			var title = markerItem.name;

			var marker = new google.maps.Marker({
				position : {lat: loc.latitude, lng: loc.longitude},
				map : self.currentMap,
				title : title
			});

			self.markers.push(marker);
		});
	};

	google.maps.event.addDomListener(window, 'load', self.init());

};

ko.applyBindings(new ViewModel());