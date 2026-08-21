/**
 * rehype plugin: give every GFM footnote reference a hover/focus preview.
 *
 * For each `<sup><a data-footnote-ref>n</a></sup>` in the document, this copies
 * the matching footnote's rendered content in next to the marker:
 *
 *   <span class="fn-ref">
 *     <sup><a data-footnote-ref …>1</a></sup>
 *     <span class="fn-pop" aria-hidden="true"><span class="fn-pop-body">…</span></span>
 *   </span>
 *
 * The copy is inert markup revealed by CSS on `:hover` / `:focus-visible`
 * (see the "footnote previews" block in src/styles/prose.css) — no runtime JS.
 * The original marker keeps its href, id and link semantics, so clicking it
 * still jumps to the footnote apparatus at the end of the post, which keeps its
 * styling and its return links.
 *
 * Everything about the copy is designed to be invisible to assistive tech and
 * to the rest of the document:
 *
 *   - `aria-hidden="true"` on the wrapper: screen readers already reach the real
 *     footnote through the marker's link and come back via the ↩ backref, so
 *     announcing a second copy would only double up.
 *   - every `<a>` in the copy gets `tabindex="-1"`. Focusable elements inside an
 *     `aria-hidden` subtree are an a11y violation (axe: `aria-hidden-focus`),
 *     and the copy must not add tab stops. Pointer clicks still work, which is
 *     what the popover needs for links inside a footnote.
 *   - the ↩ backref is dropped: it points at the marker you are already on, and
 *     leaving it in would inflate the arrow count on the page.
 *   - every `id` in the copy is rewritten with a per-popover prefix, so the
 *     duplicated subtree cannot collide with the ids in the real footnote (or
 *     with MathJax's `<defs>` glyph ids). Same-document `href` / `xlink:href`
 *     fragments pointing at a rewritten id are repointed at the copy.
 *
 * The marker usually sits inside a `<p>`, i.e. in an inline context where only
 * phrasing content is valid — but a footnote may hold paragraphs, quotes, lists
 * or code blocks. So non-phrasing elements in the copy are renamed to `<span>`
 * and tagged `data-fn-tag="<original>"`; the stylesheet gives those spans the
 * display each original tag needs. Phrasing content (links, em/strong, code) and
 * the opaque math subtrees MathJax emits (`mjx-*`, `<svg>`, `<math>`) are copied
 * through untouched.
 *
 * Must run *after* rehype-mathjax-euler so footnotes containing math are copied
 * with their rendered SVG rather than with the raw `<code class="language-math">`.
 */
import { visitParents } from 'unist-util-visit-parents';

/**
 * Elements that are already valid inside a paragraph and can be copied as they
 * are. Anything else gets turned into a `<span data-fn-tag>`.
 */
const PHRASING = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'i',
  'img',
  'ins',
  'kbd',
  'mark',
  'picture',
  'q',
  'ruby',
  'rp',
  'rt',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
]);

/** Subtrees that are copied verbatim, children included. */
const OPAQUE = new Set(['svg', 'math']);

const isOpaque = (tagName) => OPAQUE.has(tagName) || tagName.startsWith('mjx-');

const hasProp = (properties, camel, dashed) =>
  properties != null && (camel in properties || dashed in properties);

const isFootnoteRef = (node) =>
  node.type === 'element' &&
  node.tagName === 'a' &&
  hasProp(node.properties, 'dataFootnoteRef', 'data-footnote-ref');

const isFootnoteBackref = (node) =>
  node.type === 'element' &&
  node.tagName === 'a' &&
  hasProp(node.properties, 'dataFootnoteBackref', 'data-footnote-backref');

const isFootnoteSection = (node) =>
  node.type === 'element' &&
  node.tagName === 'section' &&
  hasProp(node.properties, 'dataFootnotes', 'data-footnotes');

export default function rehypeFootnotePopovers() {
  return function transform(tree) {
    const definitions = collectDefinitions(tree);
    if (definitions.size === 0) return;

    /** @type {Array<{parent: any, sup: any, definition: any}>} */
    const jobs = [];

    visitParents(tree, 'element', (node, ancestors) => {
      if (node.tagName !== 'sup') return;
      // Refs inside the apparatus itself (a footnote citing another footnote)
      // are left alone: the whole apparatus is already on screen down there.
      if (ancestors.some(isFootnoteSection)) return;

      const ref = node.children.find(isFootnoteRef);
      if (!ref) return;

      const href = ref.properties?.href;
      if (typeof href !== 'string' || !href.startsWith('#')) return;

      const definition = definitions.get(decodeURIComponent(href.slice(1)));
      if (!definition) return;

      const parent = ancestors[ancestors.length - 1];
      if (!parent || !Array.isArray(parent.children)) return;

      jobs.push({ parent, sup: node, definition });
    });

    // Mutate only after the walk, so the copies we splice in are never walked.
    jobs.forEach(({ parent, sup, definition }, index) => {
      const body = prepareCopy(definition, `fnp${index + 1}-`);
      if (body.length === 0) return;

      const at = parent.children.indexOf(sup);
      if (at === -1) return;

      parent.children.splice(at, 1, {
        type: 'element',
        tagName: 'span',
        properties: { className: ['fn-ref'] },
        children: [
          sup,
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['fn-pop'], ariaHidden: 'true' },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['fn-pop-body'] },
                children: body,
              },
            ],
          },
        ],
      });
    });
  };
}

/** id -> the `<li>` holding that footnote's content. */
function collectDefinitions(tree) {
  const definitions = new Map();

  visitParents(tree, 'element', (node, ancestors) => {
    if (node.tagName !== 'li') return;
    if (!ancestors.some(isFootnoteSection)) return;
    const id = node.properties?.id;
    if (typeof id === 'string' && id !== '') definitions.set(id, node);
  });

  return definitions;
}

/**
 * Clone a footnote definition's children into something safe to drop into an
 * inline context: no backref, no ids of its own, no tab stops, no block tags.
 */
function prepareCopy(definition, prefix) {
  const children = structuredClone(definition.children ?? []).filter(
    (child) => !(child.type === 'element' && isFootnoteBackref(child)),
  );

  const idMap = new Map();
  for (const child of children) collectIds(child, prefix, idMap);
  for (const child of children) sanitize(child, idMap);

  return trimEdges(children);
}

function collectIds(node, prefix, idMap) {
  if (node.type !== 'element') return;
  const id = node.properties?.id;
  if (typeof id === 'string' && id !== '' && !idMap.has(id)) {
    idMap.set(id, prefix + id);
  }
  for (const child of node.children ?? []) collectIds(child, prefix, idMap);
}

function sanitize(node, idMap) {
  if (node.type !== 'element') return;

  const properties = (node.properties ??= {});

  // Rewrite this copy's own ids, and any same-document reference to them, so a
  // duplicated subtree (MathJax `<defs>` glyphs in particular) stays self-
  // contained instead of colliding with the original.
  if (typeof properties.id === 'string' && idMap.has(properties.id)) {
    properties.id = idMap.get(properties.id);
  }
  for (const key of ['href', 'xlinkHref', 'xlink:href']) {
    const value = properties[key];
    if (typeof value === 'string' && value.startsWith('#')) {
      const target = idMap.get(decodeURIComponent(value.slice(1)));
      if (target) properties[key] = `#${target}`;
    }
  }

  if (node.tagName === 'a') {
    // Inert for the keyboard and for the accessibility tree; still clickable.
    properties.tabIndex = -1;
    delete properties.ariaDescribedBy;
    delete properties['aria-describedby'];
  }

  if (isOpaque(node.tagName)) return;

  if (!PHRASING.has(node.tagName)) {
    properties['data-fn-tag'] = node.tagName;
    node.tagName = 'span';
  }

  const kept = [];
  for (const child of node.children ?? []) {
    if (child.type === 'element' && isFootnoteBackref(child)) continue;
    sanitize(child, idMap);
    kept.push(child);
  }
  node.children = kept;
}

/** Drop the whitespace-only text nodes left at the edges by markdown. */
function trimEdges(children) {
  const isBlank = (node) => node.type === 'text' && node.value.trim() === '';
  let start = 0;
  let end = children.length;
  while (start < end && isBlank(children[start])) start += 1;
  while (end > start && isBlank(children[end - 1])) end -= 1;
  return children.slice(start, end);
}
