'use strict';

var PlacesList = function() {
  // Sets access for placesList as self
  var self = this;

  // Initializes default settings and parameters
  self.term = ko.observable('');
  self.location = ko.observable('');
  self.cll = ko.observable('');
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

  // Lists of search results and selections for dispaly on View
  // self.results = ko.computed();
  self.yelpResults = ko.observableArray();
  self.googleResults = ko.observableArray().extend({ rateLimit: 250 });

  // Parameters to be used in Yelp queries
  self.parameters = ko.observable();

  // Item skeleton to be used in response parsing to update values // from search results
  self.Item = function() {
    this.marker = '';
    this.infoWindow = '';
    this.infoContent = ko.observable('');
    this.title = ko.observable();
    this.rating = ko.observable();
    this.reviewCount = ko.observable();
    this.url = ko.observable();
    this.urlTitle = ko.observable();
    this.location = '';
    this.photo = ko.observable();
    this.alt = ko.observable();
    this.showing = ko.observable(false);
    this.clicked = ko.observable(false);
    this.searched = ko.observable(false);
    this.key = ko.observable();
  };

  self.update = function(bounds) {
    // Parses response elements from Google to update search
    // location parameters
    self.bounds(bounds.split(/\), \(/).join('|').split(/[() ]/).join(''));

    // stores updated parameters as key value hashtable for use
    // in AJAX request
    return self.urlGen();
  };

  self.searchBounds = function(location) {
    // Creates approximately a 10sq meter boundary around a
    // given location
    var lat = parseFloat(location.lat());
    var lng = parseFloat(location.lng());
    var tmod = parseFloat(0.0001);
    var gmod = parseFloat(0.0001*Math.cos(lat));
    var sw = new google.maps.LatLng(lat-tmod, lng-gmod);
    var ne = new google.maps.LatLng(lat+tmod, lng+gmod);
    var latlng = new google.maps.LatLngBounds(sw, ne);
    return self.update(latlng.toString());
  };

  self.urlGen = function() {
    // Creates key value hashtable for parameters to be passed in
    // AJAX reqeust
    var properties = {};
    for (var key in self.prop) {
      // It ignores properties set to ''
      if (self.prop.hasOwnProperty(key) &&
        self.prop[key][1]() !== '') {
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
    // Initial location for google map
    self.location = ko.observable('San Francisco, CA');

    // Deprecated values
    self.searchField = ko.observable('location');
    self.search = ko.observable(self.location());
    self.geocoder = new google.maps.Geocoder();

    // Initialize instance of Model
    self.placesList = new PlacesList();

    // Grab DOM elements to attach to map and initialize google
    // search box
    self.container = $('.pac-container')[0];
    self.input = $('.pac-input')[0];

    // Initialize values for list tracking and view display
    self.currentInfoWindow = new google.maps.InfoWindow({});
    self.keys = ko.observableArray().extend({ rateLimit: 250 });
    self.list = ko.observableArray([]);
    self.currentList = ko.observable();
    self.preText = ko.observable('Previous');
    self.nexText = ko.observable('Next');
    self.populated = ko.observable(false);
    self.resultsView = ko.computed(function() {
      if(self.populated()) {
        var x = self.currentList()[0];
        var y = self.currentList()[1];
        var temp = [];
        var key, item;
        for (x; x<y; x++) {
          key = self.keys()[x];
          item = self.placesList.googleResults()[key];
          if (!item.searched()) {
            item.searched(true);
            // Sets current state of object for AJAX search
            self.setState(key);
          }
          temp.push(item);
        }
        return temp;
      } else {
        return [];
      }
    });


    // Sets default element if no element is passed into function
    if (!element) {
      element = $('.map-canvas')[0];
    }

    // Creates google map object
    self.map = new google.maps.Map(element);

    // Attaches DOM element to map
    self.map.controls[google.maps.ControlPosition.TOP_LEFT].push(self.container);

    // Creates a google search box to implement place searches
    // and Autocomplete features
    self.searchBox = new google.maps.places.SearchBox((self.input));

    /* TODO: Completely remove geocoding functionality and
     * excluively rely upon the search box functionality
     */

    // Creates initial call to Geocoding to initialize map at
    // default location
    self.googleCode();

    // Adds listener to search box to detect submission either by
    // enter key or selection of an autocomplete suggestion
    google.maps.event.addListener(self.searchBox, 'places_changed', function() {
      // Obtains a list of places for search submission
      var places = self.searchBox.getPlaces();

      // Isolates viewport of first result which is used to
      // determine if submission was a location search
      var bounds = places[0].geometry.viewport;

      // Simple logic to determine if submission was a
      // location search or an establishment search
      if (places.length === 0) {
        return;
      } else if (bounds !== undefined) {
        /* TODO: Rerun previous places search with new
         * location boundary. It should show the same type
         * of establishments in the new location
         */
        self.map.fitBounds(bounds);
        self.query();
      } else {
        self.query(places);
      }

    });

    // Adds listener to map to detect changes of the viewport
    google.maps.event.addListener(self.map, 'bounds_changed', function() {
      var map = self.map;
      // Creates bias in search box results for places within
      // the map viewport
      self.searchBox.setBounds(map.getBounds());
    });

  };

  // Runs query results functions with new places search
  self.query = function(places) {
    if (places !== undefined) {
      self.googleResponseParse(places);
    }
  };

  // Codes a string address into geocoordinates to update map
  self.googleCode = function() {
    // Queries google database with a string address to return a
    // LatLng object
    self.geocoder.geocode({ 'address': self.location() }, function(results, status) {
      // Successful geocoding updates map location
      // Errors are sent to error handling function
        if (status === google.maps.GeocoderStatus.OK) {
          // Parses results for first result's location
          // geometry
          var updates = results[0].geometry;

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

  // Parses google places search to update the list in the view and
  // store in the placesList model
  self.googleResponseParse = function(results) {
    var temp = {};
    var iter = [];
    var len;

    // Iterates over results, creating and updating an model
    // item for use by the viewModel
    len = results.length;
    for (var i=0; i<len; i++) {
      // Pull properties from result
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

      // Create new Item object
      var item = new self.placesList.Item();

      // Set item's properties
      item.marker = new google.maps.Marker({
          position : location,
          title : title
        });
      item.infoContent(title);
      item.infoWindow = new google.maps.InfoWindow({});
      item.title(title);
      item.rating('Google Rating: ' + result.rating);
      item.urlTitle(title);
      item.location = location;
      item.photo(photo);
      item.alt('Picture of ' + title);

      self.addMouseOver(item);
      self.addInfo(item);
      self.wikiRequest(item);

      item.infoWindow.setContent(item.infoCalculated());

      // Create unique key from name and geolocation
      var key = title + location.toString();
      item.key = key;

      // Create temp associatve array to store values
      temp[key] = item;

      // Create temp array to store keys
      iter.push(key);
      }

    // Filter results to 'update' results rather than replace
    self.resultsFilter(self.placesList.googleResults, temp, self.keys);

    // Set index of current listing in view
    len = self.keys().length;
    if (5 <= len) {
      self.currentList([0,5]);
    } else {
      self.currentList([0, len]);
    }

    // Update list displayed in the View
    // self.updateList();
    self.populated(true);
    };

  // Updates the View with the next 5 results only if there are
  // more results
  self.nextList = function() {
    var first = self.currentList()[1];
    var last = first + 5;
    if (last <= self.keys().length) {
      self.currentList([first, last]);
    }
    // self.updateList();
  };

  // Updates the View with the previous 5 results only if there
  // are previous results
  self.prevList = function() {
    var last = self.currentList()[0];
    var first;
    if (last !== 0) {
      first = last - 5;
      self.currentList([first, last]);
    }
    // self.updateList();
  };

  // Sets current state of object for AJAX request and for
  // identification during parsing of correct object to modify
  self.setState = function(key) {
    var obj = {};
    obj.key = key;
    obj.url = self.urlGen();
    obj.parameters = self.paramGen(key);
    self.ajax(obj, self.yelpResponseParse);
  };

  self.addMouseOver = function(item) {
    var marker = item.marker;
    var infowindow = item.infoWindow;
    google.maps.event.addListener(marker, 'mouseover', function() {
      self.currentInfoWindow.close();
      infowindow.open(self.map, marker);
      self.currentInfoWindow = infowindow;
    });
  };

  self.wikiRequest = function(item) {
    // Set Wikipedia AJAX request here
    var fail = 'failed to get wikipedia resources';
    var wikiRequestTimeout = setTimeout(function(){
      self.updateInfo(item, fail);
    }, 8000);

    var wikiAPIurl = 'http://en.wikipedia.org/w/api.php?format=json&action=query&list=search&srsearch=' + item.title().split(' ').join('+');
    $.ajax({
      url: wikiAPIurl,
      dataType: 'jsonp',
      success: function (data) {
        var temp = ['<ul>'];
        $.each(data.query.search, function (index, article) {
          if(index < 3) {
            temp.push('<li class=article><a href="http://en.wikipedia.org/wiki/'+ article.title + '">' +
                article.title + '</a></li>');
          }
        });
        temp.push('</ul>');
        clearTimeout(wikiRequestTimeout);
        var wikiTitle = 'Wikipedia Results for ' + item.title();
        var content = '<div>' + wikiTitle + temp.join('') + '</div>';
        self.updateInfo(item, content);
        },
      error: function(jqXHR, textStatus, errorThrown) {
        self.updateInfo(item, fail);
        self.errorReturn(jqXHR, textStatus, errorThrown);
      }
    });
  };

  self.updateInfo = function(item, content) {
    item.infoContent(content);
    item.infoWindow.setContent(item.infoCalculated());
    console.log(item.infoWindow.getContent());
  };

  self.addInfo = function(item) {
    item.infoCalculated = ko.computed(function() {
      return '<div class="info-window">'+ item.infoContent() + '</div>';
    });
  };

  // Returns url for AJAX request
  self.urlGen = function() {
    return self.placesList.url;
  };

  // Returns parameters for AJAX request
  self.paramGen = function(key) {
    return self.placesList.searchBounds(self.placesList.googleResults()[key].location);
  };

  // Filters results to only 'update' the result list rather than
  // completely replace with new results
  self.resultsFilter = function(obsList, newList, keys) {
    var oldList = obsList();
    var temp = [];
    var key;

    // Checks if oldList key is in newList and removes it from
    // the map if it is not, or deletes it from the newList if
    // it is found
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

    // Sets newList's markers on the map and adds the object to
    // the oldList
    for (key in newList) {
      if (newList.hasOwnProperty(key)) {
        oldList[key] = newList[key];
        oldList[key].marker.setMap(self.map);
      }
    }

    for (key in oldList) {
      if (oldList.hasOwnProperty(key)) {
        temp.push(key);
      }
    }

    obsList(oldList);
    keys(temp);
  };

  // Handles errors to display appropriate responses to client
  self.errorReturn = function(error1, error2, error3, obj) {
    // Modifies search input to display error if google
    // Geocoding fails
    if (error1 === 'ZERO_RESULTS') {
      self.search('Your Search did not return any Results');
    }
    // Modifies map object to display error if google is
    // unavailable
    if (error1.message === 'google is not defined') {
      var element = $('.map-canvas')[0];
      element.addClass('error-text');
      element.text('Whoops! Google seems to be unavailble!');
    }
    // Modifies url label to display error if Yelp AJAX
    // request to proxy fails
    if (error2 !== undefined && obj !== undefined){
      var item = self.placesList.googleResults()[obj.key];
      item.urlTitle = 'No Yelp Results';
      self.updateList();
    }
  };

  // Generic AJAX format for potential expansion of AJAX requests
  // to other databases
  self.ajax = function(obj, callback) {
    $.ajax({
      type: 'GET',
      url: obj.url,
      contentType: 'json',
      data: $.param(obj.parameters),
      // TODO: beforeSend: "Loading Function"
      dataType: 'json',
      success: function(data, textStatus, jqXHR) {
        callback(obj, data, textStatus, jqXHR);
      },
      error: function(jqXHR, textStatus, errorThrown) {
        self.errorReturn(jqXHR, textStatus, errorThrown, obj);
      }
    });
  };

  // Parses Yelp response and updates the model
  self.yelpResponseParse = function(obj, results) {
    /* TODO: Create a better implementation to match up google
     * results with yelp reviews and pages. Consider some simple
     * name parsing or comparision of categories of the
     * establishment
     */

    var item = self.placesList.googleResults()[obj.key];

    results.forEach(function(result) {

      // Assumes that a single result inside search location
      // corresponds to a successful match
      if (results.length === 1) {
        item.url(result.url);
        item.urlTitle(result.name);
        item.rating('Yelp Rating: ' + result.rating);
        item.reviewCount('Number of Reviews: ' + result.reviewCount);
      } else {
        item.urlTitle('Yelp Produced Multiple Results!');
      }
    });
  };

  /* TODO: Merge click and mouseover events to a single function
   * call.
   */

  // Toggles marker animation and display of secondary information // for each Yelp result upon click
  self.togglePlace = function(item, event) {
    var marker = item.marker;
    if(event === 'togglePlace') {
    }

    // Extra toggle of clicked property allows mouseover events
    // to have the same animations
    if (item.clicked() === true) {
      marker.setAnimation(null);
      item.showing(false);
      item.clicked(false);
    } else {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        item.showing(true);
        item.clicked(true);
      }
      return true;
  };

  // Toggles on the marker animation and display of secondary
  // information for each Yelp result upon mouseover
  self.onPlace = function(item, event) {
    if(event === 'onPlace') {
    }
    if (item.clicked() !== true) {
      item.marker.setAnimation(google.maps.Animation.BOUNCE);
      item.showing(true);
    }
    return true;
  };

  // Toggles off the marker animation and display of secondary
  // information for each Yelp result upon mouseover
  self.offPlace = function(item, event) {
    if(event === 'offPlace') {
    }
    if (item.clicked() !== true) {
      item.marker.setAnimation(null);
      item.showing(false);
    }
    return true;
  };


  // Animation callback for the secondary information display
    self.showResult = function(elem) {
      if (elem.nodeType === 1) {
        $(elem).hide().slideDown();
      }
    };

    // Animation callback for the secondary information display
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

// custom Knockout binding makes elements shown/hidden via jQuery's
// fadeIn()/fadeOut() methods
ko.bindingHandlers.fadeVisible = {
    init: function(element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden
        // depending on the value
        var value = valueAccessor();
        $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
    },
    update: function(element, valueAccessor) {
        // Whenever the value changes, fade the element in or out
        var value = valueAccessor();
        $(element)[ko.unwrap(value) ? 'fadeIn' : 'fadeOut']();
        // ko.unwrap(value) ? $(element).fadeIn() : $(element).fadeOut();
        // Whenever the value changes, add/remove class to parent
        // element
        $(element).closest('.result')[ko.unwrap(value) ? 'addClass' : 'removeClass']('selected');
        //ko.unwrap(value) ? $(element).parent().parent().parent().addClass('selected') : $(element).parent().parent().parent().removeClass('selected');
    }
};

// Initializes ViewModel with Knockout bindings
ko.applyBindings(new ViewModel());