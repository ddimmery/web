import type { Post } from '../lib/posts';
import type { PaperData } from '../lib/papers';

/**
 * Shared prop shape for the interchangeable home-page layouts in this folder.
 * `src/pages/index.astro` does the data loading and hands the same props to
 * whichever variant is imported, so swapping layouts is a one-line change.
 */
export interface HomeProps {
  posts: Post[];
  papers: PaperData[];
}
