import type { IconName } from './icons';

export const site = {
  title: 'Drew Dimmery',
  description: 'Methods in Causal Inference, Data Science and Social Science',
  url: 'https://ddimmery.com',
  author: 'Drew Dimmery',
  twitter: '@drewdim',
  defaultImage: '/social-card.jpg',
  feed: '/blog.xml',
  repo: 'https://github.com/ddimmery/web',
  newsletter: 'https://list.ddimmery.com/subscription/form',
} as const;

/* Home is deliberately absent: the mark/wordmark in the masthead is the home
   link, which is what a visitor already expects it to be. Dropping the label
   is what lets the whole masthead — identity, sections, theme control — hold a
   single line on a phone. */
export const nav: Array<{ href: string; label: string }> = [
  { href: '/research/', label: 'Research' },
  { href: '/teaching/', label: 'Teaching' },
  { href: '/software/', label: 'Software' },
  { href: '/blog/', label: 'Blog' },
];

export const socials: Array<{ href: string; icon: IconName; label: string }> = [
  { href: 'https://twitter.com/DrewDim', icon: 'twitter', label: 'Twitter' },
  { href: 'https://bsky.app/profile/ddimmery.com', icon: 'bluesky', label: 'Bluesky' },
  { href: 'https://github.com/ddimmery', icon: 'github', label: 'GitHub' },
  { href: 'https://www.linkedin.com/in/drew-dimmery/', icon: 'linkedin', label: 'LinkedIn' },
  {
    href: 'https://scholar.google.com/citations?user=qMfnm48AAAAJ',
    icon: 'scholar',
    label: 'Google Scholar',
  },
  { href: 'https://arxiv.org/a/dimmery_d_1.html', icon: 'arxiv', label: 'arXiv' },
  { href: 'mailto:web@ddimmery.com', icon: 'email', label: 'Email' },
];
