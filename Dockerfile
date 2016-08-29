# Run zotero translator server in a container
# https://github.com/zotero/translation-server

FROM ubuntu:14.04

RUN mkdir /opt/translation-server
WORKDIR /opt/translation-server

COPY . .

RUN apt-get update \
    && apt-get install -y wget firefox \
    && bash fetch_sdk \
    && bash build.sh \
    && rm -rf firefox-sdk \
    && apt-get --purge -y remove wget firefox \
    && rm -rf /var/cache/apt \
    && rm -rf /var/lib/apt/lists

ENTRYPOINT build/run_translation-server.sh

