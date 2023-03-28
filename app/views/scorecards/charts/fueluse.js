define([
  'jquery',
  'underscore',
  'backbone',
  'd3',
  '../../../../lib/wrap',
  'text!templates/scorecards/charts/fueluse.html'
], function($, _, Backbone, d3, wrap, FuelUseTemplate) {
  var FuelUseView = Backbone.View.extend({
    className: 'fueluse-chart',

    TYPICAL_CAR_EMMISSION: 4.7,

    initialize: function(options){
      this.template = _.template(FuelUseTemplate);
      this.formatters = options.formatters;
      this.data = options.data;

      this.emissionsChartData = options.emissionsChartData;
      this.building_name = options.name || '';
      this.year = options.year || '';
      this.isCity = options.isCity || false;
      this.viewParent = options.parent;

      this.fuels = [
        {
          label: 'Gas',
          key: 'gas',
          emissions_key: 'percent_gas_emissions',
          usage_key: 'percent_gas_consumption',
          emissions_amount_key: 'natural_gas_use', // needs clarification
          usage_amount_key: 'natural_gas_use' // needs clarification
        },
        {
          label: 'Electric',
          key: 'electric',
          emissions_key: 'percent_electric_emissions',
          usage_key: 'percent_electric_consumption',
          emissions_amount_key: 'electricity_grid_use', // needs clarification
          usage_amount_key: 'electricity_grid_use' // needs clarification
        },
        {
          label: 'Steam',
          key: 'steam'
        }
      ];

      /**
       * All configs for fuels chart are spread across all file which is bad.
       * Config should be present in the dc.json file
       * Will come back to this problem when we have a free time
       */
      this.fuelsConfig = {
        total_usage: {
          fields: ['natural_gas_use', 'electricity_grid_use'],
        }
      }
    },

    getMean: function(key, data) {
      if (data.pluck) {
        return d3.mean(data.pluck(key));
      } else {
        return d3.mean(data.map(d => d[key]));
      }
    },

    getSum: function(key, data) {
      if (data.pluck) {
        return d3.sum(data.pluck(key));
      } else {
        return d3.sum(data.map(d => d[key]));
      }
    },

    pctFormat: function(n) {
      var val = n * 100;
      return d3.format('.0f')(val);
    },

    validNumber: function(n) {
      return _.isNumber(n) && _.isFinite(n);
    },

    validFuel: function(pct, amt) {
      return this.validNumber(pct) && pct > 0 &&
            this.validNumber(amt) && amt > 0;
    },

    getBuildingFuels: function(fuels, data) {
      fuels.forEach(d => {
        const emmission_pct = this.getMean(d.emissions_key, data);
        const emmission_amt = 80; //this.getMean(d.amount, data); use emissions_amount_key
        const usage_pct = this.getMean(d.usage_key, data);
        const usage_amt = 1; // this.getMean(d.amount, data); use usage_amount_key

        d.emissions = {};
        d.emissions.isValid = this.validFuel(emmission_pct, emmission_amt);
        d.emissions.pct = d.emissions.pct_raw = emmission_pct * 100;
        d.emissions.pct_actual = emmission_pct;
        d.emissions.amt = emmission_amt;
        d.emissions.cars = this.formatters.fixedOne(emmission_amt / this.TYPICAL_CAR_EMMISSION);

        d.usage = {};
        d.usage.isValid = this.validFuel(usage_pct, usage_amt);
        d.usage.pct = d.usage.pct_raw = usage_pct * 100;
        d.usage.pct_actual = usage_pct;
        d.usage.amt = usage_amt;
      });

      return fuels.filter(d => d.usage.isValid || d.emissions.isValid);
    },

    getCityWideFuels: function(fuels, data) {
      let total_emissions = data.total_emissions;
      let total_usage = data.total_consump;


      fuels.forEach(d => {
        const emission_key = `pct_${d.key}_ghg`;
        const usage_key = `pct_${d.key}`;

        const emmission_pct = data[emission_key];
        const usage_pct = data[usage_key];

        d.emissions = {};
        d.emissions.isValid = this.validFuel(emmission_pct, total_emissions);
        d.emissions.pct = d.emissions.pct_raw = emmission_pct * 100;
        d.emissions.pct_actual = emmission_pct;

        d.usage = {};
        d.usage.isValid = this.validFuel(usage_pct, total_usage);
        d.usage.pct = d.usage.pct_raw = usage_pct * 100;
        d.usage.pct_actual = usage_pct;
      });

      return fuels.filter(d => {
        return d.usage.isValid && d.emissions.isValid;
      });
    },

    fixPercents: function(fuels, prop) {
      const values = fuels.map((d, i) => {
        const decimal = +((d[prop].pct_raw % 1));
        const val = Math.floor(d[prop].pct_raw);
        return {
          idx: i,
          val,
          iszero: val === 0,
          decimal: val === 0 ? 1 : decimal
        };
      }).sort((a, b) => {
        return b.decimal - a.decimal;
      });

      const sum = d3.sum(values, d => d.val);

      let diff = 100 - sum;

      values.forEach(d => {
        if (diff === 0) return;

        diff -= 1;
        d.val += 1;

        d.iszero = false;
      });

      // we need to bump up zero values
      const zeros = values.filter(d => d.iszero);
      let zeros_length = zeros.length;

      if (zeros_length > 0) {
        while (zeros_length > 0) {
          zeros_length--;
          values.forEach(d => {
            if (!d.iszero && d.val > 1) {
              d.val -= 1;
            }

            if (d.iszero) {
              d.val += 1;
            }
          });
        }
      }

      values.forEach(d => {
        fuels[d.idx][prop].pct = d.val;
        fuels[d.idx][prop].pct_raw = d.val;
      });
    },

    chartData: function() {
      const data = this.data;

      let total_ghg_emissions;
      let total_ghg_emissions_intensity;
      let total_usage;

      let fuels;
      if (this.isCity) {
        fuels = this.getCityWideFuels([...this.fuels], data);
        total_ghg_emissions = data.total_emissions;
        total_ghg_emissions_intensity = data.total_emissions_intensity;
        total_usage = data.total_consump;
      } else {
        fuels = this.getBuildingFuels([...this.fuels], data);
        total_ghg_emissions = this.getSum('total_ghg_emissions', data);
        total_ghg_emissions_intensity = this.getSum('total_ghg_emissions_intensity', data);
        total_usage = this.getSum('total_consumption', data);
      }

      this.fixPercents(fuels, 'emissions');
      this.fixPercents(fuels, 'usage');

      var totals = {
        usage: d3.format(',d')(d3.round(total_usage, 0)),
        emissions: d3.format(',d')(d3.round(total_ghg_emissions, 0))
      };

      // IMPORTANT! fuels chart partly MOCKED (emissions.amt and usage.amt )
      return {
        fuels,
        totals,
        total_ghg_emissions,
        total_ghg_emissions_intensity,
        isCity: this.isCity,
        building_name: this.building_name,
        year: this.year,
        cars: this.formatters.fixedOne(total_ghg_emissions / this.TYPICAL_CAR_EMMISSION)
      };
    },

    getLabelSizes: function(labels) {
      const sizes = [];

      labels.each(function(){
        const pw = this.offsetWidth;
        const cw = this.firstChild.offsetWidth;

        if (pw === 0) return;

        sizes.push({
          elm: this,
          pw,
          cw,
          dirty: cw > pw,
          pct: +(this.style.width.replace('%', ''))
        });
      });

      return sizes;
    },

    adjSizes: function(labels, ct) {
      const sizes = this.getLabelSizes(labels);

      if (!sizes.length) return;

      let ctr = ct || 0;
      ctr += 1;
      if (ctr > 100) return;

      const dirty = _.findIndex(sizes, d => d.dirty);

      if (dirty > -1) {
        const available = sizes.filter(d => !d.dirty);

        let additional = 0;

        available.forEach(d => {
          additional += 1;
          d3.select(d.elm).style('width', (d.pct - 1) + '%');
        });

        d3.select(sizes[dirty].elm).style('width', (sizes[dirty].pct + additional) + '%');

        this.adjSizes(labels, ctr);
      }
    },

    hideLabels: function(labels) {
      const sizes = this.getLabelSizes(labels);
      sizes.forEach(d => {
        if (d.dirty) {
          d3.select(d.elm.firstChild).style('display', 'none');
        }
      });
    },

    findQuartile(quartiles, value) {
      let i = 1;
      for (; i <= quartiles.length; i++) {
        if (value < quartiles[i - 1]) return i;
      }
      return i - 1;
    },

    renderEnergyConsumptionChart: function(data, totals) {
      const parent = d3.select(this.viewParent).select('.energy-consumption-bar-chart-container');
      if (!parent.node()) return;

      const margin = { top: 20, right: 30, bottom: 20, left: 30 };
      const outerWidth = parent.node().offsetWidth;
      const outerHeight = parent.node().offsetHeight;
      const width = outerWidth - margin.left - margin.right;

      const svg = parent.append('svg')
        .attr('viewBox', `0 0 ${outerWidth} ${outerHeight}`);

      const totalBarWidth = width * (3 / 5);

      const chartData = data.map((row, i) => {
        return {
          ...row,
          emissions: {
            ...row.emissions,
            pctBefore: d3.sum(data.map((d, k) => k >= i ? 0 : d.emissions.pct_actual))
          },
          usage: {
            ...row.usage,
            pctBefore: d3.sum(data.map((d, k) => k >= i ? 0 : d.usage.pct_actual))
          }
        };
      });

      const labels = {
        emissions: {
          label: 'Resulting Emissions',
          labelUnits: '(% ghg)'
        },
        usage: {
          label: 'Energy Consumed',
          labelUnits: '(% kBtu)'
        }
      };

      const energyConsumedGroup = svg.append('g');
      this.renderBarChart(energyConsumedGroup, chartData, labels, totals, 10, width, totalBarWidth, 30, 'usage');

      const emissionsGroup = svg.append('g')
        .attr('transform', `translate(0, 60)`);
      this.renderBarChart(emissionsGroup, chartData, labels, totals, 15, width, totalBarWidth, 30, 'emissions');
    },

    renderBarChart: function(parent, data, labels, totals, yOffset, chartWidth, barWidth, barHeight, metric) {
      const chartGroup = parent.append('g')
        .attr('transform', `translate(0, ${yOffset})`);

      // Width of text on either side of bars
      const textWidth = (chartWidth - barWidth) / 2;
      const barStart = textWidth;
      const barGroup = chartGroup.append('g')
        .attr('transform', `translate(${barStart}, 15)`);
      barGroup.selectAll('.bar-item')
        .data(data)
        .enter()
          .append('rect')
          .attr('class', d => d.key)
          .classed('bar-item', true)
          .attr('height', barHeight)
          .attr('width', d => d[metric].pct_actual * barWidth)
          .attr('x', d => d[metric].pctBefore * barWidth);

      const labelGroup = chartGroup.append('g')
        .classed('bar-chart-label', true)
        .attr('transform', `translate(${barStart - 5}, 25)`);

      labelGroup.append('text')
        .attr('x', 0)
        .text(labels[metric].label)
        .call(wrap, textWidth);

      labelGroup.selectAll('tspan')
        .classed('bar-chart-label-name', true);

      labelGroup.select('text').append('tspan')
        .attr('x', 0)
        .attr('dy', '1.1em')
        .text(labels[metric].labelUnits);

      const totalGroup = chartGroup.append('g')
        .attr('transform', `translate(${barStart + barWidth + 5}, 25)`);

      const totalText = totalGroup.append('text')
        .classed('bar-chart-total', true);

      totalText.append('tspan')
        .attr('x', 0)
        .classed('bar-chart-total-value', true)
        .text(totals[metric]);
      totalText.append('tspan')
        .attr('dx', '.25em')
        .text(metric === 'usage' ? 'kBtu' : 'metric tons');

      const barLabels = chartGroup.append('g')
        .attr('transform', `translate(0, 10)`)
        .classed('bar-labels', true);
      const barLabelText = barLabels.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', d => d.key)
        .classed('bar-label', true)
        .attr('x', d => barStart + (d[metric].pctBefore + d[metric].pct_actual / 2) * barWidth)
        .text(d => {
          if (metric === 'usage') return `${d.label} ${d[metric].pct}%`;
          return `${d[metric].pct}%`;
        });

      barLabelText.call(detectHorizontalCollision);

      function detectHorizontalCollision() {
        this.each(function() {
          const node = this;
          const box = node.getBBox();

          // Only have to detect horizontally, vertically will be on the same
          const x0 = box.x;
          const x1 = x0 + box.width;

          barLabelText.each(function() {
            if (this !== node) {
              const otherBox = this.getBBox();
              const otherX0 = otherBox.x;

              // Only interested in labels that should be to the left of other
              // labels
              if (x0 < otherX0 && x1 > otherX0) {
                const overlapSize = (x1 - otherX0) + 2;
                d3.select(node)
                  .attr('dx', -(overlapSize / 2));

                d3.select(this)
                  .attr('dx', overlapSize / 2);
              }
            }
          });
        });
      }
    },

    renderEmissionsChart: function(data) {
      const selectedBuilding = this.data[0];
      const averageEmissionsIntensity = d3.mean(data.map(d => d.emissionsIntensity));

      const parent = d3.select(this.viewParent).select('.emissions-intensity-chart');
      if (!parent.node()) return;

      const outerWidth = parent.node().offsetWidth;
      const outerHeight = 300;

      const margin = { top: 50, right: 30, bottom: 40, left: 40 };
      const width = outerWidth - margin.left - margin.right;
      const height = outerHeight - margin.top - margin.bottom;

      const svg = parent.append('svg')
        .attr('viewBox', `0 0 ${outerWidth} ${outerHeight}`);

      const container = svg.append('g')
        .attr('width', width)
        .attr('height', height)
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

      const maxEmissionsIntensity = d3.max(data.map(r => r.emissionsIntensity));
      const x = d3.scale.linear()
        .domain([0, maxEmissionsIntensity * 1.05])
        .range([0, width]);

      const maxEui = d3.max(data.map(r => r.eui));
      const y = d3.scale.linear()
        .domain([0, maxEui * 1.15])
        .range([height, 0]);

      const size = d3.scale.linear()
        .domain([0, d3.max(data.map(r => r.emissions))])
        .range([5, 25]);

      const xAxis = d3.svg.axis()
        .orient('bottom')
        .outerTickSize(0)
        .innerTickSize(2)
        .scale(x);
      svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', `translate(${margin.left}, ${height + margin.top})`)
        .call(xAxis);

      const yAxis = d3.svg.axis()
        .orient('left')
        .outerTickSize(0)
        .innerTickSize(2)
        .scale(y);
      svg.append('g')
        .attr('class', 'y axis')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(yAxis);

      svg.append('g')
        .classed('label', true)
        .attr('transform', `translate(${margin.left + (width / 2)}, ${height + margin.top + 30})`)
          .append('text')
          .attr('text-anchor', 'middle')
          .text('GHG Emissions Per Square Foot');

      svg.append('g')
        .classed('label', true)
        .attr('transform', `translate(8, ${height / 2 + margin.top}) rotate(-90)`)
          .append('text')
          .attr('text-anchor', 'middle')
          .text('Energy Use Per Square Foot (EUI)');


      // Bring selected building to front
      const scatterpointData = data.slice();
      const buildingData = data.filter(d => d.id === selectedBuilding.id)[0];
      if (buildingData) {
        scatterpointData.push(buildingData);
      }

      const quartileColors = {
        1: '#0047BA',
        2: '#90AE60',
        3: '#F7C34D',
        4: '#C04F31'
      };
      const emissionsIntensities = data.map(d => d.emissionsIntensity).sort();
      const quartiles = [0.25, 0.5, 0.75, 1].map(q => d3.quantile(emissionsIntensities, q));

      container.selectAll('circle')
          .data(scatterpointData)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.emissionsIntensity))
        .attr('cy', d => y(d.eui))
        .attr('r', d => size(d.emissions))
        .attr('fill-opacity', d => d.id === selectedBuilding.id ? 1 : 0.35)
        .attr('fill', d => quartileColors[this.findQuartile(quartiles, d.emissionsIntensity)]);

      // Show average intensity
      container.append('line')
        .attr('stroke', '#D5D5D5')
        .attr('stroke-dasharray', '8 5')
        .attr('x1', x(averageEmissionsIntensity))
        .attr('x2', x(averageEmissionsIntensity))
        .attr('y1', y(0))
        .attr('y2', 0);

      // Draw line to selected building
      container.append('line')
        .attr('stroke', '#1F5DBE')
        .attr('x1', x(selectedBuilding.total_ghg_emissions_intensity))
        .attr('x2', x(selectedBuilding.total_ghg_emissions_intensity))
        .attr('y1', y(selectedBuilding.site_eui) - size(selectedBuilding.total_ghg_emissions) - 3)
        .attr('y2', -margin.top);

      // Text for average
      const averageQuartile = this.findQuartile(quartiles, averageEmissionsIntensity);

      const averageTextGroup = svg.append('g')
        .classed('callout-text callout-average-text', true)
        .attr('transform', `translate(${margin.left + x(averageEmissionsIntensity) + 5}, ${margin.top})`);

      averageTextGroup.append('text')
        .attr('x', 0)
        .attr('dy', '0')
        .text('Building type average');

      averageTextGroup.append('text')
        .text(d3.format('.2f')(averageEmissionsIntensity))
        .attr('x', 0)
        .attr('dy', '.8em')
        .classed(`value quartile-${averageQuartile}`, true);

      averageTextGroup.append('text')
        .text('KG/SF')
        .attr('x', 0)
        .attr('dy', '2.7em')
        .classed(`units quartile-${averageQuartile}`, true);

      // Text for selected building
      const selectedBuildingX = x(selectedBuilding.total_ghg_emissions_intensity);
      const selectedQuartile = this.findQuartile(quartiles, selectedBuilding.total_ghg_emissions_intensity);

      const selectedTextGroup = svg.append('g')
        .classed('callout-text callout-selected-text', true);
      selectedTextGroup.append('text')
        .text(selectedBuilding.property_name)
        .classed('selected-label', true);

      selectedTextGroup.append('text')
        .text(d3.format('.2f')(selectedBuilding.total_ghg_emissions_intensity))
        .attr('x', 0)
        .attr('dy', '.8em')
        .classed(`value quartile-${selectedQuartile}`, true);

      selectedTextGroup.append('text')
        .text('KG/SF')
        .attr('x', 0)
        .attr('dy', '2.7em')
        .classed(`units quartile-${selectedQuartile}`, true);

      const labelOnLeft = (margin.left + selectedBuildingX + selectedTextGroup.node().getBBox().width) > width;
      selectedTextGroup
        .attr('text-anchor', labelOnLeft ? 'end' : 'start')
        .attr('transform', () => {
          let x = margin.left + selectedBuildingX + 5;
          if (labelOnLeft) {
            x -= 10;
          }
          return `translate(${x}, 10)`;
        });

      const legendParent = d3.select(this.viewParent).select('.emissions-dots');
      if (legendParent.node()) {
        const legendWidth = legendParent.node().offsetWidth;
        const dotMargin = 15;

        const dotScale = d3.scale.linear().domain(d3.extent(data.map(d => d.emissions)));
        const dots = [0.1, 0.25, 0.5, 0.75, 1];

        const expectedWidth = dotMargin * (dots.length - 1) + d3.sum(dots.map(dot => size(dotScale.invert(dot)) * 2));

        const legendSvg = legendParent.append('svg')
          .attr('viewBox', `0 0 ${legendWidth} 100`);
        const legendContainer = legendSvg.append('g')
          .attr('transform', `translate(${(legendWidth - expectedWidth) / 2}, 15)`);

        let xDotPosition = 0;
        const enterLegendDot = legendContainer.selectAll('.emissions-chart-legend-dot')
          .data(dots)
          .enter()
            .append('g')
          .classed('emissions-chart-legend-dot', true)
          .attr('transform', (d, i) => {
            const r = size(dotScale.invert(d));
            xDotPosition += r;
            const translate = `translate(${xDotPosition}, ${50 - r})`;
            xDotPosition += r + dotMargin;
            return translate;
          });

        enterLegendDot
          .append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', d => size(dotScale.invert(d)))
          .attr('fill', d => '#B9B9B9');

        enterLegendDot
          .append('text')
          .attr('text-anchor', 'middle')
          .classed('emissions-dots-label', true)
          .text(d => d3.format('.2r')(dotScale.invert(d)))
          .attr('transform', d => `translate(0, ${15 + size(dotScale.invert(d))})`);
      }
    },

    render: function() {
      return this.template(this.chartData());
    },

    afterRender: function() {
      if (!this.isCity) {
        this.renderEmissionsChart(this.emissionsChartData);

        const chartData = this.chartData();
        this.renderEnergyConsumptionChart(chartData.fuels, chartData.totals);
      }
    }
  });

  return FuelUseView;
});
