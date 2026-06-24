const assert = require('assert');

require('../APU.js');

APU.reset();
assert.equal(APU.rb(0xFF26) & 0x80, 0x80);

// Browser-level volume and mute do not modify emulated APU registers.
APU._masterGain = {gain: {value: 0}};
APU._context = null;
APU.setVolume(0.75);
assert.equal(APU._userVolume, 0.75);
assert.ok(Math.abs(APU._masterGain.gain.value - 0.15) < 0.000001);
APU.setVolume(2);
assert.equal(APU._userVolume, 1);
APU.setMuted(true);
assert.equal(APU._masterGain.gain.value, 0);
assert.equal(APU.toggleMuted(), false);
APU._masterGain = null;

// Trigger pulse channel 1 with a 50% duty cycle and full volume.
APU.wb(0xFF11, 0x80);
APU.wb(0xFF12, 0xF0);
APU.wb(0xFF13, 0x00);
APU.wb(0xFF14, 0xC4);
assert.equal(APU._channels[0].active, true);
assert.equal(APU._channels[0].volume, 15);
assert.equal(APU.rb(0xFF26) & 0x01, 0x01);

// A one-tick length expires on the next 256 Hz length clock.
APU.wb(0xFF11, 0xBF);
APU.wb(0xFF14, 0xC4);
APU.step(8192);
assert.equal(APU._channels[0].active, false);

// Powering the APU off clears and disables both pulse channels.
APU.wb(0xFF26, 0x00);
assert.equal(APU.rb(0xFF26) & 0x80, 0);
assert.equal(APU._channels[0].active, false);
assert.equal(APU._channels[1].active, false);

console.log('APU tests passed');
