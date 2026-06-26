const assert = require('assert');

global.document = {
    getElementById() {
        return null;
    }
};

require('../GPU.js');

GPU.reset();

assert.equal(GPU.rb(0xFF40), 0x91);
assert.equal(GPU.rb(0xFF47), 0xFC);
assert.equal(GPU.rb(0xFF48), 0xFF);
assert.equal(GPU.rb(0xFF49), 0xFF);
assert.equal(GPU._mode, 2);

global.MMU = {_if: 0};
GPU.wb(0xFF41, 0x40);
assert.equal(MMU._if & 0x02, 0x02);

MMU._if = 0;
GPU._mode = 0;
GPU.wb(0xFF41, 0x08);
assert.equal(MMU._if & 0x02, 0x02);

console.log('GPU tests passed');
