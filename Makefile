.DEFAULT_GOAL := help

## help: Show this help
.PHONY: help
help:
	@echo "Available targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed -E 's/^## ([a-z-]+): (.*)/  \1\t\2/' | expand -t 20

## install: Install npm dependencies (npm ci)
.PHONY: install
install:
	npm ci

## dev: Start the dev server with live reload
.PHONY: dev
dev:
	npm run dev

## build: Build the production site into dist/
.PHONY: build
build:
	npm run build

## preview: Serve the built dist/ locally
.PHONY: preview
preview:
	npm run preview

## check: Type-check and validate content (astro check)
.PHONY: check
check:
	npm run check

## fonts: Regenerate the content-driven woff2 subsets (runs inside make build)
.PHONY: fonts
fonts:
	npm run subset-fonts

## fonts-audit: Check the built HTML for characters missing from the subsets
.PHONY: fonts-audit
fonts-audit:
	npm run subset-fonts:audit

## clean: Remove build output and Astro caches
.PHONY: clean
clean:
	rm -rf dist .astro node_modules/.astro src/assets/fonts/generated

## papers: Sync papers.yaml with Semantic Scholar (new papers land visible: false)
.PHONY: papers
papers:
	npm run sync-papers

## categories: Tally category usage across posts
.PHONY: categories
categories:
	@awk '/^categories:/{f=1;next} f&&/^  - /{gsub(/^  - /,"");print;next} f{f=0}' \
		src/content/blog/*/index.md* | sort | uniq -c | sort -rn

## new-post: Scaffold a draft post: make new-post SLUG=my-post-slug
.PHONY: new-post
new-post:
ifndef SLUG
	$(error Usage: make new-post SLUG=my-post-slug)
endif
	@test ! -e src/content/blog/$(SLUG) || { echo "src/content/blog/$(SLUG) already exists"; exit 1; }
	@mkdir -p src/content/blog/$(SLUG)
	@printf -- '---\ntitle: "TITLE"\ndescription: "DESCRIPTION"\ndate: "%s"\ncategories:\n  - CATEGORY\n# image: ./main-image.png\n# math: true\ndraft: true\n---\n\nWrite here.\n' "$$(date +%F)" \
		> src/content/blog/$(SLUG)/index.md
	@echo "Created src/content/blog/$(SLUG)/index.md (draft: true)"
