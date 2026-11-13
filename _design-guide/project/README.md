IndaVillas runs the commercial side of 5+ bedroom luxury villas for their owners: pricing, channels, listings, content and reporting. The site sells to owners and investors who already own a valuable property and are judging whether we are serious. Everything here should read like a well-made property brochure: calm, exact, mostly photograph and whitespace, with the numbers set like they matter.

Three ideas carry the whole system:

1. **Limewash, teal, brass.** A lime-plaster ground, deep lagoon teal as the brand, brass as a thin accent. Nothing else.
2. **The floor-plan legend.** Short facts in small caps, split by hairlines (`SpecLine`), and figures set large with a brass rule above (`Figure`). This is how the brand looks specific instead of generic.
3. **Square architecture.** Photos and bands have no radius. Controls have 2px. Cards have 6px. Nothing is a pill.

## Voice and copy

Write like a revenue manager talking to an owner across a table: plain, specific, unhurried.

- Address the owner as "you" and the company as "we". "You keep the asset; we run the commercial side."
- Lead with the result and the property, then the method. "15 to 50% more villa revenue" beats "data-driven optimisation".
- Name real things: channels (Airbnb, Booking.com, Google Vacation Rentals), bedroom counts, the 90-day window, the actual price.
- House rules carried over from the live site: no em or en dashes; write ranges as "15 to 50%". No email address in the header.
- Banned words: seamless, cutting-edge, revolutionary, unlock, elevate, next-level, AI-powered, world-class, effortless.
- No exclamation marks, no emoji, no rhetorical questions in headlines.
- Sentence case everywhere except `spec-label`, which is set in caps by CSS, never typed in caps.
- CTAs say what happens: "Book a free analysis", "Start with Growth", "Get a custom quote". Never "Get started" or "Learn more".

**Numbers.** Show a number only with a source next to it (AirDNA market data, IndaVillas' own prices, a named villa's results with the owner's permission). No invented "500+ villas" style counters. No testimonials until there are real, named owners who agreed to be quoted.

## Color

Use the tokens, never hex values. Every text pair below holds 4.5:1 or better in both themes.

- Page ground is `limewash`. Text is `ink`, secondary copy `ink-soft`, captions and sources `ink-mute`.
- Raised surfaces (plan cards, form panels, the scrolled header) are `paper` with a 1px `line` border.
- `stone` gives one quiet section break when two `limewash` sections need separating. Use it at most once per page.
- `teal` is the brand: primary buttons (with `on-teal` text), links, the active state and the focus ring.
- `teal-deep` is the one dark band per page: the closing call to action, flowing into the footer. Text on it is `on-band` and `band-soft`.
- `teal-tint` marks the custom tier or a highlighted figure.
- `brass` is graphic only: the rule above a Figure, the underline under the current nav link and text links, plan list dashes, the mark on dark grounds. As text use `brass-ink`, and only for one small label.
- `alert` is for form errors, always with a written message.

Rough proportion on any page: 80% limewash and photography, 15% ink, 5% teal and brass. If a page looks colourful, it is wrong.

**Dark theme.** Ground becomes a deep lagoon black (`limewash` dark value), teal lifts to a pale sea-glass so it still reads as the brand, brass warms. Dark is supported for owners who browse at night; light is the default the site ships in.

## Typography

Two families, both shipped as files in `fonts/`.

- **Bodoni Moda** (`--font-display`) for headlines and figures. A high-contrast modern serif: the hairlines and vertical stress read as hospitality and property, the register of a sales brochure for a residence. Use its optical size axis (set in each style) so hairlines stay crisp at every size. Weight 400 for display, 500 only for `heading-2`. Never below 24px, never for body text.
- **Hanken Grotesk** (`--font-text`) for everything else. A plain, slightly warm grotesque that stays legible at 13px on a phone and sits quietly under the serif. 300 for `lead`, 400 body, 600 for labels and buttons.

Styles, in order of use: `display-xl` (one per page, the hero), `display-lg` (chapter openers and the band), `heading-1`, `heading-2`, `figure`, `lead`, `title`, `body`, `body-sm`, `button`, `spec-label`, `caption`.

- Running text max 68 characters per line; `lead` max 52.
- Headlines use `text-wrap: balance`.
- Prices and revenue use `figure` with lining, tabular numerals.
- `spec-label` is the only uppercase style, at 0.08em tracking. It mirrors the legend on a floor plan; it is never an eyebrow above a headline.
- On phones, step every display style down one: `display-xl` to `display-lg`, `display-lg` to `heading-1`.

## Layout and spacing

- Content width 1200px, text columns within it never wider than 68 characters.
- Side gutter `space-48` on desktop, `space-16` on phones.
- Section padding `space-96`; `space-128` before a chapter-opening `display-lg` headline and around full-bleed photography. Whitespace is the most expensive-looking thing we have.
- Compose asymmetrically: the hero is a 7/5 split, text sections often a 5/7 split with the headline in the narrow column. Avoid centred title + three equal cards as a default.
- Sibling spacing comes from `gap` with spacing tokens; nothing in between the steps.

## Imagery

Photography carries the brand. The rules:

- **Real villas only.** Shoot the villas we actually manage, in natural light, at golden hour or soft overcast. Wide, level, architectural framing; verticals straight.
- **No AI renders.** The current site leans on generated images (gears floating over a bedroom, a hologram graph on a table, staged people). Owners spot them instantly and they undercut every claim next to them. `assets/Imagery/avoid-ai-render.jpg` is the example to retire. Until a shoot is done, use fewer images, not fake ones.
- **People are optional and real.** Staff at work or a guest from behind is fine; never generated faces.
- Photos are square-cornered (`radius-0`) and either full content width or a clear half. No rounded image cards, no tilted collages, no frames.
- Captions in `caption`, `ink-mute`, naming the villa and area when the owner agrees.
- Before/after styling pairs (like the real bedroom shoot in `assets/Imagery/bedroom-real-photo.jpg`) are strong proof; show them side by side at equal size with a SpecLine of what changed.

## Iconography

Icons are rare. The brand speaks through photographs, numbers and the SpecLine, not icon grids.

- Where an icon is functional (menu, close, external link, WhatsApp), use Phosphor in the Regular weight at 20px, coloured with `currentColor` from `ink` or `teal`. This is the set the live site already ships.
- No decorative icon per feature, no sparkles, no check-mark lists (plan lists use a brass dash).
- No emoji anywhere.

## Logo

The mark is eight triangles forming the IndaVillas pattern, taken unchanged from the live site. Files in `assets/Logos/`: `indavillas-mark-teal.svg` on light grounds, `indavillas-mark-brass.svg` on `teal-deep` or dark grounds, `indavillas-mark-limewash.svg` on photographs. The wordmark is set in type: "Inda" in Hanken Grotesk 650, "Villas" in 400, 19px in the header. No outlined wordmark file exists yet.

## Shape, borders and depth

- Radius: `radius-0` photos and bands, `radius-sm` buttons and inputs, `radius-md` cards and dialogs, `radius-full` only for an 8px status dot.
- Borders before shadows: cards and panels separate with a 1px `line`. The single shadow, `shadow-float`, is for the scrolled header, menus and dialogs.
- No gradients, no glass blur, no glow, no background patterns.

## Motion

Quiet. One curve, `cubic-bezier(.22, 1, .36, 1)`; 300ms for colour and opacity, 500ms for position. Only `opacity` and `transform` animate.

- The hero photo fades in once on load. Sections do not fly up on scroll.
- Hover changes colour or underline, never size.
- The header fades to solid after 80px of scroll.
- Respect `prefers-reduced-motion`: everything is instant.

## States and accessibility

- Focus ring: 2px solid `teal`, 3px offset, on every interactive element, in both themes (7:1 or better on every ground).
- Tap targets 44px minimum; buttons are 48px.
- Forms show a written error under the field, in `alert`, linked with `aria-describedby`. A sending state disables the button and changes its label ("Sending").
- Every lead form shows a confirmation in place after submit, saying what happens next and when.

## Page pattern

A main page reads top to bottom as: Hero, a proof section with Figures and their source, the offer (services or plans), how the work runs (phases as a real sequence), one Band, footer. Sections earn their place; there is no FAQ unless it answers questions owners actually ask.
