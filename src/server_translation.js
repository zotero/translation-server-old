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

const SERVER_FORMATS = {
	"bibtex":"9cb70025-a888-4a29-a210-93ec52da40d4",
	"bookmarks":"4e7119e0-02be-4848-86ef-79a64185aad8",
	"refer":"881f60f2-0802-411a-9228-ce5f47b64c7d",
	"rdf_bibliontology":"14763d25-8ba0-45df-8f52-b8d1108e7ac9",
	"rdf_dc":"6e372642-ed9d-4934-b5d1-c11ac758ebb7",
	"rdf_zotero":"14763d24-8ba0-45df-8f52-b8d1108e7ac9",
	"ris":"32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7",
	"wikipedia":"3f50aaac-7acc-4350-acd0-59cb77faf620"
};

const SERVER_CONTENT_TYPES = {
	"bibtex":"application/x-bibtex",
	"bookmarks":"text/html",
	"refer":"application/x-research-info-systems",
	"rdf_bibliontology":"application/rdf+xml",
	"rdf_dc":"application/rdf+xml",
	"rdf_zotero":"application/rdf+xml",
	"ris":"application/x-research-info-systems",
	"wikipedia":"text/x-wiki"
};

/**
 * @namespace
 */
Zotero.Server.Translation = new function() {
	const infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;
	
	/**
	 * Initializes translation server by reading files from local translators directory
	 */
	this.init = function() {
		var translatorsDir = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
		Zotero.debug(Zotero.Prefs.get("translatorsDirectory"));
		translatorsDir.initWithPath(Zotero.Prefs.get("translatorsDirectory"));
		
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
 * Converts input in any format Zotero can import to items in Zotero server JSON format
 *
 * Accepts:
 *		File to import
 * Returns:
 *		Items in Zotero server JSON format
 */
Zotero.Server.Translation.Import = function() {};
Zotero.Server.Endpoints["/import"] = Zotero.Server.Translation.Import;
Zotero.Server.Translation.Import.prototype = {
	"supportedMethods":["POST"],
	
	"init":function(data, sendResponseCallback) {
		if(!data) {
			res.writeHead(400, "Bad Request", {'Content-Type': 'text/plain'});
			res.end("No input provided\n");
			return;
		}
		
		var translate = new Zotero.Translate.Import();
		translate.noWait = true;
		translate.setString(data);
		this._prepareSave(translate, sendResponseCallback);
	},
	
	/**
	 * Sets handlers and initiates a save (web or import) operation
	 */
	"_prepareSave":function(translate, sendResponseCallback, raw) {
		translate.setHandler("translators", function(obj, translators) {
			if(!translators.length) {
				sendResponseCallback(400, "text/plain", "No translator found for input\n");
				return;
			}
			
			translate.setTranslator(translators[0]);
			translate.translate(false);
		});
		
		translate.setHandler("done", function(translate, status) {
			if(!status) {
				sendResponseCallback(500, "text/plain", "An error occurred during translation. Please check translation with Zotero client.\n");
			} else if(!translate.newItems) {
				sendResponseCallback(400, "text/plain", "Invalid input provided.\n");
			} else {
				var n = translate.newItems.length;
				var items = new Array(n);
				for(var i=0; i<n; i++) {
					items[i] = Zotero.Utilities.itemToServerJSON(translate.newItems[i]);
				}
				
				sendResponseCallback(200, "application/json", JSON.stringify(items));
			}
		});
		
		translate.getTranslators();
	}
};

/**
 * Converts input in Zotero server JSON format to items Zotero can import
 *
 * Accepts:
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