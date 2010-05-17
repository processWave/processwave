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

if (!ORYX.Plugins) 
    ORYX.Plugins = new Object();
    
    
ORYX.Plugins.Syncro = Clazz.extend({
    debug: false,
    facade: undefined,

    LAMPORT_OFFSET : 3,
    lamportClock : 1,
    localState : {},
    
    // Lib (locaState, etc.) has not been initialized yet.
    initialized : false, 
    
    construct: function construct(facade) {
        this.facade = facade;
        
        this.facade.registerOnEvent(ORYX.CONFIG.EVENT_NEW_POST_MESSAGE_RECEIVED, this.handleNewPostMessageReceived.bind(this));
        this.facade.registerOnEvent(ORYX.CONFIG.EVENT_AFTER_COMMANDS_EXECUTED, this.handleAfterCommandsExecuted.bind(this));
    },
    
/*** public functions ***/

    handleNewPostMessageReceived: function handleNewPostMessageReceived(event) {
        var data = event.data;
        if (data.target !== "syncroStack") {
            return;
        }
        
        var commandsArray = data.message;
        this.handleRemoteCommands(commandsArray);
    },
    
    handleRemoteCommands: function handleRemoteCommands(remoteCommands) {
        var remoteCommand;
        var newCommand;
        var localCommand;
        var localCommands;
        
        var newCommands = [];
        var revertCommands;
        var applyCommands;
        
        // fetch new commands obtained from other users, merge into local state
        for (var i = 0; i < remoteCommands.length; i++) {
            remoteCommand = remoteCommands[i];
            if (typeof this.localState[remoteCommand.id] === "undefined") {
                this.localState[remoteCommand.id] = remoteCommand;
                newCommands.push(remoteCommand);
            }
        }
        
        // bring new and local commands into chronological order
        newCommands.sort(this.compareCommands);
        localCommands = this.getValuesFromDict(this.localState);
        localCommands.sort(this.compareCommands);
        
        // set lamportClock accordingly
        this.lamportClock = this.getClockValueFromSortedCommands(localCommands);
        
        if (!this.initialized) {
            this.initialized = true;
            this.stackInitialized(newCommands);
            return;
        }
        
        // For each new command find all subsequent applied commands and mark them as to be
        // reverted. Pass them and the new command to the newCommandCallback function.
        localCommands.reverse();
        for (var n = 0; n < newCommands.length; n++) {
            newCommand = newCommands[n];
            revertCommands = [];
            applyCommands = [];
            for (var j = 0; j < localCommands.length; j++) {
                localCommand = localCommands[j];
                if (localCommand === newCommand) {
                    applyCommands.push(localCommand);
                    applyCommands.reverse();
                    // Callback
                    this.newCommand(newCommand, revertCommands, applyCommands);
                    break;
                } else if (!this.inArray(localCommand, newCommands)) {
                    // only commands that have already been applied and therefore are not
                    // part of the new commands need to be reverted
                    applyCommands.push(localCommand);
                    revertCommands.push(localCommand);
                }
            }
        }

    },
    
    stackInitialized: function stackInitialized(stackArray) {
        for (var i = 0; i < stackArray.length; i++) {
            var stackItem = stackArray[i];
            var unpackedCommands = this.unpackToCommands(stackItem);
            
            if (unpackedCommands.length !== 0) {
                this.facade.executeCommands(unpackedCommands);
            }
        }
        
        this.facade.raiseEvent({
            'type': ORYX.CONFIG.EVENT_SYNCRO_INITIALIZATION_DONE
        });
    },
    
    newCommand: function newCommand(newCommand, revertCommands, applyCommands) {
        var i;
        if (this.debug) console.log("-----");
        
        for (i = 0; i < revertCommands.length; i++) {
            if (this.debug) console.log({'revert':revertCommands[i]});
            
            var commands = this.getCommandsFromStack(revertCommands[i]);
            if (typeof commands === "undefined") {
                commands = this.unpackToCommands(revertCommands[i]);
            }
            
            this.facade.rollbackCommands(commands);
        }
        for (i = 0; i < applyCommands.length; i++) {
            if (this.debug) console.log({'apply':applyCommands[i]});
            
            var unpackedCommands = this.unpackToCommands(applyCommands[i]);
            if (unpackedCommands.length !== 0) {
                this.facade.executeCommands(unpackedCommands);
            }
        }
    },
    
    getCommandsFromStack: function getCommandsFromStack(stackItem) {
        var commandArrayOfStrings = stackItem.commands;
        var commandDataArray = [];        
        
        for (var i = 0; i < commandArrayOfStrings.length; i++) {
            commandDataArray.push(commandArrayOfStrings[i].evalJSON());
        }
        
        if (!commandDataArray[0].putOnStack) {
            return undefined;
        }
        
        var stack = ORYX.Stacks.undo;
        var ids = this.getIdsFromCommandArray(commandDataArray);
        
        for (i = 0; stack.length; i++) {
            for (var j = 0; j < ids.length; j++) {
                if (ids[j] === stack[i][0].getCommandId()) {
                    return stack[i];
                }
            }
        }
        
        return [];
    },
    
    /** private functions **/
    
    getIdsFromCommandArray: function getIdsFromCommandArray(commandArray) {
        var commandIds = [];        
        for (var i = 0; i < commandArray.length; i++) {
            commandIds.push(commandArray[i].id);
        }        
        return commandIds;
    },
    
    compareCommands: function compareCommands(command1, command2) {
        // compare-function to sort commands chronologically
        var delta = command1.clock - command2.clock;
        if (delta === 0) {
            if (command1.userId < command2.userId) {
                return -1;
            } else {
                return 1;
            }
        }
        return delta;
    },
    
    getClockValueFromSortedCommands: function getClockValueFromSortedCommands(commands) {
        // return max(highest clock in commands, current lamportClock) + lamport offset
        var lamportClock = this.lamportClock;
        
        if (commands.length === 0) {
            return lamportClock;
        }
        
        var lastCommand = commands[commands.length - 1];
        var lastClock = lastCommand.clock;
            
        if (lastClock >= lamportClock) {
            return lastClock + this.LAMPORT_OFFSET;
        }
        return lamportClock;
    },
    
    getNextCommandId: function getNextCommandId() {
        return this.lamportClock + "\\" + this.facade.getUserId();
    },
    
    unpackToCommands: function unpackToCommands(stackItem) {
        var commandArrayOfStrings = stackItem.commands;

        var commandArray = [];
        for (var i = 0; i < commandArrayOfStrings.length; i++) {
            var cmdObj = commandArrayOfStrings[i].evalJSON();
            var commandInstance = ORYX.Core.Commands[cmdObj.name].prototype.jsonDeserialize(this.facade, commandArrayOfStrings[i]);
            if (typeof commandInstance === 'undefined') {
                return [];
            }
            commandArray.push(commandInstance);
        }

        return commandArray;
    },
    
    /** util **/
    
    getValuesFromDict: function getValuesFromDict(dict) {
        var values = [];
        for (var key in dict) {
            if (dict.hasOwnProperty(key)) {
                values.push(dict[key]);
            }
        }
        return values;
    },
    
    inArray: function inArray(value, array) {
        for (var i = 0; i < array.length; i++) {
            if (array[i] === value) {
                return true;
            }
        }
        return false;
    },
    
    /**
    * Listens to all commands executed by the editor.
    * 
    * Commands that have been constructed locally must be pushed
    * to the adapter on the other side of the frame in order to
    * synchronize among all participants. Remote commands are discarded.
    *
    * @param {Object} evt
    */
    handleAfterCommandsExecuted: function handleAfterCommandsExecuted(evt) {        
        if (!evt.commands || !evt.commands[0].isLocal()) { 
            return;
        }

        var serializedCommands = [];
        for (var i = 0; i < evt.commands.length; i++) {
            if (evt.commands[i] instanceof ORYX.Core.AbstractCommand) {
                serializedCommands.push(evt.commands[i].jsonSerialize());
            }
        }
        
        this.pushCommands(serializedCommands);
    },
    
    pushCommands: function pushCommands(commands) {
        var commandId = this.getNextCommandId();
        var delta = {
            'commands': commands,
            'userId': this.facade.getUserId(),
            'id': commandId,
            'clock': this.lamportClock
        };
        
        // push into local state
        this.localState[commandId] = delta;
        // push into remote state
        this.facade.raiseEvent({
            'type': ORYX.CONFIG.EVENT_POST_MESSAGE,
            'target': 'syncroStack',
            'action': 'save',
            'message': delta
        });
        this.lamportClock += this.LAMPORT_OFFSET;
    }
    
});
