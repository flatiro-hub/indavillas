page_revenue(){
cat <<HTML
<main id="main">

<!-- ============ HERO ============ -->
<section class="hero hero--short" id="top">
  <div class="hero__media">
    <img src="/assets/img/villa-pool.jpg" alt="" width="1307" height="729" fetchpriority="high" decoding="async">
  </div>
  <div class="hero__scrim" aria-hidden="true"></div>
  <div class="wrap hero__inner">
    <div class="glass hero__panel">
      <span class="eyebrow">Free tool · Direct-booking model</span>
      <h1>Stop bleeding <span class="em">Airbnb revenue.</span></h1>
      <p class="hero__sub">5-bedroom-plus properties hand up to <b>USD 5,000 a month</b> to platform commissions and unforgiving algorithms. Put your own numbers in below and see what the fees are actually costing you.</p>
      <div class="hero__stats">
        <span class="pill">Takes 30 seconds</span>
        <span class="pill">Your numbers, not ours</span>
        <span class="pill">No email required</span>
      </div>
      <div class="btn-row">
        <a class="btn btn--primary" href="#model">Run the numbers <span class="arr" aria-hidden="true">→</span></a>
        <a class="btn btn--glass" href="/listing-audit/">Audit my listing instead</a>
      </div>
    </div>
  </div>
</section>

<!-- ============ THE MODEL ============ -->
<section class="section section--sand" id="model">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">The maths</span>
      <h2>What the commission is <span class="teal">really</span> costing you.</h2>
      <p>Every figure here is one you control. Change any of them and the answer updates instantly - nothing is hidden, nothing is assumed on your behalf.</p>
      <hr class="rule-line">
    </div>

    <div class="model" style="margin-top:clamp(40px,5vw,62px)">
      <div class="model__panel">
        <h3>Your villa</h3>

        <label class="field">
          <span class="field__label">Average nightly rate</span>
          <span class="field__money">
            <span aria-hidden="true">\$</span>
            <input type="number" id="dbc-rate" value="650" min="0" step="10" inputmode="numeric" aria-label="Average nightly rate in US dollars">
          </span>
          <span class="field__hint">What a typical night bills at, averaged across the year.</span>
        </label>

        <div class="slider">
          <div class="slider__top"><label for="dbc-occ">Occupancy</label><b data-dbc="occ-v">65%</b></div>
          <input type="range" id="dbc-occ" min="20" max="95" step="1" value="65">
          <div class="slider__scale"><span>20%</span><span>95%</span></div>
        </div>

        <div class="slider">
          <div class="slider__top"><label for="dbc-com">Platform commission</label><b data-dbc="com-v">15%</b></div>
          <input type="range" id="dbc-com" min="3" max="25" step="1" value="15">
          <div class="slider__scale"><span>3%</span><span>25%</span></div>
        </div>

        <div class="slider">
          <div class="slider__top"><label for="dbc-dir">Bookings moved direct</label><b data-dbc="dir-v">40%</b></div>
          <input type="range" id="dbc-dir" min="10" max="80" step="5" value="40">
          <div class="slider__scale"><span>10%</span><span>80%</span></div>
        </div>
      </div>

      <div class="model__out">
        <div class="model__headline">
          <span>You are handing the platforms</span>
          <b class="model__big"><span data-dbc="feesnow">\$23,725</span><small>a year</small></b>
        </div>

        <div class="mrows">
          <div class="mrow"><span>Annual gross revenue</span><b data-dbc="gross">\$158,166</b></div>
          <div class="mrow"><span>Platform fees after going direct</span><b data-dbc="feesafter">\$14,235</b></div>
          <div class="mrow"><span>Card processing on direct bookings (2%)</span><b data-dbc="processing">\$1,265</b></div>
          <div class="mrow mrow--keep"><span>You keep</span><b data-dbc="keep">\$8,225</b></div>
          <div class="mrow"><span>That is per month</span><b data-dbc="monthly">\$685</b></div>
        </div>

        <p class="model__note">The saving is what stays in your account after the platform fee you no longer pay, less roughly 2% card processing on direct bookings - but before website and marketing costs. We would rather show you the honest number than a flattering one.</p>

        <div class="model__cta"><a class="btn btn--gold" href="#analysis">Show me how to capture this <span class="arr" aria-hidden="true">→</span></a></div>
      </div>
    </div>
  </div>
</section>

<!-- ============ WHERE THE MONEY GOES ============ -->
<section class="section section--paper">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">Three leaks</span>
      <h2>Commission is only the <span class="teal">visible</span> loss.</h2>
      <hr class="rule-line">
    </div>

    <div class="grid grid--3" style="margin-top:clamp(38px,5vw,58px)">
      <article class="leak">
        <span class="leak__n" aria-hidden="true">01</span>
        <div>
          <h3>The fee you can see</h3>
          <p>Between 3% and 25% of every booking, depending on your fee tier and market. On a villa grossing six figures that is a salary leaving the building each year.</p>
        </div>
      </article>
      <article class="leak">
        <span class="leak__n" aria-hidden="true">02</span>
        <div>
          <h3>The rate the algorithm sets</h3>
          <p>Smart Pricing optimises for the platform's booking volume, not your yield. Villas routinely sit 10-20% under what their calendar could hold on peak dates.</p>
        </div>
      </article>
      <article class="leak">
        <span class="leak__n" aria-hidden="true">03</span>
        <div>
          <h3>The guest you never own</h3>
          <p>Every repeat stay booked through the platform pays commission again. Without their email you rebuy the same guest, year after year.</p>
        </div>
      </article>
    </div>
  </div>
</section>

<!-- ============ HOW WE FIX IT ============ -->
<section class="section section--sand">
  <div class="wrap">
    <div class="split">
      <div class="split__media">
        <img src="/assets/img/villa-interior.jpg" alt="Luxury villa interior" loading="lazy" decoding="async" width="1238" height="691">
      </div>
      <div>
        <span class="eyebrow">What we actually do</span>
        <h2 class="split__title" style="margin-top:.5em">Direct bookings, without losing the platforms.</h2>
        <ul class="ticks">
          <li>$TICK <span><b>Keep the OTAs working.</b> They stay switched on for discovery - we simply stop them owning every repeat guest.</span></li>
          <li>$TICK <span><b>A direct booking engine.</b> Your own site, your own calendar, no third-party commission on the booking.</span></li>
          <li>$TICK <span><b>Own the guest list.</b> Post-stay campaigns and referral offers that bring guests back without paying to reach them twice.</span></li>
          <li>$TICK <span><b>Pricing set to your yield.</b> Seasonality, weekends and events priced for your revenue, not the platform's volume.</span></li>
        </ul>
        <div class="btn-row">
          <a class="btn btn--outline" href="/system/">See the full growth system <span class="arr" aria-hidden="true">→</span></a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ BAND ============ -->
<section class="band band--right">
  <img class="band__bg" src="/assets/img/villa-living.jpg" alt="" loading="lazy" decoding="async">
  <div class="wrap band__inner">
    <div class="band__card">
      <span class="eyebrow">Your actual numbers</span>
      <h2 style="margin-top:.4em">A model is not an audit.</h2>
      <p>The calculator above uses your estimates. The free revenue gap analysis uses your real listing, your real calendar and comparable villas in your market - and tells you what the gap is worth.</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="#analysis">Get the free analysis <span class="arr" aria-hidden="true">→</span></a>
        <a class="btn btn--outline" href="/listing-audit/">Audit my listing</a>
      </div>
    </div>
  </div>
</section>

</main>
HTML
}
