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
    
	
	Based on nsChromeExtensionHandler example code by Ed Anuff at
	http://kb.mozillazine.org/Dev_:_Extending_the_Chrome_Protocol
	
    ***** END LICENSE BLOCK *****
*/

const Cc = Components.classes;
const Ci = Components.interfaces;

/** XPCOM files to be loaded for all modes **/
const xpcomFiles = [
	'zotero',
	'cookieSandbox',
	'date',
	'debug',
	'file',
	'http',
	'openurl',
	'server',
	'server_translation',
	'translation/translate',
	'translation/translate_firefox',
	'translation/tlds',
	'utilities',
	'translate_item',
	'connector/translator',
	'connector/cachedTypes',
	'connector/typeSchemaData'
];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

ZoteroContext = function() {}
ZoteroContext.prototype = {
	/**
	 * Convenience method to replicate window.alert()
	 **/
	// TODO: is this still used? if so, move to zotero.js
	"alert":function alert(msg){
		this.Zotero.debug("alert() is deprecated from Zotero XPCOM");
		Cc["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Ci.nsIPromptService)
			.alert(null, "", msg);
	},
	
	/**
	 * Convenience method to replicate window.confirm()
	 **/
	// TODO: is this still used? if so, move to zotero.js
	"confirm":function confirm(msg){
		this.Zotero.debug("confirm() is deprecated from Zotero XPCOM");
		return Cc["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Ci.nsIPromptService)
			.confirm(null, "", msg);
	},
	
	"Cc":Cc,
	"Ci":Ci,
	
	/**
	 * Convenience method to replicate window.setTimeout()
	 **/
	"setTimeout":function setTimeout(func, ms){
		this.Zotero.setTimeout(func, ms);
	},
	
	/**
	 * Switches in or out of connector mode
	 */
	"switchConnectorMode":function(isConnector) {
		if(isConnector !== this.isConnector) {
			zContext.Zotero.shutdown();
			
			// create a new zContext
			makeZoteroContext(isConnector);
			zContext.Zotero.init();
		}
		
		return zContext;
	}
};

var zContext = null;

/**
 * The class from which the Zotero global XPCOM context is constructed
 *
 * @constructor
 * This runs when ZoteroService is first requested to load all applicable scripts and initialize
 * Zotero. Calls to other XPCOM components must be in here rather than in top-level code, as other
 * components may not have yet been initialized.
 */
function makeZoteroContext(isConnector) {
	zContext = new ZoteroContext();
	zContext.Zotero = function() {};
	
	// Load xpcomFiles
	for (var i=0; i<xpcomFiles.length; i++) {
		try {
			Cc["@mozilla.org/moz/jssubscript-loader;1"]
				.getService(Ci.mozIJSSubScriptLoader)
				.loadSubScript("chrome://translation-server/content/xpcom/" + xpcomFiles[i] + ".js", zContext);
		}
		catch (e) {
			Components.utils.reportError("Error loading " + xpcomFiles[i] + ".js", zContext);
			throw (e);
		}
	}
	
	// Load RDF files into Zotero.RDF.AJAW namespace (easier than modifying all of the references)
	const rdfXpcomFiles = [
		'rdf/uri',
		'rdf/term',
		'rdf/identity',
		'rdf/match',
		'rdf/n3parser',
		'rdf/rdfparser',
		'rdf/serialize',
		'rdf'
	];
	zContext.Zotero.RDF = {AJAW:{Zotero:zContext.Zotero}};
	for (var i=0; i<rdfXpcomFiles.length; i++) {
		Cc["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Ci.mozIJSSubScriptLoader)
			.loadSubScript("chrome://translation-server/content/xpcom/" + rdfXpcomFiles[i] + ".js", zContext.Zotero.RDF.AJAW);
	}
	
	// add connector-related properties
	zContext.Zotero.isConnector = true;
};

/**
 * The class representing the Zotero command line handler
 */
function CommandLineHandler() {}
CommandLineHandler.prototype = {
	/* nsISupports */
	QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsICommandLineHandler,
			Components.interfaces.nsIFactory, Components.interfaces.nsISupports]),
	
	/* nsICommandLineHandler */
	handle : function(cmdLine) {
		try {
			if(!zContext) makeZoteroContext(false);
			this.wrappedJSObject = zContext.Zotero;
		} catch(e) {
			var msg = typeof e == 'string' ? e : e.name;
			dump(e + "\n\n");
			Components.utils.reportError(e);
			throw e;
		}
		
		var port = cmdLine.handleFlagWithParam("port", false);
		zContext.Zotero.init(port);
	},
	
	contractID: "@mozilla.org/commandlinehandler/general-startup;1?type=translation-server",
	classDescription: "translation-server Command Line Handler",
	classID: Components.ID("{2f72439e-b42b-4c1f-bc33-23cb72770f74}"),
	service: true,
	_xpcom_categories: [{category:"command-line-handler", entry:"translation-server"}],
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsICommandLineHandler,
	                                       Components.interfaces.nsISupports])
};

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
var NSGetFactory = XPCOMUtils.generateNSGetFactory([CommandLineHandler]);