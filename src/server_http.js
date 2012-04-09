Zotero.HTTP.Location = function(url) {
	this._url = url;
	this.hash = url.ref ? "#"+url.ref : "";
	this.host = url.hostPort;
	this.hostname = url.host;
	this.href = url.spec;
	this.pathname = url.filePath;
	this.port = (url.schemeIs("https") ? 443 : 80);
	this.protocol = url.scheme+":";
	this.search = url.query ? "?"+url.query : "";
}
Zotero.HTTP.Location.prototype.toString = function() {
	return this.href;
}
/**
 * Load one or more documents in a hidden browser
 *
 * @param {String|String[]} urls URL(s) of documents to load
 * @param {Function} processor Callback to be executed for each document loaded
 * @param {Function} done Callback to be executed after all documents have been loaded
 * @param {Function} exception Callback to be executed if an exception occurs
 * @param {Boolean} dontDelete Unused.
 * @param {Zotero.CookieSandbox} [cookieSandbox] Cookie sandbox object
 * @return {browser} Hidden browser used for loading
 */
Zotero.HTTP.processDocuments = function(urls, processor, done, exception, dontDelete, cookieSandbox) {
	var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
	xmlhttp.mozBackgroundRequest = true;
					
	/**
	 * Loads the next page
	 * @inner
	 */
	var url;
	var doLoad = function() {
		if(urls.length) {
			url = Services.io.newURI(urls.shift(), "UTF-8", null).
				QueryInterface(Components.interfaces.nsIURL);
			Zotero.debug("Loading "+url.spec);
			xmlhttp.open('GET', url.spec, true);
			// This doesn't return if we use responseType = document. Don't know why.
			xmlhttp.responseType = "text";
			
			// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
			var channel = xmlhttp.channel;
			channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
			channel.forceAllowThirdPartyCookie = true;
			channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
			
			if(cookieSandbox) cookieSandbox.attachToInterfaceRequestor(xmlhttp);
			xmlhttp.send();
			Zotero.debug("hi1");
		} else {
			if(done) done();
		}
	};
	
	/**
	 * Callback to be executed when a page load completes
	 * @inner
	 */
	var onLoad = function() {
		Zotero.debug("hi2");
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
             .createInstance(Components.interfaces.nsIDOMParser);
		var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
			.getService(Components.interfaces.nsIScriptSecurityManager);
		parser.init(secMan.getCodebasePrincipal(url), url, url);
		var doc = parser.parseFromString(xmlhttp.responseText, "text/html");
		doc = Zotero.Translate.DOMWrapper.wrap(doc, {
			"location":{
				"value":(new Zotero.HTTP.Location(url))
			}
		});
		Zotero.debug("hi3");
		
		if(doc || !exception) {
			try {
				processor(doc);
			} catch(e) {
				if(exception) {
					exception(e);
					return;
				} else {
					throw(e);
				}
			}
		} else if(exception) {
			exception("XMLHttpRequest failed unexpectedly");
		}
		
		doLoad();
	};
	
	if(cookieSandbox) cookieSandbox.attachToInterfaceRequestor(xmlhttp);
	if(exception) {
		xmlhttp.onerror = xmlhttp.onabort = xmlhttp.ontimeout = function() {
			Zotero.debug("hi1");
			exception("XMLHttpRequest experienced an error");
			doLoad();
		};
		xmlhttp.onload = onLoad;
	} else {
		xmlhttp.onloadend = onLoad;
	}
	xmlhttp.onloadend = function() { Zotero.debug("hi4") };
	
	doLoad();
}