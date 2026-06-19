// Game Boy memory map and MBC3 cartridge controller.
MMU = {
    _inbios: 0,
    _bios: [],
    _rom: '',
    _wram: new Uint8Array(0x2000),
    _eram: new Uint8Array(0x8000),
    _zram: new Uint8Array(0x7F),
    _io: new Uint8Array(0x80),
    _ie: 0,
    _if: 0,

    _cartridgeType: 0,
    _romBank: 1,
    _ramBank: 0,
    _ramEnabled: false,
    _romBanks: 2,
    _ramBanks: 0,
    _ramSize: 0,
    _mapper: 'ROM',
    _hasRTC: false,
    _rtc: {
        seconds: 0,
        minutes: 0,
        hours: 0,
        days: 0,
        halt: false,
        carry: false,
        lastUpdate: 0,
        latchValue: 0,
        latched: null
    },

    reset: function() {
        MMU._wram.fill(0);
        MMU._eram.fill(0);
        MMU._zram.fill(0);
        MMU._io.fill(0);

        MMU._ie = 0;
        MMU._if = 0;
        MMU._romBank = 1;
        MMU._ramBank = 0;
        MMU._ramEnabled = false;
        MMU._inbios = 0;
        MMU._rtc.latchValue = 0;
        MMU._rtc.latched = null;
        MMU._rtc.lastUpdate = Date.now();

        // Values normally established by the DMG boot ROM.
        MMU._io[0x00] = 0xCF;
        MMU._io[0x02] = 0x7E;
        MMU._io[0x40] = 0x91;
        MMU._io[0x47] = 0xFC;
        MMU._io[0x48] = 0xFF;
        MMU._io[0x49] = 0xFF;

        if (typeof TIMER !== 'undefined') {
            TIMER._clock.main = 0;
            TIMER._clock.sub = 0;
            TIMER._clock.div = 0;
            TIMER._reg.div = 0xAB;
            TIMER._reg.tima = 0;
            TIMER._reg.tma = 0;
            TIMER._reg.tac = 0;
        }

        if (typeof KEY !== 'undefined') KEY.reset();
    },

    load: function(file) {
        var reader = new BinFileReader(file);
        MMU._rom = reader.readString(reader.getFileSize(), 0);
        MMU._configureCartridge();
    },

    _configureCartridge: function() {
        MMU._cartridgeType = MMU._romByte(0x0147);
        MMU._romBanks = Math.max(2, Math.ceil(MMU._rom.length / 0x4000));

        if (MMU._cartridgeType >= 0x0F && MMU._cartridgeType <= 0x13) {
            MMU._mapper = 'MBC3';
        } else {
            MMU._mapper = 'ROM';
        }
        MMU._hasRTC = MMU._cartridgeType === 0x0F || MMU._cartridgeType === 0x10;

        var ramSize = MMU._romByte(0x0149);
        switch (ramSize) {
            case 0x01:
                MMU._ramSize = 0x0800;
                MMU._ramBanks = 1;
                break;
            case 0x02:
                MMU._ramSize = 0x2000;
                MMU._ramBanks = 1;
                break;
            case 0x03:
                MMU._ramSize = 0x8000;
                MMU._ramBanks = 4;
                break;
            case 0x04:
                MMU._ramSize = 0x20000;
                MMU._ramBanks = 16;
                break;
            case 0x05:
                MMU._ramSize = 0x10000;
                MMU._ramBanks = 8;
                break;
            default:
                MMU._ramSize = 0;
                MMU._ramBanks = 0;
        }

        MMU._eram = new Uint8Array(MMU._ramSize);
        MMU._romBank = 1;
        MMU._ramBank = 0;
        MMU._ramEnabled = MMU._mapper === 'ROM' && MMU._ramSize > 0;
        MMU._rtc.lastUpdate = Date.now();
    },

    _romByte: function(index) {
        if (index < 0 || index >= MMU._rom.length) return 0xFF;
        return MMU._rom.charCodeAt(index) & 0xFF;
    },

    rb: function(addr) {
        addr &= 0xFFFF;

        if (addr < 0x4000) {
            if (MMU._inbios && addr < 0x0100) {
                return MMU._bios[addr] === undefined ? 0xFF : MMU._bios[addr];
            }
            return MMU._romByte(addr);
        }

        if (addr < 0x8000) {
            var bank = MMU._romBank % MMU._romBanks;
            return MMU._romByte(bank * 0x4000 + (addr - 0x4000));
        }

        if (addr < 0xA000) {
            return GPU._vram[addr & 0x1FFF] || 0;
        }

        if (addr < 0xC000) {
            if (!MMU._ramEnabled) return 0xFF;

            if (MMU._hasRTC && MMU._ramBank >= 0x08 && MMU._ramBank <= 0x0C) {
                return MMU._readRTC(MMU._ramBank);
            }

            var ramIndex = MMU._ramAddress(addr);
            return ramIndex < 0 ? 0xFF : MMU._eram[ramIndex];
        }

        if (addr < 0xE000) {
            return MMU._wram[addr & 0x1FFF];
        }

        if (addr < 0xFE00) {
            return MMU._wram[addr & 0x1FFF];
        }

        if (addr < 0xFEA0) {
            return GPU._oam[addr & 0xFF] || 0;
        }

        if (addr < 0xFF00) return 0xFF;
        if (addr === 0xFFFF) return MMU._ie;
        if (addr >= 0xFF80) return MMU._zram[addr & 0x7F];

        return MMU._readIO(addr);
    },

    rw: function(addr) {
        return MMU.rb(addr) | (MMU.rb((addr + 1) & 0xFFFF) << 8);
    },

    wb: function(addr, val) {
        addr &= 0xFFFF;
        val &= 0xFF;

        if (addr < 0x2000) {
            if (MMU._mapper === 'MBC3') {
                MMU._ramEnabled = (val & 0x0F) === 0x0A;
            }
            return;
        }

        if (addr < 0x4000) {
            if (MMU._mapper === 'MBC3') {
                MMU._romBank = val & 0x7F;
                if (MMU._romBank === 0) MMU._romBank = 1;
            }
            return;
        }

        if (addr < 0x6000) {
            if (MMU._mapper === 'MBC3') MMU._ramBank = val & 0x0F;
            return;
        }

        if (addr < 0x8000) {
            if (MMU._mapper === 'MBC3') MMU._latchRTC(val);
            return;
        }

        if (addr < 0xA000) {
            GPU._vram[addr & 0x1FFF] = val;
            if (addr < 0x9800) GPU.updatetile(addr, val);
            return;
        }

        if (addr < 0xC000) {
            if (!MMU._ramEnabled) return;

            if (MMU._hasRTC && MMU._ramBank >= 0x08 && MMU._ramBank <= 0x0C) {
                MMU._writeRTC(MMU._ramBank, val);
                return;
            }

            var ramIndex = MMU._ramAddress(addr);
            if (ramIndex >= 0) MMU._eram[ramIndex] = val;
            return;
        }

        if (addr < 0xE000) {
            MMU._wram[addr & 0x1FFF] = val;
            return;
        }

        if (addr < 0xFE00) {
            MMU._wram[addr & 0x1FFF] = val;
            return;
        }

        if (addr < 0xFEA0) {
            GPU._oam[addr & 0xFF] = val;
            GPU.buildobjdata(addr - 0xFE00, val);
            return;
        }

        if (addr < 0xFF00) return;

        if (addr === 0xFFFF) {
            MMU._ie = val;
            return;
        }

        if (addr >= 0xFF80) {
            MMU._zram[addr & 0x7F] = val;
            return;
        }

        MMU._writeIO(addr, val);
    },

    ww: function(addr, val) {
        MMU.wb(addr, val & 0xFF);
        MMU.wb((addr + 1) & 0xFFFF, val >> 8);
    },

    _readIO: function(addr) {
        if (addr === 0xFF00 && typeof KEY !== 'undefined') {
            return 0xC0 | (MMU._io[0] & 0x30) | (KEY.rb(addr) & 0x0F);
        }

        if (addr >= 0xFF04 && addr <= 0xFF07 && typeof TIMER !== 'undefined') {
            var timerValue = TIMER.rb(addr);
            return addr === 0xFF07 ? timerValue | 0xF8 : timerValue;
        }

        if (addr === 0xFF02) return MMU._io[0x02] | 0x7E;
        if (addr === 0xFF0F) return MMU._if | 0xE0;

        if (addr >= 0xFF40 && addr <= 0xFF4B) {
            var gpuValue = GPU.rb(addr);
            return gpuValue === undefined ? MMU._io[addr & 0x7F] : gpuValue;
        }

        return MMU._io[addr & 0x7F];
    },

    _writeIO: function(addr, val) {
        MMU._io[addr & 0x7F] = val;

        if (addr === 0xFF00 && typeof KEY !== 'undefined') {
            MMU._io[0] = 0xC0 | (val & 0x30);
            KEY.wb(addr, val);
            return;
        }

        if (addr === 0xFF02) {
            MMU._io[0x02] = val & 0x81;
            if (val & 0x80) {
                // No link cable: complete an internal-clock transfer immediately.
                MMU._io[0x01] = 0xFF;
                MMU._io[0x02] &= 0x7F;
                MMU._if |= 0x08;
            }
            return;
        }

        if (addr >= 0xFF04 && addr <= 0xFF07 && typeof TIMER !== 'undefined') {
            TIMER.wb(addr, val);
            return;
        }

        if (addr === 0xFF0F) {
            MMU._if = val & 0x1F;
            return;
        }

        if (addr === 0xFF46) {
            MMU._dma(val);
            return;
        }

        if (addr === 0xFF50 && val !== 0) {
            MMU._inbios = 0;
            return;
        }

        if (addr >= 0xFF40 && addr <= 0xFF4B) {
            GPU.wb(addr, val);
        }
    },

    _dma: function(page) {
        var source = page << 8;
        for (var i = 0; i < 0xA0; i++) {
            var value = MMU.rb(source + i);
            GPU._oam[i] = value;
            GPU.buildobjdata(i, value);
        }
    },

    _ramAddress: function(addr) {
        if (!MMU._ramBanks || MMU._ramBank >= MMU._ramBanks) return -1;

        var offset = addr & 0x1FFF;
        if (MMU._ramSize === 0x0800 && offset >= 0x0800) return -1;

        var index = MMU._ramBank * 0x2000 + offset;
        return index < MMU._eram.length ? index : -1;
    },

    _updateRTC: function() {
        var rtc = MMU._rtc;
        var now = Date.now();

        if (!rtc.lastUpdate) rtc.lastUpdate = now;
        if (rtc.halt) {
            rtc.lastUpdate = now;
            return;
        }

        var elapsed = Math.floor((now - rtc.lastUpdate) / 1000);
        if (elapsed <= 0) return;
        rtc.lastUpdate += elapsed * 1000;

        var total = rtc.seconds +
            rtc.minutes * 60 +
            rtc.hours * 3600 +
            rtc.days * 86400 +
            elapsed;
        var days = Math.floor(total / 86400);

        if (days > 511) {
            rtc.carry = true;
            days %= 512;
        }

        var daySeconds = total % 86400;
        rtc.days = days;
        rtc.hours = Math.floor(daySeconds / 3600);
        rtc.minutes = Math.floor((daySeconds % 3600) / 60);
        rtc.seconds = daySeconds % 60;
    },

    _rtcSnapshot: function() {
        MMU._updateRTC();
        return [
            MMU._rtc.seconds,
            MMU._rtc.minutes,
            MMU._rtc.hours,
            MMU._rtc.days & 0xFF,
            ((MMU._rtc.days >> 8) & 1) |
                (MMU._rtc.halt ? 0x40 : 0) |
                (MMU._rtc.carry ? 0x80 : 0)
        ];
    },

    _latchRTC: function(value) {
        value &= 1;
        if (MMU._rtc.latchValue === 0 && value === 1) {
            MMU._rtc.latched = MMU._rtcSnapshot();
        }
        MMU._rtc.latchValue = value;
    },

    _readRTC: function(register) {
        var values = MMU._rtc.latched || MMU._rtcSnapshot();
        return values[register - 0x08];
    },

    _writeRTC: function(register, value) {
        MMU._updateRTC();
        var rtc = MMU._rtc;

        switch (register) {
            case 0x08: rtc.seconds = value % 60; break;
            case 0x09: rtc.minutes = value % 60; break;
            case 0x0A: rtc.hours = value % 24; break;
            case 0x0B: rtc.days = (rtc.days & 0x100) | value; break;
            case 0x0C:
                rtc.days = (rtc.days & 0xFF) | ((value & 1) << 8);
                rtc.halt = !!(value & 0x40);
                rtc.carry = !!(value & 0x80);
                break;
        }

        rtc.lastUpdate = Date.now();
        rtc.latched = null;
    }
};
