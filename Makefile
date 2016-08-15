ARCH := x86_64
OS := linux
SDK_VERSION := 46.0
SDK_TARBALL := firefox-$(SDK_VERSION).$(OS)-$(ARCH).sdk.tar.bz2
SDK_URL := https://archive.mozilla.org/pub/firefox/releases/$(SDK_VERSION)/$(SDK_TARBALL)

DOCKER_IMAGE_TAG := 'kbai/zts'

build: firefox-sdk
	sh build.sh

docker:
	docker build -t $(DOCKER_IMAGE_TAG) .

clean-sdk:
	rm -r firefox-sdk $(SDK_TARBALL)

firefox-sdk:
	$(MAKE) $(SDK_TARBALL)
	tar -mxf $(SDK_TARBALL)

$(SDK_TARBALL):
	wget --progress=bar:force "$(SDK_URL)"

