#!/usr/bin/env node
/**
 * Write the MathJax container stylesheet to public/mathjax/mathjax.css so math
 * pages are served entirely from our own origin (no CDN, no client JS).
 *
 * The equations themselves are inline SVG with their glyph outlines embedded
 * (see scripts/lib/mathjax-euler.mjs), so there are no webfonts to copy — this
 * is the *only* asset math pages need, and it is linked only on posts with
 * `math: true`.
 *
 * Runs automatically before `npm run build`; public/mathjax/ is gitignored.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mathjaxStyles } from './lib/mathjax-euler.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'mathjax');

const css = await mathjaxStyles();

// MathJax colours links inside formulae bright blue; defer to the site palette.
const overrides = `
mjx-container[jax="SVG"] > svg a {
  fill: currentColor;
  stroke: currentColor;
}
`.trim();

await mkdir(out, { recursive: true });
await writeFile(join(out, 'mathjax.css'), `${css}\n\n${overrides}\n`);

console.log(
  `vendor-mathjax: 1 stylesheet (${(css.length / 1024).toFixed(1)} kB) -> public/mathjax/`,
);
