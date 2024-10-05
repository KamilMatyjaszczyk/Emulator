GPU = {
    _vram: [],
    _oam: [],
    _mode: 0,
    _modeclock: 0,
    _line: 0,
    _canvas: [],
    _scrn: {},
    _tileset: [],
    _objdata: [],
    _pal: {
        bg: [],
        obj0: [],
        obj1: []
    },

    reset: function () {
    var c = document.getElementById('screen'); // Henter canvas-elementet med ID 'screen'
    GPU._tileset = [];
    if(c && c.getContext) {
        GPU._canvas = c.getContext('2d');// Får 2D-tegnekonteksten for canvaset
        if (GPU._canvas) {
            if (GPU._canvas.createImageData) GPU._scrn = GPU._canvas.createImageData(160, 144);
            else if (GPU._canvas.getImageData) GPU._scrn = GPU._canvas.getImageData(0, 0, 160, 144);// Hvis createImageData ikke er tilgjengelig, sjekker om getImageData finnes
            else GPU._scrn = {
                    'width': 160,
                    'height': 144,
                    'data': new Array(160 * 144 * 4)
                };
            for (var i = 0; i < 160 * 144 * 4; i++)
                GPU._scrn.data[i] = 255;
            GPU._canvas.putImageData(GPU._scrn, 0, 0);
        }
        for (var i = 0; i < 384; i++) {
            GPU._tileset[i] = [];
            for (var j = 0; j < 8; j++) {
                GPU._tileset[i][j] = [0, 0, 0, 0, 0, 0, 0, 0];
            }
        }
    }
        for(var i=0, n=0; i < 40; i++, n+=4)
        {
            GPU._oam[n + 0] = 0;
            GPU._oam[n + 1] = 0;
            GPU._oam[n + 2] = 0;
            GPU._oam[n + 3] = 0;
            GPU._objdata[i] = {
                'y': -16, 'x': -8,
                'tile': 0, 'palette': 0,
                'xflip': 0, 'yflip': 0, 'prio': 0, 'num': i
            };
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
            var scanrow = [];

            // bakgrunn
            if (GPU._switchbg) {
                var mapoffs = GPU._bgmap ? 0x1C00 : 0x1800;
                mapoffs += ((GPU._line + GPU._scy) & 255) >> 3;
                var lineoffs = (GPU._scx >> 3);
                var y = (GPU._line + GPU._scy) & 7;
                var x = GPU._scx & 7;
                var canvasoffs = GPU._line * 160 * 4;
                var colour;
                var tile = GPU._vram[mapoffs + lineoffs];

                if (GPU._bgtile == 1 && tile < 128) tile += 256;

                for (var i = 0; i < 160; i++) {
                    colour = GPU._pal.bg[GPU._tileset[tile][y][x]];

                    GPU._scrn.data[canvasoffs + 0] = colour[0];
                    GPU._scrn.data[canvasoffs + 1] = colour[1];
                    GPU._scrn.data[canvasoffs + 2] = colour[2];
                    GPU._scrn.data[canvasoffs + 3] = colour[3];
                    canvasoffs += 4;


                    scanrow[i] = GPU._tileset[tile][y][x];

                    x++;
                    if (x == 8) {
                        x = 0;
                        lineoffs = (lineoffs + 1) & 31;
                        tile = GPU._vram[mapoffs + lineoffs];
                        if (GPU._bgtile == 1 && tile < 128) tile += 256;
                    }
                }
            }

            // Render spriter hvis de er slått på
            if (GPU._switchobj) {
                for (var i = 0; i < 40; i++) {
                    var obj = GPU._objdata[i];


                    if (obj.y <= GPU._line && (obj.y + 8) > GPU._line) {
                        var pal = obj.pal ? GPU._pal.obj1 : GPU._pal.obj0;

                        var canvasoffs = (GPU._line * 160 + obj.x) * 4;

                        var tilerow;

                        // Hvis spriten er Y-speilet,
                        // bruk motsatt side av flisen
                        if (obj.yflip) {
                            tilerow = GPU._tileset[obj.tile]
                                [7 - (GPU._line - obj.y)];
                        } else {
                            tilerow = GPU._tileset[obj.tile]
                                [GPU._line - obj.y];
                        }

                        var colour;
                        var x;

                        for (var x = 0; x < 8; x++) {
                        // Hvis denne pikselen fortsatt er på skjermen, OG
                        // hvis den ikke er farge 0 (gjennomsiktig), OG
                        // hvis denne sprite har prioritet ELLER vises under bakgrunnen
                        // så rendrer du pikselen

                            if ((obj.x + x) >= 0 && (obj.x + x) < 160 &&
                                tilerow[x] &&
                                (obj.prio || !scanrow[obj.x + x])) {
                                // Hvis spriten er X-speilet,
                                // skriv pikslene i omvendt rekkefølge
                                colour = pal[tilerow[obj.xflip ? (7 - x) : x]];
                                GPU._scrn.data[canvasoffs + 0] = colour[0];
                                GPU._scrn.data[canvasoffs + 1] = colour[1];
                                GPU._scrn.data[canvasoffs + 2] = colour[2];
                                GPU._scrn.data[canvasoffs + 3] = colour[3];

                                canvasoffs += 4;
                            }
                        }
                    }
                }
            }
        },



    rb: function(addr)
    {
        switch(addr)
        {
            // LCD
            case 0xFF40:
                return (GPU._switchbg  ? 0x01 : 0x00) |
                    (GPU._switchobj ? 0x02 : 0x00) |
                    (GPU._bgmap     ? 0x08 : 0x00) |
                    (GPU._bgtile    ? 0x10 : 0x00) |
                    (GPU._switchlcd ? 0x80 : 0x00);

            //  Y
            case 0xFF42:
                return GPU._scy;

            //  X
            case 0xFF43:
                return GPU._scx;

            //
            case 0xFF44:
                return GPU._line;
        }
    },

    wb: function(addr, val) {
        switch (addr) {
            // LCD (0xFF40)
            case 0xFF40:
                GPU._switchbg  = (val & 0x01) ? 1 : 0;
                GPU._switchobj = (val & 0x02) ? 1 : 0;
                GPU._bgmap     = (val & 0x08) ? 1 : 0;
                GPU._bgtile    = (val & 0x10) ? 1 : 0;
                GPU._switchlcd = (val & 0x80) ? 1 : 0;
                break;

            // Y (0xFF42)
            case 0xFF42:
                GPU._scy = val;
                break;

            //  X (0xFF43)
            case 0xFF43:
                GPU._scx = val;
                break;

            // (0xFF47)
            case 0xFF47:
                for (var i = 0; i < 4; i++) {
                    switch ((val >> (i * 2)) & 3) {
                        case 0: GPU._pal.bg[i] = [255, 255, 255, 255]; break;
                        case 1: GPU._pal.bg[i] = [192, 192, 192, 255]; break;
                        case 2: GPU._pal.bg[i] = [ 96,  96,  96, 255]; break;
                        case 3: GPU._pal.bg[i] = [  0,   0,   0, 255]; break;
                    }
                }
                break;

            // (0xFF48)
            case 0xFF48:
                for (var i = 0; i < 4; i++) {
                    switch ((val >> (i * 2)) & 3) {
                        case 0: GPU._pal.obj0[i] = [255, 255, 255, 255]; break;
                        case 1: GPU._pal.obj0[i] = [192, 192, 192, 255]; break;
                        case 2: GPU._pal.obj0[i] = [ 96,  96,  96, 255]; break;
                        case 3: GPU._pal.obj0[i] = [  0,   0,   0, 255]; break;
                    }
                }
                break;

            // (0xFF49)
            case 0xFF49:
                for (var i = 0; i < 4; i++) {
                    switch ((val >> (i * 2)) & 3) {
                        case 0: GPU._pal.obj1[i] = [255, 255, 255, 255]; break;
                        case 1: GPU._pal.obj1[i] = [192, 192, 192, 255]; break;
                        case 2: GPU._pal.obj1[i] = [ 96,  96,  96, 255]; break;
                        case 3: GPU._pal.obj1[i] = [  0,   0,   0, 255]; break;
                    }
                }
                break;
        }
    },

    buildobjdata: function(addr, val)
    {
        var obj = addr >> 2;
        if(obj < 40)
        {
            switch(addr & 3)
            {
                // Y
                case 0: GPU._objdata[obj].y = val-16; break;

                // X
                case 1: GPU._objdata[obj].x = val-8; break;

                // flis
                case 2: GPU._objdata[obj].tile = val; break;

                case 3:
                    GPU._objdata[obj].palette = (val & 0x10) ? 1 : 0;
                    GPU._objdata[obj].xflip   = (val & 0x20) ? 1 : 0;
                    GPU._objdata[obj].yflip   = (val & 0x40) ? 1 : 0;
                    GPU._objdata[obj].prio    = (val & 0x80) ? 1 : 0;
                    break;
            }
        }
    },

}