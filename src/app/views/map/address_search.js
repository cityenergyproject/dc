define([
  'jquery',
  'underscore',
  'backbone',
  'toastr',
  'text!templates/map/address_search.html'
], function($, _, Backbone, toastr, AddressSearchTemplate){

  var AddressSearchView = Backbone.View.extend({
    $container: $('#search'),

    initialize: function(options){
      this.mapView = options.mapView;
      this.state = options.state;
      this.listenTo(this.state, 'change:city', this.onCityChange);
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
      this.$el = this.$container.find("input");
      this.delegateEvents(this.events);
      return this;
    },

    events: {
      'search' : 'search',
    },

    search: function(){
      var self = this;
      var url = "https://search.mapzen.com/v1/search";
      var search = this.$el.val();
      var center = this.state.get('city').get('center');
      if (search === ""){
        this.clearMarker();
        return;
      }
      $.ajax({
        url: url,
        data: {
          api_key: 'search-oqsffOQ',
          text: search + " " + this.state.get('city').get('address_search_regional_context'),
          size: 10,
          'focus.point.lat': center[0],
          'focus.point.lon': center[1],
          'boundary.rect.min_lat': 38.79163,
          'boundary.rect.min_lon': -77.119766,
          'boundary.rect.max_lat': 38.995853,
          'boundary.rect.max_lon': -76.909363,
          'locality': 'venue,address',
        },

        success: function(response){
          console.log(response);
          self.centerMapOn(response);
        }
      });
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

  return AddressSearchView;

});
