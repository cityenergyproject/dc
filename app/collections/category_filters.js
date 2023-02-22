define([
  'underscore',
  'backbone',
], function(_, Backbone) {

  var urlTemplate = _.template(
    "https://<%= cartoDbUser %>.carto.com/api/v2/sql"
  );

  var CategoryFilterCollection = Backbone.Collection.extend({
    initialize: function(options) {
      this.tableName = options.tableName;
      this.cartoDbUser = options.cartoDbUser;
      this.field = options.field;
    },
    url: function() {
      return urlTemplate(this);
    },
    toSql: function() {
      return 'SELECT Distinct ' + this.field + ' as value FROM '+ this.tableName
    },
    fetch: function() {
      var query = this.toSql();
      Backbone.Collection.prototype.fetch.apply(this, [{ data: { q: query } }]);
      return this.models;
    },
    parse: function(data){
      return data.rows;
    },
  });

  return CategoryFilterCollection;
});
