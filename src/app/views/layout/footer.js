define([
  'jquery',
  'underscore',
  'backbone',
  'text!templates/layout/footer.html'
], function($, _, Backbone, FooterTemplate){
  var Footer = Backbone.View.extend({
    initialize: function(options){
      this.state = options.state;
      this.listenTo(this.state, 'change:allbuildings', this.onBuildingsChange);
      this.template = _.template(FooterTemplate);

      this.scrolling = false;
      this.reveal = 100;
      this.lastScrollTop = 0;
      this.delta = 5;
      this.footer = $('#footer');

      var self = this;

      var autoHideFn = $.proxy(this.autoHideHeader, this);
      $(window).scroll(function(event){
          if( !self.scrolling ) {
            self.scrolling = true;
            (!window.requestAnimationFrame) ?
              setTimeout(autoHideFn, 250) :
              requestAnimationFrame(autoHideFn);
          }
      });

      this.render();
      this.autoHideHeader();
    },

    onBuildingsChange: function() {
      this.autoHideHeader();
    },

    autoHideHeader: function() {
      this.scrolling = false;

      var st = $(window).scrollTop();
      if(Math.abs(this.lastScrollTop - st) <= this.delta)
        return;

      if (st > this.reveal) {
        this.footer.removeClass('nav-up').addClass('nav-down');
      } else {
        this.footer.removeClass('nav-down').addClass('nav-up');
      }

      this.lastScrollTop = st;
    },

    render: function(){
      $('#footer').html(this.template());
      return this;
    }
  });

  return Footer;
});
