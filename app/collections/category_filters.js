define([
  'underscore',
  'backbone',
], function(_, Backbone) {

  var urlTemplate = _.template(
    "https://gcp-us-east1.api.carto.com/v3/sql/carto_dw/query"
  );
  var urlAuth = _.template(
    "https://auth.carto.com/oauth/token"
  );

  var CategoryFilterCollection = Backbone.Collection.extend({
    initialize: function(options) {
      this.tableName = options.tableName;
      this.cartoDbUser = options.cartoDbUser;
      this.field = options.field;
    },
    auth: function(){
      return urlAuth(this);
    },
    authorization: function(){
      Backbone.Collection.prototype.fetch.apply(this, [{headers:{'content-type': 'application/x-www-form-urlencoded'}, data:{
        'grant_type':'client_credentials'
        ,'client_id':'JIvxwJMeic2KezrNKd5ZC9BP40aPavDW'
        ,'client_secret':'Run5xT50QJpy-fcRQmiohZ4K-7MvcnO7Pv5Gvf-30ysufSWK7kpK7mD2-XVw0kJd'
        ,'audience':'carto-cloud-native-api'}}]);
      return results;
    },
    parse_auth: function(data){
      this.token = data.access_token;
    },
    url: function() {
      return urlTemplate(this);
    },
    toSql: function() {
      return 'SELECT Distinct ' + this.field + ' as value FROM carto-dw-ac-f61is3yf.shared.'+ this.tableName
    },
    
    fetch: function() {
      var query = this.toSql();
      Backbone.Collection.prototype.fetch.apply(this, [{ headers: {'Authorization' :'Bearer '+this.token}, data: { q: query } }]);
      return this.models;
    },
    parse: function(data){
      return data.rows;
    },
  });

  return CategoryFilterCollection;
});


