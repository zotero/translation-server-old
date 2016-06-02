ARCH := x86_64
OS := linux
SDK_VERSION := 46.0
SDK_TARBALL := firefox-$(SDK_VERSION).$(OS)-$(ARCH).sdk.tar.bz2
SDK_URL := https://archive.mozilla.org/pub/firefox/releases/$(SDK_VERSION)/$(SDK_TARBALL)

firefox-sdk: $(SDK_TARBALL)
	 tar mxf $(SDK_TARBALL)

$(SDK_TARBALL):
	wget "$(SDK_URL)"

