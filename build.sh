#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXTENSIONDIR="$SCRIPT_DIR/modules/zotero"
FIREFOXSDKDIR="$SCRIPT_DIR/firefox-sdk"

XPCOMDIR="$EXTENSIONDIR/chrome/content/zotero/xpcom"
BUILDDIR="$SCRIPT_DIR/build"
ASSETSDIR="$SCRIPT_DIR/assets"

rm -rf "$BUILDDIR"
mkdir "$BUILDDIR"

BINSDKDIR="$FIREFOXSDKDIR/sdk/bin"
BINDIR="$FIREFOXSDKDIR/bin"

if [ `uname -s` = "Darwin" ]; then
	cp -R "$FIREFOXSDKDIR/bin/Firefox.app/Contents/Resources/omni.ja" \
		"$FIREFOXSDKDIR"/bin/Firefox.app/Contents/MacOS/XUL \
		"$FIREFOXSDKDIR"/bin/Firefox.app/Contents/MacOS/lib* \
		"$FIREFOXSDKDIR"/bin/Firefox.app/Contents/Resources/icudt56l.dat \
		"$BUILDDIR"
else
	cp "$BINDIR/omni.ja" \
		"$BINDIR/icudt56l.dat" \
		"$BINDIR/"lib* \
		"$BUILDDIR"
fi

cp -p "$ASSETSDIR/run_translation-server.sh" "$BUILDDIR"
mkdir -p "$BUILDDIR/defaults/pref"

if [ -e "$BINDIR/XUL" ]; then
	cp "$BINDIR/XUL" "$BUILDDIR"
fi
if [ -e "$BINSDKDIR/xpcshell.exe" ]; then
	cp "$BINSDKDIR/xpcshell.exe" \
		"$BINDIR/"*.dll \
		"$BUILDDIR"
	chmod a+x "$BUILDDIR/xpcshell.exe"
else
	cp "$BINSDKDIR/xpcshell" "$BUILDDIR"
	chmod a+x "$BUILDDIR/xpcshell"
fi

mkdir "$BUILDDIR/translation-server"
cp -R "$SCRIPT_DIR/src/"* \
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
cp -R "$XPCOMDIR/connector/cachedTypes.js" \
	"$XPCOMDIR/connector/translator.js" \
	"$XPCOMDIR/connector/typeSchemaData.js" \
	"$BUILDDIR/translation-server/connector"

mkdir "$BUILDDIR/translation-server/translation"
cp -R "$XPCOMDIR/translation/tlds.js" \
	"$XPCOMDIR/translation/translate.js" \
	"$XPCOMDIR/translation/translate_firefox.js" \
	"$BUILDDIR/translation-server/translation"

mkdir "$BUILDDIR/translation-server/resource"
cp -R "$EXTENSIONDIR/resource/q.js" "$BUILDDIR/translation-server/resource"

cp "$SCRIPT_DIR/config.js" "$BUILDDIR/defaults/pref"
echo "content translation-server translation-server/" >> "$BUILDDIR/chrome.manifest"
echo "resource zotero translation-server/resource/" >> "$BUILDDIR/chrome.manifest"

# Uncomment to enable Venkman
#mkdir "$RESDIR/extensions"
#cp "$SCRIPT_DIR/{f13b157f-b174-47e7-a34d-4815ddfdfeb8}.xpi" "$RESDIR/extensions"

# Add preferences
#cp -r "$EXTENSIONDIR/defaults" "$RESDIR"
#cp -r "$SCRIPT_DIR/config.js" "$ASSETSDIR/prefs.js" "$RESDIR/defaults/preferences"
#perl -pi -e 's/pref\("extensions\.zotero\.httpServer\.enabled", false\);/pref("extensions.zotero.httpServer.enabled", true);/g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.httpServer\.port",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.log",\s*false\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.level",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.time",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/extensions.zotero/translation-server/g' "$RESDIR/defaults/preferences/zotero.js"

find "$BUILDDIR" -depth -type d -name .svn -exec rm -rf {} \;
find "$BUILDDIR" -name .DS_Store -exec rm -rf \;
find "$BUILDDIR" -name '._*' -exec rm -rf \;
