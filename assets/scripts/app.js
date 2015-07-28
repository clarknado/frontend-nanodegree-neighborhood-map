'use strict';

/** A constructor for the Model Space.
 * @constructor
 * @namespace PlacesList
 */
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
  self.placeResults = ko.observableArray().extend({ rateLimit: 250 });

  // Parameters to be used in ajax queries
  // Currently used specifically for Yelp
  self.parameters = ko.observable();

  /** A constructor for an item in the Model Space. Sets default
   * values and initializes items as knockout observables to update
   * the view.
   * @constructor Item
   * @memberof PlacesList
   * @namespace PlacesList.Item
   */
  self.Item = function() {
    this.marker = new google.maps.Marker({});
    this.infoWindow = new google.maps.InfoWindow({});
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
    this.markerImg = null;
  };

  /** Parses response elements from Google to update search
   * location and stores updated parameters as 'key' value
   * hashtable for use in AJAX request.
   * @method update
   * @memberof PlacesList
   * @param {string} bounds - google maps LatLng.toString()
   */
  self.update = function(bounds) {
    self.bounds(bounds.split(/\), \(/).join('|').split(/[() ]/).join(''));

    return self.urlGen();
  };

  /** Creates approximately a 10sq meter boundary around a given
   * location
   * @method searchBounds
   * @memberof PlacesList
   * @param {LatLng} location - google maps LatLng object
   */
  self.searchBounds = function(location) {
    var lat = parseFloat(location.lat());
    var lng = parseFloat(location.lng());
    var tmod = parseFloat(0.0001);
    var gmod = parseFloat(0.0001*Math.cos(lat));
    var sw = new google.maps.LatLng(lat-tmod, lng-gmod);
    var ne = new google.maps.LatLng(lat+tmod, lng+gmod);
    var latlng = new google.maps.LatLngBounds(sw, ne);
    return self.update(latlng.toString());
  };

  /** Creates key value hashtable for parameters to be passed in
   * AJAX request.
   * @memberof PlacesList
   * @method urlGen
   * @return {object} associativeArray - key value pairs of properties
   */
  self.urlGen = function() {
    var properties = {};
    for (var key in self.prop) {
      // Ignores properties set to ''
      if (self.prop.hasOwnProperty(key) &&
        self.prop[key][1]() !== '') {
        properties[self.prop[key][0]] = self.prop[key][1]();
      }
    }
    return properties;
  };

};

/** A constructor for the viewModel.
 * @constructor ViewModel
 * @namespace ViewModel
 */
var ViewModel = function () {
  // Sets access for ViewModel as self
  var self = this;

  /** Initiating function for establishing map element and initial
   * search.
   * @method init
   * @memberof ViewModel
   * @param {string} [element] - element to attach google map
   */
  self.init = function(element) {
    // Initial location for google map
    self.location = ko.observable('');

    //
    self.searchField = ko.observable('location');
    self.search = ko.observable(self.location());
    self.geocoder = new google.maps.Geocoder();

    // Initialize instance of Model
    self.placesList = new PlacesList();

    // DOM element to initialize google search box
    self.input = $('.pac-input')[0];

    // Initialize values for list tracking and view display
    self.selected = ko.observable();
    self.resultsVisible = ko.observable(false);
    self.currentItem = new self.placesList.Item();
    self.keys = ko.observableArray().extend({ rateLimit: 250 });
    self.list = ko.observableArray([]);
    self.currentList = ko.observable();
    self.populated = ko.observable(false);
    self.resultsView = ko.computed(function() {
      if(self.populated()) {
        var x = self.currentList()[0];
        var y = self.currentList()[1];
        var temp = [];
        var key, item;
        for (x; x<y; x++) {
          key = self.keys()[x];
          item = self.placesList.placeResults()[key];
          if (!item.searched() && Offline.state === 'up') {
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

    // Updates upper limit of currently displayed results
    self.topLimit = ko.computed(function() {
      if (self.populated()) {
        return self.currentList()[1];
      } else {
        return '';
      }
    });

    // Updates lower limit of currently displayed results
    self.botLimit = ko.computed(function() {
      if (self.populated()) {
        return self.currentList()[0] + 1;
      } else {
        return '';
      }
    });

    // Displays tab view of general results
    self.searchResult = ko.computed(function() {
      if (self.populated() && !self.selected()) {
        return !self.resultsVisible();
      } else {
        return false;
      }
    });

    // Displays tab view of selected result
    self.itemInfo = ko.computed(function() {
      if (self.populated() && self.selected()) {
        return !self.resultsVisible();
      } else {
        return false;
      }
    });

    // Displays list view of results
    self.displayResult = ko.computed(function() {
      if (self.populated()) {
        return self.resultsVisible();
      } else {
        return false;
      }
    });

    // Sets default element if no element is passed into function
    if (!element) {
      element = $('.map-canvas')[0];
    }

    // Creates google map object
    self.map = new google.maps.Map(element);

    // Attaches DOM element to map
    // self.map.controls[google.maps.ControlPosition.TOP_LEFT].push(self.container);

    // Creates a google search box to implement place searches
    // and Autocomplete features
    self.searchBox = new google.maps.places.SearchBox((self.input));

    // Initial call to Geocoding to establish map at default location
    self.googleCode();

    // Adds listener to search box to detect submission either by
    // enter key or selection of an autocomplete suggestion
    google.maps.event.addListener(self.searchBox, 'places_changed', function() {
      // Obtains a list of places for search submission
      var places = self.searchBox.getPlaces();

      // Isolates viewport of first result which is used to
      // determine if submission was a location search
      var bounds = places[0].geometry.viewport;

      // Determine if submission was a location search or an
      // establishment search
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

    // Sets offline/online alerts for user
    Offline.check();
    Offline.on('up', function() {
        alert('Internet is reconnected');
    });
    Offline.on('down', function() {
      alert('Internet is disconnected');
    });

    // Delay initializiation of functions
    window.onload = function() {
      // Adds hover listener to collapse/expand results list
      $('.prev-contain').hoverIntent(self.onResultsVisible, self.offResultsVisible);

      // Callback to create copy element to prevent overlap of autocomplete
      var cb1 = function(target, copy) {
        if (target.css('display') === 'none') {
          copy.slideUp();
        } else {
          copy.css({height: target.height()});
          copy.slideDown();
        }
      };

      // Establish variables for mutation observer
      var p1 = [$('.pac-container'), $('.autocomplete'), cb1];
      var parings = [p1];
      var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

      // Event listener triggered on mutation of target element
      var setObserver = function(observer, element, bubbles) {
        observer.observe(element, { attributes: true, subtree: bubbles, attributeFilter: ['style'] });
      };

      // Iterate over groupings for mutation event listeners
      parings.forEach(function(pair) {
        var target = pair[0],
            copy = pair[1],
            callback = pair[2];
        var element = target[0],
            bubbles = false;
        var observer = new MutationObserver(function() {
          callback(target, copy);
        });
        setObserver(observer, element, bubbles);
      });
    };
  };

  /** Runs query results functions with new places search.
   * @method query
   * @memberof ViewModel
   * @param {json} [places] - Results from google places search
   */
  self.query = function(places) {
    if (places !== undefined) {
      self.googleResponseParse(places);
      $('.pac-input').blur();
    }
  };

  /** Codes a string address into geocoordinates to update map.
   * @method googleCode
   * @memberof ViewModel
   */
  self.googleCode = function() {
    var location;

    if (self.location() === '') {
      location = 'San Francisco, CA';
    } else {
      location = self.location();
    }

    // Queries google database with a string address to return a
    // LatLng object
    self.geocoder.geocode({ 'address': location }, function(results, status) {
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

  /** Updates map object center and bounds.
   * @method updateMap
   * @memberof ViewModel
   * @param {Map} map - preinitialized google maps map object
   * @param {LatLng} location - google maps LatLng object
   * @param {LatLngBounds} bounds - google maps LatLngBounds object
   */
  self.updateMap = function(map, location, bounds) {
    map.setCenter(location);
    map.fitBounds(bounds);
  };

  /** Parses google places search to update the list in teh view and
   * store in the placesList model.
   * @method googleResponseParse
   * @memberof ViewModel
   * @param {json} response - json response from google maps places search
   */
  self.googleResponseParse = function(results) {
    var temp = {};
    var iter = [];
    var len;
    var newBounds = new google.maps.LatLngBounds();

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
          'maxHeight' : 75});
      } else {
        photo = '';
      }

      // Create new Item object
      var item = new self.placesList.Item();

      // Set item's properties
      item.marker = new google.maps.Marker({});
      item.marker.setPosition(location);
      item.marker.setTitle(title);
      item.infoWindow = new google.maps.InfoWindow({});
      item.title(title);
      item.rating('Google Rating: ' + result.rating);
      item.urlTitle(title);
      item.location = location;
      item.photo(photo);
      item.alt('Picture of ' + title);
      item.markerImg = {
        url: result.icon,
        size: new google.maps.Size(71, 71),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(17, 34),
        scaledSize: new google.maps.Size(25, 25)
      };
      item.marker.setIcon(item.markerImg);

      // Extends the bounds to include the item's location
      newBounds.extend(location);

      // Adds details and event listeners to markers/infowindows
      self.addMouseOver(item);
      self.addInfo(item);
      self.wikiRequest(item);

      // Updates info window to have initial value
      self.updateInfo(item, title);

      // Create unique key from name and geolocation
      var key = title + location.toString();
      item.key = key;

      // Create temp associatve array to store values
      temp[key] = item;

      // Create temp array to store keys
      iter.push(key);
      }

    // Resets viewport to contain all new searched items
    self.map.fitBounds(newBounds);

    // Filter results to 'update' results rather than replace
    self.resultsFilter(self.placesList.placeResults, temp, self.keys);

    // Set index of current listing in view
    len = self.keys().length;
    if (5 <= len) {
      self.currentList([0,5]);
    } else {
      self.currentList([0, len]);
    }

    // Update list displayed in the View
    if (len > 0) {
      self.resultsVisible(true);
      self.populated(true);
      // self.searchInfo(true);
    }
    };

  /** Updates the View with the next 5 results only if there are
   * more results.
   * @method nextList
   * @memberof ViewModel
   */
  self.nextList = function() {
    var first = self.currentList()[1];
    var last = first + 5;
    if (last <= self.keys().length) {
      self.currentList([first, last]);
    }
  };

  /** Updates the View with the previous 5 results only if there
   * are previous results.
   * @method prevList
   * @memberof ViewModel
   */
  self.prevList = function() {
    var last = self.currentList()[0];
    var first;
    if (last !== 0) {
      first = last - 5;
      self.currentList([first, last]);
    }
  };

  /** Sets current state of object for AJAX request and for
   * identification during parsing of correct object to modify.
   * @method setState
   * @memberof ViewModel
   * @param {string} key - Key from key:value pair of Item
   */
  self.setState = function(key) {
    var obj = {};
    obj.key = key;
    obj.url = self.urlGen();
    obj.parameters = self.paramGen(key);
    self.ajax(obj, self.yelpResponseParse);
  };

  /** Opens Info Window attached to marker when mouseover event
   * occurs on the marker item and changes the Icon. It also reverts
   * the previous item's icon and closes its info window.
   * It will also toggle same properties with @togglePlace when
   * clicked.
   * @method addMouseOver
   * @memberof ViewModel
   * @param {object} item - item object from Model database
   */
  self.addMouseOver = function(item) {
    var marker = item.marker;
    // Reverts previous item's marker state and modifies new item's marker
    // and updates the 'current item'
    var closeCurrentItem = function() {
      self.currentItem.infoWindow.close();
      self.currentItem.marker.setIcon(self.currentItem.markerImg);
    };

    google.maps.event.addListener(marker, 'mouseover', function() {
      closeCurrentItem();
      item.infoWindow.open(self.map, marker);
      item.marker.setIcon(null);
      self.currentItem = item;
    });

    google.maps.event.addListener(marker, 'click', function() {
      self.togglePlace(self.currentItem);
    });
  };

  /* TODO: change wikipedia request to search by geolocation of place
   * rather than name.
   */

  /** Initiates wikipedia search for articles related to the name
   * of the item.
   * @method wikiRequest
   * @memberof ViewModel
   * @param {object} item - item object from Model database
   */
  self.wikiRequest = function(item) {
    // Set text return for AJAX failure
    var fail = 'failed to get wikipedia resources';

    // Set timeout to limit wait time for AJAX response
    var wikiRequestTimeout = setTimeout(function(){
      self.updateInfo(item, fail);
    }, 8000);

    // Set API url for request
    var wikiAPIurl = 'http://en.wikipedia.org/w/api.php?format=json&action=query&list=search&srsearch=' + item.title().split(' ').join('+');

    // AJAX function
    $.ajax({
      url: wikiAPIurl,
      dataType: 'jsonp',
      // Parse results into html elements to insert into info window
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

  /** Updates the info window for an item with new content.
   * @method updateInfo
   * @memberof ViewModel
   * @param {object} item - item object from Model database
   * @param {string} content - valid html formatted string element
   */
  self.updateInfo = function(item, content) {
    item.infoContent(content);
    item.infoWindow.setContent(item.infoCalculated());
  };

  /** Adds infoCalculated to the item object as a knockout computed
   * object.
   * @method addInfo
   * @memberof ViewModel
   * @param {object} item - item object from Model database
   */
  self.addInfo = function(item) {
    item.infoCalculated = ko.computed(function() {
      return '<div class="info-window">'+ item.infoContent() + '</div>';
    });
  };

  /** Returns url for AJAX request.
   * @method urlGen
   * @memberof ViewModel
   */
  self.urlGen = function() {
    return self.placesList.url;
  };

  /** Returns parameters for AJAX request.
   * @method paramGen
   * @memberof ViewModel
   */
  self.paramGen = function(key) {
    return self.placesList.searchBounds(self.placesList.placeResults()[key].location);
  };

  /** Filters results to only 'update' the result list rather than
   * completely replace with new results.
   * @method resultsFilter
   * @memberof ViewModel
   * @param {object} obsList - Observable Array of current Item objects
   * @param {array} newList - Array of new Item objects
   * @param {object} keys - Observable Array of current keys
   */
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

    // Creates new list of keys after updated oldList is created
    for (key in oldList) {
      if (oldList.hasOwnProperty(key)) {
        temp.push(key);
      }
    }

    // Updates obsList and keys at almost same time
    obsList(oldList);
    keys(temp);
  };

  /** Handles errors to display appropriate responses to client
   * @method errorReturn
   * @memberof ViewModel
   * @param {string} error1 - string of error result (jqXHR)
   * @param {string} error2 - string of error result (textStatus)
   * @param {string} error3 - string of error result (textStatus)
   * @param {object} obj - itentifier object to link AJAX and item object
   */
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
      var item = self.placesList.placeResults()[obj.key];
      item.urlTitle = 'No Yelp Results';
    }
  };

  /** Generic AJAX format for potential expansion of AJAX requests
   * to other databases
   * @method ajax
   * @memberof ViewModel
   * @param {object} obj - itentifier object to link AJAX and item object
   * @param {function} callback - function to be used as callback
   */
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

  /** Parses Yelp response and updates the items in the model
   * @method yelpResponseParse
   * @memberof ViewModel
   * @param {object} obj - itentifier object to link AJAX and item object
   * @param {string} results - results from yelp AJAX response
   */
  self.yelpResponseParse = function(obj, results) {
    /* TODO: Create a better implementation to match up google
     * results with yelp reviews and pages. Consider some simple
     * name parsing or comparision of categories of the
     * establishment
     */

    var item = self.placesList.placeResults()[obj.key];

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

  /** Toggles marker animations and display of secondary information
   * for each Yelp result upon click
   * @method togglePlace
   * @memberof ViewModel
   * @param {object} item - item object from Model database
   */
  self.togglePlace = function(item) {
    var marker = item.marker;
    var current = self.selected();

    var closeCurrentItem = function(koItem) {
      var i = koItem();
      i.marker.setAnimation(null);
      i.showing(false);
      i.clicked(false);
      koItem(null);
    };

    if (self.selected()) {
      closeCurrentItem(self.selected);
    }

    // Extra toggle of clicked property allows mouseover events
    // to have the same animations
    if (item.clicked() !== true && current !== item) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      item.showing(true);
      item.clicked(true);
      self.selected(item);
    }
    return true;
  };

  /** Turns off display of Results DOM upon click
   * @method offResultsVisible
   * @memberof ViewModel
   */
  self.offResultsVisible = function() {
    self.resultsVisible(false);
    return true;
  };

  /** Turns on display of Results DOM upon click
   * @method onResultsVisible
   * @memberof ViewModel
   */
  self.onResultsVisible = function() {
    if (self.populated()) {
      self.resultsVisible(true);
    }
    return true;
  };

  /** Toggles on the marker animation and display of secondary
   * information for each Yelp result upon mouseover
   * @method onPlace
   * @memberof ViewModel
   * @param {object} item - item object from Model database
   */
  self.onPlace = function(item) {
    if (item.clicked() !== true) {
      item.marker.setAnimation(google.maps.Animation.BOUNCE);
      item.showing(true);
    }
    return true;
  };

  /** Toggles off the marker animation and display of secondary
   * information for each Yelp result upon mouseover
   * @method offPlace
   * @memberof ViewModel
   * @param {object} item - item object from Model database
   */
  self.offPlace = function(item) {
    if (item.clicked() !== true) {
      item.marker.setAnimation(null);
      item.showing(false);
    }
    return true;
  };

  /** Animation callback for the secondary information display
   * @method showResult
   * @memberof ViewModel
   * @param {string} elem - DOM element to use as jQuery selector
   */
  self.showResult = function(elem) {
    if (elem.nodeType === 1) {
      $(elem).hide().slideDown();
    }
  };

  /** Animation callback for the secondary information display
   * @method hideResult
   * @memberof ViewModel
   * @param {string} elem - DOM element to use as jQuery selector
   */
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


/** custom Knockout binding makes elements shown/hidden via jQuery's
 * fadeIn()/fadeOut() methods
 * @namespace ko.bindingHandler.fadeVisible
 * @method fadeVisible
 */
ko.bindingHandlers.fadeVisible = {
    init: function(element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden
        // depending on the value
        var value = valueAccessor();
        // Use "unwrapObservable" to handle values that may or may not be observable
        $(element).toggle(ko.unwrap(value));
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        // Whenever the value changes, fade the element in or out
        $(element)[ko.unwrap(value) ? 'fadeIn' : 'fadeOut']();
        // Whenever the value changes, add/remove class in parent element
        $(element).closest('.result')[ko.unwrap(value) ? 'addClass' : 'removeClass']('selected');
    }
};

// Initializes ViewModel with Knockout bindings
ko.applyBindings(new ViewModel());