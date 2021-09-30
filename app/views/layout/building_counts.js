define([
  'jquery',
  'underscore',
  'backbone',
  'text!templates/layout/building_counts.html'
], function($, _, Backbone, BuildingCountsTemplate){
  var BuildingCounts = Backbone.View.extend({
    el: $('#map-controls-counts'),

    initialize: function(options){
      this.state = options.state;
      this.template = _.template(BuildingCountsTemplate);

      var onRenderDebounce = _.debounce(_.bind(this.render, this), 150);
      this.listenTo(this.state, 'change:filters', onRenderDebounce);
      this.listenTo(this.state, 'change:categories', onRenderDebounce);
      this.listenTo(this.state, 'change:allbuildings', this.onBuildingChange);

      this.render();
    },

    getContent: function() {
      var buildings = this.state.get('allbuildings');
      if (!buildings) return '';

      var filteredBuildings = buildings.toFilter(buildings, this.state.get('categories'), this.state.get('filters'));

      return this.template({
        showing: filteredBuildings.length.toLocaleString(),
        total: buildings.length.toLocaleString()
      });
    },

    onBuildingChange: function() {
      this.render();
    },

    render: function(){
      this.$el.html(this.getContent());

      return this;
    }
  });

  return BuildingCounts;
});
