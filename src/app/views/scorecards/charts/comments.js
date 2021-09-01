define([
  'jquery',
  'underscore',
  'backbone',
  'text!templates/scorecards/charts/comments.html'
], function($, _, Backbone, CommentTemplate){
  var CommentView = Backbone.View.extend({
    className: 'comment-view',

    initialize: function(options){
      this.template = _.template(CommentTemplate);
      this.building = options.building;
    },

    validNumber: function(x) {
      return _.isNumber(x) && _.isFinite(x);
    },

    render: function(cb){
      cb(this.template({
        comments: this.building.comments
      }));
    }
  });

  return CommentView;
});
