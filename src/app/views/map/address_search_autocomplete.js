define([
  'jquery',
  'underscore',
  'backbone',
  'toastr',
  'fusejs',
  'autocomplete',
  'text!templates/map/address_search.html'
], function($, _, Backbone, toastr, Fuse, AutoComplete, AddressSearchTemplate){

  var AddressSearchACView = Backbone.View.extend({
    $container: $('#search'),

    SEARCH_URL: 'https://search.mapzen.com/v1/search',

    // top,left,bottom,right
    SEARCH_BOUNDS: [38.79163, -77.119766, 38.995853, -76.909363],

    SEARCH_API_KEY: 'search-oqsffOQ',

    ERRORS: {
      noimage: 'Address not found! Trying adding the relevant zip code.'
    },

    initialize: function(options){
      this.mapView = options.mapView;
      this.state = options.state;
      this.fuse = null;
      this.autocomplete = null;
      this.listenTo(this.state, 'change:city', this.onCityChange);
      this.listenTo(this.state, 'change:allbuildings', this.onBuildingsChange);
    },

    onCityChange: function(){
      this.listenTo(this.state.get('city'), 'sync', this.onCitySync);
    },

    onCitySync: function(){
      this.render();
    },

    render: function(){
      var self = this;

      var searchTemplate = _.template(AddressSearchTemplate);
      this.$container.html(searchTemplate());

      // clear marker
      $('#address-search').on('search', function (e) {
        if (!this.value) {
          self.clearMarker();
        }
      });

      return this;
    },

    events: {
      'search' : 'search',
    },

    onBuildingsChange: function() {
      var self = this;
      var buildings = this.state.get('allbuildings');
      var things = this.things = [];

      buildings.forEach(function(building, i){
        var address = building.get('reported_address');
        var property_name = building.get('property_name');
        var lat = building.get('lat');
        var lng = building.get('lng');

        if (address.length && property_name.length) {
          things.push({
            address: address,
            property_name: property_name,
            id: building.cid,
            latlng: L.latLng(lat, lng)
          });
        }

      }, this);

      var options = {
        caseSensitive: false,
        include: ["score", "matches"],
        location: 0,
        distance: 50,
        threshold: 0.1,
        maxPatternLength: 32,
        shouldSort: true,
        keys: ['address', 'property_name']
      };

      this.fuse = new Fuse(things, options);

      if (this.autocomplete) {
        this.autocomplete.destroy();
        this.autocomplete = null;
      }

      this.autocomplete = new autoComplete({
          selector: '#address-search',
          menuClass: 'address-search-results',
          minChars: 3,
          delay: 200,
          offsetTop: 10,
          cache: false,
          source: function(term, suggest, doExternalSearch){
            var wrapper = self.wrapper(term, suggest, new Date().getTime(), self);

            if (self.$autocompleteHeader) self.$autocompleteHeader.removeClass('show');

            if (doExternalSearch) {
              self.search(term, wrapper);
            } else {
              var val = term.toLowerCase();
              var results = self.fuse.search(val);
              var matches = results.map(function(d) {
                var match_key = d.matches[0].key;
                return [d.item.id, d.item[match_key]];
              });

              wrapper(term, matches);
            }

          },

          renderItem: function (item, search){
              search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              var re = new RegExp("(" + search.split(' ').join('|') + ")", "gi");
              return '<div class="autocomplete-suggestion" data-building="'+item[0]+'" data-val="' + item[1] + '">' + item[1].replace(re, "<b>$1</b>") + '</div>';
          },

          onSelect: function(e, term, item) {
            if (item) {
              var id = item.getAttribute('data-building');

              var building = buildings.get(id);
              var lat = building.get('lat');
              var lng = building.get('lng');
              self.centerMapOn([lat,lng]);
            }
          }
      });

      this.$autocompleteHeader = $('.autocomplete-suggestions-header');
      this.$autocompleteHeader.text('Nearby buildings...');
    },

    wrapper: function(term, suggest, started_at, self) {

      return function(from_term, items, err) {
        var now = new Date().getTime();
        if (from_term == term && self.maxReqTimestampRendered > started_at) return;
        self.maxReqTimestampRendered = started_at;

        if (err) {
          self.errorReporter(err);
        }

        suggest(items);

      }
    },

    maxReqTimestampRendered: new Date().getTime(),

    search: function(term, callback){
      if (!term) return callback(term, [], null);

      var self = this;
      var url = this.SEARCH_URL;
      var bounds = this.SEARCH_BOUNDS;
      var center = this.state.get('city').get('center');
      var api_key = this.SEARCH_API_KEY;

      try { this.xhr.abort(); } catch(e){}

      this.xhr = $.ajax({
        url: url,
        data: {
          api_key: api_key,
          text: term + " " + this.state.get('city').get('address_search_regional_context'),
          size: 10,
          'focus.point.lat': center[0],
          'focus.point.lon': center[1],
          'boundary.rect.min_lat': bounds[0],
          'boundary.rect.min_lon': bounds[1],
          'boundary.rect.max_lat': bounds[2],
          'boundary.rect.max_lon': bounds[3],
          layers: 'address',
        },

        error: function(xhr, status, err) {
          var errMsg = self.onAjaxAddressError(xhr);
          self.errorReporter(errMsg);
          callback(term, [], null);
        },

        success: function(data, status){
          var results = self.onAjaxAddressSuccess(data, term);
          if (!results.buildings.length) self.errorReporter(self.ERRORS.noimage);

          if (results.match) {
            self.centerMapOn(results.match);
            callback(term, [], null);
          } else {
            if (self.$autocompleteHeader) self.$autocompleteHeader.addClass('show');
            callback(term, results.buildings, null);
          }
        }
      })
    },

    getDistances: function(loc) {
      var limit = 402;
      var distances = [];

      this.things.forEach(function(thing) {
        var d = loc.distanceTo(thing.latlng);
        if (d < limit) distances.push({id: thing.id, d: d});
      });

      return distances;
    },

    onAjaxAddressError: function(err) {
      // If more specificity is desired, see:
      // https://mapzen.com/documentation/search/http-status-codes/
      return 'The search service is having problems :-(';
    },

    onAjaxAddressSuccess: function(data, term) {
      var self = this;
      var buildings = this.state.get('allbuildings');
      var features = (data.features || []).filter(
        function(feat) {
          return feat.properties.region && feat.properties.region === this.state.get('city').get('address_search_regional_context');
        }.bind(this));

      if (!features.length) return [];

      var closestBuildings = [];
      features.forEach(function(feature) {
        var distances = self.getDistances(L.latLng(feature.geometry.coordinates.reverse()));
        closestBuildings = closestBuildings.concat(distances);
      });

      closestBuildings = _.uniq(closestBuildings, false, function(item) { return item.id; })
      closestBuildings = _.sortBy(closestBuildings, 'd');

      closestBuildings = closestBuildings.slice(0,10);

      var match = null;

      closestBuildings = closestBuildings.map(function(item) {
        var building = buildings.get(item.id);

        var address = building.get('reported_address');
        var property_name = building.get('property_name');

        if (address === term) {
          var lat = building.get('lat');
          var lng = building.get('lng');
          match = [lat, lng];
        }

        if (address) return [item.id, address];

        return [item.id, property_name];
      });

      return {match: match, buildings: closestBuildings};
    },

    errorReporter: function(msg) {
      toastr.options = {
        "closeButton": true,
        "debug": false,
        "newestOnTop": false,
        "progressBar": false,
        "positionClass": "toast-top-right",
        "preventDuplicates": true,
        "onclick": null,
        "showDuration": "300",
        "hideDuration": "1000",
        "timeOut": "5000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "fadeOut"
      };

      toastr.error(msg);
    },

    centerMapOn: function(coordinates){
      this.placeMarker(coordinates);
      this.mapView.leafletMap.setView(coordinates);
    },

    placeMarker: function(coordinates){
      var map = this.mapView.leafletMap;
      this.clearMarker();

      var icon = new L.Icon({
          iconUrl: 'images/marker.svg',
          iconRetinaUrl: 'images/marker.svg',
          iconSize: [16, 28],
          iconAnchor: [8, 28],
          popupAnchor: [-3, -76],
          shadowUrl: '',
          shadowRetinaUrl: '',
          shadowSize: [0, 0],
          shadowAnchor: [22, 94]
      });
      this.marker = L.marker(coordinates, {icon: icon}).addTo(map);
    },

    clearMarker: function(){
      var map = this.mapView.leafletMap;
      if (this.marker){
        map.removeLayer(this.marker);
      }
    },

  });

  return AddressSearchACView;

});
