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

    // Handle situations where there's only a min or only a max
    if (range.min && range.max) {
      return (_value >= range.min && _value <= range.max);
    } else if (range.min) {
      return (_value >= range.min);
    } else if (range.max) {
      return (_value <= range.max);
    }
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

  var CityBuildingQuery = function(table_name, year, categories, ranges) {
    this.tableName = table_name;
    this.categories = categories;
    this.ranges = ranges;
    this.year = year;
  };

  CityBuildingQuery.prototype.toRangeSql = function(prefix) {
    prefix = prefix || '';
    return _.map(this.ranges, function(range) {
      // Handle situations where there's only a min or only a max
      if (range.min && range.max) {
        return prefix + range.field + ' BETWEEN ' + range.min + ' AND ' + range.max;
      } else if (range.min) {
        return prefix + range.field + ' >= ' + range.min;
      } else if (range.max) {
        return prefix + range.field + ' <= ' + range.max;
      }
    });
  };

  CityBuildingQuery.prototype.toWrappedValue = function(value) {
    return `'${value.replace('\'', '\'\'')}'`;
  };

  CityBuildingQuery.prototype.toCategorySql = function(prefix) {
    prefix = prefix || '';
    var self = this;
    return _.map(this.categories, function(category){
      var operation = (category.other === 'false' || category.other === false) ? 'IN' : 'NOT IN';
      var values = _.map(category.values, self.toWrappedValue);
      if (values.length === 0) return '';
      return prefix + category.field + ' ' + operation + ' (' + values.join(', ') + ')';
    }).filter(function (category) { return category });
  };

  CityBuildingQuery.prototype.toYearSql = function(prefix) {
    prefix = prefix || '';
    return [prefix + 'year_ending=' + this.year];
  };

  CityBuildingQuery.prototype.toSql = function() {
    var table = this.tableName;
    var rangeSql = this.toRangeSql();
    var categorySql = this.toCategorySql();
    var yearSql = this.toYearSql();
    var filterSql = yearSql.concat(rangeSql).concat(categorySql).join(' AND ');
    var output = ['SELECT ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat,* FROM ' + table].concat(filterSql).filter(function(e) { return e.length > 0; });
    // var encodedOutput = output.map(function(item) {
    // return item.replace('&', '%26');
    // });
  // return encodedOutput.join(' WHERE ');
    return output.join(' WHERE ');
  };

  CityBuildingQuery.prototype.toSimpleSql = function (fields) {
    var table = this.tableName;
    var output = ['SELECT'].concat(fields.join(', ')).concat('FROM ' + table);
    return output.join(' ');
  }

  CityBuildingQuery.prototype.toSqlComponents = function(prefix) {
    return {
      table: this.tableName,
      range: this.toRangeSql(prefix),
      category: this.toCategorySql(prefix),
      year: this.toYearSql(prefix)
    };
  };

  var CityBuildings = Backbone.Collection.extend({
    /**
     * because dc.json has "property_id": "pid"
     * we need to specify default id for each model
     * more info about Collection-model https://backbonejs.org/#Collection-model
     * more info about idAttribute https://backbonejs.org/#Model-idAttribute
     */
    model: Backbone.Model.extend({
      idAttribute: "pid"
    }),

    initialize: function(models, options){
      this.tableName = options.tableName;
      this.cartoDbUser = options.cartoDbUser;
    },
    url: function() {
      return urlTemplate(this);
    },

    fetch: function(year, categories, range) {
      var query = this.toSql(year, categories, range);
      if (typeof query === 'string') {
      query = query.replace(/&/g, '%26');
      }
      var result = Backbone.Collection.prototype.fetch.apply(this, [{ data: { q: query } }]);
      return result;
    },
    parse: function(data){
      return data.rows;
    },
    toSql: function(year, categories, range){
      return new CityBuildingQuery(this.tableName, year, categories, range).toSql();
    },
    toSqlComponents: function(year, categories, range, prefix){
      return new CityBuildingQuery(this.tableName, year, categories, range).toSqlComponents(prefix);
    },
    toFilter: function(buildings, categories, ranges) {
      return cityBuildingsFilterizer(buildings, categories, ranges);
    },
    fetchFields: function (fields) {
      var query = new CityBuildingQuery(this.tableName).toSimpleSql(fields);
      if (typeof query === 'string') {
      query = query.replace(/&/g, '%26');
      }
      var result = Backbone.Collection.prototype.fetch.apply(this, [{ data: { q: query } }]);
      return result;
    }
  });

  return CityBuildings;
});

