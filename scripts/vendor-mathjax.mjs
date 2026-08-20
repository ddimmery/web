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

// MathJax colors links inside formulae bright blue; defer to the site palette.
//
// The second rule is an accessibility fix. MathJax hides its assistive-MathML
// copy with BOTH `clip: rect(1px,1px,1px,1px)` and
// `clip-path: polygon(0 0, 0 1px, 1px 1px, 1px 0)`. The clip-path collapses the
// element to a degenerate area, which axe-core (and therefore Lighthouse)
// treats as "hidden from screen readers" — so a link whose only content is a
// formula, e.g. `[$\text{Neo-Euler}$](…)` in the website-refresh post, was
// reported as a link with no accessible name. Dropping just the clip-path
// leaves the classic, axe-recognized visually-hidden pattern (absolute
// positioning + clip rect), which hides the MathML exactly as before while
// keeping it nameable.
const overrides = `
mjx-container[jax="SVG"] > svg a {
  fill: currentColor;
  stroke: currentColor;
}

mjx-assistive-mml {
  clip-path: none !important;
}
`.trim();

await mkdir(out, { recursive: true });
await writeFile(join(out, 'mathjax.css'), `${css}\n\n${overrides}\n`);

console.log(
  `vendor-mathjax: 1 stylesheet (${(css.length / 1024).toFixed(1)} kB) -> public/mathjax/`,
);
