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
| `npm run subset-fonts`| Regenerate the woff2 subsets (runs on build — see [Fonts](#fonts)). |
| `npm run subset-fonts:audit`| Check built HTML for characters missing from the subsets.  |
| `npm run brand`       | Regenerate the favicons, touch icon and default social card.    |

A `Makefile` wraps the common actions — run `make` (or `make help`) to list them:
`make dev`, `make build`, `make preview`, `make check`, `make clean`,
`make papers` (Semantic Scholar sync), `make categories` (tag tally),
`make fonts` / `make fonts-audit` (font subsets), `make brand` (icons and social
card, see [Design notes](#design-notes)), and
`make new-post SLUG=my-post-slug` to scaffold a draft post.

## Project layout

```
astro.config.mjs          site config: markdown processor, Shiki, Fonts API
src/
  content.config.ts       collection schemas (blog, papers, software, teaching)
  content/blog/<slug>/    one directory per post: index.mdx + its images
  data/papers.yaml        publications (machine-appended, hand-curated)
  data/software.yaml      software list
  data/teaching.yaml      courses taught (Hertie School)
  assets/fonts/*.woff2    Domitian, URW Classico, Monaspace Argon (pristine originals)
  assets/fonts/generated/ build-time content-driven subsets (gitignored)
  assets/headshot.webp
  assets/mark/*.svg      the personal mark (transparent + tile) — see Design notes
  components/             Icon, buttons, cards, TOC, head, header, footer
  layouts/Base.astro      <html> shell: head, skip link, header, footer
  lib/                    site metadata, icon data, post/paper helpers
  pages/                  routes (see below)
  styles/                 global.css (+ blocks.css), prose.css, code.css
public/                   favicons + touch icon, social card, robots.txt,
                          _headers, _redirects (icons and card are generated —
                          see `make brand`)
scripts/                  sync-papers.mjs, vendor-mathjax.mjs, subset-fonts.mjs,
                          build-mark-assets.mjs, build-social-card.mjs,
                          rehype-mathjax-euler.mjs, lib/mathjax-euler.mjs
```

### Routes

| URL                       | Source                                |
| ------------------------- | ------------------------------------- |
| `/`                       | `src/pages/index.astro`               |
| `/about/`                 | removed — redirected to `/` in `public/_redirects` |
| `/research/`              | `src/pages/research.astro`            |
| `/teaching/`              | `src/pages/teaching.astro`            |
| `/software/`              | `src/pages/software.astro`            |
| `/blog/`, `/blog/2/` …    | `src/pages/blog/[...page].astro` (10 posts/page) |
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
(`github-light` / `github-dark-dimmed`) wired to the active color scheme (see
[Theme](#theme)), with line wrapping on. Nothing to configure per post.

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

## Fonts

Nine self-hosted woff2 faces are registered with Astro's Fonts API in
`astro.config.mjs`: Domitian (body, 4 faces), URW Classico (headings, 4 faces)
and the Monaspace Argon variable font (code). Unsubset they are ~615 kB and are
by far the heaviest thing on the site.

**`scripts/subset-fonts.mjs` subsets them from the site's own content on every
build.** Nothing about the character set is hardcoded, so the subset follows the
content: add a post with an unusual character, or let `make papers` pull in a new
author name, and the next build keeps the glyphs it needs without anyone editing
a list.

How it works:

1. **Scan.** Every file under `src/` (and `scripts/lib/`) that can contribute
   rendered text — `.md`, `.mdx`, `.yaml`, `.astro`, `.ts`, `.js`, `.json`,
   `.css` — is read and every character in it collected. The scan is
   deliberately over-inclusive (markup and code characters come along too);
   those are ASCII, which is kept unconditionally anyway. Escape sequences are
   decoded as well, because `sync-papers` writes accented author names into
   `papers.yaml` as `"Pablo Barber\xE1"` — a raw character scan would miss every
   accent the research page renders.
2. **Safety floor.** On top of the scan, a fixed set is *always* kept, because
   content changes between builds and a missing glyph is a visible bug while an
   unused one costs a few hundred bytes: printable ASCII, Latin-1, Latin
   Extended-A/B/Additional, combining marks, typographic punctuation (curly
   quotes, dashes, ellipsis, † ‡ § ¶ •, guillemets), arrows including the `↩`
   the footnote pipeline injects, sub/superscripts, a few math operators, and
   light box-drawing for tree output in code blocks.
3. **Subset.** Each face is rewritten with [`subset-font`](https://github.com/papandreou/subset-font)
   (HarfBuzz compiled to wasm). Layout features are all preserved — `liga`,
   `kern`, `onum`, `frac`, `calt` and friends survive, so ligatures still form
   and `font-variant-numeric: oldstyle-nums` still gets its oldstyle figures —
   and HarfBuzz's layout closure keeps the ligature and mark glyphs those
   features reach even though no codepoint maps to them. The Monaspace variable
   font is **not** instanced: its `wght`/`wdth`/`slnt` axes come through intact,
   which the `weight: '200 800'` variant in `astro.config.mjs` depends on.
4. **Write.** Subsets land in `src/assets/fonts/generated/` (gitignored); the
   Fonts API is pointed at that directory. `src/assets/fonts/*.woff2` are the
   pristine upstream binaries and are never modified. The script runs from the
   `dev`, `build` and `check` npm scripts before Astro starts, so the files
   always exist and always match the current content.
5. **Audit.** After `astro build`, `subset-fonts.mjs --audit` re-scans the
   *built* HTML and fails the build if any character in it is missing from the
   subset set. This is the backstop for characters no source file contains
   because a build plugin invented them. If it fires, add the codepoint to
   `SHARED_FLOOR` / `TEXT_FLOOR` in the script — adding a range a face does not
   contain is free.

The prose faces and the code face get slightly different sets. Everything the
content actually contains goes into every face; the speculative accent floor
(Latin Extended-A and friends) is skipped for Monaspace, where it costs 24 kB
instead of 7 kB because every glyph in a variable font carries `gvar` deltas,
and where author names never render. Faces are classified by filename prefix
(`MONO_FACE_PREFIXES`) and anything unrecognized falls back to the generous
prose set, so adding a face can only ever cost bytes, never correctness.

Output is deterministic: the character set is sorted before subsetting and
HarfBuzz is deterministic, so the same content produces byte-identical woff2
files and CI builds are reproducible.

Each run prints a report:

```
subset-fonts: scanned 48 source files -> 118 characters in content; keeping 1040 in prose faces and 281 in code faces
  face                             set   original     subset    saved
  Domitian-Roman.woff2            text    65.7 kB    30.0 kB      54%
  MonaspaceArgon-Variable.woff2   mono   140.0 kB    90.2 kB      36%
  ...
  total                                  615.5 kB   333.4 kB      46%
```

A face that cannot be subset — or that comes back not smaller, not woff2, or
implausibly small — fails the build with a non-zero exit rather than shipping a
broken font.

**Turning it off.** `SUBSET_FONTS=0` makes the script copy the full originals
into `src/assets/fonts/generated/` instead of subsetting, so the build still
works and ships complete faces:

```sh
SUBSET_FONTS=0 npm run build
```

Use that to bisect a suspected shaping problem. The `--audit` step is skipped in
that mode.

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

## Teaching

`src/data/teaching.yaml` is a hand-maintained list of courses. Each entry carries
a `title`, `code` (e.g. `GRAD-C24`), `program` note, a list of `semesters`, a
`github` link to the course materials and a markdown `description` rendered at
build time. Here — unlike software — **file order is display order**: the
required MSc DSPP core courses come first, then the electives newest-first.

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

## Theme

The site follows the visitor's OS color scheme by default, and the small control
at the end of the header nav cycles **system → light → dark**. Three moving
parts:

1. **Tokens** (`src/styles/global.css`, `src/styles/code.css`). Light values sit
   unconditionally on `:root`, so no color is ever defined *only* inside a media
   query. Dark values are applied twice — under
   `@media (prefers-color-scheme: dark)` guarded as
   `:root:not([data-theme='light'])`, and again under `:root[data-theme='dark']`,
   which comes later in source order. The result: the OS wins when nothing is
   stored, and the explicit choice wins in *both* directions. `color-scheme` is
   `light dark` by default and pinned by the two attribute selectors. The two
   dark blocks are adjacent and must stay in sync. Shiki's
   `--shiki-light` / `--shiki-dark` token switching in `code.css` follows the
   same shape, as does MathJax's own stylesheet — `scripts/vendor-mathjax.mjs`
   rewrites its `prefers-color-scheme` blocks on the way out.
2. **The pre-paint stamp** (`src/lib/theme.ts` → `BaseHead.astro`). ~136 bytes
   inline at the very top of `<head>`, parser-blocking on purpose: it reads
   `localStorage['theme']` and stamps `data-theme` on `<html>` before the first
   paint, so forcing a theme against the OS preference causes no flash. An
   absent key means "follow the OS" and needs no stamp.
3. **The control** (`Header.astro` + `themeToggle` in `src/lib/theme.ts`, ~640
   bytes inline). Ships with the `hidden` attribute and is revealed by its own
   script, so no-JS visitors never see a dead control. `data-mode` on the button
   selects one of three inline SVGs — a half-filled circle for system-following,
   a sun, a moon — so a forced choice is distinguishable from following the OS.
   The accessible name states the current mode and what the next click does.

Storage contract: `localStorage['theme']` is `'light'`, `'dark'`, or absent.
Nothing else reads or writes it.

---

## Design notes

- **Type.** URW Classico (Optima-derived) for headings and navigation, Domitian
  (Palatino-derived) for body text, Monaspace Argon for code — all humanist, all
  free, all self-hosted as woff2 through Astro's Fonts API with `font-display:
  swap` and preloading of the two faces used above the fold. Nine faces total,
  including the URW Classico bold-italic the old site shipped but never
  registered. Every face is subset to the characters the site's own content
  needs, on every build — see [Fonts](#fonts).
- **Color.** Neutral grounds — a barely-off white in light mode, a neutral
  near-black in dark, no warm cast either way (never pure white or black) — with the Hertie red `#ba0020` as a single accent — lightened to
  `#f2596d` in dark mode for contrast. Light and dark are CSS custom properties
  and follow `prefers-color-scheme` by default; a quiet header control can force
  either one. See [Theme](#theme).
- **Mark.** A personal mark — two mirrored humanist `D` bowls sharing one flared
  spine, thin where they meet it and swelling at the equator, drawn to match the
  Optima-ish heading face rather than to shout. It appears in the accent red at
  about the size of the surrounding type, twice: before the wordmark in the
  header and before the copyright line in the footer. Nowhere else — it is a
  printer's mark, not a logo. Source of truth is the hand-authored SVG in
  [`src/assets/mark/`](src/assets/mark/) (`t-flare-mark.svg`, the mark on
  transparent; `t-flare-tile.svg`, the same knocked out of a red rounded
  square), and the geometry is transcribed once more into
  [`src/components/Mark.astro`](src/components/Mark.astro) so the on-page copies
  ship inline, take `currentColor`, and cost no request. Every derived asset is
  generated from those sources by `make brand`:
  [`scripts/build-mark-assets.mjs`](scripts/build-mark-assets.mjs) writes
  `favicon.svg` (with an embedded `prefers-color-scheme: dark` rule, so the tab
  glyph lightens to `#f2596d` on dark chrome), the `favicon-32.png` /
  `favicon-16.png` fallback for browsers that ignore SVG favicons, and a
  full-bleed `apple-touch-icon.png` from the tile treatment (iOS masks its own
  corner radius and composites transparency badly);
  [`scripts/build-social-card.mjs`](scripts/build-social-card.mjs) sets the
  default `social-card.jpg` in the site's real woff2 faces by screenshotting an
  HTML template in Chromium. Both are deterministic and run by hand, not on
  every build; their outputs are committed.
- **Layout.** An 80rem page shell and a measure of ~75ch, a fluid `clamp()` type
  scale, hairline rules instead of boxes and shadows. Mobile-first; the table of
  contents (post pages and the research index) is a collapsible `<details>` on
  narrow screens and a sticky left-hand sidebar past 70rem.
- **Performance.** Under 1 kB of first-party JS, all inline (the theme stamp and
  toggle, ~0.8 kB, plus the sidebar scroll-spy on pages that have an outline);
  the GA snippet is the only external script. Per-route CSS (prose and
  code styles only load on pages that need them), the MathJax stylesheet only on
  posts with `math: true`, content-driven font subsets (~615 kB → ~333 kB), all
  images processed by sharp with explicit dimensions, and no external requests
  other than Google Analytics. Only two faces are preloaded; the other seven are
  fetched by the browser only if a page's text actually needs them, so `/` and
  `/research/` never download the code font at all.
