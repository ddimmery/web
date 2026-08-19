#!/usr/bin/env node
/**
 * Copy the KaTeX stylesheet and its woff2 fonts out of node_modules into
 * public/katex/ so math pages are served entirely from our own origin (no CDN).
 *
 * Runs automatically before `npm run build`; public/katex/ is gitignored.
 * Only woff2 is copied — the stylesheet lists it first, so the woff/ttf
 * fallbacks it also mentions are never requested by any browser we care about.
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'katex', 'dist');
const out = join(root, 'public', 'katex');

await mkdir(join(out, 'fonts'), { recursive: true });

// katex-swap.min.css is the stock stylesheet with `font-display: swap`.
const css = await readFile(join(src, 'katex-swap.min.css'), 'utf8');
await writeFile(join(out, 'katex.min.css'), css);

const fonts = (await readdir(join(src, 'fonts'))).filter((f) => f.endsWith('.woff2'));
await Promise.all(
  fonts.map((font) =>
    copyFile(join(src, 'fonts', font), join(out, 'fonts', font)),
  ),
);

console.log(`vendor-katex: 1 stylesheet + ${fonts.length} woff2 fonts -> public/katex/`);
