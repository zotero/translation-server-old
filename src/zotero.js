/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

const ZOTERO_CONFIG = {
	GUID: 'zotero@chnm.gmu.edu',
	DB_REBUILD: false, // erase DB and recreate from schema
	REPOSITORY_URL: 'https://repo.zotero.org/repo',
	REPOSITORY_CHECK_INTERVAL: 86400, // 24 hours
	REPOSITORY_RETRY_INTERVAL: 3600, // 1 hour
	REPOSITORY_CHANNEL: 'trunk',
	BASE_URI: 'http://zotero.org/',
	WWW_BASE_URL: 'http://www.zotero.org/',
	SYNC_URL: 'https://sync.zotero.org/',
	API_URL: 'https://api.zotero.org/',
	PREF_BRANCH: 'translation-server.'
};

// Fx4.0b8+ use implicit SJOWs and get rid of explicit XPCSafeJSObjectWrapper constructor
// Ugly hack to get around this until we can just kill the XPCSafeJSObjectWrapper calls (when we
// drop Fx3.6 support)
try {
	XPCSafeJSObjectWrapper;
} catch(e) {
	eval("var XPCSafeJSObjectWrapper = function(arg) { return arg }");
}

// Load AddonManager for Firefox 4
Components.utils.import("resource://gre/modules/AddonManager.jsm");

/**
 * Core functions
 */
(function(){
	this.isFx = true;
	this.isFx4 = true;
	this.isServer = true;
	this.browser = "g";
	
	this.init = function(port) {
		// ensure browser is online
		var io = Components.classes['@mozilla.org/network/io-service;1']
			.getService(Components.interfaces.nsIIOService);
		io.offline = false;
		
		Zotero.Prefs.init();
		Zotero.Debug.init();
		Zotero.Connector_Types.init();
		Zotero.Server.Translation.init();
		Zotero.Server.init(port, true, 1000);
	}
	
	/**
	 * Debug logging function
	 *
	 * Uses prefs e.z.debug.log and e.z.debug.level (restart required)
	 *
	 * Defaults to log level 3 if level not provided
	 */
	this.debug = function(message, level) {
		Zotero.Debug.log(message, level);
	}
	
	
	/**
	 * Log a message to the Mozilla JS error console
	 *
	 * |type| is a string with one of the flag types in nsIScriptError:
	 *    'error', 'warning', 'exception', 'strict'
	 */
	this.log = function(message, type, sourceName, sourceLine, lineNumber, columnNumber) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService);
		var scriptError = Components.classes["@mozilla.org/scripterror;1"]
			.createInstance(Components.interfaces.nsIScriptError);
		
		if (!type) {
			type = 'warning';
		}
		var flags = scriptError[type + 'Flag'];
		
		scriptError.init(
			message,
			sourceName ? sourceName : null,
			sourceLine != undefined ? sourceLine : null,
			lineNumber != undefined ? lineNumber : null, 
			columnNumber != undefined ? columnNumber : null,
			flags,
			'component javascript'
		);
		consoleService.logMessage(scriptError);
	}
	
	/**
	 * Log a JS error to the Mozilla JS error console.
	 * @param {Exception} err
	 */
	this.logError = function(err) {
		this.log(err.message ? err.message : err.toString(), "error",
			err.fileName ? err.fileName : null, null,
			err.lineNumber ? err.lineNumber : null, null);
	}
}).call(Zotero);

Zotero.Prefs = new function(){
	// Privileged methods
	this.init = init;
	this.get = get;
	this.set = set;
	
	function init(){
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
						.getService(Components.interfaces.nsIPrefService);
		this.prefBranch = prefs.getBranch(ZOTERO_CONFIG.PREF_BRANCH);
	}
	
	/**
	* Retrieve a preference
	**/
	function get(pref, global){
		try {
			if (global) {
				var service = Components.classes["@mozilla.org/preferences-service;1"]
					.getService(Components.interfaces.nsIPrefService);
			}
			else {
				var service = this.prefBranch;
			}
			
			switch (this.prefBranch.getPrefType(pref)){
				case this.prefBranch.PREF_BOOL:
					return this.prefBranch.getBoolPref(pref);
				case this.prefBranch.PREF_STRING:
					return this.prefBranch.getCharPref(pref);
				case this.prefBranch.PREF_INT:
					return this.prefBranch.getIntPref(pref);
			}
		}
		catch (e){
			throw ("Invalid preference '" + pref + "'");
		}
	}
	
	/**
	* Set a preference
	**/
	function set(pref, value) {
		try {
			switch (this.prefBranch.getPrefType(pref)){
				case this.prefBranch.PREF_BOOL:
					return this.prefBranch.setBoolPref(pref, value);
				case this.prefBranch.PREF_STRING:
					return this.prefBranch.setCharPref(pref, value);
				case this.prefBranch.PREF_INT:
					return this.prefBranch.setIntPref(pref, value);
				
				// If not an existing pref, create appropriate type automatically
				case 0:
					if (typeof value == 'boolean') {
						Zotero.debug("Creating boolean pref '" + pref + "'");
						return this.prefBranch.setBoolPref(pref, value);
					}
					if (typeof value == 'string') {
						Zotero.debug("Creating string pref '" + pref + "'");
						return this.prefBranch.setCharPref(pref, value);
					}
					if (parseInt(value) == value) {
						Zotero.debug("Creating integer pref '" + pref + "'");
						return this.prefBranch.setIntPref(pref, value);
					}
					throw ("Invalid preference value '" + value + "' for pref '" + pref + "'");
			}
		}
		catch (e){
			throw ("Invalid preference '" + pref + "'");
		}
	}
	
	
	this.clear = function (pref) {
		try {
			this.prefBranch.clearUserPref(pref);
		}
		catch (e) {
			throw ("Invalid preference '" + pref + "'");
		}
	}
}

/**
 * Functions for creating and destroying hidden browser objects
 **/
Zotero.Browser = new function() {
	// The number of browsers to maintain as open
	const BROWSER_POOL_SIZE = 16;
	var _browserPool = [];
	var _runningBrowsers = 0;
	
	this.createHiddenBrowser = createHiddenBrowser;
	this.deleteHiddenBrowser = deleteHiddenBrowser;
	
	function createHiddenBrowser(win) {
	 	if (!win) {
			var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							.getService(Components.interfaces.nsIWindowMediator)
							.getMostRecentWindow("navigator:browser");
			if(!win) {
				var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowWatcher)
								.activeWindow;
			}
		}
		
		if(_browserPool.length) {
			// Take a browser from the pool
			return _browserPool.shift();
		} else {
			_runningBrowsers++;
			// Create a hidden browser
			var hiddenBrowser = win.document.createElement("browser");
			hiddenBrowser.setAttribute('type', 'content');
			hiddenBrowser.setAttribute('disablehistory', 'true');
			win.document.documentElement.appendChild(hiddenBrowser);
			// Disable some features
			hiddenBrowser.docShell.allowImages = false;
			hiddenBrowser.docShell.allowJavascript = false;
			hiddenBrowser.docShell.allowMetaRedirects = false;
			hiddenBrowser.docShell.allowPlugins = false;
			Zotero.debug("Created hidden browser (" + _runningBrowsers + ")");
			return hiddenBrowser;
		}
	}
	
	function deleteHiddenBrowser(myBrowser) {
		myBrowser.stop();
		
		if(_runningBrowsers > BROWSER_POOL_SIZE) {
			// Get rid of the browser
			myBrowser.destroy();
			myBrowser.parentNode.removeChild(myBrowser);
			myBrowser = null;
			_runningBrowsers--;
		} else {
			// Park the browser at about:blank
			myBrowser.loadURI("about:blank");
			// Add to the pool
			_browserPool.push(myBrowser);
		}
		
		Zotero.debug("Deleted hidden browser");
	}
}