const assert = require('assert');

const memory = new Uint8Array(0x10000);

global.MMU = {
    _ie: 0,
    _if: 0,
    _inbios: 0,
    rb(address) {
        return memory[address & 0xFFFF];
    },
    wb(address, value) {
        memory[address & 0xFFFF] = value & 0xFF;
    }
};

global.GPU = {step() {}};

require('../z80.js');

function prepare(bytes, address = 0x0100) {
    memory.fill(0);
    MMU._ie = 0;
    MMU._if = 0;
    Z80.reset();
    Z80._r.pc = address;
    memory.set(bytes, address);
}

function execute(count = 1) {
    for (let i = 0; i < count; i++) Z80.exec();
}

// Boot-ROM-skipping reset state.
prepare([]);
assert.equal(Z80._r.pc, 0x0100);
assert.equal(Z80._r.sp, 0xFFFE);
assert.equal(Z80._r.a, 0x01);
assert.equal(Z80._r.f, 0xB0);

// ADD A,d8: zero, half-carry and carry.
prepare([0x3E, 0xFF, 0xC6, 0x01]);
execute(2);
assert.equal(Z80._r.a, 0x00);
assert.equal(Z80._r.f, 0xB0);

// INC preserves carry and sets half-carry.
prepare([0x06, 0x0F, 0x04]);
Z80._r.f = 0x10;
execute(2);
assert.equal(Z80._r.b, 0x10);
assert.equal(Z80._r.f, 0x30);

// DAA after 0x09 + 0x01 gives packed BCD 0x10.
prepare([0x3E, 0x09, 0xC6, 0x01, 0x27]);
execute(3);
assert.equal(Z80._r.a, 0x10);
assert.equal(Z80._r.f, 0x00);

// CALL and RET use the Game Boy stack byte order.
prepare([0xCD, 0x08, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC9]);
const initialSP = Z80._r.sp;
execute();
assert.equal(Z80._r.pc, 0x0108);
assert.equal(Z80._r.sp, initialSP - 2);
assert.equal(memory[initialSP - 2], 0x03);
assert.equal(memory[initialSP - 1], 0x01);
execute();
assert.equal(Z80._r.pc, 0x0103);
assert.equal(Z80._r.sp, initialSP);

// Conditional JR consumes its offset both when taken and not taken.
prepare([0x18, 0x02, 0x00, 0x00]);
execute();
assert.equal(Z80._r.pc, 0x0104);
assert.equal(Z80._r.t, 12);

prepare([0x20, 0x02, 0x00, 0x00]);
Z80._r.f = 0x80;
execute();
assert.equal(Z80._r.pc, 0x0102);
assert.equal(Z80._r.t, 8);

prepare([0x20, 0x02, 0x00, 0x00]);
Z80._r.f = 0x00;
execute();
assert.equal(Z80._r.pc, 0x0104);
assert.equal(Z80._r.t, 12);

// CB BIT/RES/SET, including the previously failing CB 0x87 (RES 0,A).
prepare([0xCB, 0x87, 0xCB, 0xC7, 0xCB, 0x7F]);
Z80._r.a = 0x01;
execute();
assert.equal(Z80._r.a, 0x00);
execute();
assert.equal(Z80._r.a, 0x01);
Z80._r.f = 0x10;
execute();
assert.equal(Z80._r.f, 0xB0);

// EI enables interrupts after the following instruction.
prepare([0xFB, 0x00, 0x00]);
execute();
assert.equal(Z80._r.ime, 0);
execute();
assert.equal(Z80._r.ime, 1);

MMU._ie = 0x01;
MMU._if = 0x01;
const interruptReturn = Z80._r.pc;
execute();
assert.equal(Z80._r.pc, 0x0040);
assert.equal(Z80._r.ime, 0);
assert.equal(MMU._if & 0x01, 0);
assert.equal(memory[Z80._r.sp], interruptReturn & 0xFF);

// Every opcode entry exists; only documented illegal opcodes throw as illegal.
const illegal = new Set([
    0xD3, 0xDB, 0xDD, 0xE3, 0xE4, 0xEB,
    0xEC, 0xED, 0xF4, 0xFC, 0xFD
]);

for (let opcode = 0; opcode < 0x100; opcode++) {
    assert.equal(typeof Z80._map[opcode], 'function');
    assert.equal(typeof Z80._cbmap[opcode], 'function');

    prepare([opcode, 0x00, 0x00]);
    let threwIllegal = false;
    try {
        execute();
    } catch (error) {
        threwIllegal = /Illegal Game Boy opcode/.test(error.message);
        if (!threwIllegal) throw error;
    }
    assert.equal(threwIllegal, illegal.has(opcode), `opcode 0x${opcode.toString(16)}`);
}

console.log('Z80 tests passed');
