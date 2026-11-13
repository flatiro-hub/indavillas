page_audit(){
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
      <span class="eyebrow">Free tool · Listing audit</span>
      <h1>Audit your listing <span class="em">in 1 minute.</span></h1>
      <p class="hero__sub">Paste your Airbnb or Booking.com link and we fetch the listing and score it out of 100 on the spot - photos, title, description, amenities, reviews and booking setup - with every fix ranked by what it is worth.</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="#score">Score my listing <span class="arr" aria-hidden="true">&rarr;</span></a>
      </div>
      <p class="hero__note">Free, no email required, and no sales call unless you ask for one.</p>
    </div>
  </div>
</section>

<!-- ============ WHAT YOU GET BACK ============ -->
<section class="section section--paper">
  <div class="wrap">
    <div class="split">
      <div class="split__media">
        <img src="/assets/img/dashboard.png" alt="Example of a scored listing report" loading="lazy" decoding="async" width="699" height="533">
      </div>
      <div>
        <span class="eyebrow">What lands in your inbox</span>
        <h2 class="split__title" style="margin-top:.5em">A score, and the fixes in order of impact.</h2>
        <ul class="ticks">
          <li>$TICK <span><b>Your score out of 100</b>, with the grade and a breakdown of every category.</span></li>
          <li>$TICK <span><b>Each fix ranked</b> - high impact, medium, or quick win - so you know what to do on Saturday morning.</span></li>
          <li>$TICK <span><b>The exact wording problems.</b> Not "improve your description", but which line to rewrite and why.</span></li>
          <li>$TICK <span><b>Your revenue gap</b> against comparable properties in your market.</span></li>
        </ul>
        <p class="lead-p" style="margin-top:1.4rem;font-size:var(--fs-sm)">Scores are guidance based on hosting best practice - not the platforms' official ranking. Nobody outside Airbnb has that, and anyone claiming otherwise is guessing.</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ COMMON FINDINGS ============ -->
<section class="section section--sand">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">What we usually find</span>
      <h2>The same four things, <span class="teal">nearly every time</span>.</h2>
      <hr class="rule-line">
    </div>

    <div class="grid grid--4" style="margin-top:clamp(38px,5vw,58px)">
      <article class="card">
        <span class="card__num" aria-hidden="true">01</span>
        <h3>Uncaptioned photos</h3>
        <p>Guests skim captions and the platform reads them to understand the listing. One line each - what the space is, and why it is good.</p>
      </article>
      <article class="card">
        <span class="card__num" aria-hidden="true">02</span>
        <h3>Half a title</h3>
        <p>Fifty characters are available and most listings use twenty, with the area name buried in the description where nobody searches.</p>
      </article>
      <article class="card">
        <span class="card__num" aria-hidden="true">03</span>
        <h3>Missing amenities</h3>
        <p>Hosts routinely forget ten or more. Each unticked box is a filter you are invisible in, however good the villa is.</p>
      </article>
      <article class="card">
        <span class="card__num" aria-hidden="true">04</span>
        <h3>A minimum stay that hides you</h3>
        <p>A long minimum filters you out of most searches. Outside high season it usually costs more than it protects.</p>
      </article>
    </div>

    <div class="btn-row" style="justify-content:center;margin-top:clamp(38px,5vw,56px)">
      <a class="btn btn--primary" href="#score">Score my listing <span class="arr" aria-hidden="true">→</span></a>
      <a class="btn btn--outline" href="/revenue-calculator/">See what commission costs me</a>
    </div>
  </div>
</section>

<!-- ============ THE SCORER ============ -->
<section class="section section--paper" id="score">
  <div class="wrap">
    <div class="sec-head sec-head--center">
      <span class="eyebrow">Score my listing</span>
      <h2>Paste the link. <span class="teal">Get the score.</span></h2>
      <hr class="rule-line">
    </div>

    <form class="aurl" id="audit-url-form" novalidate>
      <div class="aurl__field">
        <label for="au-url">Your Airbnb or Booking.com listing URL</label>
        <input type="url" id="au-url" name="url" placeholder="https://www.airbnb.com/rooms/12345678" inputmode="url" autocomplete="url" required>
      </div>
      <button class="btn btn--primary" type="submit">Audit my listing <span class="arr" aria-hidden="true">&rarr;</span></button>
    </form>

    <div class="astatus" id="audit-status" role="status" aria-live="polite" hidden></div>

    <p class="aurl__alt">
      <button class="link-arrow" type="button" id="audit-open-manual">No link handy? Enter the details by hand <span class="arr" aria-hidden="true">&rarr;</span></button>
    </p>

    <div id="audit-manual" hidden>
      <div class="amanual__head">
        <h3>Manual mode</h3>
        <p>Fill in what you know. Anything you leave blank is dropped from the score and its weight moves to the other checks - a blank is never counted against you.</p>
      </div>
    <form class="ascorer" id="audit-form" novalidate>
      <div class="ascorer__grid">
        <div class="afield afield--wide">
          <label for="af-title">Listing title <b>*</b></label>
          <input type="text" id="af-title" name="title" placeholder="e.g. Clifftop 5BR Villa, Infinity Pool, Uluwatu" maxlength="120" required>
          <span class="afield__hint">Paste it exactly as it appears - length, wording and the area name are all scored.</span>
        </div>

        <div class="afield afield--wide">
          <label for="af-desc">Description <b>*</b></label>
          <textarea id="af-desc" name="description" rows="7" placeholder="Paste your full listing description here, line breaks and all." required></textarea>
          <span class="afield__hint">Line breaks matter - paste it as it is rather than tidying it up.</span>
        </div>

        <div class="afield">
          <label for="af-area">Area / location</label>
          <input type="text" id="af-area" name="area" placeholder="e.g. Uluwatu">
        </div>

        <div class="afield">
          <label for="af-photos">Number of photos</label>
          <input type="number" id="af-photos" name="photos" min="0" max="200" placeholder="e.g. 24" inputmode="numeric">
        </div>

        <div class="afield">
          <label for="af-captions">Photo captions</label>
          <select id="af-captions" name="captions">
            <option value="">Not sure</option>
            <option value="most">Most photos have captions</option>
            <option value="some">Some do</option>
            <option value="none">None do</option>
          </select>
        </div>

        <div class="afield">
          <label for="af-amenities">Amenities listed (total)</label>
          <input type="number" id="af-amenities" name="amenities" min="0" max="200" placeholder="e.g. 32" inputmode="numeric">
        </div>

        <div class="afield afield--wide">
          <span class="afield__label">Which of these are on your listing?</span>
          <div class="achecks">
            <label><input type="checkbox" name="ess_wifi"> Wifi</label>
            <label><input type="checkbox" name="ess_kitchen"> Kitchen</label>
            <label><input type="checkbox" name="ess_washer"> Washer</label>
            <label><input type="checkbox" name="ess_workspace"> Dedicated workspace</label>
            <label><input type="checkbox" name="ess_tv"> TV</label>
            <label><input type="checkbox" name="ess_parking"> Parking</label>
          </div>
          <span class="afield__hint">These six are the filters guests use most. Each missing one hides you from that search.</span>
        </div>

        <div class="afield">
          <label for="af-rating">Star rating</label>
          <input type="number" id="af-rating" name="rating" min="0" max="5" step="0.01" placeholder="e.g. 4.87" inputmode="decimal">
        </div>

        <div class="afield">
          <label for="af-reviews">Number of reviews</label>
          <input type="number" id="af-reviews" name="reviews" min="0" max="10000" placeholder="e.g. 46" inputmode="numeric">
        </div>

        <div class="afield">
          <label for="af-superhost">Superhost</label>
          <select id="af-superhost" name="superhost">
            <option value="">Not sure</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div class="afield">
          <label for="af-instant">Instant Book</label>
          <select id="af-instant" name="instant">
            <option value="">Not sure</option>
            <option value="yes">On</option>
            <option value="no">Off</option>
          </select>
        </div>

        <div class="afield">
          <label for="af-minnights">Minimum stay (nights)</label>
          <input type="number" id="af-minnights" name="minnights" min="1" max="365" placeholder="e.g. 2" inputmode="numeric">
        </div>

        <div class="afield">
          <label for="af-cancel">Cancellation policy</label>
          <select id="af-cancel" name="cancellation">
            <option value="">Not sure</option>
            <option value="flexible">Flexible</option>
            <option value="moderate">Moderate</option>
            <option value="firm">Firm</option>
            <option value="strict">Strict</option>
          </select>
        </div>
      </div>

      <div class="ascorer__actions">
        <button class="btn btn--primary" type="submit">Score my listing <span class="arr" aria-hidden="true">&rarr;</span></button>
        <button class="btn btn--outline" type="reset">Clear</button>
      </div>
    </form>
    </div>

    <div class="aresult" id="audit-result" role="region" aria-live="polite" aria-label="Your listing score" hidden></div>

    <div class="afollow" id="audit-followup" hidden>
      <div class="afollow__txt">
        <span class="eyebrow eyebrow--light">Want these fixed?</span>
        <h3>We will do it - and show you what it is worth.</h3>
        <p>Send us the listing and we will come back with a revenue gap analysis: what your villa earns now, what comparable properties earn, and the difference we would go after. Your score comes through with it.</p>
      </div>
      <form class="afollow__form" data-lead aria-label="Request your free revenue gap analysis">
        <input type="hidden" name="_subject" value="Listing audit completed - IndaVillas">
        <input type="hidden" name="_template" value="table">
        <input type="hidden" name="_captcha" value="false">
        <input type="hidden" name="listing_score" value="">
        <input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
        <div class="lead__field">
          <label for="fu-listing">Your listing URL</label>
          <input type="url" id="fu-listing" name="listing_url" placeholder="https://www.airbnb.com/rooms/12345678" inputmode="url">
        </div>
        <div class="lead__field">
          <label for="fu-email">Email address</label>
          <input type="email" id="fu-email" name="email" placeholder="you@email.com" autocomplete="email" required>
        </div>
        <div class="lead__submit"><button class="btn btn--gold btn--block" type="submit">Send me the revenue gap analysis</button></div>

        <div class="lead__success" role="status" aria-live="polite">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-4.5"/></svg>
          <span>Got it - your score came through with it. We will be in touch within one business day.</span>
        </div>
        <p class="lead__error" role="alert">We could not send that just now. Please try again, or <a href="mailto:hi.flatiro@gmail.com">email us directly</a>.</p>
      </form>
    </div>
  </div>
</section>

</main>
HTML
}
