jsGB = {
    _interval: null,
    _romData: null,
    _romName: '',

    loadROM: async function(file) {
        jsGB.pause();
        jsGB.setStatus('Loading ' + file.name + '...');

        try {
            var buffer = await file.arrayBuffer();
            jsGB._romData = new Uint8Array(buffer);
            jsGB._romName = file.name;
            jsGB.reset();
            document.getElementById('run').disabled = false;
            document.getElementById('reset').disabled = false;
            jsGB.setStatus(file.name + ' loaded. Press Run to start.');
        } catch (error) {
            jsGB._romData = null;
            jsGB._romName = '';
            document.getElementById('run').disabled = true;
            document.getElementById('reset').disabled = true;
            jsGB.setStatus(error.message, true);
            console.error(error);
        }
    },

    reset: function() {
        if (!jsGB._romData) {
            jsGB.setStatus('Choose a .gb or .gbc ROM file first.');
            return;
        }

        jsGB.pause();
        GPU.reset();
        MMU.reset();
        Z80.reset();
        MMU.load(jsGB._romData);
        jsGB.setStatus(jsGB._romName + ' reset. Press Run to start.');
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

    GPU.reset();
    jsGB.setStatus('Choose a .gb or .gbc ROM file to begin.');
};
