#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"


function usage {
	cat >&2 <<DONE
Usage: $0 [-d DIR] [-c DIR]
Options
 -d DIR              Zotero client build directory to build from instead of using submodule
 -c DIR              Connector directory to build from instead of using submodule
 -k                  Skip copying of SDK files
DONE
	exit 1
}

EXTENSION_DIR="$SCRIPT_DIR/modules/zotero/build"
CONNECTOR_DIR="$SCRIPT_DIR/modules/zotero-connectors"
SKIP_SDK=0
while getopts "d:c:k" opt; do
	case $opt in
		d)
			EXTENSION_DIR="$OPTARG"
			;;
		c)
			CONNECTOR_DIR="$OPTARG"
			;;
		k)
			SKIP_SDK=1
			;;
		*)
			usage
			;;
	esac
	shift $((OPTIND-1)); OPTIND=1
done

FIREFOX_SDK_DIR="$SCRIPT_DIR/firefox-sdk"

XPCOM_DIR="$EXTENSION_DIR/chrome/content/zotero/xpcom"
BUILD_DIR="$SCRIPT_DIR/build"
ASSETS_DIR="$SCRIPT_DIR/assets"

rm -rf "$BUILD_DIR"
mkdir "$BUILD_DIR"

BIN_SDK_DIR="$FIREFOX_SDK_DIR/sdk/bin"
BIN_DIR="$FIREFOX_SDK_DIR/bin"

# Copy SDK files
if [ $SKIP_SDK -eq 0 ]; then
	if [ `uname -s` = "Darwin" ]; then
		cp -R "$FIREFOX_SDK_DIR/bin/Firefox.app/Contents/Resources/omni.ja" \
			"$FIREFOX_SDK_DIR"/bin/Firefox.app/Contents/MacOS/XUL \
			"$FIREFOX_SDK_DIR"/bin/Firefox.app/Contents/MacOS/lib* \
			"$FIREFOX_SDK_DIR"/bin/Firefox.app/Contents/Resources/icudt58l.dat \
			"$BUILD_DIR"
	else
		cp "$BIN_DIR/omni.ja" \
			"$BIN_DIR/icudt58l.dat" \
			"$BIN_DIR/"lib* \
			"$BUILD_DIR"
	fi
	
	if [ -e "$BIN_DIR/XUL" ]; then
		cp "$BIN_DIR/XUL" "$BUILD_DIR"
	fi
	if [ -e "$BIN_SDK_DIR/xpcshell.exe" ]; then
		cp "$BIN_SDK_DIR/xpcshell.exe" \
			"$BIN_DIR/"*.dll \
			"$BUILD_DIR"
		chmod a+x "$BUILD_DIR/xpcshell.exe"
	else
		cp "$BIN_SDK_DIR/xpcshell" "$BUILD_DIR"
		chmod a+x "$BUILD_DIR/xpcshell"
	fi
fi

cp -Rp "$ASSETS_DIR"/* "$BUILD_DIR"
mkdir -p "$BUILD_DIR/defaults/pref"

mkdir "$BUILD_DIR/app"
# Copy server files
cp -R "$SCRIPT_DIR/src/"* "$BUILD_DIR/app"
# Copy client XPCOM files
cp -R "$XPCOM_DIR/rdf" \
	"$XPCOM_DIR/citeproc.js" \
	"$XPCOM_DIR/cookieSandbox.js" \
	"$XPCOM_DIR/date.js" \
	"$XPCOM_DIR/debug.js" \
	"$XPCOM_DIR/file.js" \
	"$XPCOM_DIR/http.js" \
	"$XPCOM_DIR/openurl.js" \
	"$XPCOM_DIR/server.js" \
	"$XPCOM_DIR/utilities.js" \
	"$XPCOM_DIR/utilities_internal.js" \
	"$XPCOM_DIR/utilities_translate.js" \
	"$XPCOM_DIR/xregexp" \
	"$EXTENSION_DIR/chrome/content/zotero/tools/testTranslators/translatorTester.js" \
	"$BUILD_DIR/app"

# Copy client resource files
mkdir "$BUILD_DIR/app/resource"
cp -R "$EXTENSION_DIR/resource/require.js" \
	"$EXTENSION_DIR/resource/bluebird.js" \
	"$EXTENSION_DIR/resource/bluebird" \
	"$BUILD_DIR/app/resource"

mkdir "$BUILD_DIR/app/resource/schema"
cp -RL "$EXTENSION_DIR/resource/schema/dateFormats.json" \
	"$BUILD_DIR/app/resource/schema"

# Copy client translation files
mkdir "$BUILD_DIR/app/translation"
cp -R "$XPCOM_DIR/translation/tlds.js" \
	"$XPCOM_DIR/translation/translate.js" \
	"$XPCOM_DIR/translation/translator.js" \
	"$XPCOM_DIR/translation/translate_firefox.js" \
	"$BUILD_DIR/app/translation"

# Copy connector files
mkdir "$BUILD_DIR/app/connector"
cp -R "$CONNECTOR_DIR/src/common/cachedTypes.js" \
	"$CONNECTOR_DIR/src/common/translators.js" \
	"$CONNECTOR_DIR/src/common/utilities.js" \
	"$BUILD_DIR/app/connector"
cp "$EXTENSION_DIR/resource/schema/connectorTypeSchemaData.js" \
	"$BUILD_DIR/app/connector/typeSchemaData.js"

cp "$SCRIPT_DIR/config.js" "$BUILD_DIR/defaults/pref"
echo "content translation-server app/" >> "$BUILD_DIR/chrome.manifest"
echo "resource zotero app/resource/" >> "$BUILD_DIR/chrome.manifest"
echo "locale branding en-US chrome/branding/locale/" >> "$BUILD_DIR/chrome.manifest"

# Copy translators (overwritten with real Git repo in production Docker build)
rsync -a --delete "$EXTENSION_DIR/translators/" "$BUILD_DIR/app/translators/"

# Add preferences
#cp -r "$EXTENSION_DIR/defaults" "$RESDIR"
#cp -r "$SCRIPT_DIR/config.js" "$ASSETS_DIR/prefs.js" "$RESDIR/defaults/preferences"
#perl -pi -e 's/pref\("extensions\.zotero\.httpServer\.enabled", false\);/pref("extensions.zotero.httpServer.enabled", true);/g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.httpServer\.port",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.log",\s*false\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.level",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/pref\("extensions\.zotero\.debug\.time",[^\)]*\);//g' "$RESDIR/defaults/preferences/zotero.js"
#perl -pi -e 's/extensions.zotero/translation-server/g' "$RESDIR/defaults/preferences/zotero.js"

find "$BUILD_DIR" -depth -type d -name .svn -exec rm -rf {} \;
find "$BUILD_DIR" -name .DS_Store -exec rm -rf \;
find "$BUILD_DIR" -name '._*' -exec rm -rf \;

echo "Done"
