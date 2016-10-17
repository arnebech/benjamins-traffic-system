'use strict';

const moment = require('moment');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const conf = require('./conf');

const StateScheduler = function (argument) {

  this.schedules = [];

  this.lookAhead = { hours: 1 };

  this.defaultState = {
    light: 'red',
    turnedOn: false
  };

  this.lastEvent = {
    state: {}
  };

  this.isRunning = false;

};

util.inherits(StateScheduler, EventEmitter);

StateScheduler.prototype.addSchedule = function(schedule) {

  this.schedules.push(schedule);
  this.refresh();

  this.emit('schedule-change');
};

StateScheduler.prototype.removeScheduleById = function(scheduleId) {
  var length = this.schedules.length;
  this.schedules = this.schedules.filter(function(schedule) {
    return (schedule.id !== scheduleId);
  });

  if (length !== this.schedules.length) {
    this.refresh();
    this.emit('schedule-change');
    return true;
  }
};

StateScheduler.prototype.printToConsole = function(hours) {

  hours = hours || 24;

  console.log(`---- Schedule for next ${hours} hours at ${moment().format()} ---- `);

  var segments = this.getCurrentAndUpcomingSegments(
    moment.duration(hours, 'hours')
  );

  segments.forEach(function(item) {
    console.log(`${item.time.format()} - ${JSON.stringify(item.event.state)} - ${item.event.type}`);
  });

  console.log(`---- End Schedule ---- `);
};

StateScheduler.prototype.getSegmentsBetween = function(start, end) {
  var events = [{
    start: start.clone(),
    end: end.clone(),
    priority: -1,
    scheduleIndex: -1,
    type: 'default',
    state: this.defaultState
  }];

  this.schedules.forEach(function(schedule, index) {
    var scheduleEvents = schedule.getEventsBetween(start, end);
    scheduleEvents.forEach(function(event) {
      event.scheduleIndex = index;
    });

    events = events.concat(scheduleEvents);
  });

  // events = events.sort(function(a, b) {
  //   return a.start.valueOf() - b.start.valueOf();
  // });

  var timesMap = Object.create(null);

  events.forEach(function(event) {
    timesMap[event.start.valueOf()] = true;
    timesMap[event.end.valueOf()] = true;
  });

  var times = Object.keys(timesMap).sort(function(a, b) {
    return a - b;
  });

  var segments = times.map(function(time) {
    time = moment(parseInt(time, 10));

    var matchingEvents = events.filter(function(event) {
      return (event.start.isSameOrBefore(time) && event.end.isAfter(time));
    });

    matchingEvents.sort(function(a, b) {
      var sort = b.priority - a.priority;
      if (sort === 0) {
        sort = b.scheduleIndex - a.scheduleIndex;
      }

      if (sort === 0) {
        sort = a.start.valueOf() - b.start.valueOf();
      }

      return sort;
    });

    return {
      time: time,
      event: matchingEvents[0],
      matchingEvents: matchingEvents
    };
  });

  segments = segments.filter(function(segment) {
    return segment.time.isSameOrAfter(start);
  });

  segments = segments.filter(function(segment) {
    return segment.event;
  });

  segments = segments.filter(function(segment, index) {
    if (index === 0) {
      return true;
    }

    if (segment.event === segments[index - 1].event) {
      return false;
    }

    return true;
  });

  // segments.forEach(function(segment) {
  //   console.log(`Segment - Start: ${segment.time.format()}`)
  //   // console.log(segment.event.state);
  //   segment.matchingEvents.forEach(function(me) {
  //     console.log(me.state);
  //   })
  // });

  // events = this.applyDefaultsToEvents(events);

  //filter out defaults that are older
  // events = events.filter(function(event) {
  //   return event.at.isBefore(end);
  // });

  // console.log(segments);

  return segments;

};

StateScheduler.prototype.getCurrentAndUpcomingSegments = function(duration) {

  var now = moment();

  if (!duration) {

    let endOfNextDay = now.clone().endOf('day').add(1, 'day');
    duration = moment.duration(endOfNextDay.diff(now));
  }

  var start = now;
  var end = now.clone().add(duration);

  var segments = this.getSegmentsBetween(start, end);

  // segments = segments.filter(function(segment) {
  //   return segment.time.isAfter(now);
  // });

  // if (this.isStatesEqual(segments[0].event.state, this.lastEvent.state)) {
  //   segments.splice(0,1);
  // }

  return segments;

};

StateScheduler.prototype.run = function() {
  this.isRunning = true;
  this.onInterval();
};

StateScheduler.prototype.clearTimeout = function() {
  if (this.timer !== false) {
    clearTimeout(this.timer);
    this.timer = false;
  }
};

StateScheduler.prototype.refresh = function() {
  if (!this.isRunning) {
    return;
  }

  this.onInterval();
};

StateScheduler.prototype.isStatesEqual = function(a, b) {
  return (JSON.stringify(a) === JSON.stringify(b));
};

StateScheduler.prototype.isEventsEqual = function(a, b) {
  return (JSON.stringify(a) === JSON.stringify(b));
};

StateScheduler.prototype.executeEvent = function(event) {

  if (this.isEventsEqual(event, this.lastEvent)) {
    return;
  }

  // console.log('executeEvent');
  this.emit('event-change', event);

  this.executeState(event.state);

  // must be after execute state
  this.lastEvent = event;

};

StateScheduler.prototype.executeState = function(state) {
  if (this.isStatesEqual(state, this.lastEvent.state)) {
    return;
  }

  // console.log('executeState', state);
  this.emit('state-change', state);
};

StateScheduler.prototype.onInterval = function() {

  this.removeOldSchedules();

  var now = moment();
  var start = now.clone();
  var end = now.clone().add(this.lookAhead);

  var segments = this.getSegmentsBetween(start, end);

  // console.log('got segments: ', segments.length, start.format(), end.format());

  var currentSegment = segments[0];
  var currentEvent = currentSegment.event;

  var nextCheckTime;

  if (segments.length > 1) {
    nextCheckTime = segments[1].time;
  } else {
    nextCheckTime = now.clone().add(this.lookAhead);
  }

  this.executeEvent(currentEvent);

  var interval = nextCheckTime.valueOf() - moment().valueOf();

  if (interval < 0) {
    console.log('**** CRASHING *****');
    console.log(now.format());
    console.log(segments);
    process.exit();
  }

  var mins = nextCheckTime.diff(moment(), 'minutes');

  console.log(`Scheduler: next check in ${mins} minutes (${interval}ms)`);

  this.clearTimeout();

  this.timer = setTimeout(function() {
    this.onInterval();
  }.bind(this), interval);
};

StateScheduler.prototype.removeOldSchedules = function() {
  this.schedules = this.schedules.filter(function(schedule) {
    return schedule.isActive();
  });
};

module.exports = StateScheduler;
