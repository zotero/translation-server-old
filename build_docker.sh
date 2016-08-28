#!/bin/bash

DOCKER_TAG=${DOCKER_TAG:-zotero/translation-server}
docker build -t "$DOCKER_TAG" .
