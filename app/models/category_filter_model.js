define([
  'backbone',
  'collections/category_filters',
], function(Backbone, CategoryFilterCollection) {
  var CategoryFiltersModel = Backbone.Model.extend({
    initialize: function(options) {
      var categoryFilters = options.categoryFilterFields.reduce(function(acc, field) {
        acc[field] = new CategoryFilterCollection({
          tableName: options.tableName,
          cartoDbUser: options.cartoDbUser,
          field: field
        }).fetch();
        return acc;
      }, {});
      this.set(categoryFilters);
    }
  });

  return CategoryFiltersModel;
});
