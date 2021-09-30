define([
  'backbone',
], function(Backbone) {
  var Scorecard = Backbone.Model.extend({
    defaults: {
      view: 'ess',
      active: false,
      type: 'city'
    }
  });

  return Scorecard;
});

