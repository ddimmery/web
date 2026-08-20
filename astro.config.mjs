// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeMathjaxEuler from './scripts/rehype-mathjax-euler.mjs';

// The Fonts API is pointed at the *generated* subsets, not the pristine
// originals next to them. scripts/subset-fonts.mjs derives the character set
// from the site's own content and rewrites every face into this directory
// before `astro build` / `astro dev` runs (see package.json scripts), so the
// files always exist and always match the current content. The directory is
// gitignored; src/assets/fonts/*.woff2 are the untouched upstream binaries.
// `SUBSET_FONTS=0` makes the script copy the originals over instead.
const fontsDir = './src/assets/fonts/generated';

export default defineConfig({
  site: 'https://ddimmery.com',
  output: 'static',

  build: {
    // The whole site's CSS is ~19 kB uncompressed / ~4 kB brotli, and it was
    // the only render-blocking resource left on the page. Inlining it trades a
    // few compressed kB per document for zero blocking round-trips, which is
    // the better deal on a static host: Lighthouse measured 150 ms off FCP on
    // post pages, 60 ms on the landing page.
    inlineStylesheets: 'always',
  },

  integrations: [
    mdx(),
    sitemap({
      // Draft posts are never emitted as routes in a production build, so the
      // sitemap only ever sees published pages. 404 has no business in a sitemap.
      filter: (page) => !page.endsWith('/404/'),
    }),
  ],

  image: {
    // sharp is the default service; named explicitly so the dependency is obvious.
    service: { entrypoint: 'astro/assets/services/sharp' },
  },

  markdown: {
    // IMPORTANT: Astro 7 ships Sätteri as the default markdown processor, and
    // Sätteri does NOT run remark/rehype plugins. Math support therefore requires
    // opting back into the legacy unified pipeline from `@astrojs/markdown-remark`.
    processor: unified({
      gfm: true,
      smartypants: true,
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeMathjaxEuler],
    }),
    syntaxHighlight: 'shiki',
    shikiConfig: {
      // Dual themes. `defaultColor: false` makes Shiki emit --shiki-light /
      // --shiki-dark custom properties instead of hard-coding one theme, so the
      // color scheme is switched purely in CSS (see src/styles/code.css).
      //
      // The *-high-contrast variants, not plain github-light/dark-dimmed: the
      // site sets its own warm code surface rather than the theme's, and
      // against that surface github-light's orange (#e36209, 3.04:1), red
      // (#d73a49, 3.98:1) and comment gray (#6a737d, 4.19:1) all failed WCAG
      // AA. Every token in the high-contrast pair clears 4.5:1 on this site's
      // surfaces (see --code-surface in src/styles/code.css).
      themes: {
        light: 'github-light-high-contrast',
        dark: 'github-dark-high-contrast',
      },
      defaultColor: false,
      wrap: true,
    },
  },

  fonts: [
    {
      name: 'Domitian',
      cssVariable: '--font-body',
      provider: fontProviders.local(),
      fallbacks: ['Palatino', 'Palatino Linotype', 'Georgia', 'serif'],
      options: {
        variants: [
          {
            src: [`${fontsDir}/Domitian-Roman.woff2`],
            weight: 400,
            style: 'normal',
            display: 'swap',
          },
          {
            src: [`${fontsDir}/Domitian-Italic.woff2`],
            weight: 400,
            style: 'italic',
            display: 'swap',
          },
          {
            src: [`${fontsDir}/Domitian-Bold.woff2`],
            weight: 700,
            style: 'normal',
            display: 'swap',
          },
          {
            src: [`${fontsDir}/Domitian-BoldItalic.woff2`],
            weight: 700,
            style: 'italic',
            display: 'swap',
          },
        ],
      },
    },
    {
      name: 'URW Classico',
      cssVariable: '--font-heading',
      provider: fontProviders.local(),
      fallbacks: ['Optima', 'Candara', 'Gill Sans', 'sans-serif'],
      options: {
        variants: [
          {
            src: [`${fontsDir}/URWClassico-Reg.woff2`],
            weight: 400,
            style: 'normal',
            display: 'swap',
          },
          {
            src: [`${fontsDir}/URWClassico-Ita.woff2`],
            weight: 400,
            style: 'italic',
            display: 'swap',
          },
          {
            src: [`${fontsDir}/URWClassico-Bol.woff2`],
            weight: 700,
            style: 'normal',
            display: 'swap',
          },
          {
            // The old Quarto site shipped this file but never registered it.
            src: [`${fontsDir}/URWClassico-BolIta.woff2`],
            weight: 700,
            style: 'italic',
            display: 'swap',
          },
        ],
      },
    },
    {
      name: 'Monaspace Argon',
      cssVariable: '--font-mono',
      provider: fontProviders.local(),
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      options: {
        variants: [
          {
            src: [`${fontsDir}/MonaspaceArgon-Variable.woff2`],
            weight: '200 800',
            style: 'normal',
            display: 'swap',
          },
        ],
      },
    },
  ],
});
