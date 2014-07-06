Zotero.CookieSandbox.prototype._attachToInterfaceRequestor = Zotero.CookieSandbox.prototype.attachToInterfaceRequestor;
/**
 * Replaces Zotero.CookieSandbox.prototype.attachToInterfaceRequestor to allow the cookieSandbox
 * to time out XMLHttpRequests
 */
Zotero.CookieSandbox.prototype.attachToInterfaceRequestor = function(ir) {
	// Check that we are not timed out
	if(this.timedOut) {
		throw "Translation timed out; no further XMLHttpRequests allowed";
	}
	
	if(ir instanceof Components.interfaces.nsIXMLHttpRequest) {
		// Add to list of xhrs
		if(!this.xhrs) {
			this.xhrs = [ir];
		} else {
			this.xhrs.push(ir);
		}
		
		var xhrs = this.xhrs;
		ir.addEventListener("loadend", function() {
			var index = xhrs.indexOf(ir);
			if(index !== -1) xhrs.shift(index, 1);
		}, false);
	}
	
	this._attachToInterfaceRequestor(ir);
};

/**
 * Sets a timeout for XHRs connected to a CookieSandbox
 */
Zotero.CookieSandbox.prototype.setTimeout = function(timeout, callback) {
	this.timedOut = false;
	this.clearTimeout();
	this._timer = Components.classes["@mozilla.org/timer;1"].
		createInstance(Components.interfaces.nsITimer);
	this._timerCallback = {"notify":(function() {
		this.timedOut = true;
		callback();
		this.clearTimeout();
		if(this.xhrs) {
			for(var i=0; i<this.xhrs.length; i++) {
				this.xhrs[i].abort();
			}
		}
	}).bind(this)};
	this._timer.initWithCallback(this._timerCallback, timeout, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
};

/**
 * Clears a timeout for XHRs connected to a CookieSandbox
 */
Zotero.CookieSandbox.prototype.clearTimeout = function() {
	if(this._timer) {
		this._timer.cancel();
		delete this._timer;
		delete this._timerCallback;
	}
};

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
	
	if(typeof urls === "string") urls = [urls];
					
	/**
	 * Loads the next page
	 * @inner
	 */
	var url;
	var doLoad = function() {
		if(urls.length) {
			var urlString = urls.shift();
			try {
				url = Services.io.newURI(urlString, "UTF-8", null).
					QueryInterface(Components.interfaces.nsIURL);
			} catch(e) {
				if(exception) {
					exception("Invalid URL "+urlString);
					return;
				} else {
					throw(e);
				}
			}
			
			Zotero.debug("Loading "+url.spec);
			xmlhttp.open('GET', url.spec, true);
			// This doesn't return if we use responseType = document. Don't know why.
			xmlhttp.responseType = "document";
			
			// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
			var channel = xmlhttp.channel;
			channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
			channel.forceAllowThirdPartyCookie = true;
			channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
			
			if(cookieSandbox) cookieSandbox.attachToInterfaceRequestor(xmlhttp);
			xmlhttp.send();
		} else {
			if(done) done();
		}
	};
	
	/**
	 * Callback to be executed when a page load completes
	 * @inner
	 */
	var onLoad = function() {
		var doc = xmlhttp.response;		
		if(doc || !exception) {
			try {
				doc = Zotero.HTTP.wrapDocument(doc, url);
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
			exception("XMLHttpRequest experienced an error");
			doLoad();
		};
		xmlhttp.onload = onLoad;
	} else {
		xmlhttp.onloadend = onLoad;
	}
	
	doLoad();
}