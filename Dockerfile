# Run zotero translator server in a container
# https://github.com/zotero/translation-server
#
# USAGE:
# $ docker build -t zts -f Dockerfile .
# $ docker run -d --rm --port 1969:1969 --name zts-container zts
#

FROM ubuntu:14.04

RUN mkdir /opt/zts
WORKDIR /opt/zts

COPY . .

# See makefile for variables, e.g.
# make SDK_VERSION=45.0 build
RUN apt-get update \
    && apt-get install -y make wget firefox \
    && bash fetch_sdk \
    && bash build.sh \
    && rm -rf firefox-sdk \
    && apt-get --purge -y remove make wget firefox \
    && rm -rf /var/cache/apt \
    && rm -rf /var/lib/apt/lists

ENTRYPOINT build/run_translation-server.sh

