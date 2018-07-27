JEKYLL_VERSION=3.8

all: build run

build:
	docker run --rm \
		-v "$(PWD):/srv/jekyll" \
		-v "$(PWD)/vendor/bundle:/usr/local/bundle" \
		-it \
		jekyll/jekyll:$(JEKYLL_VERSION) \
		jekyll build

run:
	http-server _site

