jsGB = {
    _interval: null,
    _romData: null,
    _romName: '',

    loadROM: async function(file) {
        jsGB.pause();
        jsGB.setStatus('Loading ' + file.name + '...');

        try {
            var buffer = await file.arrayBuffer();
            var romData = new Uint8Array(buffer);

            GPU.reset();
            MMU.reset();
            Z80.reset();
            MMU.load(romData);

            jsGB._romData = romData;
            jsGB._romName = file.name;
            document.getElementById('run').disabled = false;
            document.getElementById('reset').disabled = false;
            jsGB.updateSaveControls();
            jsGB.setStatus(file.name + ' loaded. Press Run to start.');
        } catch (error) {
            jsGB._romData = null;
            jsGB._romName = '';
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
    },

    run: function() {
        if (!jsGB._romData) {
            jsGB.setStatus('Choose a ROM file before starting the emulator.', true);
            return;
        }

        if (!jsGB._interval) {
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
        jsGB.reset();
        jsGB.setStatus(file.name + ' loaded. Press Run to continue.');
    },

    updateSaveControls: function() {
        var enabled = !!jsGB._romData && MMU._eram.length > 0;
        var saveInput = document.getElementById('save-file');
        var loadButton = document.getElementById('load-save');
        var downloadButton = document.getElementById('download-save');

        if (saveInput) saveInput.disabled = !enabled;
        if (loadButton) loadButton.disabled = !enabled;
        if (downloadButton) downloadButton.disabled = !enabled;
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

};
