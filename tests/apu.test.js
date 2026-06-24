const assert = require('assert');

require('../APU.js');

APU.reset();
assert.equal(APU.rb(0xFF26) & 0x80, 0x80);

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
