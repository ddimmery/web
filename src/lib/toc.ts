import type { MarkdownHeading } from 'astro';

export interface TocItem {
  slug: string;
  text: string;
  children?: TocItem[];
}

/** Nest h2/h3 (…up to maxDepth) into a tree, ignoring the h1 page title. */
export function nestHeadings(source: MarkdownHeading[], maxDepth = 3): TocItem[] {
  const root: Array<TocItem & { depth: number; children: TocItem[] }> = [];
  const stack: Array<TocItem & { depth: number; children: TocItem[] }> = [];
  for (const heading of source) {
    if (heading.depth < 2 || heading.depth > maxDepth) continue;
    const node = { ...heading, children: [] as TocItem[] };
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= node.depth) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1]!.children.push(node);
    }
    stack.push(node);
  }
  return root;
}

/**
 * Whether a set of headings is worth a table of contents at all — a one-item
 * outline is not worth the furniture. `TableOfContents` renders nothing when
 * this is false, so pages use it to decide whether to lay out a sidebar track
 * (and whether to ship the scroll-spy script).
 */
export function hasOutline(headings: MarkdownHeading[], maxDepth = 3): boolean {
  return nestHeadings(headings, maxDepth).length > 1;
}
