#!/usr/bin/env node
/**
 * Content-driven font subsetting.
 *
 * The nine self-hosted woff2 faces (Domitian x4, URW Classico x4, Monaspace
 * Argon variable) are ~615 kB together and dominate page weight. Almost all of
 * that is glyphs this site never renders: Cyrillic, Greek, small caps for
 * scripts we don't use, dingbats, and — in Monaspace's case — a large icon and
 * box-drawing repertoire.
 *
 * This script computes, from the site's own sources, the set of characters the
 * site can actually render, then rewrites each face with only those glyphs into
 * `src/assets/fonts/generated/` (gitignored). astro.config.mjs registers the
 * *generated* directory with the Fonts API, so the build always ships subsets
 * and the subset re-derives itself whenever content changes — nothing is
 * hardcoded, and nothing in `src/assets/fonts/` is modified.
 *
 * Runs before `astro build` / `astro dev` from the npm scripts, exactly like
 * scripts/vendor-mathjax.mjs.
 *
 * Design notes
 * ------------
 * * Union across families, not per-family attribution. Attribution would need a
 *   CSS cascade model to be correct (--font-mono is not only used for code:
 *   see global.css `kbd` and blocks.css `.callout code`), and a wrong guess
 *   ships tofu. The union costs a few kB per face and cannot be wrong.
 * * The character scan is deliberately over-inclusive: every character of every
 *   source file that can contribute text is added, including markup and code.
 *   Markup/code characters are ASCII, which the safety floor already covers, so
 *   the only thing this actually adds is literal non-ASCII in templates, YAML
 *   and prose — which is exactly the set that must not be missed.
 * * A fixed safety floor (ASCII, Latin-1, Latin Extended-A, combining marks,
 *   typographic punctuation) is always included on top of the scan, because
 *   content changes between builds — most notably `make papers`, which pulls
 *   author names with arbitrary Latin accents from Semantic Scholar.
 * * Layout features are all preserved (subset-font does the equivalent of
 *   `--layout-features=*`), so `liga`, `kern`, `calt` and the oldstyle/
 *   proportional figure features the site relies on via
 *   `font-variant-numeric: oldstyle-nums` all survive. HarfBuzz's layout
 *   closure also keeps the ligature and mark glyphs those features reach, even
 *   though no codepoint maps to them.
 * * Monaspace Argon is a variable font and is NOT instanced: no `variationAxes`
 *   are passed, so its axes (and the `weight: '200 800'` range in
 *   astro.config.mjs) stay intact.
 *
 * Escape hatch: `SUBSET_FONTS=0 npm run build` copies the originals into the
 * generated directory verbatim, so the build still works and ships full faces.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import subsetFont from 'subset-font';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcFonts = join(root, 'src', 'assets', 'fonts');
const outFonts = join(srcFonts, 'generated');

/** Extensions whose contents can end up as rendered text on the site. */
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.yaml',
  '.yml',
  '.astro',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
  '.css',
]);

/** Directories under src/ that hold no renderable text. */
const SKIP_DIRS = new Set(['fonts', 'generated', 'node_modules']);

/**
 * Inclusive codepoint ranges that are ALWAYS kept, whether or not today's
 * content uses them. Content churns; a missing glyph is a visible bug, while an
 * unused glyph costs bytes measured in the hundreds.
 *
 * SHARED_FLOOR goes into every face. TEXT_FLOOR is added on top for the faces
 * that render prose and headings. The split exists for one reason: Latin
 * Extended-A alone costs 24 kB in Monaspace Argon (a variable font, so every
 * glyph carries `gvar` deltas) versus 7 kB in the static faces, and author
 * names — the entire reason for a speculative accent floor — never render in
 * the code font. Anything the content *actually* contains still goes into every
 * face, so this cannot produce tofu for real content; it only declines to
 * speculate in the most expensive face.
 */
const SHARED_FLOOR = [
  [0x20, 0x7e], // ASCII printable
  [0xa0, 0xff], // Latin-1 Supplement: accented letters, guillemets, x, ÷, ©, §, ¶, ·
  [0x2000, 0x200b], // en/em/thin/hair spaces + zero-width space
  [0x2010, 0x2027], // hyphens, dashes, curly quotes, dagger, double dagger, bullet, ellipsis
  [0x2030, 0x2044], // per-mille, primes, single guillemets, fraction slash
  [0x2060, 0x2060], // word joiner
  [0x2122, 0x2122], // trademark
  // Arrows in prose and UI affordances. The range runs to 0x2199 so it also
  // covers ↗ (U+2197), the external-link marker in src/styles/prose.css. That
  // one arrives only as a CSS `content` string, which the *source* scan does
  // pick up (`.css` is in TEXT_EXTENSIONS and the file lives under src/) — but
  // it is named here explicitly so the floor, not an incidental scan of a
  // stylesheet, is what guarantees the glyph. All nine faces carry it.
  [0x2190, 0x2199],
  [0x21a9, 0x21a9], // the footnote back-reference the markdown pipeline injects
  [0x2212, 0x2212], // minus sign
  [0x2248, 0x2248], // almost equal
  [0x2260, 0x2265], // not equal, identical, less/greater-or-equal
  [0x2500, 0x2503], // light box drawing (tree output in code blocks)
  [0x2514, 0x2514],
  [0x251c, 0x251c],
  [0x2610, 0x2611], // ballot boxes (task lists)
  [0x2713, 0x2717], // check / cross marks
];

const TEXT_FLOOR = [
  [0x100, 0x17f], // Latin Extended-A: Š, ž, ő, ā, ł, ć … (author names)
  [0x180, 0x24f], // Latin Extended-B (ǎ, ș, ț — Romanian/Turkish names)
  [0x2b9, 0x2bc], // modifier primes/apostrophe used in transliterations
  [0x300, 0x36f], // combining diacritical marks (decomposed input, mark positioning)
  [0x1e00, 0x1eff], // Latin Extended Additional (ẽ, ṣ, ệ)
  [0x2052, 0x2052], // commercial minus
  [0x2070, 0x2071], // superscript digits and letters
  [0x2074, 0x208e], // ... and subscripts: ₂ etc. reach the DOM via assistive MathML
  [0x20ac, 0x20ac], // euro
  [0x2113, 0x2116], // script l, numero
  [0x2202, 0x2202], // partial differential
  [0x2205, 0x2205], // empty set
  [0x2208, 0x220b], // element of
  [0x2211, 0x2211], // summation
  [0x2217, 0x2219], // asterisk operator, bullet operator
  [0x221a, 0x221a], // square root
  [0x221e, 0x221e], // infinity
  [0xfb00, 0xfb06], // fi/fl/ff/ffi/ffl/st ligature codepoints
];

/**
 * Faces that render code rather than prose get SHARED_FLOOR only. Matched as a
 * filename prefix; anything unrecognized falls back to the generous text floor,
 * so adding a face can only ever cost bytes, never correctness.
 */
const MONO_FACE_PREFIXES = ['MonaspaceArgon'];

const isMonoFace = (filename) =>
  MONO_FACE_PREFIXES.some((prefix) => filename.startsWith(prefix));

/** Recursively list candidate text files under a directory. */
async function listTextFiles(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await listTextFiles(full, acc);
    } else if (TEXT_EXTENSIONS.has(extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

/** True for codepoints that could never be a glyph we need. */
function isRenderable(cp) {
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) return false; // control
  if (cp >= 0xd800 && cp <= 0xdfff) return false; // lone surrogate
  if (cp >= 0xe000 && cp <= 0xf8ff) return false; // private use (icon fonts)
  if (cp > 0xffff) return false; // astral (emoji); none of these faces have any
  return true;
}

function addCodepoints(set, text) {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (isRenderable(cp)) set.add(cp);
  }
}

/**
 * Characters hidden behind escape sequences.
 *
 * `scripts/sync-papers.mjs` writes papers.yaml through the `yaml` serialiser,
 * which escapes non-ASCII as `"Pablo Barber\xE1"`. A naive character scan of
 * that file sees only ASCII and would drop every accent the research page
 * renders. The same applies to `\uNNNN` in TypeScript/Astro and to numeric HTML
 * entities in markdown.
 */
function addEscapedCodepoints(set, text) {
  const patterns = [
    [/\\x([0-9a-fA-F]{2})/g, 16],
    [/\\u([0-9a-fA-F]{4})/g, 16],
    [/\\u\{([0-9a-fA-F]{1,6})\}/g, 16],
    [/&#x([0-9a-fA-F]{1,6});/g, 16],
    [/&#([0-9]{1,7});/g, 10],
  ];
  for (const [re, radix] of patterns) {
    for (const match of text.matchAll(re)) {
      const cp = Number.parseInt(match[1], radix);
      if (Number.isFinite(cp) && isRenderable(cp)) set.add(cp);
    }
  }
}

/**
 * Compute the character sets the site needs: everything in its own sources,
 * plus the safety floor. Returns one set for prose faces and one for code
 * faces; both contain the full content scan.
 */
async function computeCodepoints() {
  const files = [
    ...(await listTextFiles(join(root, 'src'))),
    ...(await listTextFiles(join(root, 'scripts', 'lib'))),
  ];

  const content = new Set();
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    addCodepoints(content, text);
    addEscapedCodepoints(content, text);
  }

  const expand = (ranges, base) => {
    const set = new Set(base);
    for (const [start, end] of ranges) {
      for (let cp = start; cp <= end; cp += 1) set.add(cp);
    }
    return set;
  };

  const shared = expand(SHARED_FLOOR, content);
  const text = expand(TEXT_FLOOR, shared);

  return { text, mono: shared, content, files };
}

function formatBytes(n) {
  return `${(n / 1024).toFixed(1)} kB`;
}

/**
 * `--audit`: after `astro build`, check the *rendered* HTML against the set the
 * subsets were built from.
 *
 * This closes the one hole in a source-scanning approach: characters that no
 * source file contains because a build plugin invents them. Real examples on
 * this site are the `↩` footnote back-reference injected by the markdown
 * footnote handling, and — before addEscapedCodepoints existed — every accented
 * author name in papers.yaml, which the YAML serialiser stores as `\xE1`
 * escapes. The audit is what stops the next such surprise from shipping as tofu.
 *
 * It checks against the prose set (the superset). Code faces are covered by the
 * content scan itself: everything Monaspace renders comes from a code block in
 * a source file, read verbatim, and Shiki injects no characters of its own.
 *
 * If it reports characters, add them to SHARED_FLOOR / TEXT_FLOOR (adding a
 * range a face does not contain is free — harfbuzz has nothing to keep).
 */
async function audit(codepoints) {
  const distDir = join(root, 'dist');
  const htmlFiles = [];
  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(html|xml)$/.test(entry.name)) htmlFiles.push(full);
    }
  };
  await walk(distDir);

  if (htmlFiles.length === 0) {
    console.error('subset-fonts --audit: no built HTML found in dist/ — build first');
    process.exit(1);
  }

  const missing = new Map(); // codepoint -> example file
  for (const file of htmlFiles) {
    const text = await readFile(file, 'utf8');
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (!isRenderable(cp)) continue;
      if (!codepoints.has(cp) && !missing.has(cp)) missing.set(cp, relative(root, file));
    }
  }

  if (missing.size > 0) {
    console.error(
      `subset-fonts --audit: ${missing.size} character(s) appear in the built ` +
        'HTML but were not in the subset character set:'
    );
    for (const [cp, file] of [...missing].sort((a, b) => a[0] - b[0])) {
      console.error(
        `  U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(cp)}  (first seen in ${file})`
      );
    }
    console.error(
      'Add them to SHARED_FLOOR or TEXT_FLOOR in scripts/subset-fonts.mjs ' +
        '(adding a range a face does not contain is free), then rebuild.'
    );
    process.exit(1);
  }

  console.log(
    `subset-fonts --audit: OK — every character in ${htmlFiles.length} built ` +
      `documents is covered by the ${codepoints.size}-character subset.`
  );
  process.exit(0);
}

const auditOnly = process.argv.includes('--audit');

const disabled = ['0', 'false', 'no'].includes(
  String(process.env.SUBSET_FONTS ?? '').toLowerCase()
);

if (auditOnly) {
  if (disabled) {
    console.log('subset-fonts --audit: skipped (SUBSET_FONTS=0, full faces shipped)');
    process.exit(0);
  }
  const { text } = await computeCodepoints();
  await audit(text);
}

const faces = (await readdir(srcFonts, { withFileTypes: true }))
  .filter((e) => e.isFile() && e.name.endsWith('.woff2'))
  .map((e) => e.name)
  .sort();

if (faces.length === 0) {
  console.error('subset-fonts: no .woff2 faces found in src/assets/fonts/');
  process.exit(1);
}

await mkdir(outFonts, { recursive: true });

if (disabled) {
  for (const face of faces) {
    await writeFile(join(outFonts, face), await readFile(join(srcFonts, face)));
  }
  console.log(
    `subset-fonts: SUBSET_FONTS=0 — copied ${faces.length} full faces to ` +
      `${relative(root, outFonts)}/ without subsetting.`
  );
  process.exit(0);
}

const sets = await computeCodepoints();

// Sorted, so the subset text is a pure function of the character set: same
// content in, byte-identical fonts out.
const asText = (set) =>
  String.fromCodePoint(...[...set].sort((a, b) => a - b));
const subsetText = { text: asText(sets.text), mono: asText(sets.mono) };

console.log(
  `subset-fonts: scanned ${sets.files.length} source files -> ` +
    `${sets.content.size} characters in content; keeping ${sets.text.size} in ` +
    `prose faces and ${sets.mono.size} in code faces`
);

const rows = [];
let failures = 0;

for (const face of faces) {
  const kind = isMonoFace(face) ? 'mono' : 'text';
  const original = await readFile(join(srcFonts, face));
  try {
    // No `variationAxes`: variable axes are preserved as-is (Monaspace Argon
    // must keep its wght range). subset-font keeps all layout features.
    const subset = await subsetFont(original, subsetText[kind], {
      targetFormat: 'woff2',
    });

    // Sanity checks — a broken face must never ship silently.
    const signature = subset.subarray(0, 4).toString('latin1');
    if (signature !== 'wOF2') {
      throw new Error(`output is not woff2 (signature ${JSON.stringify(signature)})`);
    }
    if (subset.length < 2048) {
      throw new Error(`output is implausibly small (${subset.length} bytes)`);
    }
    if (subset.length >= original.length) {
      throw new Error(
        `subset (${subset.length} B) is not smaller than the original ` +
          `(${original.length} B) — subsetting had no effect`
      );
    }

    await writeFile(join(outFonts, face), subset);
    rows.push([face, original.length, subset.length, kind]);
  } catch (err) {
    failures += 1;
    console.error(`subset-fonts: FAILED on ${face}: ${err.message}`);
  }
}

if (failures > 0) {
  console.error(
    `subset-fonts: ${failures} face(s) could not be subset — refusing to build ` +
      'with missing or broken fonts. Re-run with SUBSET_FONTS=0 to ship full faces.'
  );
  process.exit(1);
}

const nameWidth = Math.max(...rows.map((r) => r[0].length), 4);
const line = (a, b, c, d, e) =>
  `  ${a.padEnd(nameWidth)}  ${b.padStart(5)}  ${c.padStart(9)}  ${d.padStart(9)}  ${e.padStart(7)}`;

const rule = `  ${'-'.repeat(nameWidth)}  ${'-'.repeat(5)}  ${'-'.repeat(9)}  ${'-'.repeat(9)}  ${'-'.repeat(7)}`;
console.log(line('face', 'set', 'original', 'subset', 'saved'));
console.log(rule);
let totalBefore = 0;
let totalAfter = 0;
for (const [face, before, after, kind] of rows) {
  totalBefore += before;
  totalAfter += after;
  console.log(
    line(
      face,
      kind,
      formatBytes(before),
      formatBytes(after),
      `${(100 - (after / before) * 100).toFixed(0)}%`
    )
  );
}
console.log(rule);
console.log(
  line(
    'total',
    '',
    formatBytes(totalBefore),
    formatBytes(totalAfter),
    `${(100 - (totalAfter / totalBefore) * 100).toFixed(0)}%`
  )
);
console.log(`subset-fonts: wrote ${rows.length} faces to ${relative(root, outFonts)}/`);
