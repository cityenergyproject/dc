define([
  'jquery',
  'underscore',
  'backbone',
  'd3',
  'text!templates/scorecards/charts/building_type_table.html'
], function($, _, Backbone, d3, TableTemplate) {
  const ORDINALS = ['1st', '2nd', '3rd', '4th'];

  var BuildingTypeTableView = Backbone.View.extend({
    className: 'building-type-table',

    initialize: function(options){
      this.template = _.template(TableTemplate);
      this.formatters = options.formatters;
      this.data = options.data;
      this.year = options.year;
      this.thresholds = options.thresholds;
      this.schema = options.schema;
    },

    defaultRow: function() {
      return {
        site_eui: [],
        year_built: [],
        thresholds: [],
        size: [],
        ess: [],
        ct: 0
      };
    },

    getThresholds: function(typ, schema) {
      const thresholds = this.thresholds[typ] ? this.thresholds[typ][this.year] : null;

      return this.schema.map((d, i) => {
        let clr = d.color;
        let val;

        if (!thresholds) {
          return {
            clr: null,
            val: 'n/a'
          };
        }

        if (i === 0) {
          val = `<${ this.formatters.fixedZero(thresholds[0]) }`;
        } else if (this.schema[i + 1]) {
          const left = this.formatters.fixedZero(thresholds[i-1]);
          const right = this.formatters.fixedZero(thresholds[i] - 1);
          val = `≥${left}-${right}`;
        } else {
          val = `≥${ this.formatters.fixedZero(thresholds[thresholds.length - 1]) }`;
        }

        return {
          clr,
          val
        };
      });
    },

    getThresholdHeaders: function() {
      return this.schema.map((d, i) => {
        return {
          clr: d.color,
          label: `${d.label.replace(' ', '-<br>')} Use`,
          quartile: `${ORDINALS[i]} Quartile`
        };
      });
    },

    computeRows: function() {
      // const types = _.uniq(this.data.pluck('property_type'));
      const types = {};
      this.data.forEach(building => {
        const year = +building.get('year');
        if (this.year != year) return;

        const typ = building.get('primary_ptype_self');
        const site_eui = building.get('site_eui');
        const built = building.get('yearbuilt');
        const ess = building.get('energy_star_score');
        const size = building.get('reported_gross_floor_area');

        if (!types.hasOwnProperty(typ)) {
          types[typ] = this.defaultRow();
          types[typ].thresholds = this.getThresholds(typ);
        }

        types[typ].site_eui.push(site_eui);
        types[typ].size.push(size);
        types[typ].ess.push(ess);
        types[typ].year_built.push(built);
        types[typ].ct++;
      });

      return Object.keys(types).map(key => {
        const row = types[key];

        return {
          label: key,
          thresholds: row.thresholds,
          count: this.formatters.commaize(row.ct),
          site_eui: this.formatters.fixedOne(d3.median(row.site_eui)),
          built: d3.median(row.year_built).toFixed(0),
          size: this.formatters.commaize(d3.median(row.size)),
          ess: d3.median(row.ess)
        };
      });
    },

    render: function(){
      const rows = this.computeRows();

      rows.sort((a, b) => {
        return d3.ascending(a.label, b.label);
      });

      return this.template({
        year: this.year,
        threshold_headers: this.getThresholdHeaders(),
        rows
      });
    }
  });

  return BuildingTypeTableView;
});
