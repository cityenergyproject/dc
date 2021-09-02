define([
  'backbone',
], function(Backbone) {
  var Scorecard = Backbone.Model.extend({
    defaults: {
      view: 'eui',
      active: false,
      type: 'city'
    }
  });

  return Scorecard;
});

