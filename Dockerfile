FROM ubuntu:14.04

RUN apt-get update \
	&& apt-get install -y git acl at-spi2-core ca-certificates colord dbus dconf-gsettings-backend dconf-service fontconfig fontconfig-config fonts-dejavu-core hicolor-icon-theme krb5-locales libapparmor1 libasound2 libasound2-data libatk-bridge2.0-0 libatk1.0-0 libatk1.0-data libatspi2.0-0 libavahi-client3 libavahi-common-data libavahi-common3 libcairo-gobject2 libcairo2 libcanberra0 libcolord1 libcolorhug1 libcups2 libdatrie1 libdbus-glib-1-2 libdbusmenu-glib4 libdbusmenu-gtk4 libdconf1 libexif12 libfontconfig1 libfreetype6 libgd3 libgdk-pixbuf2.0-0 libgdk-pixbuf2.0-common libglib2.0-0 libglib2.0-data libgphoto2-6 libgphoto2-l10n libgphoto2-port10 libgraphite2-3 libgssapi-krb5-2 libgtk-3-0 libgtk-3-bin libgtk-3-common libgtk2.0-0 libgtk2.0-bin libgtk2.0-common libgudev-1.0-0 libgusb2 libharfbuzz0b libice6 libidn11 libieee1284-3 libjasper1 libjbig0 libjpeg-turbo8 libjpeg8 libk5crypto3 libkeyutils1 libkrb5-3 libkrb5support0 liblcms2-2 libltdl7 libogg0 libpam-systemd libpango-1.0-0 libpangocairo-1.0-0 libpangoft2-1.0-0 libpixman-1-0 libpolkit-agent-1-0 libpolkit-backend-1-0 libpolkit-gobject-1-0 libsane libsane-common libsm6 libstartup-notification0 libsystemd-daemon0 libsystemd-login0 libtdb1 libthai-data libthai0 libtiff5 libusb-1.0-0 libv4l-0 libv4lconvert0 libvorbis0a libvorbisfile3 libvpx1 libwayland-client0 libwayland-cursor0 libx11-6 libx11-data libx11-xcb1 libxau6 libxcb-render0 libxcb-shm0 libxcb-util0 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxdmcp6 libxext6 libxfixes3 libxi6 libxinerama1 libxkbcommon0 libxml2 libxpm4 libxrandr2 libxrender1 libxt6 libxtst6 openssl policykit-1 sgml-base shared-mime-info sound-theme-freedesktop systemd-services systemd-shim wget x11-common xml-core \
	&& rm -rf /var/lib/apt/lists

WORKDIR /opt/translation-server
COPY . .

RUN bash fetch_sdk \
	&& bash build.sh \
	&& rm -rf firefox-sdk \
	&& rm -rf /opt/translation-server/modules/zotero/translators \
	&& git clone https://github.com/zotero/translators /opt/translation-server/modules/zotero/translators

EXPOSE 1969

ENTRYPOINT build/run_translation-server.sh
