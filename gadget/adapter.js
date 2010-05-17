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

var adapter = {
    allowSwapping: true, //Deaktivate Swapping here for debugging
    _modeCallbacks: [],
    _participantsCallbacks: [],
    _mode: null,
    _gotParticipantsCallback: false,
    _gotStateCallback: false,
    _stateCallbacks: [],
    _delimiter: "\\",
    
    _gadgetState: {},
    _databaseRootUrl: "http://key-value-store.appspot.com/",
    _gadgetId: null,
    _GADGET_ID_KEY: "GADGETID",
    _swapEnabled: false,
    _swapablePrefixes: [],

    initialize: function initialize(swapEnabled) {
        if (typeof swapEnabled === "boolean" && this.allowSwapping) {
            adapter._swapEnabled = swapEnabled;
        }
        if (wave && wave.isInWaveContainer()) {
            wave.setModeCallback(adapter._modeUpdatedCallback);
            wave.setParticipantCallback(adapter._participantUpdatedCallback);
            wave.setStateCallback(adapter._stateUpdatedCallback);
        }
    },
    
    connect: function connect(prefix, swapable) {
        if (typeof prefix !== "string") {
            throw "type of prefix must be string";
        }
        if (prefix != "") {
            prefix = prefix + adapter._delimiter;
        }
        if (swapable === true) {
            adapter._swapablePrefixes.push(prefix);
        }
        
        return  {
                    getHost: function getHost() {
                        return wave.getHost();
                    },
                    
                    getMode: function getMode() {
                        return wave.getMode();
                    },
                    
                    getParticipantById: function getParticipantById(id) {
                        return wave.getParticipantById(id);
                    },
                    
                    getParticipants: function getParticipants() {
                        return wave.getParticipants();
                    },
                    
                    getState: function getState() {
                        return  { 
                                    get: function get(key) {
                                        return adapter._get(prefix, key);
                                    },
                    
                                    getKeys: function getKeys() {
                                        return adapter._getKeys(prefix);
                                    },
        
                                    submitDelta: function submitDelta(delta) {
                                        return adapter._submitDelta(prefix, delta);
                                    },
                    
                                    submitValue: function submitValue(key, value) {
                                        return adapter._submitValue(prefix, key, value);
                                    }
                                 };
                    },
                    
                    getTime: function getTime() {
                        return wave.getTime();
                    },
                    
                    getViewer: function getViewer() {
                        return wave.getViewer();
                    },
                    
                    getWaveId: function getWaveId() {
                        return wave.getWaveId();
                    },
                    
                    isInWaveContainer: function isInWaveContainer() {
                        return wave.isInWaveContainer();
                    },
                    
                    log: function log(message) {
                        return wave.log(message);
                    },
                    
                    setModeCallback: function setModeCallback(callback) {
                        adapter._modeCallbacks.push(callback);
                        if (adapter._mode) {
                            callback(adapter._mode);
                        }
                    },
                    
                    setParticipantCallback: function setParticipantCallback(callback) {
                        adapter._participantsCallbacks.push(callback);
                        if (adapter._gotParticipantsCallback) {
                            callback(wave.getParticipants());
                        }
                    },
                    
                    setStateCallback: function setStateCallback(callback) {
                        adapter._stateCallbacks.push(callback);
                        if (adapter._gotStateCallback) {
                            callback();
                        }
                    },
                    
                    util: wave.util,
                    
                    Mode: wave.Mode
                };
    },
    
    _get: function _get(prefix, key) {
        var finalKey = prefix + key;
        return adapter._gadgetState[finalKey];
    },
    
    _getKeys: function _getKeys(prefix) {
        var keys = [];
        for (var key in adapter._gadgetState) {
            if (adapter._gadgetState.hasOwnProperty(key) && key.indexOf(prefix) === 0) {
                keys.push(key);
            }
        }
        return adapter._removePrefixFromKeys(prefix, keys);
    },
    
    _removePrefixFromKeys: function _removePrefixFromKeys(prefix, keys) {
        var returnKeys = [];
        
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].substr(0,prefix.length) === prefix) {
                returnKeys.push(keys[i].substring(prefix.length));
            }
        }

        return returnKeys;
    },
    
    _submitDelta: function _submitDelta(prefix, delta) {
        var newDelta = {};
        for (var key in delta) {
            if (delta.hasOwnProperty(key)) {
                newDelta[prefix + key] = delta[key];
            }
        }
        
        if (!adapter._swapEnabled) {
            wave.getState().submitDelta(newDelta);
        } else {
            adapter._pushToDb(newDelta);
            if (!adapter._isSwapable(prefix)) {
                wave.getState().submitDelta(newDelta);
            }
        }
    },
    
    _submitValue: function _submitValue(prefix, key, value) {
        var delta = {};
        delta[key] = value;
        adapter._submitDelta(prefix, delta);
    },
    
    _modeUpdatedCallback: function _modeUpdatedCallback(mode) {
        adapter._mode = mode;
        for (var i = 0; i < adapter._modeCallbacks.length; i++) {
            adapter._modeCallbacks[i](mode);
        }
    },
    
    _participantUpdatedCallback: function _participantUpdatedCallback(participants) {
        adapter._gotParticipantsCallback = true;
        for (var i = 0; i < adapter._participantsCallbacks.length; i++) {
            adapter._participantsCallbacks[i](participants);
        }
    },

    _stateUpdatedCallback: function _stateUpdatedCallback() {
        adapter._gotStateCallback = true;
        var keys = wave.getState().getKeys();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            adapter._gadgetState[key] = wave.getState().get(key);
        }
        
        if (adapter._swapEnabled) {
            adapter._setGadgetId();
            adapter._fetchFromDb();
        } else {
            adapter._invokeStateCallbacks();
        }
    },
    
    _invokeStateCallbacks: function _invokeStateCallbacks() {
        adapter._gotStateCallback = true;
        for (var i = 0; i < adapter._stateCallbacks.length; i++) {
            adapter._stateCallbacks[i]();
        }
    },
    
    //DB-Functions
    _fetchFromDb: function _fetchFromDb() {
        var params = {};
        var url = adapter._getRequestUrl() + "?" + Math.random() //prevent Caching
        params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
        gadgets.io.makeRequest(url, adapter._processDbData, params)
    },
    
    _processDbData: function _processDbData(obj) {
        var jsonData = obj.data;
        for (var key in jsonData) {
            if (jsonData.hasOwnProperty(key)) {
                adapter._gadgetState[key] = jsonData[key];
            }
        }
        adapter._invokeStateCallbacks();
    },
    
    _pushToDb: function _pushToDb(delta) {
        var params = {}; 
        params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
        params[gadgets.io.RequestParameters.METHOD] = gadgets.io.MethodType.POST;
        params[gadgets.io.RequestParameters.POST_DATA] = JSON.stringify(delta);
        gadgets.io.makeRequest(adapter._getRequestUrl(), adapter._pushToDbCallback, params);
    },
    
    _pushToDbCallback: function _pushToDbCallback() {
        var viewerId = wave.getViewer().getId();
        var incrementalValue = parseInt(adapter._gadgetState[viewerId] || 0) + 1; //Nice!
        
        adapter._gadgetState[viewerId] = incrementalValue;
        wave.getState().submitValue(viewerId, incrementalValue);
    },
    
    _isSwapable: function _isSwapable(prefix) {
        return adapter._swapablePrefixes.indexOf(prefix) !== -1;
    },
       
    _setGadgetId: function _setGadgetId() {
        var stateId = wave.getState().get(adapter._GADGET_ID_KEY);
        
        if (stateId == null) {
            adapter._gadgetId = wave.getWaveId() + "_" + Math.floor(Math.random() * 1000000);
            wave.getState().submitValue(adapter._GADGET_ID_KEY, adapter._gadgetId);
        } else if (adapter._gadgetId == null){
            adapter._gadgetId = stateId;
        } else if (adapter._gadgetId != stateId){
            adapter._gadgetId = stateId;                 
            adapter._renameGadgetInDb(stateId);
        }
    },
    
    _getRequestUrl: function _getRequestUrl() {
        return adapter._databaseRootUrl + adapter._gadgetId + "/";
    },

    _renameGadgetInDb: function _renameGadgetInDb(newId) {
        var url = adapter._getRequestUrl() + newId;
        var params = {}
        params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
        params[gadgets.io.RequestParameters.METHOD] = gadgets.io.MethodType.POST;        
        gadgets.io.makeRequest(url, null, params);
    }
}