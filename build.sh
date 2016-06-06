#!/bin/bash
CWD="`pwd`"
EXTENSIONDIR="$CWD/modules/zotero"
XULRUNNERSDKDIR="$CWD/xulrunner-sdk"

XPCOMDIR="$EXTENSIONDIR/chrome/content/zotero/xpcom"
BUILDDIR="$CWD/build"
ASSETSDIR="$CWD/assets"

rm -rf "$BUILDDIR"
mkdir "$BUILDDIR"

FRAMEWORKDIR="$XULRUNNERSDKDIR/bin/XUL.framework/Versions/Current"
if [ -e "$FRAMEWORKDIR" ]; then
	BINDIR="$FRAMEWORKDIR"
else
	BINDIR="$XULRUNNERSDKDIR/bin"
fi

cp -r "$BINDIR/omni.ja" \
	"$BINDIR/"lib* \
	"$ASSETSDIR/run_translation-server.sh" \
	"$BUILDDIR"
mkdir -p "$BUILDDIR/defaults/pref"

if [ -e "$BINDIR/js" ]; then
	cp "$BINDIR/js" "$BUILDDIR"
fi
if [ -e "$BINDIR/XUL" ]; then
	cp "$BINDIR/XUL" "$BUILDDIR"
fi
if [ -e "$BINDIR/xpcshell.exe" ]; then
	cp "$BINDIR/xpcshell.exe" \
		"$BINDIR/js.exe" \
		"$BINDIR/"*.dll \
		"$BUILDDIR"
else
	cp "$BINDIR/xpcshell" "$BUILDDIR"
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
	"$XPCOMDIR/server.js" \
	"$XPCOMDIR/utilities.js" \
	"$XPCOMDIR/utilities_translate.js" \
	"$XPCOMDIR/xregexp" \
	"$EXTENSIONDIR/chrome/content/zotero/tools/testTranslators/translatorTester.js" \
	"$BUILDDIR/translation-server"

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

mkdir "$BUILDDIR/translation-server/resource"
cp -r "$EXTENSIONDIR/resource/q.js" "$BUILDDIR/translation-server/resource"

cp "$CWD/config.js" "$BUILDDIR/defaults/pref"
echo "content translation-server translation-server/" >> "$BUILDDIR/chrome.manifest"
echo "resource zotero translation-server/resource/" >> "$BUILDDIR/chrome.manifest"

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
