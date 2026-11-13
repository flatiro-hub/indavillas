page_services(){
cat <<HTML
<main id="main">

<!-- ============ HERO ============ -->
<section class="hero hero--short" id="top">
  <div class="hero__media">
    <img src="/assets/img/villa-drone.jpg" alt="" width="1600" height="1067" fetchpriority="high" decoding="async">
  </div>
  <div class="hero__scrim" aria-hidden="true"></div>
  <div class="wrap hero__inner">
    <div class="glass hero__panel">
      <span class="eyebrow">What we do · Villa management service</span>
      <h1 class="h1--parts">
        <span class="grad">Villa management</span>
        <span class="sr-only">services, revenue optimizers, guest experience enchanters.</span>
        <span class="rot" aria-hidden="true"><span class="rot__w" data-rotate='["services.","revenue optimizers.","guest experience enchanters."]'>services.</span></span>
      </h1>
      <p class="hero__sub">One team for the services that fill your calendar, from the listing that sells the villa to the welcome that brings guests back.</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="#analysis">Get your free revenue analysis $ARR</a>
      </div>
      <p class="hero__proof">$(icon check-circle 18) Listed and optimised on Airbnb, Booking.com, Vrbo and Google Vacation Rentals</p>
    </div>
  </div>
</section>

<!-- ============ SERVICES GRID ============ -->
<section class="section section--sand" id="services">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">Our services</span>
      <h2>The services that <span class="teal">move the numbers</span>.</h2>
      <p>Six disciplines, handled by one team that answers for the result.</p>
      <hr class="rule-line">
    </div>

    <div class="grid grid--3">
      <article class="card">
        <span class="card__num" aria-hidden="true">01</span>
        <span class="card__ic">$(icon clipboard-text 24)</span>
        <h3>Listing your property</h3>
        <p>Our hospitality, tourism and marketing specialists craft listings that highlight every unique feature of your home, so it stands out and attracts the right guests.</p>
      </article>

      <article class="card">
        <span class="card__num" aria-hidden="true">02</span>
        <span class="card__ic">$(icon camera 24)</span>
        <h3>Professional photography</h3>
        <p>A picture is worth a thousand words, and several thousand dollars a season. Our property photographers capture the villa in magazine quality images that inspire bookings.</p>
      </article>

      <article class="card">
        <span class="card__num" aria-hidden="true">03</span>
        <span class="card__ic">$(icon megaphone 24)</span>
        <h3>Advertising &amp; price optimisation</h3>
        <p>Advanced SEO, dynamic pricing tools and live market data keep your villa visible and competitively priced, lifting both occupancy and profit.</p>
      </article>

      <article class="card">
        <span class="card__num" aria-hidden="true">04</span>
        <span class="card__ic">$(icon headset 24)</span>
        <h3>24/7 guest communication</h3>
        <p>Every enquiry and message handled with care, from first contact to the day guests leave. Attentive communication is what produces glowing reviews and repeat guests.</p>
      </article>

      <article class="card">
        <span class="card__num" aria-hidden="true">05</span>
        <span class="card__ic">$(icon door-open 24)</span>
        <h3>Seamless arrivals</h3>
        <p>Smart locks and key safes, clear digital instructions and prompt messaging support, coordinated with your local team.</p>
      </article>

      <article class="card">
        <span class="card__num" aria-hidden="true">06</span>
        <span class="card__ic">$(icon sparkle 24)</span>
        <h3>Additional services</h3>
        <p>We go beyond the stay: premium transport, curated experiences and personal recommendations, delivered with trusted local partners.</p>
      </article>
    </div>
  </div>
</section>

<!-- ============ TAGLINE ============ -->
<section class="tagline">
  <div class="wrap">
    <div class="tagline__inner">
      <span class="tagline__label">One team, one standard</span>
      <p class="tagline__text" data-tagline>Nothing falls between the cracks, <br class="lb">because nothing is handed to <br class="lb">a different agenda.</p>
    </div>
  </div>
</section>

<!-- ============ WHAT IT MEANS FOR THE OWNER ============ -->
<section class="section section--paper">
  <div class="wrap">
    <div class="split">
      <div class="split__media">
        <img src="/assets/img/villa-interior.jpg" alt="Villa interior prepared for guest arrival" loading="lazy" decoding="async" width="1238" height="691">
      </div>
      <div>
        <span class="eyebrow">The owner's side</span>
        <h2 class="split__title" style="margin-top:var(--sp-200)">What you actually have to do.</h2>
        <ul class="ticks">
          <li>$TICK <span><b>Nothing commercial to handle.</b> Enquiries, pricing, guest communication and reviews are ours. Cleaning and property care stay with your trusted local team, and we coordinate the schedule.</span></li>
          <li>$TICK <span><b>One monthly report.</b> Revenue, occupancy, nightly rate and what we changed, in plain language.</span></li>
          <li>$TICK <span><b>Full visibility, any time.</b> An owner dashboard with the calendar, payouts and expenses.</span></li>
          <li>$TICK <span><b>Your villa, your rules.</b> Owner stays blocked whenever you want them.</span></li>
        </ul>
        <div class="btn-row">
          <a class="btn btn--outline" href="/pricing/">See what it costs $ARR</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ BAND CTA ============ -->
<section class="band">
  <img class="band__bg" src="/assets/img/villa-pool.jpg" alt="" loading="lazy" decoding="async">
  <div class="wrap band__inner">
    <div class="band__card">
      <span class="eyebrow">One standard, throughout</span>
      <h2>See what your villa could earn.</h2>
      <p>From the listing and the pricing through to guest communication: one team, one standard, and a clear line of accountability.</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="#analysis">Get your free revenue analysis $ARR</a>
      </div>
    </div>
  </div>
</section>

</main>
HTML
}
