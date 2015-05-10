var yelpSearch = function() {
	// Sets access for yelpSearch as self
	var self = this;

	// Initializes default settings and parameters
	self.term = ko.observable("food");
	self.location = ko.observable();
	self.cll = ko.observable();
	self.bounds = ko.observable();
	self.limit = ko.observable(10);

	// Default setup for parameters to be passed in AJAX request
	// allows for expansion or reduction of parameters on this
	// variable
	self.prop = {
		term : ['term', self.term],
		bounds : ['bounds', self.bounds],
		limit : ['limit', self.limit]
	};

	// URL to identify Proxy request and AJAX destination
	self.url = '/yelp';

	self.results = ko.observableArray([]);
	self.parameters = ko.observable();

	self.update = function(bounds) {
		// Clears previous Yelp results
	  	self.results([]);
		// Parses response elements from Google to update search
		// location parameters
		self.bounds(bounds.split(/\), \(/).join("|").split(/[() ]/).join(""));
		// stores updated parameters as key value hashtable for use
		// in AJAX request
		self.parameters(self.urlGen());
	};

	self.urlGen = function() {
		// Creates key value hashtable for parameters to be passed in
		// AJAX reqeust
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
	// Sets access for ViewModel as self
	var self = this;

	// Initiating function for establishing map element and initial
	// search
	self.init = function(element) {
		self.location = ko.observable("San Francsico, CA");
		self.searchField = ko.observable('location');
		self.search = ko.observable(self.location());
		self.yelpSearch = new yelpSearch();
		self.geocoder = new google.maps.Geocoder();


		// Sets default element if no element is passed into function
		if (!element) {
			element = document.getElementById('map-canvas');
		}

		// Creates google map object
		self.currentMap = new google.maps.Map(element);

		// Creates initial call to Geocoding to initialize map at
		// default location
		self.googleCode();

	};

	// Codes a string address into geocoordinates to update map and
	// Yelp results
	self.googleCode = function() {
		// Queries google database with a string address to return a
		// LatLng object
		self.geocoder.geocode({ 'address': self.location() }, function(results, status) {
			// Successful geocoding updates map location and
			// refreshes Yelp results
			// Errors are sent to error handling function
	  		if (status == google.maps.GeocoderStatus.OK) {
	  			// Parses results for first result's location
	  			// geometry
	  			updates = results[0].geometry;

	  			// Updates Yelp search parameters
	  			self.yelpSearch.update(updates.viewport.toString());

	  			// Uses AJAX request to proxy server with callback
	  			// for parsing response
	  			self.ajax(self.yelpSearch, self.yelpResponseParse);

	  			// Updates google map object with new coordinates
		    	self.updateMap(self.currentMap, updates.location, updates.viewport);
		  	} else {
		  		self.errorReturn(status);
		  	}
  		});
	};

	// Updates map object center and bounds
	self.updateMap = function(map, location, bounds) {
		// Requires google LatLng and LatLngBounds objects
		// respectively
		map.setCenter(location);
		map.fitBounds(bounds);
	};

	// Enables shortcut for search submission by Enter Key
	self.checkEnter = function(data, e) {
		if (e.keyCode === 13) {
			self.removeMarkers();
			if (self.searchField() === 'location') {
				self.location(self.search());
				self.googleCode();
			} else {
				self.yelpSearch.term(self.search());
				self.yelpSearch.update(self.currentMap.getBounds().toString());
				self.ajax(self.yelpSearch, self.yelpResponseParse);
			}

		}
		return true;
	};

	self.removeMarkers = function() {
		var markerList = self.yelpSearch.results();

		for (var i=0; i < markerList.length; i++) {
			markerList[i].marker.setMap(null);
		}
	}

	self.toggleField = function(data, e) {
		if (self.searchField() === 'location') {
			self.searchField('places');
			self.search(self.yelpSearch.term());
		} else {
			self.searchField('location');
			self.search(self.location());
		}
	}

	// Handles errors to display appropriate responses to client
	self.errorReturn = function(error1, error2, error3) {
		// Modifies search input to display error if google
		// Geocoding fails
		if (error1 === 'ZERO_RESULTS') {
			self.search("Your Search did not return any Results")
		}
		// Modifies map object to display error if google is
		// unavailable
		if (error1.message === 'google is not defined') {
			element = $('#map-canvas');
			element.addClass("error-text");
			element.text("Whoops! Google seems to be unavailble!")
		}
		// Modifies Yelp results to display error if Yelp AJAX
		// request to proxy fails
		if (error2 != undefined){
			self.yelpSearch.results.push({title: "No Yelp Results for your Location Search"});
		}
	};

	// Generic AJAX format for potential expansion of AJAX requests
	// to other databases
	self.ajax = function(obj, callback) {
		$.ajax({
			type: 'GET',
			url: obj.url,
			contentType: 'json',
			data: $.param(obj.parameters()),
			// TODO: beforeSend: "Loading Function"
			dataType: 'json',
			success: callback,
			error: self.errorReturn
		});
	};

	// Parses Yelp response and adds items to model
	self.yelpResponseParse = function(results) {
		results.forEach(function(result) {
			var loc = result.location.coordinate;
			var title = result.name;

			// Creates Marker object and selected portions of result
			// for secondary information to display on the view
			var item = {
				marker : new google.maps.Marker({
					position : {lat: loc.latitude, lng: loc.longitude},
					map : self.currentMap,
					title : title
				}),
				title : title,
				rating : "Rating: " + result.rating,
				review_count : "Number of Reviews: " + result.review_count,
				url: result.url,
				// Initially sets all secondary information to hidden
				showing: ko.observable(false)
			};
			// Adds each new item to a result list in Yelp model
			self.yelpSearch.results.push(item);
		});
	};

	// Toggles marker animation and display of secondary information // for each Yelp result
	self.currentPlace = function(item, event) {
		var marker = item.marker;

		if (marker.getAnimation() != null) {
			marker.setAnimation(null);
			item.showing(false);
		} else {
	    	marker.setAnimation(google.maps.Animation.BOUNCE);
	    	item.showing(true);
	  	}
	};

	// Tries to initalize a google event and throws an error if
	// google is unreachable
	try {
		google.maps.event.addDomListener(window, 'load', self.init());
	} catch (e) {
		self.errorReturn(e);
	}
};

// Initializes ViewModel with Knockout bindings
ko.applyBindings(new ViewModel());