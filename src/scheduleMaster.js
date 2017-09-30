const conf = require('./conf');

const SleepSchedule = require('./SleepSchedule');
const CustomSchedule = require('./CustomSchedule');
const Scheduler = require('./StateScheduler');

const sleepSchedule = new SleepSchedule({
  greenStartTime: conf.get('sleep:greenStartTime'),
  greenEndTime: conf.get('sleep:greenEndTime'),
  hasYellow: conf.get('sleep:enableYellow'),
  yellowStartTime: conf.get('sleep:yellowStartTime'),
});

const scheduler = new Scheduler();

scheduler.addSchedule(sleepSchedule);

const startScheduler = function () {
  scheduler.run();
};

const startNap = function () {
  const napSchedule = new CustomSchedule({
    startIn: conf.get('nap:napDuration'),
    duration: conf.get('nap:greenDuration'),
    light: 'green',
    name: 'nap',
    priority: 1,
  });

  scheduler.addSchedule(napSchedule);
};

const startCustomSchedule = function (config) {
  const customSchedule = new CustomSchedule(config);
  scheduler.addSchedule(customSchedule);
};

const deleteScheduleById = function (scheduleId) {
  scheduler.removeScheduleById(scheduleId);
};

// scheduler.printToConsole();

module.exports = {
  scheduler,
  startScheduler,
  startNap,
  startCustomSchedule,
  deleteScheduleById,
};
