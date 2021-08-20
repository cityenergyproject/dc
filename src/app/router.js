// Filename: router.js
//
define([
  'jquery',
  'deparam',
  'underscore',
  'backbone',
  'models/city',
  'collections/city_buildings',
  'views/layout/header',
  'views/layout/footer',
  'views/map/map',
  'views/map/address_search_autocomplete',
  'views/map/year_control',
  'views/building_comparison/building_comparison',
  'views/layout/activity_indicator',
  'views/layout/mobile-alert',
  'views/modals/modal-model',
  'views/modals/modal'
], function($, deparam, _, Backbone, CityModel,
            CityBuildings, HeaderView, FooterView, MapView,
            AddressSearchView, YearControlView,
            BuildingComparisonView, ActivityIndicator, MobileAlert, ModalModel, ModalController) {

  var RouterState = Backbone.Model.extend({
    queryFields: ['filters', 'categories', 'layer', 'metrics', 'sort', 'order', 'lat', 'lng', 'zoom', 'building'],
    defaults: {
      metrics: [],
      categories: {},
      filters: []
    },

    toQuery: function(){
      var attributes = this.pick(this.queryFields);
      return '?' + $.param(this.mapAttributesToParams(attributes));
    },

    mapAttributesToParams: function(attributes) {
      if (attributes.hasOwnProperty('report_active') && !attributes.report_active) {
        delete attributes.report_active;
      }

      if (attributes.hasOwnProperty('city_report_active') && !attributes.city_report_active) {
        delete attributes.city_report_active;
      }

      if (attributes.hasOwnProperty('building') && _.isNull(attributes.building)) {
        delete attributes.building;
      }

      return attributes;
    },

    mapParamsToState: function(params) {
      if (params.hasOwnProperty('report_active') && !_.isBoolean(params.report_active)) {
        params.report_active = (params.report_active === 'true');
      }

      if (params.hasOwnProperty('city_report_active') && !_.isBoolean(params.city_report_active)) {
        params.city_report_active = (params.city_report_active === 'true');
      }

      return params;
    },

    toUrl: function(){
      var path;
      if (this.get('year')) {
        path = "/" + this.get('url_name') + "/" + this.get('year') + this.toQuery();
      } else {
        path = "/" + this.get('url_name') + this.toQuery();
      }
      return path;
    },

    asBuildings: function() {
      return new CityBuildings(null, this.pick('tableName', 'cartoDbUser'));
    }
  });

  var StateBuilder = function(city, year, layer, categories) {
    this.city = city;
    this.year = year;
    this.layer = layer;
    this.categories = categories;
    this.layer_thresholds = null;
  };

  StateBuilder.prototype.toYear = function() {
    var currentYear = this.year;
    var availableYears = _.chain(this.city.years).keys().sort();
    var defaultYear = availableYears.last().value();
    return availableYears.contains(currentYear).value() ? currentYear : defaultYear;
  };

  StateBuilder.prototype.toLayer = function(year) {
    const currentLayer = this.layer;
    const defaultLayer = this.city.years[year].default_layer;

    const match = _.find(this.city.map_layers, lyr => {
      const name = lyr.id || lyr.field_name;
      return name === currentLayer;
    });

    return match !== undefined ? currentLayer : defaultLayer;
  };

  StateBuilder.prototype.toCategory = function() {
    if (!this.categories || !this.categories.length) return this.city.categoryDefaults || [];
    this.categories.forEach(c => {
      if (c.field === 'property_type') {
        const val = c.values[0];
        const thresholds = this.city.scorecard.thresholds.eui;
        if (!thresholds.hasOwnProperty(val)) {
          c.kill = true;
        }

        this.layer_thresholds = thresholds[val][this.year];
      }
    });

    return this.categories.filter(d => !d.kill);
  };

  StateBuilder.prototype.toState = function() {
    var year = this.toYear();
    var layer = this.toLayer(year);
    var categories = this.toCategory();

    return {
      year: year,
      cartoDbUser: this.city.cartoDbUser,
      tableName: this.city.years[year].table_name,
      layer: layer,
      sort: layer,
      order: 'desc',
      categories: categories,
      layer_thresholds: this.layer_thresholds
    }
  };

  var Router = Backbone.Router.extend({
    state: new RouterState({}),
    routes:{
        "": "root",
        ":cityname": "city",
        ":cityname/": "city",
        ":cityname/:year": "year",
        ":cityname/:year/": "year",
        ":cityname/:year?:params": "year",
        ":cityname/:year/?:params": "year",
    },

    initialize: function(){
      var activityIndicator = new ActivityIndicator({state: this.state});
      var headerView = new HeaderView({state: this.state});
      var yearControlView = new YearControlView({state: this.state});
      var mapView = new MapView({state: this.state});
      var addressSearchView = new AddressSearchView({mapView: mapView, state: this.state});
      var comparisonView = new BuildingComparisonView({state: this.state});
      var footerView = new FooterView({state: this.state});
      var mobileAlert = new MobileAlert({state: this.state});

      // $(window).on('resize.main', _.debounce(_.bind(this.onWindowResize, this), 200));
      // this.onWindowResize();

      this.state.on('change', this.onChange, this);
    },

    onWindowResize: function(evt) {
      var width = this.state.get('width');

      if (width !== window.innerWidth) {
        this.state.set({width: window.innerWidth});
      }
    },

    onChange: function(){
      // console.log(Date.now(), 'VOLOS: router.js onChange ==>', );
      var changed = _.keys(this.state.changed);

      if (_.contains(changed, 'url_name')){
        this.onCityChange();
      } else if (_.contains(changed, 'year')) {
        this.onYearChange();
      }

      this.navigate(this.state.toUrl(), {trigger: false, replace: true});
    },

    onCityChange: function(){
      // console.log(Date.now(), 'VOLOS: router.js onCityChange ==>', );
      this.state.trigger("showActivityLoader");
      var city = new CityModel(this.state.pick('url_name', 'year'));
      city.fetch({success: _.bind(this.onCitySync, this)});

    },

    onYearChange: function() {
      // var year = this.state.get('year');
      var previous = this.state.previous('year');

      // skip undefined since it's most likely the
      // user came to the site w/o a hash state
      if (typeof previous === 'undefined') return;

      this.onCityChange();
    },

    onCitySync: function(city, results) {
      // console.log(Date.now(), 'VOLOS: router.js onCitySync ==>', );
      var year = this.state.get('year');
      var layer = this.state.get('layer');
      var categories = this.state.get('categories');

      var newState = new StateBuilder(results, year, layer, categories).toState();

      var map_options = city.get('map_options');
      var defaultMapState = {
        lat: map_options.center[0],
        lng: map_options.center[1],
        zoom: map_options.zoom
      };
      var mapState = this.state.pick('lat', 'lng', 'zoom');

      // Configure modals
      if (results.hasOwnProperty('modals')) {
        var modalModel = new ModalModel({
          available: _.extend({}, results.modals)
        });

        var modalController = new ModalController({state: this.state});

        newState = _.extend(newState, {
          modal: modalModel,
          setModal: _.bind(modalController.setModal, modalController)
        });
      }

      _.defaults(mapState, defaultMapState);

      // set this to silent because we need to load buildings
      this.state.set(_.extend({city: city}, newState, mapState));

      var thisYear = this.state.get('year');
      if (!thisYear) console.error('Uh no, there is no year available!');

      this.fetchBuildings(thisYear);
    },

    fetchBuildings: function(year) {
      // console.log(Date.now(), 'VOLOS: router.js fetchBuildings ==>', );
      this.allBuildings = this.state.asBuildings();
      this.listenToOnce(this.allBuildings, 'sync', this.onBuildingsSync, this);

      this.allBuildings.fetch(year);
    },

    onBuildingsSync: function() {
      // console.log(Date.now(), 'VOLOS: router.js onBuildingsSync ==>', );
      this.state.set({allbuildings: this.allBuildings});
      this.state.trigger("hideActivityLoader");
    },

    root: function () {
      this.navigate('/dc', {trigger: true, replace: true});
    },

    city: function(cityname){
      // console.log(Date.now(), 'VOLOS: router.js city ==>', {cityname});
      this.state.set({url_name: cityname});
    },

    year: function(cityname, year, params){
      params = params ? deparam(params) : {};
      this.state.set(_.extend({}, this.state.mapParamsToState(params), { url_name: cityname, year }));

    }
  });

  return Router;
});
