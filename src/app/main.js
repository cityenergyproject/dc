require.config({
  paths: {
    jquery: '//ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min',
    underscore: '//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min',
    backbone: '//cdnjs.cloudflare.com/ajax/libs/backbone.js/1.2.1/backbone-min',
    d3: '//cdnjs.cloudflare.com/ajax/libs/d3/3.5.5/d3.min',
    ionrangeslider: '../lib/range-slider/ion.rangeSlider',
    selectize: '//cdnjs.cloudflare.com/ajax/libs/selectize.js/0.12.4/js/standalone/selectize.min',
    toastr: '../lib/toastr/toastr.min',
    store: '//cdnjs.cloudflare.com/ajax/libs/store.js/1.3.20/store.min',
    fusejs: '//cdnjs.cloudflare.com/ajax/libs/fuse.js/2.5.0/fuse.min',
    autocomplete: '../lib/autocomplete/autocomplete',
    templates: 'templates'
  },
  shim: {
    ionrangeslider: ['jquery'],
    toastr: ['jquery'],
    selectize: ['jquery'],
  }
});


require([
  'app',
], function(App){
  App.initialize();
});

