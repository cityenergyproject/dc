define([
  'underscore',
  'backbone',
], function(_, Backbone) {

  var urlTemplate = _.template(
    "https://<%= cartoDbUser %>.carto.com/api/v2/sql"
  );

  function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  function normalizeCityBuildingCategories(categories) {
    return _.map(categories, function(category) {
      return {
        field: category.field,
        other: category.other,
        values: _.map(category.values, function(value) {
            if (isNumeric(value)) return +value;
            return value;
        })
      };
    });
  }

  function normalizeCityBuildingRanges(ranges) {
    return _.map(ranges, function(range) {
      return {
        field: range.field,
        max: +range.max,
        min: +range.min
      };
    });
  }

  function isValidCategoryValue(value, category) {
    var _value = isNumeric(value) ? +value : value;
    var idx = category.values.indexOf(_value);

    if ( (category.other === 'false' || category.other === false)) { // IN
      if (idx < 0) return false;
    } else { // NOT IN
      if (idx > -1) return false;
    }

    return true;
  }

  function isValidRangeValue(value, range) {
    var _value = parseFloat(value);

    if (!_.isNumber(_value)) {
      return false;
    }

    return (_value >= range.min && _value <= range.max);
  }

  function cityBuildingsFilterizer(buildings, categories, ranges) {

    var normalizedCategories = normalizeCityBuildingCategories(categories);
    var normalizedRanges = normalizeCityBuildingRanges(ranges);

    return buildings.filter(function(building, i){
      var valid = true;

      var atts = building.attributes;

      // categories
      normalizedCategories.forEach(function(category){
        if (!valid) return;
        if (!isValidCategoryValue(atts[category.field], category)) valid = false;
      });


      // ranges
      normalizedRanges.forEach(function(range) {
        if (!valid) return;
        if (!isValidRangeValue(atts[range.field], range)) valid = false;
      });

      return valid;
    });
  }

  var CityBuildingQuery = function(table_name, categories, ranges) {
    this.tableName = table_name;
    this.categories = categories;
    this.ranges = ranges;
  };

  CityBuildingQuery.prototype.toRangeSql = function() {
    return _.map(this.ranges, function(range){
      return range.field + " BETWEEN " + range.min + " AND " + range.max;
    });
  };

  CityBuildingQuery.prototype.toWrappedValue = function(value) {
    return "'" + value + "'";
  };

  CityBuildingQuery.prototype.toCategorySql = function() {
    var self = this;
    return _.map(this.categories, function(category){
      var operation = (category.other === 'false' || category.other === false) ? "IN" : "NOT IN",
          values = _.map(category.values, self.toWrappedValue);
      if (values.length === 0) return "";
      return category.field + " " + operation + " (" + values.join(', ') + ")";
    });
  };

  CityBuildingQuery.prototype.toSql = function() {
    var table = this.tableName;
    var rangeSql = this.toRangeSql();
    var categorySql = this.toCategorySql();
    var filterSql = rangeSql.concat(categorySql).join(' AND ');
    var output = ["SELECT ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat,* FROM " + table].concat(filterSql).filter(function(e) { return e.length > 0; });
    return output.join(" WHERE ");
  };

  var CityBuildings = Backbone.Collection.extend({
    initialize: function(models, options){
      this.tableName = options.tableName;
      this.cartoDbUser = options.cartoDbUser;
    },
    url: function() {
      return urlTemplate(this);
    },
    fetch: function(categories, range) {
      var query = this.toSql(categories, range);
      var result = Backbone.Collection.prototype.fetch.apply(this, [{data: {q: query}}]);
      return result;
    },
    parse: function(data){
      return data.rows;
    },
    toSql: function(categories, range){
      return new CityBuildingQuery(this.tableName, categories, range).toSql()
    },
    toFilter: function(buildings, categories, ranges) {
      return cityBuildingsFilterizer(buildings, categories, ranges);
    }
  });

  return CityBuildings;
});


