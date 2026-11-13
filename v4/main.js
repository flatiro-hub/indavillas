/* ============================================================
   IndaVillas - design v4 behaviour, shared by the four main pages
   1. Capabilities           2. Navigation + menu      3. Split headings
   4. 365 nights grid        5. Forms + plan picker    6. Pricing tabs
   7. Motion (GSAP, ScrollTrigger, Lenis)              8. Hero lens (Three.js)
   9. Cleanup
   Every feature looks for its own markup first, so one file serves every
   page. Without JavaScript, with reduced motion, or if a library fails to
   load, each page is complete: nothing here hides what it cannot bring back.
   ============================================================ */

/* ---------- 1. Capabilities ---------- */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const motionOK = !reduceMotion && Boolean(gsap && ScrollTrigger);
const cleanups = [];
let lenis = null;

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

/* ---------- 2. Navigation + menu ---------- */
const nav = document.querySelector('[data-nav]');
const hero = document.querySelector('[data-hero]');
if (nav && hero && 'IntersectionObserver' in window) {
  // the bar turns solid once the opening screen has gone under it
  const navIO = new IntersectionObserver(([entry]) => {
    nav.classList.toggle('is-solid', !entry.isIntersecting);
  }, { rootMargin: '-76px 0px 0px 0px' });
  navIO.observe(hero);
  cleanups.push(() => navIO.disconnect());
}

const toggle = document.querySelector('.nav__toggle');
const menu = document.getElementById('menu');
const menuLinks = () => menu.querySelectorAll('a');

function openMenu() {
  menu.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-label', 'Close menu');
  document.body.classList.add('menu-open');
  if (lenis) lenis.stop();
  if (motionOK) {
    gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo(menuLinks(), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out' });
  }
  menuLinks()[0].focus();
}
function closeMenu(returnFocus) {
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu');
  document.body.classList.remove('menu-open');
  if (lenis) lenis.start();
  if (returnFocus) toggle.focus();
}
if (toggle && menu) {
  toggle.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu(true)));
  document.addEventListener('keydown', (e) => {
    if (menu.hidden) return;
    if (e.key === 'Escape') { closeMenu(true); return; }
    if (e.key !== 'Tab') return;
    // keep focus inside the toggle and the menu while it is open
    const items = [toggle, ...menu.querySelectorAll('a')];
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) closeMenu(false); });
}

// In-page links: close the menu, and let Lenis do the travel when it runs.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id.length > 1 && document.querySelector(id);
  if (!target) return;
  closeMenu(false);
  if (!lenis) return;                          // native jump + scroll-margin
  e.preventDefault();
  lenis.scrollTo(target, { offset: id === '#main' ? 0 : -64, duration: 1.2 });
  history.replaceState(null, '', id);
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
});

// For other scripts (the listing audit): scroll to an element through Lenis when it runs.
window.ivScrollTo = (el) => {
  if (lenis) lenis.scrollTo(el, { offset: -80, duration: 1.1 });
  else el.scrollIntoView({ block: 'start' });
};

/* ---------- 3. Split headings ----------
   Only plain text headings are split. The full text stays in a visually
   hidden span for assistive technology; the word spans are hidden from it.
   Links and inline markup are never split. */
function splitWords(el) {
  if (!el || [...el.childNodes].some((n) => n.nodeType !== Node.TEXT_NODE)) return null;
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  const label = document.createElement('span');
  label.className = 'sr-only';
  label.textContent = text;
  const visual = document.createElement('span');
  visual.className = 'split';
  visual.setAttribute('aria-hidden', 'true');
  const words = text.split(' ');
  words.forEach((word, i) => {
    const w = document.createElement('span');
    w.className = 'w';
    const inner = document.createElement('span');
    inner.className = 'w__i';
    inner.textContent = word;
    w.appendChild(inner);
    visual.appendChild(w);
    if (i < words.length - 1) visual.appendChild(document.createTextNode(' '));
  });
  el.replaceChildren(label, visual);
  return visual.querySelectorAll('.w__i');
}

/* ---------- 4. 365 nights grid ----------
   A year of nights, filled in calendar order. 318 of 365 are booked (87%,
   the published average across managed villas); the 47 empty nights fall
   mostly in the low season, from a fixed seed so every visit looks the same. */
const NIGHTS = 365;
const BOOKED = 318;
const nightsGrid = document.querySelector('[data-nights]');
const nightsCount = document.querySelector('[data-nights-count]');
let nightCells = [];
let bookedFlags = [];
let paintedTo = -1;

if (nightsGrid) {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const weight = (d) => (d > 14 && d < 95 ? 6 : d > 290 && d < 335 ? 3 : 1); // Jan to Mar, Nov
  bookedFlags = new Array(NIGHTS).fill(true);
  let empty = 0;
  while (empty < NIGHTS - BOOKED) {
    const d = Math.floor(rand() * NIGHTS);
    if (bookedFlags[d] && rand() < weight(d) / 6) { bookedFlags[d] = false; empty++; }
  }
  const frag = document.createDocumentFragment();
  for (let d = 0; d < NIGHTS; d++) frag.appendChild(document.createElement('i'));
  nightsGrid.appendChild(frag);
  nightCells = [...nightsGrid.children];
}
// light every booked night before `upTo` (a day index), touching only what changed
function paintNights(upTo) {
  if (!nightCells.length || upTo === paintedTo) return;
  const from = Math.min(upTo, Math.max(paintedTo, 0));
  const to = Math.max(upTo, paintedTo);
  for (let d = from; d < to; d++) nightCells[d].classList.toggle('on', bookedFlags[d] && d < upTo);
  paintedTo = upTo;
  if (nightsCount) {
    let lit = 0;
    for (let d = 0; d < upTo; d++) if (bookedFlags[d]) lit++;
    nightsCount.textContent = Math.round((lit / NIGHTS) * 100) + '%';
  }
}

/* ---------- 5. Forms + plan picker ---------- */
const LEAD_ENDPOINT = 'https://formsubmit.co/ajax/hi.flatiro@gmail.com';
document.querySelectorAll('[data-form]').forEach((form) => {
  const status = form.querySelector('[data-status]');
  const submit = form.querySelector('[type=submit]');
  const label = submit.querySelector('[data-label]');
  const submitLabel = label.textContent;
  const rules = {
    email: (v) => (!v ? 'Add your email so we can send it to you.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'That email looks incomplete. Check it reads like name@example.com.'),
    whatsapp: (v) => (!v || /^\+?[\d\s().-]{7,}$/.test(v) ? '' : 'Use digits, starting with your country code.'),
    property: (v) => (v ? '' : 'Tell us roughly where the villa is.'),
    listing_url: (v) => (!v ? 'Paste the link to your Airbnb or Booking.com listing.' : /\S+\.\S+/.test(v) ? '' : 'That does not look like a link yet. Copy it from the address bar of your listing.'),
    bedrooms: (v) => (!v ? 'How many bedrooms does the villa have?' : Number(v) >= 1 && Number(v) <= 30 && Number.isInteger(Number(v)) ? '' : 'Use a whole number from 1 to 30.'),
  };
  const check = (input) => {
    const msg = rules[input.name] ? rules[input.name](input.value.trim()) : '';
    const field = input.closest('.field');
    field.classList.toggle('is-invalid', Boolean(msg));
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    field.querySelector('.field__err').textContent = msg;
    return !msg;
  };
  const inputs = [...form.querySelectorAll('.field input, .field select')];
  inputs.forEach((input) => {
    input.addEventListener('blur', () => { if (input.value || input.dataset.touched) check(input); input.dataset.touched = '1'; });
    input.addEventListener('input', () => { if (input.closest('.field').classList.contains('is-invalid')) check(input); });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form__status';
    status.textContent = '';
    const valid = inputs.map(check);           // mark every field, then go to the first problem
    const firstBad = inputs[valid.indexOf(false)];
    if (firstBad) { firstBad.focus(); return; }
    submit.disabled = true;
    label.textContent = 'Sending…';
    try {
      const res = await fetch(LEAD_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
      if (!res.ok) throw new Error('status ' + res.status);
      form.classList.add('is-sent');
      status.classList.add('is-ok');
      status.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path stroke-linejoin="round" d="M8.5 12.5L10.5 14.5L15.5 9.5"/></g></svg><span>Thank you. It is on its way, and we reply within one business day.</span>';
      status.setAttribute('tabindex', '-1');
      status.focus();
    } catch (err) {
      status.classList.add('is-error');
      status.textContent = "That didn't send. Check your connection and try again, or email hi.flatiro@gmail.com.";
      submit.disabled = false;
      label.textContent = submitLabel;
    }
  });
});

// "Get a Growth quote" and the like pre-select that plan in the form they scroll to.
const planField = document.querySelector('[data-plan-field]');
if (planField) {
  document.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', () => { planField.value = btn.dataset.plan; });
  });
}

/* ---------- 6. Pricing tabs ----------
   Without JavaScript every table shows, each with its caption. With it, the
   tab row appears and one table shows at a time; arrows, Home and End move. */
document.querySelectorAll('[data-tabs]').forEach((box) => {
  const list = box.querySelector('[role=tablist]');
  const tabs = [...box.querySelectorAll('[role=tab]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const select = (i, focus, remember) => {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    });
    if (focus) tabs[i].focus();
    if (remember) {
      const url = new URL(location.href);
      url.searchParams.set('table', tabs[i].id.replace(/^tab-/, ''));
      history.replaceState(null, '', url);
    }
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  };
  list.hidden = false;
  box.classList.add('is-live');
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i, false, true));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      select((k + tabs.length) % tabs.length, true, true);
    });
  });
  const asked = tabs.findIndex((t) => t.id === 'tab-' + new URLSearchParams(location.search).get('table'));
  select(Math.max(asked, 0), false, false);
});

/* Services: pointing at a row shows its photo in the frame beside the index. */
const sxFrame = document.querySelector('.sx__frame img');
if (sxFrame) {
  let shown = sxFrame.getAttribute('src');
  const rows = [...document.querySelectorAll('.sx__row')];
  const show = (row) => {
    rows.forEach((r) => r.classList.toggle('is-on', r === row));
    const img = row.querySelector('.sx__img img');
    const src = img.dataset.frame || img.getAttribute('src');   // a portrait crop when the row has one
    if (src === shown) return;
    shown = src;
    if (reduceMotion) { sxFrame.src = src; return; }
    sxFrame.classList.add('is-swapping');
    setTimeout(() => { sxFrame.src = src; sxFrame.classList.remove('is-swapping'); }, 180);
  };
  rows.forEach((row) => row.addEventListener('pointerenter', () => show(row)));
  if (rows[0]) rows[0].classList.add('is-on');
}

/* Revenue calculator. Every input is visible and adjustable, because the honest
   answer depends on numbers only the host knows.
     gross     = nightly rate x 365 x occupancy
     feesNow   = gross x commission
     feesAfter = gross x (1 - direct share) x commission
     keep      = feesNow - feesAfter - gross x direct share x 2% card processing   */
const dbcRate = document.getElementById('dbc-rate');
if (dbcRate) {
  const PROCESSING = 0.02;
  const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });
  const [occ, com, dir] = ['dbc-occ', 'dbc-com', 'dbc-dir'].map((id) => document.getElementById(id));
  const out = (name) => document.querySelector(`[data-dbc="${name}"]`);
  const paint = (input) => input.style.setProperty('--p', ((input.value - input.min) / (input.max - input.min)) * 100 + '%');
  const run = () => {
    const rate = Math.max(0, Number(dbcRate.value) || 0);
    const o = occ.value / 100, c = com.value / 100, d = dir.value / 100;
    const gross = rate * 365 * o;
    const feesNow = gross * c;
    const feesAfter = gross * (1 - d) * c;
    const processing = gross * d * PROCESSING;
    const keep = feesNow - feesAfter - processing;
    [occ, com, dir].forEach(paint);
    out('occ-v').textContent = pct.format(o);
    out('com-v').textContent = pct.format(c);
    out('dir-v').textContent = pct.format(d);
    out('feesnow').textContent = usd0.format(Math.round(feesNow));
    out('gross').textContent = usd0.format(Math.round(gross));
    out('feesafter').textContent = usd0.format(Math.round(feesAfter));
    out('processing').textContent = usd0.format(Math.round(processing));
    out('keep').textContent = usd0.format(Math.round(keep));
    out('monthly').textContent = usd0.format(Math.round(keep / 12));
  };
  [dbcRate, occ, com, dir].forEach((input) => input.addEventListener('input', run));
  run();
}

/* The system: before and after. The slider is a real range input laid over the photos,
   so dragging, tapping a point and the arrow keys all move the cut. */
document.querySelectorAll('[data-ba]').forEach((ba) => {
  const range = ba.querySelector('[data-ba-range]');
  const stage = ba.querySelector('.ba__stage');
  const set = () => stage.style.setProperty('--pos', range.value + '%');
  range.hidden = false;
  ba.classList.add('is-live');
  range.addEventListener('input', set);
  set();
});

/* ---------- 7. Motion ---------- */
const rot = document.querySelector('[data-rotate]');
if (!motionOK) {
  paintNights(NIGHTS);                         // final state straight away
} else {
  gsap.registerPlugin(ScrollTrigger);

  // Lenis is the only smooth scroll engine; ScrollTrigger reads its position.
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    cleanups.push(() => { gsap.ticker.remove(tick); lenis.destroy(); lenis = null; });
  }

  const mm = gsap.matchMedia();
  cleanups.push(() => mm.revert());

  // Pinned scenes are created first, so every trigger further down the page
  // measures its position with their pin spacing already in place.

  // Home, the gap: pinned on wide screens; the big number counts row by row.
  const gap = document.querySelector('.gp');
  const gapNum = gap && gap.querySelector('[data-gap-num]');
  const gapRows = gap ? [...gap.querySelectorAll('.gp__row')] : [];
  const growBars = (row) => {
    const css = getComputedStyle(row);
    const [med, top] = row.querySelectorAll('.gp__bar');
    gsap.to(med, { scaleX: parseFloat(css.getPropertyValue('--med')), duration: 1.1, ease: 'expo.out', overwrite: true });
    gsap.to(top, { scaleX: parseFloat(css.getPropertyValue('--top')), duration: 1.3, ease: 'expo.out', delay: 0.1, overwrite: true });
  };
  const counter = { v: 0 };
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0, signDisplay: 'always' });
  const money = (k) => usd.format(Math.round(k) * 1000);   // 28 -> "+$28K"
  const countTo = (v) => {
    if (!gapNum) return;
    gsap.to(counter, { v, duration: 0.9, ease: 'power3.out', overwrite: true, onUpdate: () => { gapNum.textContent = money(counter.v); } });
  };
  if (gap) {
    gapRows.forEach((row) => gsap.set(row.querySelectorAll('.gp__bar'), { scaleX: 0 }));
    if (gapNum) gapNum.textContent = money(0);
  }
  if (gap && gap.hasAttribute('data-gap-pin')) {
    mm.add('(min-width: 901px)', () => {
      gap.classList.add('is-pinned');
      let cur = -1;
      const activate = (i) => {
        if (i === cur) return;
        cur = i;
        gapRows.forEach((r, k) => r.classList.toggle('is-on', k === i));
        growBars(gapRows[i]);
        countTo(Number(gapRows[i].dataset.plus));
      };
      ScrollTrigger.create({
        trigger: gap.querySelector('.gp__pin'), start: 'center center', end: () => '+=' + Math.round(window.innerHeight * 1.4),
        pin: true, anticipatePin: 1,
        onEnter: () => activate(0),
        onUpdate: (self) => activate(Math.min(gapRows.length - 1, Math.floor(self.progress * gapRows.length * 0.999))),
      });
      return () => { gap.classList.remove('is-pinned'); gapRows.forEach((r) => r.classList.remove('is-on')); };
    });
  }
  if (gap) {
    // every other case (phones, the pricing page): each row grows as it arrives
    const unpinned = () => !gap.classList.contains('is-pinned');
    gapRows.forEach((row) => {
      ScrollTrigger.create({ trigger: row, start: 'top 85%', once: true, onEnter: () => { if (unpinned()) growBars(row); } });
    });
    if (gapNum) ScrollTrigger.create({ trigger: gapNum, start: 'top 85%', once: true, onEnter: () => { if (unpinned()) countTo(Number(gapNum.dataset.final)); } });
  }

  // Home, the method: on wide screens the three phases travel sideways while pinned.
  const method = document.querySelector('.mt');
  if (method) mm.add('(min-width: 901px)', () => {
    const viewport = method.querySelector('.mt__vp');
    const track = method.querySelector('[data-track]');
    method.classList.add('is-pinned');
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    gsap.to(track, {
      x: () => -distance(), ease: 'none',
      scrollTrigger: { trigger: method.querySelector('[data-method]'), start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    return () => method.classList.remove('is-pinned');
  });

  // Hero intro. Navigation, the lede and the button work from the first frame;
  // the photo opens up and the headline rises word by word.
  const media = document.querySelector('[data-hero-media]');
  const title = document.querySelector('.hx__title, .pg__title, .cx__title');
  const heroWords = splitWords(title);
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  if (media && hero && hero.classList.contains('hx')) {
    intro.fromTo(media,
      { clipPath: 'inset(36% 8% 36% 8%)', scale: 1.1 },
      { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0);
    gsap.to(media, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  } else if (media && hero) {
    const img = media.querySelector('img');
    intro.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.05);
    intro.fromTo(img, { scale: 1.25 }, { scale: 1.06, duration: 1.7, ease: 'expo.out' }, 0.05);
    gsap.fromTo(img, { yPercent: -3 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }
  intro.from('[data-hero-mark]', { opacity: 0, y: 12, duration: 0.6 }, 0.2);
  if (heroWords) intro.from(heroWords, { yPercent: 110, duration: 0.95, stagger: 0.05 }, 0.25);
  else if (title) intro.from(title, { opacity: 0, y: 28, duration: 0.9 }, 0.25);

  // Services: the last word of the headline cycles through what the team is.
  if (rot) {
    const words = JSON.parse(rot.dataset.rotate);
    let i = 0;
    // reserve the height of the longest word, so the lines below never move
    const fit = () => {
      const shown = rot.textContent;
      let h = 0;
      rot.style.minHeight = '0px';
      words.forEach((w) => { rot.textContent = w; h = Math.max(h, rot.offsetHeight); });
      rot.textContent = shown;
      rot.style.minHeight = h + 'px';
    };
    fit();
    if (document.fonts) document.fonts.ready.then(fit);
    let fitTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fit, 150); });
    const turn = () => {
      i = (i + 1) % words.length;
      gsap.timeline()
        .to(rot, { yPercent: -30, opacity: 0, duration: 0.45, ease: 'power2.in' })
        .call(() => { rot.textContent = words[i]; })
        .fromTo(rot, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out' })
        .call(() => { if (i !== 0) gsap.delayedCall(2.6, turn); });   // one cycle, then it rests
    };
    gsap.delayedCall(3.2, turn);
  }

  // System: the big numeral follows the step you are reading.
  const ch = document.querySelector('.ch');
  if (ch) mm.add('(min-width: 901px)', () => {
    const items = [...ch.querySelectorAll('.ch__item')];
    const num = ch.querySelector('[data-ch-num]');
    const of = ch.querySelector('[data-ch-of]');
    const staticNum = num.textContent;
    const staticOf = of.textContent;
    ch.classList.add('is-live');
    of.textContent = 'of ' + String(items.length).padStart(2, '0');
    const set = (i) => {
      items.forEach((el, k) => el.classList.toggle('is-on', k === i));
      num.textContent = String(i + 1).padStart(2, '0');
    };
    set(0);
    items.forEach((el, i) => ScrollTrigger.create({ trigger: el, start: 'top 58%', end: 'bottom 58%', onToggle: (s) => { if (s.isActive) set(i); } }));
    return () => {
      ch.classList.remove('is-live');
      items.forEach((el) => el.classList.remove('is-on'));
      num.textContent = staticNum;
      of.textContent = staticOf;
    };
  });

  // Section headings rise word by word, once.
  document.querySelectorAll('h2[data-split]:not([data-split="scrub"])').forEach((h) => {
    const words = splitWords(h);
    if (!words) return;
    gsap.from(words, { yPercent: 110, duration: 0.95, stagger: 0.04, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
  });

  // Statements fill in word by word with the scroll.
  document.querySelectorAll('[data-split="scrub"]').forEach((h) => {
    const words = splitWords(h);
    if (!words) return;
    gsap.fromTo(words, { opacity: 0.16 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: h, start: 'top 78%', end: 'bottom 42%', scrub: true } });
  });

  // Blocks fade up as they arrive, once. Rows that a scene controls are left out.
  const reveals = gsap.utils.toArray('[data-reveal], .pl__card, .sx__row, .pb__item, .fx__item, .flow__col, .ex__row');
  gsap.set(reveals, { y: 40, opacity: 0 });
  ScrollTrigger.batch(reveals, {
    start: 'top 90%', once: true,
    onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'power3.out', overwrite: true }),
  });

  // 365 nights: the year fills in calendar order as the grid scrolls through.
  if (nightCells.length) {
    paintNights(0);
    ScrollTrigger.create({
      trigger: nightsGrid, start: 'top 85%', end: 'bottom 40%', scrub: true,
      onUpdate: (self) => paintNights(Math.round(self.progress * NIGHTS)),
    });
  }

  // Final call to action: the photo settles as the section scrolls in.
  document.querySelectorAll('.fn').forEach((sec) => {
    const img = sec.querySelector('.fn__media img');
    if (img) gsap.fromTo(img, { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Re-measure once fonts and late images have changed the layout.
  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts) document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh, { once: true });

  initLens().then((dispose) => { if (dispose) cleanups.push(dispose); });
}

/* ---------- 8. Hero lens (Three.js, homepage only) ----------
   One canvas, one job. The same villa is shown twice: flat and unlit at
   midday outside a soft lens, lit at blue hour inside it, so the pointer
   "brings out" the value the headline talks about. Scrolling past the hero
   lights the whole house. On touch the lens drifts and follows a finger.
   Pixel ratio capped at 1.5, nothing allocated per frame, rendering paused
   offscreen and in hidden tabs; the <img> stays underneath for WebGL failure
   or context loss. */
async function initLens() {
  const box = document.querySelector('[data-lens]');
  const canvas = box && box.querySelector('canvas');
  const poster = box && box.querySelector('img');
  if (!canvas || !poster || !hero) return null;
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;

  const load = (src) => new Promise((ok, fail) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => ok(im);
    im.onerror = fail;
    im.src = src;
  });
  // An ImageBitmap uploads reliably; an <img> that has not been painted yet can
  // reach texImage2D undecoded and arrive black. Flipped here, because WebGL's
  // flip flag does not apply to bitmaps.
  const bitmap = (im) => (window.createImageBitmap ? createImageBitmap(im, { imageOrientation: 'flipY' }) : im);

  let THREE, day, night;
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    const [d, n] = await Promise.all([load(box.dataset.day), load(box.dataset.night)]);
    [day, night] = await Promise.all([bitmap(d), bitmap(n)]);
  } catch (err) {
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch (err) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const texture = (src) => {
    const t = new THREE.Texture(src);
    t.flipY = !(src instanceof ImageBitmap);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  const tDay = texture(day);
  const tNight = texture(night);

  const uniforms = {
    uDay: { value: tDay },
    uNight: { value: tNight },
    uRes: { value: new THREE.Vector2(1, 1) },
    uImg: { value: new THREE.Vector2(day.width, day.height) },
    uMouse: { value: new THREE.Vector2(0.62, 0.5) },
    uRadius: { value: finePointer ? 0.26 : 0.32 },
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uLight: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D uDay, uNight;
      uniform vec2 uRes, uImg, uMouse;
      uniform float uRadius, uTime, uReveal, uLight;
      varying vec2 vUv;
      // cover fit, matching the poster's object-position: center 55%
      vec2 cover(vec2 uv) {
        float rs = uRes.x / uRes.y, ri = uImg.x / uImg.y;
        vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
        return (1.0 - s) * vec2(0.5, 0.45) + uv * s;
      }
      void main() {
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        vec2 d = (vUv - uMouse) * asp;
        float dist = length(d);
        float ang = atan(d.y, d.x);
        float r = uRadius * (1.0 + 0.035 * sin(ang * 5.0 + uTime * 1.1) + 0.02 * sin(ang * 3.0 - uTime * 0.7));
        float lens = (1.0 - smoothstep(r * 0.6, r, dist)) * uReveal;
        float m = max(lens, uLight);
        vec2 inside = uMouse + (vUv - uMouse) * (1.0 - 0.05 * lens);
        vec3 dayCol = texture2D(uDay, cover(vUv)).rgb;
        vec3 nightCol = texture2D(uNight, cover(mix(vUv, inside, lens))).rgb;
        float rim = (smoothstep(r * 0.9, r, dist) - smoothstep(r, r * 1.05, dist)) * uReveal * (1.0 - uLight);
        vec3 col = mix(dayCol, nightCol, m) + vec3(0.85, 0.68, 0.4) * rim * 0.22;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, material));

  // pointer: the event only records where it is; the frame does the work
  const target = { x: 0.62, y: 0.5 };
  const mouse = uniforms.uMouse.value;
  const IDLE = 2600, DRIFT = 12000;           // ms before the drift starts, and how long it runs
  let lastInput = performance.now() - IDLE;     // start drifting straight away
  let px = 0, py = 0, pending = false;
  const onPointer = (e) => {
    if (!e.isPrimary) return;                  // one finger is enough for a lens
    px = e.clientX; py = e.clientY; pending = true;
    schedule();
  };
  const onLeave = () => { lastInput = performance.now() - IDLE; schedule(); };
  hero.addEventListener('pointermove', onPointer, { passive: true });
  hero.addEventListener('pointerdown', onPointer, { passive: true });
  hero.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);

  let rect = box.getBoundingClientRect();
  const resize = () => {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
    rect = box.getBoundingClientRect();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();

  let raf = 0, inView = true, alive = true;
  const t0 = performance.now();
  const frame = (now) => {
    raf = 0;
    if (!alive) return;
    const t = (now - t0) / 1000;
    if (pending) {
      pending = false;
      rect = box.getBoundingClientRect();
      target.x = (px - rect.left) / rect.width;
      target.y = 1 - (py - rect.top) / rect.height;
      lastInput = now;
      hero.classList.add('lens-used');
    }
    const idle = now - lastInput;
    if (idle > IDLE + DRIFT) {                 // long idle: rest, so nothing moves for ever
      target.x = 0.62; target.y = 0.5;
    } else if (idle > IDLE) {                  // idle: a slow drift across the house
      target.x = 0.5 + 0.2 * Math.sin(t * 0.21);
      target.y = 0.52 + 0.1 * Math.sin(t * 0.29 + 1.2);
    }
    mouse.x += (target.x - mouse.x) * 0.075;
    mouse.y += (target.y - mouse.y) * 0.075;
    uniforms.uTime.value = t;
    renderer.render(scene, camera);
    const settled = idle > IDLE + DRIFT && uniforms.uReveal.value >= 1
      && Math.abs(target.x - mouse.x) < 1e-3 && Math.abs(target.y - mouse.y) < 1e-3;
    if (!settled) schedule();
  };
  const schedule = () => { if (!raf && alive && inView && document.visibilityState === 'visible') raf = requestAnimationFrame(frame); };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; inView ? schedule() : stop(); });
  io.observe(hero);
  const onVisibility = () => (document.visibilityState === 'visible' ? schedule() : stop());
  document.addEventListener('visibilitychange', onVisibility);

  const onLost = (e) => { e.preventDefault(); alive = false; stop(); box.classList.remove('is-live'); hero.classList.remove('has-lens'); };
  canvas.addEventListener('webglcontextlost', onLost);

  // scrolling away from the hero switches the lights on across the whole house
  const lightST = ScrollTrigger.create({
    trigger: hero, start: 'top top', end: 'bottom 30%', scrub: true,
    onUpdate: (self) => { uniforms.uLight.value = self.progress; schedule(); },
  });

  renderer.render(scene, camera);
  box.classList.add('is-live');
  if (finePointer) hero.classList.add('has-lens');
  gsap.to(uniforms.uReveal, { value: 1, duration: 1.8, delay: 0.6, ease: 'power2.inOut' });
  schedule();

  return () => {
    alive = false;
    stop();
    io.disconnect();
    ro.disconnect();
    lightST.kill();
    hero.removeEventListener('pointermove', onPointer);
    hero.removeEventListener('pointerdown', onPointer);
    hero.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onLost);
    gsap.killTweensOf(uniforms.uReveal);
    tDay.dispose();
    tNight.dispose();
    [day, night].forEach((b) => { if (b && b.close) b.close(); });
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}

/* ---------- 9. Cleanup ---------- */
window.addEventListener('pagehide', (e) => {
  if (e.persisted) return;                     // kept in the back/forward cache
  while (cleanups.length) cleanups.pop()();
  if (ScrollTrigger) ScrollTrigger.getAll().forEach((st) => st.kill());
});
