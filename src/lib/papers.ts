import type { CollectionEntry } from 'astro:content';

export type Paper = CollectionEntry<'papers'>;
export type PaperData = Paper['data'];

/**
 * Author names arrive from the Semantic Scholar sync and occasionally carry
 * stray HTML (e.g. a consortium name wrapped in `<strong>`). Astro escapes
 * markup in text nodes, so anything left in would render as visible tags.
 */
function cleanName(name: string): string {
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Titles come from `src/data/papers.yaml`, which is machine-written: long
 * titles arrive as folded scalars, so the on-disk text carries newlines and
 * run-on indentation. YAML folding normally turns those into single spaces, but
 * nothing guarantees it for every scalar style the sync script emits, and a
 * stray newline inside a title is invisible until it reaches the page. Collapse
 * all internal whitespace here, at the one place titles are read.
 */
export function paperTitle(paper: PaperData): string {
  return paper.title.replace(/\s+/g, ' ').trim();
}

export interface AuthorSegmentOptions {
  /** Truncate to this many names, followed by "et al." (used on teasers). */
  max?: number;
}

/** "a and b" / "a, b, and c" — matching the old Quarto site's readable_list. */
export function authorSegments(
  authors: string[],
  options: AuthorSegmentOptions = {},
): Array<{ text: string; me: boolean }> {
  const { max } = options;
  const truncated = typeof max === 'number' && authors.length > max;
  const shown = truncated ? authors.slice(0, max) : authors;
  const parts: Array<{ text: string; me: boolean }> = [];

  shown.forEach((author, index) => {
    if (index > 0) {
      if (truncated) {
        parts.push({ text: ', ', me: false });
      } else if (authors.length < 3) {
        parts.push({ text: ' and ', me: false });
      } else if (index === authors.length - 1) {
        parts.push({ text: ', and ', me: false });
      } else {
        parts.push({ text: ', ', me: false });
      }
    }
    parts.push(
      author === 'me'
        ? { text: 'Drew Dimmery', me: true }
        : { text: cleanName(author), me: false },
    );
  });

  if (truncated) parts.push({ text: ' et al.', me: false });
  return parts;
}

/** Best canonical link for a paper title. */
export function bestUrl(paper: PaperData): string | undefined {
  return paper.published_url ?? paper.preprint ?? paper.pdf_url ?? undefined;
}

export function isPublished(paper: PaperData): boolean {
  return Boolean(paper.published_url);
}

export function yearOf(paper: PaperData): string {
  return paper.year === null || paper.year === undefined ? 'Undated' : String(paper.year);
}

export interface YearGroup {
  year: string;
  papers: PaperData[];
}

/** Group papers by year, newest first; undated last. */
export function groupByYear(papers: PaperData[]): YearGroup[] {
  const groups = new Map<string, PaperData[]>();
  for (const paper of papers) {
    const year = yearOf(paper);
    const bucket = groups.get(year);
    if (bucket) bucket.push(paper);
    else groups.set(year, [paper]);
  }
  return [...groups.entries()]
    .map(([year, entries]) => ({ year, papers: entries }))
    .sort((a, b) => {
      if (a.year === 'Undated') return 1;
      if (b.year === 'Undated') return -1;
      return Number(b.year) - Number(a.year);
    });
}
