#!/usr/bin/env bash
# Assembles the four static pages from the shared parts + page bodies.
# Run:  bash _build/build.sh      (from the site root)
set -euo pipefail
cd "$(dirname "$0")/.."
# Stamp appended to the CSS/JS URLs. .htaccess caches those for a year, so
# without it a returning visitor would keep the old files after a re-upload.
# Regenerated on every build; bumping it is automatic.
ASSET_V=$(date +%Y%m%d%H%M)

. _build/parts.sh
. _build/pages/home.sh
. _build/pages/services.sh
. _build/pages/system.sh
. _build/pages/pricing.sh
. _build/pages/foundation.sh

SCHEMA='<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"ProfessionalService",
  "name":"IndaVillas",
  "description":"Rental revenue management for 5+ bedroom luxury villas. 15 to 50% more revenue in 90 days.",
  "url":"https://indavillas.com/",
  "image":"https://indavillas.com/assets/img/hero-villa.jpg",
  "email":"hi.flatiro@gmail.com",
  "priceRange":"From USD 3,999 a year",
  "areaServed":"Worldwide",
  "serviceType":"Luxury villa short-term rental management"
}
</script>'

build(){ # build <outfile> <active> <title> <desc> <canonical> <bodyfn> <subject> <suffix> <extra-head>
  local out=$1 active=$2 title=$3 desc=$4 canon=$5 bodyfn=$6 subj=$7 sfx=$8 extra=${9:-}
  { head_open "$title" "$desc" "$canon" "$extra"
    site_header "$active" overlay
    $bodyfn
    final_cta "$subj" "$sfx"
    site_footer
  } > "$out"
  printf "  %-28s %s\n" "$out" "$(wc -c < "$out" | awk '{printf "%.0f KB", $1/1024}')"
}

echo "Building IndaVillas…"

# Home, Services, The system and Pricing are built by _v3/build.py (design v3, from
# 11 November 2026). This script must not write index.html, services/, system/ or
# pricing/; pages/home.sh, services.sh, system.sh and pricing.sh are the retired versions.

# /revenue-calculator/ and /listing-audit/ moved to design v4 on 11 November 2026 and are
# now written by _v4/build.py (pages/revenue.sh and pages/audit.sh are the retired
# versions; their old script stays at assets/js/audit.js for reference). Never build
# them here again, or the v4 pages are overwritten.


# Foundation, the $290 audit - an ads landing page, so no site header or footer.
# It runs on assets/css/foundation.css, a frozen copy of the October stylesheet,
# so the November design system on the main pages leaves the live ad untouched:
# nothing on it leads away from the offer. It carries its own snapshot form, a
# phone dock and a link-free footer. Its script is an ES module because it
# imports Flatiro's scoring engine from assets/js/engine/.
mkdir -p foundation
{ head_open "Audit Your Listing in 1 Minute - Free Airbnb Revenue Snapshot | IndaVillas" \
    "Paste your Airbnb or Booking.com link and get a free revenue snapshot in about a minute. Then unlock Foundation: a full comp audit and a 60-minute live consult for \$290." \
    "/foundation/" "<script type=\"module\" src=\"/assets/js/foundation.js?v=$ASSET_V\"></script>" foundation
  page_foundation
  foundation_footer
} > foundation/index.html
printf "  %-28s %s\n" "foundation/index.html" "$(wc -c < foundation/index.html | awk '{printf "%.0f KB", $1/1024}')"

echo "Done."

# --- 404 -------------------------------------------------------------------
page_404(){
cat <<HTML
<main id="main">
  <section class="section" id="top" style="padding-top:calc(var(--header-h) + clamp(60px,10vw,120px));min-height:70svh;display:grid;place-items:center;text-align:center">
    <div class="wrap wrap--narrow">
      <span class="eyebrow">Error 404</span>
      <h1 class="h1" style="margin:.4em 0 .5em">This page has checked out.</h1>
      <p class="lead-p">The page you were looking for isn't here any more. Everything else is one click away.</p>
      <div class="btn-row" style="justify-content:center">
        <a class="btn btn--primary" href="/">Back to home</a>
        <a class="btn btn--outline" href="/services/">Our services</a>
        <a class="btn btn--outline" href="/pricing/">Pricing</a>
      </div>
    </div>
  </section>
</main>
HTML
}
{ head_open "Page not found - IndaVillas" "The page you were looking for is no longer available." "/404.html" ""
  site_header none static
  page_404
  site_footer
} > 404.html
# the 404 page has no CTA section of its own - point its CTAs at the home page's
sed -i '' 's|href="#analysis"|href="/#analysis"|g' 404.html
printf "  %-28s %s\n" "404.html" "$(wc -c < 404.html | awk '{printf "%.0f KB", $1/1024}')"
