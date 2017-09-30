const EventEmitter = require('events').EventEmitter;
const util = require('util');

const LightState = function () {
  this.state = {
    light: 'red',
    on: false,
  };
};

util.inherits(LightState, EventEmitter);

LightState.prototype.setState = function (newState) {
  this.state = newState;
  this.emitState(this.getState());
};

LightState.prototype.emitState = function (state) {
  this.emit('state-changed', state);
};

LightState.prototype.forceOn = function (time) {
  this._clearForceOn();
  this.forceOnTimeout = setTimeout(this.clearForceOn.bind(this), time);
  this.emitState(this.getState());
};

LightState.prototype._clearForceOn = function () {
  if (this.forceOnTimeout !== false) {
    clearTimeout(this.forceOnTimeout);
    this.forceOnTimeout = false;
  }
};

LightState.prototype.clearForceOn = function () {
  this._clearForceOn();
  this.emitState(this.getState());
};

LightState.prototype.getState = function () {
  let state = this.state;

  if (this.forceOnTimeout) {
    state = JSON.parse(JSON.stringify(state));
    state.on = true;
  }

  return state;
};

LightState.prototype.getColor = function () {
  return this.getState().light;
};

const lightState = new LightState();

module.exports = lightState;
