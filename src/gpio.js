const conf = require('./conf');
const ButtonDebouncer = require('./ButtonDebouncer');

const gpioEnabled = conf.get('gpio:enabled');

if (!gpioEnabled) {
  module.exports = {
    setLightState: function(state) {
      console.log(`set light state to ${state}`);
    },

    onButtonPress: function(cb, scope) {

      var debouncer = new ButtonDebouncer();

      debouncer.on('state-change', function(state) {
        if (state) {
          cb.apply(scope);
        }
      });

      // setInterval(function() {
      //   // cb.apply(scope);
      //   debouncer.onChange(true);
      //   setTimeout(function(){
      //     debouncer.onChange(false);
      //   }, 100);
      // }, 3000);

    }
  };

} else {

  const rpio = require('rpio');

  /*

  left side

  16 - red
  32 - button light pwm
  36 - button input, pull-up

  right side

  11 - buzzer
  13 - green
  15 - yellow

  */

  const RED_PIN = 16;
  const YELLOW_PIN = 15;
  const GREEN_PIN = 13;
  const BUZZER_PIN = 11;

  const BTN_LIGHT_PIN = 32;
  const BTN_INPUT_PIN = 36;

  rpio.open(RED_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.open(YELLOW_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.open(GREEN_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.open(BUZZER_PIN, rpio.OUTPUT, rpio.LOW);
  rpio.open(BTN_LIGHT_PIN, rpio.OUTPUT, rpio.LOW);

  rpio.open(BTN_INPUT_PIN, rpio.INPUT, rpio.PULL_UP);

  var gpio = {
    stateToPin: {
      red: RED_PIN,
      yellow: YELLOW_PIN,
      green: GREEN_PIN,
      buzzer: BUZZER_PIN
    },
    init: function() {

      var debouncer = new ButtonDebouncer();

      this.debouncer = debouncer;

      rpio.poll(BTN_INPUT_PIN, function() {
        this.debouncer.onChange(!rpio.read(BTN_INPUT_PIN));
      }.bind(this));
    },

    setLightState: function(state) {
      rpio.write(RED_PIN, rpio.LOW);
      rpio.write(YELLOW_PIN, rpio.LOW);
      rpio.write(GREEN_PIN, rpio.LOW);
      rpio.write(BUZZER_PIN, rpio.LOW);
      rpio.write(BTN_LIGHT_PIN, rpio.LOW);

      var pin = this.stateToPin[state];
      if (pin === undefined) {
        return;
      }

      console.log(`GPIO: turn on: ${state}`);

      rpio.write(pin, rpio.HIGH);

    },

    onButtonPress: function(cb, scope) {

      this.debouncer.on('state-change', function(state) {
        if (state) {
          console.log('Button press');
          cb.apply(scope);
        }
      });
    }
  };

  gpio.init();
  gpio.setLightState('off');

  module.exports = gpio;
}
