define([
  'jquery',
  'underscore',
  'backbone',
  'text!templates/layout/compare_bar.html',
], function($, _, Backbone, CompareBarTemplate){
  var CompareBar = Backbone.View.extend({
    el: $('#map-controls-bar'),

    initialize: function(options){
      this.state = options.state;
      this.template = _.template(CompareBarTemplate);

      this.$applyTo = $('.main-container');

      this.listenTo(this.state, 'change:building_compare_active', this.onCompareChange );
      this.listenTo(this.state, 'change:allbuildings', this.render);
      this.listenTo(this.state, 'change:selected_buildings', this.render);
      this.listenTo(this.state, 'change:categories', this.onCategoryChange);

      this.propertyTypeKey = 'property_type';
      this._lastPropertyType = null;

      this.render();
    },

    events: {
      'click .toggle': 'onBarClickHandler',
      'click .close': 'onCloseHandler',
      'click .compare-closer': 'onBarClickHandler',
      'click .name': 'onNameClickHandler'
    },

    onCategoryChange: function() {
      const propertyCategory = this.getPropertyCategory();
      const value = propertyCategory ? propertyCategory.values[0] : null;

      // Check for change in property_type category
      if (value !== this._lastPropertyType) {
        this.render();
      }
    },

    onCompareChange: function() {
      var mode = this.state.get('building_compare_active');
      this.$applyTo.toggleClass('compare-mode', mode);
    },

    onNameClickHandler: function(evt) {
      evt.preventDefault();

      var target = evt.target;

      if (target && target.dataset.btnid) {
        var id = target.dataset.btnid;

        var selected_buildings = this.state.get('selected_buildings') || [];

        var changed = selected_buildings.map(function(building){
          var b = Object.assign({}, building);
          b.selected = (b.id === id);
          return b;
        });

        this.state.set({ selected_buildings: changed });
      }
    },

    onBarClickHandler: function(evt) {
      evt.preventDefault();
      var mode = this.state.get('building_compare_active');
      this.state.set({ building_compare_active: !mode });
    },

    onCloseHandler: function(evt) {
      evt.preventDefault();
      evt.stopImmediatePropagation();

      var target = evt.target;

      if (target && target.dataset.id) {
        var id = target.dataset.id;
        var selected_buildings = this.state.get('selected_buildings') || [];

        var wasSelected = false;
        var filtered = selected_buildings.filter(function(building){
          if (building.id === id) wasSelected = building.selected;
          return building.id !== id;
        });

        if (wasSelected && filtered.length) filtered[0].selected = true;

        this.state.set({ selected_buildings: filtered });
      }
    },

    getPropertyCategory: function() {
      const cats = this.state.get('categories');
      if (!_.isArray(cats)) return undefined;
      return cats.find(cat => cat.field === this.propertyTypeKey);
    },

    getContent: function() {
      const propertyCategory = this.getPropertyCategory();
      const propertyType = propertyCategory ? propertyCategory.values[0] : null;

      this._lastPropertyType = propertyType;

      const o = {
        compares: Array.apply(null, Array(5)).map(function() {})
      };

      const selected_buildings = this.state.get('selected_buildings') || [];

      const buildings = this.state.get('allbuildings');
      if (!buildings) return this.template(o);

      selected_buildings.forEach((building, i) => {
        var model = buildings.get(building.id);

        if (!model) return;

        const disabled = (propertyType && model.get(this.propertyTypeKey) !== propertyType);

        o.compares.splice(i, 1, {
          name: model.get('property_name') || model.get('reported_address') || model.get('address_of_record') || model.id, // use id if property doesn't have name or address
          disabled,
          id: building.id
        });
      });

      return this.template(o);
    },

    render: function() {
      this.$el.html(this.getContent());

      return this;
    }
  });

  return CompareBar;
});
