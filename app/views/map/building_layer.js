define([
  'jquery',
  'underscore',
  'backbone',
  'collections/city_buildings',
  'models/building_color_bucket_calculator',
  'text!templates/map/building_info.html'
], function($, _, Backbone, CityBuildings, BuildingColorBucketCalculator, BuildingInfoTemplate){

  var baseCartoCSS = [
    '{marker-fill: #CCC;' +
    'marker-fill-opacity: 0.9;' +
    'marker-line-color: #FFF;' +
    'marker-line-width: 0.5;' +
    'marker-line-opacity: 1;' +
    'marker-placement: point;' +
    'marker-multi-policy: largest;' +
    'marker-type: ellipse;' +
    'marker-allow-overlap: true;' +
    'marker-clip: false;}'
  ];

  var CartoStyleSheet = function(tableName, bucketCalculator) {
    this.tableName = tableName;
    this.bucketCalculator = bucketCalculator;
  };

  CartoStyleSheet.prototype.toCartoCSS = function(){
    var bucketCSS = this.bucketCalculator.toCartoCSS(),
        styles = baseCartoCSS.concat(bucketCSS),
        tableName = this.tableName;
    styles = _.reject(styles, function(s) { return !s; });
    styles = _.map(styles, function(s) { return "#" + tableName + " " + s; });
    return styles.join("\n");
  };

  var BuildingInfoPresenter = function(city, allBuildings, buildingId){
    this.city = city;
    this.allBuildings = allBuildings;
    this.buildingId = buildingId;
  };

  BuildingInfoPresenter.prototype.toLatLng = function() {
    var building = this.toBuilding();
    if (typeof building === 'undefined') return null;

    return {lat: building.get('lat'), lng: building.get('lng')};
  };

  BuildingInfoPresenter.prototype.toBuilding = function() {
    return this.allBuildings.find(function(building) {
      return building.get(this.city.get('property_id')) == this.buildingId;
    }, this);
  };

  BuildingInfoPresenter.prototype.toPopulatedLabels = function()  {
    var default_hidden = false;
    return _.map(this.city.get('popup_fields'), function(field) {
      if (field.start_hidden) default_hidden = true;
      var building = this.toBuilding();
      var value = (typeof building === 'undefined') ? null : building.get(field.field);
      return _.extend({
        value: (value || 'N/A').toLocaleString(),
        default_hidden: default_hidden
      }, field);
    }, this);
  };

  var LayerView = Backbone.View.extend({
    initialize: function(options){
      this.state = options.state;
      this.leafletMap = options.leafletMap;

      this.allBuildings = new CityBuildings(null, {});

      this.listenTo(this.state, 'change:layer', this.onStateChange);
      this.listenTo(this.state, 'change:filters', this.onStateChange);
      this.listenTo(this.state, 'change:categories', this.onStateChange);
      this.listenTo(this.state, 'change:tableName', this.onStateChange);
      this.listenTo(this.state, 'change:building', this.onBuildingChange);
      this.listenTo(this.state, 'clear_map_popups', this.onClearPopups);
      this.listenTo(this.allBuildings, 'sync', this.render);
      this.onStateChange();

      var self = this;
      this.leafletMap.on('popupclose', function(e) {
        self.state.set({building: null});
      });
      // register single handler for showing more attrs in popup
      $('body').on('click', '.show-hide-attrs', function (e) {
        e.preventDefault();
        e.stopPropagation();

        var is_show = $(this).text().indexOf('more') > -1 ? true: false;
        if(is_show){
          $(this).text('less details...');
          $('.show-more-container').removeClass('hide').addClass('show');
        }
        else {
          $(this).text('more details...');
          $('.show-more-container').removeClass('show').addClass('hide');
        }

        self.leafletMap.eachLayer(function(layer){
            if (layer._tip) {
              self.adjustPopup(layer);
            }
        });
      });
    },

    // Keep popup in map view after showing more details
    adjustPopup: function(layer) {
      var container = $(layer._container);
      var latlng = layer.getLatLng();
      var mapSize = this.leafletMap.getSize();

      var pt = this.leafletMap.latLngToContainerPoint(latlng);
      var height = container.height();
      var top = pt.y - height;

      if (top < 0) {
        this.leafletMap.panBy([0, top]);
      }
    },

    onClearPopups: function() {
      var map = this.leafletMap;

      map.eachLayer(function(lyr) {
        if (lyr._tip) {
          map.removeLayer(lyr);
        }
      });
    },


    onBuildingChange: function() {
      if (!this.state.get('building')) return;

      var template = _.template(BuildingInfoTemplate),
          presenter = new BuildingInfoPresenter(this.state.get('city'), this.allBuildings, this.state.get('building'));

      L.popup()
       .setLatLng(presenter.toLatLng())
       .setContent(template({labels: presenter.toPopulatedLabels()}))
       .openOn(this.leafletMap);

      setTimeout(function(){
        this.state.trigger('building_layer_popup_shown');
      }.bind(this),1);
    },

    onFeatureClick: function(event, latlng, _unused, data){
      var propertyId = this.state.get('city').get('property_id'),
          buildingId = data[propertyId];

      var current = this.state.get('building');

      // Need to unset building if current is same
      // as buildingId or the popup will not appear
      if (current === buildingId) {
        this.state.unset('building', {silent: true});
      }

      this.state.set({building: buildingId});
    },

    onFeatureOver: function(){
      $('#map').css('cursor', "help");
    },
    onFeatureOut: function(){
      $('#map').css('cursor', '');
    },

    onStateChange: function(){
      _.extend(this.allBuildings, this.state.pick('tableName', 'cartoDbUser'));
      this.allBuildings.fetch();
    },

    toCartoSublayer: function(){
      var buildings = this.allBuildings,
          state = this.state,
          city = state.get('city'),
          fieldName = state.get('layer'),
          cityLayer = _.findWhere(city.get('map_layers'), {field_name: fieldName}),
          buckets = cityLayer.range_slice_count,
          colorStops = cityLayer.color_range,
          calculator = new BuildingColorBucketCalculator(buildings, fieldName, buckets, colorStops),
          stylesheet = new CartoStyleSheet(buildings.tableName, calculator);

      return {
        sql: buildings.toSql(state.get('categories'), state.get('filters')),
        cartocss: stylesheet.toCartoCSS(),
        interactivity: this.state.get('city').get('property_id')
      };
    },

    render: function(){
      if(this.cartoLayer) {
        this.cartoLayer.getSubLayer(0).set(this.toCartoSublayer()).show();
        return this;
      }
      cartodb.createLayer(this.leafletMap, {
        user_name: this.allBuildings.cartoDbUser,
        type: 'cartodb',
        sublayers: [this.toCartoSublayer()]
      },{https: true}).addTo(this.leafletMap).on('done', this.onCartoLoad, this);

      return this;
    },
    onCartoLoad: function(layer) {
      var sub = layer.getSubLayer(0);
      this.cartoLayer = layer;
      sub.setInteraction(true);
      sub.on('featureClick', this.onFeatureClick, this);
      sub.on('featureOver', this.onFeatureOver, this);
      sub.on('featureOut', this.onFeatureOut, this);
      this.onBuildingChange();
    }
  });

  return LayerView;

});
