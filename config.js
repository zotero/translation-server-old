pref("translation-server.translatorsDirectory", "");
pref("translation-server.httpServer.port", "1969");
pref("translation-server.debug.log", true);
pref("translation-server.debug.time", true);
pref("translation-server.debug.level", 5);

// Don't retrieve unrequested links when performing standalone translation
pref("network.prefetch-next", false);

// Let operations run as long as necessary
pref("dom.max_chrome_script_run_time", 0);

// Use basicViewer for opening new DOM windows from content (for TinyMCE)
pref("browser.chromeURL", "chrome://zotero/content/standalone/basicViewer.xul");

// Disable CSS and images
pref("permissions.default.stylesheet", 2);
pref("permissions.default.image", 2);

pref("network.protocol-handler.expose-all", false);
pref("network.protocol-handler.expose.zotero", true);
pref("network.protocol-handler.expose.http", true);
pref("network.protocol-handler.expose.https", true);

// Never go offline
pref("offline.autoDetect", false);
pref("network.manage-offline-status", false);

// Without this, we will throw up dialogs if asked to translate strange pages
pref("browser.xul.error_pages.enabled", true);

// Without this, scripts may decide to open popups
pref("dom.disable_open_during_load", true);
pref("dom.popup_allowed_events", "");

// Disable places
pref("places.history.enabled", false);

// CORS
pref("translation-server.httpServer.allowedOrigins", "");
// Pass an email to Crossref query to utilize the faster servers pool
pref("translation-server.translators.CrossrefREST.email", "");
// Identifier search endpoint
pref("translation-server.identifierSearchURL", "");

// Blacklist domains
pref("translation-server.blacklistedDomains", "");

