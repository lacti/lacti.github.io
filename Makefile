JEKYLL_VERSION=3.8

serve:
	docker run --rm \
		-v "$(PWD):/srv/jekyll" \
		-v "$(PWD)/vendor/bundle:/usr/local/bundle" \
		-p 4000:4000 \
		-it \
		jekyll/jekyll:$(JEKYLL_VERSION) \
		jekyll serve --incremental

build-server:
	parallel -- "make build" "make server"

build:
	docker run --rm \
		-v "$(PWD):/srv/jekyll" \
		-v "$(PWD)/vendor/bundle:/usr/local/bundle" \
		-it \
		jekyll/jekyll:$(JEKYLL_VERSION) \
		jekyll build --watch

server:
	http-server _site

