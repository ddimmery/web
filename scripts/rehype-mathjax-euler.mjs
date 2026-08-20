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
  };
}

function replace({ parent, scope }, children) {
  const index = parent.children.indexOf(scope);
  if (index !== -1) parent.children.splice(index, 1, ...children);
}
