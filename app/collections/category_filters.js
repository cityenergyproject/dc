define([
  'underscore',
  'backbone',
], function(_, Backbone) {

  var urlTemplate = _.template(
    "https://gcp-us-east1.api.carto.com/v3/sql/carto_dw/query?q="
  );

  var CategoryFilterCollection = Backbone.Collection.extend({
    initialize: function(options) {
      this.tableName = options.tableName;
      this.cartoDbUser = options.cartoDbUser;
      this.field = options.field;
      this.token = options.token;
    },
    url: function() {
      return urlTemplate(this);
    },
    toSql: function() {
      return 'SELECT Distinct ' + this.field + ' as value FROM carto-dw-ac-f61is3yf.shared.'+ this.tableName
    },
    fetch: function() {
      var query = this.toSql();
      Backbone.Collection.prototype.fetch.apply(this, [{ headers: {'Authorization' :'Bearer '+this.token, data: { q: query } }]);
      return this.models;
    },
    parse: function(data){
      return data.rows;
    },
  });

  return CategoryFilterCollection;
});


