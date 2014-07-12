/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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

// Timeout for select request, in seconds
const SERVER_SELECT_TIMEOUT = 120;
const SERVER_TRANSLATION_TIMEOUT = 30;

// Format identifiers for export translation
const SERVER_FORMATS = {
	"bibtex":"9cb70025-a888-4a29-a210-93ec52da40d4",
	"bookmarks":"4e7119e0-02be-4848-86ef-79a64185aad8",
	"coins":"05d07af9-105a-4572-99f6-a8e231c0daef",
	"mods":"0e2235e7-babf-413c-9acf-f27cce5f059c",
	"refer":"881f60f2-0802-411a-9228-ce5f47b64c7d",
	"rdf_bibliontology":"14763d25-8ba0-45df-8f52-b8d1108e7ac9",
	"rdf_dc":"6e372642-ed9d-4934-b5d1-c11ac758ebb7",
	"rdf_zotero":"14763d24-8ba0-45df-8f52-b8d1108e7ac9",
	"ris":"32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7",
	"tei":"032ae9b7-ab90-9205-a479-baf81f49184a",
	"wikipedia":"3f50aaac-7acc-4350-acd0-59cb77faf620"
};

// Content types for export translation
const SERVER_CONTENT_TYPES = {
	"bibtex":"application/x-bibtex",
	"bookmarks":"text/html",
	"coins":"text/html",
	"mods":"application/mods+xml",
	"refer":"application/x-research-info-systems",
	"rdf_bibliontology":"application/rdf+xml",
	"rdf_dc":"application/rdf+xml",
	"rdf_zotero":"application/rdf+xml",
	"ris":"application/x-research-info-systems",
	"wikipedia":"text/x-wiki",
	"tei":"text/xml"
};

Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * @namespace
 */
Zotero.Server.Translation = new function() {
	const infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;
	this.waitingForSelection = {};
	this.requestsSinceSelectionCollection = 0;
	
	/**
	 * Initializes translation server by reading files from local translators directory
	 */
	this.init = function() {
		// Load translators
		var translatorsDir = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
		translatorsDir.initWithPath(Zotero.Prefs.get("translatorsDirectory"));
		
		if(!translatorsDir.exists()) {
			dump("Translators directory "+Zotero.Prefs.get("translatorsDirectory")+" does not "+
				"exist. Please set this correctly in config.js.\n");
			Components.classes['@mozilla.org/toolkit/app-startup;1']
				.getService(Components.interfaces.nsIAppStartup)
				.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
		}
		
		var translators = [];
		var files = translatorsDir.directoryEntries;
		while(files.hasMoreElements()) {
			var file = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
			var filename = file.leafName;
			
			if(filename[0] === "." || filename.substr(filename.length-3) !== ".js") continue;
		
			var data = Zotero.File.getContents(file);
			
			// Strip off byte order mark, if one exists
			if(data[0] === "\uFEFF") data = data.substr(1);
			
			// We assume lastUpdated is at the end to avoid running the regexp on more than necessary
			var lastUpdatedIndex = data.indexOf('"lastUpdated"');
			if (lastUpdatedIndex == -1) {
				Zotero.debug("Invalid or missing translator metadata JSON object in "+file);
				return;
			}
			
			// Add 50 characters to clear lastUpdated timestamp and final "}"
			var header = data.substr(0, lastUpdatedIndex + 50);
			var m = infoRe.exec(header);
			if (!m) {
				Zotero.debug("Invalid or missing translator metadata JSON object in "+file);
				return;
			}
			
			var metadataString = m[0];
			
			try {
				var info = JSON.parse(metadataString);
			} catch(e) {
				Zotero.debug("Invalid or missing translator metadata JSON object in "+file);
				return;
			}
			info.code = data;
			
			translators.push(info);
		}
		
		Zotero.Translators.init(translators);
	};
};

/**
 * Translates a web page
 *
 * Accepts (as POST data):
 *		url - a URL to translate
 *		pkey - a persistent key referring to a previous translation attempt
 *		items - 
 * Returns:
 *		Items in an alternative format
 */
Zotero.Server.Translation.Web = function() {};
Zotero.Server.Endpoints["/web"] = Zotero.Server.Translation.Web;
Zotero.Server.Translation.Web.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	"init":function(reqURL, data, sendResponseCallback) {
		if(!data.url) {
			sendResponseCallback(400, "text/plain", "No URL specified\n");
			return;
		}
		
		if(!data.sessionid) {
			sendResponseCallback(400, "text/plain", "No sessionid specified\n");
			return;
		}
		
		try {
			var url = Services.io.newURI(data.url, "UTF-8", null);
		} catch(e) {}
		
		if(!url || (!url.schemeIs("http") && !url.schemeIs("https"))) {
			sendResponseCallback(400, "text/plain", "Invalid URL specified\n");
			return;
		}
		
		var runningInstance;
		if((runningInstance = Zotero.Server.Translation.waitingForSelection[data.sessionid])
				&& data.items) {
			// Already waiting for a items response, so just pass this there
			runningInstance._cookieSandbox.setTimeout(SERVER_TRANSLATION_TIMEOUT*1000,
				runningInstance.timeout.bind(runningInstance));
			runningInstance.sendResponse = sendResponseCallback;
			runningInstance.selectDone(data.items);
		} else {
			// New request
			
			// Before we even try to fetch the URL, ensure that we have a compatible
			// translator with a target
			Zotero.Translators.getWebTranslatorsForLocation(url.spec, (function(translatorData) {
				var couldHaveTranslator = false;
				for(var i=0, translator; translator = translatorData[0][i]; i++) {
					if(translator.target
							&& translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER) {
						couldHaveTranslator = true;
						break;
					}
				}
				
				if(!couldHaveTranslator) {
					sendResponseCallback(501, "text/plain", "No translators available\n");
					return;
				}
				
				// Start performing translator
				this.sendResponse = sendResponseCallback;
				this._data = data;
				this._cookieSandbox = new Zotero.CookieSandbox(null, url);
				this._cookieSandbox.setTimeout(SERVER_TRANSLATION_TIMEOUT*1000,
					this.timeout.bind(this));
				
				var translate = this._translate = new Zotero.Translate.Web();
				translate.setHandler("translators", this.translators.bind(this));
				translate.setHandler("select", this.select.bind(this));
				translate.setHandler("done", this.done.bind(this));
				translate.setCookieSandbox(this._cookieSandbox);
				
				Zotero.HTTP.processDocuments([url.spec], function(doc) {
					translate.setDocument(doc);
					translate.getTranslators();
				}, undefined, function(e) {
					sendResponseCallback(500, "text/plain", "An error occurred retrieving the document\n");
					Zotero.debug(e);
				}, undefined, this._cookieSandbox);
			}).bind(this));
		}
		
		// GC every 10 requests
		if((++Zotero.Server.Translation.requestsSinceSelectionCollection) == 10) {
			for each(var instance in Zotero.Server.Translation.waitingForSelection) {
				instance.collect();
			}
			Zotero.Server.Translation.requestsSinceSelectionCollection = 0;
		}
	},
	
	/**
	 * Called to check whether this request should be aborted due to timeout, and if so, do the
	 * aborting
	 * @param {Boolean} force Whether to abort the request regardless of timeout
	 */
	"collect":function(force) {
		if(!force && this._responseTime && Date.now() < this._responseTime+SERVER_SELECT_TIMEOUT*1000) return;
		delete Zotero.Server.Translation.waitingForSelection[this._data.sessionid];
	},
	
	/**
	 * Called when translators are available
	 */
	"translators":function(translate, translators) {
		if(!translators.length) {
			// XXX better status code?
			this.collect(true);
			this.sendResponse(501, "text/plain", "No translators available\n");
			return;
		}
		
		translate.setTranslator(translators[0]);
		translate.translate(false);
	},
	
	/**
	 * Called if multiple items are available for selection
	 */
	"select":function(translate, itemList, callback) {
		this._selectCallback = callback;
		this._itemList = itemList;
		
		if(this._data.items) {	// Items passed in request
			this.selectDone(this._data.items);
		} else {				// Items needed for response
			// Fix for translators that don't create item lists as objects
			if(itemList.push && typeof itemList.push === "function") {
				var newItemList = {};
				for(var item in itemList) {
					newItemList[item] = itemList[item];
				}
				itemList = newItemList;
			}
			
			// Send "Multiple Choices" HTTP response
			this._cookieSandbox.clearTimeout();
			this.sendResponse(300, "application/json", JSON.stringify(itemList));
			
			this._responseTime = Date.now();
			Zotero.Server.Translation.waitingForSelection[this._data.sessionid] = this;
		}
	},
	
	/**
	 * Called when items have been selected
	 */
	"selectDone":function(selectItems) {
		// Make sure items are actually available
		var haveItems = false;
		for(var i in selectItems) {
			if(this._itemList[i] === undefined || this._itemList[i] !== selectItems[i]) {
				this.collect(true);
				this.sendResponse(409, "text/plain", "Items specified do not match items available\n");
				return;
			}
			haveItems = true;
		}
		
		// Make sure at least one item was specified
		if(!haveItems) {
			this.collect(true);
			this.sendResponse(400, "text/plain", "No items specified\n");
			return;
		}
		
		// Run select callback
		this._selectCallback(selectItems);
	},
	
	/**
	 * Called on translation completion
	 */
	"done":function(translate, status) {
		this._cookieSandbox.clearTimeout();
		this.collect(true);
		
		if(!status) {
			this.sendResponse(500, "text/plain", "An error occurred during translation. Please check translation with Zotero client.\n");
		} else if(!translate.newItems) {
			this.sendResponse(400, "text/plain", "Invalid input provided.\n");
		} else {
			var n = translate.newItems.length;
			var items = new Array(n);
			for(var i=0; i<n; i++) {
				items[i] = Zotero.Utilities.itemToServerJSON(translate.newItems[i]);
			}
			
			this.sendResponse(200, "application/json", JSON.stringify(items));
		}
	},
	
	/**
	 * Called if the request timed out before it could complete
	 */
	"timeout":function() {
		this.sendResponse(504, "text/plain", "Translation timed out.\n");		
	}
};

/**
 * Converts input in any format Zotero can import to items in Zotero server JSON format
 *
 * Accepts (as raw POST data):
 *		File to import
 * Returns:
 *		Items in Zotero server JSON format
 */
Zotero.Server.Translation.Import = function() {};
Zotero.Server.Endpoints["/import"] = Zotero.Server.Translation.Import;
Zotero.Server.Translation.Import.prototype = {
	"supportedMethods":["POST"],
	
	"init":function(url, data, sendResponseCallback) {
		if(!data) {
			res.writeHead(400, "Bad Request", {'Content-Type': 'text/plain'});
			res.end("No input provided\n");
			return;
		}
		
		var translate = new Zotero.Translate.Import();
		translate.noWait = true;
		translate.setString(data);
		this.sendResponse = sendResponseCallback;
		
		translate.setHandler("translators", this.translators.bind(this));
		translate.setHandler("done", this.done.bind(this));
		translate.getTranslators();
	},
	
	/**
	 * Called when translators are available
	 */
	"translators":function(translate, translators) {
		if(!translators.length) {
			this.sendResponse(501, "text/plain", "No translators available\n");
			return;
		}
		
		translate.setTranslator(translators[0]);
		translate.translate(false);
	},
	
	/**
	 * Called on translation completion
	 */
	"done":function(translate, status) {
		if(!status) {
			this.sendResponse(500, "text/plain", "An error occurred during translation. Please check translation with Zotero client.\n");
		} else if(!translate.newItems) {
			this.sendResponse(400, "text/plain", "Invalid input provided.\n");
		} else {
			var n = translate.newItems.length;
			var items = new Array(n);
			for(var i=0; i<n; i++) {
				items[i] = Zotero.Utilities.itemToServerJSON(translate.newItems[i]);
			}
			
			this.sendResponse(200, "application/json", JSON.stringify(items));
		}
	}
};

/**
 * Converts input in Zotero server JSON format to items Zotero can import
 *
 * Accepts (as raw POST data):
 *		Zotero server JSON
 * Returns:
 *		Items in an alternative format
 */
Zotero.Server.Translation.Export = function() {};
Zotero.Server.Endpoints["/export"] = Zotero.Server.Translation.Export;
Zotero.Server.Translation.Export.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	"init":function(url, items, sendResponseCallback) {
		var query = url.query;
		
		var translatorID;
		
		if(!query["format"] || !(translatorID = SERVER_FORMATS[query["format"]])) {
			sendResponseCallback(400, "text/plain", "Invalid format specified\n");
			return;
		}
		
		if(!items.length || !items[0].itemType) {
			sendResponseCallback(400, "text/plain", "Input must be an array of items as JSON\n");
			return;
		}
		
		var translate = new Zotero.Translate.Export();
		translate.setTranslator(translatorID);
		translate.setItems(items);
		translate.setHandler("done", function(obj, status) {
			if(!status) {
				sendResponseCallback(500, "text/plain", "An error occurred during translation. Please check translation with Zotero client.\n");
			} else {
				sendResponseCallback(200, SERVER_CONTENT_TYPES[query["format"]], translate.string);
			}
		});
		translate.translate();
	}
};

/**
 * Refreshes the translator directory
 *
 * Accepts:
 *		Nothing
 * Returns:
 *		Success or failure, depending upon git exit status
 */
Zotero.Server.Translation.Refresh = function() {};
Zotero.Server.Endpoints["/refresh"] = Zotero.Server.Translation.Refresh;
Zotero.Server.Translation.Refresh.prototype = {
	"supportedMethods":["GET"],
	
	"init":function(url, data, sendResponseCallback) {
		var bash = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
		bash.initWithPath("/bin/bash");
		
		var proc = Components.classes["@mozilla.org/process/util;1"].
			createInstance(Components.interfaces.nsIProcess);
		proc.init(bash);
		
		var translatorsDir = "'"+Zotero.Prefs.get("translatorsDirectory").replace("'", "'\\''", "g")+"'";
		var args = ["-c", "cd "+translatorsDir+" && git pull origin master"];
		proc.runAsync(args, args.length, {"observe":function(subject, topic) {
			if(topic === "process-finished" && proc.exitValue === 0) {
				Zotero.Server.Translation.init();
				sendResponseCallback(200, "text/plain", "Translator update completed successfully.");
			} else {
				sendResponseCallback(500, "text/plain", "An error occurred updating translators.");
			}
		}});
	}
};