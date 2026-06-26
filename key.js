KEY = {
    _rows: [0x0F, 0x0F],
    _column: 0,
    _buttons: {
        right: {row: 1, mask: 0x01},
        left: {row: 1, mask: 0x02},
        up: {row: 1, mask: 0x04},
        down: {row: 1, mask: 0x08},
        a: {row: 0, mask: 0x01},
        b: {row: 0, mask: 0x02},
        select: {row: 0, mask: 0x04},
        start: {row: 0, mask: 0x08}
    },

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

    press: function(name)
    {
        var button = KEY._buttons[name];
        if (!button) return;

        var wasReleased = KEY._rows[button.row] & button.mask;
        KEY._rows[button.row] &= ~button.mask;
        if (wasReleased && typeof MMU !== 'undefined') MMU._if |= 0x10;
    },

    release: function(name)
    {
        var button = KEY._buttons[name];
        if (!button) return;
        KEY._rows[button.row] |= button.mask;
    },

    _eventButton: function(e)
    {
        var byCode = {
            ArrowRight: 'right',
            ArrowLeft: 'left',
            ArrowUp: 'up',
            ArrowDown: 'down',
            KeyZ: 'a',
            KeyX: 'b',
            Space: 'select',
            Enter: 'start'
        };
        var byKeyCode = {
            39: 'right', 37: 'left', 38: 'up', 40: 'down',
            90: 'a', 88: 'b', 32: 'select', 13: 'start'
        };
        return byCode[e.code] || byKeyCode[e.keyCode];
    },

    kdown: function(e)
    {
        var name = KEY._eventButton(e);
        if (!name) return;
        if (e.target && /INPUT|BUTTON/.test(e.target.tagName)) return;
        e.preventDefault();
        KEY.press(name);
    },

    kup: function(e)
    {
        var name = KEY._eventButton(e);
        if (!name) return;
        e.preventDefault();
        KEY.release(name);
    }
};

window.onkeydown = KEY.kdown;
window.onkeyup = KEY.kup;
