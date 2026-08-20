#!/usr/bin/env node
/**
 * Favicon / touch-icon generation from the personal mark.
 *
 * Source of truth: `src/assets/mark/t-flare-mark.svg` (the mark on transparent)
 * and `src/assets/mark/t-flare-tile.svg` (the mark knocked out of a red rounded
 * square). Both are hand-authored SVG on a 64x64 grid; the mark's own bounding
 * box is x/y 6..58, i.e. 52 of 64 units, so it already carries its own optical
 * margin and needs no extra padding when it is rasterised edge to edge.
 *
 * The mark is "t-flare": two mirrored humanist D bowls sharing one spine, each
 * bowl thin (6 units) where it meets the spine and swelling to 12 at the
 * equator, with the spine's ends flaring rather than cutting square.
 *
 * Outputs, all written to `public/`:
 *
 *   favicon.svg           the transparent mark, with an embedded
 *                         `prefers-color-scheme: dark` rule that swaps the fill
 *                         from the light accent to the dark-mode accent, so the
 *                         tab mark tracks the browser's own chrome. Fill is
 *                         declared on a class rather than per-path so one rule
 *                         governs both bowls.
 *   favicon-32.png        \ raster fallback for browsers that ignore SVG
 *   favicon-16.png        / favicons (Safari). Accent red on transparent.
 *   apple-touch-icon.png  180x180, FULL-BLEED solid accent with the mark
 *                         knocked out in paper white. iOS composites
 *                         transparency badly and masks its own corner radius,
 *                         so the tile's 12-unit rounded rect is dropped and the
 *                         knockout is re-centred at 0.78 scale — a touch more
 *                         inset than the tile's own 0.9, because iOS's mask
 *                         crops the corners of the square this fills.
 *
 * Rasterisation is sharp at a density high enough that the SVG is drawn at 4x
 * the target and downsampled, matching the pipeline the mark was designed and
 * judged in (scratchpad mark/render.mjs). Deterministic: same inputs, same
 * bytes. Run manually after changing the mark:
 *
 *     npm run mark-assets
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markDir = join(root, 'src', 'assets', 'mark');
const outDir = join(root, 'public');

/** Kept in sync with `--accent` / dark `--accent` in src/styles/global.css. */
const ACCENT = '#ba0020';
const ACCENT_DARK = '#f2596d';
/** Kept in sync with `--paper` (light). The tile knocks the mark out in this. */
const PAPER = '#fcfcfd';

/** Render an SVG buffer to a square PNG at `size`, drawing at 4x first. */
const raster = (svg, size) =>
  sharp(Buffer.from(svg), { density: 72 * (size / 64) * 4 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

const markSrc = await readFile(join(markDir, 't-flare-mark.svg'), 'utf8');
/** Everything between the source's own <svg> tags: the two mirrored bowls. */
const markBody = markSrc.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

// ---------------------------------------------------------------- favicon.svg
// The two <path fill="#ba0020"> of the source become class="m", and a <style>
// carries the light fill plus the dark-mode swap.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <style>
    .m { fill: ${ACCENT}; }
    @media (prefers-color-scheme: dark) {
      .m { fill: ${ACCENT_DARK}; }
    }
  </style>
  ${markBody.replace(/fill="#ba0020"/g, 'class="m"')}
</svg>
`;
await writeFile(join(outDir, 'favicon.svg'), faviconSvg);

// ------------------------------------------------------- favicon-32 / -16.png
// Raster fallback: the flat accent, no media query (PNG cannot switch).
for (const size of [32, 16]) {
  await writeFile(join(outDir, `favicon-${size}.png`), await raster(markSrc, size));
}

// -------------------------------------------------------- apple-touch-icon.png
// Full-bleed accent square, mark knocked out in paper white at 0.78 scale.
const knockout = markBody.replace(/fill="#ba0020"/g, `fill="${PAPER}"`);
const touchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" fill="${ACCENT}"/>
  <g transform="translate(32 32) scale(0.78) translate(-32 -32)">
    ${knockout}
  </g>
</svg>
`;
await writeFile(
  join(outDir, 'apple-touch-icon.png'),
  await sharp(Buffer.from(touchSvg), { density: 72 * (180 / 64) * 4 })
    .resize(180, 180)
    .flatten({ background: ACCENT })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer(),
);

console.log('mark assets written to public/: favicon.svg, favicon-32.png, favicon-16.png, apple-touch-icon.png');
