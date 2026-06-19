jsGB = {
    reset: function() {
        GPU.reset();
        MMU.reset();
        Z80.reset();
        MMU.load('rom/poke.gb');
    },

    frame: function() {
        var frameEnd = Z80._clock.t + 70224;
        do {
            Z80.exec();
        } while (Z80._clock.t < frameEnd);
    },

    _interval: null,

    run: function() {
        if (!jsGB._interval) {
            jsGB._interval = setInterval(jsGB.frame, 1000 / 60);
            document.getElementById('run').innerHTML = 'Pause';
        } else {
            clearInterval(jsGB._interval);
            jsGB._interval = null;
            document.getElementById('run').innerHTML = 'Run';
        }
    }
};

window.onload = function() {
    document.getElementById('reset').onclick = jsGB.reset;
    document.getElementById('run').onclick = jsGB.run;
    jsGB.reset();
};
