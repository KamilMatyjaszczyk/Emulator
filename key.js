KEY = {

    //Enter er start, A er z
    _rows: [0x0F, 0x0F],
    _column: 0,

    reset: function()
    {
        KEY._rows = [0x0F, 0x0F];
        KEY._column = 0;
    },

    rb: function(addr)
    {
        var result = 0x0F;
        if (!(KEY._column & 0x20)) result &= KEY._rows[0];
        if (!(KEY._column & 0x10)) result &= KEY._rows[1];
        return result;
    },

    wb: function(addr, val)
    {
        KEY._column = val & 0x30;
    },

    kdown: function(e)
    {
        var before = KEY._rows[0] & KEY._rows[1];
        switch(e.keyCode)
        {
            case 39: KEY._rows[1] &= 0xE; break;
            case 37: KEY._rows[1] &= 0xD; break;
            case 38: KEY._rows[1] &= 0xB; break;
            case 40: KEY._rows[1] &= 0x7; break;
            case 90: KEY._rows[0] &= 0xE; break;
            case 88: KEY._rows[0] &= 0xD; break;
            case 32: KEY._rows[0] &= 0xB; break;
            case 13: KEY._rows[0] &= 0x7; break;
        }
        if ((KEY._rows[0] & KEY._rows[1]) !== before && typeof MMU !== 'undefined') {
            MMU._if |= 0x10;
        }
    },

    kup: function(e)
    {
        switch(e.keyCode)
        {
            case 39: KEY._rows[1] |= 0x1; break;
            case 37: KEY._rows[1] |= 0x2; break;
            case 38: KEY._rows[1] |= 0x4; break;
            case 40: KEY._rows[1] |= 0x8; break;
            case 90: KEY._rows[0] |= 0x1; break;
            case 88: KEY._rows[0] |= 0x2; break;
            case 32: KEY._rows[0] |= 0x4; break;
            case 13: KEY._rows[0] |= 0x8; break;
        }
    }
};

window.onkeydown = KEY.kdown;
window.onkeyup = KEY.kup;
