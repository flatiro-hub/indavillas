# IndaVillas — static website

A complete rebuild of indavillas.com as plain static files. No WordPress, no build
step required to view or host it, no database. Upload by FTP and it runs.

---

## 1. What to upload

Upload **everything except `_build/` and `README.md`** to the web root
(usually `public_html/` or `httpdocs/`):

```
.htaccess              server config — see the warning in section 3
404.html
index.html             →  https://indavillas.com/
services/index.html    →  https://indavillas.com/services/
system/index.html      →  https://indavillas.com/system/
pricing/index.html     →  https://indavillas.com/pricing/
revenue-calculator/index.html  →  https://indavillas.com/revenue-calculator/
listing-audit/index.html       →  https://indavillas.com/listing-audit/
robots.txt
sitemap.xml
assets/css/site.css    one stylesheet for the whole site
assets/js/site.js      one script for the whole site
assets/img/            14 images, 2.4 MB total
```

The four original URLs are unchanged from the old site, so existing links and
search rankings carry over. The two /revenue-calculator/ and /listing-audit/ pages
are new — they are linked from the footer only, not the main navigation.

Upload `assets/` in **binary** mode (images) and the HTML/CSS/JS in ASCII or
automatic mode. Most FTP clients handle this automatically.

## 2. Important: paths are root-relative

Every link and asset starts with `/` — e.g. `/assets/css/site.css`. That means the
site must live at the **domain root**. Two consequences:

- Opening `index.html` by double-clicking it on your Mac will show unstyled text.
  That is expected. To preview locally, run a small web server from this folder:
  `python3 -m http.server 4330` and open <http://localhost:4330>.
- If you ever put the site in a subfolder (e.g. `/new/`), every `/assets/…` and
  `/services/` path needs the subfolder prefix.

## 3. The .htaccess file — read before uploading

`.htaccess` handles https redirects, trailing slashes, caching, compression and the
404 page.

**It replaces WordPress's `.htaccess`.** Once it is in place, WordPress no longer
serves this domain. Download and keep a copy of the existing `.htaccess` before you
overwrite it, so the old site can be restored if needed.

If you would rather keep WordPress running in parallel for now, upload everything
*except* `.htaccess` into a subfolder and test there first (see the subfolder note
in section 2).

## 4. The lead forms

All forms post to **FormSubmit** — the same service the old site used, same address:

```
https://formsubmit.co/ajax/hi.flatiro@gmail.com
```

Fields are unchanged: email (required), WhatsApp, property address, bedrooms, plus
the hidden `_subject`, `_template`, `_captcha` and `_honey` (spam honeypot) fields.
Each page sends a different `_subject` so you can tell in your inbox which page the
lead came from.

FormSubmit sends a **one-time confirmation email** the first time a form on a new
domain submits. Until you click the link in that email, leads are not delivered.
Submit the form once yourself after going live and confirm it.

To change the destination address, edit **one line** in `assets/js/site.js`:

```js
var LEAD_ENDPOINT = 'https://formsubmit.co/ajax/hi.flatiro@gmail.com';
```

## 5. Editing the site later

Two options.

**A. Edit the HTML directly.** Each page is a normal, readable HTML file. Change the
text, re-upload that one file. Note that the header, footer, forms and final CTA are
repeated in each page — change them in all four (plus `404.html`) so they stay
consistent.

**B. Use the builder (recommended for shared parts).** `_build/` holds the source:

```
_build/parts.sh         header, drawer, footer, lead form, final CTA  (shared)
_build/pages/home.sh    the body of each page
_build/pages/services.sh
_build/pages/system.sh
_build/pages/pricing.sh
_build/pages/revenue.sh
_build/pages/audit.sh
_build/build.sh         assembles all seven HTML files
```

Edit the source, then from this folder run:

```bash
bash _build/build.sh
```

and re-upload the regenerated HTML. `_build/` is never uploaded — it is only on
your Mac.

## 6. What changed from the old site

- **Navigation.** A real menu: fixed header with Home / Services / The System /
  Pricing, an email link and a "Free analysis" button. It is transparent over the
  hero and turns solid on scroll, marks the current page, collapses to a
  focus-trapped full-screen drawer on mobile (Esc closes it), and a sticky
  "Free revenue analysis" bar appears on phones once you scroll past the hero.
- **Footer.** Previously there was none. Now: brand, site map, service links,
  contact, platform strip, back-to-top.
- **Images are local.** The old pages hotlinked `indavillas.com/wp-content/…`,
  which would break the moment WordPress went away. All 14 images now live in
  `assets/img/`, re-compressed from 7.1 MB down to 2.4 MB.
- **One stylesheet, one script** instead of ~40 KB of CSS duplicated inside every
  page. Pages are 17–28 KB and the CSS/JS are cached across the whole site.
- **Accessibility.** Skip link, visible focus rings, labelled form fields, live
  regions on form success/error, `aria-current` on the active nav item, and full
  `prefers-reduced-motion` support.
- **SEO.** Per-page titles, descriptions, canonicals, Open Graph tags, a
  `ProfessionalService` schema block on the home page, `robots.txt` and
  `sitemap.xml`.
- **New content sections.** A "where to start" trio on the home page linking to the
  three inner pages, a proof-numbers bar, an owner-side section on Services, and a
  custom 404 page.
- **Unchanged:** all your copy, the pricing plans, the 20% guarantee, the earnings
  calculator maths (+15% / +50%), the rotating headline on Services, the 3-phase
  model, the YouTube background video (still lazy-loaded), and the forms.


## 7. The two free-tool pages

Both are adapted from Flatiro, English only, in the IndaVillas design.

**`/revenue-calculator/` — "Stop bleeding Airbnb revenue."**
A fully working calculator, all client-side, no backend. It uses Flatiro's exact
model, in USD:

```
annualGross = nightly rate x 365 x occupancy
feesNow     = annualGross x commission
feesAfter   = annualGross x (1 - directShare) x commission
processing  = annualGross x directShare x 2%
you keep    = feesNow - feesAfter - processing
```

Every input is a visible, adjustable control, because the honest answer depends on
numbers only the owner knows. The maths lives in section 7b of `assets/js/site.js`.

**`/listing-audit/` — "Audit your listing in 1 minute."**
Flatiro's real audit needs a backend (Apify scraper + the scoring engine), which
static FTP hosting cannot run. So this page captures the listing URL and the
owner's email through the same FormSubmit endpoint as every other form, with the
subject line **"New listing audit request - IndaVillas"**. You run the audit and
send the report back.

The page documents the real scorecard from Flatiro's engine — 16 checks across 6
categories weighted Reviews 25, Photos 20, Description 20, Booking 15, Title 10,
Amenities 10 — and the real grade bands (A at 90+, E below 34). If you later deploy
the Flatiro backend, this page is the natural place to wire the live flow into.


## 8. Asset cache-busting

`.htaccess` tells browsers to cache CSS and JS for a year, which is what you want
for speed — but it means a returning visitor would keep the old files after you
re-upload. So the build appends a timestamp to those two URLs:

```html
<link rel="stylesheet" href="/assets/css/site.css?v=202608260950">
<script src="/assets/js/site.js?v=202608260950" defer></script>
```

`bash _build/build.sh` regenerates that stamp automatically on every build. Nothing
to remember - just re-upload the HTML files along with the changed CSS or JS, and
every visitor picks up the new version immediately.

If you ever hand-edit `assets/css/site.css` without rebuilding, bump the `?v=`
number in the HTML by hand or the change will not reach returning visitors.

## 9. Hero parallax

Hero images drift at 12% of the scroll speed as you move down the page. The CSS
scales the image to 1.24 so it always has room to travel without an edge coming
into view, and the travel is capped at exactly that headroom.

It is applied by JavaScript, not CSS, and only when the visitor has **not** enabled
"reduce motion" in their operating system - those visitors get a completely static,
uncropped photo instead. The scroll handler writes once per animation frame, so it
does not fight the browser for the main thread.

Section 7c of `assets/js/site.js` holds the logic; the `DEPTH` constant at the top
of that block controls how pronounced the effect is.


## 10. The listing audit

`/listing-audit/` fetches the listing automatically and scores it on the spot.

**How it works.** The visitor pastes their Airbnb or Booking.com URL. The page
POSTs it to `api/audit.php`, which calls Apify server-side and returns the raw
listing data. The browser then normalises and scores it - `assets/js/audit.js` is
a faithful port of Flatiro's `lib/scrape.js` normaliser and `lib/score.js` scoring
engine, so the numbers are exactly what the real engine produces.

The visitor gets a score out of 100, a letter grade, a six-category breakdown of
every individual check, and each fix ranked by the points it would recover.

### Switching the automatic fetch on

The audit endpoint needs an Apify token:

1. Get a token at console.apify.com > Settings > API tokens.
2. Copy `api/config.sample.php` to `api/config.php`.
3. Paste the token into `APIFY_TOKEN`.
4. Upload `api/config.php` via FTP next to `api/audit.php`.

`config.php` is **not** in the upload zip on purpose - it holds a secret, so you
create it on the server. Until it exists the endpoint replies "not configured" and
the page offers manual entry instead, which still produces a full score.

Apify is a paid service and each audit is one actor run, so the token is worth
keeping to yourself rather than exposing anywhere in the page. It never reaches
the browser - only `api/audit.php` reads it.

### Manual mode

Behind the "No link handy? Enter the details by hand" link is the same scorer
driven by self-reported values. It is also what the page offers whenever the fetch
fails - a blocked request, a very new listing, or a missing token. Anything left
blank is dropped from the score and its weight redistributed, so a blank is never
counted against the host.

### Lead capture

Once the score renders, a follow-up block offers the revenue gap analysis. It posts
to the same FormSubmit address with the score and the listing URL attached as hidden
fields, so the lead email tells you what the listing scored before you reply.

Verified against the reference engine on four listings - three manual (22, 61, 100)
and one scraped payload (77/B+) - with every category and fix count identical.


## 11. The Foundation page (`/foundation/`)

The landing page for **Foundation**, the $290 one-time Airbnb revenue audit. Not
linked from the menu or footer, and not in `sitemap.xml` - share the URL directly.

**Before a report.** The hero works like flatiro.com/audit: paste an Airbnb or
Booking.com link and get a score in about a minute. The difference is that the
**WhatsApp number and email are required** to run it. Below the hero: what the free
snapshot includes, Free vs Foundation, how it works (plus what Foundation is not and
the 90-day guarantee), bonuses, FAQ, and a final CTA with the same three fields.

**After a report.** The snapshot shows the score, the six-category breakdown and the
**top 3 fixes only**. The remaining fixes sit blurred behind a lock, next to a
blurred "your villa vs comparable villas" teaser. The blurred numbers are random
decoys, re-rolled on every render, so they can never be read as real figures. Then the
page reveals the $290 package section and the "Unlock the full audit + 60-minute
live consult" bar. "What you get free" hides, and the final CTA, header, drawer and
phone dock switch from "free snapshot" to "Unlock Foundation".

Preview the after-report state without a scrape: `/foundation/?demo=1`.

**The scoring engine.** `assets/js/engine/` holds Flatiro's engine files
(`score.js`, `scrape.js`, `i18n.js`, `revenue.js`), copied unchanged from
`~/IndaVillas Review/lib/`, so a listing scores the same here as on flatiro.com/audit.
To pick up a later Flatiro change, copy those four files over again. Villa-specific
example wording and the no-dashes house style are applied in `foundation.js`, not
in the engine files. Note: `/listing-audit/` still uses the older port in
`assets/js/audit.js`, so its scores can differ.

**Leads.** Every snapshot attempt emails one lead to the FormSubmit address with
the subject **"New Foundation snapshot - IndaVillas"**. It includes the listing URL,
WhatsApp, email, score, top fixes, and whether the audit completed or failed. If the
visitor leaves before the audit finishes, the lead is sent then, without a score.

**Taking payment.** Set `CHECKOUT_URL` at the top of `assets/js/foundation.js` to a
Stripe Payment Link for $290 (Stripe > Payment links > + New), then rebuild. Until
it is set, every "Buy" / "Unlock" button opens a short order form instead. That form
emails **"Foundation order request ($290) - IndaVillas"** so you can send a payment
link by hand.

**Upload for this page:** `foundation/index.html`, `assets/js/foundation.js`,
`assets/js/engine/` (4 files), `assets/css/site.css`, `api/audit.php` (now also
resolves app share links such as abnb.me) and `api/config.php`. Re-upload the other
HTML files too, since the build re-stamps them.


## 12. The pricing page (`/pricing/`, rebuilt October 2026)

Replaces the old "from USD 500 per month" page. Two flat yearly plans, **Growth
($3,999)** and **Excellence (custom, quoted per villa; was $7,990 until 2026-11-03)**,
then: multi-property pricing
with a live quote, the $290 Revenue Gameplan band (its button goes to
`/foundation/`), four plan-by-plan feature tables, extras, a fee comparison against
a management company and DIY, "what other property managers don't do", FAQ, and a
free revenue audit form at the bottom (`#audit`).

**The multi-property quote** lives in section 7 of `assets/js/site.js`. Rule: the
highest-priced property pays its plan in full, every other property is 25% off
($2,999 Growth), and 6 or more properties show "partner pricing" instead of a
number. Excellence has no published price: its villas show "Custom quote", and as
the higher plan an Excellence villa is the full-price one, so every Growth villa
next to it is at $2,999. The quote starts at 2 villas on Growth ($6,998). Change
the Growth price in the `GROWTH` object there AND in the page copy
(`_build/pages/pricing.sh`).

**Leads.** The audit form posts to FormSubmit with the subject **"New revenue audit
request - IndaVillas (Pricing)"**: listing link, WhatsApp, email and the plan they
picked. Every "Start with..." button pre-selects its plan; "Price my properties"
also attaches the quote (e.g. "1 on Excellence (custom quote), 1 on Growth: $2,999
a year for Growth").

**Upload for this page:** `pricing/index.html`, `assets/css/site.css`,
`assets/js/site.js`, plus the other HTML files (the build re-stamps them and the
footer link "Revenue Gameplan" changed on every page). The previous version is kept
in `_build/pages/pricing-v1-2026-09.sh.bak` and `_build/pricing-v1-2026-09.html.bak`.


## 13. Foundation as an ads landing page (LP Fixes, 19 October 2026)

From the "LP Fixes" tab of "IndaVillas - Landing Page 10/2026 290$":

- **No site header or footer.** Nothing on the page leads elsewhere: a logo that is
  not a link, a phone dock that scrolls to the form, and a footer with only the
  copyright line (`foundation_footer` in `_build/pages/foundation.sh`).
- **Before a report** only the hero form and "What you get free" show. The package,
  the value table, how it works, the FAQ and the final call to action are
  `data-after` and appear once a snapshot renders.
- **WhatsApp numbers are validated per country** with libphonenumber-js (vendored in
  `assets/js/vendor/libphonenumber-max.js`, about 60 KB gzipped, loaded in the
  background). A number without `+country code` is read as Indonesian; a valid one is
  rewritten in international format before it goes into the lead email.
- **Value table**: what each part normally costs, $2,900 in total, against $290.
- **Removed**: the upgrade-credit box, every "credited if you upgrade" line, links to
  /pricing/, the "implement everything" FAQ, and the bonuses section (the video and
  images are no longer mentioned anywhere).
- **Guarantee**: a 90-day money-back seal (`fd_seal`), on a dark band and beside the
  package. A photo on each of the four steps and beside the package.

The previous version is kept in `_build/pages/foundation-v1-2026-10-12.sh.bak`,
`_build/foundation-v1-2026-10-12.js.bak` and `_build/foundation-v1-2026-10-12.html.bak`.
Still open: "make the calculation part more FOMO", waiting for the example files
(they are private Drive links).

**Payment (20 October 2026):** `CHECKOUT_URL` in `assets/js/foundation.js` is set to the Stripe
Payment Link https://buy.stripe.com/14A3cu7ph4L83Yh344gQE03 (US$290). Every "Unlock Foundation"
button goes straight there, with the email from the snapshot form pre-filled; the order-request
dialog is no longer used. What happens after payment (thank-you page, receipt, intake form) is set
on the payment link in Stripe.



## 14. The Revenue Snapshot with real AirDNA data (21 October 2026)

After a listing is scored, `/foundation/` now builds a full Revenue Snapshot, following
the example "indavillas-revenue-snapshot-example.html":
the market band, the listing score with its biggest gap, you vs the top 10%, amenities vs
the top 10%, the money gap with a season countdown and the first buy button, what would
pay for itself (lights shown, figures locked), the locked comp audit and a before/after
room. The page then shows the package, the value table, how it works, "Why work with
us" (3 phases + the top-10% goal), the FAQ and the final buy button. Three buy buttons in all.

**Where the numbers come from.** `api/market.php` compares the villa with AirDNA listings
that have exactly the same number of bedrooms, nearest first (3, 5, 8, 12, 20, 40 km,
until there are at least 30), and returns only medians, the top-10% threshold and shares.
The data lives in `api/data/market-bali.php`, built from the AirDNA Bali master
(`~/STR/Bali/airdna-bali-master.csv`, every export merged, one row per listing): 12,247
entire homes updated in the 12 months to August 2026. The file starts with a PHP exit
line and its folder has a deny-all `.htaccess`, so it is never downloadable.

**Refreshing the data.** Update the master, then run

    cd ~/indavillas-v2 && python3 _build/market/build_market.py

and upload `api/data/market-bali.php`. Rupiah rows are converted at AirDNA's own rate
(17,285 IDR/USD, so they match AirDNA's USD exports inside one comp set); add
`--idr-rate 16500` to use the master's own USD columns instead. Another master file can be
passed as the first argument.

**What stays locked.** The villa's own revenue, ADR and occupancy are never shown, even
when the villa is in the data. They go into the lead email instead ("villa_in_airdna"),
with the market median and top-10% threshold, so you see them before the call.

**Upload:** `foundation/`, the whole `assets/` folder (two new photos:
`styling-before.jpg`, `styling-after.jpg`) and the whole `api/` folder (new: `market.php`
and `data/`).


## 15. Design system (3 November 2026)

Home, Services, The system and Pricing (plus the shared header, menu, forms and
footer) follow the `landing-page-design` skill (elayadesign/ai-design-skills).
The rules live in the header comment and section 1 of `assets/css/site.css`:

- **One typeface:** Poppins 400/500/600. No italics, nothing heavier than 600.
- **Named text styles** (`--heading-1` to `--caption-5`, plus Body 7 for lead
  paragraphs), all on Tailwind's type scale with their paired line heights. Use
  them as `font:var(--body-3)` in CSS or as the class `.body-3`. Headings switch
  style by width through `--t-display`, `--t-section`, `--t-block`, `--t-feature`.
- **Spacing** only from `--sp-25` (2px) to `--sp-900` (96px); **radii** only
  Tailwind's (`--rounded` 4px to `--rounded-3xl` 24px, `--rounded-full`). A shape
  inside another with a gap under 32px gets outer radius minus gap.
- **Flat backgrounds.** The one gradient is the hero heading's text (#000 to #666).
  No card has a border on one side only.
- **Motion:** one curve, `cubic-bezier(.22,1,.36,1)`; 500ms for movement, 300ms for
  colour. Only transform and opacity animate. Reduced motion swaps movement for fades.
- **Icons:** Phosphor only, inlined at build time by `_build/icons.sh`
  (`$(icon check 18)`; `$TICK`, `$ARR`, `$LOCK`, `$DONE` in parts.sh). To add one,
  copy its path from @phosphor-icons/core into the case list there.
- **Floating header** sized to its content; full height mobile menu whose links
  arrive 60ms apart; a floating sticky CTA on phones.
- **Tagline reveal:** each page has one large statement (`<p data-tagline>`) whose
  words turn from 30% to full colour as they scroll past 60% of the viewport
  (site.js section 9).
- **Copy:** no hyphens or dashes in visible text (ranges are written "15 to 50%"),
  sentence case for headings and buttons, one primary CTA in each hero.

**The Foundation ads page is not on this system.** `foundation/index.html` loads
`assets/css/foundation.css`, a frozen copy of the October stylesheet, and keeps its
October tick icon, so the live ad looks exactly as before. Edit Foundation styles
there, not in site.css. The free tool pages (`/revenue-calculator/`,
`/listing-audit/`) get the new header, footer and fonts; their own sections
(site.css 24 to 27) are unchanged and still use the older token names, which
section 1 keeps mapped onto the new scales.

**Upload after a design change:** every HTML page (header and footer are shared),
including `foundation/index.html`, which must go up together with `site.css` or
the live ad would pick up the new styles, plus the complete `assets/` folder.


## 16. Design v3: Home, Services, The system, Pricing (11 November 2026)

These four pages are no longer built by `_build/build.sh`. They come from
`_v3/build.py` (run `python3 _v3/build.py`), which wraps the page bodies in
`_v3/pages/*.html` with the shared head, header, menu, free analysis section and
footer, and writes `index.html`, `services/`, `system/` and `pricing/`.

- **Styles and behaviour:** `/v3/style.css` and `/v3/main.js`, shared by all four.
  Their `?v=` stamps are the files' modification times, so just rebuild after editing.
- **Look:** warm paper, lagoon green, one brass accent; Poppins headings, Hanken
  Grotesk text. GSAP + ScrollTrigger for motion, Lenis for smooth scrolling, and a
  Three.js lens on the homepage hero only. Everything works without them.
- **Pricing:** both plans are "Custom" (quoted per villa). The old multi property
  calculator is gone; extra villas are 25% off their quote, 6+ is partner pricing.
- **Page source to edit:** copy in `_v3/pages/`, shared parts and icons in
  `_v3/build.py`. Never hand edit the generated HTML. Never upload `_v3/`.
- **Still on the older design:** `/foundation/` (frozen on `foundation.css`),
  `/revenue-calculator/`, `/listing-audit/` and `404.html`, built by `_build/build.sh`.
- **Upload:** the four pages plus the `v3/` folder. Do not upload `assets/`: the
  older pages still use the live `assets/css/site.css`.

## 17. Design v4: Home, Services, The system, Pricing (11 November 2026)

Supersedes section 16 for these four pages. They now come from `_v4/build.py`
(run `python3 _v4/build.py`), which wraps `_v4/pages/*.html` with the shared head,
header, menu, free analysis section and footer and writes `index.html`,
`services/`, `system/` and `pricing/`. Running `_v3/build.py` again would put the
v3 pages back (that is the rollback).

- **Idea:** "Every night counts". Numbers carry the layout: numbered section marks,
  the pinned revenue gap that counts row by row, a 365 night grid, the method
  travelling sideways. Three section themes (`.s-lime`, `.s-lime2`, `.s-night`)
  swap colour tokens. Poppins headings, Hanken Grotesk text, one brass accent.
- **Styles and behaviour:** `/v4/style.css` and `/v4/main.js`; `?v=` stamps are the
  files' modification times, so just rebuild after editing.
- **Motion:** GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.13 as the only smooth scroll,
  Three.js r160 day to night lens on the homepage hero only (it drifts when idle,
  then rests and stops drawing). The Services headline word cycles once, then
  stops. With reduced motion: no smooth scroll, no pinning, no WebGL, the lit
  hero photo as a still, every number in its final state.
- **Photography:** generated with Runway (nano-banana-pro) for this design, no real
  property and no people; the footer says "Photography is illustrative". Masters
  in `_v4/raw/` (never upload).
- **Pricing tabs:** the open feature table is kept in the URL, e.g.
  `/pricing/?table=con`, so it can be linked.
- **Build extras:** curly apostrophes are set automatically in visible text;
  theme colour follows each page's hero.
- **Upload:** the four pages plus the `v4/` folder:
  `indavillas-v4-upload-2026-11-11.zip`. Do not upload `assets/` (older pages use
  the live `assets/css/site.css`), `_v4/`, `_v3/` or `v3/`.

### 17b. Round buttons, glass, earlier photos back (11 November 2026, same day)

- **Buttons:** pills again (the v3 feel) with a round arrow chip and a small lift on
  hover; tabs, chips and table ticks are round too. Photos keep square corners.
  The top bar is NOT rounded: it stays full width.
- **Glass (three places, never more than two on screen):** the top bar once you are
  past the hero (full width, frosted); the free analysis form, a frosted card over
  the villa photo; the homepage hint pill. Each falls back to a solid colour where
  `backdrop-filter` is missing.
- **Photos:** the earlier site photos now sit beside the Runway ones, copied and
  optimised into `v4/img/` (so `assets/` still never needs uploading):
  `cliff-*` (old hero-villa: Home closing section, Services row 01), `drone-*`
  (Home method, Growth), `inspection-*` (Home house section, inset), `photographer-*`
  (Services row 02), `terrace-*` (Services row 04, Pricing audit), `papers-*`
  (System phase 03), `styling-before/after-920` (System phase 01, a before/after
  slider; these two are REAL photos of a client bedroom). `*-p*.jpg` files are
  portrait crops for the Services frame (rows carry `data-frame`).
  Left out on purpose: why-standards (a generated face posing as a host), villa-living,
  villa-interior, diff-*, why-terms (renders with fake hologram UI), dashboard.png
  (it belongs to the listing audit), why-superhost.png (Flatiro brand).
- The footer now reads "Photography is illustrative, apart from the before and after
  styling."

### 17c. Free tools moved to v4, Instagram added (11 November 2026)

- `/revenue-calculator/` and `/listing-audit/` are now v4 pages, written by
  `_v4/build.py` from `_v4/pages/calculator.html` and `_v4/pages/audit.html`.
  `_build/build.sh` no longer builds them (it now writes only Foundation and 404).
- **Calculator:** the model is the hero (rate, occupancy, commission, share moved
  direct); the maths lives in `v4/main.js` (same formula as before). The static
  figures in the HTML are the defaults worked out in advance.
- **Listing audit:** the link scorer sits in the hero; manual mode, the result and the
  follow-up form appear below it. Scoring runs in `v4/audit.js`, a v4 copy of
  `assets/js/audit.js` with the same engine; only page hooks and message wording
  changed (no dash style hyphens, no unsourced numbers). It still posts to
  `/api/audit.php`, which must stay on the server.
- **Instagram** (@inda.villas): footer and mobile menu on every v4 page, the 404 footer,
  and `sameAs` in the structured data.
- Upload: `indavillas-v4-full-upload-2026-11-11.zip` (index.html, 404.html, services/,
  system/, pricing/, revenue-calculator/, listing-audit/, v4/). It replaces the earlier
  v4 zip, now marked STALE.

### 17d. Privacy policy and terms of use (11 November 2026)

- `/privacy/` and `/terms/`, built by `_v4/build.py` from `_v4/pages/privacy.html` and
  `_v4/pages/terms.html`. Linked from every v4 footer (Privacy, Terms), next to every
  v4 form's privacy note, from the 404 footer and from the Foundation footer.
- Written from what the site really does (checked 11 November 2026): forms go through
  FormSubmit to Gmail; the listing audit asks Apify for the public listing; Foundation
  checkout runs on Stripe with the email pre-filled; the calculator never sends data;
  Google Fonts and the cdnjs, unpkg and jsDelivr CDNs see visitor IPs; no analytics,
  no pixels, no cookies. If you add analytics or a Meta pixel, update the privacy page
  (sections 04 and 08) first.
- **Company details** live in `LEGAL` in `_v4/build.py`: PT. Flatiro Property Management,
  Jl. Kayu Tulang No.81, Canggu, Kec. Kuta Utara, Kabupaten Badung, Bali; governing law
  Indonesia. If a value is ever emptied, the pages show a highlighted placeholder, go
  noindex and the build warns. The same legal name and address are in the JSON-LD.
- The Terms quote the Foundation guarantee word for word; the Foundation page itself
  does not yet say how to claim it or how "your numbers" are measured.
- Upload: `indavillas-v4-full-upload-2026-11-11c.zip` (supersedes the earlier full zips).

### 17e. Pricing page: 6+ bedrooms, top 10% (12 November 2026)

All benchmarks on /pricing/ now cover only Bali villas with 6 or more bedrooms and compare
the median with the **top 10%** (90th percentile), not the top 25%.
Source: the full AirDNA Bali pull (`~/STR/Bali/Bali-master.csv`, trailing 12 months, USD,
pulled 31 October 2026). Population: entire home listings, 6+ bedrooms, available 271 to 365
nights, at least one booked night (866 listings). Recompute with `python3 -I _v4/benchmarks.py`.

| Bedrooms | Listings | Median | Top 10% | Gap |
|---|---|---|---|---|
| 6 | 457 | $47K | $104K | +$57K |
| 7 | 126 | $47K | $107K | +$60K |
| 8+ | 283 | $34K | $161K | +$127K |
| 6+ (headline) | 866 | $43K | $117K | +$74K |

- About 1 in 5 (19.5%) of these villas earn $90K a year or more (Excellence note).
- "Fee in context" now uses the 6 bedroom median ($47K, so 15 to 25% = $7,050 to $11,750).
- The "managed villas earn 25 to 36% more" line was removed from /pricing/: with 6+ bedrooms
  only 47 owner-run listings exist and the result flips by size (+39% at 6BR, -14% at 7BR,
  -24% at 8+), so the data does not support it. The home page still uses it and the old
  3 to 5 bedroom top 25% figures.
- Upload: `indavillas-v4-full-upload-2026-11-12.zip` (11c is now STALE).

### 17f. Blog (13 November 2026)

`/blog/` and nine articles, one per Instagram post planned for 11 to 30 November 2026.
Built by `python3 _v4/blog.py` from `_v4/blog/*.html` (JSON meta block + plain HTML body);
styles in `/v4/blog.css`, images in `/v4/img/blog/`. `python3 _v4/blog.py --og` also renders
missing share images (1200x630, needs Chrome). The script rewrites `sitemap.xml` (every
indexable page, real change dates), `llms.txt` and `blog/feed.xml` on every run.

| # | Instagram post | Article |
|---|---|---|
| 01 | 11 Nov, first photo | `/blog/airbnb-cover-photo-villa/` |
| 02 | 13 Nov, who does what | `/blog/villa-revenue-management-vs-full-management/` |
| 03 | 16 Nov, Bali villa numbers | `/blog/bali-villa-occupancy-revenue-5-bedroom/` (featured) |
| 04 | 18 Nov, the crease | `/blog/villa-arrival-checklist/` |
| 05 | 20 Nov, small things | `/blog/five-star-airbnb-reviews-villa/` |
| 06 | 23 Nov, reviews and revenue | `/blog/airbnb-rating-revenue-bali-villas/` |
| 07 | 25 Nov, guest at 2am | `/blog/after-hours-guest-messages-villa/` |
| 08 | 27 Nov, building a villa | `/blog/building-a-villa-in-bali-before-you-list/` |
| 09 | 30 Nov, five questions | `/blog/questions-to-ask-villa-management-company/` |

- **SEO and AI search rules** follow the open source skills AgriciDaniel/claude-seo and
  claude-blog, zubair-trabzada/geo-seo-claude and coreyhaines31/marketingskills, which defer
  to Google's guide ("optimising for generative AI is still SEO"): answer first lede, a
  "short version" box, sections that open with their point and can be quoted alone, sourced
  figures, captioned tables, all text in the HTML, and one JSON-LD graph per page
  (BlogPosting, Organization, WebSite, Blog, WebPage, BreadcrumbList). No FAQPage markup:
  Google retired FAQ rich results in May 2026, so the questions are visible text only.
- **Blog pages load no GSAP or Lenis.** `main.js` still runs the menu and the form.
- **Numbers.** Same population as the Instagram SOP: 2,910 whole home Airbnb listings, 5+
  bedrooms, 180+ days available, 1+ reserved day, AirDNA trailing 12 months to October 2026.
  New cuts made for the blog from that population (not on the SOP's approved list, so check
  them before reusing on Instagram): by bedroom count, by area (coordinate boxes), by rating
  band, by review count, by minimum stay. The pricing page uses a narrower group (6+
  bedrooms, 271+ days); article 03 says so.
- **Claims left out on purpose:** that guests are answered around the clock, and that owners
  keep the listing, reviews and data on leaving. Both were still unconfirmed for Instagram.
  Articles 07 and 09 give them as what a good manager offers, not as an IndaVillas promise.
- **Management fee range.** Two published guides (Own Property Abroad: 10 to 20%, average
  20% of gross; Global Investments: 18 to 25% of gross). The examples use 15 and 25%, the
  range already on /pricing/.
- **Author** is the organisation ("By IndaVillas"). A named person with a short bio would
  be stronger; add one in `sources_block()` and the BlogPosting `author` in `_v4/blog.py`.
- **Dates.** Every article is dated 13 November 2026. If the upload happens later, change
  `"date"` in each meta block to the real day and rebuild. Do not backdate.
- **Navigation.** "Blog" added to `NAV` in `_v4/build.py`, so it shows in the top bar, the
  mobile menu and the footer of every v4 page. Remove that tuple to take it out.
- **After upload:** submit `https://indavillas.com/sitemap.xml` in Google Search Console
  and Bing Webmaster Tools, and leave the "Search generative AI" setting in Search Console
  on "include". `robots.txt` already allows every crawler, AI search crawlers included.
- **Citation audit (same day).** Scored with the claude-blog `blog-geo` audit, then fixed:
  every section that states a figure now names AirDNA and the period (12 sections had not),
  the Airbnb Help Centre and fee guide pages are linked where they are cited, the three data
  articles carry a definitions block (`{{terms}}` in `_v4/blog.py`, checked against AirDNA's
  help pages), and "large villas" became "villas with 5 or more bedrooms". AirDNA's revenue
  potential means "if available all 365 days"; article 03 now says so. The plugin's script
  went from 55-69 to 62-74; it only recognises Markdown link and definition patterns, so it
  under-reads these HTML pages. Do not rewrite copy to chase it.
- Upload: `indavillas-v4-full-upload-2026-11-13b.zip` (everything in the 11-12 zip, plus
  `blog/`, `v4/blog.css`, `v4/img/blog/`, `sitemap.xml`, `llms.txt`). 11-12 and the first
  11-13 zip are now STALE.
