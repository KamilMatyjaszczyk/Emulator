const assert = require('assert');

global.window = {};
global.GPU = {
    _vram: new Uint8Array(0x2000),
    _oam: new Uint8Array(0xA0),
    rb() {},
    wb() {},
    updatetile() {},
    buildobjdata() {}
};
global.TIMER = {
    _clock: {main: 0, sub: 0, div: 0},
    _reg: {div: 0, tima: 0, tma: 0, tac: 0},
    rb(address) {
        return this._reg[['div', 'tima', 'tma', 'tac'][address - 0xFF04]];
    },
    wb(address, value) {
        this._reg[['div', 'tima', 'tma', 'tac'][address - 0xFF04]] = value;
    }
};

require('../APU.js');
require('../key.js');
require('../MMU.js');

function makeROM(banks, type = 0x13, ramSize = 0x03) {
    const bytes = new Uint8Array(banks * 0x4000);
    for (let bank = 0; bank < banks; bank++) {
        bytes.fill(bank & 0xFF, bank * 0x4000, (bank + 1) * 0x4000);
    }
    bytes[0x0147] = type;
    bytes[0x0149] = ramSize;
    return bytes;
}

MMU.reset();
MMU.load(makeROM(64));
assert.equal(MMU._eram[0], 0xFF);

// Fixed and switchable ROM banks.
assert.equal(MMU.rb(0x0100), 0x00);
assert.equal(MMU.rb(0x4000), 0x01);
MMU.wb(0x2000, 0x02);
assert.equal(MMU.rb(0x4000), 0x02);
MMU.wb(0x2000, 0x00);
assert.equal(MMU.rb(0x4000), 0x01);
MMU.wb(0x2000, 0x40);
assert.equal(MMU.rb(0x4000), 0x00);

// External RAM must be enabled and invalid banks must not wrap.
assert.equal(MMU.rb(0xA000), 0xFF);
MMU.wb(0x0000, 0x0A);
MMU.wb(0x4000, 0x02);
MMU.wb(0xA123, 0x5A);
assert.equal(MMU.rb(0xA123), 0x5A);
assert.equal(MMU._saveDirty, true);
MMU.wb(0x4000, 0x06);
assert.equal(MMU.rb(0xA123), 0xFF);

// Cartridge RAM survives a machine reset and supports save import/export.
MMU.wb(0x4000, 0x00);
MMU.wb(0xA123, 0x5A);
const exportedSave = MMU.getSaveData();
assert.notStrictEqual(exportedSave, MMU._eram);
assert.equal(exportedSave[0x123], 0x5A);
MMU.reset();
assert.equal(MMU._eram[0x123], 0x5A);
MMU._eram[0x123] = 0;
MMU.setSaveData(exportedSave);
assert.equal(MMU._eram[0x123], 0x5A);
assert.equal(MMU._saveDirty, true);
assert.throws(
    () => MMU.setSaveData(new Uint8Array(1)),
    /Wrong save size/
);

// Work RAM and echo RAM mirror one another.
MMU.wb(0xC321, 0x42);
assert.equal(MMU.rb(0xE321), 0x42);
MMU.wb(0xFDFF, 0x77);
assert.equal(MMU.rb(0xDDFF), 0x77);

// 16-bit reads and writes are little-endian.
MMU.ww(0xC100, 0xBEEF);
assert.equal(MMU.rb(0xC100), 0xEF);
assert.equal(MMU.rb(0xC101), 0xBE);
assert.equal(MMU.rw(0xC100), 0xBEEF);

// Joypad selection bits are active low and upper bits always read high.
KEY.reset();
MMU.wb(0xFF00, 0x30);
assert.equal(MMU.rb(0xFF00), 0xFF);
MMU._if = 0;
KEY.press('a');
assert.equal(KEY._rows[0], 0x0E);
assert.equal(MMU._if & 0x10, 0);
MMU.wb(0xFF00, 0x10);
assert.equal(MMU._if & 0x10, 0x10);
KEY.release('a');
assert.equal(KEY._rows[0], 0x0F);
KEY._rows[0] = 0x0E;
MMU.wb(0xFF00, 0x10);
assert.equal(MMU.rb(0xFF00), 0xDE);
KEY._rows[1] = 0x0D;
MMU.wb(0xFF00, 0x00);
assert.equal(MMU.rb(0xFF00), 0xCC);

// Game keys should still work when a UI button has browser focus.
MMU._if = 0;
KEY.reset();
KEY.kdown({
    code: 'Enter',
    keyCode: 13,
    target: {tagName: 'BUTTON'},
    preventDefault() {
        this.prevented = true;
    }
});
assert.equal(KEY._rows[0], 0x07);
assert.equal(MMU._if & 0x10, 0x10);
KEY.kup({
    code: 'Enter',
    keyCode: 13,
    target: {tagName: 'BUTTON'},
    preventDefault() {}
});
assert.equal(KEY._rows[0], 0x0F);

// Serial transfers complete and request the serial interrupt.
MMU._if = 0;
MMU.wb(0xFF01, 0x12);
MMU.wb(0xFF02, 0x81);
assert.equal(MMU.rb(0xFF01), 0xFF);
assert.equal(MMU.rb(0xFF02) & 0x80, 0);
assert.equal(MMU._if & 0x08, 0x08);

// External-clock serial transfers do not complete instantly, then time out as
// an idle byte when no link partner is emulated.
MMU._if = 0;
MMU.wb(0xFF01, 0x34);
MMU.wb(0xFF02, 0x80);
assert.equal(MMU.rb(0xFF01), 0x34);
assert.equal(MMU.rb(0xFF02) & 0x80, 0x80);
assert.equal(MMU._if & 0x08, 0);
MMU.step(MMU._serialExternalTimeout - 4);
assert.equal(MMU.rb(0xFF02) & 0x80, 0x80);
assert.equal(MMU._if & 0x08, 0);
MMU.step(4);
assert.equal(MMU.rb(0xFF01), 0xFE);
assert.equal(MMU.rb(0xFF02) & 0x80, 0);
assert.equal(MMU._if & 0x08, 0x08);

// Audio registers are routed to the APU.
MMU.wb(0xFF26, 0x80);
MMU.wb(0xFF12, 0xF0);
MMU.wb(0xFF14, 0x80);
assert.equal(APU._channels[0].active, true);
assert.equal(MMU.rb(0xFF26) & 0x01, 0x01);

// OAM DMA copies 160 bytes.
for (let i = 0; i < 0xA0; i++) MMU.wb(0xC000 + i, i);
MMU.wb(0xFF46, 0xC0);
for (let i = 0; i < 0xA0; i++) assert.equal(GPU._oam[i], i);

// MBC3 RTC registers and latch behavior.
MMU.load(makeROM(4, 0x10, 0x03));
MMU.wb(0x0000, 0x0A);
MMU.wb(0x4000, 0x0C);
MMU.wb(0xA000, 0x40); // Halt clock.
MMU.wb(0x4000, 0x08);
MMU.wb(0xA000, 37);
MMU.wb(0x6000, 0);
MMU.wb(0x6000, 1);
assert.equal(MMU.rb(0xA000), 37);

// MBC1 supports lower ROM bank bits, upper ROM bank bits, and RAM banking mode.
MMU.load(makeROM(128, 0x03, 0x03));
assert.equal(MMU._mapper, 'MBC1');
assert.equal(MMU.rb(0x0100), 0x00);
assert.equal(MMU.rb(0x4000), 0x01);
MMU.wb(0x2000, 0x02);
assert.equal(MMU.rb(0x4000), 0x02);
MMU.wb(0x2000, 0x00);
assert.equal(MMU.rb(0x4000), 0x01);
MMU.wb(0x4000, 0x01);
assert.equal(MMU.rb(0x0100), 0x00);
assert.equal(MMU.rb(0x4000), 0x21);

MMU.wb(0x0000, 0x0A);
MMU.wb(0xA000, 0x11);
MMU.wb(0x6000, 0x01);
assert.equal(MMU.rb(0x0100), 0x20);
MMU.wb(0xA000, 0x22);
assert.equal(MMU.rb(0xA000), 0x22);
MMU.wb(0x6000, 0x00);
assert.equal(MMU.rb(0xA000), 0x11);

// MBC5 supports a 9-bit ROM bank number and up to 16 external RAM banks.
MMU.load(makeROM(512, 0x1B, 0x04));
assert.equal(MMU._mapper, 'MBC5');
assert.equal(MMU.rb(0x0100), 0x00);
assert.equal(MMU.rb(0x4000), 0x01);
MMU.wb(0x2000, 0x00);
assert.equal(MMU._switchableROMBank(), 0x00);
MMU.wb(0x2000, 0x34);
MMU.wb(0x3000, 0x01);
assert.equal(MMU._switchableROMBank(), 0x134);
MMU.wb(0x0000, 0x0A);
MMU.wb(0x4000, 0x0F);
MMU.wb(0xA000, 0x77);
assert.equal(MMU._eram[0x0F * 0x2000], 0x77);

console.log('MMU tests passed');
