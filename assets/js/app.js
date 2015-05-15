var PlacesList = function() {
	// Sets access for placesList as self
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
	self.yelp_results = {};
	self.google_results = {};
	self.parameters = ko.observable();

	self.update = function(bounds) {
		// Parses response elements from Google to update search
		// location parameters
		self.bounds(bounds.split(/\), \(/).join("|").split(/[() ]/).join(""));

		// stores updated parameters as key value hashtable for use
		// in AJAX request
		self.parameters(self.urlGen());
	};

	self.searchBounds = function(location) {
		// Creates approximately a 100sq meter boundary around a
		// given location
		var lat = location.lat();
		var lng = location.lng();
		var tmod = 0.0005;
		var gmod = 0.0005*Math.cos(lat);
		var sw = new google.maps.LatLng({lat: lat-tmod,
										lng: lng-gmod});
		var ne = new google.maps.LatLng({lat: lat+tmod,
										lng: lng+gmod});
		var latlng = new google.maps.LatLngBounds({sw: sw, ne: ne});
		self.update(latlng.toString());
	}

	self.urlGen = function() {
		// Creates key value hashtable for parameters to be passed in
		// AJAX reqeust
		var properties = {};
		for (var key in self.prop) {
			if (self.prop.hasOwnProperty(key) &&
				self.prop[key][1]() !== "") {
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
		self.placesList = new PlacesList();
		self.geocoder = new google.maps.Geocoder();
		self.container = document.getElementById('pac-container');
		self.input = document.getElementById('pac-input');
		self.list = ko.observableArray([]);
		self.currentList;
		self.preText = "Previous 5";
		self.nexText = "Next 5";
		self.populated = ko.observable(false);



		// Sets default element if no element is passed into function
		if (!element) {
			element = document.getElementById('map-canvas');
		}

		// Creates google map object
		self.map = new google.maps.Map(element);
		self.map.controls[google.maps.ControlPosition.TOP_LEFT].push(self.container);
		self.searchBox = new google.maps.places.SearchBox((self.input));

		// Creates initial call to Geocoding to initialize map at
		// default location
		self.googleCode();
		google.maps.event.addListener(self.searchBox, 'places_changed', function() {
			var places = self.searchBox.getPlaces();
			var bounds = places[0].geometry.viewport;

			if (places.length === 0) {
				return;
			} else if (bounds !== undefined) {
				self.map.fitBounds(bounds);
				self.query();

			} else {
				self.placesList.term(self.search);
				self.query(places);
			}

		});

		google.maps.event.addListener(self.map, 'bounds_changed', function() {
			var map = self.map;
			self.searchBox.setBounds(map.getBounds());
		});

	};

	self.query = function(places) {
		if (places !== undefined) {
			self.removeMarkers();
			self.googleResponseParse(places);
		} else {
		// self.removeMarkers();
		// self.placesList.update(self.map.getBounds().toString());
		// self.ajax(self.placesList, self.yelpResponseParse);
		}
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
	  			self.placesList.update(updates.viewport.toString());

	  			// Uses AJAX request to proxy server with callback
	  			// for parsing response
	  			self.ajax(self.placesList, self.yelpResponseParse);

	  			// Updates google map object with new coordinates
		    	self.updateMap(self.map, updates.location, updates.viewport);
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

	self.googleResponseParse = function(results) {
		var temp = {};
		var iter = [];

		for (var i=0; i<results.length; i++) {
			var result = results[i];
			var title = result.name;
			var location = result.geometry.location;

			var photo;
			if (result.photos) {
				photo = result.photos[0].getUrl({
					'maxWidth' : 100,
					'maxHeight' : 100});
			} else {
				photo = '';
			}

			var item = {
				marker : new google.maps.Marker({
					position : location,
					// map : self.map,
					title : title
				}),
				title : title,
				rating : "Google Rating: " + result.rating,
				review_count : "",
				url: "",
				location: location,
				photo: photo,
				alt: "Picture of " + title,

				// Initially sets all secondary information to hidden
				showing: ko.observable(false),
				clicked: ko.observable(false)
				};
			var key = title + location.toString();
			temp[key] = item;
			iter.push(key);
			}
		self.resultsFilter(self.placesList.google_results, temp);
		// self.iterator = iter.keys();
		self.keys = iter;
		self.currentList = [0,5];
		self.updateList();
		self.populated(true);
		};

	self.updateList = function() {
		var first = self.currentList[0];
		var last = self.currentList[1];
		var list = self.placesList.google_results;
		var temp = [];
		for (var i=first; i<last; i++) {
			temp.push(list[self.keys[i]]);
		}
		self.placesList.results(temp);
	}

	self.nextList = function() {
		var first = self.currentList[1];
		var last = first + 5;
		if (last <= self.keys.length) {
			self.currentList = [first, last];
		}
		self.updateList();
	}

	self.prevList = function() {
		var last = self.currentList[0];
		var first;
		if (last !== 0) {
			first = last - 5;
			self.currentList = [first, last];
		}
		self.updateList();
	}



	self.resultsFilter = function(oldList, newList) {

		for (key in oldList) {
			if (oldList.hasOwnProperty(key) &&
				!newList.hasOwnProperty(key)) {
				oldList[key].marker.setMap(null);
				delete oldList[key];
			} else if (oldList.hasOwnProperty(key) &&
					   newList.hasOwnProperty(key)) {
				delete newList[key];
			}
		}

		for (key in newList) {
			if (newList.hasOwnProperty(key)) {
				oldList[key] = newList[key];
				oldList[key].marker.setMap(self.map);
			}
		}
	}

	self.removeMarkers = function() {
		var markerList = self.placesList.results();

		for (var i=0; i < markerList.length; i++) {
			if (markerList[i].marker) {
				markerList[i].marker.setMap(null);
			}
		}
		self.placesList.results([]);
	};

	// Handles errors to display appropriate responses to client
	self.errorReturn = function(error1, error2, error3) {
		// Modifies search input to display error if google
		// Geocoding fails
		if (error1 === 'ZERO_RESULTS') {
			self.search("Your Search did not return any Results");
		}
		// Modifies map object to display error if google is
		// unavailable
		if (error1.message === 'google is not defined') {
			element = $('#map-canvas');
			element.addClass("error-text");
			element.text("Whoops! Google seems to be unavailble!");
		}
		// Modifies Yelp results to display error if Yelp AJAX
		// request to proxy fails
		if (error2 !== undefined){
			self.placesList.results.push({
				title: "No Yelp Results for your Location Search",
				rating: "",
				review_count: "",
				url: "",
				showing: ko.observable(false)
			});
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
		var temp = {};
		results.forEach(function(result) {
			var loc = result.location.coordinate;
			var title = result.name;

			var lat = loc.latitude;
			var lng = loc.longitude;
			var latlng = new google.maps.LatLng({lat: lat, lng: lng});

			// Creates Marker object and selected portions of result
			// for secondary information to display on the view
			var item = {
				marker : new google.maps.Marker({
					position : {lat: loc.latitude, lng: loc.longitude},
					// map : self.map,
					title : title
				}),
				title : title,
				rating : "Rating: " + result.rating,
				review_count : "Number of Reviews: " + result.review_count,
				url: result.url,
				photo: "",
				alt: "Picture of " + title,
				// Initially sets all secondary information to hidden
				showing: ko.observable(false)
			};
			// Adds each new item to a result list in Yelp model
			var key = title + latlng.toString();
			temp[key] = item;
		});
		// self.resultsFilter(self.placesList.yelp_results, temp);
	};

	// Toggles marker animation and display of secondary information // for each Yelp result
	self.togglePlace = function(item, event) {
		var marker = item.marker;

		if (item.clicked() === true) {
			marker.setAnimation(null);
			item.showing(false);
			item.clicked(false);
		} else {
	    	marker.setAnimation(google.maps.Animation.BOUNCE);
	    	item.showing(true);
	    	item.clicked(true);
	  	}
	};

	self.onPlace = function(item, event) {
		if (item.clicked() !== true) {
			item.marker.setAnimation(google.maps.Animation.BOUNCE);
			item.showing(true);
		}
	};

	self.offPlace = function(item, event) {
		if (item.clicked() !== true) {
			item.marker.setAnimation(null);
			item.showing(false);
		}
	};


	// Animation callbacks for the secondary information display
    self.showResult = function(elem) {
    	if (elem.nodeType === 1) {
    		$(elem).hide().slideDown();
    	}
    };

    self.hideResult = function(elem) {
    	if (elem.nodeType === 1) {
    		$(elem).slideUp(function() {
    			(elem).remove();
    		});
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

// Here's a custom Knockout binding that makes elements shown/hidden via jQuery's fadeIn()/fadeOut() methods
// Could be stored in a separate utility library
ko.bindingHandlers.fadeVisible = {
    init: function(element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden depending on the value
        var value = valueAccessor();
        $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
    },
    update: function(element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in or out
        var value = valueAccessor();
        ko.unwrap(value) ? $(element).fadeIn() : $(element).fadeOut();
        ko.unwrap(value) ? $(element).parent().addClass('selected') : $(element).parent().removeClass('selected');
    }
};

// Initializes ViewModel with Knockout bindings
ko.applyBindings(new ViewModel());