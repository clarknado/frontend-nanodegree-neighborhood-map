var yelpSearch = function() {
	var self = this;

	// self.base = "/v2/search?";
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


	self.update = function(center, bounds, location) {
		// parses response elements from Google to update for new map location parameters
		// refactor with javascript string.replace prototype
		self.location(location.split(/ /).join("+"));		
		self.cll(center.split(/[() ]/).join(""));
		self.bounds(bounds.split(/\), \(/).join("|").split(/[() ]/).join(""));
		self.parameters(self.urlGen());
	};

	self.urlGen = function() {
		// joins additional variables for Yelp API to be placed into url request
		var properties = {};
		for (var key in self.prop) {
			if (self.prop.hasOwnProperty(key)) {
				properties[self.prop[key][0]] = self.prop[key][1]();
			}
		}
		return properties;
	};

/*	self.ajax = function(callback) {
		$.ajax({
			type: 'GET',
			url: '/yelp',
			contentType: 'json',
			data: $.param(self.url()),
			// beforeSend: "Loading Function"
			dataType: 'json',
			success: callback
		});
	};

	self.responseParse = function(data, textStatus, jqXHR) {
		self.markerList.push({
			loc : data.location.coordinate,
			title : data.name
		});

	};

	self.yelp = function() {
		self.ajax(self.responseParse);
	};*/
};

var ViewModel = function () {
	var self = this;
	self.googleSearch = ko.observable("San Francsico, CA");
	self.geocoder = new google.maps.Geocoder();
	self.yelpSearch = new yelpSearch();

	self.init = function(element) {

		// Sets default element if no element is passed into function
		if (!element) {
			element = document.getElementById('map-canvas');
		}

		// Creates map object
		self.currentMap = new google.maps.Map(element);

		// Creates initial call to Geocoding to initialize map at default location
		self.googleCode();

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
	}

	// $(document).ajaxComplete(self.markerPopulate());

	google.maps.event.addDomListener(window, 'load', self.init());
};

ko.applyBindings(new ViewModel());