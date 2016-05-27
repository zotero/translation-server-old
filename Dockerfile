# Run zotero translator server in a container
# https://github.com/zotero/translation-server
# 
# USAGE:
# $ docker build -t zts -f Dockerfile .
# $ docker run -d --rm --port 1969:1969 --name zts-container zts
# 

FROM ubuntu:14.04

RUN apt-get update && apt-get install -y curl firefox

ENV VERSION 41.0
ENV ARCHITECTURE linux-x86_64
# alternatively linux-i6841

WORKDIR opt
RUN mkdir translation-server
WORKDIR translation-server

RUN curl -o "xulrunner.tar.bz2" "https://ftp.mozilla.org/pub/xulrunner/releases/${VERSION}/sdk/xulrunner-${VERSION}.en-US.${ARCHITECTURE}.sdk.tar.bz2"
RUN tar xfv xulrunner.tar.bz2


COPY . .

# Edit config.js
RUN sed -i 's/\/Users\/simon\/Desktop\/Development\/FS\/zotero\/translators/\/opt\/translation-server\/modules\/zotero\/translators/' config.js

RUN ./build.sh

RUN build/run_translation-server.sh
