# Shared page furniture. Sourced by build.sh - not uploaded to the server.
. _build/icons.sh
BRAND_MARK='<svg viewBox="0 0 296 244" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true"><polygon points="0,0 88,0 44,75"/><polygon points="88,24 88,150 51,88"/><polygon points="100,23 100,166 141,95"/><polygon points="142,117 142,244 106,179"/><polygon points="154,117 154,244 190,179"/><polygon points="196,23 196,166 155,95"/><polygon points="208,24 208,150 245,88"/><polygon points="296,0 208,0 252,75"/></svg>'
TICK=$(icon check 18)
ARR="<span class=\"arr\">$(icon arrow-right 18)</span>"
LOCK=$(icon lock-simple 16)
DONE=$(icon check-circle 24)

# head_open  <title> <description> <canonical-path> <extra-head> [stylesheet]
# The stylesheet defaults to site.css. The Foundation ads page passes
# "foundation": its frozen copy, which still sets body text in Hanken Grotesk.
head_open(){
  local css="${5:-site}" fonts="family=Poppins:wght@400;500;600"
  [ "$css" = "foundation" ] && fonts="family=Poppins:wght@400;500;600&family=Hanken+Grotesk:wght@400;500;600"
  # Link previews (WhatsApp, Slack, LinkedIn, Facebook) render og:site_name
  # immediately followed by og:title. Keeping the brand in both doubles it, so
  # og:title gets the page name alone; <title> keeps the brand for the tab and
  # for search results, where it stands on its own.
  local OG_TITLE="$1"
  OG_TITLE="${OG_TITLE#IndaVillas - }"
  OG_TITLE="${OG_TITLE% | IndaVillas}"
  OG_TITLE="${OG_TITLE% - IndaVillas}"
cat <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$1</title>
<meta name="description" content="$2">
<link rel="canonical" href="https://indavillas.com$3">
<meta name="theme-color" content="#F4F0E7">
<meta name="robots" content="index, follow, max-image-preview:large">

<meta property="og:type" content="website">
<meta property="og:site_name" content="IndaVillas">
<meta property="og:title" content="$OG_TITLE">
<meta property="og:description" content="$2">
<meta property="og:url" content="https://indavillas.com$3">
<meta property="og:image" content="https://indavillas.com/assets/img/hero-villa.jpg">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/favicon.svg">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?$fonts&display=swap">
<link rel="stylesheet" href="/assets/css/$css.css?v=$ASSET_V">
$4
<script src="/assets/js/site.js?v=$ASSET_V" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
HTML
}

# site_header  <active: home|services|system|pricing>  <static|overlay>
site_header(){
  local a="$1" mode="$2" cls=""
  [ "$mode" = "static" ] && cls=" site-header--static"
  cur(){ [ "$a" = "$1" ] && printf ' aria-current="page"'; }
cat <<HTML
<header class="site-header$cls">
  <div class="site-header__inner">
    <a class="brand" href="/" aria-label="IndaVillas - home">
      <span class="brand__mark">$BRAND_MARK</span>
      <span><b>Inda</b>Villas</span>
    </a>

    <nav class="nav" aria-label="Primary">
      <a class="nav__link" href="/"$(cur home)>Home</a>
      <a class="nav__link" href="/services/"$(cur services)>Services</a>
      <a class="nav__link" href="/system/"$(cur system)>The system</a>
      <a class="nav__link" href="/pricing/"$(cur pricing)>Pricing</a>
    </nav>

    <div class="header__cta">
      <a class="btn btn--primary btn--sm" href="#analysis">Free analysis</a>
      <button class="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<div class="drawer" id="drawer" hidden>
  <nav class="drawer__nav" aria-label="Mobile">
    <a class="drawer__link" href="/"$(cur home)>Home <span class="drawer__n">01</span></a>
    <a class="drawer__link" href="/services/"$(cur services)>Services <span class="drawer__n">02</span></a>
    <a class="drawer__link" href="/system/"$(cur system)>The system <span class="drawer__n">03</span></a>
    <a class="drawer__link" href="/pricing/"$(cur pricing)>Pricing <span class="drawer__n">04</span></a>
  </nav>
  <div class="drawer__foot">
    <a class="btn btn--primary btn--block" href="#analysis">Get your free revenue analysis</a>
    <div class="drawer__meta">
      <a href="mailto:hi.flatiro@gmail.com">hi.flatiro@gmail.com</a>
      <span>Management for 5+ bedroom luxury villas.</span>
    </div>
  </div>
</div>

<div class="dock" aria-hidden="false">
  <div class="dock__row">
    <a class="btn btn--primary btn--sm btn--block" href="#analysis">Free revenue analysis</a>
  </div>
</div>
HTML
}

# lead_form  <id-suffix>  <email-subject>  [dark]
lead_form(){
  local s="$1" subj="$2" dark="${3:-}" mod=""
  [ "$dark" = "dark" ] && mod=" lead--dark lead--center"
cat <<HTML
<div class="lead$mod">
  <form class="lead__form" data-lead aria-label="Request your free revenue gap analysis">
    <input type="hidden" name="_subject" value="$subj">
    <input type="hidden" name="_template" value="table">
    <input type="hidden" name="_captcha" value="false">
    <input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
    <div class="lead__field">
      <label for="email-$s">Email address</label>
      <input type="email" id="email-$s" name="email" placeholder="you@email.com" autocomplete="email" required>
    </div>
    <div class="lead__field">
      <label for="whatsapp-$s">WhatsApp number</label>
      <input type="tel" id="whatsapp-$s" name="whatsapp" placeholder="+62 …" autocomplete="tel">
    </div>
    <div class="lead__field">
      <label for="property-$s">Property address</label>
      <input type="text" id="property-$s" name="property" placeholder="Villa location" autocomplete="street-address">
    </div>
    <div class="lead__field">
      <label for="bedrooms-$s">Bedrooms</label>
      <input type="number" id="bedrooms-$s" name="bedrooms" placeholder="5+" min="1" inputmode="numeric">
    </div>
    <div class="lead__submit"><button class="btn btn--primary" type="submit">Get my free analysis</button></div>
  </form>

  <div class="lead__success" role="status" aria-live="polite">
    $DONE
    <span>Thank you. Your revenue gap analysis is on its way, and we'll be in touch within one business day.</span>
  </div>

  <p class="lead__error" role="alert">Couldn't send that just now. Please try again, or <a href="mailto:hi.flatiro@gmail.com">email us directly</a>.</p>

  <p class="lead__note">
    $LOCK
    No obligation. We only take on properties we're confident we can grow.
  </p>
</div>
HTML
}

# audit_form  <id-suffix>  [dark]
audit_form(){
  local sfx="$1" dark="${2:-}" mod=""
  [ "$dark" = "dark" ] && mod=" lead--dark lead--center"
cat <<HTML
<div class="lead$mod">
  <form class="audit-form" data-lead aria-label="Request your free listing audit">
    <input type="hidden" name="_subject" value="New listing audit request - IndaVillas">
    <input type="hidden" name="_template" value="table">
    <input type="hidden" name="_captcha" value="false">
    <input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
    <div class="lead__field">
      <label for="listing-$sfx">Your Airbnb or Booking.com listing URL</label>
      <input type="url" id="listing-$sfx" name="listing_url" placeholder="https://www.airbnb.com/rooms/12345678" inputmode="url" required>
    </div>
    <div class="lead__field">
      <label for="aemail-$sfx">Where should we send the audit?</label>
      <input type="email" id="aemail-$sfx" name="email" placeholder="you@email.com" autocomplete="email" required>
    </div>
    <div class="lead__submit"><button class="btn btn--primary btn--block" type="submit">Audit my listing</button></div>
  </form>

  <div class="lead__success" role="status" aria-live="polite">
    $DONE
    <span>Got it. We're going through your listing now, and your scored audit lands in your inbox within one business day.</span>
  </div>

  <p class="lead__error" role="alert">Couldn't send that just now. Please try again, or <a href="mailto:hi.flatiro@gmail.com">email us the link directly</a>.</p>

  <p class="lead__note">
    $LOCK
    Free, no obligation. We only use your email to send the audit.
  </p>
</div>
HTML
}

# final_cta  <email-subject>  <id-suffix>
final_cta(){
cat <<HTML
<section class="final" id="analysis">
  <div class="final__video" data-video="Igwinx0keg8" aria-hidden="true"></div>
  <div class="wrap final__inner">
    <span class="eyebrow eyebrow--light">Free revenue gap analysis</span>
    <h2>Discover how much your villa could earn.</h2>
    <p class="sub">Management built around your villa, not a generic playbook. Tell us where the villa is and we'll send the numbers.</p>
$(lead_form "$2" "$1" dark)
  </div>
</section>
HTML
}

site_footer(){
cat <<HTML
<footer class="site-footer">
  <div class="wrap">
    <div class="footer__grid">
      <div class="footer__brand">
        <a class="brand" href="/">
          <span class="brand__mark">$BRAND_MARK</span>
          <span><b>Inda</b>Villas</span>
        </a>
        <p class="footer__blurb">Revenue management for 5+ bedroom luxury villas. We grow occupancy, nightly rate and long term asset value, while your own team keeps running the house.</p>
        <div class="footer__badges">
          <span class="fbadge">15 to 50% revenue lift</span>
          <span class="fbadge">Live in 10 days</span>
          <span class="fbadge">One flat yearly fee</span>
        </div>
      </div>

      <div class="footer__col">
        <h4>Explore</h4>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/services/">Services</a></li>
          <li><a href="/system/">The growth system</a></li>
          <li><a href="/pricing/">Pricing</a></li>
        </ul>
      </div>

      <div class="footer__col">
        <h4>Free tools</h4>
        <ul>
          <li><a href="/revenue-calculator/">Stop bleeding Airbnb revenue</a></li>
          <li><a href="/listing-audit/">Audit your listing in 1 minute</a></li>
        </ul>
      </div>

      <div class="footer__col">
        <h4>What we do</h4>
        <ul>
          <li><a href="/services/#services">Listing &amp; photography</a></li>
          <li><a href="/services/#services">Pricing optimisation</a></li>
          <li><a href="/services/#services">24/7 guest service</a></li>
          <li><a href="/system/#phases">Three phase growth model</a></li>
          <li><a href="/pricing/#gameplan">Revenue Gameplan</a></li>
        </ul>
      </div>

      <div class="footer__col">
        <h4>Talk to us</h4>
        <div class="footer__contact">
          <a href="mailto:hi.flatiro@gmail.com">
            $(icon envelope-simple 16)
            hi.flatiro@gmail.com
          </a>
          <a href="https://www.instagram.com/inda.villas/" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.5"/><circle cx="12" cy="12" r="4.25"/><circle cx="17.4" cy="6.6" r="1.05" fill="currentColor" stroke="none"/></g></svg>
            @inda.villas<span class="sr-only"> on Instagram (opens in a new tab)</span>
          </a>
          <p class="note">We reply within one business day. Free revenue gap analysis, no obligation.</p>
        </div>
        <div class="footer__cta"><a class="btn btn--gold btn--sm" href="#analysis">Get your free analysis</a></div>
      </div>
    </div>

    <div class="footer__platforms" aria-label="Distribution platforms">
      <span>Listed &amp; optimised on</span>
      <b>airbnb</b><b>Booking.com</b><b>Vrbo</b><b>Expedia</b><b>Google Vacation Rentals</b>
    </div>

    <div class="footer__bar">
      <p>&copy; <span data-year>2026</span> IndaVillas. All rights reserved. <a href="/privacy/">Privacy</a> &middot; <a href="/terms/">Terms</a></p>
      <a class="to-top" href="#top">
        Back to top
        $(icon arrow-up 16)
      </a>
    </div>
  </div>
</footer>
</body>
</html>
HTML
}
