define([
  'jquery',
  'underscore',
  'backbone',
  'text!templates/layout/activity_indicator.html'
], function($, _, Backbone, ActivityIndicatorTemplate){
  var ActivityIndicator = Backbone.View.extend({
    initialize: function(options){
      this.state = options.state;

      // TODO: Might want to make these next three variables
      // configurable from state
      this.isShowing = false;
      this.$selector = $('body');
      this.displayKlass = 'show-activity-indicator';

      if (!this.browserSupportsCSSProperty('animation')) {
        this.$selector.addClass('activity-indicator-basic');
      }

      this.template = _.template(ActivityIndicatorTemplate);

      this.listenTo(this.state, 'showActivityLoader', this.showLoader, this);
      this.listenTo(this.state, 'hideActivityLoader', this.hideLoader, this);

      $('body').append(this.template);
    },

    showLoader: function() {
      if (this.isShowing) return;
      this.isShowing = true;
      this.$selector.addClass(this.displayKlass);
    },

    hideLoader: function() {
      if (!this.isShowing) return;
      this.isShowing = false;
      this.$selector.removeClass(this.displayKlass);
    },

    browserSupportsCSSProperty: function (propertyName) {
      var elm = document.createElement('div');
      propertyName = propertyName.toLowerCase();

      if (elm.style[propertyName] !== undefined)
        return true;

      var propertyNameCapital = propertyName.charAt(0).toUpperCase() + propertyName.substr(1),
        domPrefixes = 'Webkit Moz ms O'.split(' ');

      for (var i = 0; i < domPrefixes.length; i++) {
        if (elm.style[domPrefixes[i] + propertyNameCapital] !== undefined)
          return true;
      }

      return false;
    }
  });

  return ActivityIndicator;
});
