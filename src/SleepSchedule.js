const moment = require('moment');

var idCounter = 0;

var SleepSchedule = function(config) {
  config = config || {};
  this.greenStart = moment.duration(config.greenStartTime);
  this.greenEnd = moment.duration(config.greenEndTime);

  this.id = 'sleep_' + idCounter++;
};

SleepSchedule.prototype.isActive = function() {
  return true;
};

SleepSchedule.prototype.getEventsBetween = function(start, end) {

  var startDay = start.clone().startOf('day');
  var endDay = end.clone().add(1, 'day').startOf('day');

  var extendedDuration = moment.duration(endDay.diff(startDay));

  var daysNum = extendedDuration.days();

  var dayIndex = 0;
  var events = [];
  var day;
  var greenStartTime;
  var greenEndTime;
  for (dayIndex = 0; dayIndex < daysNum; dayIndex++) {

    day = startDay.clone().add(dayIndex, 'days');

    greenStartTime = day.clone().add(this.greenStart);
    greenEndTime = day.clone().add(this.greenEnd);

    if (greenStartTime.isBefore(end) && greenEndTime.isAfter(start)) {
      events.push({
        start: greenStartTime,
        end: greenEndTime,
        priority: 0,
        type: 'sleep',
        owner: this.id,
        state: {
          light: 'green',
          turnedOn: false
        }
      });
    }
  }

  // events.forEach(function(item) {
  //   console.log(`${item.at.format()} - ${item.to}`);
  // });

  return events;

};

module.exports = SleepSchedule;
