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
        var oldState = KEY.rb(addr);
        KEY._column = val & 0x30;
        KEY._requestInterruptOnFallingEdge(oldState, KEY.rb(addr));
    },

    press: function(name)
    {
        var button = KEY._buttons[name];
        if (!button) return;

        var oldState = KEY.rb(0xFF00);
        KEY._rows[button.row] &= ~button.mask;
        KEY._requestInterruptOnFallingEdge(oldState, KEY.rb(0xFF00));
    },

    release: function(name)
    {
        var button = KEY._buttons[name];
        if (!button) return;
        KEY._rows[button.row] |= button.mask;
    },

    _requestInterruptOnFallingEdge: function(oldState, newState)
    {
        var fallingBits = oldState & ~newState & 0x0F;
        if (fallingBits && typeof MMU !== 'undefined') MMU._if |= 0x10;
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

    _isTextInput: function(target)
    {
        if (!target) return false;
        if (target.isContentEditable) return true;
        return /INPUT|SELECT|TEXTAREA/.test(target.tagName);
    },

    kdown: function(e)
    {
        var name = KEY._eventButton(e);
        if (!name) return;
        if (KEY._isTextInput(e.target)) return;
        e.preventDefault();
        KEY.press(name);
    },

    kup: function(e)
    {
        var name = KEY._eventButton(e);
        if (!name) return;
        if (KEY._isTextInput(e.target)) return;
        e.preventDefault();
        KEY.release(name);
    }
};

window.onkeydown = KEY.kdown;
window.onkeyup = KEY.kup;
