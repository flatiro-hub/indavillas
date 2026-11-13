import os, sys
root = sys.argv[1] + "/project/components"
MARK = "/_blob/796235b20551ebe79bd8cb51e5d8b091"      # teal mark
MARK_DARKBG = "/_blob/625d17c53bcc9e37516703a82b1471cb"  # brass mark
HERO = "/_blob/7033309621f792711278daa8fd5a4858"

def doc(marker, title, body, extra_style=""):
    return f"""{marker}
<!doctype html>
<html>
<head><meta charset="utf-8"><title>{title}</title>
<style>html,body{{margin:0;background:var(--limewash)}}{extra_style}</style>
</head>
<body>
<div class="iv-root">
{body}
</div>
<script>
  /* Swap the logo file to the brass mark when the frame is in the dark theme (an img cannot inherit colour). */
  (function () {{
    function sync() {{
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.querySelectorAll('img[data-mark]').forEach(function (i) {{ i.src = dark ? '{MARK_DARKBG}' : '{MARK}'; }});
    }}
    sync();
    new MutationObserver(sync).observe(document.documentElement, {{ attributes: true, attributeFilter: ['data-theme'] }});
  }})();
</script>
</body>
</html>
"""

C = {}

C["Button"] = (doc('<!-- @dsCard group="Actions" height=120 subtitle="Primary, secondary, on a dark band" -->', "Button",
"""<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:24px">
  <a class="iv-btn iv-btn--primary" href="#analysis">Book a free analysis</a>
  <a class="iv-btn iv-btn--secondary" href="#plans">See the plans</a>
  <button class="iv-btn iv-btn--primary iv-btn--sm" type="button">Free analysis</button>
  <button class="iv-btn iv-btn--secondary" type="button" disabled>Sending</button>
</div>
<div class="iv-band" style="padding:24px;display:flex;flex-wrap:wrap;gap:16px">
  <a class="iv-btn iv-btn--band" href="#pricing">Compare Growth and Excellence</a>
</div>"""),
"""# Button

Use a button for the one action a section asks the owner to take; at most one primary button per screen.

**Variants**
- `iv-btn iv-btn--primary`: teal fill, `on-teal` text. The section's main action ("Book a free analysis", "Start with Growth").
- `iv-btn iv-btn--secondary`: transparent with a `line-strong` border, `ink` text. The quieter alternative beside a primary.
- `iv-btn iv-btn--band`: outline on `teal-deep`, for the closing band only.
- `iv-btn iv-btn--invert`: `on-band` fill with `teal-deep` text, the primary action inside the band.
- add `iv-btn--sm` for the header CTA (44px tall, still a full tap target).

**The consumer provides** an `<a href>` for navigation or a `<button type>` for form actions, and the label.

**Do**
- Write labels that name the result: "Book a free analysis", "Get a custom quote", "Start with Growth".
- Keep corners at `radius-sm` (2px). Square buttons match square photos.

**Don't**
- No arrows or icons as decoration, no pill shapes, no "Get started" or "Learn more".
- Never two primary buttons side by side.
""")

C["TextLink"] = (doc('<!-- @dsCard group="Actions" height=96 -->', "TextLink",
"""<p style="margin:0;padding:24px;max-width:60ch">Not sure which plan fits? <a class="iv-link" href="#pricing">See how Growth and Excellence differ</a>, or read <a class="iv-link" href="#system">the three phases of the system</a>.</p>"""),
"""# TextLink

Inline link inside running text: `teal`, 600 weight, a 1px `brass` underline that turns `teal` on hover.

The consumer provides a real `href`. Use it inside paragraphs and under figures ("See the data"). For a standalone action, use Button instead. Link text says where it goes; never "click here".
""")

C["Field"] = (doc('<!-- @dsCard group="Forms" height=300 subtitle="Default, error" -->', "Field",
"""<form style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;padding:24px" onsubmit="event.preventDefault()">
  <div class="iv-field">
    <label for="f-loc">Where is the villa?</label>
    <input id="f-loc" type="text" placeholder="Area or Airbnb link" autocomplete="off">
    <span class="iv-field__hint">An Airbnb link lets us pull the numbers for you.</span>
  </div>
  <div class="iv-field iv-field--error">
    <label for="f-wa">WhatsApp number</label>
    <input id="f-wa" type="tel" value="+62 812" aria-invalid="true" aria-describedby="f-wa-err">
    <span class="iv-field__hint" id="f-wa-err">This number is too short. Add the full number with country code.</span>
  </div>
  <div class="iv-field">
    <label for="f-br">Bedrooms</label>
    <select id="f-br"><option>5</option><option>6</option><option>7</option><option>8+</option></select>
  </div>
</form>"""),
"""# Field

A labelled input for the lead forms (free analysis, Foundation snapshot, custom quote).

**Structure:** `div.iv-field` > `label[for]` + `input` or `select` + `span.iv-field__hint`. Add `iv-field--error` and `aria-invalid="true"` on the input to show an error; the hint then holds the error message and is linked with `aria-describedby`.

**The consumer provides** a unique `id`, a label written as a question or a noun ("Where is the villa?", "WhatsApp number"), and validation.

**Rules**
- Labels sit above inputs and never disappear; placeholders are examples, not labels.
- Inputs are 52px tall, `paper` fill, `line-strong` border (3:1 in both themes), `radius-sm`.
- Error text says what is wrong and how to fix it. Colour alone never carries the error.
""")

C["SiteHeader"] = (doc('<!-- @dsCard group="Navigation" height=200 subtitle="Over content, then solid after scroll" -->', "SiteHeader",
f"""<header class="iv-header">
  <a class="iv-brand" href="#home" aria-label="IndaVillas home"><img data-mark src="{MARK}" alt=""><span><b>Inda</b>Villas</span></a>
  <nav class="iv-nav" aria-label="Primary">
    <a href="#home" aria-current="page">Home</a><a href="#services">Services</a><a href="#system">The system</a><a href="#pricing">Pricing</a>
  </nav>
  <a class="iv-btn iv-btn--primary iv-btn--sm" href="#analysis">Free analysis</a>
</header>
<div style="height:24px"></div>
<header class="iv-header iv-header--solid">
  <a class="iv-brand" href="#home" aria-label="IndaVillas home"><img data-mark src="{MARK}" alt=""><span><b>Inda</b>Villas</span></a>
  <nav class="iv-nav" aria-label="Primary (scrolled)">
    <a href="#home">Home</a><a href="#services">Services</a><a href="#system">The system</a><a href="#pricing" aria-current="page">Pricing</a>
  </nav>
  <a class="iv-btn iv-btn--primary iv-btn--sm" href="#analysis">Free analysis</a>
</header>""", ".iv-root{padding:24px 0}"),
"""# SiteHeader

The site's top bar: mark and wordmark left, four page links, one small primary CTA. It replaces the floating pill header.

**States**
- At the top of a page: transparent with a 1px `line` hairline under it, sitting on `limewash`.
- After 80px of scroll: `iv-header--solid`, `paper` fill and `shadow-float`. The change is a 300ms fade of background and shadow, nothing slides.
- The current page link is `ink` with a 1px `brass` underline (`aria-current="page"`).

**The consumer provides** the four real page links (Home, Services, The system, Pricing) and the CTA target. Free tools stay in the footer, not here.

**Mobile (under 768px):** links move into a full-screen drawer opened by a 44px menu button; the CTA stays visible in the bar. Side padding drops from `space-48` to `space-16`.

**Wordmark:** "Inda" at 650 weight and "Villas" at 400 in the text face, 19px, beside the mark at 30px wide. The mark file follows the theme: `indavillas-mark-teal.svg` on light grounds, `indavillas-mark-brass.svg` on dark ones.
""")

C["Hero"] = (doc('<!-- @dsCard group="Sections" height=760 width=1200 subtitle="Photo first, headline below" -->', "Hero",
f"""<section class="iv-hero" aria-labelledby="h-hero">
  <figure class="iv-hero__photo">
    <img src="{HERO}" alt="Cliff-top villa with an infinity pool above the ocean">
    <figcaption>Placeholder render. Replace with a real shoot of a villa IndaVillas manages.</figcaption>
  </figure>
  <div class="iv-hero__body">
    <h1 id="h-hero">Your villa, run like a business.</h1>
    <div class="iv-hero__side">
      <ul class="iv-spec" aria-label="Who this is for"><li>5+ bedroom villas</li><li>Owners, not operators</li><li>90 day plan</li></ul>
      <p>We help owners of 5+ bedroom luxury villas grow rental revenue within 90 days. You keep the asset; we run the commercial side.</p>
      <div class="iv-hero__actions">
        <a class="iv-btn iv-btn--primary" href="#analysis">Book a free analysis</a>
        <a class="iv-link" href="#pricing">See pricing</a>
      </div>
    </div>
  </div>
</section>"""),
"""# Hero

The opening of every main page: one full-width photograph, then the headline and lead set on `limewash` underneath it.

Text never sits on the photo. That keeps contrast exact in both themes and lets the villa be seen whole, the way a property brochure opens on its best picture.

**Layout:** photo at 16:7, `radius-0`, full content width. Below it a 7/5 grid: `display-xl` headline left, right column holds a SpecLine, the `lead` paragraph (`ink-soft`, max 52 characters), and one primary Button plus one TextLink. Mobile: photo at 4:3, then a single column, headline in `display-lg`.

**The consumer provides** one real photograph of a managed villa (landscape, at least 2000px wide, shot in natural light), its alt text, the headline, the lead and the CTA target.

**Motion:** the photo fades from 0 to 1 opacity over 500ms on load, nothing else moves. Content is readable before the photo arrives.

**Don't:** stack a gradient scrim, a rotating headline or a "trusted by" bar on the hero.
""")

C["SpecLine"] = (doc('<!-- @dsCard group="Content" height=150 subtitle="The identity motif" -->', "SpecLine",
"""<div style="display:grid;gap:24px;padding:24px">
  <ul class="iv-spec" aria-label="Growth plan includes"><li>Airbnb</li><li>Booking.com</li><li>Google Vacation Rentals</li></ul>
  <ul class="iv-spec" aria-label="Plan terms"><li>Setup included</li><li>Billed once a year</li><li>One flat yearly fee</li></ul>
</div>
<div class="iv-band" style="padding:24px"><ul class="iv-spec iv-spec--band" aria-label="Foundation"><li>Comp audit</li><li>60 minute consult</li><li>One time $290</li></ul></div>"""),
"""# SpecLine

A row of short facts in `spec-label` caps, split by 1px `line` hairlines, borrowed from the legend on an architect's floor plan. It is the system's identity motif: it appears in the hero, under plan names and in the closing band.

**The consumer provides** two to four facts, each two to four words, all true and checkable (channels, terms, bedroom counts). Wrap it in a `ul` with an `aria-label` that says what the facts describe.

**Rules**
- Facts only. No adjectives ("premium", "seamless"), no numbers without a source.
- Never above a headline as an eyebrow; it sits below or beside the thing it describes.
- On `teal-deep` use `iv-spec--band`.
""")

C["Figure"] = (doc('<!-- @dsCard group="Content" height=230 subtitle="Price and market numbers" -->', "Figure",
"""<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:32px;padding:24px">
  <div class="iv-figure"><span class="iv-figure__value">$50K</span><span class="iv-figure__label">Median, Bali 4 bedroom, per year</span></div>
  <div class="iv-figure"><span class="iv-figure__value">$71K</span><span class="iv-figure__label">Top 25%, Bali 4 bedroom, per year</span></div>
  <div class="iv-figure"><span class="iv-figure__value">$3,999<small>/ year</small></span><span class="iv-figure__label">Growth plan, setup included</span></div>
</div>
<p class="iv-source" style="margin:0;padding:0 24px 24px">Source: AirDNA market data, as published on indavillas.com/pricing.</p>"""),
"""# Figure

A number set large in the display face, with a 1px `brass` rule above and a `spec-label` underneath saying exactly what it measures.

**The consumer provides** the value, the label (what, where, per what period) and, under a group of figures, a `iv-source` caption naming the data source.

**Rules**
- Only real, sourced numbers: AirDNA market data, IndaVillas' own prices, results from a named villa with the owner's permission. If there is no source, show no number.
- Two to four figures in a row, never a strip of six "stats".
- Units in the label, not as decoration: "$50K" plus "Median, Bali 4 bedroom, per year".
""")

C["PlanCard"] = (doc('<!-- @dsCard group="Content" height=600 width=1000 subtitle="Growth and Excellence" -->', "PlanCard",
"""<div class="iv-plans">
  <article class="iv-plan" aria-labelledby="p-growth">
    <div><h3 id="p-growth">Growth</h3><p class="iv-plan__for">Entry plan for 5+ bedroom properties</p></div>
    <div class="iv-figure"><span class="iv-figure__value">$3,999<small>/ year</small></span><span class="iv-figure__label">Setup included, billed once a year</span></div>
    <ul>
      <li>Rate strategy and dynamic pricing</li>
      <li>Airbnb, Booking.com and Google Vacation Rentals</li>
      <li>Property brand and direct booking website</li>
      <li>Photo shoot with 100+ photos</li>
    </ul>
    <a class="iv-btn iv-btn--primary" href="#growth">Start with Growth</a>
  </article>
  <article class="iv-plan iv-plan--tint" aria-labelledby="p-exc">
    <div><h3 id="p-exc">Excellence</h3><p class="iv-plan__for">For properties earning $90K or more a year</p></div>
    <div class="iv-figure"><span class="iv-figure__value">Custom</span><span class="iv-figure__label">Quoted for your villa, setup included</span></div>
    <ul>
      <li>Everything in Growth</li>
      <li>Agoda, Expedia, Traveloka and Vrbo</li>
      <li>Social content, search, email and repeat guests</li>
    </ul>
    <a class="iv-btn iv-btn--secondary" href="#quote">Get a custom quote</a>
  </article>
</div>"""),
"""# PlanCard

One pricing plan: name, who it is for, the price as a Figure, what is included, one action.

**The consumer provides** the plan name (`heading-2`), a one-line "for" sentence, the price and its terms, three to five inclusions, and the CTA.

**Rules**
- Show the plans that exist: today that is Growth and Excellence, two cards side by side. Foundation ($290) lives on its own page, not as a third column.
- Differentiate by content, not badges: Excellence takes the `teal-tint` fill (`iv-plan--tint`) because it is the custom, higher tier. No "Most popular" pill.
- List markers are a 16px `brass` dash, not tick icons.
- Cards are `paper`, 1px `line` border, `radius-md`, `space-32` padding. They stack to one column under 768px.
""")

C["Band"] = (doc('<!-- @dsCard group="Sections" height=340 subtitle="The closing call to action" -->', "Band",
"""<section class="iv-band" aria-labelledby="b-cta">
  <ul class="iv-spec iv-spec--band" aria-label="What happens next"><li>Send the villa</li><li>We pull the market</li><li>You get the numbers</li></ul>
  <h2 id="b-cta">Discover how much your villa could earn.</h2>
  <p>Tell us where the villa is and we will send the numbers. No call needed to get them.</p>
  <div style="display:flex;flex-wrap:wrap;gap:16px"><a class="iv-btn iv-btn--invert" href="#analysis">Book a free analysis</a><a class="iv-btn iv-btn--band" href="#pricing">See pricing</a></div>
</section>"""),
"""# Band

The one `teal-deep` section per page, used for the closing call to action and continued by the footer. It is the page's only colour block, which is why it carries weight.

**The consumer provides** a SpecLine of the next steps, a `display-lg` headline (max 16 characters per line, balanced), one lead sentence in `band-soft`, and the actions.

**Rules**
- One band per page, at the end. Every other section sits on `limewash`, with `stone` for at most one quiet break.
- The primary button inside the band inverts: `on-band` fill with `teal-deep` text.
- Text on the band uses `on-band` and `band-soft` only.
""")

for name, (preview, readme) in C.items():
    os.makedirs(f"{root}/{name}", exist_ok=True)
    open(f"{root}/{name}/preview.html", "w").write(preview)
    open(f"{root}/{name}/README.md", "w").write(readme)
print("wrote", len(C))
