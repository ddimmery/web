# Back to top — four parked variants

Four real, buildable answers to "how does a reader get back to the top of a long
page?" (`/research/`, the longer posts). **None of them is active.** Nothing in
`src/layouts/`, `src/components/` or `src/styles/` references this directory, so
the site builds and ships exactly as it did before — Astro's scoped `<style>`
blocks mean an unused component contributes zero CSS to the output too.

Each variant is one file, self-contained (markup + scoped styles + its own
scroll anchor), and each carries a full header comment explaining its reveal
mechanism, its fallback and its design intent. This file is the map; read the
component for the detail.

## Activating one

Exactly one line, plus its import.

### A · upper-left mark, B · bottom-right chip, D · scroll-progress mark

In `src/layouts/Base.astro`, add the import beside the others:

```astro
import BackToTopA from '../components/back-to-top/BackToTopA.astro';
```

and the element immediately after `<Header />`:

```astro
    <Header />
    <BackToTopA />
```

(Substitute `B` or `D`.) The include point matters only in that it should be
high in the `<body>`: the component emits the `<span id="top">` it links to, and
that span is absolutely positioned to the top of the initial containing block.

### C · TOC-integrated "Top" link

C *is* an outline entry, so it lives in the outline. In
`src/components/TableOfContents.astro`:

```astro
import BackToTopC from './back-to-top/BackToTopC.astro';
```

and as the first child of the **sidebar** branch's `<nav>`, above
`<span class="toc__label">`:

```astro
      <nav class={classes} aria-label={label}>
        <BackToTopC />
        <span class="toc__label">{label}</span>
```

Deliberately not added to the `mobile` `<details>` branch: a "Top" link you have
to open an accordion to reach is worse than no link.

## The four at a glance

| | where | reveal | fallback (no `animation-timeline: scroll()`) | JS |
|---|---|---|---|---|
| **A** | 28px mark on the masthead's own column, top-left, **≥70rem only** | `scroll(root block)`, `animation-range: 70vh 100vh` | 216 B feature-gated `scrollY` class toggle — "always visible" would collide with the real masthead mark | 216 B |
| **B** | 2.6rem chip, bottom-right, all widths | same | always visible | 0 |
| **C** | "↑ Top" at the head of the sticky sidebar outline, **≥70rem only** | same | always visible | 0 |
| **D** | mark in a progress ring, bottom-right, all widths | same, plus a second full-range animation driving the ring | none — `display: none` outside the `@supports` block | 0 |

## What testing turned up

All four were activated in turn, built, and driven in Chromium at 1440 / 1024 /
390 in both themes. Everything below is measured, not assumed.

**Reveal.** All four compute to `opacity: 0; visibility: hidden` at `scrollY:
0` and to `opacity: 1` past one screenful. **Clicking each one lands at
`scrollY === 0`** on `/research/` and on `/posts/what-was-us2020/`.

**A is gated to ≥70rem because it has to be.** Below that breakpoint both page
shells collapse to a single column, the left margin the mark lives in
disappears, and the fixed mark lands on running text — first caught at 390 on
`/research/`, sitting over an author list, and again over a post's opening
figure. The margin *is* the idea, so the variant switches itself off where there
is no margin. That makes A a desktop-only answer, exactly like C, and it wants
the same mobile partner.

**Overlap, control box against page content, scanned the length of both pages:**

| | 1440 | 1024 | 390 |
|---|---|---|---|
| **A** | the sidebar label's *box* only (see below) | clear (variant off) | clear (variant off) |
| **B** | clear | overlays the paper list on `/research/` | overlays running text on both pages |
| **C** | clear | clear | clear (variant off) |
| **D** | clear | overlays the paper list on `/research/` | overlays running text on both pages |

A's one hit at 1440 is its hit area reaching across the box of the outline's
"Contents" / "On this page" label. No *ink* overlaps — the drawn mark clears the
label's text by ~45px, and the label is not interactive — so nothing is
obscured and no click is stolen.

B's and D's hits are the ordinary price of bottom-right chrome: below ~1024 the
content column reaches the right gutter, so an opaque raised chip sits on top of
a few words. It reads as a layer rather than a collision, and it is what every
reader already expects there. C never overlaps anything, because it is not a
layer at all.

**Footnote previews.** The previews open *above* their marker inside the prose
column. Measured rects are disjoint from every variant's control at every width
tested; the bottom-right chips clear them by hundreds of pixels.

## Two build gotchas worth knowing

Both cost a round of debugging, and both fail *silently* — the page looks
plausible and the behaviour is just gone. Anyone editing these files should
keep them in mind.

1. **Never write the `animation` shorthand next to `animation-timeline`.** The
   CSS minifier folds the timeline into the shorthand — `animation: linear both
   btt-a-in scroll(root)` — and `animation-timeline` is not a component of that
   shorthand, so Chromium drops the entire declaration. `animation-name`
   computes to `none`, the reveal never runs, and the control is simply always
   visible. All four variants use longhands only.
2. **`<Mark />` needs `:global`, and only in a single compound selector.** Astro
   does not stamp a component's `data-astro-cid-*` onto a *child* component's
   root element, so a scoped `.btt-a__mark { … }` matches nothing and the mark
   renders at its intrinsic 16px in the anchor's inherited link colour — red and
   small enough to look intentional. And `:global` in descendant position
   (`.btt-a__link:hover :global(.btt-a__mark)`) comes out of the minifier as a
   bare `.btt-a__mark`, applying the hover state permanently. A and D therefore
   pass the mark's colour and scale in as custom properties set on the link.

All four use the site's existing `html { scroll-behavior: smooth }`, which is
already switched off under `prefers-reduced-motion`, so none of them ships
scroll-animation code of its own.

A, B and D link to `#top` (a zero-size `<span>` each component emits, pinned to
the top of the initial containing block). C links to `#` — the plain
"top of document" fragment — because the sidebar outline is `position: sticky`,
which makes it a containing block for absolutely positioned descendants, so a
span emitted from inside it cannot be pinned to the page's top. Both were
verified to land at `scrollY === 0` in Chromium.

## Reveal mechanism, in one place

```css
@supports (animation-timeline: scroll()) {
  .btt-x {
    animation: btt-x-in linear both;
    animation-timeline: scroll(root block);
    animation-range: 70vh 100vh;
  }
}
@keyframes btt-x-in {
  from { opacity: 0; visibility: hidden; }
  to   { opacity: 1; visibility: visible; }
}
```

`scroll(root block)` is the document's own scroll progress; `animation-range`
takes absolute lengths along it, so `70vh 100vh` means "fade in across the
second screenful". `animation-fill-mode: both` is what holds the hidden state
*before* the range and the visible state *after* it — without it the control
would only be visible inside the 30vh window. Animating `visibility` alongside
`opacity` keeps the control non-interactive while invisible.

Supported in Chromium 115+ and Safari 26+. Firefox has no support at time of
writing, which is what the fallback column above is about.

## Pairing

C and B are complementary rather than competing, and they do not overlap in
range: C exists only where a sidebar does (≥70rem, posts with an outline and
`/research/`), B everywhere. **C on desktop + B below 70rem** gives the quietest
desktop page the site can have while still answering the question on a phone,
where the scroll distances are longest and the need is greatest — and it is the
one pairing where nothing ever floats over text on a wide screen.

A pairs the same way and for the same reason (**A on desktop + B below 70rem**),
and is the choice if the mark is wanted as the gesture rather than an arrow. The
two desktop halves are mutually exclusive: A and C both sit in the left margin
within about 40px of each other, so shipping both would put two "top" controls
in one small patch of the page.

Running any of the four alone is also perfectly reasonable — B alone is the only
single component that covers every page at every width.
