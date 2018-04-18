FROM ubuntu:17.10

RUN apt-get update \
	                                                    # libgtk-3.0 libraries for Firefox
	&& apt-get install -y bzip2 git rsync wget xz-utils adwaita-icon-theme at-spi2-core dbus dconf-gsettings-backend dconf-service fontconfig fontconfig-config fonts-dejavu-core glib-networking glib-networking-common glib-networking-services gsettings-desktop-schemas gtk-update-icon-cache hicolor-icon-theme humanity-icon-theme krb5-locales libapparmor1 libatk-bridge2.0-0 libatk1.0-0 libatk1.0-data libatspi2.0-0 libavahi-client3 libavahi-common-data libavahi-common3 libboost-filesystem1.62.0 libboost-system1.62.0 libbsd0 libcairo-gobject2 libcairo2 libcapnp-0.5.3 libcolord2 libcroco3 libcups2 libdatrie1 libdbus-1-3 libdconf1 libdrm-amdgpu1 libdrm-intel1 libdrm-nouveau2 libdrm-radeon1 libdrm2 libedit2 libegl1-mesa libelf1 libepoxy0 libexpat1 libffi6 libfontconfig1 libfreetype6 libgbm1 libgdk-pixbuf2.0-0 libgdk-pixbuf2.0-bin libgdk-pixbuf2.0-common libgl1-mesa-dri libglapi-mesa libglib2.0-0 libglib2.0-data libgmp10 libgnutls30 libgraphite2-3 libgssapi-krb5-2 libgtk-3-bin libgtk-3-common libharfbuzz0b libhogweed4 libicu57 libidn11 libjbig0 libjpeg-turbo8 libjpeg8 libjson-glib-1.0-0 libjson-glib-1.0-common libk5crypto3 libkeyutils1 libkrb5-3 libkrb5support0 liblcms2-2 libllvm4.0 libmirclient9 libmircommon7 libmircore1 libmirprotobuf3 libnettle6 libp11-kit0 libpango-1.0-0 libpangocairo-1.0-0 libpangoft2-1.0-0 libpciaccess0 libpixman-1-0 libpng16-16 libprotobuf-lite10 libproxy1v5 librest-0.7-0 librsvg2-2 librsvg2-common libsensors4 libsoup-gnome2.4-1 libsoup2.4-1 libtasn1-6 libthai-data libthai0 libtiff5 libtxc-dxtn-s2tc libwayland-client0 libwayland-cursor0 libwayland-egl1-mesa libwayland-server0 libx11-6 libx11-data libx11-xcb1 libxau6 libxcb-dri2-0 libxcb-dri3-0 libxcb-present0 libxcb-render0 libxcb-shm0 libxcb-sync1 libxcb-xfixes0 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxdmcp6 libxext6 libxfixes3 libxi6 libxinerama1 libxkbcommon0 libxml2 libxrandr2 libxrender1 libxshmfence1 libxtst6 sgml-base shared-mime-info ubuntu-mono ucf x11-common xdg-user-dirs xkb-data xml-core libdbus-glib-1-2 libxt6 \
	&& rm -rf /var/lib/apt/lists \
	# Install node and npm
	&& mkdir /tmp/node-build \
	&& cd /tmp/node-build \
	&& wget --quiet -O node.xz https://nodejs.org/dist/v8.9.4/node-v8.9.4-linux-x64.tar.xz \
	&& tar xf node.xz \
	&& mv node-v8.9.4-linux-x64/bin/node /usr/bin/ \
	&& node-v8.9.4-linux-x64/bin/npm install -g npm \
	&& cd \
	&& rm -rf /tmp/node-build

RUN groupadd -r translation && useradd --no-log-init -r -d /opt/translation-server -g translation translation

ADD --chown=translation:translation . /tmp/translation-server-build
RUN mkdir /opt/translation-server && chown translation:translation /opt/translation-server
WORKDIR /opt/translation-server

USER translation

# Build Zotero client from submodule and delete non-build files
RUN cd /tmp/translation-server-build/modules/zotero \
	&& npm i \
	&& npm run build \
	&& rsync -aL --exclude test --exclude translators build/ ../zotero-clean \
	&& cd .. \
	&& rm -rf zotero \
	&& mkdir zotero \
	&& mv zotero-clean zotero/build \
	\
	# Build translation-server
	&& cd .. \
	&& bash fetch_sdk \
	&& bash build.sh \
	&& rm -rf firefox-sdk \
	# Move build files to home directory
	&& mv build/* ~ \
	&& cd ~ \
	&& rm -rf /tmp/translation-server-build \
	\
	# Create translators repository
	&& git clone https://github.com/zotero/translators app/translators

ARG TRANSLATION_SERVER_REVISION=SOURCE
ENV TRANSLATION_SERVER_REVISION $TRANSLATION_SERVER_REVISION
EXPOSE 1969

ENTRYPOINT ["./run_translation-server.sh"]
