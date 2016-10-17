const express = require('express');
const moment = require('moment');

const scheduleMaster = require('./../src/scheduleMaster');
const router = express.Router();
const conf = require('./../src/conf');

var napDuration = moment.duration(conf.get('nap:napDuration'));
napDuration = `${napDuration.hours()}h ${napDuration.minutes()}m`;

router.get('/', function(req, res, next) {

  res.render('index', { 
    title: 'BTS',
    napDuration: napDuration
  });
});

module.exports = router;
