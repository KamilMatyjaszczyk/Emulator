GPU = {
    _vram: [],
    _oam: [],
    _mode: 0,
    _modeclock: 0,
    _line: 0,
    _canvas: [],
    _scrn: {},
    _tileset: [],
    //_bgmap: 0,

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
        var tile = (addr >> 4) & 511; //finner hvilket flis
        var y = (addr >> 1) & 7;// hvilken rad i flisen
        var sx; //kontroll bitmaske
        for(var x = 0; x < 8; x++) //går gjennom 8 piksler i bestent rad
        {
            sx = 1 << (7-x);
            GPU._tileset[tile][y][x] = //oppdaterer verdien
                ((GPU._vram[addr] & sx)   ? 1 : 0) +  //første byte
                ((GPU._vram[addr+1] & sx) ? 2 : 0); // andre byte
        }
    },

    renderscan: function () {
        var mapoffs = GPU._bgmap ? 0x1c00 : 0x1800;
        mapoffs += ((GPU._line + GPU._scy) & 255) >> 3;
        var lineoffs = (GPU._scx >> 3);
        var y = (GPU._line + GPU._scy) & 7;
        var x = GPU._scx & 7;
        var canvasoffs = GPU._line * 160 * 4;
        var colour;
        var tile = GPU._vram[mapoffs + lineoffs];
        if(GPU._bgtile == 1 && tile < 128) tile += 256;
        for(var i = 0; i < 160; i++) {
            colour = GPU._pal[GPU._tileset[tile][y][x]];
            GPU._scrn.data[canvasoffs+0] = colour[0];
            GPU._scrn.data[canvasoffs+1] = colour[1];
            GPU._scrn.data[canvasoffs+2] = colour[2];
            GPU._scrn.data[canvasoffs+3] = colour[3];
            canvasoffs += 4;
            x++;
            if(x == 8) {
                x = 0;
                lineoffs = (lineoffs + 1) & 31;
                tile = GPU._vram[mapoffs + lineoffs];
                if(GPU._bgtile == 1 && tile < 128) tile += 256;
            }
        }
    },
    rb: function(addr)
    {
        switch(addr)
        {
            // LCD Control
            case 0xFF40:
                return (GPU._switchbg  ? 0x01 : 0x00) |
                    (GPU._bgmap     ? 0x08 : 0x00) |
                    (GPU._bgtile    ? 0x10 : 0x00) |
                    (GPU._switchlcd ? 0x80 : 0x00);

            // Scroll Y
            case 0xFF42:
                return GPU._scy;

            // Scroll X
            case 0xFF43:
                return GPU._scx;

            // Current scanline
            case 0xFF44:
                return GPU._line;
        }
    },

    wb: function(addr, val)
    {
        switch(addr)
        {
            // LCD Control
            case 0xFF40:
                GPU._switchbg  = (val & 0x01) ? 1 : 0;
                GPU._bgmap     = (val & 0x08) ? 1 : 0;
                GPU._bgtile    = (val & 0x10) ? 1 : 0;
                GPU._switchlcd = (val & 0x80) ? 1 : 0;
                break;

            // Scroll Y
            case 0xFF42:
                GPU._scy = val;
                break;

            // Scroll X
            case 0xFF43:
                GPU._scx = val;
                break;

            // Background palette
            case 0xFF47:
                for(var i = 0; i < 4; i++)
                {
                    switch((val >> (i * 2)) & 3)
                    {
                        case 0: GPU._pal[i] = [255,255,255,255]; break;
                        case 1: GPU._pal[i] = [192,192,192,255]; break;
                        case 2: GPU._pal[i] = [ 96, 96, 96,255]; break;
                        case 3: GPU._pal[i] = [  0,  0,  0,255]; break;
                    }
                }
                break;
        }
    }


}