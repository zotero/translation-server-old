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
 * Override defaults for HTTP requests
 */
Zotero.HTTP.requestOriginal = Zotero.HTTP.request;
Zotero.HTTP.request = function (method, url, options = {}) {
	options = Object.assign(
		{
			dontCache: true,
			timeout: 5000
		},
		options
	);
	return Zotero.HTTP.requestOriginal(method, url, options);
};

Zotero.Proxies = {
	getPotentialProxies: function (uri) {
		return {
			[uri]: null
		};
	}
};

Zotero.Utilities.itemToAPIJSONOriginal = Zotero.Utilities.itemToAPIJSON;
Zotero.Utilities.itemToAPIJSON = function () {
	var json = Zotero.Utilities.itemToAPIJSONOriginal(...arguments);
	for (let o of json) {
		// Remove version
		delete o.version;
		
		// Add 8601 access date (minus milliseconds)
		if (o.accessDate == 'CURRENT_TIMESTAMP') {
			o.accessDate = new Date().toISOString().replace(/\.[0-9]{3}Z$/, "Z");
		}
	}
	return json;
};
