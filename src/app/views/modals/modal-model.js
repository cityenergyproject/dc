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

    wrapBreaks: function(txt) {
      return txt.split('<br>').map(function(d) {
        return '<p>' + d + '</p>';
      }).join('');
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

        var rows = d3.csv.parse(txt);

        if (selected === 'faq') {
          rows = rows.map(function(row) {
            return [row.question.trim(), me.wrapBreaks(row.answer.trim())];
          });
        } else if (selected === 'glossary') {
          rows = rows.map(function(row){
            if (row.url && row.url.length > 5) {
              var moreinfo = '<a class="link-ref" href="' + row.url.trim() + '" target="_blank">Reference Link</a>';

              var definition = row.definition.trim() + moreinfo;
              return [row.attribute.trim(), definition];
            }

            return [row.attribute.trim(), row.definition.trim()];
          });
        }

        me.set({
          cache: _.extend(cache, {[selected]: rows}),
          viewdata: rows
        });
      });

    }
  });

  return Modals;
});