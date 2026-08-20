import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';
import { parse as parseYaml } from 'yaml';

/**
 * Blog posts. One directory per post so cover images and other assets can be
 * colocated next to the prose: src/content/blog/<slug>/index.mdx
 */
const blog = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: '**/*.{md,mdx}',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Trimmed so block scalars (`description: |`) do not carry a trailing newline
      // into meta tags and the RSS feed.
      description: z.string().trim().optional(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      categories: z.array(z.string()).default([]),
      /** Relative path to a colocated cover image, e.g. `./cover.png`. */
      image: image().optional(),
      draft: z.boolean().default(false),
      /** Set true to load the (self-hosted) MathJax stylesheet on this post only. */
      math: z.boolean().default(false),
    }),
});

/**
 * Publications. `src/data/papers.yaml` is machine-maintained by
 * `scripts/sync-papers.mjs`, so the on-disk YAML shape must not change:
 * a top-level map of slug -> entry.
 */
const papers = defineCollection({
  loader: file('./src/data/papers.yaml'),
  schema: z.object({
    title: z.string(),
    /** The literal string "me" stands in for Drew and is rendered bold. */
    authors: z.array(z.string()).default(['me']),
    year: z.union([z.number(), z.string()]).nullable().optional(),
    venue: z.string().nullable().optional(),
    preprint: z.string().nullable().optional(),
    published_url: z.string().nullable().optional(),
    github: z.string().nullable().optional(),
    data: z.string().nullable().optional(),
    pdf_url: z.string().nullable().optional(),
    visible: z.boolean().default(false),
    ssid: z.string().nullable().optional(),
  }),
});

/**
 * Software. `src/data/software.yaml` is a hand-maintained *list*; the file
 * loader needs an `id` per entry, so we add one from the title while leaving
 * the file format untouched. File order is meaningful (oldest first).
 */
const software = defineCollection({
  loader: file('./src/data/software.yaml', {
    parser: (text) => {
      const list = parseYaml(text) as Array<Record<string, unknown>>;
      return list.map((entry, index) => ({
        ...entry,
        id: String(entry.title ?? index),
        order: index,
      }));
    },
  }),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    /** Markdown. Rendered at build time. */
    description: z.string(),
    github: z.string().optional(),
    website: z.string().optional(),
    package: z.string().optional(),
  }),
});

/**
 * Teaching. Same shape as `software`: a hand-maintained *list* in
 * `src/data/teaching.yaml`, given an `id` from the title and an `order` from
 * its position so the file's order can be honoured on the page. Unlike
 * software, file order *is* display order (see the note in the YAML).
 */
const teaching = defineCollection({
  loader: file('./src/data/teaching.yaml', {
    parser: (text) => {
      const list = parseYaml(text) as Array<Record<string, unknown>>;
      return list.map((entry, index) => ({
        ...entry,
        id: String(entry.title ?? index),
        order: index,
      }));
    },
  }),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    /** Hertie course code, e.g. "GRAD-C24". */
    code: z.string(),
    /** Programme note, e.g. "Elective" or "Required course, MSc in …". */
    program: z.string(),
    /** Semesters the course has run / will run, in chronological order. */
    semesters: z.array(z.string()).default([]),
    /** Markdown. Rendered at build time. */
    description: z.string(),
    github: z.string().optional(),
    website: z.string().optional(),
  }),
});

export const collections = { blog, papers, software, teaching };
