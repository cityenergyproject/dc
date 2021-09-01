define([
  'jquery',
  'underscore',
  'backbone',
  'd3',
  'text!templates/scorecards/links.html'
], function($, _, Backbone, d3, LinksTemplate){
  var LinksView = Backbone.View.extend({
    initialize: function(options){
      this.template = _.template(LinksTemplate);
      this.el = options.el;
      this.link_type = options.link_type;
      this.links_table = options.links_table;
      this.building = _.isFinite(options.building) ? +options.building : -1;
      this.active = true;
      this.load();
    },

    close: function() {
      this.active = false;
      this.el.html('');
      this.el = null;
    },

    active: function(x) {
      this.active = x;
    },

    load: function() {
      /**
       * Data for rendering.
       * Hardcoded, but it can be changed in the future
       */
      var data = {
        error: null,
        links: [
          {
            header: "The Building Innovation Hub ",
            link_href: "https://buildinginnovationhub.org/",
            link_txt: "CHECK OUT OUR WEBSITE FOR guidance on making improvements BUILDING(s)",
            txt: "helps building industry professionals in and around Washington, DC create and operate higher-performing buildings. The Hub has a suite of resources aimed to break down barriers to building improvements that support a healthy, resilient, financially, and socially vibrant DC.",
          },
          {
            header: "The DC Sustainable Energy Utility (DCSEU) ",
            link_href: "https://www.dcseu.com/bigger-savings-better-business-bottom-line",
            link_txt: "Schedule time AN Account Manager to get started",
            txt: "offers financial incentives and no-cost technical assistance to help commercial and multifamily property owners and managers save energy, save money, and run their buildings more efficiently.",
          },
          {
            header: "The DC Green Bank’s ",
            link_href: "https://dcgreenbank.com/products/",
            link_txt: "Check out the financial service offerings that can help you save from the DC Green Bank!",
            txt: "mission is to provide access to capital, growing the clean economy to develop a more equitable, resilient, and sustainable DC. We do this by offering innovative financing solutions that prioritize making the clean economy inclusive and affordable for all DC residents, businesses, and community institutions.",
          },
        ]
      }

      this.render(data);

    },

    render: function(data) {
      this.el.html(this.template(data));
    }
  });

  return LinksView;
});
