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
