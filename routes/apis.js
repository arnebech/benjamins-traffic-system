const express = require('express');
const router = express.Router();
const lightState = require('./../src/lightState');
const schedule = require('./../src/scheduleMaster');
const buttonActivity = require('./../src/buttonActivity');

router.get('/light/state', function(req, res) {
  res.send(lightState.getState());  
});

router.post('/light/state', function(req, res) {
  var state = req.body;

  schedule.startCustomSchedule({
    startIn: state.startIn,
    duration: state.duration,
    turnedOn: state.turnedOn,
    light: state.light
  });

  res.send({status: 'ok'});  
});

router.post('/nap/start', function(req, res) {
  schedule.startNap();
  res.send({status: 'ok'});
});

router.post('/schedule/delete', function(req, res) {
  schedule.deleteScheduleById(req.body.id);
  res.send({status: 'ok'});
});

router.get('/schedule', function(req, res) {
  var segments = schedule.scheduler.getCurrentAndUpcomingSegments();
  res.send(segments);
});

router.get('/button-activity', function(req, res) {
  res.send(buttonActivity.getActivity());
});

module.exports = router;
