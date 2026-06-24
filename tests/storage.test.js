const assert = require('assert');

const storedValues = new Map();

global.window = {
    crypto: null,
    addEventListener() {},
    confirm() { return true; }
};
global.localStorage = {
    getItem(key) {
        return storedValues.has(key) ? storedValues.get(key) : null;
    },
    setItem(key, value) {
        storedValues.set(key, value);
    },
    removeItem(key) {
        storedValues.delete(key);
    }
};
global.document = {
    getElementById() {
        return {textContent: '', className: ''};
    }
};
global.MMU = {
    _eram: new Uint8Array([0x10, 0x20, 0x30, 0x40]),
    _saveDirty: true,
    getSaveData() {
        return this._eram.slice();
    },
    setSaveData(data) {
        if (data.length !== this._eram.length) throw new Error('Wrong save size');
        this._eram.set(data);
        this._saveDirty = true;
    }
};

require('../jsGB.js');

(async function() {
    jsGB._romId = await jsGB.createRomId(new Uint8Array([1, 2, 3, 4]));

    assert.equal(jsGB.flushInternalSave(true), true);
    assert.equal(MMU._saveDirty, false);
    assert.equal(storedValues.size, 1);

    MMU._eram.fill(0xFF);
    assert.equal(jsGB.restoreInternalSave(), true);
    assert.deepEqual(
        Array.from(MMU._eram),
        [0x10, 0x20, 0x30, 0x40]
    );
    assert.equal(MMU._saveDirty, false);

    const otherRomId = await jsGB.createRomId(new Uint8Array([4, 3, 2, 1]));
    assert.notEqual(jsGB._romId, otherRomId);

    console.log('Storage tests passed');
})().catch(function(error) {
    console.error(error);
    process.exitCode = 1;
});
