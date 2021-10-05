define(['d3'], function(d3) {
  const QUARTILES = ['1st quartile', '2nd quartile', '3rd quartile', '4th quartile'];

  const types = {
    default: d => d,
    integer: d3.format(',.0f'),
    fixed: precision => {
      precision = precision || 0;
      precision = Math.max(precision, 0);
      return d3.format(',.' + precision + 'f');
    },
    quartile: idx => {
      return QUARTILES[idx] || '';
    },
    threshold: labels => {
      return idx => {
        return labels[idx] || '';
      };
    }
  };

  const get = function(t, ...args) {
    if (!t) return types.default;

    if (typeof t === 'function') return t;

    if (!t.indexOf) return types.default;

    if (t.indexOf('fixed') === 0) {
      var s = t.split('-');
      var precision = s[1] || 0;

      if (isNaN(precision)) precision = 0;

      return types.fixed(precision);
    }

    if (t === 'threshold') return types[t](...args);

    if (types[t]) return types[t];

    return types.default;
  };

  return {
    types: types,
    get: get
  };
});
