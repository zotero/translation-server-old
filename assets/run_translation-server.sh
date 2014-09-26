#!/bin/bash
CALLDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$CALLDIR"

if [[ "`uname`" == CYGWIN* ]]; then
	./xpcshell.exe -v 180 -mn translation-server/init.js "$@"
else
	LD_LIBRARY_PATH="$CALLDIR:$LD_LIBRARY_PATH" ./xpcshell -v 180 -mn translation-server/init.js "$@"
fi
