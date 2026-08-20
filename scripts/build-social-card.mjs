#!/usr/bin/env node
/**
 * Default social card generation (public/social-card.jpg, 1200x630).
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

const NAME = 'Drew Dimmery';
const TAGLINE = 'Social science methods';
const DOMAIN = 'ddimmery.com';

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

const html = `<!doctype html><meta charset="utf-8">
<style>
  ${await face('Classico', 'URWClassico-Bol.woff2', 700, 'normal')}
  ${await face('Classico', 'URWClassico-Reg.woff2', 400, 'normal')}
  ${await face('Domitian', 'Domitian-Italic.woff2', 400, 'italic')}

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
  h1 {
    font-family: 'Classico', sans-serif;
    font-weight: 700;
    font-size: 118px;
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
<h1>${NAME}</h1>
<div class="rule"></div>
<p class="tagline">${TAGLINE}</p>
<div class="domain">${DOMAIN}</div>
`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });
await browser.close();

// 2x shot down to exactly 1200x630 — supersampling the type rather than
// rasterising it once at final size.
const jpg = await sharp(png)
  .resize(WIDTH, HEIGHT, { kernel: 'lanczos3' })
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true })
  .toBuffer();

const out = join(root, 'public', 'social-card.jpg');
await writeFile(out, jpg);
console.log(`social-card.jpg written: ${WIDTH}x${HEIGHT}, ${(jpg.length / 1024).toFixed(1)} kB`);
