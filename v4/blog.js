/* ============================================================
   IndaVillas blog behaviour (design v4). Loaded by /blog/ pages only,
   after main.js (menu, forms). Three small jobs, each looking for its
   own markup first; without JavaScript every page is complete:
   1. Topic filter on the index (the bar stays hidden without JS).
   2. Copy link in the share rows (the button stays hidden without JS).
   3. Contents: marks the section being read.
   ============================================================ */
(() => {
  /* ---------- 1. Topic filter ---------- */
  const bar = document.querySelector('[data-filters]');
  const cards = [...document.querySelectorAll('.bc-grid--index .bc')];
  if (bar && cards.length) {
    const status = document.querySelector('[data-filter-status]');
    const empty = document.querySelector('[data-filter-empty]');
    const pills = [...bar.querySelectorAll('[data-filter]')];
    const apply = (cat, push) => {
      let shown = 0;
      cards.forEach((c) => {
        const on = cat === 'all' || c.dataset.cat === cat;
        c.hidden = !on;
        if (on) shown++;
      });
      pills.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.filter === cat)));
      if (empty) empty.hidden = shown > 0;
      if (status) status.textContent = `${shown} article${shown === 1 ? '' : 's'} shown`;
      if (push) {
        const url = new URL(location.href);
        if (cat === 'all') url.searchParams.delete('topic'); else url.searchParams.set('topic', cat);
        history.replaceState(null, '', url);
      }
    };
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (b) apply(b.dataset.filter, true);
    });
    const start = new URL(location.href).searchParams.get('topic');
    apply(start && pills.some((p) => p.dataset.filter === start) ? start : 'all', false);
    bar.hidden = false;
  }

  /* ---------- 2. Copy link ---------- */
  if (navigator.clipboard && window.isSecureContext) {
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.hidden = false;
      const ok = btn.parentElement.querySelector('.share__ok');
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          if (ok) ok.textContent = 'Link copied';
        } catch {
          if (ok) ok.textContent = 'Could not copy. Copy the address from the bar above.';
        }
        setTimeout(() => { if (ok) ok.textContent = ''; }, 2600);
      });
    });
  }

  /* ---------- 3. Contents: the section being read ---------- */
  const links = [...document.querySelectorAll('.ar-toc a[href^="#"]')];
  if (links.length) {
    // the last heading that has passed the line under the top bar is the one being read
    const heads = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    let current = null;
    let queued = false;
    const update = () => {
      queued = false;
      const line = 140;
      let id = null;
      for (const h of heads) {
        if (h.getBoundingClientRect().top <= line) id = h.id; else break;
      }
      if (id === current) return;
      current = id;
      links.forEach((a) => {
        if (id && a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* close the mobile contents after a jump, so the text is in view */
  document.querySelectorAll('.ar-toc-m a').forEach((a) => {
    a.addEventListener('click', () => { a.closest('details').open = false; });
  });
})();
