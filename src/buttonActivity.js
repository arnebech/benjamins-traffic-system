const EventEmitter = require('events').EventEmitter;
const util = require('util');

const ButtonActivity = function() {

  this.btnPresses = [];

  this.btnPressLimit = 300;

};

util.inherits(ButtonActivity, EventEmitter);

ButtonActivity.prototype.addButtonPress = function(light) {
  var time = Date.now();

  this.btnPresses.push({
    time: time,
    light: light
  });

  if (this.btnPresses.length > this.btnPressLimit) {
    this.btnPresses.shift();
  }

  this.emit('activity');

};

ButtonActivity.prototype.fillSampleData = function() {
  for (var i = 0; i < 100; i++) {
    var time = Date.now() - (Math.random() * 1000 * 60 * 60 * 8);
    this.btnPresses.push({
      time: Math.round(time),
      light: Math.random() > 0.5 ? 'red' : 'green'
    });
  }

  this.btnPresses.sort(function(a, b) {
    return a.time - b.time;
  });

};

ButtonActivity.prototype.getActivity = function() {
  return this.btnPresses;
};

const buttonActivity = new ButtonActivity();

// buttonActivity.fillSampleData();

module.exports = buttonActivity;
