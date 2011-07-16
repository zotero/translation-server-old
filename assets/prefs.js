// This is the URI that is loaded when Zotero Standalone is opened
pref("toolkit.defaultChromeURI", "chrome://translation-server/content/translation-server.xul");

// For debugging purposes, show errors in console by default
pref("javascript.options.showInConsole", true);

// Don't retreive unrequested links when performing standalone translation
pref("network.prefetch-next", false);

// Let operations run as long as necessary
pref("dom.max_script_run_time", 0);

// Let operations run as long as necessary
pref("dom.max_chrome_script_run_time", 0);

// Enable JaegerMonkey
pref("javascript.options.jitprofiling.chrome", true);
pref("javascript.options.jitprofiling.content", true);
pref("javascript.options.methodjit.chrome", true);
pref("javascript.options.methodjit.content", true);
pref("javascript.options.tracejit.chrome", true);
pref("javascript.options.tracejit.content", true);

// even though we don't use the addons repository, we need this
pref("extensions.getAddons.cache.enabled", false);