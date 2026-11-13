# Hero

The opening of every main page: one full-width photograph, then the headline and lead set on `limewash` underneath it.

Text never sits on the photo. That keeps contrast exact in both themes and lets the villa be seen whole, the way a property brochure opens on its best picture.

**Layout:** photo at 16:7, `radius-0`, full content width. Below it a 7/5 grid: `display-xl` headline left, right column holds a SpecLine, the `lead` paragraph (`ink-soft`, max 52 characters), and one primary Button plus one TextLink. Mobile: photo at 4:3, then a single column, headline in `display-lg`.

**The consumer provides** one real photograph of a managed villa (landscape, at least 2000px wide, shot in natural light), its alt text, the headline, the lead and the CTA target.

**Motion:** the photo fades from 0 to 1 opacity over 500ms on load, nothing else moves. Content is readable before the photo arrives.

**Don't:** stack a gradient scrim, a rotating headline or a "trusted by" bar on the hero.
