"""Builds the IndaVillas blog (design v4, November 2026).

    python3 _v4/blog.py          writes /blog/, sitemap.xml, llms.txt and the feed
    python3 _v4/blog.py --og     also renders any missing share image (needs Chrome)

One article = one file in _v4/blog/: a JSON block between <!--meta and -->, then the body
as plain HTML. Files are published in file name order (01-, 02- ...). To add an article,
copy one, change the meta and the body, run this script, upload /blog/, /v4/blog.css,
/v4/img/blog/, sitemap.xml and llms.txt.

What the script writes
    blog/index.html            the list of articles
    blog/<slug>/index.html     each article
    blog/feed.xml              Atom feed
    sitemap.xml                every indexable page of the site, with real change dates
    llms.txt                   a plain text map of the site for AI assistants (optional
                               extra: Google says it does not use it; others may)

Built to the rules the open source SEO skills agree on (AgriciDaniel/claude-seo and
claude-blog, zubair-trabzada/geo-seo-claude, coreyhaines31/marketingskills), which all
defer to Google's own guide, "optimising for generative AI is still SEO":
    - the answer comes first: the lede and "The short version" sit above everything else
    - each section opens with its point and names its subject, so it can be quoted alone
    - figures carry their source and date; original analysis says how it was done
    - tables have captions and header cells; steps are ordered lists
    - all text is in the HTML (no JavaScript needed to read it)
    - BlogPosting, Organization, WebSite and BreadcrumbList structured data in one graph.
      No FAQPage: Google retired FAQ rich results in May 2026; the questions stay visible.
    - byline, published and updated dates, canonical link, article Open Graph tags

Body placeholders
    {{audit}} {{analysis}} {{calc}} {{pricing}}   the one call to action inside the text
    {{method}}        the standard note on the AirDNA figures
    {{terms}}         the standard definitions (occupancy, nightly rate, revenue, median, top 25%)
    {{btn}} {{icon:NAME}}                         as in build.py

House style for the text (same as the site and the Instagram SOP): no em or en dashes,
no hyphen compounds in visible copy, ranges written "15 to 25%", plain English, every
number from a named source. Images from the Instagram set are AI generated and are
captioned "Illustrative image".
"""
import datetime as dt
import html
import json
import pathlib
import re
import subprocess
import sys
from urllib.parse import quote

import build

ROOT = build.ROOT
SRC = ROOT / "_v4" / "blog"
OUT = ROOT / "blog"
IMG = ROOT / "v4" / "img" / "blog"
SITE = "https://indavillas.com"
ORG = SITE + "/#organization"
WEBSITE = SITE + "/#website"
BLOG = SITE + "/blog/#blog"
TZ = "+08:00"                       # Bali
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

BLOG_TITLE = "Blog: Bali villa revenue and guest experience | IndaVillas"
BLOG_DESC = ("Market data on 5+ bedroom villas in Bali, and practical notes on listings, photography, "
             "pricing, reviews and guest communication.")

# The population behind every AirDNA figure on the blog. Same one as the Instagram SOP.
METHOD = ("AirDNA data for Bali, trailing 12 months to October 2026: 2,910 whole home Airbnb listings "
          "with 5 or more bedrooms, at least 180 days available and at least one reserved day. "
          "Figures are medians unless stated, rounded. They show patterns across the market, not causes, "
          "and they are not a forecast for any one villa.")
AIRDNA = ["AirDNA, Bali market data, trailing 12 months to October 2026 (analysis by IndaVillas)", "https://www.airdna.co/"]
AIRDNA_HELP = ["AirDNA Help: how AirDNA calculates occupancy rate",
               "https://help.airdna.co/en/articles/8062178-how-does-airdna-calculate-occupancy-rate"]
# Checked against AirDNA's help pages on 13 November 2026: occupancy leaves out blocked nights, and the
# average daily rate includes cleaning fees.
TERMS = '''<dl class="ar-dl">
  <div><dt>Occupancy</dt><dd>Occupancy is the share of bookable nights that were booked: reserved nights divided by the nights a listing was either reserved or open. Nights the owner blocked are left out.</dd></div>
  <div><dt>Nightly rate</dt><dd>Nightly rate is the average daily rate, or ADR: booking revenue divided by booked nights. It includes cleaning fees.</dd></div>
  <div><dt>Revenue</dt><dd>Revenue is the booking value of stays in the 12 months, nightly rates plus cleaning fees. It is not the owner's profit: booking site commission and running costs still come out of it.</dd></div>
  <div><dt>Median</dt><dd>The median is the middle villa in a group: half earned more and half earned less. A few very high earners do not pull it up the way they pull up an average.</dd></div>
  <div><dt>Top 25%</dt><dd>The top 25% is the quarter of villas with the highest yearly revenue. "Starts at" is the revenue a villa needed to enter that group.</dd></div>
</dl>
<p class="ar-cap">Occupancy as defined in <a href="''' + AIRDNA_HELP[1] + '''" rel="noopener">AirDNA's help article on occupancy rate</a>.</p>'''

CTAS = {
    "audit": ("Free listing audit", "See where your listing loses bookings.",
              "Paste your Airbnb or Booking.com link and get a score out of 100, with every fix ranked. Free, about one minute.",
              "/listing-audit/", "Score my listing"),
    "analysis": ("Free revenue analysis", "See where your villa sits in these numbers.",
                 "Tell us where the villa is. We place it against similar villas nearby and send the three changes worth the most. Free, no obligation.",
                 "#analysis", "Get my free analysis"),
    "calc": ("Revenue calculator", "Work out what commission costs your villa.",
             "Enter your nightly rate and occupancy and see what each booking site keeps in a year. Runs in your browser, no email needed.",
             "/revenue-calculator/", "Open the calculator"),
    "pricing": ("How we charge", "One flat yearly fee, quoted before you start.",
                "Your team keeps running the house. We work on the rate guests pay and whether they find you.",
                "/pricing/", "See how pricing works"),
}

MONTHS = "January February March April May June July August September October November December".split()


def nice(d):
    y, m, day = (int(x) for x in d.split("-"))
    return f"{day} {MONTHS[m - 1]} {y}"


def iso(d):
    return f"{d}T09:00:00{TZ}"


def text_of(markup):
    return html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style)\b.*?</\1>", " ", markup, flags=re.S)))


def load():
    posts = []
    for f in sorted(SRC.glob("*.html")):
        raw = f.read_text()
        m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*(.*)", raw, flags=re.S)
        if not m:
            raise SystemExit(f"{f.name}: no <!--meta {{...}} --> block at the top")
        p = json.loads(m.group(1))
        p["body"] = m.group(2).rstrip() + "\n"
        p["terms"] = "{{terms}}" in p["body"]
        p["file"] = f.name
        p["n"] = f.name[:2]
        p.setdefault("updated", p["date"])
        p["path"] = f"/blog/{p['slug']}/"
        p["url"] = SITE + p["path"]
        p["og_image"] = f"og-{p['slug']}.jpg"
        for key in ("slug", "title", "seo", "desc", "pillar", "date", "lede", "key", "hero"):
            if not p.get(key):
                raise SystemExit(f"{f.name}: meta is missing '{key}'")
        posts.append(p)
    slugs = [p["slug"] for p in posts]
    if len(set(slugs)) != len(slugs):
        raise SystemExit("two articles share a slug")
    return posts


def cta(kind):
    label, head, body, href, button = CTAS[kind]
    return (f'<aside class="ar-cta s-night" aria-label="{label}">\n'
            f'  <div><p class="ar-cta__h">{head}</p><p>{body}</p></div>\n'
            f'  <a class="btn" href="{href}">{button} {build.btn_icon()}</a>\n</aside>')


def expand(body):
    for kind in CTAS:
        body = body.replace("{{" + kind + "}}", cta(kind))
    body = body.replace("{{method}}", f'<aside class="ar-note" aria-label="About these figures"><b>About these figures</b>{METHOD}</aside>')
    body = body.replace("{{terms}}", TERMS)
    body = body.replace("{{btn}}", build.btn_icon())
    body = re.sub(r"\{\{icon:([a-z0-9-]+)\}\}", lambda m: build.icon(m.group(1)), body)
    left = re.findall(r"\{\{[^}]*\}\}", body)
    if left:
        raise SystemExit(f"unresolved {left}")
    return body


def ld(graph):
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)
    return '<script type="application/ld+json">\n' + data.replace("</", "<\\/") + "\n</script>\n"


def org_nodes():
    return [
        {"@type": "Organization", "@id": ORG, "name": "IndaVillas", "legalName": build.LEGAL["name"],
         "url": SITE + "/", "email": "hi.flatiro@gmail.com",
         "description": "Revenue management for 5+ bedroom luxury villas in Bali.",
         "logo": {"@type": "ImageObject", "url": SITE + "/assets/img/favicon.svg"},
         "address": {"@type": "PostalAddress", "streetAddress": "Jl. Kayu Tulang No.81, Canggu, Kec. Kuta Utara",
                     "addressLocality": "Kabupaten Badung", "addressRegion": "Bali", "addressCountry": "ID"},
         "sameAs": [build.INSTAGRAM]},
        {"@type": "WebSite", "@id": WEBSITE, "url": SITE + "/", "name": "IndaVillas", "inLanguage": "en",
         "publisher": {"@id": ORG}},
        {"@type": "Blog", "@id": BLOG, "url": SITE + "/blog/", "name": "IndaVillas blog", "description": BLOG_DESC,
         "inLanguage": "en", "publisher": {"@id": ORG}, "isPartOf": {"@id": WEBSITE}},
    ]


def crumbs_ld(url, trail):
    return {"@type": "BreadcrumbList", "@id": url + "#breadcrumb", "itemListElement": [
        {"@type": "ListItem", "position": i, "name": name, "item": SITE + path}
        for i, (name, path) in enumerate(trail, 1)]}


def head(title, desc, path, og_title, og_image, graph, article=None):
    e = html.escape
    art = ""
    if article:
        art = (f'<meta property="article:published_time" content="{iso(article["date"])}">\n'
               f'<meta property="article:modified_time" content="{iso(article["updated"])}">\n'
               f'<meta property="article:section" content="{e(article["pillar"])}">\n'
               f'<meta property="article:publisher" content="{build.INSTAGRAM}">\n')
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{SITE}{path}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="theme-color" content="#EEE8DC">
<meta name="author" content="IndaVillas">
<meta property="og:type" content="{"article" if article else "website"}">
<meta property="og:site_name" content="IndaVillas">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="{e(og_title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{SITE}/v4/img/blog/{og_image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
{art}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(og_title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{SITE}/v4/img/blog/{og_image}">
<link rel="alternate" type="application/atom+xml" title="IndaVillas blog" href="{SITE}/blog/feed.xml">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/favicon.svg">
{ld(graph)}<!-- Generated by _v4/blog.py from _v4/blog/: edit there, then rebuild.
     Photographs on the blog are AI generated and captioned as illustrative. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Hanken+Grotesk:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/v4/style.css?v={build.stamp("v4/style.css")}">
<link rel="stylesheet" href="/v4/blog.css?v={build.stamp("v4/blog.css")}">
<script type="module" src="/v4/main.js?v={build.stamp("v4/main.js")}"></script>
</head>'''


def chrome(nav="blog"):
    return dict(bar="ink", nav=nav, cta=("#analysis", "Free analysis", "Get your free revenue analysis"))


def slug_of(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def hero_figure(p, cls="ar-fig"):
    """The article's picture: its photo, or its headline figure set on night."""
    h = p["hero"]
    if "img" in h:
        return (f'<figure class="{cls}">\n'
                f'      <img src="/v4/img/blog/{h["img"]}-600.jpg" srcset="/v4/img/blog/{h["img"]}-600.jpg 597w, /v4/img/blog/{h["img"]}-1200.jpg 1194w" '
                f'sizes="(max-width:900px) 100vw, 420px" alt="{html.escape(h["alt"])}" width="597" height="800" fetchpriority="high" decoding="async">\n'
                f'      <figcaption>Illustrative image.</figcaption>\n    </figure>')
    return (f'<div class="ar-num s-night">\n'
            f'      <p class="ar-num__n">{h["num"]}</p>\n'
            f'      <p class="ar-num__l">{h["label"]}</p>\n'
            f'      <p class="ar-num__s">{h.get("src", "")}</p>\n    </div>')


def thumb(p):
    """Card picture: the photo, or the article's figure on night (no stock imagery)."""
    h = p["hero"]
    if "img" in h:
        return (f'<div class="bc__media"><img src="/v4/img/blog/{h["img"]}-600.jpg" alt="" width="597" height="800" '
                f'loading="lazy" decoding="async"></div>')
    return f'<div class="bc__media bc__media--num s-night" aria-hidden="true"><b>{h["num"]}</b><span>{h["label"]}</span></div>'


def card(p, level="h2"):
    """One article card, as on the blog index and under every article."""
    return (f'<article class="bc" data-cat="{slug_of(p["pillar"])}">\n'
            f'  {thumb(p)}\n'
            f'  <div class="bc__body">\n'
            f'    <p class="tag">{p["pillar"]}</p>\n'
            f'    <{level} class="bc__title"><a href="{p["path"]}">{p["title"]}</a></{level}>\n'
            f'    <p class="bc__desc">{p["desc"]}</p>\n'
            f'    <p class="bc__meta"><time datetime="{p["date"]}">{nice(p["date"])}</time><span>{p["minutes"]} min read</span></p>\n'
            f'  </div>\n</article>')


def share(p, where):
    """Share links: plain links to each service (nothing loads until clicked), plus copy link."""
    u = html.escape(p["url"], quote=True)
    qu, qt = quote(p["url"], safe=""), quote(p["title"], safe="")
    tab = '<span class="sr-only"> (opens in a new tab)</span>'
    return (f'<div class="share" role="group" aria-label="Share this article ({where})">\n'
            f'  <span class="share__h">Share</span>\n'
            f'  <button class="share__a" type="button" data-copy="{u}" hidden>Copy link</button>\n'
            f'  <a class="share__a" href="https://wa.me/?text={qt}%20{qu}" rel="noopener" target="_blank">WhatsApp{tab}</a>\n'
            f'  <a class="share__a" href="https://www.linkedin.com/sharing/share-offsite/?url={qu}" rel="noopener" target="_blank">LinkedIn{tab}</a>\n'
            f'  <a class="share__a" href="https://www.facebook.com/sharer/sharer.php?u={qu}" rel="noopener" target="_blank">Facebook{tab}</a>\n'
            f'  <a class="share__a" href="https://x.com/intent/post?url={qu}&amp;text={qt}" rel="noopener" target="_blank">X{tab}</a>\n'
            f'  <a class="share__a" href="mailto:?subject={qt}&amp;body={qu}">Email</a>\n'
            f'  <span class="share__ok" role="status" aria-live="polite"></span>\n</div>')


def byline(small=False):
    return (f'<div class="by{" by--sm" if small else ""}">\n'
            f'  <span class="by__av" aria-hidden="true">{build.BRAND_MARK}</span>\n'
            f'  <p><b>IndaVillas</b><span>Revenue management for 5+ bedroom villas in Bali</span></p>\n</div>')


def sources_block(p):
    srcs = list(p.get("sources", []))
    if p.get("data") and AIRDNA not in srcs:
        srcs.insert(0, AIRDNA)
    if p.get("terms"):
        srcs.append(AIRDNA_HELP)
    items = "\n".join(f'        <li><a href="{u}" rel="noopener">{html.escape(label)}</a></li>' for label, u in srcs)
    how = f"<p>{METHOD}</p>\n      " if p.get("data") else ""
    lst = f"<ol>\n{items}\n      </ol>\n      " if srcs else ""
    return (f'<section class="ar-src" id="sources" aria-labelledby="sources-h">\n'
            f'      <h2 id="sources-h">Sources and method</h2>\n'
            f'      {how}{lst}</section>')


def anchors(body):
    """A visible # link on every section heading, so a section can be linked to directly."""
    return re.sub(r'<h2 id="([^"]+)">(.*?)</h2>',
                  lambda m: f'<h2 id="{m.group(1)}">{m.group(2)} <a class="ar-hash" href="#{m.group(1)}" aria-label="Link to this section">#</a></h2>',
                  body)


def stats_band(p):
    st = p.get("stats")
    if not st:
        return ""
    tiles = "\n".join(f'      <div><dt>{lab}</dt><dd>{num}</dd></div>' for num, lab in st["items"])
    return (f'  <div class="wrap">\n    <dl class="ar-stats">\n{tiles}\n    </dl>\n'
            f'    <p class="ar-stats__src">{st["src"]}</p>\n  </div>\n')


def script_tag():
    return f'<script src="/v4/blog.js?v={build.stamp("v4/blog.js")}" defer></script>\n</body>'


def article_page(p, posts):
    body = expand(p["body"])
    toc = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body)
    body = anchors(body)
    by_slug = {q["slug"]: q for q in posts}
    related = [by_slug[s] for s in p.get("related", []) if s in by_slug][:3]
    if len(related) < 3:
        related += [q for q in posts if q is not p and q not in related][: 3 - len(related)]
    i = posts.index(p)
    prev_p = posts[i - 1] if i > 0 else None
    next_p = posts[i + 1] if i + 1 < len(posts) else None
    srcs = ([u for _, u in p.get("sources", [])] + ([AIRDNA[1]] if p.get("data") else [])
            + ([AIRDNA_HELP[1]] if p.get("terms") else []))
    graph = org_nodes() + [
        {"@type": "WebPage", "@id": p["url"] + "#webpage", "url": p["url"], "name": p["seo"], "description": p["desc"],
         "inLanguage": "en", "isPartOf": {"@id": WEBSITE}, "breadcrumb": {"@id": p["url"] + "#breadcrumb"},
         "datePublished": iso(p["date"]), "dateModified": iso(p["updated"])},
        {"@type": "BlogPosting", "@id": p["url"] + "#article", "headline": p["title"], "description": p["desc"],
         "image": {"@type": "ImageObject", "url": f"{SITE}/v4/img/blog/{p['og_image']}", "width": 1200, "height": 630},
         "datePublished": iso(p["date"]), "dateModified": iso(p["updated"]),
         "author": {"@type": "Organization", "@id": ORG, "name": "IndaVillas", "url": SITE + "/"},
         "publisher": {"@id": ORG}, "mainEntityOfPage": {"@id": p["url"] + "#webpage"}, "isPartOf": {"@id": BLOG},
         "articleSection": p["pillar"], "inLanguage": "en", "wordCount": p["words"],
         "about": [{"@type": "Thing", "name": a} for a in p.get("about", [])],
         **({"citation": srcs} if srcs else {})},
        crumbs_ld(p["url"], [("Home", "/"), ("Blog", "/blog/"), (p["title"], p["path"])]),
    ]
    toc_html = "\n".join(f'        <li><a href="#{a}">{t}</a></li>' for a, t in toc + [("sources", "Sources and method")])
    keys = "\n".join(f"          <li>{k}</li>" for k in p["key"])
    rel_side = "\n".join(f'        <li><a href="{q["path"]}"><span>{q["pillar"]}</span>{q["title"]}</a></li>' for q in related)
    pn = ""
    if prev_p or next_p:
        pn = '<nav class="pn" aria-label="More articles">\n'
        if prev_p:
            pn += f'  <a class="pn__a" href="{prev_p["path"]}" rel="prev"><span>Previous</span>{prev_p["title"]}</a>\n'
        if next_p:
            pn += f'  <a class="pn__a pn__a--next" href="{next_p["path"]}" rel="next"><span>Next</span>{next_p["title"]}</a>\n'
        pn += '</nav>'
    mail_subject = quote(p["title"], safe="")
    tab = '<span class="sr-only"> (opens in a new tab)</span>'
    page = (head(p["seo"], p["desc"], p["path"], p["title"], p["og_image"], graph, article=p) + "\n"
            + build.header(chrome()) + f'''<article class="ar-page">
<header class="ar-hero s-lime" id="top" data-hero>
  <div class="wrap ar-hero__grid">
    <div class="ar-hero__text">
      <nav aria-label="Breadcrumb"><ol class="crumbs">
        <li><a href="/blog/">Blog</a></li>
        <li><span aria-current="page">{p["pillar"]}</span></li>
      </ol></nav>
      <h1 class="ar-title">{p["title"]}</h1>
      <p class="ar-deck">{p["desc"]}</p>
      <div class="ar-byrow">
        {byline()}
        <p class="ar-meta"><span class="tag">{p["pillar"]}</span><span>Published <time datetime="{p["date"]}">{nice(p["date"])}</time></span><span>{p["minutes"]} min read</span></p>
      </div>
      {share(p, "top")}
    </div>
    {hero_figure(p)}
  </div>
{stats_band(p)}</header>

<div class="ar s-lime">
  <div class="wrap ar__grid">
    <nav class="ar-toc" aria-label="On this page">
      <p class="ar-toc__h">On this page</p>
      <ol>
{toc_html}
      </ol>
    </nav>

    <div class="ar__body">
      <details class="ar-toc-m">
        <summary>On this page</summary>
        <ol>
{toc_html}
        </ol>
      </details>

      <aside class="ar-qa-box" aria-labelledby="qa-h">
        <h2 id="qa-h">Quick answer</h2>
        <p>{p["lede"]}</p>
      </aside>

      <aside class="ar-key" aria-labelledby="key-h">
        <h2 id="key-h">Key takeaways</h2>
        <ul>
{keys}
        </ul>
      </aside>

{body}
    {sources_block(p)}

      <aside class="ar-ask" aria-labelledby="ask-h">
        <h2 id="ask-h">Questions about this article?</h2>
        <p>Ask us about your own villa, or tell us if a figure looks wrong.</p>
        <p class="ar-ask__btns"><a class="btn btn--sm" href="mailto:hi.flatiro@gmail.com?subject={mail_subject}">Email us</a> <a class="btn btn--sm btn--ghost" href="/pricing/">See pricing</a></p>
      </aside>

      <aside class="ar-author" aria-label="About the author">
        {byline(small=True)}
        <p>We run the commercial side of 5+ bedroom villas in Bali: rate strategy, listings, photography, distribution and guest communication, while the owner's team runs the house. Market figures on this blog come from our own analysis of AirDNA data.</p>
        <p class="ar-author__links"><a href="/system/">How we work</a> <a href="{build.INSTAGRAM}" rel="noopener" target="_blank">Instagram{tab}</a></p>
      </aside>

      {share(p, "bottom")}
      {pn}
    </div>

    <aside class="ar-side" aria-label="More from IndaVillas">
      <div class="ar-side__rel">
        <p class="ar-toc__h">Related articles</p>
        <ul>
{rel_side}
        </ul>
      </div>
      <div class="ar-side__cta s-night">
        <p class="tag">Free listing audit</p>
        <p class="ar-side__big">100</p>
        <p class="ar-side__lbl">point score for your Airbnb or Booking.com listing</p>
        <ul>
          <li>Photos, title, description, amenities, reviews and booking setup</li>
          <li>Every fix ranked</li>
          <li>Takes about a minute</li>
        </ul>
        <a class="btn btn--sm" href="/listing-audit/">Score my listing {build.btn_icon()}</a>
      </div>
    </aside>
  </div>
</div>
</article>

<section class="rel s-lime2" aria-labelledby="rel-h">
  <div class="wrap">
    <div class="rel__head"><h2 id="rel-h">Related reads</h2><a class="lnk" href="/blog/">All articles</a></div>
    <div class="bc-grid">
{chr(10).join(card(q, "h3") for q in related)}
    </div>
  </div>
</section>

''' + build.final(f"New villa revenue analysis - IndaVillas (Blog: {p['slug']})", p["n"], "terrace") + build.footer())
    page = page.replace("</body>", script_tag())
    out = OUT / p["slug"] / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build.typeset(page))
    return p["words"], p["minutes"]


def index_page(posts):
    order = sorted(posts, key=lambda q: (not q.get("featured"), q["n"]))
    first = order[0]
    cats = []
    for q in order:
        if q["pillar"] not in cats:
            cats.append(q["pillar"])
    count = {c: sum(q["pillar"] == c for q in posts) for c in cats}
    pills = "\n".join(
        f'      <button type="button" class="pill" data-filter="{slug_of(c)}" aria-pressed="false">{c} <span>{count[c]}</span></button>'
        for c in cats)
    graph = org_nodes() + [
        {"@type": "CollectionPage", "@id": SITE + "/blog/#webpage", "url": SITE + "/blog/", "name": BLOG_TITLE,
         "description": BLOG_DESC, "inLanguage": "en", "isPartOf": {"@id": WEBSITE}, "about": {"@id": BLOG},
         "breadcrumb": {"@id": SITE + "/blog/#breadcrumb"},
         "mainEntity": {"@type": "ItemList", "itemListElement": [
             {"@type": "ListItem", "position": i, "url": q["url"], "name": q["title"]} for i, q in enumerate(order, 1)]}},
        crumbs_ld(SITE + "/blog/", [("Home", "/"), ("Blog", "/blog/")]),
    ]
    page = (head(BLOG_TITLE, BLOG_DESC, "/blog/", "The IndaVillas blog", first["og_image"], graph) + "\n"
            + build.header(chrome()) + f'''<section class="bl-hero s-lime" id="top" data-hero aria-labelledby="hero-title">
  <div class="wrap">
    <p class="tag">Blog</p>
    <h1 class="bl-hero__title" id="hero-title">Run the villa <em>like a business.</em></h1>
    <p class="bl-hero__lede">Market data on 5+ bedroom villas in Bali, and what we have learned running the commercial side of them: listings, photography, pricing, reviews and guest communication. Every figure names its source.</p>
    <a class="btn" href="#analysis">Get your free revenue analysis {build.btn_icon()}</a>
  </div>
</section>

<section class="bl s-lime" aria-label="Articles">
  <div class="wrap">
    <div class="bl-filter" role="group" aria-label="Filter by topic" data-filters hidden>
      <button type="button" class="pill" data-filter="all" aria-pressed="true">All topics <span>{len(posts)}</span></button>
{pills}
    </div>
    <p class="sr-only" role="status" aria-live="polite" data-filter-status></p>
    <div class="bc-grid bc-grid--index">
{chr(10).join(card(q) for q in order)}
    </div>
    <p class="bl-empty" data-filter-empty hidden>No articles in this topic yet. <button type="button" class="lnk" data-filter="all">Show all articles</button></p>
    <p class="bl__note">New articles follow the same subjects as our Instagram, <a href="{build.INSTAGRAM}" rel="noopener">@inda.villas</a>. Subscribe with the <a href="/blog/feed.xml">feed</a>.</p>
  </div>
</section>

''' + build.final("New villa revenue analysis - IndaVillas (Blog)", "00", "cliff") + build.footer())
    page = page.replace("</body>", script_tag())
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(build.typeset(page))


def feed(posts):
    e = html.escape
    newest = max(p["updated"] for p in posts)
    entries = "".join(f'''
  <entry>
    <title>{e(p["title"])}</title>
    <link href="{p["url"]}"/>
    <id>{p["url"]}</id>
    <published>{iso(p["date"])}</published>
    <updated>{iso(p["updated"])}</updated>
    <category term="{e(p["pillar"])}"/>
    <summary>{e(p["desc"])}</summary>
  </entry>''' for p in sorted(posts, key=lambda q: q["n"], reverse=True))
    (OUT / "feed.xml").write_text(f'''<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>IndaVillas blog</title>
  <subtitle>{e(BLOG_DESC)}</subtitle>
  <link href="{SITE}/blog/"/>
  <link rel="self" href="{SITE}/blog/feed.xml"/>
  <id>{SITE}/blog/</id>
  <updated>{iso(newest)}</updated>
  <author><name>IndaVillas</name><uri>{SITE}/</uri></author>{entries}
</feed>
''')


def sitemap(posts):
    def day(rel):
        return dt.date.fromtimestamp((ROOT / rel).stat().st_mtime).isoformat()
    urls = [(p["path"], day(p["out"])) for p in build.PAGES if "noindex" not in p.get("robots", "")]
    urls.append(("/blog/", max(p["updated"] for p in posts)))
    urls += [(p["path"], p["updated"]) for p in posts]
    rows = "\n".join(f"  <url><loc>{SITE}{path}</loc><lastmod>{mod}</lastmod></url>" for path, mod in urls)
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + "\n</urlset>\n")
    return len(urls)


def llms(posts):
    lines = "\n".join(f"- [{p['title']}]({p['url']}): {p['desc']}" for p in posts)
    (ROOT / "llms.txt").write_text(f'''# IndaVillas

> IndaVillas runs the commercial side of 5+ bedroom luxury villas in Bali: rate strategy and pricing, listings, photography, distribution on the booking sites and guest communication. The owner's own team keeps running the house (arrivals, cleaning, maintenance) and guest payments stay with the owner. One flat yearly fee, quoted per villa, not a percentage of bookings. Legal entity: {build.LEGAL["name"]}, Canggu, Bali, Indonesia.

## Main pages
- [Home]({SITE}/): what IndaVillas does and for whom
- [Services]({SITE}/services/): listing, photography, pricing, guest communication, arrivals, concierge
- [The system]({SITE}/system/): the three phase revenue growth system
- [Pricing]({SITE}/pricing/): the Growth and Excellence plans, and how the flat fee compares
- [Listing audit]({SITE}/listing-audit/): free tool that scores an Airbnb or Booking.com listing out of 100
- [Revenue calculator]({SITE}/revenue-calculator/): free tool showing what booking site commission costs a villa

## Blog
{lines}

## Key facts (source: AirDNA, Bali, trailing 12 months to October 2026, analysis by IndaVillas)
- Population: 2,910 whole home Airbnb listings in Bali with 5 or more bedrooms, at least 180 days available and at least one reserved day.
- Median occupancy: 44%. 59% of these villas fill less than half their nights.
- Median yearly revenue: $46,000. Top 25% starts at $75,100; top 10% at $110,000.
- Top 25% of villas (median): $101,700 a year, $700 a night, 61% occupied.
- Bottom 25% (median): $8,900 a year, $341 a night, 22% occupied; includes many new or barely active listings.
- Villas rated 4.85 or higher (5+ reviews) had a median of $65,900 a year; villas rated under 4.5 had $30,500.
- Superhost villas had a median of $60,500 a year; others $32,000.
- These figures show patterns, not causes, and are not a forecast for any one villa.

## Contact
- Email: hi.flatiro@gmail.com
- Instagram: {build.INSTAGRAM}
''')


OG_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&family=Hanken+Grotesk:wght@500;600&display=block');
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{display:grid;grid-template-columns:1fr 420px;background:#0B1311;color:#EEE8DC;font-family:'Hanken Grotesk',sans-serif;-webkit-font-smoothing:antialiased}
.t{display:flex;flex-direction:column;padding:56px 56px 52px 64px}
.b{display:flex;align-items:center;gap:14px;font:500 26px/1 Poppins,sans-serif;letter-spacing:-.02em}
.b svg{height:28px;width:auto;color:#C9A15A}.b b{font-weight:600}
.k{margin-top:auto;font-size:22px;font-weight:600;color:#C9A15A}
h1{margin-top:16px;font:500 54px/1.04 Poppins,sans-serif;letter-spacing:-.045em}
.u{margin-top:28px;font-size:20px;color:rgba(238,232,220,.6)}
.p{background-size:cover;background-position:50% 60%}
.n{display:flex;flex-direction:column;justify-content:flex-end;padding:44px;background:#182520}
.n b{font:500 150px/.86 Poppins,sans-serif;letter-spacing:-.06em;color:#C9A15A}
.n b small{font-size:.36em;letter-spacing:-.03em;color:#EEE8DC}
.n span{margin-top:18px;font:500 23px/1.25 Poppins,sans-serif;letter-spacing:-.02em}
"""


def og_images(posts, force=False):
    made = 0
    for p in posts:
        out = IMG / p["og_image"]
        if out.exists() and not force:
            continue
        h = p["hero"]
        side = (f'<div class="p" style="background-image:url({(IMG / (h["img"] + "-1200.jpg")).as_uri()})"></div>' if "img" in h
                else f'<div class="n"><b>{h["num"]}</b><span>{h["label"]}</span></div>')
        size = 54 if len(p["title"]) < 62 else 46
        doc = (f'<!doctype html><meta charset=utf-8><style>{OG_CSS}</style><div class="t"><div class="b">{build.BRAND_MARK}'
               f'<span>Inda<b>Villas</b></span></div><div class="k">{p["pillar"]}</div><h1 style="font-size:{size}px">{p["title"]}</h1>'
               f'<div class="u">indavillas.com/blog</div></div>{side}')
        tmp_html, tmp_png = IMG / f"_tmp_{p['slug']}.html", IMG / f"_tmp_{p['slug']}.png"
        tmp_html.write_text(doc)
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--window-size=1200,630", "--virtual-time-budget=6000", f"--screenshot={tmp_png}", tmp_html.as_uri()],
                       check=True, capture_output=True)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "84", str(tmp_png), "--out", str(out)],
                       check=True, capture_output=True)
        tmp_html.unlink()
        tmp_png.unlink()
        made += 1
    return made


def main():
    posts = load()
    if "--og" in sys.argv:
        print(f"  share images rendered: {og_images(posts, force='--force' in sys.argv)}")
    for p in posts:
        p["words"] = len(text_of(p["lede"] + " ".join(p["key"]) + expand(p["body"])).split())
        p["minutes"] = max(2, round(p["words"] / 220))
    for p in posts:
        if not (IMG / p["og_image"]).exists():
            print(f"  WARNING {p['slug']}: share image missing, run with --og")
        words, minutes = article_page(p, posts)
        print(f"  blog/{p['slug']}/  {words} words, {minutes} min")
    index_page(posts)
    feed(posts)
    llms(posts)
    print(f"  blog/index.html, blog/feed.xml, llms.txt, sitemap.xml ({sitemap(posts)} URLs)")


if __name__ == "__main__":
    main()
