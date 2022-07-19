define([
    'jquery',
    'underscore',
    'backbone',
    'store',
    'd3',
    'text!templates/layout/landing.html',
    'text!templates/layout/landing-cards.html',
    'text!templates/layout/footer.html'
], function($, _, Backbone, Store, d3, LandingTemplate, LandingCardsTemplate, FooterTemplate){
    var TOTAL_GHG_EMISSIONS = 'Total Greenhouse emissions';
    var TOTAL_GHG_EMISSIONS_UNIT = 'kg CO2e';
    var TOTAL_GROSS_FLOOR_AREA_COVERED = 'Total Gross Floor Area Covered';
    var TOTAL_ENERGY_CONSUMPTION = 'Total Energy Consumption';
    var TOTAL_ENERGY_CONSUMPTION_UNIT = '(MMbtu/yr)';
    var TOTAL_BUILDING_REPORTED = 'Total building Reported';
    var SUBMISSIONS_RECEIVED = '% Submissions Received';
    var DATA_COMPLETE_AND_ACCURATE = '% Data Complete and Accurate';

    var reportIncompleteStatuses = [
        'Missing Report'
    ];

    var submissionMissingReceivedStatuses = [
      'No Report Received',
      'Exempt from this year\'s disclosure',
    ];

    var filteredStatuses = [
        'Exempt from this year\'s disclosure'
    ]

    var Landing = Backbone.View.extend({
        el: '#landing',

        initialize: function(options){
            this.state = options.state;
            this.template = _.template(LandingTemplate);
            this.cardTemplate = _.template(LandingCardsTemplate);
            this.mainContainer = $('.main-container');

            // when loader hide, we have all the data
            this.listenTo(this.state, 'hideActivityLoader', this.renderCardsAndHistogram);
            this.listenToOnce(this.state, 'buildLandingD3', this.getSiteEUI);

            this.render();

        },

        events: {
            'click #navigate-further': 'onContinue',
            'click .modal-link': 'onModalLink'
        },

        renderCardsAndHistogram: function () {
            this.$el.find('.landing-main-container--cards').html(
                this.getTotalGhgEmissions() +
                this.getTotalEnergyConsumption() +
                this.getReportedGrossFloorArea() +
                this.getTotalBuildingsReported() +
                this.getSubmissionReceived() +
                this.getDataCompleteAndAccurate()
            );

        },

        onContinue: function() {
            this.mainContainer.removeClass('scroll-blocked');
            this.remove();
            window.scrollTo({top: 0}) // Return page position to start
        },

        onModalLink: function(evt) {
            if (evt.preventDefault) evt.preventDefault();

            // Since this is a modal link, we need to make sure
            // our handler exists
            var modelFn = this.state.get('setModal');
            if (!modelFn) return false;

            modelFn(evt.target.dataset.modal);

            return false;
        },

        getSiteEUI: function () {
            var landingData = this.state.get('landingData');

            if(landingData) {
                var siteEuiObj = landingData.reduce((acc, val) => {
                    var year = val.get('year_ending');
                    var site_eui = val.get('site_eui');
                    var report_status = val.get('report_status');

                    // if we don't have years arr - create it
                    if(!acc[year]) {
                        acc[year] = [];
                    }

                    if(site_eui !== null && site_eui !== undefined && report_status === 'In Compliance') {
                        acc[year].push(site_eui)
                    }

                    return acc;
                }, {});

                var d3Data = [];
                for (const [year, values] of Object.entries(siteEuiObj)) {
                    d3Data.push({
                        date: `${year}-01-02`, // needs to use these strange dates for consistency between browsers
                        value: values.reduce((acc, value, i, arr) => {
                            // on the last step calculate average
                            if(i === arr.length - 1) {
                                return (acc + value) / arr.length;
                            }
                            return acc + value;
                        }, 0)
                    })
                }

                this.buildD3Histogram(d3Data);
            }
        },

        buildD3Histogram: function (data) {
            var margin = {top: 60, right: 30, bottom: 60, left: 60};
            var width = 900 - margin.left - margin.right;
            var height = 400 - margin.top - margin.bottom;

            var title = 'Average Site EUI';
            var titleX = 'Year';

            var svg = d3.select('#landing-histogram')
                .append('svg')
                .style({width: '100%', height: '100%'})
                .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
                .attr('preserveAspectRatio', "xMidYMid meet")
                .append('g')
                .attr('transform',
                    'translate(' + margin.left + ',' + margin.top + ')')

            var x = d3.time.scale()
                .domain(d3.extent(data, (d)=> new Date(d.date)))
                .range([ 0, width ]);
            var maxValue = _.max(data, (item) => {return item.value});
            var maxY = Math.round(maxValue.value / 10) * 10 + 10;
            var y = d3.scale.linear()
                .domain( [0, maxY])
                .range([ height, 0 ]);

            // Add X axis --> it is a date format
            svg.append('g')
                .attr('transform', 'translate(0,' + height + ')')
                .attr('class', 'x-axis')
                .call(
                    d3.svg.axis()
                    .scale(x)
                    .orient('bottom')
                    .ticks(12)
                );

            // Add Y axis
            svg.append('g')
                .attr('class', 'y-axis')
                .call(
                    d3.svg.axis()
                    .scale(y)
                    .orient('left')
                    .ticks(10)
                );

            // Add the line
            svg.append('path')
                .datum(data)
                .attr('fill', 'none')
                .attr('stroke', 'steelblue')
                .attr('stroke-width', 1.5)
                .attr('d', d3.svg.line()
                    .x(function(d) { return x(new Date(d.date)) })
                    .y(function(d) { return y(d.value) })
                )

            // Tooltip
            var Tooltip = d3.select('#landing-histogram')
                .append('div')
                .attr('class', 'tooltip')

            var mouseover = function(d) {
                Tooltip
                    .attr('class', 'tooltip tooltip__visible')
            }
            var mousemove = function(d) {
                Tooltip
                    .html(`<div><span>${title}: </span>${parseFloat(d.value.toFixed(2))}</div><div><span>${titleX}: </span> ${new Date(d.date).getFullYear()}</div>`)
                    .style('left', (d3.mouse(this)[0]) + 'px')
                    .style('top', (d3.mouse(this)[1]) + 75 + 'px')
            }
            var mouseleave = function(d) {
                Tooltip
                    .attr('class', 'tooltip')
            }

            // Add the points
            svg
                .append('g')
                .selectAll('dot')
                .data(data)
                .enter()
                .append('circle')
                .attr('cx', function(d) { return x(new Date(d.date)) } )
                .attr('cy', function(d) { return y(d.value) } )
                .attr('r', 10)
                .attr('fill', 'steelblue')
                .on('mouseover', mouseover)
                .on('mousemove', mousemove)
                .on('mouseleave', mouseleave)

            // vertical lines
            svg.selectAll('g.x-axis g.tick')
                .append('line')
                .classed('grid-line', true)
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', 0)
                .attr('y2', -height);

            // horizontal lines
            svg.selectAll('g.y-axis g.tick')
                .append('line')
                .classed('grid-line', true)
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', width)
                .attr('y2', 0);

            svg.append('text')
                .attr('x', (width / 2))
                .attr('y', -20 )
                .attr('text-anchor', 'middle')
                .style('font-size', '1.5em')
                .text(title);

            svg.append('text')
                .attr('x', -(height / 2))
                .attr('y', -(margin.left - 20))
                .attr('text-anchor', 'middle')
                .attr('transform', 'translate(0,0) rotate(270)')
                .style('font-size', '1em')
                .text(`${title} (kBTU/sqft)`);

            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height + (margin.bottom - 10))
                .attr('text-anchor', 'middle')
                .style('font-size', '1em')
                .text(titleX);
        },

        getTotalGhgEmissions: function () {
            var allbuildings = this.state.get('allbuildings');
            if(allbuildings) {
                var totalGhgEmissions = allbuildings.reduce((acc, val) => {
                    var total_ghg_emissions = val.get('total_ghg_emissions');
                    if(val.get('report_status') === 'In Compliance' && total_ghg_emissions) {
                        return acc + total_ghg_emissions
                    }

                    return acc
                }, 0);
            }

            return this.cardTemplate({
                title: TOTAL_GHG_EMISSIONS,
                unit: TOTAL_GHG_EMISSIONS_UNIT,
                value: totalGhgEmissions.toFixed(2)
            })
        },

        getReportedGrossFloorArea: function () {
            var allbuildings = this.state.get('allbuildings');
            if(allbuildings) {
                var reportedGrossFloorArea = allbuildings.reduce((acc, val) => {
                    var reported_gross_floor_area = val.get('reported_gross_floor_area');
                    if(val.get('report_status') === 'In Compliance' && reported_gross_floor_area) {
                        return acc + reported_gross_floor_area
                    }

                    return acc
                }, 0);
            }

            return this.cardTemplate({
                title: TOTAL_GROSS_FLOOR_AREA_COVERED,
                unit: '',
                value: parseFloat(reportedGrossFloorArea).toFixed(2)
            })
        },

        getTotalBuildingsReported: function () {
            var allbuildings = this.state.get('allbuildings');
            var totalBuildingsReported = allbuildings.reduce((acc, val) => {
                if(!reportIncompleteStatuses.includes(val.get('report_status')) && val.get('pid')) {
                    return acc + 1
                }

                return acc
            }, 0);

            return this.cardTemplate({
                title: TOTAL_BUILDING_REPORTED,
                unit: '',
                value: totalBuildingsReported
            })

        },

        getTotalEnergyConsumption: function () {
            var allbuildings = this.state.get('allbuildings');

            if(allbuildings) {
                var totalEnergyConsumption = allbuildings.reduce((acc, val) => {
                    var site_eui = val.get('site_eui');
                    var reported_gross_floor_area = val.get('reported_gross_floor_area');
                    if(val.get('report_status') === 'In Compliance' && site_eui && reported_gross_floor_area) {
                        return acc + (site_eui * reported_gross_floor_area / 1000);
                    }

                    return acc
                }, 0);
            }

            return this.cardTemplate({
                title: TOTAL_ENERGY_CONSUMPTION,
                unit: TOTAL_ENERGY_CONSUMPTION_UNIT,
                value: totalEnergyConsumption.toFixed(0)
            })
        },

        getSubmissionReceived: function () {
            var allbuildings = this.state.get('allbuildings');
            var totalBuildingsReported = allbuildings.reduce((acc, val) => {
                if(!submissionMissingReceivedStatuses.includes(val.get('report_status')) && val.get('pid')) {
                    return acc + 1
                }

                return acc
            }, 0);

            var filteredTotalBuildings = allbuildings.reduce((acc, val) => {
                if(!filteredStatuses.includes(val.get('report_status')) && val.get('pid')) {
                    return acc + 1
                }

                return acc
            }, 0);

            var fixedValue = `${parseFloat((totalBuildingsReported * 100 / filteredTotalBuildings).toFixed(2))}%`;

            return this.cardTemplate({
                title: SUBMISSIONS_RECEIVED,
                unit: '',
                value: fixedValue
            })
        },

        getDataCompleteAndAccurate: function () {
            var allbuildings = this.state.get('allbuildings');
            var accurateRecords = allbuildings.reduce((acc, val) => {
                if(val.get('report_status') === 'In Compliance' && val.get('pid')) {
                    return acc + 1
                }

                return acc
            }, 0);

            var filteredTotalBuildings = allbuildings.reduce((acc, val) => {
                if(!filteredStatuses.includes(val.get('report_status')) && val.get('pid')) {
                    return acc + 1
                }

                return acc
            }, 0);

            var fixedValue = `${parseFloat((accurateRecords * 100 / filteredTotalBuildings).toFixed(2))}%`;

            return this.cardTemplate({
                title: DATA_COMPLETE_AND_ACCURATE,
                unit: '',
                value: fixedValue
            })
        },

        render: function(){
            this.mainContainer.addClass('scroll-blocked');

            this.$el.html(this.template({
                footer: FooterTemplate
            }));

            return this;
        }
    });

    return Landing;
});
