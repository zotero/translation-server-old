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

# Set CORS allowed origins
# We have to escape the '//' in the URL.
perl -pi -e 's/pref\("translation-server.httpServer.allowedOrigins", "[^"]*"\);/pref\("translation-server.httpServer.allowedOrigins", "'$(echo "${ALLOWED_ORIGINS:-}" | sed 's/\//\\\//g')'"\);/g' defaults/pref/config.js

# Set email address from TRANSLATION_EMAIL for use by some translators for better service.
# We have to escape the '@' so it doesn't get swallowed by Perl.
perl -pi -e 's/pref\("translation-server.translators.CrossrefREST.email", "[^"]*"\);/pref\("translation-server.translators.CrossrefREST.email", "'$(echo ${TRANSLATION_EMAIL:-} | sed 's/@/\\@/')'"\);/g' defaults/pref/config.js

if [[ "`uname`" == CYGWIN* ]]; then
	./xpcshell.exe -v 180 -mn app/init.js "$@"
else
	LD_LIBRARY_PATH="$DIR:${LD_LIBRARY_PATH:-}" ./xpcshell -v 180 -mn app/init.js "$@"
fi
