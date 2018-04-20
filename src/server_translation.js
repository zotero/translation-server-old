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
	"biblatex":"b6e39b57-8942-4d11-8259-342c46ce395f",
	"bookmarks":"4e7119e0-02be-4848-86ef-79a64185aad8",
	"coins":"05d07af9-105a-4572-99f6-a8e231c0daef",
	csljson: "bc03b4fe-436d-4a1f-ba59-de4d2d7a63f7",
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
	"biblatex":"application/x-bibtex",
	"bookmarks":"text/html",
	"coins":"text/html",
	csljson: "application/json",
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
	this.translatorsDirPath = null;
	
	/**
	 * Initializes translation server by reading files from local translators directory
	 */
	this.init = function() {
		// If "translatorsDirectory" pref is empty, default to %CurProcD%/app/translators
		Components.utils.import("resource://gre/modules/osfile.jsm");
		this.translatorsDirPath = Zotero.Prefs.get("translatorsDirectory")
			|| OS.Path.join(
				Components.classes["@mozilla.org/file/directory_service;1"]
					.getService(Components.interfaces.nsIProperties)
					.get("CurProcD", Components.interfaces.nsIFile)
					.path,
				'app',
				'translators'
			);
		// Load translators
		var translatorsDir = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		dump("Loading translators from "+this.translatorsDirPath+"\n");
		translatorsDir.initWithPath(this.translatorsDirPath);
		
		if(!translatorsDir.exists()) {
			dump("Translators directory "+this.translatorsDirPath+" does not "+
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
				Zotero.debug("Invalid or missing translator metadata JSON object in " + filename);
				continue;
			}
			
			// Add 50 characters to clear lastUpdated timestamp and final "}"
			var header = data.substr(0, lastUpdatedIndex + 50);
			var m = infoRe.exec(header);
			if (!m) {
				Zotero.debug("Invalid or missing translator metadata JSON object in " + filename);
				continue;
			}
			
			var metadataString = m[0];
			
			try {
				var info = JSON.parse(metadataString);
			} catch(e) {
				Zotero.debug("Invalid or missing translator metadata JSON object in " + filename);
				continue;
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
	
	init: async function(reqURL, data, sendResponseCallback) {
		if (!data) {
			sendResponseCallback(400, "text/plain", "POST data not provided\n");
			return;
		}
		
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
		
		// If a doi.org URL, use search handler
		if (data.url.match(/^https?:\/\/[^\/]*doi\.org\//)) {
			let doi = Zotero.Utilities.cleanDOI(data.url);
			return Zotero.Server.Translation.Search.prototype.init(url, doi, sendResponseCallback);
		}
		
		var runningInstance
		if((runningInstance = Zotero.Server.Translation.waitingForSelection[data.sessionid])
				&& data.items) {
			// Already waiting for a items response, so just pass this there
			runningInstance._cookieSandbox.setTimeout(SERVER_TRANSLATION_TIMEOUT*1000,
				runningInstance.timeout.bind(runningInstance));
			runningInstance.sendResponse = sendResponseCallback;
			runningInstance.selectDone(data.items);
		} else {
			// New request
			this.sendResponse = sendResponseCallback;
			this._data = data;
			this._cookieSandbox = new Zotero.CookieSandbox(null, url);
			this._cookieSandbox.setTimeout(SERVER_TRANSLATION_TIMEOUT*1000,
				this.timeout.bind(this));
			
			var translate = this._translate = new Zotero.Translate.Web();
			translate.setHandler("translators", this.translators.bind(this));
			translate.setHandler("select", this.select.bind(this));
			translate.setCookieSandbox(this._cookieSandbox);
			
			try {
				await Zotero.HTTP.processDocuments(
					[url.spec],
					(doc) => {
						translate.setDocument(doc);
						// This could be optimized by only running detect on secondary translators
						// if the first fails, but for now just run detect on all
						return translate.getTranslators(true);
					},
					this._cookieSandbox
				);
			}
			catch (e) {
				Zotero.debug(e, 1);
				sendResponseCallback(500, "text/plain", "An error occurred retrieving the document\n");
			}
		}
		
		// GC every 10 requests
		if((++Zotero.Server.Translation.requestsSinceSelectionCollection) == 10) {
			for (let i in Zotero.Server.Translation.waitingForSelection) {
				let instance = Zotero.Server.Translation.waitingForSelection[i];
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
	translators: async function (translate, translators) {
		// No matching translators
		if (!translators.length) {
			this.saveWebpage(translate);
			return;
		}
		
		var translator;
		var items;
		while (translator = translators.shift()) {
			translate.setTranslator(translator);
			try {
				items = await translate.translate({
					libraryID: false
				});
				break;
			}
			catch (e) {
				Zotero.debug("Translation using " + translator.label + " failed", 1);
				Zotero.debug(e, 1);
				
				// If no more translators, save as webpage
				if (!translators.length) {
					this.saveWebpage(translate);
					return;
				}
				
				// Try next translator
			}
		}
		
		this._cookieSandbox.clearTimeout();
		this.collect(true);
		
		//this.sendResponse(400, "text/plain", "Invalid input provided.\n");
		var json = [];
		for (let item of items) {
			json.push(...Zotero.Utilities.itemToAPIJSON(item));
		}
		this.sendResponse(200, "application/json", JSON.stringify(json));
	},
	
	// TEMP: Remove once there's a generic webpage translator
	saveWebpage: function (translate) {
		this.collect(true);
		
		let head = translate.document.documentElement.querySelector('head');
		if (!head) {
			// XXX better status code?
			this.sendResponse(501, "text/plain", "No translators available\n");
			return;
		}
		
		// TEMP: Return basic webpage item for HTML
		let description = head.querySelector('meta[name=description]');
		if (description) {
			description = description.getAttribute('content');
		}
		let data = {
			itemType: "webpage",
			url: translate.document.location.href,
			title: translate.document.title,
			abstractNote: description,
			accessDate: Zotero.Date.dateToISO(new Date())
		};
		
		let items = Zotero.Utilities.itemToAPIJSON(data);
		
		this.sendResponse(200, "application/json", JSON.stringify(items));
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
		this.sendResponse = sendResponseCallback;
		
		if(!data) {
			this.sendResponse(400, "text/plain", "No input provided\n");
			return;
		}
		
		// Content-Type: application/json comes in as an object, but Zotero.Translate only takes strings
		if (typeof data == 'object') {
			data = JSON.stringify(data);
		}
		
		var translate = new Zotero.Translate.Import();
		translate.setString(data);
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
		translate.translate({
			libraryID: false
		});
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
				items[i] = Zotero.Utilities.itemToAPIJSON(translate.newItems[i]);
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


Zotero.Server.Translation.Search = function() {};
Zotero.Server.Endpoints["/search"] = Zotero.Server.Translation.Search;
Zotero.Server.Translation.Search.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["text/plain"],
	
	init: async function (url, data, sendResponseCallback) {
		if (!data) {
			sendResponseCallback(400, "text/plain", "No input provided\n");
			return;
		}
		
		let identifiers = Zotero.Utilities.Internal.extractIdentifiers(data);
		
		// Use PMID only if it's the only text in the query
		if (identifiers.length && identifiers[0].PMID && identifiers[0].PMID !== data.trim()) {
			identifiers = [];
		}
		
		if (!identifiers.length) {
			items = await this.textSearch.search(data);
			
			if (items.length >= 2) {
				let newItems = {};
				
				for (let item of items) {
					
					let DOI = item.DOI;
					let ISBN = item.ISBN;
					
					if (!DOI && item.extra) {
						let m = item.extra.match(/DOI: (.*)/);
						if (m) DOI = m[1];
					}
					
					if (!ISBN && item.extra) {
						let m = item.extra.match(/ISBN: (.*)/);
						if (m) ISBN = m[1];
					}
					
					let identifier;
					// DOI has a priority over ISBN for items that have both
					if (DOI) {
						identifier = DOI;
					}
					else if (item.ISBN) {
						identifier = ISBN.split(' ')[0];
					}
					
					newItems[identifier] = {
						itemType: item.itemType,
						title: item.title,
						description: this.textSearch.formatDescription(item)
					};
				}
				
				sendResponseCallback(300, "application/json", JSON.stringify(newItems));
				return;
			}
			else if (items.length === 1) {
				sendResponseCallback(200, "application/json",
					JSON.stringify(Zotero.Utilities.itemToAPIJSON(items[0])));
				return;
			}
			
			sendResponseCallback(200, "application/json", "[]");
			return;
		}
		
		try {
			var translate = new Zotero.Translate.Search();
			translate.setIdentifier(identifiers[0]);
			let translators = await translate.getTranslators();
			if (!translators.length) {
				sendResponseCallback(501, "text/plain", "No translators available\n");
				return;
			}
			translate.setTranslator(translators);
			
			var items = await translate.translate({
				libraryID: false
			});
		}
		catch (e) {
			if (e == translate.ERROR_NO_RESULTS) {
				sendResponseCallback(
					501,
					"text/plain",
					e + "\n"
				);
			}
			else {
				Zotero.debug(e, 1);
				sendResponseCallback(
					500,
					"text/plain",
					"An error occurred during translation. "
						+ "Please check translation with the Zotero client.\n"
				);
			}
			return;
		}
		
		// Translation can return multiple items (e.g., a parent item and notes pointing to it),
		// so we have to return an array with keyed items
		var newItems = [];
		items.forEach(item => {
			newItems.push(...Zotero.Utilities.itemToAPIJSON(item));
		});
		
		sendResponseCallback(200, "application/json", JSON.stringify(newItems));
	},
	
	textSearch: new function () {
		this.search = async function (query) {
			query = query.replace(/:/g, ' ');
			
			// Query Crossref and LoC/GBV in parallel to respond faster to the client
			let items = await Promise.all([queryCrossref(query), queryLibraries(query)]);
			items = items[0].concat(items[1]);
			
			// Filter out too fuzzy items, by comparing item title (and other metadata) against query
			items = await filterResults(items, query);
			return items;
		};
		
		this.formatDescription = function (item) {
			let parts = [];
			
			let authors = [];
			for (let creator of item.creators) {
				if (creator.creatorType === 'author' && creator.lastName) {
					authors.push(creator.lastName);
					if (authors.length === 3) break;
				}
			}
			
			if(authors.length) parts.push(authors.join(', '));
			
			if (item.date) {
				let m = item.date.toString().match(/[0-9]{4}/);
				if (m) parts.push(m[0]);
			}
			
			if(item.publicationTitle) {
				parts.push(item.publicationTitle);
			} else if(item.publisher) {
				parts.push(item.publisher);
			}
			
			return parts.join(' \u2013 ');
		};
		
		async function queryCrossref(query) {
			let items = [];
			try {
				let translate = new Zotero.Translate.Search();
				// Crossref REST
				translate.setTranslator("0a61e167-de9a-4f93-a68a-628b48855909");
				translate.setSearch({query});
				items = await translate.translate({libraryID: false});
			}
			catch (e) {
				Zotero.debug(e, 2);
			}
			return items;
		}
		
		/**
		 * Queries LoC and if that fails, queries GBV
		 */
		async function queryLibraries(query) {
			let items = [];
			try {
				let translate = new Zotero.Translate.Search();
				// Library of Congress ISBN
				translate.setTranslator("c070e5a2-4bfd-44bb-9b3c-4be20c50d0d9");
				translate.setSearch({query});
				items = await translate.translate({libraryID: false});
			}
			catch (e) {
				Zotero.debug(e, 2);
				try {
					let translate = new Zotero.Translate.Search();
					// Gemeinsamer Bibliotheksverbund ISBN
					translate.setTranslator("de0eef58-cb39-4410-ada0-6b39f43383f9");
					translate.setSearch({query});
					items = await translate.translate({libraryID: false});
				}
				catch (e) {
					Zotero.debug(e, 2);
				}
			}
			return items;
		}
		
		/**
		 * Decomposes all accents and ligatures,
		 * filters out symbols that aren't space or alphanumeric,
		 * and lowercases alphabetic symbols.
		 */
		function normalize(text) {
			let rx = XRegExp('[^\\pL 0-9]', 'g');
			text = XRegExp.replace(text, rx, '');
			text = text.normalize('NFKD');
			text = XRegExp.replace(text, rx, '');
			text = text.toLowerCase();
			return text;
		}
		
		/**
		 * Checks if a given word equals to any of the authors' names
		 */
		function hasAuthor(authors, word) {
			return authors.some(author => {
				return (author.firstName && normalize(author.firstName).split(' ').includes(word))
					|| (author.lastName && normalize(author.lastName).split(' ').includes(word));
			});
		}
		
		/**
		 * Tries to find the longest common words sequence between
		 * item title and query text. Query text must include title (or part of it)
		 * from the beginning. If there are leftover query words, it tries to
		 * validate them against item metadata (currently only authors and year)
		 */
		async function filterResults(items, query) {
			let results = [];
			
			// Normalize query, split to words, filter out empty array elements
			let queryWords = normalize(query).split(' ').filter(x => x);
			
			for (let item of items) {
				let DOI = item.DOI;
				let ISBN = item.ISBN;
				
				if (!DOI && item.extra) {
					let m = item.extra.match(/DOI: (.*)/);
					if (m) DOI = m[1];
				}
				
				if (!ISBN && item.extra) {
					let m = item.extra.match(/ISBN: (.*)/);
					if (m) ISBN = m[1];
				}
				
				if (!DOI && !ISBN) continue;
				let title = item.title;
				// Remove all tags
				title = title.replace(/<\/?\w+[^<>]*>/gi, '');
				title = title.replace(/:/g, ' ');
				
				// Normalize title, split to words, filter out empty array elements
				let titleWords = normalize(title).split(' ').filter(x => x);
				
				let longestFrom = 0;
				let longestLen = 0;
				
				// Finds the longest common words sequence between query text and item.title.
				// For the query text, the sequence can be anywhere in text,
				// but for item.title it must start at the beginning
				for (let i = 0; i < queryWords.length; i++) {
					for (let j = queryWords.length; j > 0; j--) {
						let a = queryWords.slice(i, j);
						let b = titleWords.slice(0, a.length);
						if (a.length && b.length && a.join(' ') === b.join(' ')) {
							if (a.length > longestLen) {
								longestFrom = i;
								longestLen = j;
							}
						}
					}
				}
				
				if (!longestLen) continue;
				
				// Longest common sequence of words
				//let foundPart = queryWords.slice(longestFrom, longestLen);
				
				// Remaining words
				let rems = queryWords.slice(0, longestFrom);
				rems = rems.concat(queryWords.slice(longestLen));
				
				// If at least one remaining word is left, it tries to compare it against item metadata.
				// Otherwise the whole query text is found in the title, and we have a full match
				if (rems.length) {
					let foundAuthor = false;
					let needYear = false;
					let foundYear = false;
					
					// Still remaining words
					let rems2 = [];
					
					for (let rem of rems) {
						// If the remaining word has at least 2 chars and exists in metadata authors
						if (rem.length >= 2 && hasAuthor(item.creators, rem)) {
							foundAuthor = true;
							continue;
						}
						
						// If the remaining word is a 4 digit number (year)
						if (/^[0-9]{4}$/.test(rem)) {
							needYear = true;
							
							if (item.date) {
								// If the remaining word exists in the item date
								let m = item.date.toString().match(/[0-9]{4}/);
								if (m && m[0] === rem) {
									foundYear = true;
									continue;
								}
							}
						}
						
						// Push the word that is still remaining
						rems2.push(rem);
					}
					
					// If a year exists in the query, but is not matched to the item date
					if (needYear && !foundYear) continue;
					
					// If there are still remaining words and none of authors are found
					if (rems2.length && !foundAuthor) continue;
				}
				
				results.push(item);
			}
			return results;
		}
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
		
		var translatorsDirPathClean = "'"+Zotero.Server.Translation.translatorsDirPath.replace("'", "'\\''", "g")+"'";
		var args = ["-c", "cd "+translatorsDirPathClean+" && git pull origin master"];
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
