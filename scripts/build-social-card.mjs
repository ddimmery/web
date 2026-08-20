#!/usr/bin/env node
/**
 * Social card generation (public/social-card*.jpg, 1200x630 each).
 *
 * Five cards from one template: the site-wide default (the name and the
 * tagline) plus one per section — research, teaching, software, blog — which
 * swap the name line for the section's own title, keeping the same mark, the
 * same rule, the same domain in the corner. They are all the same design; only
 * the two lines of type change, which is why they share a template rather than
 * living in five files that would drift.
 *
 * The card is typographic, in the site's own design language: neutral paper
 * ground, the name in URW Classico bold, the tagline in Domitian italic, and
 * the personal mark in accent red as the only piece of colour.
 *
 * Why a browser and not sharp's text/SVG path: the card must be set in the
 * site's *real* faces, and those are woff2. librsvg (sharp's SVG backend) will
 * not load a woff2 @font-face, so the reliable way to rasterise with the actual
 * type is to lay the card out in HTML with the woff2 files inlined as data URIs
 * and screenshot it in Chromium — the same engine that renders the site. sharp
 * then does only the PNG -> JPEG conversion, where it is the right tool.
 *
 * Deterministic: fixed viewport, fixed deviceScaleFactor, fonts embedded (no
 * network, no system-font fallback), `document.fonts.ready` awaited before the
 * shot, fixed JPEG quality. Same inputs, same bytes.
 *
 * Per-post `cover` images still override og:image on posts; this is the
 * site-wide default (src/lib/site.ts `defaultImage`).
 *
 * Run manually after changing the mark, the palette or the wording:
 *
 *     npm run social-card
 *
 * Requires Playwright's Chromium (PLAYWRIGHT_BROWSERS_PATH), which is a
 * developer-machine tool, not a site dependency — hence a manual script rather
 * than a build step, with the JPEG committed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fonts = join(root, 'src', 'assets', 'fonts');
const markDir = join(root, 'src', 'assets', 'mark');

/** Palette, kept in sync with the light theme in src/styles/global.css. */
const PAPER = '#fcfcfd';
const INK = '#1b1c1e';
const INK_MUTED = '#5f6368';
const RULE = '#e1e3e6';
const ACCENT = '#ba0020';

const WIDTH = 1200;
const HEIGHT = 630;

const DOMAIN = 'ddimmery.com';

/**
 * The cards. `title` is the large line; `tagline` the italic line under the
 * rule; `eyebrow` the small letterspaced line above the title, which the
 * section cards use to keep the owner's name on a card whose headline is a
 * section name. The default card has no eyebrow — its headline *is* the name.
 *
 * `size` is the title's font size in px, set per card rather than fitted: these
 * strings never change without someone editing this file, so a measured value
 * beats a heuristic that could clip a descender.
 */
const CARDS = [
  {
    file: 'social-card.jpg',
    title: 'Drew Dimmery',
    size: 118,
    tagline: 'Social science methods',
  },
  {
    file: 'social-card-research.jpg',
    eyebrow: 'Drew Dimmery',
    title: 'Research',
    size: 132,
    tagline: 'Causal inference and experimental design',
  },
  {
    file: 'social-card-teaching.jpg',
    eyebrow: 'Drew Dimmery',
    title: 'Teaching',
    size: 132,
    tagline: 'Courses at the Hertie School',
  },
  {
    file: 'social-card-software.jpg',
    eyebrow: 'Drew Dimmery',
    title: 'Software',
    size: 132,
    tagline: 'Open-source tools for applied methodology',
  },
  {
    file: 'social-card-blog.jpg',
    eyebrow: 'Drew Dimmery',
    title: 'Blog',
    size: 132,
    tagline: 'Notes on methods and experimentation',
  },
];

/** Inline a woff2 as a data URI so the render never depends on the filesystem. */
const face = async (family, file, weight, style) =>
  `@font-face {
      font-family: '${family}';
      font-weight: ${weight};
      font-style: ${style};
      src: url(data:font/woff2;base64,${(await readFile(join(fonts, file))).toString('base64')}) format('woff2');
    }`;

const markSrc = await readFile(join(markDir, 't-flare-mark.svg'), 'utf8');
const markBody = markSrc
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .trim();

/**
 * Escape the four characters that could break out of a text node. The card
 * strings are authored right here in this file, so this is belt and braces —
 * but a tagline gaining an ampersand should not silently produce an entity.
 */
const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The shared face declarations: read and base64'd once, reused by every card. */
const faces = [
  await face('Classico', 'URWClassico-Bol.woff2', 700, 'normal'),
  await face('Classico', 'URWClassico-Reg.woff2', 400, 'normal'),
  await face('Domitian', 'Domitian-Italic.woff2', 400, 'italic'),
].join('\n  ');

const cardHtml = (card) => `<!doctype html><meta charset="utf-8">
<style>
  ${faces}

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    background: ${PAPER};
    color: ${INK};
    /* The card is a fixed-size canvas, so everything is set in px: no fluid
       scale, no inherited page rhythm. */
    padding: 92px 104px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    -webkit-font-smoothing: antialiased;
  }
  /* Hairline accent bleed on the left edge: the same gesture as the site's
     rules, just enough colour to keep the card from reading as a blank page. */
  .edge {
    position: absolute;
    inset: 0 auto 0 0;
    width: 10px;
    background: ${ACCENT};
  }
  /* The mark's own artwork sits 6/64 inside its viewBox, so a negative inline
     start margin of that fraction of its size optically aligns its left edge
     with the stem of the D below it rather than with its invisible box. */
  .mark {
    width: 96px;
    height: 96px;
    margin: 0 0 40px calc(-96px * 6 / 64);
    color: ${ACCENT};
  }
  /* Section cards only: the owner's name, in the same letterspaced uppercase
     the site uses for its eyebrows, so a card headlined "Research" still says
     whose research it is. It replaces part of the mark's lower margin rather
     than adding to it, so the block stays optically centred either way. */
  .eyebrow {
    font-family: 'Classico', sans-serif;
    font-weight: 700;
    font-size: 26px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${INK_MUTED};
    margin: -18px 0 22px;
  }
  h1 {
    font-family: 'Classico', sans-serif;
    font-weight: 700;
    font-size: ${card.size}px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .rule {
    width: 132px;
    height: 2px;
    background: ${RULE};
    margin: 38px 0 34px;
  }
  .tagline {
    font-family: 'Domitian', serif;
    font-style: italic;
    font-size: 44px;
    line-height: 1.2;
    color: ${INK_MUTED};
    /* The section taglines are longer than the default card's; hold them off
       the domain in the corner. */
    max-width: 830px;
  }
  .domain {
    position: absolute;
    right: 104px;
    bottom: 76px;
    font-family: 'Classico', sans-serif;
    font-weight: 400;
    font-size: 24px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${INK_MUTED};
  }
</style>
<div class="edge"></div>
<svg class="mark" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">${markBody}</svg>
${card.eyebrow ? `<p class="eyebrow">${escapeHtml(card.eyebrow)}</p>` : ''}
<h1>${escapeHtml(card.title)}</h1>
<div class="rule"></div>
<p class="tagline">${escapeHtml(card.tagline)}</p>
<div class="domain">${DOMAIN}</div>
`;

// One browser and one page for all five cards: the fonts are inlined in every
// document, so nothing is shared between renders except the process.
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
});

for (const card of CARDS) {
  await page.setContent(cardHtml(card), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });

  // 2x shot down to exactly 1200x630 — supersampling the type rather than
  // rasterising it once at final size.
  const jpg = await sharp(png)
    .resize(WIDTH, HEIGHT, { kernel: 'lanczos3' })
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();

  await writeFile(join(root, 'public', card.file), jpg);
  console.log(`${card.file} written: ${WIDTH}x${HEIGHT}, ${(jpg.length / 1024).toFixed(1)} kB`);
}

await browser.close();
