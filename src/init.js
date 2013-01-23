/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2012 Center for History and New Media
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
	'utilities_translate',
	'translate_item',
	'connector/translator',
	'connector/cachedTypes',
	'connector/typeSchemaData',
	'hacks'
];

var Zotero = function() {},
	subscriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);

// Load XRegExp object into Zotero.XRegExp
const xregexpFiles = [
	/**Core functions**/
	'xregexp',

	/**Addons**/
	'addons/build',												//adds ability to "build regular expressions using named subpatterns, for readability and pattern reuse"
	'addons/matchrecursive',							//adds ability to "match recursive constructs using XRegExp pattern strings as left and right delimiters"

	/**Unicode support**/
	'addons/unicode/unicode-base',				//required for all other unicode packages. Adds \p{Letter} category

	//'addons/unicode/unicode-blocks',			//adds support for all Unicode blocks (e.g. InArabic, InCyrillic_Extended_A, etc.)
	'addons/unicode/unicode-categories',	//adds support for all Unicode categories (e.g. Punctuation, Lowercase_Letter, etc.)
	//'addons/unicode/unicode-properties',	//adds Level 1 Unicode properties (e.g. Uppercase, White_Space, etc.)
	//'addons/unicode/unicode-scripts'			//adds support for all Unicode scripts (e.g. Gujarati, Cyrillic, etc.)
	'addons/unicode/unicode-zotero'				//adds support for some Unicode categories used in Zotero
];
for (var i=0; i<xregexpFiles.length; i++) {
	subscriptLoader.loadSubScript("chrome://translation-server/content/xregexp/" + xregexpFiles[i] + ".js");
}
	
// Load xpcomFiles
for (var i=0; i<xpcomFiles.length; i++) {
	try {
		subscriptLoader.loadSubScript("chrome://translation-server/content/" + xpcomFiles[i] + ".js");
	}
	catch (e) {
		Components.utils.reportError("Error loading " + xpcomFiles[i] + ".js");
		throw (e);
	}
}

// Load RDF files into Zotero.RDF.AJAW namespace (easier than modifying all of the references)
const rdfXpcomFiles = [
	'rdf/init',
	'rdf/uri',
	'rdf/term',
	'rdf/identity',
	'rdf/match',
	'rdf/n3parser',
	'rdf/rdfparser',
	'rdf/serialize'
];
Zotero.RDF = {Zotero:Zotero};
for (var i=0; i<rdfXpcomFiles.length; i++) {
	subscriptLoader.loadSubScript("chrome://translation-server/content/" + rdfXpcomFiles[i] + ".js", Zotero.RDF);
}

// add connector-related properties
Zotero.isConnector = true;

var mainThread = Components.classes["@mozilla.org/thread-manager;1"]
		.getService(Components.interfaces.nsIThreadManager).currentThread;

if(arguments[0] === "-test" && arguments[1]) {
	Zotero.init(false);
	subscriptLoader.loadSubScript("chrome://translation-server/content/translatorTester.js");
	// Override TEST_RUN_TIMEOUT from translatorTester.js
	TEST_RUN_TIMEOUT = SERVER_TRANSLATION_TIMEOUT*1000;
	
	// Get file to write to
	var outfile = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
	outfile.initWithPath(arguments[1]);
	
	var shouldExit = false;
	Zotero_TranslatorTesters.runAllTests(32, {}, function(data) {
		// Write data
		try {
			Zotero.File.putContents(outfile, JSON.stringify(data, null, "\t"));
		} catch(e) {
			Zotero.debug(e);
		}
		shouldExit = true;
	});
	while(!shouldExit) mainThread.processNextEvent(true);
} else {
	Zotero.init(arguments[0] === "-port" ? arguments[1] : undefined);
	while(true) mainThread.processNextEvent(true);
}