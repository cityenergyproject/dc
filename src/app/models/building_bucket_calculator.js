define([
  'underscore',
  'd3'
], function(_, d3) {
  var BuildingBucketCalculator = function(buildings, fieldName, buckets, filterRange) {
    this.buildings = buildings;
    this.fieldName = fieldName;
    this.buckets = buckets;
    this.filterRange = filterRange || {};
  };

  BuildingBucketCalculator.prototype.getScale = function() {
    var extent = this.toExtent(),
        maxBuckets = this.buckets - 1;

    var scale = d3.scale.linear().domain(extent).rangeRound([0, maxBuckets]);

    // stuff maxBuckets into scale, for future reference
    scale._maxBuckets = maxBuckets;

    return scale;
  };

  BuildingBucketCalculator.prototype.toExtent = function() {
    var fieldValues = this.buildings.pluck(this.fieldName),
        extent = d3.extent(fieldValues),
        min = this.filterRange.min,
        max = this.filterRange.max;
    return [min || extent[0], max || extent[1]];
  };

  // Allow for extent & scale to be passed in,
  // speeds up the "toBuckets" function
  BuildingBucketCalculator.prototype.toBucket = function(value, extent, scale) {
    extent = extent || this.toExtent();
    scale = scale || this.getScale();

    return _.min([_.max([scale(value), 0]), scale._maxBuckets]);
  };

  BuildingBucketCalculator.prototype.toBuckets = function() {
    var self = this;

    var scale =  this.getScale();
    var extent = scale.domain();

    return this.buildings.reduce(function(memo, building){
      var value = building.get(self.fieldName);
      if (!value) {return memo;}
      var scaled = self.toBucket(value, extent, scale);
      memo[scaled] = memo[scaled] + 1 || 1;
      return memo;
    }, {});
  };

  return BuildingBucketCalculator;
});
