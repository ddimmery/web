/**
 * Build-time MathJax v4 renderer, set in the Neo-Euler font.
 *
 * This is the server-side equivalent of the old Quarto site's client-side
 * MathJax config (quarto-website/includes.html): Gyre Pagella as the base
 * font, with the MathJax-Euler font extension layered on top so letters,
 * digits and the big operators come out as Neo-Euler.
 *
 * Two consumers share this module so their configuration can never drift:
 *   - scripts/rehype-mathjax-euler.mjs  (converts math nodes during the build)
 *   - scripts/vendor-mathjax.mjs        (dumps the matching stylesheet)
 *
 * Output is SVG with `fontCache: 'local'`, i.e. every equation carries its own
 * glyph outlines in a `<defs>` block. That makes each formula self-contained:
 * no webfont, no client-side JavaScript, nothing to preload. Only the ~6 kB
 * container stylesheet is shipped, and only to pages with `math: true`.
 */
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * The complete font Neo-Euler is layered on top of. Also the name the Euler
 * extension looks for when it decides which font class to extend.
 */
const baseFont = 'mathjax-pagella';

/**
 * Absolute path to the directory holding the @mathjax/* font packages.
 * MathJax's component loader needs real paths, not bare specifiers.
 */
const fontRoot = dirname(
  dirname(require.resolve('@mathjax/mathjax-euler-font-extension/svg.js')),
);

/** @type {Promise<any> | undefined} */
let pending;

/**
 * Boot MathJax once per process. `init()` installs a global, so it must not be
 * called twice; every caller awaits the same promise.
 */
async function boot() {
  const { init } = await import('mathjax');
  return init({
    loader: {
      paths: {
        font: fontRoot,
        'mathjax-pagella': '[font]/mathjax-pagella-font',
        'mathjax-euler-extension': '[font]/mathjax-euler-font-extension',
      },
      load: [
        'input/tex',
        'output/svg',
        // Emits a visually hidden MathML copy of each formula for screen
        // readers — the equivalent of KaTeX's `htmlAndMathml` output.
        'a11y/assistive-mml',
        '[mathjax-pagella]/svg',
        '[mathjax-euler-extension]/svg',
      ],
    },
    svg: {
      // 'local' keeps each equation's glyphs in its own <defs>, so a fragment
      // stays valid on its own. 'global' would need a shared <defs> element
      // injected into every page.
      fontCache: 'local',
      // Wide display equations scroll inside their own box instead of
      // widening the page.
      displayOverflow: 'scroll',
      // The Euler extension is an *extension*: it needs a complete base font
      // to fill in whatever Neo-Euler doesn't cover (radicals, arrows, ...).
      // Pagella is what the old site used, and the extension reads this key
      // to decide which font class to attach itself to.
      font: baseFont,
    },
    startup: {
      typeset: false,
      ready() {
        const MathJax = globalThis.MathJax;
        MathJax.startup.defaultReady();
        // The Euler extension's dynamically loaded ranges (greek, fraktur,
        // calligraphic) hard-code `output.fonts.generic.svg_ts.GenericFont`
        // as the font they attach to. Point that at Pagella so those ranges
        // land on the font actually in use. Same hack as the old
        // includes.html, transposed from CHTML to SVG output.
        const fonts = MathJax._.output.fonts;
        fonts.generic = {
          svg_ts: {
            GenericFont: fonts[baseFont].svg_ts.MathJaxPagellaFont,
          },
        };
      },
    },
  });
}

/** Resolve the shared, initialized MathJax instance. */
export function getMathJax() {
  pending ??= boot();
  return pending;
}

/**
 * Render one TeX string to a self-contained SVG fragment.
 *
 * @param {string} tex
 * @param {boolean} display  true for `$$…$$`, false for `$…$`
 * @returns {Promise<string>} HTML for an `<mjx-container>`
 */
export async function texToSvg(tex, display) {
  const MathJax = await getMathJax();
  // The promise form is required: Neo-Euler's greek/fraktur/calligraphic
  // ranges are loaded on demand, which makes the first use of them async.
  const node = await MathJax.tex2svgPromise(tex, { display });
  return MathJax.startup.adaptor.outerHTML(node);
}

/**
 * The CSS the SVG output and the assistive-MathML copy need. Generated from
 * the installed MathJax rather than hand-copied, so it tracks the version in
 * package.json.
 *
 * @returns {Promise<string>}
 */
export async function mathjaxStyles() {
  const MathJax = await getMathJax();
  // Typeset one inline and one display formula first: the stylesheet is built
  // from what the document has actually produced.
  await texToSvg('a \\ne 0', false);
  await texToSvg('\\sum_{i=1}^{n} x_i', true);
  const { document: doc, adaptor } = MathJax.startup;
  return adaptor.textContent(doc.outputJax.styleSheet(doc)).trim();
}
