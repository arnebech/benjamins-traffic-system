const moment = require('moment');

let idCounter = 0;

const CustomSchedule = function (config) {
  config = config || {};

  config.name = config.name || 'custom';
  config.turnedOn = config.turnedOn || false;
  config.priority = config.priority || 10;

  console.assert(config.light, 'Must have light specificed');
  console.assert(config.startIn !== undefined, 'Must have startIn specificed');
  console.assert(config.duration, 'Must have specified and non-zero duration');

  this.config = config;

  this.light = config.light;
  this.turnedOn = config.turnedOn;
  this.startTime = moment().add(moment.duration(config.startIn || 0));
  this.endTime = this.startTime.clone().add(moment.duration(config.duration));

  this.id = `${config.name}_${idCounter}`;

  idCounter += 1;

  // console.log('CREATING CUSTOM CustomSchedule');
  // console.log(this.startTime.format());
  // console.log(this.endTime.format());
};

CustomSchedule.prototype.isActive = function () {
  return moment().isSameOrBefore(this.endTime);
};

CustomSchedule.prototype.getEventsBetween = function (start, end) {
  if (this.startTime.isBefore(end) && this.endTime.isSameOrAfter(start)) {
    return [{
      start: this.startTime,
      end: this.endTime,
      priority: 10,
      type: this.config.name,
      owner: this.id,
      state: {
        light: this.light,
        turnedOn: this.turnedOn,
      },
    }];
  }

  return [];
};

module.exports = CustomSchedule;
