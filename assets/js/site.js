/* ============================================================
   IndaVillas — shared behaviour
   Vanilla JS, no dependencies. Loaded with `defer` on every page.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. (the header is a floating bar with its own surface: no script) ---------- */

  /* ---------- 2. MOBILE DRAWER (focus-trapped, ESC to close) ---------- */
  var burger = document.querySelector('.burger');
  var drawer = document.getElementById('drawer');
  if (burger && drawer) {
    var lastFocus = null;

    var focusables = function () {
      return drawer.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
    };

    var openDrawer = function () {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked');
      // next frame: the panel is visible, so the transition runs and focus lands
      requestAnimationFrame(function () {
        drawer.classList.add('is-open');
        void drawer.offsetWidth;          /* flush styles so the panel is focusable */
        var first = focusables()[0];
        if (first) first.focus();
      });
    };

    var closeDrawer = function () {
      drawer.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
      window.setTimeout(function () { drawer.hidden = true; }, reduceMotion ? 0 : 300);
      if (lastFocus) lastFocus.focus();
    };

    burger.addEventListener('click', function () {
      if (burger.getAttribute('aria-expanded') === 'true') { closeDrawer(); } else { openDrawer(); }
    });

    // close on any link tap inside the drawer
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeDrawer();
    });

    document.addEventListener('keydown', function (e) {
      if (burger.getAttribute('aria-expanded') !== 'true') return;
      if (e.key === 'Escape') { closeDrawer(); return; }
      if (e.key !== 'Tab') return;
      var items = focusables();
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // if the viewport grows past the mobile breakpoint, drop the drawer state
    window.matchMedia('(min-width: 981px)').addEventListener('change', function (m) {
      if (m.matches && burger.getAttribute('aria-expanded') === 'true') closeDrawer();
    });
  }

  /* ---------- 3. MOBILE STICKY CTA — appears once the hero is behind you ---------- */
  var dock = document.querySelector('.dock');
  if (dock) {
    var dockOn = function () {
      dock.classList.toggle('is-up', window.scrollY > window.innerHeight * 0.75);
    };
    dockOn();
    window.addEventListener('scroll', dockOn, { passive: true });
  }

  /* ---------- 4. LEAD FORMS -> FormSubmit (no backend) ----------
     The very first submission triggers a one-time confirmation email from
     formsubmit.co to the address below. It must be confirmed before leads
     are delivered. Change the address in ONE place: LEAD_ENDPOINT.        */
  var LEAD_ENDPOINT = 'https://formsubmit.co/ajax/hi.flatiro@gmail.com';

  document.querySelectorAll('form[data-lead]').forEach(function (form) {
    var shell = form.closest('.lead') || form.parentElement;
    var ok = shell.querySelector('.lead__success');
    var err = shell.querySelector('.lead__error');
    var btn = form.querySelector('button[type=submit]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (err) err.classList.remove('show');
      if (!form.reportValidity()) return;

      var label = btn.textContent;
      btn.textContent = 'Sending…';
      btn.disabled = true;

      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('bad status');
          form.hidden = true;
          var note = shell.querySelector('.lead__note');
          if (note) note.hidden = true;
          if (ok) {
            ok.classList.add('show');
            ok.setAttribute('tabindex', '-1');
            ok.focus();
          }
        })
        .catch(function () {
          btn.textContent = label;
          btn.disabled = false;
          if (err) err.classList.add('show');
        });
    });
  });

  /* ---------- 5. ROTATING HEADLINE WORD (services page) ---------- */
  var rot = document.querySelector('.rot__w');
  if (rot && !reduceMotion) {
    var words = JSON.parse(rot.dataset.rotate);
    var i = 0;
    window.setInterval(function () {
      rot.classList.add('is-out');
      window.setTimeout(function () {
        i = (i + 1) % words.length;
        rot.textContent = words[i];
        rot.classList.remove('is-out');
        rot.classList.add('is-pre');
        void rot.offsetWidth;              /* force reflow so the slide-in runs */
        rot.classList.remove('is-pre');
      }, 460);
    }, 3600);
  }

  /* ---------- 6. BACKGROUND VIDEO — only loaded as the section approaches ---------- */
  var videoHost = document.querySelector('.final__video');
  if (videoHost && videoHost.dataset.video) {
    var vio = new IntersectionObserver(function (entries) {
      if (!entries.some(function (en) { return en.isIntersecting; })) return;
      vio.disconnect();
      var id = videoHost.dataset.video;
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube.com/embed/' + id +
        '?autoplay=' + (reduceMotion ? 0 : 1) +
        '&mute=1&loop=1&playlist=' + id +
        '&controls=0&modestbranding=1&playsinline=1&rel=0';
      frame.title = 'IndaVillas background video';
      frame.allow = 'autoplay; encrypted-media';
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      videoHost.appendChild(frame);
    }, { rootMargin: '600px' });
    vio.observe(videoHost.closest('.final'));
  }

  /* ---------- 7. PRICING PAGE: plan picker + multi-property quote ----------
     Any [data-plan] button pre-selects that plan in the audit form it scrolls
     to. The quote follows the published rule: the highest-priced property pays
     its plan in full, every other one is 25% off, and 6 or more properties get
     partner pricing instead of a number. Excellence is quoted per villa, so it
     shows as "Custom quote"; as the higher plan, it is the full-price property
     whenever there is one, which puts every Growth villa at the 25% rate.     */
  var planField = document.querySelector('[data-plan-field]');
  var portField = document.querySelector('[data-port-field]');
  document.querySelectorAll('[data-plan]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (planField) planField.value = btn.dataset.plan;
      // only the quote's own button attaches the portfolio to the lead
      if (portField && !btn.hasAttribute('data-port-cta')) portField.value = '';
    });
  });

  var port = document.querySelector('[data-port]');
  if (port) {
    var GROWTH = { full: 3999, extra: 2999 };
    var PARTNER_AT = 6;
    var usdQ = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    var count = { exc: 0, gro: 2 };
    var summary = '';
    var pq = function (sel) { return port.querySelector(sel); };

    var quote = function () {
      var lines = [], total = 0, g = count.gro;
      if (count.exc) lines.push(['Excellence x ' + count.exc, null]);
      if (g && !count.exc) {
        lines.push(['Growth, highest priced property', GROWTH.full]);
        total += GROWTH.full;
        g -= 1;
      }
      if (g) {
        lines.push(['Growth x ' + g + ', 25% off', g * GROWTH.extra]);
        total += g * GROWTH.extra;
      }
      return { lines: lines, total: total, saving: count.gro * GROWTH.full - total };
    };

    var paintQuote = function () {
      var n = count.exc + count.gro;
      var partner = n >= PARTNER_AT;
      port.querySelectorAll('[data-step]').forEach(function (b) {
        // never below one property in total, never past the partner threshold
        b.disabled = Number(b.dataset.dir) < 0 ? (count[b.dataset.step] === 0 || n === 1) : partner;
      });
      pq('[data-count="exc"]').textContent = count.exc;
      pq('[data-count="gro"]').textContent = count.gro;
      pq('[data-quote]').hidden = partner;
      pq('[data-partner]').hidden = !partner;

      var r = quote();
      pq('[data-lines]').innerHTML = r.lines.map(function (l) {
        return '<li><span>' + l[0] + '</span><b>' + (l[1] == null ? 'Custom quote' : usdQ.format(l[1])) + '</b></li>';
      }).join('');
      pq('[data-total]').innerHTML = count.exc
        ? (r.total ? usdQ.format(r.total) + ' <small>+ Excellence quote</small>' : 'Custom quote')
        : usdQ.format(r.total);
      var save = pq('[data-save]');
      save.hidden = !r.saving;
      save.textContent = 'You save ' + usdQ.format(r.saving) + ' a year on Growth against full price.';

      summary = partner
        ? PARTNER_AT + '+ properties (partner pricing): ' + count.exc + ' on Excellence, ' + count.gro + ' on Growth'
        : count.exc + ' on Excellence (custom quote), ' + count.gro + ' on Growth' + (r.total ? ': ' + usdQ.format(r.total) + ' a year for Growth' : '');
    };

    port.addEventListener('click', function (e) {
      var b = e.target.closest('[data-step]');
      if (!b || b.disabled) return;
      count[b.dataset.step] = Math.max(0, count[b.dataset.step] + Number(b.dataset.dir));
      paintQuote();
    });
    var portCta = pq('[data-port-cta]');
    if (portCta && portField) {
      portCta.addEventListener('click', function () { portField.value = summary; });
    }
    paintQuote();
  }

  /* ---------- 7b. DIRECT-BOOKING MODEL (revenue-calculator page) ----------
     Ported from Flatiro's revenue model, unchanged:
       annualGross  = rate x 365 x occupancy
       feesNow      = annualGross x commission
       feesAfter    = annualGross x (1 - directShare) x commission
       netSaving    = (feesNow - feesAfter) - (annualGross x directShare x 2%)
     Every input is visible and adjustable, because the honest answer depends on
     numbers only the host knows.                                              */
  var rate = document.getElementById('dbc-rate');
  if (rate) {
    var PROCESSING = 0.02;
    var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    var occ = document.getElementById('dbc-occ');
    var com = document.getElementById('dbc-com');
    var dir = document.getElementById('dbc-dir');
    var el = function (n) { return document.querySelector('[data-dbc="' + n + '"]'); };

    var paintTrack = function (input) {
      var pct = (input.value - input.min) / (input.max - input.min) * 100;
      input.style.setProperty('--p', pct + '%');
    };

    var runModel = function () {
      var r = Math.max(0, Number(rate.value) || 0);
      var o = Number(occ.value) / 100;
      var c = Number(com.value) / 100;
      var d = Number(dir.value) / 100;

      var annualGross = r * 365 * o;
      var feesNow = annualGross * c;
      var feesAfter = annualGross * (1 - d) * c;
      var processing = annualGross * d * PROCESSING;
      var netSaving = feesNow - feesAfter - processing;

      [occ, com, dir].forEach(paintTrack);
      el('occ-v').textContent = Math.round(o * 100) + '%';
      el('com-v').textContent = Math.round(c * 100) + '%';
      el('dir-v').textContent = Math.round(d * 100) + '%';

      el('feesnow').textContent = usd0.format(Math.round(feesNow));
      el('gross').textContent = usd0.format(Math.round(annualGross));
      el('feesafter').textContent = usd0.format(Math.round(feesAfter));
      el('processing').textContent = usd0.format(Math.round(processing));
      el('keep').textContent = usd0.format(Math.round(netSaving));
      el('monthly').textContent = usd0.format(Math.round(netSaving / 12));
    };

    [rate, occ, com, dir].forEach(function (input) {
      input.addEventListener('input', runModel);
    });
    runModel();
  }

  /* ---------- 7c. HERO PARALLAX ----------
     The image drifts at a fraction of the scroll speed. Travel is capped to the
     headroom the CSS scale provides, so an edge can never come into view. Reads
     scroll position inside a rAF frame and writes once, to stay off the main
     thread's critical path. */
  var heroSection = document.querySelector('.hero');
  var heroMedia = heroSection && heroSection.querySelector('.hero__media');
  var heroImg = heroMedia && heroMedia.querySelector('img');

  if (heroImg && !reduceMotion) {
    heroMedia.classList.add('is-parallax');

    var DEPTH = 0.22;                 // travel as a share of hero height
    var parked = false;
    var queued = false;

    var drawParallax = function () {
      queued = false;
      var h = heroSection.offsetHeight || 1;

      // once the hero is fully scrolled past there is nothing to move; park it
      if (window.scrollY > h) {
        if (!parked) {
          heroImg.style.transform = 'translate3d(0,' + (h * DEPTH).toFixed(1) + 'px,0) scale(1.48)';
          parked = true;
        }
        return;
      }
      parked = false;
      var shift = Math.max(0, window.scrollY) * DEPTH;
      heroImg.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0) scale(1.48)';
    };

    var onParallaxScroll = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(drawParallax);
    };

    drawParallax();
    window.addEventListener('scroll', onParallaxScroll, { passive: true });
    window.addEventListener('resize', onParallaxScroll, { passive: true });
  }

  /* ---------- 8. SCROLL REVEAL (staggered by row) ---------- */
  var targets = document.querySelectorAll('[data-reveal], .sec-head, .card, .pcard, .split, .stat, .plan, .guarantee, .calc__card, .calc__txt, .tl__item, .phase, .tcol, .step, .band__card, .device__shot, .device__txt');
  if (targets.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

    targets.forEach(function (el) {
      el.classList.add('reveal');
      var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) {
        return c.classList.contains('reveal');
      });
      el.style.transitionDelay = (sibs.indexOf(el) % 3) * 85 + 'ms';
      io.observe(el);
    });
  }

  /* ---------- 9. TAGLINE REVEAL ----------
     Splits each [data-tagline] into words. A word turns from 30% to full
     colour once it crosses a line 60% down the viewport. Within a line the
     trigger is staggered left to right (the last word needs another 48px of
     scroll), so the sentence fills one word at a time in reading order. One passive scroll listener,
     throttled to a frame; it lets go once every word is on. With reduced
     motion the CSS shows the full text and nothing here runs. */
  var taglines = document.querySelectorAll('[data-tagline]');
  if (taglines.length && !reduceMotion) {
    var twords = [];
    var STAGGER = 48;
    var splitWords = function (node, box) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) { splitWords(child, box); return; }
        if (child.nodeType !== 3 || !child.textContent.trim()) return;
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement('span');
          w.className = 'tw';
          w.textContent = part;
          frag.appendChild(w);
          twords.push({ el: w, box: box });
        });
        child.parentNode.replaceChild(frag, child);
      });
    };
    taglines.forEach(function (el) {
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
      splitWords(el, el);
    });

    var pending = false;
    var paintWords = function () {
      pending = false;
      var line = window.innerHeight * 0.6;
      var lit = 0;
      var boxes = new Map();
      twords.forEach(function (w) {
        if (!boxes.has(w.box)) boxes.set(w.box, w.box.getBoundingClientRect());
        var b = boxes.get(w.box), r = w.el.getBoundingClientRect();
        var on = r.top + (r.left - b.left) / (b.width || 1) * STAGGER < line;
        w.el.classList.toggle('is-on', on);
        if (on) lit++;
      });
      if (lit === twords.length) window.removeEventListener('scroll', onWordsScroll);
    };
    var onWordsScroll = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(paintWords);
    };
    paintWords();
    window.addEventListener('scroll', onWordsScroll, { passive: true });
  }

  /* ---------- 10. FOOTER YEAR ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
