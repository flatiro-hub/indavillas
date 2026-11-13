# SiteHeader

The site's top bar: mark and wordmark left, four page links, one small primary CTA. It replaces the floating pill header.

**States**
- At the top of a page: transparent with a 1px `line` hairline under it, sitting on `limewash`.
- After 80px of scroll: `iv-header--solid`, `paper` fill and `shadow-float`. The change is a 300ms fade of background and shadow, nothing slides.
- The current page link is `ink` with a 1px `brass` underline (`aria-current="page"`).

**The consumer provides** the four real page links (Home, Services, The system, Pricing) and the CTA target. Free tools stay in the footer, not here.

**Mobile (under 768px):** links move into a full-screen drawer opened by a 44px menu button; the CTA stays visible in the bar. Side padding drops from `space-48` to `space-16`.

**Wordmark:** "Inda" at 650 weight and "Villas" at 400 in the text face, 19px, beside the mark at 30px wide. The mark file follows the theme: `indavillas-mark-teal.svg` on light grounds, `indavillas-mark-brass.svg` on dark ones.
