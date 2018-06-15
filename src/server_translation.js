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

Zotero.Server.Translation.Root = function() {};
Zotero.Server.Endpoints["/"] = Zotero.Server.Translation.Root;
Zotero.Server.Translation.Root.prototype = {
	"supportedMethods":["GET"],
	
	init: async function (requestData) {
		return [200];
	}

}

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
			var nsIURL = Services.io.newURI(data.url, "UTF-8", null);
		}
		catch(e) {}
		if (!nsIURL || (!nsIURL.schemeIs("http") && !nsIURL.schemeIs("https"))) {
			sendResponseCallback(400, "text/plain", "Invalid URL specified\n");
			return;
		}
		
		let m = data.url.match(/https?:\/\/([^/]+)/);
		if (m) {
			let domain = m[1];
			let blacklisted = Zotero.Prefs.get("blacklistedDomains")
				.split(',')
				.some(x => x && new RegExp(x).test(domain));
			if (blacklisted) {
				let doi = Zotero.Utilities.cleanDOI(data.url);
				if (doi) {
					return sendResponseCallback(...(await Zotero.Server.Translation.Search.prototype.init({data: doi})));
				}
				else {
					return sendResponseCallback(500, "text/plain", "An error occurred retrieving the document\n");
				}
			}
		}
		
		// If a doi.org URL, use search handler
		if (data.url.match(/^https?:\/\/[^\/]*doi\.org\//)) {
			let doi = Zotero.Utilities.cleanDOI(data.url);
			return sendResponseCallback(...(await Zotero.Server.Translation.Search.prototype.init({data: doi})));
		}
		
		var urlsToTry = Zotero.Prefs.get('deproxifyURLs') ? this.deproxifyURL(data.url) : [data.url];
		for (let i = 0; i < urlsToTry.length; i++) {
			let url = urlsToTry[i];
			if (urlsToTry.length > 1) {
				Zotero.debug("Trying " + url);
			}
			
			let runningInstance;
			if ((runningInstance = Zotero.Server.Translation.waitingForSelection[data.sessionid])
					&& data.items) {
				// Already waiting for a items response, so just pass this there
				runningInstance._cookieSandbox.setTimeout(SERVER_TRANSLATION_TIMEOUT*1000,
					runningInstance.timeout.bind(runningInstance));
				runningInstance.sendResponse = sendResponseCallback;
				runningInstance.selectDone(data.items);
				break;
			}
			
			// New request
			this.sendResponse = sendResponseCallback;
			this._data = data;
			this._cookieSandbox = new Zotero.CookieSandbox(null, url);
			this._cookieSandbox.setTimeout(SERVER_TRANSLATION_TIMEOUT*1000,
				this.timeout.bind(this));
			
			let translate = this._translate = new Zotero.Translate.Web();
			translate.setHandler("translators", this.translators.bind(this));
			translate.setHandler("select", this.select.bind(this));
			translate.setCookieSandbox(this._cookieSandbox);
			
			try {
				await Zotero.HTTP.processDocuments(
					[url],
					(doc) => {
						translate.setDocument(doc);
						// This could be optimized by only running detect on secondary translators
						// if the first fails, but for now just run detect on all
						return translate.getTranslators(true);
					},
					this._cookieSandbox
				);
				break;
			}
			catch (e) {
				Zotero.debug(e, 1);
				
				//Parse URL up to '?' for DOI
				let doi = Zotero.Utilities.cleanDOI(decodeURIComponent(data.url).match(/[^\?]+/)[0]);
				if (doi) {
					Zotero.debug("Found DOI in URL -- continuing with " + doi);
					return sendResponseCallback(...(await Zotero.Server.Translation.Search.prototype.init({data: doi})));
				}
				
				// No more URLs to try
				if (i == urlsToTry.length - 1) {
					sendResponseCallback(500, "text/plain", "An error occurred retrieving the document\n");
				}
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
	 * Try to determine whether the passed URL looks like a proxied URL based on TLDs in the
	 * middle of the domain and return a list of likely URLs, starting with the longest domain
	 * and ending with the original one
	 *
	 * E.g., https://www-example-co-uk.mutex.gmu.edu ->
	 *
	 * [
	 *   'https://www.example.co.uk',
	 *   'https://www.example.co',
	 *   'https://www-example-co-uk.mutex.gmu.edu',
	 * ]
	 *
	 * Based on Zotero.Proxies.getPotentialProxies()
	 */
	deproxifyURL: function (url) {
		var urlToProxy = {
			[url]: null
		};
		
		// if there is a subdomain that is also a TLD, also test against URI with the domain
		// dropped after the TLD
		// (i.e., www.nature.com.mutex.gmu.edu => www.nature.com)
		var m = /^(https?:\/\/)([^\/]+)/i.exec(url);
		if (m) {
			// First, drop the 0- if it exists (this is an III invention)
			var host = m[2];
			if (host.substr(0, 2) === "0-") host = host.substr(2);
			var hostnameParts = [host.split(".")];
			if (m[1] == 'https://') {
				// try replacing hyphens with dots for https protocol
				// to account for EZProxy HttpsHypens mode
				hostnameParts.push(host.split('.'));
				hostnameParts[1].splice(0, 1, ...(hostnameParts[1][0].replace(/-/g, '.').split('.')));
			}
			
			for (let i=0; i < hostnameParts.length; i++) {
				let parts = hostnameParts[i];
				// If hostnameParts has two entries, then the second one is with replaced hyphens
				let dotsToHyphens = i == 1;
				// skip the lowest level subdomain, domain and TLD
				for (let j=1; j<parts.length-2; j++) {
					// if a part matches a TLD, everything up to it is probably the true URL
					if (TLDS[parts[j].toLowerCase()]) {
						var properHost = parts.slice(0, j+1).join(".");
						// protocol + properHost + /path
						var properURL = m[1]+properHost + url.substr(m[0].length);
						var proxyHost = parts.slice(j + 1).join('.');
						urlToProxy[properURL] = {scheme: '%h.' + proxyHost + '/%p', dotsToHyphens};
					}
				}
			}
		}
		var urls = Object.keys(urlToProxy);
		urls.sort((a, b) => b.length - a.length);
		urls.push(urls.shift());
		return urls;
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
	
	init: async function (requestData) {
		var data = requestData.data;
		if (!data) {
			return [400, "text/plain", "No input provided\n"];
		}
		
		let identifiers = Zotero.Utilities.Internal.extractIdentifiers(data);
		
		// Use PMID only if it's the only text in the query
		if (identifiers.length && identifiers[0].PMID && identifiers[0].PMID !== data.trim()) {
			identifiers = [];
		}
		
		if (!identifiers.length) {
			let result = await this.textSearch.search(
				data,
				requestData.query && requestData.query.start
			);
			
			// Throw selection if two or more items are found, or the selection flag is marked
			if (result.items.length >= 2 || result.items.length >= 1 && result.select) {
				let newItems = {};
				
				for (let item of result.items) {
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
						description: this.textSearch.formatDescription(item),
					};
				}
				
				let headers = {
					'Content-Type': 'application/json'
				};
				// If there were more results, include a link to the next result set
				if (result.next) {
					headers.Link = `</search?start=${result.next}>; rel="next"`;
				}
				return [300, headers, JSON.stringify(newItems)];
			}
			else if (result.items.length === 1) {
				return [
					200,
					"application/json",
					JSON.stringify(Zotero.Utilities.itemToAPIJSON(result.items[0]))
				];
			}
			
			return [200, "application/json", "[]"];
		}
		
		try {
			var translate = new Zotero.Translate.Search();
			translate.setIdentifier(identifiers[0]);
			let translators = await translate.getTranslators();
			if (!translators.length) {
				return [501, "text/plain", "No translators available\n"];
			}
			translate.setTranslator(translators);
			
			var items = await translate.translate({
				libraryID: false
			});
		}
		catch (e) {
			if (e == translate.ERROR_NO_RESULTS) {
				return [
					501,
					"text/plain",
					e + "\n"
				];
			}
			
			Zotero.debug(e, 1);
			return [
				500,
				"text/plain",
				"An error occurred during translation. "
					+ "Please check translation with the Zotero client.\n"
			];
		}
		
		// Translation can return multiple items (e.g., a parent item and notes pointing to it),
		// so we have to return an array with keyed items
		var newItems = [];
		items.forEach(item => {
			newItems.push(...Zotero.Utilities.itemToAPIJSON(item));
		});
		
		return [200, "application/json", JSON.stringify(newItems)];
	},
	
	textSearch: new function () {
		this.search = async function (query, start) {
			const numResults = 3;
			let identifiers;
			try {
				let xmlhttp = await Zotero.HTTP.request(
					"GET",
					Zotero.Prefs.get("identifierSearchURL") + encodeURIComponent(query),
					{
						timeout: 15000
					}
				);
				identifiers = JSON.parse(xmlhttp.responseText);
			}
			catch (e) {
				Zotero.debug(e, 1);
				return {select: false, items: []};
			}
			
			// If passed a start= parameter, skip ahead
			let startPos = 0;
			if (start) {
				for (let i = 0; i < identifiers.length; i++) {
					if (identifierToToken(identifiers[i]) === start) {
						startPos = i + 1;
						break;
					}
				}
			}
			
			let nextLastIdentifier = null;
			if (identifiers.length > startPos + numResults) {
				// Keep track of last identifier if we're limiting results
				nextLastIdentifier = identifiers[startPos + numResults - 1];
			}
			
			identifiers = identifiers.slice(startPos, startPos + numResults);
			
			let newItems = await resolveIdentifiers(identifiers);
			
			// Todo: No need to validate non-book items
			let items = newItems.filter(x => validateItem(x, query));
			
			return {
				// Force item selection, even for a single item
				select: true,
				items,
				next: nextLastIdentifier ? identifierToToken(nextLastIdentifier) : null
			};
		};
		
		function validateItem(item, query) {
			let parts = [];
			
			parts.push(item.title);
			
			for (let creator of item.creators) {
				if (creator.firstName) parts.push(creator.firstName);
				if (creator.lastName) parts.push(creator.lastName);
			}
			
			if (item.date) parts.push(item.date);
			
			if (item.publisher) parts.push(item.publisher);
			
			let text = parts.join(' ');
			text = normalize(text);
			
			let queryWords = normalize(query).split(' ').filter(x => x);
			
			let foundQueryWords = 0;
			for (let queryWord of queryWords) {
				if (text.includes(queryWord)) {
					foundQueryWords++;
				}
			}
			
			if (queryWords.length === 1 && foundQueryWords === 1) {
				return true;
			}
			else if (queryWords.length === 2 && foundQueryWords === 2) {
				return true;
			}
			else if (queryWords.length === 3 && foundQueryWords >= 2) {
				return true;
			}
			else if (queryWords.length >= 4 && foundQueryWords >= 3) {
				return true;
			}
			
			return false;
		}
		
		this.formatDescription = function (item) {
			let parts = [];
			
			let authors = [];
			for (let creator of item.creators) {
				if (creator.creatorType === 'author' && creator.lastName) {
					authors.push(creator.lastName);
					if (authors.length === 3) break;
				}
			}
			
			if (authors.length) parts.push(authors.join(', '));
			
			if (item.date) {
				let m = item.date.toString().match(/[0-9]{4}/);
				if (m) parts.push(m[0]);
			}
			
			if (item.publicationTitle) {
				parts.push(item.publicationTitle);
			}
			else if (item.publisher) {
				parts.push(item.publisher);
			}
			
			return parts.join(' \u2013 ');
		};
		
		async function resolveIdentifiers(identifiers) {
			let DOIs = identifiers.filter(x => x.DOI).map(x => x.DOI);
			let ISBNs = identifiers.filter(x => x.ISBN).map(x => x.ISBN);
			
			let [itemsDOI, itemsISBN] = await Promise.all([resolveDOIs(DOIs), resolveISBNs(ISBNs)]);
			
			// Replace identifiers with the actual items
			let items = identifiers;
			
			for (let itemDOI of itemsDOI) {
				let DOI = itemDOI.DOI;
				if (!DOI && itemDOI.extra) {
					let m = itemDOI.extra.match(/DOI: (.*)/);
					if (m) {
						DOI = m[1];
					}
				}
				
				if (!DOI) continue;
				
				for (let i = 0; i < items.length; i++) {
					let item = items[i];
					if (!item.itemType && item.DOI === DOI) {
						items.splice(i, 1, itemDOI);
					}
				}
			}
			
			for (let itemISBN of itemsISBN) {
				if (!itemISBN.ISBN) continue;
				let itemISBNList = itemISBN.ISBN.split(' ');
				
				for (let i = 0; i < items.length; i++) {
					let item = items[i];
					if (!item.itemType && itemISBNList.includes(item.ISBN)) {
						items.splice(i, 1, itemISBN);
					}
				}
			}
			
			items = items.filter(x => x.itemType);
			return items;
		}
		
		async function resolveDOIs(identifiers) {
			if (!identifiers.length) return [];
			let items = [];
			let translate = new Zotero.Translate.Search();
			try {
				// Crossref REST
				translate.setTranslator("0a61e167-de9a-4f93-a68a-628b48855909");
				translate.setSearch({DOI: identifiers});
				items = await translate.translate({libraryID: false});
			}
			catch (e) {
				if (e !== translate.ERROR_NO_RESULTS) {
					Zotero.debug(e, 1);
				}
			}
			return items;
		}
		
		async function resolveISBNs(ISBNs) {
			return (await Promise.all(ISBNs.map(x => resolveISBN(x)))).filter(x => x);
		}
		
		async function resolveISBN(ISBN) {
			let translate = new Zotero.Translate.Search();
			try {
				translate.setIdentifier({ISBN});
				let translators = await translate.getTranslators();
				if (translators.length) {
					translate.setTranslator(translators);
					let items = await translate.translate({
						libraryID: false
					});
					if (items.length) {
						return items[0];
					}
				}
			}
			catch (e) {
				if (e !== translate.ERROR_NO_RESULTS) {
					Zotero.debug(e, 1);
				}
			}
			return null;
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
		
		function identifierToToken(identifier) {
			return Zotero.Utilities.Internal.md5(JSON.stringify(identifier));
		}
	},
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
