<?xml version="1.0" encoding="utf-8"?>
<!--
  Human-readable rendering of /blog.xml.

  A feed URL pasted into a browser is otherwise either a wall of raw XML or, in
  Chromium, a download prompt — neither of which tells a visitor what they are
  looking at. Referenced from the feed itself via `<?xml-stylesheet?>` (see the
  `stylesheet` option in src/pages/blog.xml.ts), so the transform happens in the
  browser: readers never fetch it, and the bytes on the wire for a subscriber are
  unchanged.

  Deliberately self-contained and font-free. It loads no webfont, no stylesheet
  and no script — this document is served straight from public/ and is not part
  of the site's bundle, so nothing here can be kept in sync automatically. It
  therefore borrows only what cannot drift: the accent red, the neutral grounds,
  and the site's shapes (hairline rules, letterspaced uppercase labels,
  oldstyle-ish metadata), set in system fonts whose stacks approximate the real
  faces — a Palatino-first serif for reading, an Optima-first humanist sans for
  headings, matching src/styles/global.css's own fallback lists.

  The mark is the same artwork as src/assets/mark/t-flare-mark.svg, inlined.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" encoding="utf-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          <xsl:value-of select="/rss/channel/title" /> — RSS feed
        </title>
        <style>
          :root {
            --paper: #fcfcfd;
            --paper-raised: #f1f2f4;
            --ink: #1b1c1e;
            --ink-soft: #3e4145;
            --ink-muted: #5f6368;
            --rule: #e1e3e6;
            --accent: #ba0020;
            --serif: Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
            --sans: Optima, Candara, 'Gill Sans', 'Trebuchet MS', system-ui, sans-serif;
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --paper: #131416;
              --paper-raised: #1c1d20;
              --ink: #e9eaec;
              --ink-soft: #cfd2d6;
              --ink-muted: #969ba0;
              --rule: #2d2f33;
              --accent: #f2596d;
            }
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            padding: 3rem 1.25rem 5rem;
            background: var(--paper);
            color: var(--ink);
            font-family: var(--serif);
            font-size: 1.05rem;
            line-height: 1.6;
            -webkit-text-size-adjust: 100%;
          }

          .wrap { max-width: 44rem; margin-inline: auto; }

          .masthead {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            padding-bottom: 0.7rem;
            border-bottom: 2px solid var(--ink);
          }

          .mark { width: 2rem; height: 2rem; flex: none; color: var(--accent); }

          h1 {
            font-family: var(--sans);
            font-size: 1.6rem;
            line-height: 1.1;
            letter-spacing: -0.01em;
            margin: 0;
          }

          h1 a { color: inherit; text-decoration: none; }
          h1 a:hover { color: var(--accent); }

          .eyebrow {
            font-family: var(--sans);
            font-weight: 700;
            font-size: 0.74rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--ink-muted);
            margin: 0;
          }

          .explainer {
            margin: 1.6rem 0 0;
            padding: 1rem 1.15rem;
            background: var(--paper-raised);
            border: 1px solid var(--rule);
            border-left: 3px solid var(--accent);
            border-radius: 3px;
            font-size: 0.98rem;
          }

          .explainer p { margin: 0; }
          .explainer p + p { margin-top: 0.6em; }

          code {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 0.88em;
            padding: 0.1em 0.35em;
            background: var(--paper);
            border: 1px solid var(--rule);
            border-radius: 3px;
            overflow-wrap: break-word;
          }

          .items { list-style: none; margin: 2.6rem 0 0; padding: 0; }

          .items > li + li {
            margin-top: 1.4rem;
            padding-top: 1.4rem;
            border-top: 1px solid var(--rule);
          }

          .item__title {
            font-family: var(--sans);
            font-weight: 700;
            font-size: 1.2rem;
            line-height: 1.25;
            margin: 0;
          }

          .item__title a { color: var(--ink); text-decoration: none; }
          .item__title a:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 0.16em; }

          .item__date {
            font-family: var(--sans);
            font-size: 0.88rem;
            color: var(--ink-muted);
            margin: 0.2rem 0 0;
          }

          .item__description {
            margin: 0.45rem 0 0;
            color: var(--ink-soft);
            text-wrap: pretty;
          }

          footer {
            margin-top: 3.5rem;
            padding-top: 1rem;
            border-top: 1px solid var(--rule);
            font-family: var(--sans);
            font-size: 0.88rem;
            color: var(--ink-muted);
          }

          a { color: var(--accent); text-underline-offset: 0.16em; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <p class="eyebrow">RSS feed</p>
          <div class="masthead" style="margin-top:0.4rem">
            <svg class="mark" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M 32 6 L 40 6 C 50 6 58 17 58 32 C 58 47 50 58 40 58 L 32 58 Z M 38 12 L 40 12 C 46 14 46 24 46 32 C 46 40 46 50 40 52 L 38 52 Z" />
              <path fill-rule="evenodd" transform="translate(64 0) scale(-1 1)" d="M 32 6 L 40 6 C 50 6 58 17 58 32 C 58 47 50 58 40 58 L 32 58 Z M 38 12 L 40 12 C 46 14 46 24 46 32 C 46 40 46 50 40 52 L 38 52 Z" />
            </svg>
            <h1>
              <a href="{/rss/channel/link}">
                <xsl:value-of select="/rss/channel/title" />
              </a>
            </h1>
          </div>

          <div class="explainer">
            <p>
              <strong>This is an RSS feed.</strong> Copy the URL out of your address bar
              and paste it into a feed reader to get new posts as they are published —
              no account, no algorithm, no email address.
            </p>
            <p>
              <code>
                <xsl:choose>
                  <xsl:when test="/rss/channel/atom:link[@rel='self']/@href">
                    <xsl:value-of select="/rss/channel/atom:link[@rel='self']/@href" />
                  </xsl:when>
                  <xsl:otherwise>
                    <xsl:value-of select="concat(/rss/channel/link, 'blog.xml')" />
                  </xsl:otherwise>
                </xsl:choose>
              </code>
            </p>
          </div>

          <p class="eyebrow" style="margin-top:2.6rem">Recent items</p>
          <ul class="items">
            <xsl:for-each select="/rss/channel/item">
              <li>
                <p class="item__title">
                  <a href="{link}">
                    <xsl:value-of select="title" />
                  </a>
                </p>
                <p class="item__date">
                  <!-- RFC-822 pubDate, trimmed to "Day, DD Mon YYYY": the time of
                       day and the zone are noise on a reading list. -->
                  <xsl:value-of select="substring(pubDate, 1, 16)" />
                </p>
                <xsl:if test="description != ''">
                  <p class="item__description">
                    <xsl:value-of select="description" />
                  </p>
                </xsl:if>
              </li>
            </xsl:for-each>
          </ul>

          <footer>
            <a href="{/rss/channel/link}">
              <xsl:value-of select="/rss/channel/link" />
            </a>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
