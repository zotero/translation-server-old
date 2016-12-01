#!/bin/bash
CALLDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$CALLDIR"

# Update translators to latest versions
if [ "$SKIP_TRANSLATOR_UPDATE" != "1" ]; then
	pushd "$CALLDIR/../modules/zotero/translators" > /dev/null
	# Only update if a git repo
	if [ -e .git ]; then
		git pull origin master
	fi
	popd > /dev/null
fi

if [[ "`uname`" == CYGWIN* ]]; then
	./xpcshell.exe -v 180 -mn translation-server/init.js "$@"
else
	LD_LIBRARY_PATH="$CALLDIR:$LD_LIBRARY_PATH" ./xpcshell -v 180 -mn translation-server/init.js "$@"
fi
