define([
  'jquery',
  'underscore',
  'backbone',
], function($, _, Backbone){

  var HistogramView = Backbone.View.extend({
    className: "histogram",

    initialize: function(options){
      this.aspectRatio = options.aspectRatio || 7/1;
      this.height = 100;
      this.width = this.height * this.aspectRatio;

      this.selected_value = options.selected_value || null;
      this.gradients = options.gradients;
      this.colorScale = options.colorScale;
      this.filterRange = options.filterRange;
      this.fieldName = options.fieldName;
      this.slices = options.slices;
      this.chart = d3.select(this.el).append('svg')
                      .style({width: '100%', height: '100%'})
                      .attr('viewBox', '0 0 ' + this.width + ' ' + this.height)
                      .attr('preserveAspectRatio', "xMinYMin meet")
                      .style('background', 'transparent');

      this.g = this.chart.append('g');
    },

    update: function(options) {
      Object.keys(options).forEach(k => {
          if (this.hasOwnProperty(k)) {
              this[k] = options[k];
          }
      });
    },

    findQuantileIndexForValue: function(val, quantiles) {
      if (!quantiles) {
          quantiles = this.colorScale.quantiles ?
              [...this.colorScale.quantiles()] :
              [...this.colorScale.domain()];
      }

      const len = quantiles.length - 1;

      return _.reduce(quantiles, function(prev, curr, i){
          // bail if we found an index
          if (prev > -1) return prev;

          // special case first index
          if (i === 0 && val < quantiles[0]) return i;

          // check if val is within range
          if (val >= quantiles[i-1] && val < quantiles[i]) return i;

          // if no match yet, return index for the last bar
          if (i === len) return i + 1;

          // return current index
          return prev;
      }, -1);
    },

    updateHighlight: function(val) {
      if (!this.chart || this.selected_value === val) return;
      this.selected_value = val;
      this.chart.selectAll('rect').call(this.highlightBar, this);
    },

    highlightBar: function(bars, context) {
      const ctxValue = context.selected_value;


      const quantiles = context.colorScale.quantiles ?
          [...context.colorScale.quantiles()] :
          [...context.colorScale.domain()];

      const highlightIndex = (ctxValue !== null)
          ? context.findQuantileIndexForValue(ctxValue, quantiles) :
          null;

      bars.classed('highlight', function(d, i) {
          return i === highlightIndex;
      });
    },

    render: function(){
      const colorScale = this.colorScale;
      const isThreshold = colorScale.quantiles ? false : true;

      const gradients = this.gradients;
      const counts = _.pluck(gradients, 'count');
      const height = this.height;

      const yScale = d3.scale.linear()
          .domain([0, d3.max(counts)])
          .range([0, this.height]);

      const xScale = d3.scale.ordinal()
          .domain(d3.range(0, this.slices))
          .rangeBands([0, this.width], 0.2, 0);

      // threshold types use rounded bands for convienence
      if (isThreshold) {
          xScale.rangeRoundBands([0, this.width], 0.1, 0);
      }

      const bardata = xScale.domain().map((d, i) => {
          return {
              ...gradients[i],
              idx: i,
              data: d,
              xpos: xScale(d) + (xScale.rangeBand() / 2)
          };
      });

      const filterValueForXpos = d3.scale.linear()
          .range(this.filterRange)
          .domain([0, this.width]);

      // make scale available to caller
      this.xScale = xScale;

      // draw
      const bars = this.g.selectAll('rect')
          .data(bardata, function(d) { return d.color; });

      bars.enter().append('rect');

      bars
          .style('fill', (d, i) => {
              // not on a continous scale
              // so just need the color from data
              if (isThreshold) return d.color;

              // mapping the color continously
              // so need to calculate the color for
              // this xpos
              //
              return colorScale(filterValueForXpos(d.xpos));
          })
          .attr({
              'width': () => {
                  return xScale.rangeBand();
              },
              'stroke-width': 0,
              'height': d => yScale(d.count),
              'x': (d, i) => xScale(d.data),
              'y': d => (height - yScale(d.count))
          });

      bars.exit().remove();

      bars.call(this.highlightBar, this);

      this.g.selectAll('rect')
          .filter((bucket, index) => { return bucket.current === index; })
          .classed('current', true);

      return this.el;
    }
  });

  return HistogramView;
});
