#!/bin/bash
set -euo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Update translators to latest versions
if [ "${SKIP_TRANSLATOR_UPDATE:-}" != "1" ]; then
	pushd "$DIR/app/translators" > /dev/null
	# Only update if a git repo
	if [ -d .git ]; then
		git pull origin master
	fi
	popd > /dev/null
fi

if [[ "`uname`" == CYGWIN* ]]; then
	./xpcshell.exe -v 180 -mn app/init.js "$@"
else
	LD_LIBRARY_PATH="$DIR:${LD_LIBRARY_PATH:-}" ./xpcshell -v 180 -mn app/init.js "$@"
fi
