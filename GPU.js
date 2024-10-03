GPU = {
    _vram: [],
    _oam: [],
    _mode: 0,
    _modeclock: 0,
    _line: 0,
    _canvas: [],
    _scrn: {},
    _tileset: [],

    reset: function () {
    var c = document.getElementById('screen'); // Henter canvas-elementet med ID 'screen'
    GPU._tileset = [];
    if(c && c.getContext){
        GPU._canvas = c.getContext('2d');// Får 2D-tegnekonteksten for canvaset
        if(GPU._canvas) {
            if(GPU._canvas.createImageData) GPU._scrn = GPU._canvas.createImageData(160, 144);
            else if (GPU._canvas.getImageData) GPU._scrn = GPU._canvas.getImageData(0, 0, 160, 144);// Hvis createImageData ikke er tilgjengelig, sjekker om getImageData finnes
            else GPU._scrn ={
                'width': 160,
                'height': 144,
                'data': new Array(160*144*4)
                };
            for(var i=0; i< 160*144*4; i++)
                GPU._scrn.data[i] = 255;
            GPU._canvas.putImageData(GPU._scrn, 0, 0);
        }
        for(var i = 0; i < 384; i++)
        {
            GPU._tileset[i] = [];
            for(var j = 0; j < 8; j++)
            {
                GPU._tileset[i][j] = [0,0,0,0,0,0,0,0];
            }
        }
    }
    },
    step: function () {
        GPU._modeclock += Z80._r.t;
        switch(GPU._mode) {
            case 2: //OAM
                if(GPU._modeclock >=80) {
                    GPU._modeclock = 0;
                    GPU._mode = 3; //vram
                } break;

            case 3:
                if(GPU._modeclock >=172) {
                    GPU._modeclock = 0;
                    GPU._mode = 0; //H-blank
                    GPU.renderscan();  // Rendre scanlinen til pikselbufferen
                } break;

            case 0: //hblank
                if(GPU._modeclock >= 204) {
                    GPU._modeclock = 0;
                    GPU._line++;
                    if(GPU._line == 143) {
                        GPU._mode = 1;// vblank
                        GPU._canvas.putImageData(GPU._scrn, 0, 0);
                    } else {
                        GPU._mode = 2;
                    }
                } break;

            case 1: //vblank
                if(GPU._modeclock >= 456) {
                    GPU._modeclock = 0;
                    GPU._line++;
                    if(GPU._line > 153) {
                        // Restart
                        GPU._mode = 2;
                        GPU._line = 0;
                    }
                } break;}},

    updatetile: function (addr, val ) {
        addr &= 0x1FFE; // avgrenser riktig område
        var tile = (addr >> 4) & 511;
        var y = (addr >> 1) & 7;
        var sx;
        for(var x = 0; x < 8; x++)
        {
            sx = 1 << (7-x);
            GPU._tileset[tile][y][x] =
                ((GPU._vram[addr] & sx)   ? 1 : 0) +
                ((GPU._vram[addr+1] & sx) ? 2 : 0);
        }
    },

    renderscan: function () {

    },
}