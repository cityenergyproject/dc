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
], function($, deparam, _, Backbone, CityModel, CityBuildings, HeaderView, FooterView, MapView, AddressSearchView, YearControlView, BuildingComparisonView, ActivityIndicator) {
  var RouterState = Backbone.Model.extend({
    queryFields: ['filters', 'categories', 'layer', 'metrics', 'sort', 'order', 'lat', 'lng', 'zoom', 'building'],
    defaults: {
      metrics: [],
      categories: {},
      filters: []
    },
    toQuery: function(){
      var query, attributes = this.pick(this.queryFields);
      query = $.param(attributes);
      return '?' + query;
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

  var StateBuilder = function(city, year, layer) {
    this.city = city;
    this.year = year;
    this.layer = layer;
  };

  StateBuilder.prototype.toYear = function() {
    var currentYear = this.year;
    var availableYears = _.chain(this.city.years).keys().sort();
    var defaultYear = availableYears.last().value();
    return availableYears.contains(currentYear).value() ? currentYear : defaultYear;
  };

  StateBuilder.prototype.toLayer = function(year) {
    var currentLayer = this.layer;
    var availableLayers = _.chain(this.city.map_layers).pluck('field_name');
    var defaultLayer = this.city.years[year].default_layer;
    return availableLayers.contains(currentLayer).value() ? currentLayer : defaultLayer;
  };

  StateBuilder.prototype.toState = function() {
    var year = this.toYear(),
        layer = this.toLayer(year);
    return {
      year: year,
      cartoDbUser: this.city.cartoDbUser,
      tableName: this.city.years[year].table_name,
      layer: layer,
      sort: layer,
      order: 'desc',
      categories: this.city.categoryDefaults || [],
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

      this.state.on('change', this.onChange, this);
    },
    onChange: function(){
      var changed = _.keys(this.state.changed);

      if (_.contains(changed, 'url_name')){
        this.onCityChange();
      } else if (_.contains(changed, 'year')) {
        this.onYearChange();
      }

      this.navigate(this.state.toUrl(), {trigger: false, replace: true});
    },

    onCityChange: function(){
      this.state.trigger("showActivityLoader");
      var city = new CityModel(this.state.pick('url_name', 'year'));
      city.fetch({success: _.bind(this.onCitySync, this)});

    },

    onYearChange: function() {
      var year = this.state.get('year');
      var previous = this.state.previous('year');

      // skip undefined since it's most likely the
      // user came to the site w/o a hash state
      if (typeof previous === 'undefined') return;

      this.onCityChange();
    },

    onCitySync: function(city, results) {
      var year = this.state.get('year'),
          layer = this.state.get('layer'),
          newState = new StateBuilder(results, year, layer).toState(),
          defaultMapState = {lat: city.get('center')[0], lng: city.get('center')[1], zoom: city.get('zoom')},
          mapState = this.state.pick('lat', 'lng', 'zoom');

      _.defaults(mapState, defaultMapState);

      // set this to silent because we need to load buildings
      this.state.set(_.extend({city: city}, newState, mapState));

      this.fetchBuildings();
    },

    fetchBuildings: function() {
      this.allBuildings = this.state.asBuildings();
      this.listenToOnce(this.allBuildings, 'sync', this.onBuildingsSync, this);

      this.allBuildings.fetch();
    },

    onBuildingsSync: function() {
      this.state.set({allbuildings: this.allBuildings});
      this.state.trigger("hideActivityLoader");
    },

    root: function () {
      this.navigate('/dc', {trigger: true, replace: true});
    },

    city: function(cityname){
      this.state.set({url_name: cityname});
    },

    year: function(cityname, year, params){
      params = params ? deparam(params) : {};
      this.state.set(_.extend({}, params, {url_name: cityname, year: year}));
    }
  });

  return Router;
});
