#!/bin/bash
set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

REV=$(perl -ne 'print and last if s/.*<em:version>(.*)<\/em:version>.*/\1/;' "$DIR/modules/zotero/install.rdf")+$(git -C "$DIR" rev-parse --short HEAD)

DOCKER_TAG=${DOCKER_TAG:-zotero/translation-server}
docker build --build-arg TRANSLATION_SERVER_REVISION="$REV" -t "$DOCKER_TAG" .
