/**
 * rehype plugin: render the math nodes emitted by `remark-math` with MathJax v4
 * in the Neo-Euler font, at build time, as inline SVG.
 *
 * Stock `rehype-mathjax` is pinned to mathjax-full v3, which has no font
 * packages and therefore no way to reach Neo-Euler, so this walks the tree
 * itself. Everything MathJax-specific lives in ./lib/mathjax-euler.mjs.
 *
 * Recognised nodes (the classes `mdast-util-math` puts on its hast output):
 *   <code class="language-math math-inline">      →  inline math
 *   <pre><code class="language-math math-display">  →  display math
 * A fenced ```math block also lands on the second form.
 */
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toText } from 'hast-util-to-text';
import { SKIP, visitParents } from 'unist-util-visit-parents';

import { texToSvg } from './lib/mathjax-euler.mjs';

const noClasses = [];

export default function rehypeMathjaxEuler() {
  return async function transform(tree, file) {
    /** @type {Array<{parent: any, scope: any, tex: string, display: boolean, node: any}>} */
    const jobs = [];

    visitParents(tree, 'element', (element, ancestors) => {
      const classes = Array.isArray(element.properties?.className)
        ? element.properties.className
        : noClasses;
      const languageMath = classes.includes('language-math');
      const mathDisplay = classes.includes('math-display');
      const mathInline = classes.includes('math-inline');
      if (!languageMath && !mathDisplay && !mathInline) return;

      let parent = ancestors[ancestors.length - 1];
      let scope = element;
      let display = mathDisplay;

      // Display math (and ```math fences) arrive wrapped in a <pre>; replace
      // the wrapper, not just the <code>.
      if (
        element.tagName === 'code' &&
        languageMath &&
        parent?.type === 'element' &&
        parent.tagName === 'pre'
      ) {
        scope = parent;
        parent = ancestors[ancestors.length - 2];
        display = true;
      }

      if (!parent) return;

      jobs.push({
        parent,
        scope,
        tex: toText(scope, { whitespace: 'pre' }),
        display,
        node: element,
      });

      return SKIP;
    });

    if (jobs.length === 0) return;

    // Sequential on purpose: MathJax keeps a single document and a global
    // glyph-id counter, so concurrent conversions would interleave.
    for (const job of jobs) {
      let html;
      try {
        html = await texToSvg(job.tex, job.display);
      } catch (error) {
        file.message('Could not render math with MathJax', {
          ancestors: [job.parent, job.node],
          cause: /** @type {Error} */ (error),
          place: job.node.position,
          ruleId: 'mathjax',
          source: 'rehype-mathjax-euler',
        });
        // Leave something legible on the page rather than a blank.
        replace(job, [
          {
            type: 'element',
            tagName: job.display ? 'pre' : 'code',
            properties: { className: ['math-error'], title: String(error) },
            children: [{ type: 'text', value: job.tex }],
          },
        ]);
        continue;
      }

      replace(job, fromHtmlIsomorphic(html, { fragment: true }).children);
    }

    nameMathOnlyLinks(tree);
  };
}

/**
 * Give an accessible name to any link whose visible label is *only* a formula.
 *
 * MathJax marks the rendered `<svg>` `aria-hidden` and puts the readable copy in
 * a visually hidden `<mjx-assistive-mml>` MathML subtree. Screen readers handle
 * that, but the accessible *name* computation for the enclosing `<a>` does not
 * reliably cross into MathML — axe-core reports such a link as having no
 * accessible text, and Lighthouse's `link-name` audit fails. (`website-refresh`
 * has one: `[$\text{Neo-Euler}$](…)`.)
 *
 * So: for every `<a>` that contains math, has no other visible text, and has no
 * name of its own already, copy the formula's plain-text rendering onto an
 * `aria-label`. Purely additive — nothing about the visual output changes.
 */
function nameMathOnlyLinks(tree) {
  visitParents(tree, 'element', (element) => {
    if (element.tagName !== 'a') return;
    const props = (element.properties ??= {});
    if (props.ariaLabel || props['aria-label'] || props.title) return;

    let hasMath = false;
    let textOutsideMath = '';
    for (const child of element.children ?? []) {
      if (child.type === 'element' && child.tagName === 'mjx-container') hasMath = true;
      else textOutsideMath += toText(child, { whitespace: 'normal' });
    }
    if (!hasMath || textOutsideMath.trim() !== '') return;

    const label = toText(element, { whitespace: 'normal' }).trim();
    if (label) props.ariaLabel = label;
  });
}

function replace({ parent, scope }, children) {
  const index = parent.children.indexOf(scope);
  if (index !== -1) parent.children.splice(index, 1, ...children);
}
