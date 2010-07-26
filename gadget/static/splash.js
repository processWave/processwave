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

var gRootPath = "http://code.processwave.org/raw-file/";
                                
var gStatusMessages = [ "Loading core features of ORYX", 
                        "Loading the ORYX user experience",
                        "Loading stencil set for ORYX",
                        "Loading your model into ORYX",
                        "Loading good karma into your browser",
                        "Calculating the answer to life",
                        "Man, this takes like for ever to load...",
                        "Time for coffee!",
                        "Hello? Anybody at home?",
                        "Something probably went terribly wrong during the loading sequence..."
                        ];
                        
var gCurrentStatusMessage = 0;            
var gBranchSelected = false;
var gAvailableBranches = [];
var gLoadedJavaScriptsCount = 0;

function initialize() {
    getAllBranches();
    if (wave && wave.isInWaveContainer()) {
        wave.setStateCallback(stateUpdatedCallback);
    }
}

function loadJavaScriptsAndThenOryx(branchName, stencilSet, importJSON) {
    var path = gRootPath + branchName + "/";
    var lab = $LAB;
    
    $LAB.script(path + "gadget/includes.js").wait(
        function loadIncludes() {
            for (var i = 0; i < gJavascripts.length; i++) {
                lab = lab.script(path + gJavascripts[i]).wait(getAfterWaitFunction(path, stencilSet, importJSON));
            }
        });
}

function getAfterWaitFunction(path, stencilSet, importJSON) {
    return function afterWait() {
        gLoadedJavaScriptsCount++;
        if (gLoadedJavaScriptsCount === gJavascripts.length) {
            //All Scripts loaded ==> initialize
            adapter.initialize(true);
            stencilsetPolice.initialize(stencilSet)
            oryx.initialize();
            // send the JSON that has to be imported to the ORYX
            oryx.sendMessage("oryx", "import", importJSON);            
            //Load Oryx
            var url = path + "/gadget/oryx.xhtml?stencilSetName=" + stencilSet;
            $("#oryxFrame").attr("src",url);
        }
    };
}

function loadOryxBranch(branch, stencilSet) {
    $("#branchSelection").hide();
    $("#progressBar").show();
    window.setTimeout(changeStatusMessage, 1500);
    gBranchSelected = true;
    $("#branchName").prepend(branch);
    if (wave.getState().get("http_referer")) {
        var referer = wave.getState().get("wavethis_referer");
        //var referer = "http://oryx-project.org/backend/poem/model/9496/json"; 
        var params = {};
        params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.JSON;
        gadgets.io.makeRequest(referer, processModelJSON, params); 
    } else {
        loadJavaScriptsAndThenOryx(branch, stencilSet);
        
        var dancingShapes = $("#dancingShapes").attr('checked') ? "yes" : "no";
        
        if (wave) {
            wave.getState().submitValue("stencilSet", stencilSet);
            wave.getState().submitValue("dancingShapes", dancingShapes);
            wave.getState().submitValue("branchName", branch);
        }
        setCookie(branch, stencilSet, dancingShapes);
    }
}

function processModelJSON(obj) {
    importJSON = obj.data;
    stencilSetURL = importJSON.stencilset.url;
    var stencilSet;
    if (stencilSetURL.indexOf("bpmn2.0") != -1) {
        stencilSet = "bpmn2.0";
    } else if (stencilSetURL.indexOf("uml2.2") != -1) {
		stencilSet = "uml2.2";
	} else if (stencilSetURL.indexOf("fmcblockdiagram") != -1) {
		stencilSet = "fmcblockdiagram";
	}else if (stencilSetURL.indexOf("epc") != -1) {
		stencilSet = "epc";
	}else if (stencilSetURL.indexOf("petrinets") != -1) {
		stencilSet = "petrinets";
	}
    // TODO: look for the following stencilsets: uml2.2, fmcblockdiagram, epc, petrinets
    // regex for string before .json
    loadJavaScriptsAndThenOryx("importWaveThis", stencilSet, importJSON);
}

function stateUpdatedCallback() {
    if (wave.getState().get("dancingShapes") === "yes") {
        $("#dancingShapes").attr('checked', true);
    } else {
        $("#dancingShapes").attr('checked', false);
    }
    if(!gBranchSelected) {
        var branchName = wave.getState().get("branchName");
        if (branchName) {
            var stencilSet = wave.getState().get("stencilSet") || "bpmn2.0";
            loadOryxBranch(branchName, stencilSet);
        } else {
            showManualBranchSelection();
        }
    }
}

function getAllBranches() {
    var branchURL = "http://code.processwave.org/branches?rand=" + Math.random();
    var params = {};  
    params[gadgets.io.RequestParameters.CONTENT_TYPE] = gadgets.io.ContentType.DOM;    
    gadgets.io.makeRequest(branchURL, branchesResponse, params);
}

function branchesResponse(obj) {
    var domdata = obj.data;
    if (!domdata) {
        domdata = document.createElement('div');
        domdata.innerHTML = obj.text.replace(/<script(.|\s)*?\/script>/g, '');
    }
    if (!domdata) {
        return;
    }
    
    var branches = domdata.getElementsByTagName("a");
    var item;
    var itemclass;
    for (var i = 0; i < branches.length; i++) {
        item = branches.item(i);
        itemclass = item.getAttribute("class");
        if (itemclass) {
            gAvailableBranches.push($.trim(item.firstChild.data));
        }
    }
    $("#enteredBranchName").autocomplete({
        source: gAvailableBranches
    });
}

function showManualBranchSelection() {
    $("#branchSelection").show();
    $("#progressBar").hide();
    var textfield = $("#enteredBranchName");
    var stencilSet = $("#stencilSet");
    textfield.val($.cookies.get("branch")).focus().select();
    textfield.keyup(function keyup(evt) {
        if (evt.keyCode == 13 /* Return key */) {
            onBranchLoadButtonClicked();
        }
    });
    
    stencilSet.val(getStenciSetFromCookie());
    
    gadgets.window.adjustHeight();
}

function getStenciSetFromCookie() {
    var stencilSet = $.cookies.get("stencilSet");
    if (stencilSet) {
        return stencilSet;
    }
    return "bpmn2.0";
}

function onBranchLoadButtonClicked() {
    loadOryxBranch($("#enteredBranchName").val(), $("#stencilSet").val());
}



function setCookie(branch, stencilSet, dancingShapes) {
    var expiredate = new Date();
    expiredate.setDate(expiredate.getDate() + 365);
    $.cookies.set("branch", branch, {expiresAt: expiredate});
    $.cookies.set("stencilSet", stencilSet, {expiresAt: expiredate});
    $.cookies.set("dancingShapes", dancingShapes, {expiresAt: expiredate});
}

function changeStatusMessage() {
    if (gCurrentStatusMessage >= gStatusMessages.length) {
        return;
    }
    $("#statusMessage").fadeOut(callback = function changeStatusMessageCallback() {
        $("#statusMessage").html(gStatusMessages[gCurrentStatusMessage++]).fadeIn();
        window.setTimeout(changeStatusMessage, 3900);
    });
}

function showOryx() {
    $("#oryx").show();
    $("#splashScreen").hide();
    $("#header").show();
    gadgets.window.adjustHeight();
}

function onDebugCheckbox() {
    $('#debugger').toggle();
    gadgets.window.adjustHeight();
}
gadgets.util.registerOnLoadHandler(initialize);

var splash = {'showOryx': showOryx};