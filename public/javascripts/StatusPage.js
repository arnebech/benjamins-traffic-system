// #### Util

var util = {};

util.request = function(url, options, callback) {
  options = options || {};
  var method = options.method || 'GET';
  method = method.toUpperCase();

  var req = new XMLHttpRequest();
  req.addEventListener("load", function(event) {
    if (!callback) {
      return;
    }
    var data = JSON.parse(req.responseText);
    callback(req, data);
  });

  req.open(method, url);

  if (options.data) {
    req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    req.send(JSON.stringify(options.data));
  } else {
    req.send();
  }

}

// #### Segment

var Segment = function(data) {
  this.data = data;
  this.event = data.event;

  this.activeSegment = false;
};

Segment.prototype.getTime = function() {
  return moment(this.data.time);
};

Segment.prototype.isCancelable = function() {
  return (this.event.type === 'custom' || this.event.type === 'nap');
};

Segment.prototype.isNonDefault = function() {
  return (this.event.type !== 'default');
};

Segment.prototype.types = {
  'nap': 'Nap Schedule',
  'sleep': 'Sleep Schedule',
  'default': 'Normal',
  'custom': 'Custom Schedule'
};

Segment.prototype.getHumanType = function() {
  return this.types[this.event.type] || this.event.type;
};

Segment.prototype.getHumanTime = function() {
  return moment(this.data.time).calendar();
};

Segment.prototype.getLight = function() {
  return this.event.state.light;
};

Segment.prototype.getClockTime = function() {

  if (this.activeSegment) {
    return 'Now';
  }

  return this.getTime().format('LT');
};

Segment.prototype.getDescription = function() {
  if (this.event.type === 'default') {
    return '';
  }
  return this.getHumanType();
}


// ####### Status Page

var StatusPage = function() {

  this.status = ko.observable({
    light: 'red',
    on: false
  });

  this.showMoreActions = ko.observable(false);

  this.allSchedule = ko.observableArray();
  this.groupedSchedule = ko.pureComputed(this.createGroupedSchedule, this);

  this.buttonActivity = ko.observableArray();

  this.selectedLightDuration = ko.observable(this.lightDurations[10]);
  this.selectedLightDelay = ko.observable(this.lightDurations[0]);
  this.selectedLightColor = ko.observable(this.lightColors[0]);
  this.selectedLightState = ko.observable(this.lightStates[1]);

  setInterval(this.updateSchedule.bind(this), 60000);
  setInterval(this.updateButtonActivity.bind(this), 60000);

  this.currentTime = ko.observable('');

  this.updateCurrentTime();
  setInterval(this.updateCurrentTime.bind(this), 1000);

  this.getInitialState();

};

StatusPage.prototype.updateCurrentTime = function() {
  var now = moment();
  this.currentTime(now.format('LT'));
};

StatusPage.prototype.createGroupedSchedule = function() {

  var schedule = this.allSchedule();
  if (!schedule.length) {
    return [];
  }

  var segments = schedule.slice(0);

  // var firstEvent = segments[0];
  // var firstEventTime = moment(firstEvent.at);

  var groups = [];
  var currentGroup = false;

  var startOfDay = moment('2000-01-01T00:00:00.000Z');
  var endOfDay = moment('2000-01-02T00:00:00.000Z');
  var eventTime;

  while (segment = segments.shift()) {
    segmentTime = segment.getTime();
    if (segmentTime.isSameOrAfter(startOfDay) && segmentTime.isSameOrBefore(endOfDay)) {
      currentGroup.segments.push(segment);
    } else {
      startOfDay = segmentTime.clone().startOf('day');
      endOfDay = segmentTime.clone().endOf('day');
      currentGroup = {
        day: startOfDay,
        segments: [segment],
        title: startOfDay.calendar(null, {
            sameDay: '[Today]',
            nextDay: '[Tomorrow]'
        })
      };
      groups.push(currentGroup);
    }
  };

  groups[0].today = true;
  groups[0].segments[0].activeSegment = true;


  groups.forEach(function(group) {
    var segments = [];

    var lastTime = group.day;

    group.segments.forEach(function(segment, index) {

      var hoursSinceLast = segment.getTime().diff(lastTime, 'hours', true);

      var isFirstSegmentOfToday = (index === 0 && group.today)

      if (hoursSinceLast > 3 && !isFirstSegmentOfToday) {
        segments.push({
          type: 'spacerSegment'
        });
      }

      segments.push(segment);

      lastTime = segment.getTime();

    });

    var endOfDay = group.day.clone().endOf('day');

    var hoursTilMidnight = endOfDay.diff(lastTime, 'hours', true);

    if (hoursTilMidnight > 3) {
      segments.push({
        type: 'spacerSegment'
      });
    }

    group.segments = segments;

  });

  return groups;

};

StatusPage.prototype.getInitialState = function() {
  util.request('/api/light/state', {}, function(response, data){
    this.status(data);
  }.bind(this));

  this.updateSchedule();

  this.updateButtonActivity();
};

StatusPage.prototype.updateSchedule = function() {
  util.request('/api/schedule', {}, function(response, data){

    data = data.map(function(segmentData) {
      return new Segment(segmentData);
    });

    this.allSchedule(data);

  }.bind(this));
};

StatusPage.prototype.updateButtonActivity = function() {
  util.request('/api/button-activity', {}, function(response, data){

    if (!data.length) {
      this.buttonActivity([]);
      return;
    }

    var now = moment(Math.max(Date.now(), data[data.length - 1].time));

    //always align to 5 min windows, so move up to closest 5 min window
    // 0:05, 0:10, 0:15...

    // 30:01 -> 34:59
    // 29:50 -> 29:59

    now.endOf('minute');

    var minutes = now.minutes();

    minutes = Math.ceil((minutes + 1) / 5);
    minutes = minutes * 5 - 1;

    now.minutes(minutes);

    // console.log(now.format('LTS'), moment().format('LTS'));

    var periods = [];
    var period;

    var timeIndex = now;

    for (var i = 0; i < 24; i++) {

      period = {
        end: timeIndex.valueOf(),
        start: timeIndex.subtract(5, 'minutes').valueOf(),
        activities: []
      }

      periods.unshift(period);

    }

    var activityIndex = 0;

    var activities = data;

    periods.forEach(function(period) {
      var activity = activities[activityIndex];
      // console.log(activity.time > period.start, activity.time < period.end);
      // console.log(moment(activity.time).format(), moment(period.start).format(), moment(period.end).format());
      // console.log(activity.time - period.start, period.end - activity.time);
      while (activity && activity.time < period.end) {

        if (activity.time > period.start) {
          period.activities.push(activity)
        }

        activityIndex++;
        activity = activities[activityIndex];
      }

    });

    var maxNum = 1;

    periods.forEach(function(period) {
      maxNum = Math.max(period.activities.length, maxNum);
    });

    periods.forEach(function(period, index) {
      period.count = period.activities.length;
      period.height = (period.count / maxNum * 100) + '%';

      var i = periods.length - index - 1;

      var humanPeriod = (i * 5) + ' - ' + ((i + 1) * 5) + ' minutes ago';
      
      period.title = 'Button Presses: ' + period.count + '\n' + 'Period: ' + humanPeriod;
    });

    var newPeriods = [];

    periods.reverse().forEach(function(period, index) {
      if (index === 0) {
        newPeriods.push({
          type: 'divider',
          label: 'Now'
        });
      } else if (index % 6 === 0) {
        newPeriods.push({
          type: 'divider',
          label: (index * 5) + ' m ago'
        });
      }

      newPeriods.push(period);

    });

    newPeriods.push({
      type: 'divider',
      label: (periods.length * 5) + ' m ago'
    });

    newPeriods.reverse();

    this.buttonActivity(newPeriods);

  }.bind(this));
};

StatusPage.prototype.getTrafficImgSrc = function() {
  var status = this.status();

  var state = '-' + status.light;

  if (!status.on) {
    state = state + '-off';
  }

  var src = 'images/lamp-graphic' + state + '.svg';

  return src;
};

StatusPage.prototype.startCustomSchedule = function() {

  var light = this.selectedLightColor().value;
  var duration = this.selectedLightDuration().value.valueOf();
  var delay = this.selectedLightDelay().value.valueOf();

  util.request('/api/light/state', {
    method: 'post',
    data: {
      light: light,
      startIn: delay,
      turnedOn: this.selectedLightState().value,
      duration: duration
    }
  })

  this.showMoreActions(false);
};

StatusPage.prototype.startNap = function() {
  util.request('/api/nap/start', {
    method: 'post'
  });
};

StatusPage.prototype.cancelSchedule = function(segment) {
  var scheduleId = segment.event.owner;
  util.request('/api/schedule/delete', {
    method: 'post',
    data: {
      id: scheduleId
    }
  });
};

StatusPage.prototype.lightDurations = [{
  name: 'Now',
  value: moment.duration(0, 'seconds')
}, {
  name: '1 minute',
  value: moment.duration(1, 'minutes')
}, {
  name: '2 minutes',
  value: moment.duration(2, 'minutes')
}, {
  name: '5 minutes',
  value: moment.duration(5, 'minutes')
}, {
  name: '10 minutes',
  value: moment.duration(10, 'minutes')
},  {
  name: '15 minutes',
  value: moment.duration(15, 'minutes')
}, {
  name: '30 minutes',
  value: moment.duration(30, 'minutes')
}, {
  name: '45 minutes',
  value: moment.duration(45, 'minutes')
}, {
  name: '1 hour',
  value: moment.duration(1, 'hours')
}, {
  name: '1 hour 30 min',
  value: moment.duration(90, 'minutes')
}, {
  name: '2 hours',
  value: moment.duration(2, 'hours')
}, {
  name: '4 hours',
  value: moment.duration(4, 'hours')
}];

StatusPage.prototype.lightColors = [{
  name: 'Green',
  value: 'green'
}, {
  name: 'Yellow',
  value: 'yellow'
}, {
  name: 'Red',
  value: 'red'
}];

StatusPage.prototype.lightStates = [{
  name: 'Force light on',
  value: true
}, {
  name: 'Light activated by button',
  value: false
}];


var statusPage = new StatusPage();


document.addEventListener("DOMContentLoaded", function(event) {
  ko.applyBindings(statusPage)
});


var socket = new WebSocket('ws://' + location.host + '/ws');

socket.onmessage = function(event) {
  var msg = JSON.parse(event.data);

  if (msg.type === 'light-change') {
    statusPage.status(msg.data);
    statusPage.updateSchedule();
  } else if (msg.type === 'button-activity') {
    statusPage.updateButtonActivity();
  } else {
    statusPage.updateSchedule();
  }

}