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

const css = themeGuard(await mathjaxStyles());

/**
 * Make MathJax's own `prefers-color-scheme: dark` blocks obey the site's theme
 * toggle instead of the OS alone.
 *
 * The site keeps light values as the unconditional base layer and applies dark
 * twice: inside the media query guarded by `:not([data-theme="light"])` (so a
 * forced light choice survives a dark OS) and again under `[data-theme="dark"]`
 * (so a forced dark choice survives a light OS). See src/styles/global.css.
 *
 * This rewrites MathJax's stylesheet into the same shape. The rules involved
 * only style interactive MathJax furniture (tooltips, collapsed subtrees, the
 * speech-rule highlighter) which this build never emits, but leaving a bare
 * `prefers-color-scheme` here would be one place the theme could desync.
 *
 * @param {string} sheet
 * @returns {string}
 */
function themeGuard(sheet) {
  const marker = '@media (prefers-color-scheme: dark)';
  let output = '';
  let rest = sheet;

  for (;;) {
    const at = rest.indexOf(marker);
    if (at === -1) return output + rest;

    const open = rest.indexOf('{', at);
    const end = matchBrace(rest, open);
    if (open === -1 || end === -1) return output + rest;

    const prelude = rest.slice(at, open); // keeps MathJax's trailing comment
    const body = rest.slice(open + 1, end);

    output +=
      rest.slice(0, at) +
      `${prelude}{${prefixSelectors(body, ':root:not([data-theme="light"])')}}` +
      `\n${prefixSelectors(body, ':root[data-theme="dark"]').trim()}\n`;
    rest = rest.slice(end + 1);
  }
}

/** Index of the `}` closing the `{` at `open`. */
function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Prepend `scope` to every selector in a (flat) list of style rules. */
function prefixSelectors(body, scope) {
  let out = '';
  let rest = body;

  for (;;) {
    const open = rest.indexOf('{');
    if (open === -1) return out + rest;
    const end = matchBrace(rest, open);
    if (end === -1) return out + rest;

    const selector = rest
      .slice(0, open)
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        return trimmed ? `${scope} ${trimmed}` : part;
      })
      .join(', ');

    out += `\n${selector} {${rest.slice(open + 1, end)}}\n`;
    rest = rest.slice(end + 1);
  }
}

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
