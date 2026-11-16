"""Builds the four main pages of indavillas.com (design v4, November 2026).

    python3 _v4/build.py        (from anywhere)

Writes index.html, services/, system/, pricing/, revenue-calculator/, listing-audit/,
privacy/ and terms/
at the site root from the page bodies in _v4/pages/ plus the shared head, header, menu,
free analysis section and footer below. Styles, behaviour and images live in /v4/
(style.css, main.js, img/); the ?v= stamps come from the files' modification times,
because .htaccess caches CSS and JS for a year.

Images in /v4/img/ were generated with Runway (Nano Banana Pro) for this design on
11 November 2026 and are illustrative: they show no real property managed by
IndaVillas and no real people. Masters: _v4/raw/. Every page says so in its head.

The other pages (/foundation/ and 404) are still built by _build/build.sh in the older
design; that script never writes the six pages above. The listing audit runs
/v4/audit.js (a v4 copy of assets/js/audit.js) against /api/audit.php.
Design v3 (_v3/, /v3/) is kept for rollback. _v4/ is source only: never upload it.

Placeholders in page bodies:
    {{FINAL:NN}}     the shared free analysis section; NN is its section number
    {{btn}}          the arrow cell of a primary button
    {{icon:NAME}}    a Solar icon (Iconify, MIT) from ICONS
    {{yes}} {{no}}   included / not included marks for the plan tables
    {{legal:KEY}}    a fact from LEGAL below (privacy and terms pages)
"""
import html
import os
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_v4" / "pages"

# Solar icons (linear), inlined. Add new ones from https://api.iconify.design/solar/<name>.svg
ICONS = {
    "arrow-right": '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 12H20M14 18L20 12L14 6"/>',
    "arrow-right-up": '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M18 15V6H9"/>',
    "arrow-down": '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4L12 20M6 14L12 20L18 14"/>',
    "check": '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 12.5l4.5 4.5L19 7"/>',
    "check-circle": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path stroke-linejoin="round" d="M8.5 12.5L10.5 14.5L15.5 9.5"/></g>',
    "document-text": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M11 22H13C16.77 22 18.66 22 19.83 20.83C21 19.66 21 17.77 21 14V10C21 6.23 21 4.34 19.83 3.17C18.66 2 16.77 2 13 2H11C7.23 2 5.34 2 4.17 3.17C3 4.34 3 6.23 3 10V14C3 17.77 3 19.66 4.17 20.83C5.34 22 7.23 22 11 22Z"/><path d="M8 12H16"/><path d="M8 8H16"/><path d="M8 16H13"/></g>',
    "camera": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><circle cx="12" cy="13" r="3"/><path d="M14.22 21H9.78C6.66 21 5.1 21 3.98 20.26C3.49 19.95 3.07 19.54 2.75 19.06C2 17.96 2 16.43 2 13.36C2 10.3 2 8.77 2.75 7.67C3.07 7.19 3.49 6.78 3.98 6.46C4.7 5.99 5.6 5.82 6.98 5.76C7.64 5.76 8.2 5.27 8.33 4.64C8.53 3.68 9.38 3 10.37 3H13.63C14.62 3 15.47 3.68 15.67 4.64C15.8 5.27 16.36 5.76 17.02 5.76C18.4 5.82 19.3 5.99 20.02 6.46C20.51 6.78 20.93 7.19 21.25 7.67C22 8.77 22 10.3 22 13.36C22 16.43 22 17.96 21.25 19.06C20.93 19.54 20.51 19.95 20.02 20.26C18.9 21 17.34 21 14.22 21Z"/><path d="M19 10H18"/></g>',
    "graph-up": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M12 22C7.29 22 4.93 22 3.46 20.54C2 19.07 2 16.71 2 12C2 7.29 2 4.93 3.46 3.46C4.93 2 7.29 2 12 2C16.71 2 19.07 2 20.54 3.46C22 4.93 22 7.29 22 12C22 16.71 22 19.07 20.54 20.54C19.07 22 16.71 22 12 22Z"/><path stroke-linejoin="round" d="M7 14L9.29 11.71C9.68 11.32 10.32 11.32 10.71 11.71L12.29 13.29C12.68 13.68 13.32 13.68 13.71 13.29L17 10M14.5 10H17V12.5"/></g>',
    "chat": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M22 12C22 17.52 17.52 22 12 22C10.4 22 8.89 21.62 7.55 20.96C7.19 20.78 6.78 20.72 6.4 20.82L4.17 21.42C3.21 21.68 2.32 20.79 2.58 19.83L3.18 17.6C3.28 17.22 3.22 16.81 3.04 16.45C2.38 15.11 2 13.6 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12Z"/><path stroke-linejoin="round" d="M8 12H8.01M11.99 12H12M15.99 12H16"/></g>',
    "key": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path stroke-linejoin="round" d="M22 8.29C22 11.77 19.17 14.59 15.68 14.59C15.04 14.59 13.59 14.44 12.89 13.86L12.01 14.73C11.27 15.47 11.86 15.47 12.15 16.05C12.15 16.05 12.89 17.08 12.15 18.1C11.71 18.68 10.48 19.5 9.07 18.1L8.77 18.39C8.77 18.39 9.66 19.42 8.92 20.44C8.48 21.03 7.3 21.61 6.28 20.59L5.25 21.61C4.54 22.31 3.68 21.9 3.34 21.61L2.45 20.73C1.63 19.91 2.11 19.03 2.45 18.68L10.1 11.07C10.1 11.07 9.36 9.9 9.36 8.29C9.36 4.82 12.19 2 15.68 2C19.17 2 22 4.82 22 8.29Z"/><path d="M17.89 8.29C17.89 9.51 16.9 10.49 15.68 10.49C14.46 10.49 13.48 9.51 13.48 8.29C13.48 7.08 14.46 6.1 15.68 6.1C16.9 6.1 17.89 7.08 17.89 8.29Z"/></g>',
    "stars": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M6.38 6.96L3.66 8.03C2.78 8.38 2.78 9.62 3.66 9.97L6.38 11.04C6.64 11.14 6.86 11.36 6.96 11.62L8.03 14.34C8.38 15.22 9.62 15.22 9.97 14.34L11.04 11.62C11.14 11.36 11.36 11.14 11.62 11.04L14.34 9.97C15.22 9.62 15.22 8.38 14.34 8.03L11.62 6.96C11.36 6.86 11.14 6.64 11.04 6.38L9.97 3.66C9.62 2.78 8.38 2.78 8.03 3.66L6.96 6.38C6.86 6.64 6.64 6.86 6.38 6.96Z"/><path d="M15.38 15.69L13.35 16.49C12.88 16.67 12.88 17.33 13.35 17.51L15.38 18.31C15.52 18.37 15.63 18.48 15.69 18.62L16.49 20.65C16.67 21.12 17.33 21.12 17.51 20.65L18.31 18.62C18.37 18.48 18.48 18.37 18.62 18.31L20.65 17.51C21.12 17.33 21.12 16.67 20.65 16.49L18.62 15.69C18.48 15.63 18.37 15.52 18.31 15.38L17.51 13.35C17.33 12.88 16.67 12.88 16.49 13.35L15.69 15.38C15.63 15.52 15.52 15.63 15.38 15.69Z"/></g>',
    "home": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M7.88 3.87L5.88 5.11C3.99 6.29 3.04 6.87 2.52 7.82C2 8.77 2 9.92 2 12.2V13.73C2 17.63 2 19.58 3.17 20.79C4.34 22 6.23 22 10 22H14C17.77 22 19.66 22 20.83 20.79C22 19.58 22 17.63 22 13.73V12.2C22 9.92 22 8.77 21.48 7.82C20.96 6.87 20.01 6.29 18.12 5.11L16.12 3.87C14.11 2.62 13.11 2 12 2C10.89 2 9.89 2.62 7.88 3.87Z"/><path d="M12 15L12 18"/></g>',
    "lock": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M2 16C2 13.17 2 11.76 2.88 10.88C3.76 10 5.17 10 8 10H16C18.83 10 20.24 10 21.12 10.88C22 11.76 22 13.17 22 16C22 18.83 22 20.24 21.12 21.12C20.24 22 18.83 22 16 22H8C5.17 22 3.76 22 2.88 21.12C2 20.24 2 18.83 2 16Z"/><path d="M12 14V18"/><path d="M6 10V8C6 4.69 8.69 2 12 2C15.31 2 18 4.69 18 8V10"/></g>',
    "letter": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M2 12C2 8.23 2 6.34 3.17 5.17C4.34 4 6.23 4 10 4H14C17.77 4 19.66 4 20.83 5.17C22 6.34 22 8.23 22 12C22 15.77 22 17.66 20.83 18.83C19.66 20 17.77 20 14 20H10C6.23 20 4.34 20 3.17 18.83C2 17.66 2 15.77 2 12Z"/><path d="M6 8L8.16 9.8C10 11.33 10.91 12.09 12 12.09C13.09 12.09 14 11.33 15.84 9.8L18 8"/></g>',
    "menu": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M20 7L4 7"/><path d="M20 12L4 12"/><path d="M20 17L4 17"/></g>',
    "arrows-h": '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M9 7L4 12L9 17M15 7L20 12L15 17"/>',
    "instagram": '<g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.5"/><circle cx="12" cy="12" r="4.25"/><circle cx="17.4" cy="6.6" r="1.05" fill="currentColor" stroke="none"/></g>',
    "close": '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M14.5 9.5L9.5 14.5M9.5 9.5L14.5 14.5"/></g>',
}

BRAND_MARK = '<svg viewBox="0 0 296 244" fill="currentColor" aria-hidden="true"><polygon points="0,0 88,0 44,75"/><polygon points="88,24 88,150 51,88"/><polygon points="100,23 100,166 141,95"/><polygon points="142,117 142,244 106,179"/><polygon points="154,117 154,244 190,179"/><polygon points="196,23 196,166 155,95"/><polygon points="208,24 208,150 245,88"/><polygon points="296,0 208,0 252,75"/></svg>'

DESC_HOME = ("Revenue management for 5+ bedroom villas in Bali: rate strategy, content and distribution, "
             "while your own team keeps running the house. Get a free revenue gap analysis.")
SCHEMA = '''<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"ProfessionalService",
  "name":"IndaVillas",
  "description":"Revenue management for 5+ bedroom luxury villas in Bali.",
  "url":"https://indavillas.com/",
  "image":"https://indavillas.com/v4/img/hero-night-2400.jpg",
  "email":"hi.flatiro@gmail.com",
  "serviceType":"Luxury villa short-term rental revenue management",
  "legalName":"PT. Flatiro Property Management",
  "address":{"@type":"PostalAddress","streetAddress":"Jl. Kayu Tulang No.81, Canggu, Kec. Kuta Utara","addressLocality":"Kabupaten Badung","addressRegion":"Bali","addressCountry":"ID"},
  "sameAs":["https://www.instagram.com/inda.villas/"]
}
</script>
'''

# nav: "light" text over the dark home and system heroes, "ink" over the limestone ones
PAGES = [
    dict(src="home.html", final="cliff", out="index.html", path="/", nav="home", bar="light",
         title="IndaVillas | Revenue management for luxury villas in Bali", desc=DESC_HOME,
         og="The value is already in your villa", image="hero-night-2400.jpg",
         subject="New villa revenue analysis - IndaVillas (Home)",
         cta=("#analysis", "Free analysis", "Get your free revenue analysis"), extra=SCHEMA),
    dict(src="services.html", out="services/index.html", path="/services/", nav="services", bar="ink",
         title="Villa management services | IndaVillas",
         desc="Villa management services: listing, photography, pricing optimisation, guest communication, "
              "arrivals and more, led by marketing and focused on revenue.",
         og="Villa management services", image="services-1400.jpg",
         subject="New villa revenue analysis - IndaVillas (Services)",
         cta=("#analysis", "Free analysis", "Get your free revenue analysis"), extra=""),
    dict(src="system.html", out="system/index.html", path="/system/", nav="system", bar="light",
         title="The revenue growth system | IndaVillas",
         desc="A structured three phase growth system for 5+ bedroom luxury villas: build the revenue "
              "foundation, generate demand, then maximise profitability.",
         og="The revenue growth system", image="system-1400.jpg",
         subject="New villa revenue analysis - IndaVillas (System)",
         cta=("#analysis", "Free analysis", "Get your free revenue analysis"), extra=""),
    dict(src="pricing.html", out="pricing/index.html", path="/pricing/", nav="pricing", bar="ink",
         title="Pricing: Growth and Excellence plans | IndaVillas",
         desc="Two yearly plans for your villa, Growth and Excellence: one flat fee each, quoted for your "
              "property with setup included. Rate strategy, content and distribution, while your own team "
              "keeps running the house.",
         og="Pricing: Growth and Excellence", image="pricing-1400.jpg",
         subject=None,
         cta=("#audit", "Free audit", "Get your free revenue audit"), extra=""),
    dict(src="calculator.html", final="terrace", out="revenue-calculator/index.html",
         path="/revenue-calculator/", nav="tools", bar="light",
         title="Stop bleeding Airbnb revenue: free commission calculator | IndaVillas",
         desc="See what platform commission really costs your villa each year, and how much you keep "
              "by moving bookings direct. Free calculator, no email needed.",
         og="What platform commission costs your villa", image="terrace-1300.jpg",
         subject="New villa revenue analysis - IndaVillas (Revenue calculator)",
         cta=("#analysis", "Free analysis", "Get your free revenue analysis"), extra=""),
    dict(src="privacy.html", out="privacy/index.html", path="/privacy/", nav="legal", bar="ink",
         title="Privacy policy | IndaVillas",
         desc="What IndaVillas collects when you use indavillas.com, why, who else handles it, and how to "
              "have it deleted. No cookies, no tracking, and we never sell your data.",
         og="Privacy policy", image="hero-night-2400.jpg", subject=None, legal=True,
         cta=("/#analysis", "Free analysis", "Get your free revenue analysis"), extra=""),
    dict(src="terms.html", out="terms/index.html", path="/terms/", nav="legal", bar="ink",
         title="Terms of use | IndaVillas",
         desc="The terms for using indavillas.com and its free tools, and for buying Foundation.",
         og="Terms of use", image="hero-night-2400.jpg", subject=None, legal=True,
         cta=("/#analysis", "Free analysis", "Get your free revenue analysis"), extra=""),
    dict(src="audit.html", out="listing-audit/index.html",
         path="/listing-audit/", nav="tools", bar="light", script="audit.js",
         title="Audit your listing in one minute: free Airbnb listing audit | IndaVillas",
         desc="Send your Airbnb or Booking.com link and get your listing scored out of 100 across photos, "
              "title, description, amenities, reviews and booking setup, with every fix ranked.",
         og="Audit your listing in one minute", image="camera-1400.jpg",
         subject="New villa revenue analysis - IndaVillas (Listing audit)",
         cta=("#top", "Score my listing", "Score my listing"), extra=""),
]
INSTAGRAM = "https://www.instagram.com/inda.villas/"

# Facts the privacy policy and terms need. Fill in the three None values (the owner has to
# supply them). While any is missing, the build warns, the page shows a highlighted
# placeholder, and the page is marked noindex so search engines skip it.
LEGAL = {
    "name": "PT. Flatiro Property Management",   # Indonesian limited liability company (PT)
    "address": "Jl. Kayu Tulang No.81, Canggu, Kec. Kuta Utara, Kabupaten Badung, Bali, Indonesia",
    "law": "the Republic of Indonesia",           # follows from the company being an Indonesian PT
    "updated": "11 November 2026",
}
LEGAL_LABELS = {"name": "registered company name", "address": "registered address", "law": "country whose law applies"}
NAV = [("services", "/services/", "Services"), ("system", "/system/", "The system"), ("pricing", "/pricing/", "Pricing")]
# The blog sits in the footer only (owner request, 16 November 2026), not in the top bar or the menu.
CUR = ' aria-current="page"'      # marks the page you are on in the menus


def icon(name):
    return f'<svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>'


def btn_icon(name="arrow-right"):
    return f'<span class="bi">{icon(name)}</span>'


def stamp(rel):
    return int(os.path.getmtime(ROOT / rel))


def head(p):
    e = html.escape
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(p["title"])}</title>
<meta name="description" content="{e(p["desc"])}">
<link rel="canonical" href="https://indavillas.com{p["path"]}">
<meta name="robots" content="{p.get("robots", "index, follow, max-image-preview:large")}">
<meta name="theme-color" content="{"#0B1311" if p["bar"] == "light" else "#EEE8DC"}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="IndaVillas">
<meta property="og:title" content="{e(p["og"])}">
<meta property="og:description" content="{e(p["desc"])}">
<meta property="og:url" content="https://indavillas.com{p["path"]}">
<meta property="og:image" content="https://indavillas.com/v4/img/{p["image"]}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/favicon.svg">
{p["extra"]}<!-- Generated by _v4/build.py from _v4/pages/{p["src"]}: edit there, then rebuild.
     Photography: generated with Runway for this design, plus the earlier site renders (illustrative),
     and real before/after photos of a client bedroom (styling-before/after). -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdnjs.cloudflare.com">
<link rel="preconnect" href="https://unpkg.com">
{'<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>' + chr(10) if p["nav"] == "home" else ""}<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Hanken+Grotesk:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/v4/style.css?v={stamp("v4/style.css")}">
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>
<script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js" defer></script>
<script type="module" src="/v4/main.js?v={stamp("v4/main.js")}"></script>
{f'<script src="/v4/{p["script"]}?v={stamp("v4/" + p["script"])}" defer></script>' + chr(10) if p.get("script") else ""}</head>'''


def header(p):
    href, short, long_ = p["cta"]
    bar = "nav" if p["bar"] == "light" else "nav nav--ink"
    links = "\n".join(
        f'    <a href="{url}"{CUR if key == p["nav"] else ""}>{label}</a>' for key, url, label in NAV)
    menu = "\n".join(
        f'    <a href="{url}"{CUR if key == p["nav"] else ""}><span>0{i}</span>{label}</a>'
        for i, (key, url, label) in enumerate(NAV, 1))
    return f'''<body>
<a class="skip" href="#main">Skip to content</a>

<header class="{bar}" data-nav>
  <a class="nav__brand" href="/" aria-label="IndaVillas home"{CUR if p["nav"] == "home" else ""}>
    {BRAND_MARK}
    <span translate="no">Inda<b>Villas</b></span>
  </a>
  <nav class="nav__links" aria-label="Primary">
{links}
  </nav>
  <a class="btn btn--plain nav__cta" href="{href}">{short}</a>
  <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="menu" aria-label="Open menu">
    <svg class="i-open" viewBox="0 0 24 24" aria-hidden="true">{ICONS["menu"]}</svg>
    <svg class="i-close" viewBox="0 0 24 24" aria-hidden="true">{ICONS["close"]}</svg>
  </button>
</header>

<div class="menu" id="menu" hidden>
  <nav aria-label="Menu">
{menu}
  </nav>
  <div class="menu__foot">
    <a class="btn" href="{href}">{long_} {btn_icon()}</a>
    <a class="menu__ig" href="{INSTAGRAM}" target="_blank" rel="noopener">{icon("instagram")} @inda.villas<span class="sr-only"> on Instagram (opens in a new tab)</span></a>
  </div>
</div>

<main id="main">
'''


# background photo of the free analysis section: (small, large, large width, small width, small height)
FINAL_IMAGES = {
    "final": ("final-1280.jpg", "final-2400.jpg", 2400, 1280, 714),
    "cliff": ("cliff-1280.jpg", "cliff-2000.jpg", 2000, 1280, 876),
    "terrace": ("terrace-900.jpg", "terrace-1300.jpg", 1307, 900, 502),
}


def final(subject, mark, image="final"):
    sm, lg, lw, w, h = FINAL_IMAGES[image]
    return f'''<!-- ============ FREE ANALYSIS ============ -->
<section class="fn s-night" id="analysis" aria-labelledby="final-title">
  <div class="fn__media" aria-hidden="true"><img src="/v4/img/{sm}" srcset="/v4/img/{sm} {w}w, /v4/img/{lg} {lw}w" sizes="100vw" alt="" width="{w}" height="{h}" loading="lazy" decoding="async"></div>
  <div class="wrap">
    <p class="idx"><span>{mark}</span>Free revenue gap analysis</p>
    <h2 class="fn__title" id="final-title" data-split>See what your villa could earn.</h2>
    <p class="lede fn__lede">Tell us where the villa is. We place it against similar villas nearby and send you the three changes worth the most. Free, with no obligation.</p>

    <form class="form" data-form novalidate aria-label="Request your free revenue analysis">
      <input type="hidden" name="_subject" value="{html.escape(subject)}">
      <input type="hidden" name="_template" value="table">
      <input type="hidden" name="_captcha" value="false">
      <input type="text" name="_honey" class="form__honey" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="field">
        <label for="f-email">Email address</label>
        <input id="f-email" name="email" type="email" autocomplete="email" spellcheck="false" placeholder="you@email.com" required aria-describedby="f-email-err">
        <p class="field__err" id="f-email-err"></p>
      </div>
      <div class="field">
        <label for="f-wa">WhatsApp <span>optional</span></label>
        <input id="f-wa" name="whatsapp" type="tel" autocomplete="tel" placeholder="+62 812 3456 7890" aria-describedby="f-wa-err">
        <p class="field__err" id="f-wa-err"></p>
      </div>
      <div class="field">
        <label for="f-where">Where is the villa?</label>
        <input id="f-where" name="property" type="text" autocomplete="off" placeholder="Uluwatu, Canggu, Ubud…" required aria-describedby="f-where-err">
        <p class="field__err" id="f-where-err"></p>
      </div>
      <div class="field">
        <label for="f-beds">Bedrooms</label>
        <input id="f-beds" name="bedrooms" type="number" inputmode="numeric" autocomplete="off" min="1" max="30" placeholder="5" required aria-describedby="f-beds-err">
        <p class="field__err" id="f-beds-err"></p>
      </div>
      <button class="btn form__submit" type="submit"><span data-label>Get my free analysis</span> {btn_icon()}</button>
      <p class="form__status" role="status" aria-live="polite" data-status></p>
    </form>
    <p class="fn__note">{icon("lock")} We only take on villas we're confident we can grow. Your details are used for the analysis only. <a href="/privacy/">Privacy policy</a></p>
  </div>
</section>
'''


def footer():
    links = "\n".join(f'      <a href="{url}">{label}</a>' for _, url, label in NAV)
    return f'''
</main>

<footer class="ft s-night">
  <div class="wrap">
    <p class="ft__line">Every night counts. <em>Let's sell more of yours.</em></p>
    <div class="ft__grid">
      <div>
        <a class="nav__brand" href="/" aria-label="IndaVillas home">
          {BRAND_MARK}
          <span translate="no">Inda<b>Villas</b></span>
        </a>
        <p class="ft__about">Revenue management for 5+ bedroom luxury villas. Listed and optimised on Airbnb, Booking.com, Vrbo, Expedia and Google Vacation Rentals.</p>
      </div>
      <nav class="ft__nav" aria-label="Footer">
{links}
        <a href="/revenue-calculator/">Revenue calculator</a>
        <a href="/listing-audit/">Listing audit</a>
        <a href="/blog/">Blog</a>
      </nav>
      <div class="ft__contact">
        <a class="ft__mail" href="mailto:hi.flatiro@gmail.com">{icon("letter")} hi.flatiro@gmail.com</a>
        <a class="ft__mail" href="{INSTAGRAM}" target="_blank" rel="noopener">{icon("instagram")} @inda.villas<span class="sr-only"> on Instagram (opens in a new tab)</span></a>
      </div>
    </div>
    <div class="ft__bar">
      <p>&copy; <span data-year>2026</span> IndaVillas. Photography is illustrative, apart from the before and after styling.</p>
      <nav class="ft__legal" aria-label="Legal">
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="#main" class="lnk">Back to top</a>
      </nav>
    </div>
  </div>
</footer>
</body>
</html>
'''


def typeset(doc):
    """Curly apostrophes in visible text only; tags, scripts and styles stay as written."""
    parts = re.split(r"(<script\b.*?</script>|<style\b.*?</style>|<[^>]+>)", doc, flags=re.S)
    return "".join(x if x.startswith("<") else re.sub(r"(?<=\w)'(?=\w)", "\u2019", x) for x in parts)


def main():
    for p in PAGES:
        body = (SRC / p["src"]).read_text()
        m = re.search(r"\{\{FINAL:(\d+)\}\}", body)
        if m:
            body = body.replace(m.group(0), final(p["subject"], m.group(1), p.get("final", "final")))
        body = body.replace("{{yes}}", f'<span class="mk mk--yes" role="img" aria-label="Included">{icon("check")}</span>')
        body = body.replace("{{no}}", '<span class="mk mk--no" role="img" aria-label="Not included"></span>')
        body = body.replace("{{btn}}", btn_icon())
        if p.get("legal"):
            missing = [k for k in LEGAL if not LEGAL[k]]
            def fill(mm):
                key = mm.group(1)
                if LEGAL.get(key):
                    return html.escape(LEGAL[key])
                return f'<mark class="todo">[{LEGAL_LABELS.get(key, key)}: to be confirmed]</mark>'
            body = re.sub(r"\{\{legal:([a-z]+)\}\}", fill, body)
            if missing:
                p["robots"] = "noindex, follow"
                print(f"  WARNING {p['out']}: missing {', '.join(missing)} in LEGAL; page shows placeholders and is noindex")
        body = re.sub(r"\{\{icon:([a-z0-9-]+)\}\}", lambda mm: icon(mm.group(1)), body)
        left = re.findall(r"\{\{[^}]*\}\}", body)
        if left:
            raise SystemExit(f"{p['src']}: unresolved {left}")
        out = ROOT / p["out"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(typeset(head(p) + "\n" + header(p) + body.rstrip("\n") + "\n" + footer()))
        print(f"  {p['out']:<22} {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
