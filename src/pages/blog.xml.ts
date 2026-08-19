import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import mdxRenderer from '@astrojs/mdx/server.js';
import { render } from 'astro:content';
import { getPosts, plainText, postUrl } from '../lib/posts';
import { site } from '../lib/site';

/**
 * Feed lives at /blog.xml — the same path the old Quarto site used, so existing
 * subscribers keep working. Items carry the full rendered post body.
 */
export const GET: APIRoute = async (context) => {
  const posts = await getPosts();

  const container = await AstroContainer.create();
  container.addServerRenderer({ name: '@astrojs/mdx', renderer: mdxRenderer });

  const items = await Promise.all(
    posts.map(async (post) => {
      let content: string | undefined;
      try {
        const { Content } = await render(post);
        content = await container.renderToString(Content);
      } catch {
        // A post whose body cannot be rendered standalone still belongs in the
        // feed — fall back to the summary rather than failing the build.
        content = undefined;
      }
      return {
        title: post.data.title,
        description: post.data.description ? plainText(post.data.description) : '',
        pubDate: post.data.date,
        link: postUrl(post),
        categories: post.data.categories,
        content,
      };
    }),
  );

  return rss({
    title: site.title,
    description: site.description,
    site: context.site ?? site.url,
    trailingSlash: true,
    items,
    customData: '<language>en-us</language>',
  });
};
