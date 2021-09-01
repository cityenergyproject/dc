define([
  'jquery',
  'underscore',
  'backbone',
  'views/map/building_layer',
  'views/map/filter',
  'views/map/category',
  'utils/threshold',
  'selectize',
  'text!templates/map_controls/property_type_selectlist.html'
], function($, _, Backbone, BuildingLayer, Filter, Category, ThresholdUtils, selectize, ProptypeSelectListTemplate) {
  var MapView = Backbone.View.extend({
    el: $("#map"),

    initialize: function(options){
      this.state = options.state;
      this.listenTo(this.state, 'change:city', this.onCityChange);
      this.listenTo(this.state, 'change:allbuildings', this.onBuildings, this);
      this.listenTo(this.state, 'change:lat', this.onMapChange);
      this.listenTo(this.state, 'change:lng', this.onMapChange);
      this.listenTo(this.state, 'change:zoom', this.onMapChange);

      this.listenTo(this.state, 'change:reset_all', this.onResetAll);

      this.filterContainer = $('#map-controls');
      this.filtersPanelClosed = this.filterContainer.hasClass('close');

      // Hack in some events
      var me = this;

      // For small screens
      $('#map-controls--toggle').on('click', function(e) {
        if (e.preventDefault) e.preventDefault();

        me.filtersPanelClosed = !me.filterContainer.hasClass('close');
        me.filterContainer.toggleClass('close', me.filtersPanelClosed);
        return false;
      });

      // reset all
      // TODO: fix slowness when resetting
      $('.reset-all-filters').on('click', function(e) {
        var city = me.state.get('city').toJSON();
        var year = me.state.get('year');

        var cat_defaults = city.categoryDefaults || [];
        var default_layer = city.years[year].default_layer

        if (e.preventDefault) e.preventDefault();
        me.state.set({
          'categories': cat_defaults,
          'filters': [],
          'metrics': [default_layer],
          'layer': default_layer,
          sort: default_layer,
          'reset_all': true
        });
        return false;
      });
    },

    onResetAll: function() {
      var val = this.state.get('reset_all');

      if (val) {
        this.state.set('reset_all', false, {silent: true});
        this.onBuildings();
      }
    },

    onCityChange: function(){
      this.render();
    },

    getCurrentCatValue: function() {
      const currentCategories = this.state.get('categories');
      const match = currentCategories.find(cat => {
        return cat.field === 'primary_ptype_self';
      });

      return match ? match.values[0] : null;
    },

    createPropTypeSelector: function(buildings) {
      const items = _.uniq(buildings.pluck('primary_ptype_self')).sort();

      var template = _.template(ProptypeSelectListTemplate);

      $('#building-proptype-selector').html(template({ items, current: this.getCurrentCatValue() }));

      $('#building-proptype-selector > select').selectize({
        onChange: val => {
          if (val === '*') val = null;

          const currentCategories = this.state.get('categories');
          const match = currentCategories.find(cat => {
            return cat.field === 'primary_ptype_self';
          });

          const currentValue = match ? match.values[0] : null;

          if (val === currentValue) return;

          const newCats = currentCategories.filter(cat => cat.field !== 'primary_ptype_self');

          if (val !== null) {
            newCats.push({
              field: 'primary_ptype_self',
              other: false,
              values: [val]
            });
          }

          this.state.set({
            categories: newCats,
            layer_thresholds: this.getThreshold(val)
          });
        }
      });
    },

    getThreshold: function(propType) {
      // TODO: This will fail loudly
      const availableThresholds = this.state.get('city').get('scorecard').thresholds.eui;
      const year = this.state.get('year');
      const threshold = ThresholdUtils.getThresholds(availableThresholds, propType, year);

      if (threshold.error) {
        console.warn(threshold.error);
        return null;
      }

      return threshold.data;
    },

    render: function(){
      var city = this.state.get('city'),
          lat = this.state.get('lat'),
          lng = this.state.get('lng'),
          zoom = this.state.get('zoom');

      if (!this.leafletMap){
        // TODO: allow for map options to come from city config
        var map_options = this.state.get('city').get('map_options');

        this.leafletMap = new L.Map(this.el, _.defaults({center: [lat, lng], zoom: zoom}, map_options));
        this.leafletMap.attributionControl.setPrefix("");

        var background = city.get('backgroundTileSource'),
            labels = city.get('labelTileSource');

        if (window.devicePixelRatio > 1) {
          // replace the last "." with "@2x."
          background = background.replace(/\.(?!.*\.)/, "@2x.");
          labels = labels.replace(/\.(?!.*\.)/, "@2x.");
        }

        L.tileLayer(background, {
          zIndex: 0
        }).addTo(this.leafletMap);

        L.tileLayer(labels, {
          zIndex: 2
        }).addTo(this.leafletMap);

        this.leafletMap.zoomControl.setPosition('topright');
        this.leafletMap.on('moveend', this.onMapMove, this);

        // TODO: Possibly remove the need for this
        // layer to make seperate Carto calls
        this.currentLayerView = new BuildingLayer({
          leafletMap: this.leafletMap,
          state: this.state,
          mapView: this
        });
      }
    },

    onMapMove: function(event) {
      var target = event.target,
          zoom = target.getZoom(),
          center = target.getCenter();
      this.state.set({lat: center.lat, lng: center.lng, zoom: zoom});
    },

    onMapChange: function() {
      var lat = this.state.get('lat'),
          lng = this.state.get('lng'),
          zoom = this.state.get('zoom');
      if (!this.leafletMap){ return; }
      this.leafletMap.panTo(new L.LatLng(lat, lng));
      this.leafletMap.setZoom(zoom);
    },

    getControls: function() {
      return this.controls;
    },

    onBuildings: function(){
      var state = this.state;
      var city = state.get('city');
      var layers = city.get('map_layers');
      var allBuildings = state.get('allbuildings');

      this.createPropTypeSelector(allBuildings);

      // close/remove any existing MapControlView(s)
      this.controls && this.controls.each(function(view){
        view.close();
      });

      $('#map-category-controls').empty();
      $('#map-controls-content').empty();

      // close/remove any existing MapControlView(s)
      this.controls && this.controls.each(function(view){
        view.close();
      });

      // recreate MapControlView(s)
      this.controls = _.chain(layers).map(function(layer){
        var viewClass = {
          range: Filter,
          category: Category
        }[layer.display_type];

        return new viewClass({layer: layer, allBuildings: allBuildings, state: state});
      }).each(function(view){ view.render(); });

      if (this.currentLayerView) this.currentLayerView.onBuildingChange();
      return this;
    }
  });

  return MapView;

});
