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

var farbrausch = {
    _adapter: null,
    _oldState: {},
    _dispatcherNamespace: "farbrausch",
    
    initialize: function initialize() {
        farbrausch._adapter = adapter.connect("fr", false);
        
        farbrausch._adapter.setStateCallback(farbrausch.stateUpdatedCallback);
        farbrausch._adapter.setParticipantCallback(farbrausch.participantsChangedCallback);
        oryx.addMessageDispatcher(farbrausch._dispatcherNamespace, farbrausch.dispatcher);
        farbrausch._sendParticipantsOfWave();
    },
    
    participantsChangedCallback: function participantsChangedCallback(participants) {
        var message = {
                        "participants": farbrausch._createUserObjects(participants)
                      };
        oryx.sendMessage(farbrausch._dispatcherNamespace, "participants", message);
    },
    
    stateUpdatedCallback: function stateUpdatedCallback() {
        var state = farbrausch._adapter.getState();
        var keys = state.getKeys();
        var oldStateHasKey;
        
        var ids = [];
        var participants = farbrausch._adapter.getParticipants();
        
        var colorMapping = {};
        var message;
        
        for (var i = 0; i < keys.length; i++) {
            oldStateHasKey = farbrausch._oldState.hasOwnProperty(keys[i]);
            if (!oldStateHasKey || (farbrausch._oldState[keys[i]] !== state.get(keys[i]))) {
                colorMapping[keys[i]] = state.get(keys[i]);
                farbrausch._oldState[keys[i]] = state.get(keys[i]);
            }
        }
        
        for (var i = 0; i < participants.length; i++) {
            ids.push(participants[i].getId());
        }
        
        message = {
                    "mapping": colorMapping
                  };
        oryx.sendMessage(farbrausch._dispatcherNamespace, "update", message);
    },
    
    _sendParticipantsOfWave: function _sendParticipantsOfWave() {
        //We can use the participantsChanged-Callback for this:
        farbrausch.participantsChangedCallback(farbrausch._adapter.getParticipants());
    },
    
    _createUserObject: function _createUserObject(participant) {
        var isCreator = (participant.getId() === this._adapter.getHost().getId());
        return {
                    "id": participant.getId(),
                    "displayName": participant.getDisplayName(),
                    "thumbnailUrl": participant.getThumbnailUrl(),
                    "isCreator": isCreator
               };
    },
    
    _createUserObjects: function _createUserObjects(participants) {
        var userObjects = [];
        for (var i = 0; i < participants.length; i++) {
                userObjects.push(farbrausch._createUserObject(participants[i]));
        };
        return userObjects;
    },
    
    dispatcher: function dispatcher(data) {
        if (data.action == "setColor") {
            farbrausch._adapter.getState().submitValue(data.message.id, data.message.color);
        }
    }
}