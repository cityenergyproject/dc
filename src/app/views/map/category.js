define([
  'jquery',
  'underscore',
  'backbone',
  'ionrangeslider',
  'models/city',
  'text!templates/map_controls/category.html',
], function($, _, Backbone, Ion, CityModel, MapCategoryControlTemplate){
  var OTHER_LABEL = "Other";

  var MapCategoryControlView = Backbone.View.extend({
    $container: $('#map-category-controls'),

    initialize: function(options){
      this.layer = options.layer;
      this.allBuildings = options.allBuildings;
      this.state = options.state;

      this.listenTo(this.state, 'close_category_panels', this.closePanel);

      var fieldName = this.layer.field_name;
      var orderedValues = this.state.get("categoryFilters").get(fieldName)
        .map(function(item) {return item.get("value")})
        .sort(function(a, b) {
          if (this.layer.sort_by_key){
            if(a===b) return 0;
            return (a<b) ? -1 : 1;
          }

          return 0;
        }.bind(this));
      this.values = orderedValues.slice(0, this.layer.hide_other_category ? orderedValues.length++ : 9 );
      if(!this.layer.hide_other_category) this.values.concat([OTHER_LABEL]);
      this.otherValues = this.layer.hide_other_category ? [] : orderedValues.slice(9);
    },

    close: function() {
      this.undelegateEvents();
      this.remove();
    },

    render: function(){
      var fieldName = this.layer.field_name,
        counts = this.allBuildings.countBy(fieldName),
        fieldKeys = this.state.get("categoryFilters").get(fieldName)
          .map(function(item) {return item.get("value")}),
        defaultCategoryState = {field: fieldName, values: [fieldKeys], other: true},
        categoryState = _.findWhere(this.state.get('categories'), {field: fieldName}) || defaultCategoryState,
        onloadDisplayValues = !this.layer.onload_display_values ?
          fieldKeys.reduce(function(accum,current){
            accum[current] = !categoryState.values.find(function(item){ 
              return item === current;
            });
            return accum;
          },{}) :
          this.layer.onload_display_values.split(',').reduce(function(accum,current){
            accum[current] = true;
            return accum;
          },{}),
        template = _.template(MapCategoryControlTemplate);

      if (fieldKeys[0] == "undefined") { return this; }

      var categories = this.values
        .map(function(name) {
          var stateHasValue = _.contains(categoryState.values, name),
              stateIsInverted = (categoryState.other === true || categoryState.other === 'true'),
              checked = stateIsInverted ? onloadDisplayValues[name] : stateHasValue;

          return {
            checked: checked ? 'checked="checked"' : '',
            count: counts[name] || 0,
            name: name
          };
        });

      var compiled = template({
        id: this.layer.field_name,
        title: this.layer.title,
        categories: categories
      });

      this.$el = $(compiled).appendTo(this.$container);
      this.delegateEvents();

      return this;
    },

    events: {
      'change .category-list-toggle-cb': 'onPanelChange',
      'change .categories input' : 'toggleCategory',
      'click .categories .showAll': 'showAll',
      'click .categories .hideAll': 'hideAll'
    },

    closePanel: function(exclude) {
      if (this.layer.field_name === exclude) return;

      $('#category-' + this.layer.field_name).prop('checked', false).change();
    },

    onPanelChange: function(evt) {
      var name = 'click.catpanel-'+this.layer.field_name;

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

    toggleCategory: function(){
      var categories = this.state.get('categories'),
          fieldName = this.layer.field_name,
          unchecked = this.$el.find(".categories input:not(:checked)").map(function(){return $(this).val();}),
          checked = this.$el.find(".categories input:checked").map(function(){return $(this).val();});

      categories = _.reject(categories, function(f){ return f.field == fieldName; });

      if (unchecked.length < checked.length){
        var uncheckedValues = unchecked.toArray();

        if (uncheckedValues.indexOf(OTHER_LABEL) >= 0) {
          uncheckedValues = _.without(uncheckedValues, OTHER_LABEL).concat(this.otherValues);
        }

        categories.push({field: fieldName, values: uncheckedValues, other: true});
      } else if (checked.length > 0) {
        var checkedValues = checked.toArray();

        if (checkedValues.indexOf(OTHER_LABEL) >= 0) {
          checkedValues = _.without(checkedValues, OTHER_LABEL).concat(this.otherValues);
        }

        categories.push({field: fieldName, values: checkedValues, other: false});
      } else {
        // the case when all options are unchecked
          categories.push({field: fieldName, values: unchecked.toArray(), other: true});
      }
      this.state.set({categories: categories});
    },

    hideAll: function(){
      var categories = this.state.get('categories'),
          fieldName = this.layer.field_name,
          counts = this.allBuildings.countBy(fieldName),
          fieldKeys = _.keys(counts);

      categories = _.reject(categories, function(f){ return f.field == fieldName; });

      this.$el.find(".categories input").map(function() {this.checked = false;});

      categories.push({field: fieldName, values: fieldKeys, other: true});

      this.state.set({categories: categories});

      return false;
    },

    showAll: function(){
      var categories = this.state.get('categories'),
          fieldName = this.layer.field_name,
          counts = this.allBuildings.countBy(fieldName),
          fieldKeys = _.keys(counts);

      categories = _.reject(categories, function(f){ return f.field == fieldName; });

      this.$el.find(".categories input").map(function() {this.checked = true;});

      categories.push({field: fieldName, values: fieldKeys, other: false});

      this.state.set({categories: categories});

      return false;
    }
  });

  return MapCategoryControlView;

});
