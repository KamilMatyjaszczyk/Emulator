jsGB = {
    _interval: null,
    _romData: null,
    _romName: '',
    _romId: '',
    _lastInternalSave: 0,
    _internalSaveDelay: 1000,
    _storagePrefix: 'jsgb.save.v1.',
    _audioSettingsKey: 'jsgb.audio.v1',

    loadROM: async function(file) {
        jsGB.pause();
        jsGB.setStatus('Loading ' + file.name + '...');

        try {
            var buffer = await file.arrayBuffer();
            var romData = new Uint8Array(buffer);
            var romId = await jsGB.createRomId(romData);

            GPU.reset();
            MMU.reset();
            Z80.reset();
            MMU.load(romData);

            jsGB._romData = romData;
            jsGB._romName = file.name;
            jsGB._romId = romId;
            var restored = jsGB.restoreInternalSave();
            document.getElementById('run').disabled = false;
            document.getElementById('reset').disabled = false;
            jsGB.updateSaveControls();
            jsGB.setStatus(
                file.name + (restored ? ' and its browser save' : '') +
                ' loaded. Press Run to start.'
            );
        } catch (error) {
            jsGB._romData = null;
            jsGB._romName = '';
            jsGB._romId = '';
            document.getElementById('run').disabled = true;
            document.getElementById('reset').disabled = true;
            jsGB.updateSaveControls();
            jsGB.setStatus(error.message, true);
            console.error(error);
        }
    },

    reset: function() {
        if (!jsGB._romData) return;

        jsGB.pause();
        GPU.reset();
        MMU.reset();
        Z80.reset();

        jsGB.setStatus(jsGB._romName + ' reset. Save RAM was preserved.');
    },

    frame: function() {
        var frameEnd = Z80._clock.t + 70224;
        do {
            Z80.exec();
        } while (Z80._clock.t < frameEnd);
        jsGB.flushInternalSave(false);
    },

    run: function() {
        if (!jsGB._romData) {
            jsGB.setStatus('Choose a ROM file before starting the emulator.', true);
            return;
        }

        if (!jsGB._interval) {
            if (typeof APU !== 'undefined') {
                APU.resume().catch(function(error) {
                    console.warn('Could not start browser audio:', error);
                });
            }
            jsGB._interval = setInterval(jsGB.frame, 1000 / 60);
            document.getElementById('run').textContent = 'Pause';
            jsGB.setStatus('Running ' + jsGB._romName);
        } else {
            jsGB.pause();
            jsGB.setStatus(jsGB._romName + ' paused.');
        }
    },

    pause: function() {
        if (jsGB._interval) {
            clearInterval(jsGB._interval);
            jsGB._interval = null;
        }

        var runButton = document.getElementById('run');
        if (runButton) runButton.textContent = 'Run';
        if (typeof APU !== 'undefined') APU.suspend();
        jsGB.flushInternalSave(true);
    },

    setStatus: function(message, isError) {
        var status = document.getElementById('status');
        status.textContent = message;
        status.className = isError ? 'error' : '';
    },

    downloadSave: function() {
        if (!jsGB._romData) {
            jsGB.setStatus(
                'Choose a ROM file before downloading the save file.', true);
            return;
        }

        if (!MMU._eram.length) {
            jsGB.setStatus('The selected ROM has no cartridge RAM.', true);
            return;
        }

        jsGB.pause();
        const saveData = MMU.getSaveData();
        const blob = new Blob([saveData], {
            type: 'application/octet-stream'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const name = jsGB._romName.replace(/\.(gb|gbc)$/i, '');

        link.href = url;
        link.download = name + '.sav';
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(function() {
            URL.revokeObjectURL(url);
        }, 0);

        jsGB.setStatus('Save file downloaded. Press Run to continue.');
    },

    loadSave: async function(file) {
        if (!jsGB._romData) {
            jsGB.setStatus(
                'Choose a ROM file before loading the save file.', true);
            return;
        }

        if (!MMU._eram.length) {
            throw new Error('The selected ROM has no cartridge RAM.');
        }

        jsGB.pause();
        const data = new Uint8Array(await file.arrayBuffer());
        MMU.setSaveData(data);
        jsGB.flushInternalSave(true);
        jsGB.reset();
        jsGB.setStatus(
            file.name + ' loaded and stored in this browser. Press Run to continue.'
        );
    },

    createRomId: async function(data) {
        if (window.crypto && window.crypto.subtle) {
            var exactBuffer = data.buffer.slice(
                data.byteOffset, data.byteOffset + data.byteLength);
            var digest = await window.crypto.subtle.digest('SHA-256', exactBuffer);
            return Array.from(new Uint8Array(digest), function(byte) {
                return byte.toString(16).padStart(2, '0');
            }).join('');
        }

        // Stable fallback for browsers without SubtleCrypto.
        var hash = 2166136261;
        for (var i = 0; i < data.length; i++) {
            hash ^= data[i];
            hash = Math.imul(hash, 16777619);
        }
        return data.length.toString(16) + '-' + (hash >>> 0).toString(16);
    },

    _bytesToBase64: function(data) {
        var binary = '';
        var chunkSize = 0x8000;
        for (var offset = 0; offset < data.length; offset += chunkSize) {
            binary += String.fromCharCode.apply(
                null, data.subarray(offset, offset + chunkSize));
        }
        return btoa(binary);
    },

    _base64ToBytes: function(encoded) {
        var binary = atob(encoded);
        var data = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            data[i] = binary.charCodeAt(i);
        }
        return data;
    },

    flushInternalSave: function(force) {
        if (!jsGB._romId || !MMU._eram.length || !MMU._saveDirty) return false;

        var now = Date.now();
        if (!force && now - jsGB._lastInternalSave < jsGB._internalSaveDelay) {
            return false;
        }

        try {
            var record = {
                version: 1,
                size: MMU._eram.length,
                updatedAt: now,
                data: jsGB._bytesToBase64(MMU.getSaveData())
            };
            localStorage.setItem(
                jsGB._storagePrefix + jsGB._romId,
                JSON.stringify(record)
            );
            MMU._saveDirty = false;
            jsGB._lastInternalSave = now;
            return true;
        } catch (error) {
            console.warn('Could not store save RAM in the browser:', error);
            return false;
        }
    },

    restoreInternalSave: function() {
        if (!jsGB._romId || !MMU._eram.length) return false;

        try {
            var value = localStorage.getItem(jsGB._storagePrefix + jsGB._romId);
            if (!value) return false;

            var record = JSON.parse(value);
            var data = jsGB._base64ToBytes(record.data);
            if (record.version !== 1 ||
                record.size !== MMU._eram.length ||
                data.length !== MMU._eram.length) {
                throw new Error('Stored save size does not match this cartridge');
            }

            MMU.setSaveData(data);
            MMU._saveDirty = false;
            return true;
        } catch (error) {
            console.warn('Could not restore browser save:', error);
            return false;
        }
    },

    clearInternalSave: function() {
        if (!jsGB._romId || !MMU._eram.length) return;
        if (!window.confirm('Delete the browser save for this ROM?')) return;

        jsGB.pause();
        localStorage.removeItem(jsGB._storagePrefix + jsGB._romId);
        MMU._eram.fill(0xFF);
        MMU._saveDirty = false;
        GPU.reset();
        MMU.reset();
        Z80.reset();
        jsGB.setStatus(
            'Browser save deleted for ' + jsGB._romName +
            '. Press Run to start without saved progress.'
        );
    },

    updateSaveControls: function() {
        var enabled = !!jsGB._romData && MMU._eram.length > 0;
        var saveInput = document.getElementById('save-file');
        var loadButton = document.getElementById('load-save');
        var downloadButton = document.getElementById('download-save');
        var clearButton = document.getElementById('clear-save');

        if (saveInput) saveInput.disabled = !enabled;
        if (loadButton) loadButton.disabled = !enabled;
        if (downloadButton) downloadButton.disabled = !enabled;
        if (clearButton) clearButton.disabled = !enabled;
    },

    loadAudioSettings: function() {
        try {
            var saved = JSON.parse(
                localStorage.getItem(jsGB._audioSettingsKey) || '{}');
            if (typeof saved.volume === 'number') APU.setVolume(saved.volume);
            if (typeof saved.muted === 'boolean') APU.setMuted(saved.muted);
        } catch (error) {
            console.warn('Could not load audio settings:', error);
        }
        jsGB.updateAudioControls();
    },

    saveAudioSettings: function() {
        try {
            localStorage.setItem(jsGB._audioSettingsKey, JSON.stringify({
                volume: APU._userVolume,
                muted: APU._muted
            }));
        } catch (error) {
            console.warn('Could not store audio settings:', error);
        }
    },

    updateAudioControls: function() {
        var slider = document.getElementById('volume');
        var output = document.getElementById('volume-value');
        var muteButton = document.getElementById('mute');
        var percent = Math.round(APU._userVolume * 100);

        if (slider) slider.value = percent;
        if (output) output.textContent = percent + '%';
        if (muteButton) {
            muteButton.textContent = APU._muted ? 'Unmute' : 'Mute';
            muteButton.setAttribute('aria-pressed', APU._muted ? 'true' : 'false');
        }
    }
};

window.onload = function() {
    var romInput = document.getElementById('rom-file');

    romInput.onchange = function(event) {
        var file = event.target.files[0];
        if (file) jsGB.loadROM(file);
    };

    document.getElementById('reset').onclick = jsGB.reset;
    document.getElementById('run').onclick = jsGB.run;
    document.getElementById('run').disabled = true;
    document.getElementById('reset').disabled = true;
    jsGB.updateSaveControls();
    jsGB.loadAudioSettings();

    GPU.reset();
    jsGB.setStatus('Choose a .gb or .gbc ROM file to begin.');

    document.getElementById('download-save').onclick = function() {
        jsGB.downloadSave();
    };

    document.getElementById('load-save').onclick = async function() {
        const input = document.getElementById('save-file');
        const file = input.files[0];

        if (!file) {
            jsGB.setStatus('Choose a .sav file first.', true);
            return;
        }

        try {
            await jsGB.loadSave(file);
        } catch (error) {
            jsGB.setStatus(error.message, true);
        }
    };

    document.getElementById('clear-save').onclick = jsGB.clearInternalSave;

    document.getElementById('volume').oninput = function(event) {
        APU.setVolume(Number(event.target.value) / 100);
        jsGB.updateAudioControls();
        jsGB.saveAudioSettings();
    };

    document.getElementById('mute').onclick = function() {
        APU.toggleMuted();
        jsGB.updateAudioControls();
        jsGB.saveAudioSettings();
    };

    window.addEventListener('pagehide', function() {
        jsGB.flushInternalSave(true);
    });
};
