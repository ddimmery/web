import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/**
 * All posts, newest first. Drafts are visible while developing and dropped
 * from production builds (so they never reach the listings, RSS or sitemap).
 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? data.draft !== true : true,
  );
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function postUrl(post: Post): string {
  return `/posts/${post.id}/`;
}

export function slugifyCategory(category: string): string {
  return category
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface CategoryCount {
  name: string;
  slug: string;
  count: number;
}

/** Distinct categories across the given posts, most used first. */
export function categoriesOf(posts: Post[]): CategoryCount[] {
  const seen = new Map<string, CategoryCount>();
  for (const post of posts) {
    for (const name of post.data.categories) {
      const slug = slugifyCategory(name);
      const existing = seen.get(slug);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(slug, { name, slug, count: 1 });
      }
    }
  }
  return [...seen.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/* ---------- descriptions -------------------------------------------------
   Post descriptions are one-line frontmatter strings, but they are written in
   markdown (a few contain links or inline code). They appear in three places
   with different needs: as HTML in the post header and listing cards, and as
   plain text inside `<meta name="description">` / RSS. Rendering them through
   the full markdown pipeline would wrap them in a `<p>`, so this handles the
   small inline subset instead. */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render the inline markdown subset (links, code, emphasis) to HTML. */
export function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(
      /\[([^\]]+)\]\((https?:[^\s)]+)\)/g,
      (_m, label, href) => `<a href="${href}">${label}</a>`,
    )
    .replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`)
    .replace(/(^|[\s(])\*\*([^*]+)\*\*/g, (_m, pre, body) => `${pre}<strong>${body}</strong>`)
    .replace(/(^|[\s(])\*([^*]+)\*/g, (_m, pre, body) => `${pre}<em>${body}</em>`);
}

/** Strip the same inline markdown down to plain text, for meta tags. */
export function plainText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((?:https?:[^\s)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}

/**
 * Remove the footnote hover previews from rendered post HTML.
 *
 * scripts/rehype-footnote-popovers.mjs copies each footnote's content in beside
 * its reference marker so the site's CSS can show it on hover. That copy is
 * invisible without the site's stylesheet — which is exactly the situation in a
 * feed reader, where it would read as every footnote printed twice. The feed
 * therefore strips the copies back out and keeps the marker, its link and the
 * footnote apparatus at the end of the item.
 *
 * The scan is deliberately literal (find the opening tag the plugin emits, then
 * balance `<span>` tags to its close) rather than a regex, because a popover
 * nests spans several deep.
 */
export function stripFootnotePopovers(html: string): string {
  const open = '<span class="fn-pop" aria-hidden="true">';
  let out = '';
  let cursor = 0;

  for (;;) {
    const start = html.indexOf(open, cursor);
    if (start === -1) return out + html.slice(cursor);

    out += html.slice(cursor, start);

    // Walk forward from just inside the popover, tracking span nesting depth.
    let depth = 1;
    let at = start + open.length;
    while (depth > 0 && at < html.length) {
      const next = html.indexOf('<span', at);
      const close = html.indexOf('</span>', at);
      if (close === -1) return out + html.slice(start);
      if (next !== -1 && next < close) {
        depth += 1;
        at = next + '<span'.length;
      } else {
        depth -= 1;
        at = close + '</span>'.length;
      }
    }
    cursor = at;
  }
}
