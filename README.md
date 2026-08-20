# ddimmery.com

The personal website of Drew Dimmery, built with [Astro](https://astro.build).
Static output, zero client-side JavaScript (except the Google Analytics snippet),
self-hosted fonts, build-time math (MathJax v4 / Neo-Euler) and syntax
highlighting.

This replaces the previous Quarto site.

---

## Setup

Requires **Node 22**.

```sh
npm install
npm run dev      # http://localhost:4321
```

| Command               | What it does                                                   |
| --------------------- | -------------------------------------------------------------- |
| `npm run dev`         | Dev server with hot reload. Draft posts are visible.           |
| `npm run build`       | Production build into `dist/`. Draft posts are excluded.       |
| `npm run preview`     | Serve the built `dist/` locally.                               |
| `npm run check`       | `astro check` — type-checks `.astro`, `.ts` and frontmatter.    |
| `npm run sync-papers` | Pull new publications from Semantic Scholar (see below).        |
| `npm run vendor-mathjax`| Regenerate `public/mathjax/mathjax.css` (runs on build).      |

A `Makefile` wraps the common actions — run `make` (or `make help`) to list them:
`make dev`, `make build`, `make preview`, `make check`, `make clean`,
`make papers` (Semantic Scholar sync), `make categories` (tag tally), and
`make new-post SLUG=my-post-slug` to scaffold a draft post.

## Project layout

```
astro.config.mjs          site config: markdown processor, Shiki, Fonts API
src/
  content.config.ts       collection schemas (blog, papers, software)
  content/blog/<slug>/    one directory per post: index.mdx + its images
  data/papers.yaml        publications (machine-appended, hand-curated)
  data/software.yaml      software list
  assets/fonts/*.woff2    Domitian, URW Classico, Monaspace Argon
  assets/headshot.webp
  components/             Icon, buttons, cards, TOC, head, header, footer
  layouts/Base.astro      <html> shell: head, skip link, header, footer
  lib/                    site metadata, icon data, post/paper helpers
  pages/                  routes (see below)
  styles/                 global.css (+ blocks.css), prose.css, code.css
public/                   favicon, social card, robots.txt, _headers, _redirects
scripts/                  sync-papers.mjs, vendor-mathjax.mjs,
                          rehype-mathjax-euler.mjs, lib/mathjax-euler.mjs
```

### Routes

| URL                       | Source                                |
| ------------------------- | ------------------------------------- |
| `/`                       | `src/pages/index.astro`               |
| `/about/`                 | `src/pages/about.astro`               |
| `/research/`              | `src/pages/research.astro`            |
| `/software/`              | `src/pages/software.astro`            |
| `/blog/`                  | `src/pages/blog/index.astro`          |
| `/blog/category/<cat>/`   | `src/pages/blog/category/[category].astro` |
| `/posts/<slug>/`          | `src/pages/posts/[...slug].astro`     |
| `/blog.xml`               | `src/pages/blog.xml.ts` (RSS, full post bodies) |
| `/404.html`               | `src/pages/404.astro`                 |
| `/sitemap-index.xml`      | `@astrojs/sitemap`                    |

`/blog.xml` intentionally keeps the path the Quarto site used so existing
subscribers are unaffected. `public/_redirects` points a few other common feed
paths at it.

---

## Writing a post

Create a directory under `src/content/blog/` and put an `index.md` or
`index.mdx` inside it. The directory name becomes the URL:
`src/content/blog/my-post/index.mdx` → `/posts/my-post/`.

```yaml
---
title: 'My Post' # required
description: |    # optional; used in listings, meta tags and the feed
  One or two sentences.
date: '2026-08-19' # required
updated: '2026-08-25' # optional; shown next to the date
categories: # optional; each becomes a pill and a /blog/category/<cat>/ page
  - technology
  - website
image: ./cover.png # optional; path relative to the post directory
math: true # optional; loads the MathJax stylesheet on this page only
draft: false # optional; drafts are dev-only
---
```

### Images

Put images in the post's own directory and reference them relatively
(`./cover.png`). The `image` frontmatter field is validated as a real image, so a
typo fails the build rather than shipping a broken `<img>`.

Inside the body, use standard markdown (`![alt](./chart.png)`) or, in `.mdx`,
Astro's `<Image />` for finer control:

```mdx
import { Image } from 'astro:assets';
import chart from './chart.png';

<Image src={chart} width={800} alt="Estimated effects by subgroup" />
```

Everything goes through `astro:assets`: images are converted, resized and
fingerprinted, and `width`/`height` are always emitted so nothing shifts as the
page loads. Cover images are eager-loaded with high priority; listing thumbnails
are lazy.

### Math

`$inline$` and `$$display$$` are rendered at build time by `remark-math` plus a
small local rehype plugin (`scripts/rehype-mathjax-euler.mjs`) that drives
**MathJax v4 in the [Neo-Euler](https://en.wikipedia.org/wiki/AMS_Euler) font** —
the same typeface the old Quarto site used. No JavaScript reaches the reader.

Each formula is emitted as inline SVG with its glyph outlines embedded, so math
needs no webfont and no runtime. The only asset is MathJax's ~6 kB container
stylesheet: **set `math: true`** in the frontmatter of any post that uses math
and that stylesheet gets linked on that page alone. Without the flag the
equations still render, but display math loses its centring and the hidden
MathML copy stops being hidden.

How Euler is achieved (see `scripts/lib/mathjax-euler.mjs` for the details):
MathJax's Euler support ships as a *font extension*, not a standalone font, so
the config loads [Gyre Pagella](https://www.gust.org.pl/projects/e-foundry/tex-gyre)
(`@mathjax/mathjax-pagella-font`) as the base and layers
`@mathjax/mathjax-euler-font-extension` over it. Letters, digits and the big
operators come out Neo-Euler; radicals, delimiters and arrows fall back to
Pagella. Euler's greek, fraktur and calligraphic ranges load on demand, which is
why the plugin's conversion is async.

`scripts/vendor-mathjax.mjs` dumps the matching stylesheet to `public/mathjax/`
(gitignored, regenerated on every `npm run build`), so it can never drift from
the MathJax version in `package.json`.

> Astro 7's default markdown processor (Sätteri) does not run remark/rehype
> plugins. `astro.config.mjs` therefore opts into the legacy unified pipeline via
> `unified()` from `@astrojs/markdown-remark`. If math or footnotes ever stop
> working, that config is the first place to look.

### Code

Fenced code blocks are highlighted at build time by Shiki using two themes
(`github-light` / `github-dark-dimmed`) wired to `prefers-color-scheme`, with
line wrapping on. Nothing to configure per post.

### Footnotes

GFM footnotes (`[^1]`) work and are styled as a small-type apparatus at the end
of the post with return links.

### Posts containing executed code

There is no runtime for R or Python here — this site never executes code at build
time. Posts that show computed output carry **pre-rendered results**, the same
end state Quarto's `freeze: auto` produced:

- Run the analysis wherever you like (a notebook, a Quarto `.qmd`, a script).
- Commit the *outputs* — figures as images in the post directory, tables as
  markdown, printed results inside fenced code blocks — alongside the prose.
- Keep the generating source next to the post (e.g. `analysis.qmd`,
  `analysis.py`) so the numbers can be reproduced later; it is not part of the
  build and is ignored by the content loader, which only reads `**/*.{md,mdx}`.

Practically: treat the `.md`/`.mdx` file as the frozen render. If a figure needs
updating, re-run the source, replace the image, and commit both.

---

## Publications

`src/data/papers.yaml` is the source of truth for `/research/`. It is a map of
slug → entry:

```yaml
calib_hte:
  title: Calibration of Heterogeneous Treatment Effects in Randomized Experiments
  authors:
    - Yan Leng
    - me # "me" is rendered as a bold "Drew Dimmery"
  year: 2024
  preprint: https://…
  published_url: https://doi.org/… # presence of this = "Published", absence = "Working Paper"
  venue: Information Systems Research
  github: null
  data: null
  pdf_url: null
  visible: true # only visible papers are rendered
  ssid: a57003edeaa23ea8b33691cebe3e5bb12175e96c # Semantic Scholar paper id
```

### Sync flow

`npm run sync-papers` fetches the Semantic Scholar author feed, compares against
the `ssid`s already in the file, and **appends** anything new with
`visible: false`. It never edits or reorders existing entries, and running it
twice changes nothing the second time. Add `-- --dry-run` to see what it would do.

The `.github/workflows/sync-papers.yml` workflow runs it weekly (and on demand)
and opens a pull request titled *"New papers from Semantic Scholar"* when the
file changes.

**To publish a synced paper:** check its metadata (Semantic Scholar guesses
venues and author names imperfectly), then flip `visible: false` → `visible: true`.
Nothing appears on the site until you do.

Optional: set a `SEMANTIC_SCHOLAR_API_KEY` repository secret to raise the API
rate limit. The script retries on 429s either way.

## Software

`src/data/software.yaml` is a hand-maintained list. `description` is markdown and
is rendered at build time. The page shows entries newest-first, i.e. the reverse
of file order — append new packages to the bottom of the file.

---

## Deployment

The site is a plain static bundle in `dist/`; any static host will serve it.
The configured target is **Cloudflare Pages**:

1. Create a Pages project named **`ddimmery-web`** (direct upload / Wrangler —
   no Git integration needed; the workflow uploads the build).
2. Add two repository secrets under *Settings → Secrets and variables → Actions*:
   - `CLOUDFLARE_API_TOKEN` — a token with the **Cloudflare Pages: Edit**
     permission ([create one](https://dash.cloudflare.com/profile/api-tokens)).
   - `CLOUDFLARE_ACCOUNT_ID` — the account ID from the Cloudflare dashboard.
3. Point `ddimmery.com` at the Pages project and push to `main`.
   `.github/workflows/deploy.yml` builds and deploys on every push, and can be
   triggered manually.

`public/_headers` sets HSTS (`max-age=63072000; includeSubDomains; preload`),
`X-Content-Type-Options`, `Referrer-Policy` and immutable caching for
fingerprinted assets. `public/_redirects` handles legacy feed paths. Both files
are Cloudflare Pages / Netlify conventions — if the host changes, port them.

---

## Design notes

- **Type.** URW Classico (Optima-derived) for headings and navigation, Domitian
  (Palatino-derived) for body text, Monaspace Argon for code — all humanist, all
  free, all self-hosted as woff2 through Astro's Fonts API with `font-display:
  swap` and preloading of the two faces used above the fold. Nine faces total,
  including the URW Classico bold-italic the old site shipped but never
  registered.
- **Colour.** Warm paper in light mode, warm ink in dark mode (never pure white or
  black), with the Hertie red `#ba0020` as a single accent — lightened to
  `#f2596d` in dark mode for contrast. Light and dark are pure CSS custom
  properties behind `prefers-color-scheme`; there is no theme toggle and no
  JavaScript.
- **Layout.** One centred measure of ~68ch, a fluid `clamp()` type scale, hairline
  rules instead of boxes and shadows. Mobile-first; the post table of contents is
  a collapsible `<details>` on narrow screens and a sticky sidebar past 68rem.
- **Performance.** No client JS besides the GA snippet. Per-route CSS (prose and
  code styles only load on pages that need them), the MathJax stylesheet only on
  posts with `math: true`, all images processed by sharp with explicit dimensions,
  and no external requests other than Google Analytics.
