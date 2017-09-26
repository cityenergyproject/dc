define([
  'jquery',
  'underscore',
  'backbone',
  'text!templates/layout/modal.html'
], function($, _, Backbone, ModalTemplate){
  var ModalController = Backbone.View.extend({
    el: $('#modals'),

    initialize: function(options){
      this.state = options.state;

      this.listenTo(this.state, 'change:city', this.onCityChange);

      this.template = _.template(ModalTemplate);

      this.bodyEl = $('body');

      return this;
    },

    events: {
      'click #modal-close': 'onModalClose'
    },

    onModalClose: function(evt) {
      if (evt.preventDefault) evt.preventDefault();

      this.setModal(null);
    },

    onCityChange: function(){
      var model = this.state.get('modal');
      this.listenTo(model, 'change:selected', this.onModalChange);
      this.listenTo(model, 'change:viewdata', this.onViewDataChange);
      this.listenTo(model, 'sync', this.onModalSync,  this);
    },

    onModalSync: function() {
      var model = this.state.get('modal');
      // console.log('Sync: ', model);
    },

    onModalChange: function() {
      var model = this.state.get('modal');
      var selected  = model.get('selected');

      model.fetchViewData();
    },

    onViewDataChange: function() {
      var model = this.state.get('modal');
      var selected  = model.get('selected');
      var viewdata = model.get('viewdata');
      var props = model.modalProps();
      // console.log('onViewDataChange: ', model);
      // console.log('selected: ', selected);
      this.render(viewdata, props);
    },

    setModal: function(name) {
      var model = this.state.get('modal');
      var selected  = model.get('selected');

      if (name && selected !== name) {
        model.set({
          selected: name
        });
      } else {
        model.set({
          selected: null
        });
      }
    },

    render: function(data, props){
      this.$el.toggleClass('active', !!(data));
      this.bodyEl.toggleClass('modal-active', !!(data));

      if (!data) {
        this.$el.html('');
      } else {
        this.$el.html(this.template({
          rows: data || [],
          title: props.title || '',
          desc: props.desc || ''
        }));
      }
      return this;
    }
  });

  return ModalController;
});
