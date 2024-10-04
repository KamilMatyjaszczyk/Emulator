jsGB = {
    reset: function()
    {
        GPU.reset();
        MMU.reset();
        Z80.reset();

        MMU.load('rom/ttt.gb');
    },

    frame: function()
    {
        var fclk = Z80._clock.t + 70224;
        do
        {
            Z80._map[MMU.rb(Z80._r.pc++)]();
            Z80._r.pc &= 65535;
            Z80._clock.m += Z80._r.m;
            Z80._clock.t += Z80._r.t;
            GPU.step();
        } while(Z80._clock.t < fclk);
    },

    _interval: null,

    run: function()
    {
        if(!jsGB._interval)
        {
            jsGB._interval = setTimeout(jsGB.frame, 1);
            document.getElementById('run').innerHTML = 'Pause';
        }
        else
        {
            clearInterval(jsGB._interval);
            jsGB._interval = null;
            document.getElementById('run').innerHTML = 'Run';
        }
    }
};

window.onload = function()
{
    document.getElementById('reset').onclick = jsGB.reset;
    document.getElementById('run').onclick = jsGB.run;
    jsGB.reset();
};