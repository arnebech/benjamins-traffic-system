const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const scheduleMaster = require('./src/scheduleMaster');
const lightState = require('./src/lightState');
const notifications = require('./src/notifications');
const conf = require('./src/conf');
const btnActivity = require('./src/buttonActivity');

const gpio = require('./src/gpio');

const routes = require('./routes/index');
const apis = require('./routes/apis');

const app = express();

app.setupBroadcastButtonActivity = function(wss) {
  btnActivity.on('activity', function() {
    wss.broadcast('button-activity');
  });
};

app.ligthStateChangeHandler = function(wss) {
  var lastColor = false;

  lightState.on('state-changed', function(newState) {
    wss.broadcast('light-change', newState);

    if (newState.on) {
      gpio.setLightState(newState.light);
    } else {
      gpio.setLightState('off');
    }

    var newColor = newState.light;

    if (lastColor !== newColor && newColor === 'green') {
      notifications.send('green_on');
    }

    lastColor = newState.light;

  });
};

app.setupBroadcastScheduleChange = function(wss) {
  scheduleMaster.scheduler.on('schedule-change', function() {
    wss.broadcast('schedule-change');
  });
};

app.setupSchedulerChangeHandler = function() {
  scheduleMaster.scheduler.on('state-change', function(state) {

    console.log(`*********** Changed Light: ${state.light} *************`);

    lightState.setState({
      light: state.light,
      on: state.turnedOn //TODO: change 'on' to 'turnedOn'
    });

  });
};

app.setupButtonPressHandler = function() {
  var btnPressedNotificationSent = false;
  var btnPressedNotifcationPeriod = conf.get('button:throttleDurationMins') * 60 * 1000;
  var btnPressTimer = false;
  var lastColor = false;

  gpio.onButtonPress(function() {

    lightState.forceOn(conf.get('button:onDurationMs'));

    btnActivity.addButtonPress();

    if (!btnPressedNotificationSent || lastColor !== lightState.getColor()) {

      lastColor = lightState.getColor();

      notifications.send('button_pressed');
      btnPressedNotificationSent = true;

      if (btnPressTimer !== false) {
        clearTimeout(btnPressTimer);
        btnPressTimer = false;
      }

      btnPressTimer = setTimeout(function() {
        btnPressedNotificationSent = false;
      }, btnPressedNotifcationPeriod);
    }

  }, this);

};

//sort of ugly pattern, express generator less suited for websocket integration?
app.setupWebsocket = function(wss) {

  app.setupBroadcastButtonActivity(wss);

  app.ligthStateChangeHandler(wss);

  app.setupBroadcastScheduleChange(wss);

  app.setupSchedulerChangeHandler();

  app.setupButtonPressHandler();

  scheduleMaster.startScheduler();

};

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/api', apis);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
