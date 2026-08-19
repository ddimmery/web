// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const fontsDir = './src/assets/fonts';

export default defineConfig({
  site: 'https://ddimmery.com',
  output: 'static',

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
      rehypePlugins: [[rehypeKatex, { output: 'htmlAndMathml', strict: false }]],
    }),
    syntaxHighlight: 'shiki',
    shikiConfig: {
      // Dual themes. `defaultColor: false` makes Shiki emit --shiki-light /
      // --shiki-dark custom properties instead of hard-coding one theme, so the
      // colour scheme is switched purely in CSS (see src/styles/code.css).
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
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
