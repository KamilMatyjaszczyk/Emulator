// Game Boy LCD controller / pixel processing unit.
GPU = {
    _vram: [],
    _oam: [],
    _tileset: [],
    _objdata: [],
    _canvas: null,
    _scrn: null,

    _mode: 0,
    _modeclock: 0,
    _line: 0,
    _lyc: 0,
    _statControl: 0,
    _lycMatch: false,

    _switchbg: 0,
    _switchobj: 0,
    _objsize: 0,
    _bgmap: 0,
    _bgtile: 0,
    _switchwin: 0,
    _winmap: 0,
    _switchlcd: 0,
    _scx: 0,
    _scy: 0,
    _wx: 0,
    _wy: 0,

    _pal: {
        bg: [],
        obj0: [],
        obj1: []
    },

    reset: function() {
        GPU._vram = new Uint8Array(0x2000);
        GPU._oam = new Uint8Array(0xA0);
        GPU._tileset = [];
        GPU._objdata = [];

        GPU._mode = 0;
        GPU._modeclock = 0;
        GPU._line = 0;
        GPU._lyc = 0;
        GPU._statControl = 0;
        GPU._lycMatch = false;

        GPU._switchbg = 0;
        GPU._switchobj = 0;
        GPU._objsize = 0;
        GPU._bgmap = 0;
        GPU._bgtile = 0;
        GPU._switchwin = 0;
        GPU._winmap = 0;
        GPU._switchlcd = 0;
        GPU._scx = 0;
        GPU._scy = 0;
        GPU._wx = 0;
        GPU._wy = 0;

        for (var tile = 0; tile < 384; tile++) {
            GPU._tileset[tile] = [];
            for (var row = 0; row < 8; row++) {
                GPU._tileset[tile][row] = new Uint8Array(8);
            }
        }

        for (var sprite = 0; sprite < 40; sprite++) {
            GPU._objdata[sprite] = {
                y: -16,
                x: -8,
                tile: 0,
                palette: 0,
                xflip: 0,
                yflip: 0,
                prio: 0,
                num: sprite
            };
        }

        GPU._setPalette('bg', 0xFC);
        GPU._setPalette('obj0', 0xFF);
        GPU._setPalette('obj1', 0xFF);

        var canvas = document.getElementById('screen');
        if (canvas && canvas.getContext) {
            canvas.width = 160;
            canvas.height = 144;
            GPU._canvas = canvas.getContext('2d');
            GPU._scrn = GPU._canvas.createImageData(160, 144);
            GPU._clearScreen();
            GPU._present();
        }
    },

    step: function() {
        if (!GPU._switchlcd) {
            GPU._mode = 0;
            GPU._modeclock = 0;
            GPU._line = 0;
            GPU._checkLYC();
            return;
        }

        GPU._modeclock += Z80._r.t;

        var progressed = true;
        while (progressed) {
            progressed = false;

            if (GPU._mode === 2 && GPU._modeclock >= 80) {
                GPU._modeclock -= 80;
                GPU._setMode(3);
                progressed = true;
            } else if (GPU._mode === 3 && GPU._modeclock >= 172) {
                GPU._modeclock -= 172;
                GPU.renderscan();
                GPU._setMode(0);
                progressed = true;
            } else if (GPU._mode === 0 && GPU._modeclock >= 204) {
                GPU._modeclock -= 204;
                GPU._line++;
                GPU._checkLYC();

                if (GPU._line === 144) {
                    GPU._setMode(1);
                    MMU._if |= 0x01;
                    GPU._present();
                } else {
                    GPU._setMode(2);
                }
                progressed = true;
            } else if (GPU._mode === 1 && GPU._modeclock >= 456) {
                GPU._modeclock -= 456;
                GPU._line++;

                if (GPU._line > 153) {
                    GPU._line = 0;
                    GPU._checkLYC();
                    GPU._setMode(2);
                } else {
                    GPU._checkLYC();
                }
                progressed = true;
            }
        }
    },

    _setMode: function(mode) {
        GPU._mode = mode;

        if (mode === 0 && (GPU._statControl & 0x08)) MMU._if |= 0x02;
        if (mode === 1 && (GPU._statControl & 0x10)) MMU._if |= 0x02;
        if (mode === 2 && (GPU._statControl & 0x20)) MMU._if |= 0x02;
    },

    _checkLYC: function() {
        var match = GPU._line === GPU._lyc;
        if (match && !GPU._lycMatch && (GPU._statControl & 0x40)) {
            MMU._if |= 0x02;
        }
        GPU._lycMatch = match;
    },

    _present: function() {
        if (GPU._canvas && GPU._scrn) {
            GPU._canvas.putImageData(GPU._scrn, 0, 0);
        }
    },

    _clearScreen: function() {
        if (!GPU._scrn) return;
        for (var pixel = 0; pixel < 160 * 144; pixel++) {
            var offset = pixel * 4;
            GPU._scrn.data[offset] = 255;
            GPU._scrn.data[offset + 1] = 255;
            GPU._scrn.data[offset + 2] = 255;
            GPU._scrn.data[offset + 3] = 255;
        }
    },

    updatetile: function(addr) {
        addr &= 0x1FFE;
        if (addr >= 0x1800) return;

        var tile = addr >> 4;
        var row = (addr >> 1) & 7;
        var low = GPU._vram[addr];
        var high = GPU._vram[addr + 1];

        for (var x = 0; x < 8; x++) {
            var mask = 1 << (7 - x);
            GPU._tileset[tile][row][x] =
                (low & mask ? 1 : 0) |
                (high & mask ? 2 : 0);
        }
    },

    _tileIndex: function(tileNumber) {
        if (GPU._bgtile) return tileNumber;
        return tileNumber < 0x80 ? tileNumber + 256 : tileNumber;
    },

    _backgroundPixel: function(screenX) {
        if (!GPU._switchbg) return 0;

        var useWindow = GPU._switchwin &&
            GPU._line >= GPU._wy &&
            screenX >= GPU._wx - 7;

        var pixelX;
        var pixelY;
        var mapBase;

        if (useWindow) {
            pixelX = screenX - (GPU._wx - 7);
            pixelY = GPU._line - GPU._wy;
            mapBase = GPU._winmap ? 0x1C00 : 0x1800;
        } else {
            pixelX = (screenX + GPU._scx) & 0xFF;
            pixelY = (GPU._line + GPU._scy) & 0xFF;
            mapBase = GPU._bgmap ? 0x1C00 : 0x1800;
        }

        var mapAddress = mapBase +
            ((pixelY >> 3) * 32) +
            (pixelX >> 3);
        var tileNumber = GPU._vram[mapAddress];
        var tile = GPU._tileIndex(tileNumber);

        return GPU._tileset[tile][pixelY & 7][pixelX & 7];
    },

    renderscan: function() {
        if (!GPU._scrn || GPU._line >= 144) return;

        var background = new Uint8Array(160);
        var lineOffset = GPU._line * 160 * 4;

        for (var x = 0; x < 160; x++) {
            var colourIndex = GPU._backgroundPixel(x);
            background[x] = colourIndex;
            GPU._writePixel(lineOffset + x * 4, GPU._pal.bg[colourIndex]);
        }

        if (!GPU._switchobj) return;

        var height = GPU._objsize ? 16 : 8;
        var sprites = [];

        for (var i = 0; i < 40 && sprites.length < 10; i++) {
            var candidate = GPU._objdata[i];
            if (GPU._line >= candidate.y && GPU._line < candidate.y + height) {
                sprites.push(candidate);
            }
        }

        // Lower X and then lower OAM index have priority on the DMG.
        sprites.sort(function(left, right) {
            return left.x - right.x || left.num - right.num;
        });

        for (var screenX = 0; screenX < 160; screenX++) {
            for (var s = 0; s < sprites.length; s++) {
                var obj = sprites[s];
                if (screenX < obj.x || screenX >= obj.x + 8) continue;

                var sourceX = screenX - obj.x;
                if (obj.xflip) sourceX = 7 - sourceX;

                var sourceY = GPU._line - obj.y;
                if (obj.yflip) sourceY = height - 1 - sourceY;

                var tile = obj.tile;
                if (height === 16) {
                    tile &= 0xFE;
                    if (sourceY >= 8) {
                        tile++;
                        sourceY -= 8;
                    }
                }

                var spriteColour = GPU._tileset[tile][sourceY][sourceX];
                if (spriteColour === 0) continue;
                if (obj.prio && background[screenX] !== 0) break;

                var palette = obj.palette ? GPU._pal.obj1 : GPU._pal.obj0;
                GPU._writePixel(lineOffset + screenX * 4, palette[spriteColour]);
                break;
            }
        }
    },

    _writePixel: function(offset, colour) {
        GPU._scrn.data[offset] = colour[0];
        GPU._scrn.data[offset + 1] = colour[1];
        GPU._scrn.data[offset + 2] = colour[2];
        GPU._scrn.data[offset + 3] = 255;
    },

    _setPalette: function(name, value) {
        var shades = [255, 192, 96, 0];
        for (var index = 0; index < 4; index++) {
            var shade = shades[(value >> (index * 2)) & 3];
            GPU._pal[name][index] = [shade, shade, shade, 255];
        }
    },

    rb: function(addr) {
        switch (addr) {
            case 0xFF40:
                return (GPU._switchbg ? 0x01 : 0) |
                    (GPU._switchobj ? 0x02 : 0) |
                    (GPU._objsize ? 0x04 : 0) |
                    (GPU._bgmap ? 0x08 : 0) |
                    (GPU._bgtile ? 0x10 : 0) |
                    (GPU._switchwin ? 0x20 : 0) |
                    (GPU._winmap ? 0x40 : 0) |
                    (GPU._switchlcd ? 0x80 : 0);
            case 0xFF41:
                return 0x80 | GPU._statControl |
                    (GPU._line === GPU._lyc ? 0x04 : 0) |
                    GPU._mode;
            case 0xFF42: return GPU._scy;
            case 0xFF43: return GPU._scx;
            case 0xFF44: return GPU._line;
            case 0xFF45: return GPU._lyc;
            case 0xFF47: return GPU._bgPaletteValue || 0xFC;
            case 0xFF48: return GPU._obj0PaletteValue || 0xFF;
            case 0xFF49: return GPU._obj1PaletteValue || 0xFF;
            case 0xFF4A: return GPU._wy;
            case 0xFF4B: return GPU._wx;
        }
    },

    wb: function(addr, val) {
        val &= 0xFF;

        switch (addr) {
            case 0xFF40:
                var wasEnabled = GPU._switchlcd;
                GPU._switchbg = val & 0x01 ? 1 : 0;
                GPU._switchobj = val & 0x02 ? 1 : 0;
                GPU._objsize = val & 0x04 ? 1 : 0;
                GPU._bgmap = val & 0x08 ? 1 : 0;
                GPU._bgtile = val & 0x10 ? 1 : 0;
                GPU._switchwin = val & 0x20 ? 1 : 0;
                GPU._winmap = val & 0x40 ? 1 : 0;
                GPU._switchlcd = val & 0x80 ? 1 : 0;

                if (!GPU._switchlcd) {
                    GPU._mode = 0;
                    GPU._modeclock = 0;
                    GPU._line = 0;
                    GPU._checkLYC();
                } else if (!wasEnabled) {
                    GPU._modeclock = 0;
                    GPU._line = 0;
                    GPU._setMode(2);
                    GPU._checkLYC();
                }
                break;
            case 0xFF41:
                GPU._statControl = val & 0x78;
                break;
            case 0xFF42: GPU._scy = val; break;
            case 0xFF43: GPU._scx = val; break;
            case 0xFF45:
                GPU._lyc = val;
                GPU._checkLYC();
                break;
            case 0xFF47:
                GPU._bgPaletteValue = val;
                GPU._setPalette('bg', val);
                break;
            case 0xFF48:
                GPU._obj0PaletteValue = val;
                GPU._setPalette('obj0', val);
                break;
            case 0xFF49:
                GPU._obj1PaletteValue = val;
                GPU._setPalette('obj1', val);
                break;
            case 0xFF4A: GPU._wy = val; break;
            case 0xFF4B: GPU._wx = val; break;
        }
    },

    buildobjdata: function(addr, val) {
        var sprite = addr >> 2;
        if (sprite >= 40) return;

        var obj = GPU._objdata[sprite];
        switch (addr & 3) {
            case 0: obj.y = val - 16; break;
            case 1: obj.x = val - 8; break;
            case 2: obj.tile = val; break;
            case 3:
                obj.palette = val & 0x10 ? 1 : 0;
                obj.xflip = val & 0x20 ? 1 : 0;
                obj.yflip = val & 0x40 ? 1 : 0;
                obj.prio = val & 0x80 ? 1 : 0;
                break;
        }
    }
};
