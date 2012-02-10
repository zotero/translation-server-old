#!/bin/bash
CWD="`pwd`"
EXTENSIONDIR="$CWD/modules/zotero"
XULRUNNERDIR="/Library/Frameworks/XUL.framework"

XPCOMDIR="$EXTENSIONDIR/chrome/content/zotero/xpcom"
BUILDDIR="$CWD/build"
ASSETSDIR="$CWD/assets"

rm -rf "$BUILDDIR"
mkdir "$BUILDDIR"

if [ -a "$XULRUNNERDIR/Versions" ]; then	# Mac OS X build
	# Set up directory structure
	APPDIR="$BUILDDIR/translation-server.app"
	rm -rf "$APPDIR"
	mkdir "$APPDIR"
	chmod 755 "$APPDIR"
	CONTENTSDIR="$APPDIR/Contents"
	mkdir "$CONTENTSDIR"
	cp -r "$ASSETSDIR/Info.plist" "$CONTENTSDIR"
	
	# Merge xulrunner and relevant assets
	mkdir "$CONTENTSDIR/MacOS"
	mkdir "$CONTENTSDIR/Frameworks"
	mkdir "$CONTENTSDIR/Resources"
	cp -a "$XULRUNNERDIR" "$CONTENTSDIR/Frameworks/XUL.framework"
	rm "$CONTENTSDIR/Frameworks/XUL.framework/Versions/Current"
	mv "$CONTENTSDIR/Frameworks/XUL.framework/Versions/"[1-9]* "$CONTENTSDIR/Frameworks/XUL.framework/Versions/Current"
	cp "$CONTENTSDIR/Frameworks/XUL.framework/Versions/Current/xulrunner" "$CONTENTSDIR/MacOS/zotero"
	RESDIR="$CONTENTSDIR/Resources"
else										# Linux build
	# Set up directory
	RESDIR="$BUILDDIR"
	rm -rf "$RESDIR"
	mkdir "$RESDIR"
	cp -r "$XULRUNNERDIR" "$RESDIR/xulrunner"
	mv "$RESDIR/xulrunner/xulrunner-stub" "$RESDIR/translation-server"
fi

# Add components
mkdir "$RESDIR/chrome"
mkdir "$RESDIR/chrome/xpcom"

cp -r "$ASSETSDIR/application.ini" "$ASSETSDIR/chrome.manifest" "$CWD/components" "$RESDIR"
cp -r "$ASSETSDIR/translation-server.xul" "$RESDIR/chrome"
cp -r "$CWD/src/"* \
	"$XPCOMDIR/rdf" \
	"$XPCOMDIR/cookieSandbox.js" \
	"$XPCOMDIR/date.js" \
	"$XPCOMDIR/debug.js" \
	"$XPCOMDIR/file.js" \
	"$XPCOMDIR/http.js" \
	"$XPCOMDIR/openurl.js" \
	"$XPCOMDIR/rdf.js" \
	"$XPCOMDIR/server.js" \
	"$XPCOMDIR/utilities.js" \
	"$XPCOMDIR/utilities_translate.js" \
	"$RESDIR/chrome/xpcom"

mkdir "$RESDIR/chrome/xpcom/connector"
cp -r "$XPCOMDIR/connector/cachedTypes.js" \
	"$XPCOMDIR/connector/translator.js" \
	"$XPCOMDIR/connector/typeSchemaData.js" \
	"$RESDIR/chrome/xpcom/connector"

mkdir "$RESDIR/chrome/xpcom/translation"
cp -r "$XPCOMDIR/translation/tlds.js" \
	"$XPCOMDIR/translation/translate.js" \
	"$XPCOMDIR/translation/translate_firefox.js" \
	"$RESDIR/chrome/xpcom/translation"

# Uncomment to enable Venkman
#mkdir "$RESDIR/extensions"
#cp "$CWD/{f13b157f-b174-47e7-a34d-4815ddfdfeb8}.xpi" "$RESDIR/extensions"

# Add preferences
cp -r "$EXTENSIONDIR/defaults" "$RESDIR"
cp -r "$CWD/config.js" "$ASSETSDIR/prefs.js" "$RESDIR/defaults/preferences"
perl -pi -e 's/pref\("extensions\.zotero\.httpServer\.enabled", false\);/pref("extensions.zotero.httpServer.enabled", true);/g' "$RESDIR/defaults/preferences/zotero.js"
perl -pi -e 's/pref\("extensions\.zotero\.httpServer\.port",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
perl -pi -e 's/pref\("extensions\.zotero\.debug\.log",\s*false\);//g' "$RESDIR/defaults/preferences/zotero.js"
perl -pi -e 's/pref\("extensions\.zotero\.debug\.level",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
perl -pi -e 's/pref\("extensions\.zotero\.debug\.time",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
perl -pi -e 's/extensions.zotero/translation-server/g' "$RESDIR/defaults/preferences/zotero.js"

find "$BUILDDIR" -depth -type d -name .svn -exec rm -rf {} \;
find "$BUILDDIR" -name .DS_Store -exec rm -rf \;
find "$BUILDDIR" -name '._*' -exec rm -rf \;