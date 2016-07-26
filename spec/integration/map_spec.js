var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until;

describe('Map', function() {
  var driver;

  beforeEach(function(done) {
    driver = new webdriver.Builder().forBrowser('chrome').build();
    done();
  });

  afterEach(function(done) {
    driver.quit().then(done);
  });

  describe("when a building is selected", function(){
    beforeEach(function(done) {
      driver.get('http://localhost:8080/#los_angeles/2014?building=3935251').then(done);
    });

    it('opens a popup when the row is clicked', function(done) {
      driver.wait(until.elementLocated(By.css('.leaflet-popup')), 10000);
      done();
    });
  })
});
