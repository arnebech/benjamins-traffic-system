const EventEmitter = require('events').EventEmitter;
const util = require('util');

/*

Two goals
- Debounce
- Elimnate false-positives (e.g. turning on ceiling fan creates triggers gpio)
*/

// basic state machine
const STATE_OFF = 0;
const STATE_TURNING_ON = 1;
const STATE_TURNING_OFF = 2;
const STATE_ON = 3;

const BTN_STATE_ON = true;
const BTN_STATE_OFF = false;

const ButtonDebouncer = function() {

  this.state = false;
  this.internalState = STATE_OFF;

  this.lastButtonState = BTN_STATE_OFF;

  this.debounceOnDelay = 25;
  this.debounceOffDelay = 25;

  this.offTimer = false;

};

util.inherits(ButtonDebouncer, EventEmitter);

ButtonDebouncer.prototype.setState = function(state) {
  if (this.state === state) {
    return;
  }

  this.emit('state-change', state);
  this.state = state;
};

ButtonDebouncer.prototype.setInternalState = function(internalState) {
  if (this.internalState === internalState) {
    return;
  }

  this.internalState = internalState;

  if (this.internalState === STATE_OFF) {
    this.setState(false);
  } else if (this.internalState === STATE_ON) {
    this.setState(true);
  }

};

ButtonDebouncer.prototype.clearOffTimer = function() {
  if (this.offTimer !== false) {
    clearTimeout(this.offTimer);
    this.offTimer = false;
  }
};

ButtonDebouncer.prototype.onChange = function(buttonState) {

  if (buttonState === this.lastButtonState) {
    return;
  }

  this.lastButtonState = buttonState;

  if (this.internalState === STATE_OFF && buttonState === BTN_STATE_ON) {
    this.setInternalState(STATE_TURNING_ON);
    setTimeout(function() {
      if (this.lastButtonState === BTN_STATE_ON) {
        this.setInternalState(STATE_ON);
      } else {
        this.setInternalState(STATE_OFF);
      }
    }.bind(this), this.debounceOnDelay);
  }

  if ((this.internalState === STATE_ON || this.internalState === STATE_ON) &&
      buttonState === BTN_STATE_OFF) {

    this.clearOffTimer();

    this.setInternalState(STATE_TURNING_OFF);
    this.offTimer = setTimeout(function() {

      this.clearOffTimer();

      if (this.lastButtonState === BTN_STATE_OFF) {
        this.setInternalState(STATE_OFF);
      } else {
        this.setInternalState(STATE_ON);
      }

    }.bind(this), this.debounceOffDelay);
  }

};

module.exports = ButtonDebouncer;
