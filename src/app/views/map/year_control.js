define([
  'jquery',
  'underscore',
  'backbone',
  'text!templates/map/year_control.html'
], function($, _, Backbone, YearControlTemplate){

  var YearControlView = Backbone.View.extend({
    $container: $('#year-select-wrapper'),
    className: "year-control-inner",

    initialize: function(options){
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
      var city = this.state.get('city');

      this.$el.appendTo(this.$container);

      var template = _.template(YearControlTemplate);
      this.$el.html(template({
        years: _.keys(city.get('years')),
        current_year: this.state.get('year')
      }));

      return this;
    },

    events: {
      'change input.ys-year' : 'selectYear',
      'change .yearselect-controls--toggle': 'onPanelChange',
    },

    closePanel: function() {
      $('#yearselect-toggle-cb').prop('checked', false).change();
    },

    onPanelChange: function(evt) {
      var name = 'click.year-control-inner';

      var me = this;
      if (evt.target.checked) {
        $('body').on(name, function(evt) {
          if (!me.$el.find(evt.target).length) {
            me.closePanel();
          }
        });
      } else {
        $('body').off(name);
      }
    },

    selectYear: function(event){
      var year = $(event.target).val();
      this.state.set({year: year});
      this.state.set({selected_buildings: []});
    }
  });

  return YearControlView;

});
