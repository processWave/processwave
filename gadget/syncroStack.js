/**
 * Copyright (c) 2009-2010
 * processWave.org (Michael Goderbauer, Markus Goetz, Marvin Killing, Martin
 * Kreichgauer, Martin Krueger, Christian Ress, Thomas Zimmermann)
 *
 * based on oryx-project.org (Martin Czuchra, Nicolas Peters, Daniel Polak,
 * Willi Tscheschner, Oliver Kopp, Philipp Giese, Sven Wagner-Boysen, Philipp Berger, Jan-Felix Schwarz)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 **/

var syncroStack = {    
    _adapter: undefined,
    
    initialize: function initialize() {
        syncroStack._adapter = adapter.connect("pw", true);
    
        syncroStack._adapter.setStateCallback(syncroStack.stateUpdatedCallback);
        oryx.addMessageDispatcher("syncroStack", this.dispatcher);
    },
    
    stateUpdatedCallback: function stateUpdatedCallback() {
        oryx.sendMessage("syncroStack", "commands", syncroStack._getStateAsArray());
    },
    
    _getStateAsArray: function _getStateAsHash() {
        var stateArray = [];
        var waveState = syncroStack._adapter.getState();
        var waveStateKeys = waveState.getKeys();
        
        for (var i = 0; i < waveStateKeys.length; i++) {
            var key = waveStateKeys[i];
            var jsonValue = JSON.parse(waveState.get(key))
            stateArray.push(jsonValue);
        }
        
        return stateArray;
    },
    
    dispatcher: function dispatcher(data) {
        if (data.action == "save") {
            syncroStack._adapter.getState().submitValue(data.message.id, JSON.stringify(data.message));
        }
    }
}