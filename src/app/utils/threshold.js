define(['underscore', 'd3'], function(_, d3) {
  const getThresholds = (thresholds, proptype, yr) => {
    if (!thresholds[proptype]) {
      return {
        error: 'No threshold for property type'
      };
    }

    if (!thresholds[proptype][yr]) {
      return {
        error: 'No thresholds for year'
      };
    }

    return {
      data: thresholds[proptype][yr]
    };
  };

  //
  const makeLabels = thresholds => {
    return _.reduce(thresholds, (acc, item, idx) => {
      if (thresholds[idx + 1]) {
        const max = thresholds[idx + 1] - 0.1;
        acc.push(`${item}-${max.toFixed(1)}`);
      } else {
        acc.push(`≥${item}`);
      }

      return acc;
    }, [`<${thresholds[0]}`]);
  };

  //
  const thresholdIndexScale = thresholds => {
    return d3.scale.threshold()
          .domain(thresholds)
          .range(d3.range(0, thresholds.length + 1));
  };

  return {
    getThresholds,
    makeLabels,
    thresholdIndexScale
  };
});
