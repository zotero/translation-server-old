#!/bin/bash
CWD="`pwd`"
EXTENSIONDIR="$CWD/modules/zotero"
XULRUNNERSDKDIR="$CWD/xulrunner-sdk"

XPCOMDIR="$EXTENSIONDIR/chrome/content/zotero/xpcom"
BUILDDIR="$CWD/build"
ASSETSDIR="$CWD/assets"

rm -rf "$BUILDDIR"
mkdir "$BUILDDIR"

cp -r "$XULRUNNERSDKDIR/bin/chrome" \
	"$XULRUNNERSDKDIR/bin/chrome.manifest" \
	"$XULRUNNERSDKDIR/bin/components" \
	"$XULRUNNERSDKDIR/bin/defaults" \
	"$XULRUNNERSDKDIR/bin/greprefs.js" \
	"$XULRUNNERSDKDIR/bin/"lib* \
	"$XULRUNNERSDKDIR/bin/modules" \
	"$XULRUNNERSDKDIR/bin/xpcshell" \
	"$ASSETSDIR/run_translation-server.sh" \
	"$BUILDDIR"
if [ -e "$XULRUNNERSDKDIR/bin/js" ]; then
	cp "$XULRUNNERSDKDIR/bin/js" "$BUILDDIR"
fi
if [ -e "$XULRUNNERSDKDIR/bin/XUL" ]; then
	cp "$XULRUNNERSDKDIR/bin/XUL" "$BUILDDIR"
fi

mkdir "$BUILDDIR/translation-server"
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
	"$EXTENSIONDIR/chrome/content/zotero/tools/testTranslators/translatorTester.js" \
	"$BUILDDIR/translation-server"

#cp -r "$ASSETSDIR/application.ini" "$ASSETSDIR/chrome.manifest" "$CWD/components" "$RESDIR"
#cp -r "$ASSETSDIR/translation-server.xul" "$RESDIR/chrome"

mkdir "$BUILDDIR/translation-server/connector"
cp -r "$XPCOMDIR/connector/cachedTypes.js" \
	"$XPCOMDIR/connector/translator.js" \
	"$XPCOMDIR/connector/typeSchemaData.js" \
	"$BUILDDIR/translation-server/connector"

mkdir "$BUILDDIR/translation-server/translation"
cp -r "$XPCOMDIR/translation/tlds.js" \
	"$XPCOMDIR/translation/translate.js" \
	"$XPCOMDIR/translation/translate_firefox.js" \
	"$BUILDDIR/translation-server/translation"

cp "$CWD/config.js" "$BUILDDIR/defaults/pref"
echo "content translation-server translation-server/" >> "$BUILDDIR/chrome.manifest"

# Uncomment to enable Venkman
#mkdir "$RESDIR/extensions"
#cp "$CWD/{f13b157f-b174-47e7-a34d-4815ddfdfeb8}.xpi" "$RESDIR/extensions"

# Add preferences
#cp -r "$EXTENSIONDIR/defaults" "$RESDIR"
#cp -r "$CWD/config.js" "$ASSETSDIR/prefs.js" "$RESDIR/defaults/preferences"
#perl -pi -e 's/pref\("extensions\.zotero\.httpServer\.enabled", false\);/pref("extensions.zotero.httpServer.enabled", true);/g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.httpServer\.port",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.log",\s*false\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.level",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.time",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/extensions.zotero/translation-server/g' "$RESDIR/defaults/preferences/zotero.js"

find "$BUILDDIR" -depth -type d -name .svn -exec rm -rf {} \;
find "$BUILDDIR" -name .DS_Store -exec rm -rf \;
find "$BUILDDIR" -name '._*' -exec rm -rf \;