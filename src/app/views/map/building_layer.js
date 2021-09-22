define([
  'jquery',
  'underscore',
  'backbone',
  'collections/city_buildings',
  'models/building_color_bucket_calculator',
  'text!templates/map/building_info.html'
], function($, _, Backbone, CityBuildings,
            BuildingColorBucketCalculator, BuildingInfoTemplate){

  var baseCartoCSS = {
    dots: [
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
    ],
    footprints: [
      '{polygon-fill: #CCC;' +
      'polygon-opacity: 0.9;' +
      'line-width: 1;' +
      'line-color: #FFF;' +
      'line-opacity: 0.5;}'
    ]
  };

  var CartoStyleSheet = function(tableName, bucketCalculator, mode) {
    this.tableName = tableName;
    this.bucketCalculator = bucketCalculator;
    this.mode = mode;
  };

  CartoStyleSheet.prototype.toCartoCSS = function(){
    const bucketCSS = this.bucketCalculator.toCartoCSS();
    const tableName = this.tableName;

    let styles = [...baseCartoCSS[this.mode]].concat(bucketCSS);

    styles = _.reject(styles, function(s) { return !s; });
    styles = _.map(styles, function(s) { return `#${tableName} ${s}`; });

    return styles.join('\n');
  };

  var BuildingInfoPresenter = function(city, allBuildings, buildingId,
                                       idKey, controls, layerName, defaultColor){
    this.city = city;
    this.allBuildings = allBuildings;
    this.buildingId = buildingId;
    this.idKey = idKey;
    this.controls = controls;
    this.layerName = layerName;
    this.defaultColor = defaultColor || '#7b6127';
  };

  BuildingInfoPresenter.prototype.toLatLng = function() {
    var building = this.toBuilding();
    if (typeof building === 'undefined') return null;

    return {lat: building.get('lat'), lng: building.get('lng')};
  };

  BuildingInfoPresenter.prototype.toBuilding = function() {
    return this.allBuildings.find(building => {
      return building.get(this.idKey) == this.buildingId;
    }, this);
  };

  BuildingInfoPresenter.prototype.toPopulatedLabels = function()  {
    var building = this.toBuilding();
    var o = {};

    if (typeof building === 'undefined') return o;

    o.items = _.map(this.city.get('popup_fields'), function(field) {
      var value = building.get(field.field);

      value = (field.skipFormatter) ?
          (value || 'N/A') : (value || 'N/A').toLocaleString();

      var label = field.label;
      var template = null;

      if (field.template) {
        var key = '{' + field.field + '}';
        template = field.template.replace(key, value);
        label = null;
      }

      return {
        value: value,
        label: label,
        template: template,
        klass: field.field
      };
    }, this);

    // chart

    var chartData = this.city.get('popup_chart');

    if (!chartData) return o;

    o.chart = {};
    o.chart.year = this.city.get('year');

    o.chart.lead = {
      value: building.get(chartData.lead.field),
      color: this.getColor(chartData.lead.field, building.get(chartData.lead.field)),
      label: chartData.lead.label
    };

    if (!_.isNumber(o.chart.lead.value) || _.isNaN(o.chart.lead.value)) {
      o.chart.lead.nodata = chartData.lead.nodata;
    }


    o.chart.barchart = {
      value: building.get(chartData.barchart.field),
      color: this.getColor(chartData.barchart.field, building.get(chartData.barchart.field)),
      desc: chartData.barchart.desc,
      min: chartData.barchart.min,
      max: chartData.barchart.max
    };

    if (!_.isNumber(o.chart.barchart.value) || _.isNaN(o.chart.barchart.value)) {
      o.chart.barchart.nodata = chartData.barchart.nodata;
    }

    return o;
  };

  BuildingInfoPresenter.prototype.getColor = function(field, value) {
    if (!this.controls || !this.controls._wrapped) return this.defaultColor;

    // TODO: fix hacky way to deal w/ quartiles
    var filter = this.controls._wrapped.find(item => {
      if (item.viewType !== 'filter') return false;

      if (item.layer.id === 'site_eui_quartiles') {
        return false;
        // return field === 'site_eui' && this.layerName  === 'site_eui_quartiles';
      }

      return item.layer.field_name === field;
    });

    if (!filter) return this.defaultColor;

    return filter.getColorForValue(value);
  };

  /*
    Determines which map layer should be showing on the map
    Currently hardwired to show 'dots' or 'footprints'
   */
  var BuildingLayerWatcher = function(config, map) {
    this.config = config;
    this.map = map;
    this.currentZoom = null;
    this.footprintsAllowed = this.config.allowable || false;
    this.mode = this.getMode();
  };

  BuildingLayerWatcher.prototype.getMode = function() {
    if (!this.footprintsAllowed) return 'dots'; // `dots` are going to be our default

    var zoom = this.map.getZoom();
    if (this.currentZoom === zoom) return this.mode;
    this.currentZoom = zoom;

    return (zoom >= this.config.atZoom) ? 'footprints' : 'dots';
  };

  // Determines whether to change the layer type
  BuildingLayerWatcher.prototype.check = function() {
    if (!this.footprintsAllowed) return false;

    var mode = this.getMode();

    if (mode === this.mode) return false;

    this.mode = mode;

    return true;
  };

  BuildingLayerWatcher.prototype.fillType = function() {
    return this.mode === 'dots' ? 'marker-fill' : 'polygon-fill';
  };

  /*
    To render building footprints we need to join on the footprint table.
    There is no need to wrap it in the building collection sql function, since
    it only impacts the map layer. It does borrow most of the logic for sql
    generation from the building collection sql function however.
   */
  var FootprintGenerateSql = function(footprintConfig, maplayers) {
    this.footprintConfig = footprintConfig;
    this.mapLayerFields = maplayers.map(function(lyr) {
      return 'b.' + lyr.field_name;
    });
    this.mapLayerFields.push('b.dc_real_pid');

    this.mapLayerFields = _.uniq(this.mapLayerFields);
    this.mapLayerFields = this.mapLayerFields.join(',');
  };

  FootprintGenerateSql.prototype.sql = function(components) {
    var tableFootprint = this.footprintConfig.table_name;
    var tableData = components.table;

    // TODO - use this.mapLayerFields when there are needed fields in the table
    var cutMapLayerFields = this.mapLayerFields
      .replace('b.district_water_use,', '')

    // Base query
    var query = 'SELECT a.*,' +
        cutMapLayerFields +
        ' FROM ' + tableFootprint +
        ' a,' + tableData +
        ' b WHERE a.ssl = b.dc_real_pid AND ';

    var filterSql = components.year.concat(components.range)
        .concat(components.category)
        .filter(function(e) { return e.length > 0; });

    query += filterSql.join(' AND ');

    return query;
  };

  var LayerView = Backbone.View.extend({
    filterContainer: $("#map-controls"),

    initialize: function(options){
      this.state = options.state;
      this.leafletMap = options.leafletMap;
      this.mapView = options.mapView;
      this.mapElm = $(this.leafletMap._container);

      this.allBuildings = new CityBuildings(null, {});

      this.footprints_cfg = this.state.get('city').get('building_footprints');
      this.buildingLayerWatcher = new BuildingLayerWatcher(this.footprints_cfg, this.leafletMap);

      this.footprintGenerateSql = new FootprintGenerateSql(
          this.footprints_cfg,
          this.state.get('city').get('map_layers')
      );

      // Listen for all changes but filter in the handler for these
      // attributes: layer, filters, categories, and tableName
      this.listenTo(this.state, 'change', this.changeStateChecker);

      // building has a different handler
      this.listenTo(this.state, 'change:building', this.onBuildingChange);
      this.listenTo(this.allBuildings, 'sync', this.render);

      this.listenTo(this.state, 'clearMapPopup', this.onClearMapPopupTrigger, this);

      var self = this;
      this.leafletMap.on('popupclose', function(e) {
        // When the map is closing the popup the id's will match,
        // so close.  Otherwise were probably closing an old popup
        // to open a new one for a new building
        if (e.popup._buildingid === self.state.get('building')) {
          e.popup._buildingid = null;
          self._popupid = undefined;
          self.state.set({building: null});
        }
      });

      this.leafletMap.on('popupopen', function(e) {
        $('#view-report').on('click', self.onViewReportClick.bind(self));
        $('#compare-building').on('click', self.onCompareBuildingClick.bind(self));
      });
    },

    onClearMapPopupTrigger: function() {
      this.onClearPopups();
    },

    onClearPopups: function() {
      var map = this.leafletMap;

      map.eachLayer(function(lyr) {
        if (lyr._tip) {
          map.removeLayer(lyr);
        }
      });
    },

    isSelectedBuilding: function(selected_buildings, id) {
      var hasBuilding = selected_buildings.find(function(b) {
        return b.id === id;
      });

      return hasBuilding;
    },

    makeSelectedBuildingsState: function(id) {
      var selected_buildings = this.state.get('selected_buildings') || [];
      if (this.isSelectedBuilding(selected_buildings, id)) return null;
      if (selected_buildings.length === 5) return null;

      var out = selected_buildings.map(function(b) {
        b.selected = false;
        return b;
      });

      out.push({
        id: id,
        insertedAt: Date.now(),
        selected: true
      });

      out.sort(function(a, b) {
        return a.insertedAt - b.insertedAt;
      });

      return out;
    },

    onCompareBuildingClick: function(evt) {
      if (evt.preventDefault) evt.preventDefault();
      var buildingId = this.state.get('building');
      if (!buildingId) return;

      this.onClearPopups();
      this.state.set({ building_compare_active: true });
      this.filterContainer.removeClass('close');
      return false;
    },

    onViewReportClick: function(evt) {
      if (evt.preventDefault) evt.preventDefault();
      this.state.set({ report_active: true });
      return false;
    },

    onBuildingChange: function() {
      var building_id = this.state.get('building');
      var isShowing = (building_id === this._popupid);

      // if (!building) return;
      if (!this.allBuildings.length) return;
      if (!building_id || isShowing) return;
      // src/app/views/map/map.js SHOULD HAS getControls
      if (!this.mapView.getControls()) return;

      var propertyId = this.state.get('city').get('property_id');

      var template = _.template(BuildingInfoTemplate),
          presenter = new BuildingInfoPresenter(
              this.state.get('city'),
              this.allBuildings,
              building_id,
              propertyId,
              this.mapView.getControls(),
              this.state.get('layer')
          );

      if (!presenter.toLatLng()) return;

      var popup = L.popup()
       .setLatLng(presenter.toLatLng())
          .setContent(template({
            data: presenter.toPopulatedLabels(),
            compare_disabled: ''
          }));

      this._popupid = building_id;
      popup._buildingid = building_id;
      popup.openOn(this.leafletMap);

      var selected_buildings = this.makeSelectedBuildingsState(building_id);
      if (selected_buildings !== null && selected_buildings.length) {
        this.state.set({selected_buildings})
      }
    },

    onFeatureClick: function(event, latlng, _unused, data){
      var propertyId = this.state.get('city').get('property_id');
      var buildingId = data[propertyId];

      if (this.buildingLayerWatcher.mode !== 'dots') {
        /**
         * dc.json building_footprints section
         * sometimes (it's our case) property with real id for building has different names in consolidation data table
         * and building footprints table.
         * e.g.: in consolidation table name for column with this id is - dc_real_pid, but in footprint table - ssl
         * When both table has the same name for those columns  - everything works as expected. But not in our case,
         * that's why we have alt_name_property_id section.
         * It help our code to connect correctly id from footprints table and consolidation table with different
         * columns names.
         * fotprints column name (ssl) cannot be changed because it's a default from government for footprints
         */
        var propertyRealId = this.footprints_cfg.alt_name_property_id || this.footprints_cfg.property_id;
        var propertyRealIdValue = data[propertyRealId];
        // now try to find pid record (its also an id of our model)
        buildingId = this.state.get('allbuildings').find(item => item.get(propertyRealId) === propertyRealIdValue).get(propertyId);
      }

      var state = {
        building: buildingId
      };

      this.state.set(state);
    },

    onFeatureOver: function(){
      this.mapElm.css('cursor', 'help');
    },
    onFeatureOut: function(){
      this.mapElm.css('cursor', '');
    },

    onStateChange: function(){
      _.extend(this.allBuildings, this.state.pick('tableName', 'cartoDbUser'));
      this.allBuildings.fetch(this.state.get('year'));
    },

    changeStateChecker: function() {
      // filters change
      if (this.state._previousAttributes.filters !== this.state.attributes.filters) {
        return this.onStateChange();
      }
      // layer change
      if (this.state._previousAttributes.layer !== this.state.attributes.layer) {
        return this.onStateChange();
      }
      // catergory change
      if (this.state._previousAttributes.categories !== this.state.attributes.categories) {
        return this.onStateChange();
      }
      // tableName change
      if (this.state._previousAttributes.tableName !== this.state.attributes.tableName) {
        return this.onStateChange();
      }

      // mapzoom change we need to re-render the map
      // to show either 'dots' or 'footprints'
      if (this.state._previousAttributes.zoom !== this.state.attributes.zoom) {
        if (this.buildingLayerWatcher.check()) this.render();
      }
    },

    toCartoSublayer: function(){
      var layerMode = this.buildingLayerWatcher.mode;
      var cssFillType = this.buildingLayerWatcher.fillType();

      var buildings = this.allBuildings;
      var state = this.state;
      var city = state.get('city');
      var year = state.get('year');
      var layer = state.get('layer');

      var cityLayer = _.find(city.get('map_layers'), lyr => {
        if (lyr.id) return lyr.id === layer;
        return lyr.field_name === layer;
      });

      var fieldName = cityLayer.field_name;
      var buckets = cityLayer.range_slice_count;
      var colorStops = cityLayer.color_range;

      var thresholds = cityLayer.thresholds ? state.get('layer_thresholds') : null;

      var calculator = new BuildingColorBucketCalculator(
          buildings, fieldName, buckets,
          colorStops, cssFillType, thresholds);

      var stylesheet = new CartoStyleSheet(buildings.tableName, calculator, layerMode);

      var sql = (layerMode === 'dots') ?
          buildings.toSql(year, state.get('categories'), state.get('filters')) :
          this.footprintGenerateSql.sql(
              buildings.toSqlComponents(
                  year,
                  state.get('categories'),
                  state.get('filters'), 'b.')
          );

      var cartocss = stylesheet.toCartoCSS();
      var interactivity = this.state.get('city').get('property_id');
      var footprintInteractivityField = 'dc_real_pid';

      return {
        sql: sql,
        cartocss: cartocss,
        interactivity: (layerMode === 'dots' )
          ? interactivity
          : footprintInteractivityField += ',' + this.footprints_cfg.property_id
      };
    },

    render: function(){
      if (this.cartoLayer) {
        this.cartoLayer.getSubLayer(0).set(this.toCartoSublayer()).show();
        return this;
      }

      // skip if we are loading `cartoLayer`
      if (this.cartoLoading) return;

      this.cartoLoading = true;
      cartodb.createLayer(this.leafletMap, {
        user_name: this.allBuildings.cartoDbUser,
        type: 'cartodb',
        sublayers: [this.toCartoSublayer()]
      }, { https: true }).addTo(this.leafletMap).on('done', this.onCartoLoad, this);

      return this;

    },

    onCartoLoad: function(layer) {
      this.cartoLoading = false;
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
