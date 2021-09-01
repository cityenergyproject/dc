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
      console.warn('fueluse.js MOCK')
      const dataMOCK = JSON.parse("[{\"id\":26429,\"eui\":82.8,\"emissions\":288.2,\"emissionsIntensity\":3},{\"id\":24137,\"eui\":34.3,\"emissions\":33.1,\"emissionsIntensity\":0.5},{\"id\":21568,\"eui\":64,\"emissions\":112.3,\"emissionsIntensity\":1.3},{\"id\":24888,\"eui\":32.3,\"emissions\":8.1,\"emissionsIntensity\":0.1},{\"id\":20970,\"eui\":156.5,\"emissions\":216.3,\"emissionsIntensity\":5.2},{\"id\":25965,\"eui\":101.8,\"emissions\":868.6,\"emissionsIntensity\":10.7},{\"id\":25737,\"eui\":62.5,\"emissions\":122.8,\"emissionsIntensity\":1.8},{\"id\":27071,\"eui\":33,\"emissions\":17.4,\"emissionsIntensity\":0.1},{\"id\":25259,\"eui\":80.6,\"emissions\":63.6,\"emissionsIntensity\":2},{\"id\":20377,\"eui\":58.2,\"emissions\":9.1,\"emissionsIntensity\":0.1},{\"id\":24769,\"eui\":43.6,\"emissions\":252.3,\"emissionsIntensity\":1.4},{\"id\":26989,\"eui\":65.6,\"emissions\":76,\"emissionsIntensity\":1.3},{\"id\":26550,\"eui\":110.7,\"emissions\":834.5,\"emissionsIntensity\":4.2},{\"id\":50179,\"eui\":37.8,\"emissions\":120.4,\"emissionsIntensity\":0.9},{\"id\":85,\"eui\":172.4,\"emissions\":581.3,\"emissionsIntensity\":6.2},{\"id\":20145,\"eui\":45.3,\"emissions\":40.4,\"emissionsIntensity\":0.8},{\"id\":25490,\"eui\":66.2,\"emissions\":197.6,\"emissionsIntensity\":2.2},{\"id\":50085,\"eui\":75,\"emissions\":67.2,\"emissionsIntensity\":1.6},{\"id\":29069,\"eui\":49.4,\"emissions\":142.6,\"emissionsIntensity\":1.1},{\"id\":22955,\"eui\":88.1,\"emissions\":70.3,\"emissionsIntensity\":2.1},{\"id\":278,\"eui\":97.3,\"emissions\":179.4,\"emissionsIntensity\":2},{\"id\":26157,\"eui\":141.8,\"emissions\":745.1,\"emissionsIntensity\":5.4},{\"id\":26249,\"eui\":50.4,\"emissions\":97.3,\"emissionsIntensity\":1.1},{\"id\":19451,\"eui\":55.3,\"emissions\":284,\"emissionsIntensity\":4.3},{\"id\":20885,\"eui\":156,\"emissions\":338.4,\"emissionsIntensity\":9.8},{\"id\":21114,\"eui\":42.9,\"emissions\":1018.3,\"emissionsIntensity\":1.6},{\"id\":21879,\"eui\":38.4,\"emissions\":62.7,\"emissionsIntensity\":1.2},{\"id\":50167,\"eui\":52.7,\"emissions\":147.6,\"emissionsIntensity\":1.5},{\"id\":49829,\"eui\":96.5,\"emissions\":192.9,\"emissionsIntensity\":2.7},{\"id\":22956,\"eui\":45.1,\"emissions\":90.4,\"emissionsIntensity\":1},{\"id\":26324,\"eui\":89.2,\"emissions\":70.5,\"emissionsIntensity\":3.1},{\"id\":49945,\"eui\":82.6,\"emissions\":82.5,\"emissionsIntensity\":2},{\"id\":21244,\"eui\":100.8,\"emissions\":138.7,\"emissionsIntensity\":3},{\"id\":84,\"eui\":144.6,\"emissions\":1691.8,\"emissionsIntensity\":5.7},{\"id\":26730,\"eui\":66.5,\"emissions\":72.5,\"emissionsIntensity\":1.7},{\"id\":25772,\"eui\":82.2,\"emissions\":134,\"emissionsIntensity\":2.9},{\"id\":26930,\"eui\":106.6,\"emissions\":218.2,\"emissionsIntensity\":2.9},{\"id\":23025,\"eui\":54,\"emissions\":108.8,\"emissionsIntensity\":0.9},{\"id\":23682,\"eui\":30.3,\"emissions\":55.8,\"emissionsIntensity\":0.4},{\"id\":49987,\"eui\":26.8,\"emissions\":25.3,\"emissionsIntensity\":0.5},{\"id\":26846,\"eui\":37.7,\"emissions\":99.4,\"emissionsIntensity\":0.9},{\"id\":24746,\"eui\":59.5,\"emissions\":115.9,\"emissionsIntensity\":1.8},{\"id\":22961,\"eui\":88.5,\"emissions\":74.8,\"emissionsIntensity\":3.5},{\"id\":26289,\"eui\":113.3,\"emissions\":206.5,\"emissionsIntensity\":3.7},{\"id\":21741,\"eui\":52.9,\"emissions\":974.2,\"emissionsIntensity\":1.5}]");
      this.emissionsChartData = dataMOCK;

      // this.emissionsChartData = options.emissionsChartData;
      this.building_name = options.name || '';
      this.year = options.year || '';
      this.isCity = options.isCity || false;
      this.viewParent = options.parent;

      this.fuels = [
        {
          label: 'Gas',
          key: 'gas'
        },
        {
          label: 'Electric',
          key: 'electricity'
        },
        {
          label: 'Steam',
          key: 'steam'
        }
      ];
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
        const emmission_pct = this.getMean(d.key + '_ghg_percent', data);
        const emmission_amt = this.getMean(d.key + '_ghg', data);
        const usage_pct = this.getMean(d.key + '_pct', data);
        const usage_amt = this.getMean(d.key, data);

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
        console.warn(`total_kbtu doesn't have it`)
        total_usage = this.getSum('total_kbtu', data);
      }

      this.fixPercents(fuels, 'emissions');
      this.fixPercents(fuels, 'usage');

      var totals = {
        usage: d3.format(',d')(d3.round(total_usage, 0)),
        emissions: d3.format(',d')(d3.round(total_ghg_emissions, 0))
      };

      console.warn('fuels chart MOCKED');
      const fuelsMock = JSON.parse("[{\"label\":\"Gas\",\"key\":\"gas\",\"emissions\":{\"isValid\":true,\"pct_raw\":98,\"pct\":98,\"pct_actual\":0.98,\"amt\":59.03,\"cars\":\"12.6\"},\"usage\":{\"isValid\":true,\"pct_raw\":73,\"pct\":73,\"pct_actual\":0.73,\"amt\":11114}},{\"label\":\"Electric\",\"key\":\"electricity\",\"emissions\":{\"isValid\":true,\"pct_raw\":2,\"pct\":2,\"pct_actual\":0.02,\"amt\":1.12,\"cars\":\"0.2\"},\"usage\":{\"isValid\":true,\"pct_raw\":27,\"pct\":27,\"pct_actual\":0.27,\"amt\":122782}}]");

      return {
        // fuels,
        fuels: fuelsMock,
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
