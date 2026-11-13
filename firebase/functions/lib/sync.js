/* Daily Hostex sync: villas, performance figures, pace, prices + change log, review insights, pricing suggestions,
 * automatic cleaning tasks and plan invoices that are due.
 * Writes the documents the portal page reads (same ones the Guesty sync used, so firestore.rules stay as they are):
 *   system/guestyListings              { items: [{ id, name, active }] }   ← Hostex properties
 *   system/guestySync                  { at, source, listings, owners, relinked, analytics, errors, … }
 *   clients/{email}/analytics/summary  performance + pace + reviews (owner-visible)
 *   clients/{email}/analytics/pricing  next 90 days of rates + change log (owner-visible)
 *   revenue/{propertyId}.row           pricing & pace summary for the admin portfolio (admin only, via portalApi) */
const { Timestamp } = require("firebase-admin/firestore");
const { today, addDays, daysBetween, monthAdd, dim, monthEnd, dow, median, mode, norm, pool } = require("./util");
const { hostexClient, LIVE, chLabel, rentalRevenue, cleaningFeeOf, liveTrimmed } = require("./hostex");
const { R, loadCalendar, villaReport, portfolioRow } = require("./revenue");
const reviewsLib = require("./reviews");
const ops = require("./ops");
const billing = require("./billing");

/* ------------------------------------------------------------------ analytics (clients/{email}/analytics/summary) */
function analytics(resAll, props, ids, now = today()) {
  ids = ids.map(String);
  const mine = props.filter(p => ids.includes(String(p.id))), units = Math.max(1, mine.length);
  const cur = now.slice(0, 7), first = monthAdd(cur, -24), last = monthAdd(cur, 6);
  const res = resAll.filter(r => ids.includes(String(r.property_id)) && LIVE.includes(r.status) && r.check_in_date && r.check_out_date);
  const cc = {}; for (const r of res) { const v = rentalRevenue(r); if (v?.currency) cc[v.currency] = (cc[v.currency] || 0) + 1; }
  const currency = Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0] || "USD";
  const M = {}; for (let m = first; m <= last; m = monthAdd(m, 1)) M[m] = { m, nights: 0, stays: 0, available: dim(m) * units, revenue: 0, leadSum: 0, leadN: 0, future: m > cur };
  const stays = []; let firstStay = null, skipped = 0;
  for (const r of res) {
    const total = daysBetween(r.check_in_date, r.check_out_date); if (total <= 0) continue;
    const rv = rentalRevenue(r), ok = rv && (rv.currency || currency) === currency; if (rv && !ok) skipped++;
    const perNight = ok ? rv.amount / total : 0;
    for (let d = r.check_in_date; d < r.check_out_date; d = addDays(d, 1)) { const x = M[d.slice(0, 7)]; if (x) { x.nights++; x.revenue += perNight; } }
    const booked = String(r.booked_at || r.created_at || "").slice(0, 10), lead = booked ? Math.max(0, daysBetween(booked, r.check_in_date)) : null;
    const xm = M[r.check_in_date.slice(0, 7)]; if (xm) { xm.stays++; if (lead != null) { xm.leadSum += lead; xm.leadN++; } }
    if (!firstStay || r.check_in_date < firstStay) firstStay = r.check_in_date;
    stays.push({ r, lead, rev: ok ? rv.amount : null, total });
  }
  const months = Object.values(M).map(x => ({ m: x.m, nights: x.nights, stays: x.stays, available: x.available, revenue: Math.round(x.revenue),
    occupancy: Math.round((x.nights / x.available) * 1000) / 10, adr: x.nights ? Math.round(x.revenue / x.nights) : 0, revpan: Math.round(x.revenue / x.available),
    lead: x.leadN ? Math.round(x.leadSum / x.leadN) : null, leadN: x.leadN, future: x.future }));
  const range = (a, b) => months.filter(x => x.m >= a && x.m <= b);
  const per = (ms, a, b) => {
    const rv = ms.reduce((s, x) => s + x.revenue, 0), n = ms.reduce((s, x) => s + x.nights, 0), av = ms.reduce((s, x) => s + x.available, 0);
    const leads = stays.filter(s => s.lead != null && s.r.check_in_date.slice(0, 7) >= a && s.r.check_in_date.slice(0, 7) <= b).map(s => s.lead).sort((p, q) => p - q);
    return { revenue: rv, nights: n, available: av, occupancy: av ? Math.round((n / av) * 1000) / 10 : 0, adr: n ? Math.round(rv / n) : 0, revpan: av ? Math.round(rv / av) : 0,
      lead: leads.length ? Math.round(leads.reduce((s, x) => s + x, 0) / leads.length) : null, leadMedian: leads.length ? leads[Math.floor(leads.length / 2)] : null, leadN: leads.length };
  };
  const l12a = monthAdd(cur, -12), l12b = monthAdd(cur, -1), p12a = monthAdd(cur, -24), p12b = monthAdd(cur, -13);
  const histFrom = firstStay && firstStay.slice(0, 7) > first ? firstStay.slice(0, 7) : first;
  const thisM = M[cur], next3 = range(monthAdd(cur, 1), monthAdd(cur, 3));
  const l12stays = stays.filter(s => s.r.check_in_date.slice(0, 7) >= l12a && s.r.check_in_date.slice(0, 7) <= l12b);
  const chMap = {};
  for (const s of stays) {
    let n = 0; for (let d = s.r.check_in_date; d < s.r.check_out_date; d = addDays(d, 1)) if (d.slice(0, 7) >= l12a && d.slice(0, 7) <= l12b) n++;
    if (!n) continue; const c = chLabel(s.r.channel_type), e = (chMap[c] ||= { source: c, revenue: 0, nights: 0, leadSum: 0, leadN: 0 });
    e.nights += n; e.revenue += s.rev != null ? (s.rev / s.total) * n : 0; if (s.lead != null) { e.leadSum += s.lead; e.leadN++; }
  }
  const buckets = [["0–7 days", 0, 7], ["8–30 days", 8, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["91–180 days", 91, 180], ["180+ days", 181, 1e9]];
  const title = id => mine.find(p => String(p.id) === String(id))?.title || "";
  return {
    source: "hostex", currency, units, historyMonths: firstStay ? Math.max(0, Math.min(24, (Number(cur.slice(0, 4)) - Number(histFrom.slice(0, 4))) * 12 + Number(cur.slice(5)) - Number(histFrom.slice(5)))) : 0,
    syncedAt: Timestamp.now(), skippedOtherCurrency: skipped,
    listings: mine.map(p => ({ id: String(p.id), name: p.title })),
    months: months.filter(x => x.m >= histFrom || x.future || x.m === cur),
    kpi: { last12: per(range(l12a, l12b), l12a, l12b), prev12: range(p12a, p12b).some(x => x.nights) ? per(range(p12a, p12b), p12a, p12b) : null,
      thisMonth: { revenue: Math.round(thisM.revenue), nights: thisM.nights, occupancy: Math.round((thisM.nights / thisM.available) * 1000) / 10,
        adr: thisM.nights ? Math.round(thisM.revenue / thisM.nights) : 0, revpan: Math.round(thisM.revenue / thisM.available) },
      next3: { revenue: next3.reduce((s, x) => s + x.revenue, 0), nights: next3.reduce((s, x) => s + x.nights, 0) } },
    leadBuckets: buckets.map(([label, a, b]) => ({ label, stays: l12stays.filter(s => s.lead != null && s.lead >= a && s.lead <= b).length })),
    channels: Object.values(chMap).sort((a, b) => b.revenue - a.revenue || b.nights - a.nights).map(e => ({ source: e.source, revenue: Math.round(e.revenue), nights: e.nights, lead: e.leadN ? Math.round(e.leadSum / e.leadN) : null })),
    upcoming: stays.filter(s => s.r.check_in_date >= now).sort((a, b) => a.r.check_in_date.localeCompare(b.r.check_in_date)).slice(0, 10).map(s => ({
      checkIn: s.r.check_in_date, checkOut: s.r.check_out_date, nights: s.total, source: chLabel(s.r.channel_type), listing: title(s.r.property_id),
      guest: (s.r.guest_name || "").trim().split(/\s+/)[0] || "", revenue: s.rev != null ? Math.round(s.rev) : null, lead: s.lead, status: s.r.status })),
  };
}

/* ------------------------------------------------------------------ pricing (clients/{email}/analytics/pricing) */
// cals: { [propertyId]: loadCalendar() result } — the first channel listing (Airbnb if connected) is the reference price
function pricing(resAll, props, ids, cals, prev, now = today()) {
  const mine = props.filter(p => ids.map(String).includes(String(p.id))); if (!mine.length) return null;
  const start = now, end = addDays(now, 89), listings = [], days = [];
  for (const [i, p] of mine.entries()) {
    const cal = cals[p.id] || { listings: [], avail: {} }, L = cal.listings[0], map = {};
    for (const [d, x] of Object.entries(L?.cal || {})) map[d] = { p: x.p, mn: x.min };
    const n30 = Object.entries(map).filter(([d]) => d < addDays(now, 30));
    const wd = n30.filter(([d]) => ![5, 6].includes(dow(d))).map(([, x]) => x.p), we = n30.filter(([d]) => [5, 6].includes(dow(d))).map(([, x]) => x.p);
    const recent = resAll.filter(r => String(r.property_id) === String(p.id) && LIVE.includes(r.status)).sort((a, b) => String(b.check_in_date).localeCompare(String(a.check_in_date)));
    listings.push({ id: String(p.id), name: p.title, channel: L ? L.label : "", currency: L?.currency || "",
      basePrice: median(wd), weekendBasePrice: median(we), minNights: mode(n30.map(([, x]) => x.mn)), maxNights: null,
      weeklyDiscount: null, monthlyDiscount: null, cleaningFee: recent.map(cleaningFeeOf).find(x => x != null) ?? null, _map: map });
    if (i === 0) {
      const res = resAll.filter(r => String(r.property_id) === String(p.id) && LIVE.includes(r.status));
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const booked = res.some(r => r.check_in_date <= d && r.check_out_date > d);
        days.push({ d, p: map[d]?.p ?? null, mn: map[d]?.mn ?? null, s: booked ? "booked" : cal.avail[d] === false ? "blocked" : "open" });
      }
    }
  }
  const by = {}; for (const x of days) { const m = x.d.slice(0, 7), e = (by[m] ||= { m, sum: 0, n: 0, booked: 0, open: 0, blocked: 0 }); if (x.p != null) { e.sum += x.p; e.n++; } e[x.s]++; }
  const priced = days.filter(x => x.p != null && x.d < addDays(now, 30));
  // change log: compare with the previous sync
  const changes = [...(prev?.changes || [])], snap = {};
  for (const L of listings) {
    const old = prev?.snapshot?.[L.id], label = mine.length > 1 ? L.name : "";
    const add = (field, from, to, unit) => { if (from != null && to != null && from !== to) changes.unshift({ at: now, listing: label, field, from, to, unit, currency: L.currency, source: "hostex" }); };
    if (old) {
      add("Weekday rate", old.basePrice, L.basePrice, "money"); add("Weekend rate", old.weekendBasePrice, L.weekendBasePrice, "money"); add("Minimum stay", old.minNights, L.minNights, "nights");
      const moved = Object.keys(L._map).filter(d => old.prices?.[d] != null && L._map[d].p != null && old.prices[d] !== L._map[d].p);
      if (moved.length >= 3) {
        const a = Math.round(moved.reduce((s, d) => s + old.prices[d], 0) / moved.length), b = Math.round(moved.reduce((s, d) => s + L._map[d].p, 0) / moved.length);
        if (a !== b) changes.unshift({ at: now, listing: label, field: `Nightly rates, ${moved.length} nights ${moved.sort()[0]} → ${moved[moved.length - 1]}`, from: a, to: b, unit: "money", currency: L.currency, source: "hostex" });
      }
    }
    snap[L.id] = { basePrice: L.basePrice, weekendBasePrice: L.weekendBasePrice, minNights: L.minNights, prices: Object.fromEntries(Object.entries(L._map).map(([d, x]) => [d, x.p])) };
    delete L._map;
  }
  return { source: "hostex", syncedAt: Timestamp.now(), listings, days,
    next30Avg: priced.length ? Math.round(priced.reduce((s, x) => s + x.p, 0) / priced.length) : null,
    months: Object.values(by).map(e => ({ m: e.m, avg: e.n ? Math.round(e.sum / e.n) : null, booked: e.booked, open: e.open, blocked: e.blocked })),
    changes: changes.slice(0, 120), snapshot: snap };
}

/* ------------------------------------------------------------------ sync */
// one sync at a time (button double-clicks, two admins, or the button during the 05:30 run)
async function withLock(db, fn) {
  const ref = db.doc("system/syncLock"), me = Math.random().toString(36).slice(2);
  await db.runTransaction(async t => {
    const s = await t.get(ref), l = s.exists ? s.data() : null;
    if (l && l.owner && Date.now() - Number(l.at || 0) < 10 * 60e3) throw Object.assign(new Error("A sync is already running. Try again in a few minutes."), { code: "aborted" });
    t.set(ref, { owner: me, at: Date.now() });
  });
  try { return await fn(); }
  finally { await db.runTransaction(async t => { const s = await t.get(ref); if (s.exists && s.data().owner === me) t.set(ref, { owner: "", at: 0 }); }).catch(() => {}); }
}
async function runSync(args) { return withLock(args.db, () => runSyncInner(args)); }
async function runSyncInner({ db, token, by, aiKey }) {
  const started = Date.now(), api = hostexClient(token), errors = [], now = today(), cur = now.slice(0, 7);
  const props = await api.properties();
  await db.doc("system/guestyListings").set({ source: "hostex", at: Timestamp.now(), items: props.map(p => ({ id: String(p.id), name: p.title || `Property ${p.id}`, active: true })) });
  const ids = new Set(props.map(p => String(p.id))), byName = new Map();
  for (const p of props) { const k = norm(p.title); if (k) byName.set(k, byName.has(k) ? null : p); } // null = ambiguous name
  const clients = (await db.collection("clients").get()).docs;
  let relinked = 0, done = 0;
  // 1. clients still pointing at Guesty listings: match Hostex villas by exact name
  for (const c of clients) {
    const d = c.data();
    if (d.pms === "hostex") { c._d = d; continue; }
    const hits = [...new Set([...(d.listingNames || []), d.villaName, d.data?.villaName, ...(d.data?.properties || []).map(p => p.villaName)].map(norm).filter(Boolean).map(n => byName.get(n)).filter(Boolean))];
    if (hits.length) { const upd = { pms: "hostex", listingIds: hits.map(p => String(p.id)), listingNames: hits.map(p => p.title), listingsManual: false, guestyListingIds: d.listingIds || [] };
      await c.ref.update(upd); Object.assign(d, upd); relinked++; }
    c._d = d;
  }
  const targets = clients.map(c => [c, c._d]).filter(([, d]) => d.pms === "hostex" && (d.listingIds || []).some(id => ids.has(String(id))));
  const linkedProps = new Map(); for (const [c, d] of targets) for (const id of d.listingIds) if (!linkedProps.has(String(id))) linkedProps.set(String(id), { email: c.id, data: d });

  // 2. bookings (25 months back, 13 ahead), calendars and reviews for every villa
  const raw = await api.reservationsBetween(addDays(monthAdd(cur, -25) + "-01", -60), monthEnd(monthAdd(cur, 13)));
  const resT = liveTrimmed(raw);
  const cals = {};
  await pool(props, 3, async p => { try { cals[p.id] = await loadCalendar(api, p, now, addDays(now, 89)); } catch (e) { errors.push(`${p.title}: prices — ${e.message}`); } });
  let parsedReviews = [];
  try { parsedReviews = (await reviewsLib.fetchReviews(api, now)).map(reviewsLib.parse); } catch (e) { errors.push("Reviews: " + e.message); }

  // 3. owner figures for every linked client
  for (const [c, d] of targets) {
    try {
      const lid = d.listingIds.filter(id => ids.has(String(id))), nums = lid.map(Number);
      const sum = analytics(raw, props, lid, now);
      sum.pace = R.pace(resT, { today: now, pids: nums, currency: sum.currency, units: Math.max(1, lid.length) });
      const prevSum = await c.ref.collection("analytics").doc("summary").get();
      sum.reviews = reviewsLib.insights(parsedReviews, nums, now);
      try { const ai = await reviewsLib.aiSummary(aiKey, parsedReviews.filter(r => nums.includes(r.pid) && r.date >= addDays(now, -365)), d.villaName || d.data?.villaName || "", prevSum.exists ? prevSum.data().reviews?.ai : null); if (ai) sum.reviews.ai = ai; }
      catch (e) { errors.push(`${c.id}: review summary — ${e.message}`); }
      await c.ref.collection("analytics").doc("summary").set(sum);
      const prevSnap = await c.ref.collection("analytics").doc("pricing").get();
      const prev = prevSnap.exists && prevSnap.data().source === "hostex" ? prevSnap.data() : null; // don't diff against old Guesty data
      const pr = pricing(raw, props, lid, cals, prev, now);
      if (pr) await c.ref.collection("analytics").doc("pricing").set(pr);
      done++;
    } catch (e) { errors.push(`${c.id}: ${e.message}`); }
  }

  // 4. pricing & pace rows for the admin portfolio (every Hostex villa)
  let suggestions = 0;
  for (const p of props) {
    if (!cals[p.id]) continue;
    try {
      const rs = await db.doc("revenue/" + p.id).get();
      const rep = villaReport({ prop: p, res: resT.filter(r => r.p === Number(p.id)), cal: cals[p.id], revDoc: rs.exists ? rs.data() : null, client: linkedProps.get(String(p.id)) || null, today: now });
      const row = portfolioRow(rep); suggestions += row.open;
      await db.doc("revenue/" + p.id).set({ row, rowAt: Timestamp.now() }, { merge: true });
    } catch (e) { errors.push(`${p.title}: suggestions — ${e.message}`); }
  }

  // 5. automatic cleaning tasks and plan invoices that are due
  let tasks = { created: 0 }, inv = { invoices: [] };
  try { tasks = await ops.autoTasks({ api, db, now }); } catch (e) { errors.push("Cleaning tasks: " + e.message); }
  try { inv = await billing.dueInvoices({ db, now }); errors.push(...inv.errors.map(x => "Invoice " + x)); } catch (e) { errors.push("Invoices: " + e.message); }

  const summary = { at: Timestamp.now(), source: "hostex", listings: props.length, owners: targets.length, created: 0, relinked, analytics: done,
    reviews: parsedReviews.length, suggestions, tasksCreated: tasks.created || 0, invoices: inv.invoices.length, errors: errors.slice(0, 30), by, ms: Date.now() - started };
  await db.doc("system/guestySync").set(summary);
  return { ...summary, at: new Date().toISOString() };
}

module.exports = { analytics, pricing, runSync, hostexClient };
