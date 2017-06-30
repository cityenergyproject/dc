define([
  'jquery',
  'underscore',
  'backbone',
  'store',
  'text!templates/layout/mobile-alert.html'
], function($, _, Backbone, Store, MobileAlertTemplate){
  var MobileAlert = Backbone.View.extend({
    el: '#mobile-failover',

    initialize: function(options){
      this.state = options.state;
      this.template = _.template(MobileAlertTemplate);

      this.rememberCB = $('#remember-continue');
      this.listenTo(this.state, 'change:city', this.onCityChange);

      var store = Store.get('cityenergydc');
      if (store !== undefined) {
        if (store.mobile_opt_out) {
          this.$el.toggleClass('forceoff', true);
        }
      }
    },

    events: {
      'click #continue-on': 'onContinue'
    },

    onCityChange: function(){
      this.listenTo(this.state.get('city'), 'sync', this.render);
    },

    onContinue: function() {
      if ($('#remember-continue').is(":checked")) {
        Store.set('cityenergydc', {'mobile_opt_out': true});
      }

      this.$el.toggleClass('forceoff', true);
    },

    render: function(){
      var city = this.state.get('city');

      this.$el.html(this.template({
        url_name: city.get('url_name'),
        logo_link: city.get('logo_link_url')
      }));

      return this;
    }
  });

  return MobileAlert;
});
