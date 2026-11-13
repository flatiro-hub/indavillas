page_home(){
cat <<HTML
<main id="main">

<!-- ============ HERO ============ -->
<section class="hero" id="top">
  <div class="hero__media">
    <img src="/assets/img/hero-villa.jpg" alt="" width="2000" height="1369" fetchpriority="high" decoding="async">
  </div>
  <div class="hero__scrim" aria-hidden="true"></div>
  <div class="wrap hero__inner">
    <div class="glass hero__panel">
      <span class="eyebrow">Revenue system for 5+ bedroom luxury villas</span>
      <h1>15 to 50% more villa revenue, <br class="lb">without lifting a finger.</h1>
      <p class="hero__sub hide-sm">We help owners of 5+ bedroom luxury villas grow rental revenue within 90 days. You keep the asset; we run the commercial side.</p>
      <div class="hero__stats">
        <span class="pill">15 to 50% revenue lift</span>
        <span class="pill">90 day rollout</span>
        <span class="pill">Hands off for owners</span>
      </div>
    </div>
$(lead_form hero "New villa revenue analysis - IndaVillas (Home)")
  </div>
</section>

<!-- ============ TRUST STRIP ============ -->
<section class="trust">
  <div class="wrap trust__row">
    <span class="trust__label">Listed &amp; optimised on</span>
    <div class="trust__logos">
      <span class="plogo">airbnb</span>
      <span class="plogo">Booking.com</span>
      <span class="plogo">Vrbo</span>
      <span class="plogo">Google<small>Vacation Rentals</small></span>
      <span class="plogo">Expedia</span>
    </div>
  </div>
</section>

<!-- ============ THREE ROUTES IN ============ -->
<section class="section section--sand">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">Where to start</span>
      <h2>One team, one system, <span class="teal">one number that matters</span>.</h2>
      <p>Product, pricing, demand and guest experience, run as a single strategy instead of scattered efforts.</p>
      <hr class="rule-line">
    </div>

    <div class="grid grid--3">
      <article class="card">
        <span class="card__ic">$(icon chart-bar 24)</span>
        <h3>Villa management service</h3>
        <p>Listing, photography, pricing and guest communication: the services that put your villa in front of the right guests, to five star standards.</p>
        <a class="link-arrow" href="/services/">See the services $ARR</a>
      </article>

      <article class="card">
        <span class="card__ic">$(icon trend-up 24)</span>
        <h3>The growth system</h3>
        <p>A structured three phase model delivered over 12 to 24 months: build the foundation, generate demand, then maximise profitability.</p>
        <a class="link-arrow" href="/system/">See how it works $ARR</a>
      </article>

      <article class="card">
        <span class="card__ic">$(icon currency-dollar 24)</span>
        <h3>Transparent pricing</h3>
        <p>One flat yearly fee: Growth at \$3,999 a year with setup included, or Excellence, quoted for your villa.</p>
        <a class="link-arrow" href="/pricing/">See pricing $ARR</a>
      </article>
    </div>
  </div>
</section>

<!-- ============ TAGLINE ============ -->
<section class="tagline">
  <div class="wrap">
    <div class="tagline__inner">
      <span class="tagline__label">For the owner</span>
      <p class="tagline__text" data-tagline>You keep the asset and the upside. <br class="lb">We run the commercial side.</p>
    </div>
  </div>
</section>

<!-- ============ HANDS OFF OWNERSHIP BAND ============ -->
<section class="band">
  <img class="band__bg" src="/assets/img/villa-living.jpg" alt="" loading="lazy" decoding="async">
  <div class="wrap band__inner">
    <div class="band__card">
      <span class="eyebrow">Hands off ownership</span>
      <h2>Your villa, run like a business.</h2>
      <p>We increase rental revenue by 15 to 50% within 90 days, without the owner needing to lift a finger.</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="#analysis">Get your free revenue analysis $ARR</a>
      </div>
    </div>
  </div>
</section>

<!-- ============ THREE PHASES ============ -->
<section class="section section--paper" id="phases">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">How it works</span>
      <h2>Three phases from <span class="teal">listing</span> to <span class="teal">landmark</span>.</h2>
      <hr class="rule-line">
    </div>

    <div>
      <article class="split">
        <div class="split__media">
          <img src="/assets/img/villa-interior.jpg" alt="Luxury villa interior at sunset" loading="lazy" decoding="async" width="1238" height="691">
          <span class="split__badge" aria-hidden="true">01</span>
        </div>
        <div>
          <h3 class="split__title"><b>Phase 1:</b> Foundation</h3>
          <ul class="ticks">
            <li>$TICK Revenue gap analysis.</li>
            <li>$TICK Benchmark against comparable villas.</li>
            <li>$TICK Amenity upgrades with the highest return.</li>
            <li>$TICK Optimised pricing and minimum stays.</li>
            <li>$TICK Positioning and target guest defined.</li>
          </ul>
        </div>
      </article>

      <article class="split split--rev">
        <div class="split__media">
          <img src="/assets/img/villa-pool.jpg" alt="Luxury villa with pool and ocean view" loading="lazy" decoding="async" width="1307" height="729">
          <span class="split__badge" aria-hidden="true">02</span>
        </div>
        <div>
          <h3 class="split__title"><b>Phase 2:</b> Growth</h3>
          <ul class="ticks">
            <li>$TICK Upgraded listing story and visuals.</li>
            <li>$TICK Customer retention marketing.</li>
            <li>$TICK Partnerships for weddings, retreats and offsites.</li>
            <li>$TICK Perceived value raised across every touchpoint.</li>
            <li>$TICK Less dependence on booking sites over time.</li>
          </ul>
        </div>
      </article>

      <article class="split">
        <div class="split__media">
          <img src="/assets/img/villa-living.jpg" alt="Premium villa living space" loading="lazy" decoding="async" width="1238" height="691">
          <span class="split__badge" aria-hidden="true">03</span>
        </div>
        <div>
          <h3 class="split__title"><b>Phase 3:</b> Excellence</h3>
          <ul class="ticks">
            <li>$TICK A consistent premium brand at every touchpoint.</li>
            <li>$TICK Guest experience designed to drive five star reviews.</li>
            <li>$TICK Owner dashboards with full transparency.</li>
            <li>$TICK Higher nightly rates from ongoing marketing campaigns.</li>
          </ul>
        </div>
      </article>
    </div>

    <div class="center-row">
      <a class="btn btn--outline" href="/system/">See the full three phase model $ARR</a>
    </div>
  </div>
</section>

<!-- ============ PROOF NUMBERS ============ -->
<section class="section section--tight section--sand">
  <div class="wrap">
    <div class="stats">
      <div class="stat"><span class="stat__n">15 to 50%</span><span class="stat__l">Revenue lift within 90 days</span></div>
      <div class="stat"><span class="stat__n">10 days</span><span class="stat__l">From signature to live on every platform</span></div>
      <div class="stat"><span class="stat__n">87%</span><span class="stat__l">Average occupancy across managed villas</span></div>
      <div class="stat"><span class="stat__n">24 yrs</span><span class="stat__l">Combined revenue &amp; marketing experience</span></div>
    </div>
  </div>
</section>

<!-- ============ MAXIMIZED RETURNS BAND ============ -->
<section class="band band--right">
  <img class="band__bg" src="/assets/img/villa-pool.jpg" alt="" loading="lazy" decoding="async">
  <div class="wrap band__inner">
    <div class="band__card">
      <span class="eyebrow">The 20% rule</span>
      <h2>Maximized returns.</h2>
      <p>If our analysis can't show at least 20% more revenue for your villa, even after our fee, we don't take the property on. No fee, no obligation, no wasted season.</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="#analysis">Claim your free analysis $ARR</a>
      </div>
    </div>
  </div>
</section>

</main>
HTML
}
