#!/bin/sh

CALLDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$CALLDIR"
./xpcshell -v 180 translation-server/init.js "$@"