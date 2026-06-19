/*
 * Sharp LR35902 CPU core used by the Nintendo Game Boy.
 *
 * The processor is often called a Z80, but it is not instruction-compatible
 * with a complete Z80. This core implements all 256 primary opcodes and all
 * 256 CB-prefixed opcodes used by the Game Boy.
 */

Z80 = {
    _r: {
        a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0, f: 0,
        pc: 0, sp: 0, i: 0, r: 0,
        m: 0, t: 0,
        ime: 0
    },

    _clock: {m: 0, t: 0},
    _halt: 0,
    _stop: 0,
    _imeDelay: 0,
    _map: new Array(256),
    _cbmap: new Array(256),

    reset: function() {
        // Register values after the original DMG boot ROM has completed.
        Z80._r.a = 0x01;
        Z80._r.f = 0xB0;
        Z80._r.b = 0x00;
        Z80._r.c = 0x13;
        Z80._r.d = 0x00;
        Z80._r.e = 0xD8;
        Z80._r.h = 0x01;
        Z80._r.l = 0x4D;
        Z80._r.sp = 0xFFFE;
        Z80._r.pc = 0x0100;
        Z80._r.i = 0;
        Z80._r.r = 0;
        Z80._r.m = 0;
        Z80._r.t = 0;
        Z80._r.ime = 0;

        Z80._halt = 0;
        Z80._stop = 0;
        Z80._imeDelay = 0;
        Z80._clock.m = 0;
        Z80._clock.t = 0;

        if (typeof MMU !== 'undefined') {
            MMU._inbios = 0;
        }
    },

    exec: function() {
        var pending = ((MMU._ie || 0) & (MMU._if || 0)) & 0x1F;

        if (pending) {
            Z80._halt = 0;
            Z80._stop = 0;

            if (Z80._r.ime) {
                Z80._serviceInterrupt(pending);
                Z80._finishInstruction();
                return;
            }
        }

        if (Z80._halt || Z80._stop) {
            Z80._r.m = 1;
            Z80._r.t = 4;
            Z80._finishInstruction();
            return;
        }

        var address = Z80._r.pc;
        var opcode = Z80._read8(address);
        Z80._r.pc = (address + 1) & 0xFFFF;
        Z80._r.r = (Z80._r.r + 1) & 0x7F;

        var operation = Z80._map[opcode];
        if (typeof operation !== 'function') {
            throw new Error(
                'Invalid opcode 0x' + Z80._hex(opcode, 2) +
                ' at 0x' + Z80._hex(address, 4)
            );
        }

        operation();
        Z80._finishInstruction();
    },

    _finishInstruction: function() {
        Z80._r.f &= 0xF0;
        Z80._r.pc &= 0xFFFF;
        Z80._r.sp &= 0xFFFF;
        Z80._clock.m += Z80._r.m;
        Z80._clock.t += Z80._r.t;

        if (Z80._imeDelay > 0) {
            Z80._imeDelay--;
            if (Z80._imeDelay === 0) {
                Z80._r.ime = 1;
            }
        }

        if (typeof GPU !== 'undefined' && typeof GPU.step === 'function') {
            GPU.step();
        }
        if (typeof TIMER !== 'undefined' && typeof TIMER.inc === 'function') {
            TIMER.inc();
        }
    },

    _serviceInterrupt: function(pending) {
        var bit = 0;
        while (bit < 5 && !(pending & (1 << bit))) bit++;

        Z80._r.ime = 0;
        Z80._imeDelay = 0;
        MMU._if = (MMU._if || 0) & ~(1 << bit);
        Z80._push16(Z80._r.pc);
        Z80._r.pc = 0x40 + bit * 8;
        Z80._r.m = 5;
        Z80._r.t = 20;
    },

    _hex: function(value, width) {
        return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
    },

    _read8: function(address) {
        var value = MMU.rb(address & 0xFFFF);
        return typeof value === 'number' && !isNaN(value) ? value & 0xFF : 0xFF;
    },

    _write8: function(address, value) {
        MMU.wb(address & 0xFFFF, value & 0xFF);
    },

    _fetch8: function() {
        var value = Z80._read8(Z80._r.pc);
        Z80._r.pc = (Z80._r.pc + 1) & 0xFFFF;
        return value;
    },

    _fetchSigned8: function() {
        var value = Z80._fetch8();
        return value < 0x80 ? value : value - 0x100;
    },

    _fetch16: function() {
        var low = Z80._fetch8();
        return low | (Z80._fetch8() << 8);
    },

    _read16: function(address) {
        var low = Z80._read8(address);
        return low | (Z80._read8((address + 1) & 0xFFFF) << 8);
    },

    _write16: function(address, value) {
        Z80._write8(address, value & 0xFF);
        Z80._write8((address + 1) & 0xFFFF, value >> 8);
    },

    _push16: function(value) {
        Z80._r.sp = (Z80._r.sp - 1) & 0xFFFF;
        Z80._write8(Z80._r.sp, value >> 8);
        Z80._r.sp = (Z80._r.sp - 1) & 0xFFFF;
        Z80._write8(Z80._r.sp, value);
    },

    _pop16: function() {
        var low = Z80._read8(Z80._r.sp);
        Z80._r.sp = (Z80._r.sp + 1) & 0xFFFF;
        var high = Z80._read8(Z80._r.sp);
        Z80._r.sp = (Z80._r.sp + 1) & 0xFFFF;
        return low | (high << 8);
    },

    _getPair: function(index) {
        switch (index) {
            case 0: return (Z80._r.b << 8) | Z80._r.c;
            case 1: return (Z80._r.d << 8) | Z80._r.e;
            case 2: return (Z80._r.h << 8) | Z80._r.l;
            default: return Z80._r.sp;
        }
    },

    _setPair: function(index, value) {
        value &= 0xFFFF;
        switch (index) {
            case 0:
                Z80._r.b = value >> 8;
                Z80._r.c = value & 0xFF;
                break;
            case 1:
                Z80._r.d = value >> 8;
                Z80._r.e = value & 0xFF;
                break;
            case 2:
                Z80._r.h = value >> 8;
                Z80._r.l = value & 0xFF;
                break;
            default:
                Z80._r.sp = value;
        }
    },

    _getStackPair: function(index) {
        if (index === 3) return (Z80._r.a << 8) | Z80._r.f;
        return Z80._getPair(index);
    },

    _setStackPair: function(index, value) {
        if (index === 3) {
            Z80._r.a = (value >> 8) & 0xFF;
            Z80._r.f = value & 0xF0;
        } else {
            Z80._setPair(index, value);
        }
    },

    _getReg: function(index) {
        switch (index) {
            case 0: return Z80._r.b;
            case 1: return Z80._r.c;
            case 2: return Z80._r.d;
            case 3: return Z80._r.e;
            case 4: return Z80._r.h;
            case 5: return Z80._r.l;
            case 6: return Z80._read8(Z80._getPair(2));
            default: return Z80._r.a;
        }
    },

    _setReg: function(index, value) {
        value &= 0xFF;
        switch (index) {
            case 0: Z80._r.b = value; break;
            case 1: Z80._r.c = value; break;
            case 2: Z80._r.d = value; break;
            case 3: Z80._r.e = value; break;
            case 4: Z80._r.h = value; break;
            case 5: Z80._r.l = value; break;
            case 6: Z80._write8(Z80._getPair(2), value); break;
            default: Z80._r.a = value;
        }
    },

    _condition: function(index) {
        switch (index) {
            case 0: return !(Z80._r.f & 0x80); // NZ
            case 1: return !!(Z80._r.f & 0x80); // Z
            case 2: return !(Z80._r.f & 0x10); // NC
            default: return !!(Z80._r.f & 0x10); // C
        }
    },

    _inc8: function(value) {
        var result = (value + 1) & 0xFF;
        var carry = Z80._r.f & 0x10;
        Z80._r.f = carry |
            (result === 0 ? 0x80 : 0) |
            ((value & 0x0F) === 0x0F ? 0x20 : 0);
        return result;
    },

    _dec8: function(value) {
        var result = (value - 1) & 0xFF;
        var carry = Z80._r.f & 0x10;
        Z80._r.f = carry | 0x40 |
            (result === 0 ? 0x80 : 0) |
            ((value & 0x0F) === 0 ? 0x20 : 0);
        return result;
    },

    _addA: function(value, withCarry) {
        var carry = withCarry && (Z80._r.f & 0x10) ? 1 : 0;
        var a = Z80._r.a;
        var result = a + value + carry;
        Z80._r.a = result & 0xFF;
        Z80._r.f =
            (Z80._r.a === 0 ? 0x80 : 0) |
            (((a & 0x0F) + (value & 0x0F) + carry > 0x0F) ? 0x20 : 0) |
            (result > 0xFF ? 0x10 : 0);
    },

    _subA: function(value, withCarry, compareOnly) {
        var carry = withCarry && (Z80._r.f & 0x10) ? 1 : 0;
        var a = Z80._r.a;
        var result = a - value - carry;
        var byte = result & 0xFF;
        Z80._r.f = 0x40 |
            (byte === 0 ? 0x80 : 0) |
            ((a & 0x0F) < ((value & 0x0F) + carry) ? 0x20 : 0) |
            (result < 0 ? 0x10 : 0);
        if (!compareOnly) Z80._r.a = byte;
    },

    _andA: function(value) {
        Z80._r.a &= value;
        Z80._r.f = (Z80._r.a === 0 ? 0x80 : 0) | 0x20;
    },

    _xorA: function(value) {
        Z80._r.a ^= value;
        Z80._r.f = Z80._r.a === 0 ? 0x80 : 0;
    },

    _orA: function(value) {
        Z80._r.a |= value;
        Z80._r.f = Z80._r.a === 0 ? 0x80 : 0;
    },

    _addHL: function(value) {
        var hl = Z80._getPair(2);
        var result = hl + value;
        Z80._r.f = (Z80._r.f & 0x80) |
            (((hl & 0x0FFF) + (value & 0x0FFF) > 0x0FFF) ? 0x20 : 0) |
            (result > 0xFFFF ? 0x10 : 0);
        Z80._setPair(2, result);
    },

    _addSP: function(offset, storeInHL) {
        var sp = Z80._r.sp;
        var unsigned = offset & 0xFF;
        var result = (sp + offset) & 0xFFFF;
        Z80._r.f =
            (((sp & 0x0F) + (unsigned & 0x0F) > 0x0F) ? 0x20 : 0) |
            (((sp & 0xFF) + unsigned > 0xFF) ? 0x10 : 0);

        if (storeInHL) Z80._setPair(2, result);
        else Z80._r.sp = result;
    },

    _daa: function() {
        var a = Z80._r.a;
        var correction = 0;
        var carry = Z80._r.f & 0x10;

        if (!(Z80._r.f & 0x40)) {
            if ((Z80._r.f & 0x20) || (a & 0x0F) > 9) correction |= 0x06;
            if (carry || a > 0x99) {
                correction |= 0x60;
                carry = 0x10;
            }
            a = (a + correction) & 0xFF;
        } else {
            if (Z80._r.f & 0x20) correction |= 0x06;
            if (carry) correction |= 0x60;
            a = (a - correction) & 0xFF;
        }

        Z80._r.a = a;
        Z80._r.f = (Z80._r.f & 0x40) |
            (a === 0 ? 0x80 : 0) |
            carry;
    },

    _rotateLeftCircular: function(value, setZero) {
        var carry = (value >> 7) & 1;
        var result = ((value << 1) | carry) & 0xFF;
        Z80._r.f = (setZero && result === 0 ? 0x80 : 0) | (carry ? 0x10 : 0);
        return result;
    },

    _rotateRightCircular: function(value, setZero) {
        var carry = value & 1;
        var result = ((value >> 1) | (carry << 7)) & 0xFF;
        Z80._r.f = (setZero && result === 0 ? 0x80 : 0) | (carry ? 0x10 : 0);
        return result;
    },

    _rotateLeft: function(value, setZero) {
        var carryIn = Z80._r.f & 0x10 ? 1 : 0;
        var carryOut = (value >> 7) & 1;
        var result = ((value << 1) | carryIn) & 0xFF;
        Z80._r.f = (setZero && result === 0 ? 0x80 : 0) | (carryOut ? 0x10 : 0);
        return result;
    },

    _rotateRight: function(value, setZero) {
        var carryIn = Z80._r.f & 0x10 ? 0x80 : 0;
        var carryOut = value & 1;
        var result = (value >> 1) | carryIn;
        Z80._r.f = (setZero && result === 0 ? 0x80 : 0) | (carryOut ? 0x10 : 0);
        return result;
    },

    _illegal: function(opcode) {
        return function() {
            var address = (Z80._r.pc - 1) & 0xFFFF;
            Z80._stop = 1;
            throw new Error(
                'Illegal Game Boy opcode 0x' + Z80._hex(opcode, 2) +
                ' at 0x' + Z80._hex(address, 4)
            );
        };
    }
};

(function buildOpcodeTables() {
    var op;

    function instruction(machineCycles, operation) {
        return function() {
            operation();
            Z80._r.m = machineCycles;
            Z80._r.t = machineCycles * 4;
        };
    }

    function conditionalInstruction(baseCycles, takenCycles, condition, operation) {
        return function() {
            if (condition()) {
                operation();
                Z80._r.m = takenCycles;
            } else {
                Z80._r.m = baseCycles;
            }
            Z80._r.t = Z80._r.m * 4;
        };
    }

    for (op = 0; op < 256; op++) {
        Z80._map[op] = Z80._illegal(op);
    }

    // 0x40-0x7F: LD r,r and HALT.
    for (op = 0x40; op <= 0x7F; op++) {
        (function(opcode) {
            if (opcode === 0x76) {
                Z80._map[opcode] = instruction(1, function() { Z80._halt = 1; });
                return;
            }
            var destination = (opcode >> 3) & 7;
            var source = opcode & 7;
            Z80._map[opcode] = instruction(
                destination === 6 || source === 6 ? 2 : 1,
                function() { Z80._setReg(destination, Z80._getReg(source)); }
            );
        })(op);
    }

    // 0x80-0xBF: arithmetic and logic with A.
    for (op = 0x80; op <= 0xBF; op++) {
        (function(opcode) {
            var operation = (opcode >> 3) & 7;
            var source = opcode & 7;
            Z80._map[opcode] = instruction(source === 6 ? 2 : 1, function() {
                var value = Z80._getReg(source);
                switch (operation) {
                    case 0: Z80._addA(value, false); break;
                    case 1: Z80._addA(value, true); break;
                    case 2: Z80._subA(value, false, false); break;
                    case 3: Z80._subA(value, true, false); break;
                    case 4: Z80._andA(value); break;
                    case 5: Z80._xorA(value); break;
                    case 6: Z80._orA(value); break;
                    case 7: Z80._subA(value, false, true); break;
                }
            });
        })(op);
    }

    // Repeating 16-bit/register patterns in 0x00-0x3F.
    for (op = 0; op < 4; op++) {
        (function(pair) {
            var base = pair << 4;
            Z80._map[base + 0x01] = instruction(3, function() {
                Z80._setPair(pair, Z80._fetch16());
            });
            Z80._map[base + 0x03] = instruction(2, function() {
                Z80._setPair(pair, Z80._getPair(pair) + 1);
            });
            Z80._map[base + 0x09] = instruction(2, function() {
                Z80._addHL(Z80._getPair(pair));
            });
            Z80._map[base + 0x0B] = instruction(2, function() {
                Z80._setPair(pair, Z80._getPair(pair) - 1);
            });
        })(op);
    }

    for (op = 0; op < 8; op++) {
        (function(register) {
            var base = register << 3;
            Z80._map[base + 0x04] = instruction(register === 6 ? 3 : 1, function() {
                Z80._setReg(register, Z80._inc8(Z80._getReg(register)));
            });
            Z80._map[base + 0x05] = instruction(register === 6 ? 3 : 1, function() {
                Z80._setReg(register, Z80._dec8(Z80._getReg(register)));
            });
            Z80._map[base + 0x06] = instruction(register === 6 ? 3 : 2, function() {
                Z80._setReg(register, Z80._fetch8());
            });
        })(op);
    }

    Z80._map[0x00] = instruction(1, function() {});
    Z80._map[0x02] = instruction(2, function() {
        Z80._write8(Z80._getPair(0), Z80._r.a);
    });
    Z80._map[0x07] = instruction(1, function() {
        Z80._r.a = Z80._rotateLeftCircular(Z80._r.a, false);
    });
    Z80._map[0x08] = instruction(5, function() {
        Z80._write16(Z80._fetch16(), Z80._r.sp);
    });
    Z80._map[0x0A] = instruction(2, function() {
        Z80._r.a = Z80._read8(Z80._getPair(0));
    });
    Z80._map[0x0F] = instruction(1, function() {
        Z80._r.a = Z80._rotateRightCircular(Z80._r.a, false);
    });
    Z80._map[0x10] = instruction(1, function() {
        Z80._fetch8(); // STOP is encoded as 0x10 0x00.
        Z80._stop = 1;
    });
    Z80._map[0x12] = instruction(2, function() {
        Z80._write8(Z80._getPair(1), Z80._r.a);
    });
    Z80._map[0x17] = instruction(1, function() {
        Z80._r.a = Z80._rotateLeft(Z80._r.a, false);
    });
    Z80._map[0x18] = instruction(3, function() {
        var offset = Z80._fetchSigned8();
        Z80._r.pc = (Z80._r.pc + offset) & 0xFFFF;
    });
    Z80._map[0x1A] = instruction(2, function() {
        Z80._r.a = Z80._read8(Z80._getPair(1));
    });
    Z80._map[0x1F] = instruction(1, function() {
        Z80._r.a = Z80._rotateRight(Z80._r.a, false);
    });

    for (op = 0; op < 4; op++) {
        (function(condition) {
            Z80._map[0x20 + condition * 8] = conditionalInstruction(
                2, 3,
                function() { return Z80._condition(condition); },
                function() {
                    Z80._r.pc = (Z80._r.pc + Z80._fetchSigned8()) & 0xFFFF;
                }
            );

            // The offset must still be consumed when the branch is not taken.
            Z80._map[0x20 + condition * 8] = function() {
                var offset = Z80._fetchSigned8();
                if (Z80._condition(condition)) {
                    Z80._r.pc = (Z80._r.pc + offset) & 0xFFFF;
                    Z80._r.m = 3;
                } else {
                    Z80._r.m = 2;
                }
                Z80._r.t = Z80._r.m * 4;
            };
        })(op);
    }

    Z80._map[0x22] = instruction(2, function() {
        var hl = Z80._getPair(2);
        Z80._write8(hl, Z80._r.a);
        Z80._setPair(2, hl + 1);
    });
    Z80._map[0x27] = instruction(1, function() { Z80._daa(); });
    Z80._map[0x2A] = instruction(2, function() {
        var hl = Z80._getPair(2);
        Z80._r.a = Z80._read8(hl);
        Z80._setPair(2, hl + 1);
    });
    Z80._map[0x2F] = instruction(1, function() {
        Z80._r.a ^= 0xFF;
        Z80._r.f = (Z80._r.f & 0x90) | 0x60;
    });
    Z80._map[0x32] = instruction(2, function() {
        var hl = Z80._getPair(2);
        Z80._write8(hl, Z80._r.a);
        Z80._setPair(2, hl - 1);
    });
    Z80._map[0x37] = instruction(1, function() {
        Z80._r.f = (Z80._r.f & 0x80) | 0x10;
    });
    Z80._map[0x3A] = instruction(2, function() {
        var hl = Z80._getPair(2);
        Z80._r.a = Z80._read8(hl);
        Z80._setPair(2, hl - 1);
    });
    Z80._map[0x3F] = instruction(1, function() {
        Z80._r.f = (Z80._r.f & 0x80) | ((Z80._r.f & 0x10) ? 0 : 0x10);
    });

    // Returns, jumps and calls.
    for (op = 0; op < 4; op++) {
        (function(condition) {
            Z80._map[0xC0 + condition * 8] = conditionalInstruction(
                2, 5,
                function() { return Z80._condition(condition); },
                function() { Z80._r.pc = Z80._pop16(); }
            );
            Z80._map[0xC2 + condition * 8] = function() {
                var address = Z80._fetch16();
                if (Z80._condition(condition)) {
                    Z80._r.pc = address;
                    Z80._r.m = 4;
                } else {
                    Z80._r.m = 3;
                }
                Z80._r.t = Z80._r.m * 4;
            };
            Z80._map[0xC4 + condition * 8] = function() {
                var address = Z80._fetch16();
                if (Z80._condition(condition)) {
                    Z80._push16(Z80._r.pc);
                    Z80._r.pc = address;
                    Z80._r.m = 6;
                } else {
                    Z80._r.m = 3;
                }
                Z80._r.t = Z80._r.m * 4;
            };
        })(op);
    }

    for (op = 0; op < 4; op++) {
        (function(pair) {
            Z80._map[0xC1 + pair * 0x10] = instruction(3, function() {
                Z80._setStackPair(pair, Z80._pop16());
            });
            Z80._map[0xC5 + pair * 0x10] = instruction(4, function() {
                Z80._push16(Z80._getStackPair(pair));
            });
        })(op);
    }

    for (op = 0; op < 8; op++) {
        (function(vector) {
            Z80._map[0xC7 + vector * 8] = instruction(4, function() {
                Z80._push16(Z80._r.pc);
                Z80._r.pc = vector * 8;
            });
        })(op);
    }

    Z80._map[0xC3] = instruction(4, function() { Z80._r.pc = Z80._fetch16(); });
    Z80._map[0xC9] = instruction(4, function() { Z80._r.pc = Z80._pop16(); });
    Z80._map[0xCD] = instruction(6, function() {
        var address = Z80._fetch16();
        Z80._push16(Z80._r.pc);
        Z80._r.pc = address;
    });
    Z80._map[0xD9] = instruction(4, function() {
        Z80._r.pc = Z80._pop16();
        Z80._r.ime = 1;
        Z80._imeDelay = 0;
    });
    Z80._map[0xE9] = instruction(1, function() { Z80._r.pc = Z80._getPair(2); });

    // Immediate ALU operations.
    Z80._map[0xC6] = instruction(2, function() { Z80._addA(Z80._fetch8(), false); });
    Z80._map[0xCE] = instruction(2, function() { Z80._addA(Z80._fetch8(), true); });
    Z80._map[0xD6] = instruction(2, function() { Z80._subA(Z80._fetch8(), false, false); });
    Z80._map[0xDE] = instruction(2, function() { Z80._subA(Z80._fetch8(), true, false); });
    Z80._map[0xE6] = instruction(2, function() { Z80._andA(Z80._fetch8()); });
    Z80._map[0xEE] = instruction(2, function() { Z80._xorA(Z80._fetch8()); });
    Z80._map[0xF6] = instruction(2, function() { Z80._orA(Z80._fetch8()); });
    Z80._map[0xFE] = instruction(2, function() { Z80._subA(Z80._fetch8(), false, true); });

    // High-memory and absolute loads.
    Z80._map[0xE0] = instruction(3, function() {
        Z80._write8(0xFF00 | Z80._fetch8(), Z80._r.a);
    });
    Z80._map[0xE2] = instruction(2, function() {
        Z80._write8(0xFF00 | Z80._r.c, Z80._r.a);
    });
    Z80._map[0xEA] = instruction(4, function() {
        Z80._write8(Z80._fetch16(), Z80._r.a);
    });
    Z80._map[0xF0] = instruction(3, function() {
        Z80._r.a = Z80._read8(0xFF00 | Z80._fetch8());
    });
    Z80._map[0xF2] = instruction(2, function() {
        Z80._r.a = Z80._read8(0xFF00 | Z80._r.c);
    });
    Z80._map[0xFA] = instruction(4, function() {
        Z80._r.a = Z80._read8(Z80._fetch16());
    });

    Z80._map[0xE8] = instruction(4, function() {
        Z80._addSP(Z80._fetchSigned8(), false);
    });
    Z80._map[0xF8] = instruction(3, function() {
        Z80._addSP(Z80._fetchSigned8(), true);
    });
    Z80._map[0xF9] = instruction(2, function() {
        Z80._r.sp = Z80._getPair(2);
    });

    Z80._map[0xF3] = instruction(1, function() {
        Z80._r.ime = 0;
        Z80._imeDelay = 0;
    });
    Z80._map[0xFB] = instruction(1, function() {
        // IME becomes active after the instruction following EI.
        Z80._imeDelay = 2;
    });

    Z80._map[0xCB] = function() {
        var opcode = Z80._fetch8();
        var operation = Z80._cbmap[opcode];
        if (typeof operation !== 'function') {
            throw new Error('Invalid CB opcode 0x' + Z80._hex(opcode, 2));
        }
        operation();
    };

    // Complete CB-prefixed table.
    for (op = 0; op < 256; op++) {
        (function(opcode) {
            var group = opcode >> 6;
            var operation = (opcode >> 3) & 7;
            var register = opcode & 7;

            Z80._cbmap[opcode] = function() {
                var value = Z80._getReg(register);

                if (group === 0) {
                    switch (operation) {
                        case 0: value = Z80._rotateLeftCircular(value, true); break;
                        case 1: value = Z80._rotateRightCircular(value, true); break;
                        case 2: value = Z80._rotateLeft(value, true); break;
                        case 3: value = Z80._rotateRight(value, true); break;
                        case 4:
                            var highBit = value & 0x80;
                            value = (value << 1) & 0xFF;
                            Z80._r.f =
                                (value === 0 ? 0x80 : 0) |
                                (highBit ? 0x10 : 0);
                            break;
                        case 5:
                            var lowBit = value & 1;
                            value = (value >> 1) | (value & 0x80);
                            Z80._r.f = (value === 0 ? 0x80 : 0) | (lowBit ? 0x10 : 0);
                            break;
                        case 6:
                            value = ((value & 0x0F) << 4) | (value >> 4);
                            Z80._r.f = value === 0 ? 0x80 : 0;
                            break;
                        case 7:
                            var shiftedBit = value & 1;
                            value >>= 1;
                            Z80._r.f = (value === 0 ? 0x80 : 0) | (shiftedBit ? 0x10 : 0);
                            break;
                    }
                    Z80._setReg(register, value);
                    Z80._r.m = register === 6 ? 4 : 2;
                } else if (group === 1) {
                    Z80._r.f = (Z80._r.f & 0x10) | 0x20 |
                        ((value & (1 << operation)) ? 0 : 0x80);
                    Z80._r.m = register === 6 ? 3 : 2;
                } else if (group === 2) {
                    Z80._setReg(register, value & ~(1 << operation));
                    Z80._r.m = register === 6 ? 4 : 2;
                } else {
                    Z80._setReg(register, value | (1 << operation));
                    Z80._r.m = register === 6 ? 4 : 2;
                }

                Z80._r.t = Z80._r.m * 4;
            };
        })(op);
    }
})();
