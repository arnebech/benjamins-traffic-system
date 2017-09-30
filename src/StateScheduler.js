

const moment = require('moment');
const { EventEmitter } = require('events');
const util = require('util');

const StateScheduler = function () {
  this.schedules = [];

  this.lookAhead = { hours: 1 };

  this.defaultState = {
    light: 'red',
    turnedOn: false,
  };

  this.lastEvent = {
    state: {},
  };

  this.isRunning = false;
};

util.inherits(StateScheduler, EventEmitter);

StateScheduler.prototype.addSchedule = function (schedule) {
  this.schedules.push(schedule);
  this.refresh();

  this.emit('schedule-change');
};

StateScheduler.prototype.removeScheduleById = function (scheduleId) {
  const length = this.schedules.length;
  this.schedules = this.schedules.filter(schedule => (schedule.id !== scheduleId));

  if (length !== this.schedules.length) {
    this.refresh();
    this.emit('schedule-change');
    return true;
  }
  return false;
};

StateScheduler.prototype.printToConsole = function (hours) {
  hours = hours || 24;

  console.log(`---- Schedule for next ${hours} hours at ${moment().format()} ---- `);

  const segments = this.getCurrentAndUpcomingSegments(moment.duration(hours, 'hours'));

  segments.forEach((item) => {
    console.log(`${item.time.format()} - ${JSON.stringify(item.event.state)} - ${item.event.type}`);
  });

  console.log('---- End Schedule ---- ');
};

StateScheduler.prototype.getSegmentsBetween = function (start, end) {
  let events = [{
    start: start.clone(),
    end: end.clone(),
    priority: -1,
    scheduleIndex: -1,
    type: 'default',
    state: this.defaultState,
  }];

  this.schedules.forEach((schedule, index) => {
    const scheduleEvents = schedule.getEventsBetween(start, end);
    scheduleEvents.forEach((event) => {
      event.scheduleIndex = index;
    });

    events = events.concat(scheduleEvents);
  });

  // events = events.sort(function(a, b) {
  //   return a.start.valueOf() - b.start.valueOf();
  // });

  const timesMap = Object.create(null);

  events.forEach((event) => {
    timesMap[event.start.valueOf()] = true;
    timesMap[event.end.valueOf()] = true;
  });

  const times = Object.keys(timesMap).sort((a, b) => a - b);

  let segments = times.map((time) => {
    time = moment(parseInt(time, 10));

    const matchingEvents = events.filter(event =>
      (event.start.isSameOrBefore(time) && event.end.isAfter(time)));

    matchingEvents.sort((a, b) => {
      let sort = b.priority - a.priority;
      if (sort === 0) {
        sort = b.scheduleIndex - a.scheduleIndex;
      }

      if (sort === 0) {
        sort = a.start.valueOf() - b.start.valueOf();
      }

      return sort;
    });

    return {
      time,
      event: matchingEvents[0],
      matchingEvents,
    };
  });

  segments = segments.filter(segment => segment.time.isSameOrAfter(start));

  segments = segments.filter(segment => segment.event);

  segments = segments.filter((segment, index) => {
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

  // filter out defaults that are older
  // events = events.filter(function(event) {
  //   return event.at.isBefore(end);
  // });

  // console.log(segments);

  return segments;
};

StateScheduler.prototype.getCurrentAndUpcomingSegments = function (duration) {
  const now = moment();

  if (!duration) {
    const endOfNextDay = now.clone().endOf('day').add(1, 'day');
    duration = moment.duration(endOfNextDay.diff(now));
  }

  const start = now;
  const end = now.clone().add(duration);

  const segments = this.getSegmentsBetween(start, end);

  // segments = segments.filter(function(segment) {
  //   return segment.time.isAfter(now);
  // });

  // if (this.isStatesEqual(segments[0].event.state, this.lastEvent.state)) {
  //   segments.splice(0,1);
  // }

  return segments;
};

StateScheduler.prototype.run = function () {
  this.isRunning = true;
  this.onInterval();
};

StateScheduler.prototype.clearTimeout = function () {
  if (this.timer !== false) {
    clearTimeout(this.timer);
    this.timer = false;
  }
};

StateScheduler.prototype.refresh = function () {
  if (!this.isRunning) {
    return;
  }

  this.onInterval();
};

StateScheduler.prototype.isStatesEqual = function (a, b) {
  return (JSON.stringify(a) === JSON.stringify(b));
};

StateScheduler.prototype.isEventsEqual = function (a, b) {
  return (JSON.stringify(a) === JSON.stringify(b));
};

StateScheduler.prototype.executeEvent = function (event) {
  if (this.isEventsEqual(event, this.lastEvent)) {
    return;
  }

  // console.log('executeEvent');
  this.emit('event-change', event);

  this.executeState(event.state);

  // must be after execute state
  this.lastEvent = event;
};

StateScheduler.prototype.executeState = function (state) {
  if (this.isStatesEqual(state, this.lastEvent.state)) {
    return;
  }

  // console.log('executeState', state);
  this.emit('state-change', state);
};

StateScheduler.prototype.onInterval = function () {
  this.removeOldSchedules();

  const now = moment();
  const start = now.clone();
  const end = now.clone().add(this.lookAhead);

  const segments = this.getSegmentsBetween(start, end);

  // console.log('got segments: ', segments.length, start.format(), end.format());

  const currentSegment = segments[0];
  const currentEvent = currentSegment.event;

  let nextCheckTime;

  if (segments.length > 1) {
    nextCheckTime = segments[1].time;
  } else {
    nextCheckTime = now.clone().add(this.lookAhead);
  }

  this.executeEvent(currentEvent);

  const interval = nextCheckTime.valueOf() - moment().valueOf();

  if (interval < 0) {
    console.log('**** CRASHING *****');
    console.log(now.format());
    console.log(segments);
    process.exit();
  }

  const mins = nextCheckTime.diff(moment(), 'minutes');

  console.log(`Scheduler: next check in ${mins} minutes (${interval}ms)`);

  this.clearTimeout();

  this.timer = setTimeout(() => {
    this.onInterval();
  }, interval);
};

StateScheduler.prototype.removeOldSchedules = function () {
  this.schedules = this.schedules.filter(schedule => schedule.isActive());
};

module.exports = StateScheduler;
