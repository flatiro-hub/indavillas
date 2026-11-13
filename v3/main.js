/* ============================================================
   IndaVillas - shared behaviour for the four main pages (design v3)
   1. Capabilities      2. Navigation + menu     3. Split headings
   4. 365 nights grid   5. Forms + plan picker   6. Motion (GSAP, ScrollTrigger, Lenis)
   7. Hero lens (Three.js, homepage only)        8. Cleanup
   Every feature looks for its own markup first, so one file serves every page.

   Without JavaScript, or with reduced motion, or if a library fails to load,
   the page is complete: nothing here hides content it has not brought back.
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
const hero = document.querySelector('[data-hero]');   // the homepage photo hero or a page hero
if (nav && hero && 'IntersectionObserver' in window) {
  // solid once the hero has gone under the bar
  const navIO = new IntersectionObserver(([entry]) => {
    nav.classList.toggle('is-solid', !entry.isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px' });
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
  if (menu.hidden) return;
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
    // keep focus inside the toggle + menu while it is open
    const items = [toggle, ...menu.querySelectorAll('a')];
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) closeMenu(false); });
}

// In-page links: close the menu, and let Lenis do the travel when it is running.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id.length > 1 && document.querySelector(id);
  if (!target) return;
  closeMenu(false);
  if (!lenis) return;                          // native jump + scroll-margin
  e.preventDefault();
  lenis.scrollTo(target, { offset: id === '#top' ? 0 : -64, duration: 1.2 });
  history.replaceState(null, '', id);
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
});

/* ---------- 3. Split headings ----------
   Only plain text headings are split. The heading keeps its full text in a
   visually hidden span for assistive technology; the word spans are hidden
   from it. Links or inline markup are never split. */
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

/* ---------- 5. Form ---------- */
const LEAD_ENDPOINT = 'https://formsubmit.co/ajax/hi.flatiro@gmail.com';
const form = document.querySelector('[data-form]');
if (form) {
  const status = form.querySelector('[data-status]');
  const submit = form.querySelector('[type=submit]');
  const label = submit.querySelector('[data-label]');
  const submitLabel = label.textContent;
  const rules = {
    email: (v) => (!v ? 'Add your email so we can send it to you.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'That email address looks incomplete.'),
    whatsapp: (v) => (!v || /^\+?[\d\s().-]{7,}$/.test(v) ? '' : 'Use digits, starting with your country code.'),
    property: (v) => (v ? '' : 'Tell us roughly where the villa is.'),
    listing_url: (v) => (!v ? 'Paste the link to your Airbnb or Booking.com listing.' : /\S+\.\S+/.test(v) ? '' : 'That does not look like a link yet.'),
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
  form.querySelectorAll('.field input, .field select').forEach((input) => {
    input.addEventListener('blur', () => { if (input.value || input.dataset.touched) check(input); input.dataset.touched = '1'; });
    input.addEventListener('input', () => { if (input.closest('.field').classList.contains('is-invalid')) check(input); });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form__status';
    status.textContent = '';
    const inputs = [...form.querySelectorAll('.field input, .field select')];
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
      status.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path stroke-linejoin="round" d="M8.5 12.5L10.5 14.5L15.5 9.5"/></g></svg><span>Thank you. Your analysis is on its way, and we reply within one business day.</span>';
      status.setAttribute('tabindex', '-1');
      status.focus();
    } catch (err) {
      status.classList.add('is-error');
      status.textContent = "That didn't send. Check your connection and try again, or email hi.flatiro@gmail.com.";
      submit.disabled = false;
      label.textContent = submitLabel;
    }
  });
}

// "Start with Growth" and the like pre-select that plan in the form they scroll to.
const planField = document.querySelector('[data-plan-field]');
if (planField) {
  document.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', () => { planField.value = btn.dataset.plan; });
  });
}

/* ---------- 6. Motion ---------- */
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

  // Method: on wide screens the three phases travel sideways while pinned.
  // Created first, so every trigger further down measures with its pin spacing.
  const mm = gsap.matchMedia();
  const methodSection = document.querySelector('.method');
  if (methodSection) mm.add('(min-width: 901px)', () => {
    const section = methodSection;
    const viewport = section.querySelector('.method__viewport');
    const track = section.querySelector('[data-track]');
    section.classList.add('is-pinned');
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    gsap.to(track, {
      x: () => -distance(), ease: 'none',
      scrollTrigger: { trigger: '[data-method]', start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    return () => section.classList.remove('is-pinned');
  });
  cleanups.push(() => mm.revert());

  // Hero intro. Navigation, the lede and the CTA are usable from the first
  // frame; the photo opens up and the headline rises word by word.
  const media = document.querySelector('[data-hero-media]');
  const title = document.querySelector('.hero__title, .phero__title');
  const heroWords = splitWords(title);
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  if (media && hero && hero.classList.contains('hero')) {
    // homepage: the full screen photo opens from a band
    intro.fromTo(media,
      { clipPath: 'inset(34% 6% 34% 6% round 24px)', scale: 1.12 },
      { clipPath: 'inset(0% 0% 0% 0% round 0px)', scale: 1, duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0);
    gsap.to(media, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  } else if (media && hero) {
    // page hero: the framed photo rises open, then drifts inside its frame
    const img = media.querySelector('img');
    intro.fromTo(media, { clipPath: 'inset(100% 0% 0% 0% round 20px)' }, { clipPath: 'inset(0% 0% 0% 0% round 20px)', duration: 1.3, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.1);
    intro.fromTo(img, { scale: 1.25 }, { scale: 1.08, duration: 1.6, ease: 'expo.out' }, 0.1);
    gsap.fromTo(img, { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }
  intro.from('[data-hero-eyebrow]', { opacity: 0, y: 12, duration: 0.6 }, 0.2);
  if (heroWords) intro.from(heroWords, { yPercent: 110, duration: 0.9, stagger: 0.05 }, 0.25);
  else if (title) intro.from(title, { opacity: 0, y: 24, duration: 0.9 }, 0.25);

  // Services: the last word of the headline cycles through what the team is.
  if (rot) {
    const words = JSON.parse(rot.dataset.rotate);
    let i = 0;
    // reserve the height of the longest word, so the lines below never move
    const fit = () => {
      const shown = rot.textContent;
      let h = 0;
      rot.style.minHeight = '';
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
        .to(rot, { yPercent: -40, opacity: 0, duration: 0.45, ease: 'power2.in' })
        .call(() => { rot.textContent = words[i]; })
        .fromTo(rot, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out' })
        .call(() => gsap.delayedCall(2.6, turn));
    };
    gsap.delayedCall(3.2, turn);
  }

  // System: a brass line follows the reader down the seven steps.
  const stepsBar = document.querySelector('.steps__bar i');
  if (stepsBar) {
    gsap.fromTo(stepsBar, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.steps-wrap', start: 'top 70%', end: 'bottom 70%', scrub: true } });
  }

  // Section headings rise word by word, once.
  document.querySelectorAll('h2[data-split]:not([data-split="scrub"])').forEach((h) => {
    const words = splitWords(h);
    if (!words) return;
    gsap.from(words, { yPercent: 110, duration: 0.9, stagger: 0.04, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
  });

  // The manifesto fills in word by word with the scroll.
  document.querySelectorAll('[data-split="scrub"]').forEach((h) => {
    const words = splitWords(h);
    if (!words) return;
    gsap.fromTo(words, { opacity: 0.14 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: h, start: 'top 78%', end: 'bottom 42%', scrub: true } });
  });

  // Blocks fade up as they arrive, once.
  const reveals = gsap.utils.toArray('[data-reveal], .gap__row, .plan, .card, .step, .sub, .fact, .tcol');
  gsap.set(reveals, { y: 40, opacity: 0 });
  ScrollTrigger.batch(reveals, {
    start: 'top 90%', once: true,
    onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'power3.out', overwrite: true }),
  });

  // The gap: bars grow to their share and the figures count up, once.
  document.querySelectorAll('.gap__row').forEach((row) => {
    const [med, top] = row.querySelectorAll('.gap__bar');
    const nums = row.querySelectorAll('[data-count]');
    const css = getComputedStyle(row);
    gsap.set([med, top], { scaleX: 0 });
    nums.forEach((n) => { n.textContent = '$0K'; });
    ScrollTrigger.create({
      trigger: row, start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to(med, { scaleX: parseFloat(css.getPropertyValue('--med')), duration: 1.2, ease: 'expo.out', delay: 0.15 });
        gsap.to(top, { scaleX: parseFloat(css.getPropertyValue('--top')), duration: 1.4, ease: 'expo.out', delay: 0.25 });
        nums.forEach((n) => {
          const o = { v: 0 };
          gsap.to(o, { v: Number(n.dataset.count), duration: 1.3, delay: 0.2, ease: 'power2.out', onUpdate: () => { n.textContent = '$' + Math.round(o.v) + 'K'; } });
        });
      },
    });
  });

  // 365 nights: the year fills in calendar order as the grid scrolls through.
  if (nightCells.length) {
    paintNights(0);
    ScrollTrigger.create({
      trigger: nightsGrid, start: 'top 82%', end: 'bottom 38%', scrub: true,
      onUpdate: (self) => paintNights(Math.round(self.progress * NIGHTS)),
    });
  }

  // Final CTA: the pool photo settles as the section scrolls in.
  document.querySelectorAll('.final').forEach((sec) => {
    const img = sec.querySelector('.final__media img');
    if (img) gsap.fromTo(img, { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Re-measure once fonts and late images have changed the layout.
  const refresh = () => ScrollTrigger.refresh();
  document.fonts && document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh, { once: true });

  initLens().then((dispose) => { if (dispose) cleanups.push(dispose); });
}

/* ---------- 7. Hero lens (Three.js) ----------
   One canvas, one job: the photo is muted outside a soft lens and in full
   colour inside it, so the pointer "brings out" the villa, as the headline says.
   On touch the lens drifts on its own and follows a finger while it moves.
   Pixel ratio capped at 1.5, nothing allocated per frame, rendering paused
   offscreen and in hidden tabs, and the <img> poster stays underneath for
   WebGL failure or context loss. */
async function initLens() {
  const media = document.querySelector('[data-hero-media]');
  const canvas = media && media.querySelector('canvas');
  const img = media && media.querySelector('img');
  if (!canvas || !img) return null;
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;

  let THREE, source;
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    // the load event, not img.decode(): decode waits for a painted frame,
    // which a tab opened in the background may not get for a while
    if (!img.complete) await new Promise((ok, fail) => { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', fail, { once: true }); });
    // An ImageBitmap uploads reliably; an <img> that has not been painted yet
    // can reach texImage2D undecoded and arrive black. Flipped here, because
    // WebGL's flip flag does not apply to bitmaps.
    source = window.createImageBitmap ? await createImageBitmap(img, { imageOrientation: 'flipY' }) : img;
  } catch (err) {
    return null;
  }
  if (!img.naturalWidth) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch (err) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const texture = new THREE.Texture(source);
  texture.flipY = source === img;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const uniforms = {
    uTex: { value: texture },
    uRes: { value: new THREE.Vector2(1, 1) },
    uImg: { value: new THREE.Vector2(img.naturalWidth, img.naturalHeight) },
    uMouse: { value: new THREE.Vector2(0.64, 0.46) },
    uRadius: { value: finePointer ? 0.24 : 0.3 },
    uTime: { value: 0 },
    uReveal: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes, uImg, uMouse;
      uniform float uRadius, uTime, uReveal;
      varying vec2 vUv;
      // cover-fit, matching the poster's object-position: center 46%
      vec2 cover(vec2 uv) {
        float rs = uRes.x / uRes.y, ri = uImg.x / uImg.y;
        vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
        return (1.0 - s) * vec2(0.5, 0.54) + uv * s;
      }
      void main() {
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        vec2 d = (vUv - uMouse) * asp;
        float dist = length(d);
        float ang = atan(d.y, d.x);
        float r = uRadius * (1.0 + 0.035 * sin(ang * 5.0 + uTime * 1.1) + 0.02 * sin(ang * 3.0 - uTime * 0.7));
        float lens = (1.0 - smoothstep(r * 0.62, r, dist)) * uReveal;
        vec2 inside = uMouse + (vUv - uMouse) * (1.0 - 0.07 * lens);   // a slight magnify
        vec3 base = texture2D(uTex, cover(vUv)).rgb;
        vec3 full = texture2D(uTex, cover(inside)).rgb * vec3(1.04, 1.01, 0.95);
        float g = dot(base, vec3(0.299, 0.587, 0.114));
        vec3 muted = mix(vec3(g), base, 0.3) * 0.84 + 0.035;
        float rim = (smoothstep(r * 0.9, r, dist) - smoothstep(r, r * 1.05, dist)) * uReveal;
        vec3 col = mix(muted, full, lens) + vec3(0.84, 0.7, 0.45) * rim * 0.18;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, material));

  // pointer: the event only records where it is; the frame does the work
  const target = { x: 0.64, y: 0.46 };
  const mouse = uniforms.uMouse.value;
  let lastInput = -1e9;
  let px = 0, py = 0, pending = false;
  const onPointer = (e) => {
    if (!e.isPrimary) return;                  // one finger is enough for a lens
    px = e.clientX; py = e.clientY; pending = true;
  };
  const onLeave = () => { lastInput = -1e9; };
  hero.addEventListener('pointermove', onPointer, { passive: true });
  hero.addEventListener('pointerdown', onPointer, { passive: true });
  hero.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);

  let box = media.getBoundingClientRect();
  const resize = () => {
    const w = media.clientWidth, h = media.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
    box = media.getBoundingClientRect();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(media);
  resize();

  let raf = 0, inView = true, alive = true;
  const t0 = performance.now();
  const frame = (now) => {
    raf = 0;
    if (!alive) return;
    const t = (now - t0) / 1000;
    if (pending) {
      pending = false;
      box = media.getBoundingClientRect();
      target.x = (px - box.left) / box.width;
      target.y = 1 - (py - box.top) / box.height;
      lastInput = now;
      hero.classList.add('lens-used');
    }
    if (now - lastInput > 2600) {               // idle: a slow drift across the house
      target.x = 0.6 + 0.17 * Math.sin(t * 0.23);
      target.y = 0.5 + 0.11 * Math.sin(t * 0.31 + 1.2);
    }
    mouse.x += (target.x - mouse.x) * 0.075;
    mouse.y += (target.y - mouse.y) * 0.075;
    uniforms.uTime.value = t;
    renderer.render(scene, camera);
    schedule();
  };
  const schedule = () => { if (!raf && alive && inView && document.visibilityState === 'visible') raf = requestAnimationFrame(frame); };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; inView ? schedule() : stop(); });
  io.observe(hero);
  const onVisibility = () => (document.visibilityState === 'visible' ? schedule() : stop());
  document.addEventListener('visibilitychange', onVisibility);

  const onLost = (e) => { e.preventDefault(); alive = false; stop(); media.classList.remove('is-live'); hero.classList.remove('has-lens'); };
  canvas.addEventListener('webglcontextlost', onLost);

  renderer.render(scene, camera);
  media.classList.add('is-live');
  if (finePointer) hero.classList.add('has-lens');
  gsap.to(uniforms.uReveal, { value: 1, duration: 1.8, delay: 1.1, ease: 'power2.inOut' });
  schedule();

  return () => {
    alive = false;
    stop();
    io.disconnect();
    ro.disconnect();
    hero.removeEventListener('pointermove', onPointer);
    hero.removeEventListener('pointerdown', onPointer);
    hero.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onLost);
    gsap.killTweensOf(uniforms.uReveal);
    texture.dispose();
    if (source !== img && source.close) source.close();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}

/* ---------- 8. Cleanup ---------- */
window.addEventListener('pagehide', (e) => {
  if (e.persisted) return;                     // kept in the back/forward cache
  while (cleanups.length) cleanups.pop()();
  if (ScrollTrigger) ScrollTrigger.getAll().forEach((st) => st.kill());
});
