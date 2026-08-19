import type { CollectionEntry } from 'astro:content';

export type Paper = CollectionEntry<'papers'>;
export type PaperData = Paper['data'];

/** "a and b" / "a, b, and c" — matching the old Quarto site's readable_list. */
export function authorSegments(
  authors: string[],
): Array<{ text: string; me: boolean }> {
  const parts: Array<{ text: string; me: boolean }> = [];
  authors.forEach((author, index) => {
    if (index > 0) {
      if (authors.length < 3) {
        parts.push({ text: ' and ', me: false });
      } else if (index === authors.length - 1) {
        parts.push({ text: ', and ', me: false });
      } else {
        parts.push({ text: ', ', me: false });
      }
    }
    parts.push(
      author === 'me' ? { text: 'Drew Dimmery', me: true } : { text: author, me: false },
    );
  });
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
