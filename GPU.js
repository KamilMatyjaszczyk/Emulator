GPU = {
    _vram: [],
    _oam: [],
    _mode: 0,
    _modeclock: 0,
    _line: 0,
    _canvas: [],
    _scrn: {},

    reset: function () {
    var c = document.getElementById('screen');
    if(c && c.getContext){
        GPU._canvas = c.getContext('2d');
        if(GPU._canvas) {
            if(GPU._canvas.createImageData) GPU._scrn = GPU._canvas.createImageData(160, 144);
            else if (GPU._canvas.getImageData) GPU._scrn = GPU._canvas.getImageData(0, 0, 160, 144);
            else GPU._scrn ={
                'width': 160,
                'height': 144,
                'data': new Array(160*144*4)
                };
            for(var i=0; i< 160*144*4; i++)
                GPU._scrn.data[i] = 255;
            GPU._canvas.putImageData(GPU._scrn, 0, 0);
        }
    }
    },
    step: function () {


    },
}