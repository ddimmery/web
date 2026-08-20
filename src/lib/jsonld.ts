/**
 * Structured data builders (schema.org / JSON-LD).
 *
 * Deliberately small. Three pages get a block, each one a single graph node with
 * only the properties a consumer can actually do something with:
 *
 *   * the landing page — `Person`, so search engines and social tools have a
 *     canonical identity for the site's owner, with `sameAs` pointing at the
 *     same profile links the social row renders (one list, in src/lib/site.ts);
 *   * post pages — `BlogPosting`, which is what carries a byline and a date into
 *     search results and reader apps;
 *   * /research/ — an `ItemList` of `ScholarlyArticle`, one entry per visible
 *     paper. One script tag for the whole page, not one per row.
 *
 * No `Organization`, no `BreadcrumbList`, no `WebSite`/`SearchAction`: the site
 * has no search endpoint and no logo it wants attributed, and speculative
 * markup is just bytes. Every builder returns a plain object; `undefined`
 * members are dropped by `JSON.stringify` in `JsonLd.astro`.
 */
import { site, socials } from './site';
import { authorNames, bestUrl, paperTitle, yearOf, type PaperData } from './papers';

/** Absolute URL for a root-relative path. `site.url` has no trailing slash. */
function absolute(path: string): string {
  return new URL(path, site.url).href;
}

/**
 * The site owner, as a reusable node. `mailto:` is dropped: `sameAs` is for
 * pages describing the same entity, and the affiliation is a bare `Organization`
 * rather than a nested graph — Hertie School is identified well enough by its
 * name and its own URL.
 */
export function personNode() {
  return {
    '@type': 'Person',
    name: site.author,
    url: absolute('/'),
    jobTitle: 'Professor of Data Science for the Common Good',
    affiliation: {
      '@type': 'Organization',
      name: 'Hertie School',
      url: 'https://www.hertie-school.org/en/',
    },
    sameAs: socials
      .map((social) => social.href)
      .filter((href) => !href.startsWith('mailto:')),
  };
}

/** Landing page. */
export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    ...personNode(),
    description: site.description,
    image: absolute(site.defaultImage),
  };
}

export interface BlogPostingInput {
  title: string;
  /** Plain text, not the markdown the frontmatter holds. */
  description?: string;
  url: string;
  datePublished: Date;
  dateModified?: Date;
  /** Root-relative path of the post's cover image, if it has one. */
  image?: string;
  categories?: string[];
}

/** Post pages. */
export function blogPostingJsonLd(post: BlogPostingInput) {
  const url = absolute(post.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url,
    // `mainEntityOfPage` is what says "this markup describes *this* page" rather
    // than an article that merely happens to be mentioned on it.
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: post.datePublished.toISOString(),
    // Only when the post actually declares an update — repeating the publication
    // date here would assert a revision that never happened.
    dateModified: post.dateModified?.toISOString(),
    image: post.image ? absolute(post.image) : undefined,
    keywords: post.categories?.length ? post.categories.join(', ') : undefined,
    author: personNode(),
    publisher: { '@type': 'Person', name: site.author, url: absolute('/') },
    isPartOf: {
      '@type': 'Blog',
      name: `${site.title} — Blog`,
      url: absolute('/blog/'),
    },
  };
}

/**
 * /research/. One `ItemList` holding a `ScholarlyArticle` per paper, in the
 * order the page renders them, so `position` matches what a reader sees.
 *
 * Authors are the flat name list (`authorNames`), not the display string: the
 * commas and "and" in the rendered byline are punctuation, not part of a name.
 * They are emitted as plain strings rather than `{ '@type': 'Person' }` objects
 * — `author` accepts `Text`, and with 33 papers averaging a dozen authors (the
 * Facebook/Instagram election-study papers carry thirty each) the object form
 * cost ~13 kB of `@type` boilerplate for no information. Truncating the lists
 * would have been the other way to shrink this, and it is the wrong one: an
 * author list is the substance of a citation, not decoration on it. This is the
 * one page on the site whose structured data is not tiny, and it is tiny per
 * paper.
 */
export function researchJsonLd(papers: PaperData[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Research — ${site.author}`,
    url: absolute('/research/'),
    numberOfItems: papers.length,
    itemListElement: papers.map((paper, index) => {
      const year = yearOf(paper);
      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'ScholarlyArticle',
          name: paperTitle(paper),
          url: bestUrl(paper),
          // Year only — papers.yaml records no finer granularity, and a
          // fabricated month would be worse than a coarse date.
          datePublished: year === 'Undated' ? undefined : year,
          author: authorNames(paper.authors),
          publication: paper.venue ?? undefined,
        },
      };
    }),
  };
}
