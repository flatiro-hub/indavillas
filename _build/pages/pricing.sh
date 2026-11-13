page_pricing(){
local NO='<span class="pr-no" role="img" aria-label="Not included"></span>'
local YES="<span class=\"pr-yes\" role=\"img\" aria-label=\"Included\">$(icon check 16)</span>"
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
      <span class="eyebrow">Pricing</span>
      <h1>Your property, priced <br class="lb">like the top 25%.</h1>
      <p class="hero__sub">Professionally managed properties earn 25 to 36% more than those run by their owners. IndaVillas brings the rate strategy, content and distribution to your property for one flat yearly fee. Your own team keeps running the house.</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="#audit">Get a free revenue audit $ARR</a>
      </div>
      <p class="hero__proof">$(icon check-circle 18) Benchmarks from AirDNA data on Bali villas, 12 months to August 2026</p>
    </div>
  </div>
</section>

<!-- ============ THE GAP ============ -->
<section class="section section--paper" id="gap">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">The gap</span>
      <h2>Same size of property. <span class="teal">Up to \$28K more</span> a year.</h2>
      <p>Yearly revenue of properties in Bali listed all year, by size.</p>
      <hr class="rule-line">
    </div>

    <figure class="gap" data-reveal>
      <figcaption class="gap__head">
        <span class="gap__title">Yearly revenue, median vs top 25%</span>
        <span class="gap__legend" aria-hidden="true">
          <span><i class="gap__key gap__key--med"></i>Median</span>
          <span><i class="gap__key gap__key--top"></i>Top 25%</span>
        </span>
      </figcaption>
      <ul class="gap__rows">
        <li class="gap__row">
          <span class="gap__size">3 bedrooms</span>
          <span class="gap__bars">
            <span class="gap__bar gap__bar--med" style="--v:.378"><i class="gap__fill"></i><b>\$34K <em>median</em></b></span>
            <span class="gap__bar gap__bar--top" style="--v:.556"><i class="gap__fill"></i><b>\$50K <em>top 25%</em></b></span>
          </span>
          <span class="gap__plus">+\$16K a year</span>
        </li>
        <li class="gap__row">
          <span class="gap__size">4 bedrooms</span>
          <span class="gap__bars">
            <span class="gap__bar gap__bar--med" style="--v:.556"><i class="gap__fill"></i><b>\$50K <em class="sr-only">median</em></b></span>
            <span class="gap__bar gap__bar--top" style="--v:.789"><i class="gap__fill"></i><b>\$71K <em class="sr-only">top 25%</em></b></span>
          </span>
          <span class="gap__plus">+\$21K a year</span>
        </li>
        <li class="gap__row">
          <span class="gap__size">5 bedrooms</span>
          <span class="gap__bars">
            <span class="gap__bar gap__bar--med" style="--v:.689"><i class="gap__fill"></i><b>\$62K <em class="sr-only">median</em></b></span>
            <span class="gap__bar gap__bar--top" style="--v:1"><i class="gap__fill"></i><b>\$90K <em class="sr-only">top 25%</em></b></span>
          </span>
          <span class="gap__plus">+\$28K a year</span>
        </li>
      </ul>
      <p class="gap__src">Source: AirDNA, Bali entire home listings available 271 to 365 nights a year, 12 months to August 2026, rounded.</p>
    </figure>
  </div>
</section>

<!-- ============ PLANS ============ -->
<section class="section section--sand" id="plans">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">Plans</span>
      <h2>Two plans, <span class="teal">one flat fee each.</span></h2>
      <p>Growth is the easier way in: less commitment, built for 5+ bedroom properties and for smaller ones from 2 bedrooms that already perform well. Excellence adds the work that brings guests to you directly.</p>
      <hr class="rule-line">
    </div>

    <div class="plans plans--stretch">
      <div class="plan">
        <div class="plan__label">Growth</div>
        <p class="plan__desc">Entry plan for 5+ bedroom properties</p>
        <div class="plan__price">\$3,999<small>/ year</small><span>Setup included, billed once a year</span></div>
        <ul class="plan__list">
          <li>$TICK <span>Rate strategy and dynamic pricing</span></li>
          <li>$TICK <span>Airbnb, Booking.com and Google Vacation Rentals</span></li>
          <li>$TICK <span>Property brand and direct booking website</span></li>
          <li>$TICK <span>Photo shoot with 100+ photos</span></li>
        </ul>
        <div class="pr-bench">
          <span class="pr-bench__h">Benchmarks</span>
          <div><b>Bali 3 bedroom properties</b><span>Median \$34K a year, top 25% \$50K</span></div>
          <div><b>Bali 4 bedroom properties</b><span>Median \$50K a year, top 25% \$71K</span></div>
        </div>
        <div class="plan__cta"><a class="btn btn--outline btn--block" href="#audit" data-plan="Growth">Start with Growth</a></div>
      </div>

      <div class="plan plan--dark">
        <span class="plan__tag">Priced to your villa</span>
        <div class="plan__label">Excellence</div>
        <p class="plan__desc">For properties earning \$90K or more a year</p>
        <div class="plan__price">Custom<span>Quoted for your villa, setup included</span></div>
        <div class="plan__intro">Everything in Growth, plus</div>
        <ul class="plan__list">
          <li>$TICK <span>Drone photos, 360° tour and a cinematic film</span></li>
          <li>$TICK <span>Agoda, Expedia, Traveloka and Vrbo</span></li>
          <li>$TICK <span>4 social posts a month, with captions and design</span></li>
          <li>$TICK <span>Email and rebooking flows for past guests</span></li>
          <li>$TICK <span>Google and AI search optimisation</span></li>
          <li>$TICK <span>Outreach to travel agents and event organisers</span></li>
        </ul>
        <p class="pr-note">In Bali, \$90K a year is roughly the top 25% of 5 and 6 bedroom properties.</p>
        <div class="plan__cta"><a class="btn btn--gold btn--block" href="#audit" data-plan="Excellence">Get a custom quote</a></div>
      </div>
    </div>

    <div class="guarantee">
      <span class="guarantee__ic">$(icon house-line 24)</span>
      <p><b>Your team runs the house. We never hold your money.</b> Arrivals, cleaning, maintenance and guest payments stay with you and your team. We work on what decides the rate guests pay and whether they find you.</p>
      <a class="btn btn--gold" href="#included">Compare every feature</a>
    </div>
  </div>
</section>

<!-- ============ MORE THAN ONE PROPERTY + GAMEPLAN ============ -->
<section class="section section--paper" id="portfolio">
  <div class="wrap">
    <div class="pr-port">
      <div class="pr-port__txt" data-reveal>
        <span class="eyebrow">More than one property?</span>
        <h2 class="h2">Every extra property is <span class="teal">25% off.</span></h2>
        <p class="lead-p">Your highest priced property pays its plan in full. Every other property is 25% off, and your properties can be on different plans.</p>
        <ul class="pr-prices">
          <li><span>Each extra villa on Growth</span><b>\$2,999 a year</b></li>
          <li><span>Each extra villa on Excellence</span><b>Custom quote</b></li>
          <li><span>6 properties or more</span><b>Partner pricing</b></li>
        </ul>
        <p class="pr-eg"><b>Example:</b> two villas on Growth cost \$6,998 a year together.</p>
      </div>

      <div class="pq" data-port data-reveal>
        <h3>Price your properties</h3>
        <div class="pq__row">
          <span class="pq__name">On Excellence<small>Custom quote per villa</small></span>
          <span class="qty" role="group" aria-label="Properties on Excellence">
            <button type="button" data-step="exc" data-dir="-1" aria-label="One fewer on Excellence">$(icon minus 16)</button>
            <output data-count="exc" aria-live="polite">0</output>
            <button type="button" data-step="exc" data-dir="1" aria-label="One more on Excellence">$(icon plus 16)</button>
          </span>
        </div>
        <div class="pq__row">
          <span class="pq__name">On Growth<small>\$3,999, then \$2,999 each</small></span>
          <span class="qty" role="group" aria-label="Properties on Growth">
            <button type="button" data-step="gro" data-dir="-1" aria-label="One fewer on Growth">$(icon minus 16)</button>
            <output data-count="gro" aria-live="polite">2</output>
            <button type="button" data-step="gro" data-dir="1" aria-label="One more on Growth">$(icon plus 16)</button>
          </span>
        </div>
        <div data-quote>
          <ul class="pq__lines" data-lines>
            <li><span>Growth, highest priced property</span><b>\$3,999</b></li>
            <li><span>Growth x 1, 25% off</span><b>\$2,999</b></li>
          </ul>
          <div class="pq__total"><span>Total per year</span><b data-total>\$6,998</b></div>
          <p class="pq__save" data-save>You save \$1,000 a year against full price.</p>
        </div>
        <div class="pq__partner" data-partner hidden>
          <b>6 properties or more: partner pricing.</b>
          <span>We agree one price for the whole portfolio. Tell us how many properties you run and their sizes.</span>
        </div>
        <a class="btn btn--primary btn--block" href="#audit" data-plan="Several properties" data-port-cta>Price my properties $ARR</a>
      </div>
    </div>

    <div class="pr-gp" id="gameplan" data-reveal>
      <div class="pr-gp__txt">
        <span class="eyebrow eyebrow--gold">Smaller villa, or want to run it yourself?</span>
        <h3>Start with the Revenue Gameplan</h3>
        <p>A comparison against similar properties near you, a 90 day action plan, pricing and minimum stay rules, and a recorded walkthrough. Built for 1 and 2 bedroom properties.</p>
        <p class="pr-gp__credit">The full \$290 counts toward either plan if you start within 30 days.</p>
      </div>
      <div class="pr-gp__buy">
        <div class="pr-gp__price">\$290<span>one time</span></div>
        <a class="btn btn--gold" href="/foundation/">Get the Gameplan $ARR</a>
      </div>
    </div>
  </div>
</section>

<!-- ============ EVERYTHING IN EACH PLAN ============ -->
<section class="section section--sand" id="included">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">Compare plans</span>
      <h2>Everything in <span class="teal">each plan.</span></h2>
      <p>Growth covers pricing, listings, reporting, content and your own website. Excellence adds direct demand: more booking sites, social content, search, email, repeat guests and partners.</p>
      <hr class="rule-line">
    </div>

    <div class="pr-tables">
      <div class="pr-table-wrap" data-reveal>
        <table class="pr-table">
          <thead>
            <tr><th scope="col">Revenue and distribution</th><th scope="col">Growth</th><th scope="col" class="is-pro">Excellence</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Channel manager set up, with a 12 month subscription</th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Dynamic pricing<small>Rate rules and length of stay logic</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Booking sites set up and kept in sync</th><td><span class="pr-txt">Airbnb, Booking.com, Google Vacation Rentals</span></td><td class="is-pro"><span class="pr-txt">All of Growth, plus Agoda, Expedia, Traveloka, Vrbo</span></td></tr>
            <tr><th scope="row">Direct booking website<small>Booking engine, payments and hosting</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Villa brand<small>Name, logo and visual identity</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Automated guest messages<small>Before, during and after each stay</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Owner dashboard<small>Your bookings and revenue</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pr-table-wrap" data-reveal>
        <table class="pr-table">
          <thead>
            <tr><th scope="col">Content and visibility</th><th scope="col">Growth</th><th scope="col" class="is-pro">Excellence</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Photo shoot<small>100+ photos</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Drone photoshoot</th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">360° tour</th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Cinematic film<small>1 to 2 minutes, plus 3 vertical clips</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Listing copy for booking sites and your website</th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Social media profiles set up or refreshed<small>With 9 posts, 3 of them pinned</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Instagram Highlights</th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Google Business Profile set up and optimised</th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Analytics and tracking<small>GA4, conversions and Meta pixel</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Social content<small>4 posts a month, with captions and design</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Google search optimisation<small>With Search Console monitoring</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">AI search visibility<small>ChatGPT, Claude and other AI assistants</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Event and retreat packages<small>Wedding, retreat and corporate offsite packages for 5+ bedroom properties</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Paid ads<small>AI, Meta and Google campaigns</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pr-table-wrap" data-reveal>
        <table class="pr-table">
          <thead>
            <tr><th scope="col">Guests and direct demand</th><th scope="col">Growth</th><th scope="col" class="is-pro">Excellence</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Digital guest book</th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Printed guest book<small>With a share your stay offer</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Upsell menu<small>Experiences, transfers, private chef and services</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Review management system</th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Guest email capture, privacy compliant</th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Email marketing campaigns</th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Guest retention strategy</th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Superhost readiness and review generation</th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Social campaign during the stay, prompting guest tags</th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Partner outreach<small>Up to 100 travel agents and event organisers</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Interior design consultation<small>Suggestions so photos and nightly rates move up</small></th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Amenity upgrades<small>Audit to source and install the missing key amenities that earn the most</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Staff hospitality training<small>Guest experience training for your team</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pr-table-wrap" data-reveal>
        <table class="pr-table">
          <thead>
            <tr><th scope="col">Reporting and reviews</th><th scope="col">Growth</th><th scope="col" class="is-pro">Excellence</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Monthly performance report</th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Market and competitor benchmarking</th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Quarterly strategy call<small>4 a year</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Dedicated contact person</th><td>$NO</td><td class="is-pro">$YES</td></tr>
            <tr><th scope="row">Cleaning schedule tool<small>Cleaning app synced with bookings, plus a staff training session</small></th><td>$YES</td><td class="is-pro">$YES</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="btn-row pr-center">
      <a class="btn btn--outline" href="#audit" data-plan="Growth">Start with Growth</a>
      <a class="btn btn--primary" href="#audit" data-plan="Excellence">Get an Excellence quote</a>
    </div>
  </div>
</section>

<!-- ============ EXTRAS ============ -->
<section class="section section--paper" id="extras">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">Extras</span>
      <h2>Extras, <span class="teal">when you need them.</span></h2>
      <p>Add any of these to either plan. Each is priced as its own project, so you only pay for what your villa needs.</p>
      <hr class="rule-line">
    </div>

    <div class="grid grid--3">
      <article class="card">
        <span class="pr-tag">Included in Excellence</span>
        <h3>Paid ads for direct bookings</h3>
        <p>Meta and Google campaigns sending guests to your website. Monthly fee; you set and pay the ad budget.</p>
      </article>
      <article class="card">
        <span class="pr-tag">Included in Excellence</span>
        <h3>Event and retreat packages</h3>
        <p>Wedding, retreat and corporate offsite packages for 5+ bedroom villas.</p>
      </article>
      <article class="card">
        <h3>Interior styling refresh</h3>
        <p>A stylist updates the key rooms guests see in photos, so photos and nightly rates move up.</p>
      </article>
      <article class="card">
        <h3>Long stays in low season</h3>
        <p>Monthly rates and listings targeting remote workers for January to March.</p>
      </article>
      <article class="card">
        <h3>Extra content</h3>
        <p>Seasonal reshoots, additional social posts, or creator stay collaborations.</p>
      </article>
      <article class="card pr-ask">
        <h3>Not sure what your villa needs?</h3>
        <p>Ask in your free revenue audit. We'll tell you which extras are worth it for your property, and which aren't.</p>
        <a class="link-arrow" href="#audit">Get a free revenue audit $ARR</a>
      </article>
    </div>
  </div>
</section>

<!-- ============ THE FEE IN CONTEXT ============ -->
<section class="section section--sand" id="cost">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">The fee in context</span>
      <h2>What the fee looks like on a <span class="teal">typical 4 bedroom villa.</span></h2>
      <p>A 4 bedroom villa at the Bali median earns about \$50K a year.</p>
      <hr class="rule-line">
    </div>

    <div class="pr-cmp-wrap" data-reveal>
      <table class="pr-cmp" role="table">
        <caption class="sr-only">Cost and control of IndaVillas Growth, a full management company and doing it yourself, for a villa earning \$50K a year</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader"><span class="sr-only">Comparison</span></th>
            <th scope="col" role="columnheader" class="is-us">IndaVillas Growth</th>
            <th scope="col" role="columnheader">Full management company</th>
            <th scope="col" role="columnheader">Doing it yourself</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row"><th scope="row" role="rowheader">How you pay</th><td role="cell" class="is-us" data-label="IndaVillas Growth">One flat yearly fee</td><td role="cell" data-label="Management company">15 to 25% of every booking</td><td role="cell" data-label="Doing it yourself">Your time</td></tr>
          <tr role="row"><th scope="row" role="rowheader">Yearly cost at \$50K revenue</th><td role="cell" class="is-us" data-label="IndaVillas Growth"><span class="pr-big">\$3,999</span></td><td role="cell" data-label="Management company"><span class="pr-big">\$7,500 to \$12,500</span></td><td role="cell" data-label="Doing it yourself"><span><span class="pr-big">\$0</span> at median rate</span></td></tr>
          <tr role="row"><th scope="row" role="rowheader">Who runs the house</th><td role="cell" class="is-us" data-label="IndaVillas Growth">Your team</td><td role="cell" data-label="Management company">Their team</td><td role="cell" data-label="Doing it yourself">Your team</td></tr>
          <tr role="row"><th scope="row" role="rowheader">Rate strategy</th><td role="cell" class="is-us" data-label="IndaVillas Growth">Included, reviewed monthly</td><td role="cell" data-label="Management company">Included</td><td role="cell" data-label="Doing it yourself">Up to you</td></tr>
          <tr role="row"><th scope="row" role="rowheader">Whose brand guests see</th><td role="cell" class="is-us" data-label="IndaVillas Growth">Your villa's own</td><td role="cell" data-label="Management company">Often the manager's</td><td role="cell" data-label="Doing it yourself">Your villa's own</td></tr>
          <tr role="row"><th scope="row" role="rowheader">Direct bookings</th><td role="cell" class="is-us" data-label="IndaVillas Growth">Your own site, no commission</td><td role="cell" data-label="Management company">Varies by company</td><td role="cell" data-label="Doing it yourself">Up to you</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- ============ TAGLINE ============ -->
<section class="tagline">
  <div class="wrap">
    <div class="tagline__inner">
      <span class="tagline__label">Why a flat fee</span>
      <p class="tagline__text" data-tagline>You keep every booking in full. <br class="lb">The fee stays the same <br class="lb">when your revenue grows.</p>
    </div>
  </div>
</section>

<!-- ============ WHAT OTHER MANAGERS DON'T DO ============ -->
<section class="section section--deep" id="difference">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow eyebrow--light">The difference</span>
      <h2>What other property managers <span class="gold-soft">don't do.</span></h2>
      <p>We have developed a three phase system for luxury 5+ bedroom properties.</p>
      <hr class="rule-line">
    </div>

    <ul class="ticks ticks--light pr-diff">
      <li>$TICK <span>Full analytics and a strategy call, with suggestions for amenities that raise ROI and for interior design improvements</span></li>
      <li>$TICK <span>A coherent brand across your website and social media, with an optimised guest journey</span></li>
      <li>$TICK <span>Demand beyond the booking sites: a direct booking website, AI search visibility, SEO, and travel agent, event, wedding and retreat partnerships</span></li>
      <li>$TICK <span>Conversion work: guest experience, review generation and Superhost status</span></li>
      <li>$TICK <span>Guest retention and reputation: repeat stay campaigns, referral systems and review generation</span></li>
      <li>$TICK <span>Paid ads management, AI platforms included (optional)</span></li>
      <li>$TICK <span>A social media strategy that builds hype around your villa</span></li>
      <li>$TICK <span>Personalised guest books with marketing built in</span></li>
      <li>$TICK <span>Upsells and experience packaging, and more</span></li>
    </ul>

    <div class="pr-diff__foot">
      <p><b>Results start to show after 4 months.</b> That is how long the three phase system takes to build momentum. Monthly reports measure the progress, and quarterly strategy calls set the next moves.</p>
      <a class="btn btn--ghost-light" href="/system/">See the three phase system $ARR</a>
    </div>
  </div>
</section>

<!-- ============ FAQ ============ -->
<section class="section section--paper" id="faq">
  <div class="wrap wrap--narrow">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">FAQ</span>
      <h2>Frequently asked <span class="teal">questions.</span></h2>
      <hr class="rule-line">
    </div>

    <div class="faq">
      <details>
        <summary>Which plan is right for my villa?</summary>
        <p>Growth suits most villas with 5 or more bedrooms, and smaller villas that already perform well. Choose Excellence if your villa already earns around \$90K a year or more and you want more of your bookings to come to you directly.</p>
      </details>
      <details>
        <summary>Why a flat fee and not a percentage?</summary>
        <p>We don't handle your money, so there's nothing to take a cut of. You keep every booking in full, and the fee stays the same when your revenue grows.</p>
      </details>
      <details>
        <summary>Do you replace my villa manager or staff?</summary>
        <p>No. Your team keeps running arrivals, cleaning and maintenance. We work on what decides the rate guests pay and whether they find you.</p>
      </details>
      <details>
        <summary>Where do the property analytics come from?</summary>
        <p>AirDNA data for entire home listings in Bali available 271 to 365 nights a year, over the 12 months to August 2026. "Top 25%" is the level three in four properties of that size don't reach.</p>
      </details>
      <details>
        <summary>I have a 1 or 2 bedroom property.</summary>
        <p>Start with the <a href="#gameplan">Revenue Gameplan</a>. At that size a yearly plan would cost close to what a full management company charges, so the Gameplan is the better value. Smaller listings that already perform near the top can still qualify for Growth, so if yours already beats the market, let's talk.</p>
      </details>
      <details>
        <summary>I own several villas. How is that priced?</summary>
        <p>Your highest priced villa pays its plan in full and each other villa is 25% off. Villas can be on different plans and can share one brand and booking website. Depending on your portfolio, we will make an offer that suits your needs. <a href="#portfolio">Price your properties</a>.</p>
      </details>
      <details>
        <summary>I manage villas for other owners.</summary>
        <p>With 6 or more villas we agree partner pricing for the whole portfolio. Tell us how many villas you run and their sizes.</p>
      </details>
      <details>
        <summary>Can I cancel?</summary>
        <p>Results take time, so each plan has a minimum term: 4 months for Growth and 12 months for Excellence. After that, you can cancel any time.</p>
      </details>
    </div>
  </div>
</section>

<!-- ============ FREE REVENUE AUDIT ============ -->
<section class="final" id="audit">
  <div class="final__video" data-video="Igwinx0keg8" aria-hidden="true"></div>
  <div class="wrap final__inner">
    <span class="eyebrow eyebrow--light">Free revenue audit</span>
    <h2>See where your villa sits.</h2>
    <p class="sub">Send us your Airbnb or Booking.com link. We'll place your villa against the Bali median and top 25% for its size and area, and show you the three changes worth the most. Free, with no obligation.</p>

    <div class="lead lead--dark lead--center">
      <form class="lead__form" data-lead aria-label="Request your free revenue audit">
        <input type="hidden" name="_subject" value="New revenue audit request - IndaVillas (Pricing)">
        <input type="hidden" name="_template" value="table">
        <input type="hidden" name="_captcha" value="false">
        <input type="hidden" name="portfolio" value="" data-port-field>
        <input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
        <div class="lead__field">
          <label for="listing-pr">Your listing link</label>
          <input type="text" id="listing-pr" name="listing_url" placeholder="airbnb.com/rooms/…" inputmode="url" autocomplete="url" required>
        </div>
        <div class="lead__field">
          <label for="whatsapp-pr">WhatsApp number</label>
          <input type="tel" id="whatsapp-pr" name="whatsapp" placeholder="+62 …" autocomplete="tel">
        </div>
        <div class="lead__field">
          <label for="email-pr">Email address</label>
          <input type="email" id="email-pr" name="email" placeholder="you@email.com" autocomplete="email" required>
        </div>
        <div class="lead__field">
          <label for="plan-pr">Interested in</label>
          <select id="plan-pr" name="plan" data-plan-field>
            <option>Not sure yet</option>
            <option>Growth</option>
            <option>Excellence</option>
            <option>Several properties</option>
            <option>Revenue Gameplan</option>
          </select>
        </div>
        <div class="lead__submit"><button class="btn btn--primary" type="submit">Get my free audit</button></div>
      </form>

      <div class="lead__success" role="status" aria-live="polite">
        $DONE
        <span>Thank you. We're placing your villa against the market now, and your audit lands in your inbox within one business day.</span>
      </div>

      <p class="lead__error" role="alert">Couldn't send that just now. Please try again, or <a href="mailto:hi.flatiro@gmail.com">email us the link directly</a>.</p>

      <p class="lead__note">
        $LOCK
        Free, with no obligation. We only use your details to send the audit.
      </p>
    </div>

    <p class="pr-fine">Revenue figures: AirDNA, Bali entire home listings available 271 to 365 nights a year, 12 months to August 2026, rounded. The comparison between managed properties and those run by their owners uses the same data. Individual results vary.</p>
  </div>
</section>

</main>
HTML
}
