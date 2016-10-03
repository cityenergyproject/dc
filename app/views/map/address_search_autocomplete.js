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

    initialize: function(options){
      console.log('With autocomplete');
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
      var searchTemplate = _.template(AddressSearchTemplate);
      this.$container.html(searchTemplate());

      // this.$el = this.$container.find("input");
      // this.delegateEvents(this.events);
      return this;
    },

    events: {
      'search' : 'search',
    },

    onBuildingsChange: function() {
      var self = this;
      var buildings = this.state.get('allbuildings');
      var things = [];

      buildings.forEach(function(building, i){
        var address = building.get('reported_address');
        var property_name = building.get('property_name');

        if (address.length && property_name.length) {
          things.push({
            address: address,
            property_name: property_name,
            id: building.cid
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
          delay: 250,
          source: function(term, suggest){
              var val = term.toLowerCase();
              var results = self.fuse.search(val);
              var matches = results.map(function(d) {
                  var match_key = d.matches[0].key;
                  return [d.item.id, d.item[match_key]];
              });

              suggest(matches);

              //self.search(term, suggest);
          },
          renderItem: function (item, search){
              search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              var re = new RegExp("(" + search.split(' ').join('|') + ")", "gi");
              return '<div class="autocomplete-suggestion" data-building="'+item[0]+'" data-val="' + item[1] + '">' + item[1].replace(re, "<b>$1</b>") + '</div>';
          },
          onSelect: function(e, term, item) {
            var id = item.getAttribute('data-building');

            var building = buildings.get(id);
            var lat = building.get('lat');
            var lng = building.get('lng');

            self.placeMarker([lat,lng]);
            self.mapView.leafletMap.setView([lat,lng]);
          }
      });
    },

    search: function(term, callback){
      if (!term) return callback([]);

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
          text: search + " " + this.state.get('city').get('address_search_regional_context'),
          size: 10,
          'focus.point.lat': center[0],
          'focus.point.lon': center[1],
          'boundary.rect.min_lat': bounds[0],
          'boundary.rect.min_lon': bounds[1],
          'boundary.rect.max_lat': bounds[2],
          'boundary.rect.max_lon': bounds[3],
          'locality': 'venue,address',
        },

        error: function(xhr, status, err) {
          console.log(status, err);
          self.onAjaxResponse(err, null, callback);
        },

        success: function(data, status){
          console.log(status, data);
          self.onAjaxResponse(null, data, callback);
          // self.centerMapOn(response);
        }
      })
    },

    onAjaxResponse: function(err, data, callback) {
      callback(['000', 'test']);
    },

    centerMapOn: function(location){
      var hits = location.features.filter(function(feat) {
        return feat.properties.region && feat.properties.region === this.state.get('city').get('address_search_regional_context');
      }.bind(this));

      if (hits.length > 0 ){
        var coordinates = hits[0].geometry.coordinates.reverse();
        this.placeMarker(coordinates);
        this.mapView.leafletMap.setView(coordinates);
      }
      else{
        toastr.options = {
          "closeButton": true,
          "debug": false,
          "newestOnTop": false,
          "progressBar": false,
          "positionClass": "toast-top-right",
          "preventDuplicates": false,
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

        toastr.error("Addresses not found!");
      }
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
