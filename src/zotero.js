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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Core functions
 */
(function(){
	var _runningTimers = [];
	this.isFx = true;
	this.isFx4 = true;
	this.isFx5 = true;
	this.isServer = true;
	this.browser = "v";
	
	this.init = function(port) {
		// ensure browser is online
		var io = Components.classes['@mozilla.org/network/io-service;1']
			.getService(Components.interfaces.nsIIOService);
		io.offline = false;
		
		var cs = Components.classes["@mozilla.org/consoleservice;1"].
			getService(Components.interfaces.nsIConsoleService);
		cs.registerListener(ConsoleListener);
		
		Zotero.Prefs.init();
		Zotero.Debug.init();
		Zotero.Connector_Types.init();
		Zotero.Server.Translation.init();
		if(port !== false) {
			Zotero.Server.init(port, true, 1000);
		}
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
	 * Emulates the behavior of window.setTimeout
	 *
	 * @param {Function} func			The function to be called
	 * @param {Integer} ms				The number of milliseconds to wait before calling func
	 */
	this.setTimeout = function(func, ms, runWhenWaiting) {
		var timer = Components.classes["@mozilla.org/timer;1"].
			createInstance(Components.interfaces.nsITimer);
		var timerCallback = {"notify":function() {
			try {
				// execute callback function
				func();
				// remove timer from global scope, so it can be garbage collected
				_runningTimers.splice(_runningTimers.indexOf(timer), 1);
			} catch(e) {
				Zotero.debug(e);
			}
		}}
		timer.initWithCallback(timerCallback, ms, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		// add timer to global scope so that it doesn't get garbage collected before it completes
		_runningTimers.push(timer);
	}
	
	/**
	 * Log a JS error to the Mozilla JS error console.
	 * @param {Exception} err
	 */
	this.logError = function(err) {
		Zotero.debug((err.message ? err.message : err.toString())
			+(err.fileName ? " at "+err.fileName+(err.lineNumber ? ":"+err.lineNumber : "") : ""));
	}
	
	/**
	 * Observer for console messages
	 * @namespace
	 */
	var ConsoleListener = {
		"QueryInterface":XPCOMUtils.generateQI([Components.interfaces.nsIConsoleMessage,
			Components.interfaces.nsISupports]),
		"observe":function(err) {
			const skip = ['CSS Parser', 'content javascript'];
			
			try {
				err.QueryInterface(Components.interfaces.nsIScriptError);
				if (skip.indexOf(err.category) != -1 || err.flags & err.warningFlag) {
					return false;
				}
				Zotero.debug(err.message+" at "+err.fileName+":"+err.lineNumber);
			} catch (e) {
				Zotero.debug(eerr.toString());
				return;
			}
		}
	};
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
 * @namespace
 */
Zotero.Browser = new function() {
	/**
	 * No-op to avoid breaking functions that expect to be able to delete hidden browsers.
	 * (Hidden browsers are actually just DOM documents in this implementation, and will
	 * disappear when they go out of scope.)
	 */
	this.deleteHiddenBrowser = function deleteHiddenBrowser(myBrowser) {}
}