// Minimal Game Boy APU: pulse channels 1 and 2 using the Web Audio API.
APU = {
    _registers: new Uint8Array(0x30),
    _powered: true,
    _frameCycles: 0,
    _frameStep: 0,
    _context: null,
    _masterGain: null,
    _pulseWaves: [],
    _userVolume: 0.6,
    _muted: false,
    _channels: [
        {
            oscillator: null,
            gain: null,
            active: false,
            length: 0,
            volume: 0,
            envelopeTimer: 0
        },
        {
            oscillator: null,
            gain: null,
            active: false,
            length: 0,
            volume: 0,
            envelopeTimer: 0
        }
    ],

    reset: function() {
        APU._registers.fill(0);
        APU._registers[0x14] = 0x77; // NR50: full left/right volume.
        APU._registers[0x15] = 0xF3; // NR51: DMG-style channel routing.
        APU._powered = true;
        APU._frameCycles = 0;
        APU._frameStep = 0;

        for (var i = 0; i < APU._channels.length; i++) {
            APU._channels[i].active = false;
            APU._channels[i].length = 0;
            APU._channels[i].volume = 0;
            APU._channels[i].envelopeTimer = 0;
            APU._updateChannel(i);
        }
    },

    resume: function() {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return Promise.resolve(false);

        if (!APU._context) APU._createAudioGraph(AudioContext);
        return APU._context.resume().then(function() {
            APU._updateAll();
            return true;
        });
    },

    suspend: function() {
        if (APU._context && APU._context.state === 'running') {
            APU._context.suspend();
        }
    },

    setVolume: function(value) {
        value = Number(value);
        if (!isFinite(value)) return;
        APU._userVolume = Math.max(0, Math.min(1, value));
        APU._updateMasterGain();
    },

    setMuted: function(muted) {
        APU._muted = !!muted;
        APU._updateMasterGain();
    },

    toggleMuted: function() {
        APU.setMuted(!APU._muted);
        return APU._muted;
    },

    rb: function(addr) {
        if (addr === 0xFF26) {
            var status = APU._powered ? 0xF0 : 0x70;
            if (APU._channels[0].active) status |= 0x01;
            if (APU._channels[1].active) status |= 0x02;
            return status;
        }

        if (addr >= 0xFF10 && addr <= 0xFF3F) {
            var value = APU._registers[addr - 0xFF10];
            var readMasks = {
                0xFF10: 0x80,
                0xFF11: 0x3F,
                0xFF13: 0xFF,
                0xFF14: 0xBF,
                0xFF16: 0x3F,
                0xFF18: 0xFF,
                0xFF19: 0xBF,
                0xFF1A: 0x7F,
                0xFF1B: 0xFF,
                0xFF1C: 0x9F,
                0xFF1D: 0xFF,
                0xFF1E: 0xBF,
                0xFF20: 0xFF,
                0xFF23: 0xBF
            };
            return value | (readMasks[addr] || 0);
        }
        return 0xFF;
    },

    wb: function(addr, val) {
        val &= 0xFF;

        if (addr === 0xFF26) {
            if (!(val & 0x80)) {
                APU._powerOff();
            } else if (!APU._powered) {
                APU._powered = true;
            }
            return;
        }

        if (addr < 0xFF10 || addr > 0xFF3F) return;

        // Wave RAM remains writable while the APU is powered off.
        if (!APU._powered && addr < 0xFF30) return;
        APU._registers[addr - 0xFF10] = val;

        if (addr === 0xFF11) APU._setLength(0, val);
        if (addr === 0xFF16) APU._setLength(1, val);

        if (addr === 0xFF12 && !(val & 0xF8)) {
            APU._channels[0].active = false;
        }
        if (addr === 0xFF17 && !(val & 0xF8)) {
            APU._channels[1].active = false;
        }

        if (addr === 0xFF14 && (val & 0x80)) APU._trigger(0);
        if (addr === 0xFF19 && (val & 0x80)) APU._trigger(1);

        if ((addr >= 0xFF11 && addr <= 0xFF14) ||
            (addr >= 0xFF16 && addr <= 0xFF19) ||
            addr === 0xFF24 || addr === 0xFF25) {
            APU._updateAll();
        }
    },

    step: function(cycles) {
        if (!APU._powered) return;
        APU._frameCycles += cycles;

        while (APU._frameCycles >= 8192) {
            APU._frameCycles -= 8192;

            if ((APU._frameStep & 1) === 0) APU._clockLengths();
            if (APU._frameStep === 7) APU._clockEnvelopes();

            APU._frameStep = (APU._frameStep + 1) & 7;
        }
    },

    _createAudioGraph: function(AudioContext) {
        APU._context = new AudioContext();
        APU._pulseWaves = [];
        APU._masterGain = APU._context.createGain();
        APU._masterGain.gain.value = 0;
        APU._masterGain.connect(APU._context.destination);
        APU._updateMasterGain();

        for (var i = 0; i < APU._channels.length; i++) {
            var oscillator = APU._context.createOscillator();
            var gain = APU._context.createGain();
            gain.gain.value = 0;
            oscillator.connect(gain);
            gain.connect(APU._masterGain);
            oscillator.start();
            APU._channels[i].oscillator = oscillator;
            APU._channels[i].gain = gain;
        }
    },

    _powerOff: function() {
        for (var i = 0; i < 0x16; i++) APU._registers[i] = 0;
        APU._powered = false;
        APU._channels[0].active = false;
        APU._channels[1].active = false;
        APU._updateAll();
    },

    _setLength: function(channelIndex, value) {
        APU._channels[channelIndex].length = 64 - (value & 0x3F);
    },

    _trigger: function(channelIndex) {
        var envelopeAddress = channelIndex === 0 ? 0x02 : 0x07;
        var envelope = APU._registers[envelopeAddress];
        var channel = APU._channels[channelIndex];

        if (!(envelope & 0xF8)) {
            channel.active = false;
            APU._updateChannel(channelIndex);
            return;
        }

        channel.active = true;
        if (channel.length === 0) channel.length = 64;
        channel.volume = envelope >> 4;
        channel.envelopeTimer = envelope & 0x07;
        if (channel.envelopeTimer === 0) channel.envelopeTimer = 8;
        APU._updateChannel(channelIndex);
    },

    _clockLengths: function() {
        for (var i = 0; i < APU._channels.length; i++) {
            var controlAddress = i === 0 ? 0x04 : 0x09;
            var channel = APU._channels[i];
            if (channel.active &&
                (APU._registers[controlAddress] & 0x40) &&
                channel.length > 0) {
                channel.length--;
                if (channel.length === 0) {
                    channel.active = false;
                    APU._updateChannel(i);
                }
            }
        }
    },

    _clockEnvelopes: function() {
        for (var i = 0; i < APU._channels.length; i++) {
            var envelopeAddress = i === 0 ? 0x02 : 0x07;
            var envelope = APU._registers[envelopeAddress];
            var pace = envelope & 0x07;
            var channel = APU._channels[i];
            if (!channel.active || pace === 0) continue;

            channel.envelopeTimer--;
            if (channel.envelopeTimer > 0) continue;
            channel.envelopeTimer = pace;

            if (envelope & 0x08) {
                if (channel.volume < 15) channel.volume++;
            } else if (channel.volume > 0) {
                channel.volume--;
            }
            APU._updateChannel(i);
        }
    },

    _updateAll: function() {
        APU._updateChannel(0);
        APU._updateChannel(1);
    },

    _updateMasterGain: function() {
        if (!APU._masterGain) return;
        var gain = APU._muted ? 0 : APU._userVolume * 0.2;
        var parameter = APU._masterGain.gain;

        if (APU._context && parameter.setTargetAtTime) {
            parameter.setTargetAtTime(gain, APU._context.currentTime, 0.01);
        } else {
            parameter.value = gain;
        }
    },

    _updateChannel: function(channelIndex) {
        var channel = APU._channels[channelIndex];
        if (!channel.oscillator || !channel.gain) return;

        var now = APU._context.currentTime;
        var periodLowAddress = channelIndex === 0 ? 0x03 : 0x08;
        var controlAddress = channelIndex === 0 ? 0x04 : 0x09;
        var dutyAddress = channelIndex === 0 ? 0x01 : 0x06;
        var period = APU._registers[periodLowAddress] |
            ((APU._registers[controlAddress] & 0x07) << 8);
        var frequency = 131072 / Math.max(1, 2048 - period);

        channel.oscillator.frequency.setValueAtTime(
            Math.min(20000, frequency), now);
        channel.oscillator.setPeriodicWave(
            APU._makePulseWave(APU._registers[dutyAddress] >> 6));

        var routing = APU._registers[0x15];
        var routed = routing & ((1 << channelIndex) | (1 << (channelIndex + 4)));
        var master = APU._registers[0x14];
        var leftVolume = ((master >> 4) & 0x07) + 1;
        var rightVolume = (master & 0x07) + 1;
        var masterVolume = (leftVolume + rightVolume) / 16;
        var gain = APU._powered && channel.active && routed ?
            (channel.volume / 15) * masterVolume : 0;

        channel.gain.gain.setTargetAtTime(gain, now, 0.003);
    },

    _makePulseWave: function(dutyIndex) {
        dutyIndex &= 3;
        if (APU._pulseWaves[dutyIndex]) {
            return APU._pulseWaves[dutyIndex];
        }

        var duties = [0.125, 0.25, 0.5, 0.75];
        var duty = duties[dutyIndex];
        var harmonics = 32;
        var real = new Float32Array(harmonics + 1);
        var imag = new Float32Array(harmonics + 1);

        real[0] = 2 * duty - 1;
        for (var n = 1; n <= harmonics; n++) {
            real[n] = 2 * Math.sin(2 * Math.PI * n * duty) / (Math.PI * n);
            imag[n] = 2 * (1 - Math.cos(2 * Math.PI * n * duty)) /
                (Math.PI * n);
        }
        APU._pulseWaves[dutyIndex] =
            APU._context.createPeriodicWave(real, imag);
        return APU._pulseWaves[dutyIndex];
    }
};

APU.reset();
