define([
  'jquery',
  'underscore',
  'backbone',
  'models/building_comparator',
  'models/building_color_bucket_calculator',
  'models/building_bucket_calculator',
  'views/charts/histogram',
  'text!templates/building_comparison/table_head.html',
  'text!templates/building_comparison/table_body.html'
], function($, _, Backbone, BuildingComparator, BuildingColorBucketCalculator, BuildingBucketCalculator, HistogramView, TableHeadTemplate,TableBodyRowsTemplate){

  var ReportTranslator = function(buildingId, buildingFields, buildings, gradientCalculators, mapLayers) {
    this.buildingId = buildingId;
    this.buildingFields = buildingFields;
    this.buildings = buildings;
    this.lookup = {};
    this.gradientCalculators = gradientCalculators;
    this.mapLayers = mapLayers;

    this.init();
  };

  ReportTranslator.prototype.init = function() {
    this.buildings.forEach(function(building, i){
      this.lookup[building.get(this.buildingId)] = {
        id: building.get(this.buildingId),
        fields: _.values(building.pick(this.buildingFields)),
        metrics: []
      };
    }, this);
  };

  ReportTranslator.prototype.updateMetrics = function(buildings, metricFields) {
    var metrichash = metricFields.toString();

    buildings.forEach(function(building, i){
      var id = building.get(this.buildingId);
      var currentMetricHash = this.lookup[id].metrichash;

      if (currentMetricHash === metrichash) return;

      var metrics = _.map(metricFields, function(field) {
        var metricConfig = _.findWhere(this.mapLayers, {field_name: field});

        var valueType = metricConfig.valueType || '';
        var skipFormatting = metricConfig.skipFormatting || false;

        var value = building.get(field);
        var color = this.gradientCalculators[field].toColor(value);

        if (valueType === 'number') {
          if (!isNaN(value)) {
            value = +value;
          } else {
            value = '';
          }
        } else {
          value = value || '';
        }

        value = (skipFormatting) ? value : value.toLocaleString();

        return {
          value: value,
          color: color,
          undefined: (value ? 'defined' : 'undefined')
        };
      }, this);

      this.lookup[id].metrics = metrics;
      this.lookup[id].metrichash = metrichash;
    }, this);
  };

  ReportTranslator.prototype.toRows = function(buildings) {
    return _.map(buildings, function(building){
      return this.lookup[building.get(this.buildingId)];
    }, this);
  };


  var MetricAverageCalculator = function(buildings, fields, gradientCalculators){
    this.buildings = buildings;
    this.fields = fields;
    this.gradientCalculators = gradientCalculators;
  };

  MetricAverageCalculator.prototype.calculateField = function(field){
    var fieldName = field.field_name,
        values = _.map(this.buildings, function(building){return building.get(fieldName);}),
        median = Math.round(d3.median(values) * 10) / 10,
        gradientCalculator = this.gradientCalculators[fieldName];

    return _.extend({}, field, {
      median: field.skipFormatting ? median : median.toLocaleString(),
      color: gradientCalculator.toColor(median)
    });
  };

  MetricAverageCalculator.prototype.calculate = function(){
    return _.map(this.fields, _.bind(this.calculateField, this));
  };


  var BuildingMetricCalculator = function(currentBuilding, buildings, metricFields, gradientCalculators) {
    this.currentBuilding = currentBuilding;
    this.buildings = buildings;
    this.metricFields = metricFields;
    this.gradientCalculators = gradientCalculators;
  };

  BuildingMetricCalculator.prototype.renderField = function(field) {
    if (!field) return undefined;

    var fieldName = field.field_name,
        gradients = this.gradientCalculators[fieldName],
        slices = field.range_slice_count,
        aspectRatio = 4/1;
        gradientStops = gradients.toGradientStops(),
        filterRange = field.filter_range,
        bucketCalculator = new BuildingBucketCalculator(this.buildings, fieldName, slices, filterRange),
        value = this.currentBuilding.get(fieldName),
        currentColor = gradients.toColor(value),
        buckets = bucketCalculator.toBuckets(),
        bucketGradients = _.map(gradientStops, function(stop, bucketIndex){
          return {
            current: _.indexOf(gradientStops, currentColor),
            color: stop,
            count: buckets[bucketIndex] || 0
          };
        }),
        histogram = new HistogramView({gradients: bucketGradients, slices: slices, aspectRatio: aspectRatio});
    return histogram;
  };

  BuildingMetricCalculator.prototype.render = function(rowContainer) {
    rowContainer.find('td.metric').each(_.bind(function(index, cell) {
      var field = this.metricFields[index],
          histogram = this.renderField(field);

        if (!histogram) return;
      $(cell).find('.histogram').replaceWith(histogram.render());
    }, this));
  };

  var MetricsValidator = function(cityFields, metrics, newField) {
    this.cityFields = cityFields;
    this.metrics = metrics;
    this.newField = newField;
  };

  MetricsValidator.prototype.toValidFields = function(){
    var allValidFields = _.intersection(this.metrics.concat([this.newField]), this.cityFields),
        lastValidField = _.last(allValidFields);
    if (allValidFields.length > 5) {
      allValidFields = _.first(allValidFields,4).concat([lastValidField]);
    }
    return allValidFields;
  };

  var BuildingComparisonView = Backbone.View.extend({
    el: "#buildings",
    metrics: [],
    sortedBy: {},

    initialize: function(options){
      this.previousState = {};

      this.state = options.state;
      this.$el.html('<div class="building-report-header-container"><table class="building-report"><thead></thead></table></div><table class="building-report"><tbody></tbody></table>');

      var onSortDebounce = _.debounce(_.bind(this.onSort, this), 150);
      var onUpdateBuildingsDebounce = _.debounce(_.bind(this.updateBuildings, this), 150);
      var onMetricsChangeDebounce = _.debounce(_.bind(this.onMetricsChange, this), 150);
      var onLayerChangeDebounce = _.debounce(_.bind(this.onLayerChange, this), 150);

      this.listenTo(this.state, 'change:allbuildings', this.onBuildings, this);
      this.listenTo(this.state, 'change:year', this.onDataSourceChange);
      this.listenTo(this.state, 'change:city', this.onDataSourceChange);

      this.listenTo(this.state, 'change:layer', onLayerChangeDebounce);
      this.listenTo(this.state, 'change:filters', onUpdateBuildingsDebounce);
      this.listenTo(this.state, 'change:categories', onUpdateBuildingsDebounce);
      this.listenTo(this.state, 'change:metrics', onMetricsChangeDebounce);
      this.listenTo(this.state, 'change:sort', onSortDebounce);
      this.listenTo(this.state, 'change:order', onSortDebounce);

      this.listenTo(this.state, 'change:building', this.render);

      this.scrollTopElm = $('html').scrollTop() ? 'html' : 'body';

      $(window).scroll(_.bind(this.onScroll, this));
    },

    onDataSourceChange: function() {
      this.previousState = {};
      this.allBuildings = [];
      this.buildings = [];
      this.gradientCalculators = [];
      this.report = null;
    },

    onBuildings: function(){
      var layers = this.state.get('city').get('map_layers'),
          fields = _.where(layers, {display_type: 'range'});

      var buildings = this.allBuildings = this.state.get('allbuildings');

      var gradientCalculators = this.gradientCalculators = _.reduce(fields, function(memo, field){
        memo[field.field_name] = new BuildingColorBucketCalculator(
          buildings,
          field.field_name,
          field.range_slice_count,
          field.color_range
        );
        return memo;
      }, {});

      var buildingFields = _.values(this.state.get('city').pick('property_name', 'building_type')),
          buildingId = this.state.get('city').get('property_id');

      this.report = new ReportTranslator(buildingId, buildingFields, buildings, gradientCalculators, layers);

      this.updateBuildings();
    },

    buildingsExist: function() {
      return (typeof this.allBuildings === 'undefined' || !this.allBuildings.length) ? false : true;
    },

    updateBuildings: function() {
      if (!this.buildingsExist()) return;
      this.buildings = this.allBuildings.toFilter(this.allBuildings, this.state.get('categories'), this.state.get('filters'));

      this.preCalculateTable();
      this.onSort(true);
    },

    preCalculateTable: function() {
      if (!this.state.get('city')) { return; }
      if (!this.gradientCalculators) { return; }
      if (!this.buildingsExist()) { return; }

      var metricFieldNames = this.state.get('metrics'),
          cityFields = this.state.get('city').get('map_layers');

      this.report.updateMetrics(this.buildings, metricFieldNames);
    },

    onScroll: function() {
      var $container = this.$el.find('.building-report-header-container'),
          topOfScreen = $(window).scrollTop(),
          topOfTable  = $container.offset().top,
          scrolledPastTableHead = topOfScreen > topOfTable;

      $container.toggleClass('fixed', scrolledPastTableHead);
    },

    onLayerChange: function() {
      if(!this.state.get('city')) { return; }

      var metrics = this.state.get('metrics'),
          newLayer = this.state.get('layer'),
          cityFields = _.pluck(this.state.get('city').get('map_layers'), 'field_name'),
          validator = new MetricsValidator(cityFields, metrics, newLayer),
          validMetrics = validator.toValidFields();

      this.state.set({metrics: validMetrics});
      return this;
    },

    onMetricsChange: function(){
      this.preCalculateTable();
      this.render();
    },

    render: function(){
      if (!this.state.get('city')) { return; }
      if (!this.gradientCalculators) { return; }
      if (!this.buildingsExist()) { return; }

      this.onLayerChange();
      this.renderTableHead();
      this.renderTableBody();

      return this;
    },

    renderTableHead: function(){
      var $head = this.$el.find('thead'),
          city = this.state.get('city'),
          currentLayerName = this.state.get('layer'),
          sortColumn = this.state.get('sort'),
          sortOrder = this.state.get('order'),
          mapLayers = city.get('map_layers'),
          currentLayer = _.findWhere(mapLayers, {field_name: currentLayerName}),
          template = _.template(TableHeadTemplate),
          metrics = this.state.get('metrics');

      metrics = _.chain(metrics)
                 .map(function(m){ return _.findWhere(mapLayers, {field_name: m}); })
                 .map(function(layer){
                  var current = layer.field_name == currentLayerName,
                      sorted = layer.field_name == sortColumn;
                   return _.extend({
                     current: current ? 'current' : '',
                     sorted: sorted ? 'sorted ' + sortOrder : '',
                     checked: current ? 'checked="checked"' : ''
                   }, layer);
                 })
                 .value();

      $head.replaceWith(template({
        metrics: metrics,
        currentLayer: currentLayer
      }));
    },

    renderTableBody: function(){
      var buildings = this.buildings;
      var buildingId = this.state.get('city').get('property_id');

      var currentBuilding = this.state.get('building');
      if (!currentBuilding || currentBuilding.length < 1) {
        currentBuilding = buildings[0].get(buildingId);
      }

      var $body = this.$el.find('tbody'),
          template = _.template(TableBodyRowsTemplate),
          buildingFields = _.values(this.state.get('city').pick('property_name', 'building_type')),
          cityFields = this.state.get('city').get('map_layers'),
          metricFieldNames = this.state.get('metrics'),
          metricFields = _.map(metricFieldNames, function(name) { return _.findWhere(cityFields, {field_name: name}); }),
          report = this.report.toRows(buildings),
          metrics = new MetricAverageCalculator(buildings, metricFields, this.gradientCalculators).calculate(),
          building = buildings.find(function(b) { return b.get(buildingId) == currentBuilding; }),
          buildingMetrics = new BuildingMetricCalculator(building, this.allBuildings, metricFields, this.gradientCalculators);

      $body.replaceWith(template({
        currentBuilding: currentBuilding,
        metrics: metrics,
        buildings: report
      }));

      buildingMetrics.render($('tr.current'));
    },

    events: {
      'click .remove' : 'removeMetric',
      'click label' : 'onSortClick',
      'change input' : 'changeActiveMetric',
      'click tbody tr': 'onRowClick'
    },

    onRowClick: function(event){
      if (event.preventDefault) event.preventDefault();

      var $target = $(event.target),
          $row = $target.closest('tr'),
          buildingId = $row.attr('id');


      var scrollTopElm = $('html').scrollTop() ? 'html' : 'body';
      $(scrollTopElm).animate({ scrollTop: 0 }, 100, function() {
        // callback stuff
      });

      this.state.set({building: buildingId});

      return false;
    },

    removeMetric: function(event){
      if (event.preventDefault) event.preventDefault();

      var $target = $(event.target),
          $parent = $target.closest('th'),
          removedField = $parent.find('input').val(),
          sortedField = this.state.get('sort'),
          metrics = this.state.get('metrics');

      if (metrics.length == 1) { return false; }
      if(removedField == sortedField) { sortedField = metrics[0]; }
      metrics = _.without(metrics, removedField);
      this.state.set({metrics: metrics, sort: sortedField});

      return false;
    },

    changeActiveMetric: function(event) {
      var $target = $(event.target),
          fieldName = $target.val();
      this.state.set({layer: fieldName, sort: fieldName, building: null});
    },

    onSortClick: function(event) {
      var $target = $(event.target);
      var $parent = $target.closest('th');
      var $sortInput = $parent.find('input');
      var sortField = $sortInput.val(),
          sortOrder = this.state.get('order');
      sortOrder = (sortOrder == 'asc') ? 'desc' : 'asc';
      this.state.set({sort: sortField, order: sortOrder, building: null});
    },

    onSort: function(force) {
      if (!this.buildingsExist() || this.buildings.length < 2) return;

      var sortField = this.state.get('sort'),
          sortOrder = this.state.get('order');

      // Skip if the order && field are the same as last sort
      if (!force && this.previousState.sort && this.previousState.order &&
        this.previousState.sort === sortField &&
        this.previousState.order === sortOrder) return;

      this.previousState.sort = sortField;
      this.previousState.order = sortOrder;

      var comparator = new BuildingComparator(sortField, sortOrder == 'asc');

      this.buildings.sort(_.bind(comparator.compare, comparator));

      this.render();
    }
  });

  return BuildingComparisonView;

});
