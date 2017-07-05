define([
  'backbone',
  'd3'
], function(Backbone, d3) {
  var Modals = Backbone.Model.extend({
    defaults: {
      selected: null,
      cache: {},
      viewdata: null
    },

    url: function() {
      var available = this.get('available');
      var selected = this.get('selected');
      var props = available[selected];
      return "constants/" + props.csv;
    },

    modalProps: function() {
      var available = this.get('available');
      var selected = this.get('selected');
      return available[selected] || {};
    },

    fetchViewData: function() {
      var selected = this.get('selected');

      if (selected === null) {
        this.set({
          viewdata: null
        });

        return this;
      }

      var cache = this.get('cache');
      if (cache[selected]) {
        this.set({
          viewdata: cache[selected]
        });

        return this;
      }

      var me = this;
      d3.text(this.url(), function(txt) {
        if (!txt) {
          console.error('No modal data!');
          return;
        }

        var rows = d3.csv.parseRows(txt);

        var dd = [];

        for (var i = 0; i < 10; i++) {
          rows.forEach(function(d) {
            dd.push(d);
          });
        }

        me.set({
          cache: _.extend(cache, {[selected]: dd}),
          viewdata: dd
        });
      });

    }
  });

  return Modals;
});