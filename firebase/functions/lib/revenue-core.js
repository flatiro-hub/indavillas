// IndaVillas portal — revenue engine (same file as Villa Console public/app/revenue-core.js). Pure functions, no network.
// Plain script: registers globalThis.RevenueCore, so Node can require() it and the portal page can inline it.
// Dates are "YYYY-MM-DD" strings, months "YYYY-MM".
//
//  pace()        booked-now vs same-date-last-year per month, pickup, forecast, year totals
//  suggest()     price / stay-rule suggestions for the next 90 days
//  changesFor()  the exact Hostex price + restriction updates a suggestion makes, per channel listing

(function (G) {
"use strict";
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const monthAdd = (m, n) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
const dim = m => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
const dow = s => new Date(s + "T00:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
const sameDateLastYear = s => { const y = +s.slice(0, 4) - 1; const r = y + s.slice(4); return r.endsWith("-02-29") ? y + "-02-28" : r; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round1 = v => Math.round(v * 10) / 10;

const DEFAULTS = {
  floor: null, max: null, currency: "",   // owner's lowest / highest nightly rate, in `currency` (only applied to listings in that currency)
  gapMax: 3,                // open runs of up to N nights between bookings count as gaps
  gapDiscount: 10,          // % off gap nights
  lastMinuteDays: 10,       // open nights within N days count as last-minute
  lastMinuteDiscount: 10,   // % off last-minute nights
  paceBand: 15,             // ±% vs last year before a month counts as behind / ahead
  maxStep: 15,              // biggest single % change a suggestion proposes
  weekendPremium: 10,       // % Fri/Sat nights should sit above weekdays
  aheadLeadDays: 21,        // only raise prices for nights at least N days away
};

/* ------------------------------------------------------------------ pace + forecast */
// res: live reservations only, trimmed: { p: property id, ci, co, ba: booked-at date or "", rv: rental revenue for the stay or null, cur }
function pace(res, { today, pids, currency = "", units = 1, horizon = 12, band = 15 }) {
  const cur = today.slice(0, 7), cut = sameDateLastYear(today), pickFrom = addDays(today, -7);
  const B = {}, bucket = m => (B[m] ||= { all: { n: 0, r: 0 }, sameTime: { n: 0, r: 0 }, pick: { n: 0, r: 0 } });
  let lyStays = 0, lyNoDate = 0;
  for (const r of res) {
    if (pids && !pids.includes(Number(r.p))) continue;
    const N = daysBetween(r.ci, r.co); if (N <= 0) continue;
    const perNight = r.rv != null && (!currency || !r.cur || r.cur === currency) ? r.rv / N : 0;
    if (r.ci < cut && r.ci >= sameDateLastYear(cut)) { lyStays++; if (!r.ba) lyNoDate++; }
    for (let d = r.ci; d < r.co; d = addDays(d, 1)) {
      const b = bucket(d.slice(0, 7));
      b.all.n++; b.all.r += perNight;
      if (r.ba && r.ba <= cut) { b.sameTime.n++; b.sameTime.r += perNight; }
      if (r.ba && r.ba >= pickFrom) { b.pick.n++; b.pick.r += perNight; }
    }
  }
  const val = x => ({ nights: x.n, revenue: Math.round(x.r), adr: x.n ? Math.round(x.r / x.n) : 0 });
  const get = m => B[m] || { all: { n: 0, r: 0 }, sameTime: { n: 0, r: 0 }, pick: { n: 0, r: 0 } };
  // rate trend: last 6 complete months vs the same months a year earlier
  let nowR = 0, nowN = 0, thenR = 0, thenN = 0;
  for (let i = 1; i <= 6; i++) { const m = monthAdd(cur, -i), l = monthAdd(m, -12); nowR += get(m).all.r; nowN += get(m).all.n; thenR += get(l).all.r; thenN += get(l).all.n; }
  const adrTrend = nowN && thenN && thenR ? clamp((nowR / nowN) / (thenR / thenN), 0.8, 1.3) : 1;

  const months = [];
  for (let i = 0; i < horizon; i++) {
    const m = monthAdd(cur, i), ly = monthAdd(m, -12), available = dim(m) * units;
    const otb = get(m).all, stly = get(ly).sameTime, lyAll = get(ly).all, pick = get(m).pick;
    let status, pct = null;
    if (lyAll.n < 3) status = "new";
    else if (!stly.n && !otb.n) status = "early";
    else if (!stly.n) status = "ahead";
    else { pct = otb.n / stly.n - 1; status = pct <= -band / 100 ? "behind" : pct >= band / 100 ? "ahead" : "on"; }
    // forecast: last year's final nights scaled by this year's pace, never below what's booked
    let fN = otb.n;
    if (lyAll.n) fN = stly.n ? lyAll.n * clamp(otb.n / stly.n, 0.5, 1.6) : lyAll.n;
    fN = Math.round(clamp(Math.max(fN, otb.n), 0, available));
    const lyAdr = lyAll.n ? lyAll.r / lyAll.n : 0, otbAdr = otb.n ? otb.r / otb.n : 0;
    const fAdr = otb.n >= 3 ? otbAdr : lyAdr ? lyAdr * adrTrend : otbAdr;
    months.push({ m, available, otb: val(otb), stly: val(stly), ly: val(lyAll), pickup: val(pick), status, pacePct: pct == null ? null : round1(pct * 100),
      paceNights: otb.n - stly.n, occ: round1((otb.n / available) * 100), forecast: { nights: fN, revenue: Math.round(otb.r + (fN - otb.n) * fAdr), occ: round1((fN / available) * 100) } });
  }
  // calendar-year totals: actual months so far + forecast for the rest
  const y = today.slice(0, 4); let yr = 0, yn = 0, lyr = 0, lyn = 0, ytd = 0, ytdLy = 0;
  for (let k = 1; k <= 12; k++) {
    const m = `${y}-${String(k).padStart(2, "0")}`, l = monthAdd(m, -12);
    if (m < cur) { yr += get(m).all.r; yn += get(m).all.n; ytd += get(m).all.r; ytdLy += get(l).all.r; }
    else { const f = months.find(x => x.m === m); if (f) { yr += f.forecast.revenue; yn += f.forecast.nights; } }
    lyr += get(l).all.r; lyn += get(l).all.n;
  }
  const n12 = months.slice(0, 12), ly12 = n12.reduce((s, x) => s + x.ly.revenue, 0);
  return {
    today, currency, units, adrTrend: round1(adrTrend * 100) / 100, sameDateLastYear: cut,
    dataWarning: lyStays >= 5 && lyNoDate / lyStays > 0.3 ? "Many of last year's bookings have no booking date in Hostex, so the same-time-last-year numbers are understated." : "",
    months,
    year: { year: y, forecastRevenue: Math.round(yr), forecastNights: yn, lastYearRevenue: Math.round(lyr), lastYearNights: lyn, ytdRevenue: Math.round(ytd), ytdLastYear: Math.round(ytdLy) },
    next12: { forecastRevenue: n12.reduce((s, x) => s + x.forecast.revenue, 0), otbRevenue: n12.reduce((s, x) => s + x.otb.revenue, 0), lastYearRevenue: ly12,
      otbNights: n12.reduce((s, x) => s + x.otb.nights, 0), stlyNights: n12.reduce((s, x) => s + x.stly.nights, 0) },
  };
}

/* ------------------------------------------------------------------ suggestions */
// days: [{ d, s: "booked" | "blocked" | "open" }] from today, ~90 entries
// listings: [{ key, channel_type, listing_id, label, currency, cal: { "YYYY-MM-DD": { p: price, min: min stay on arrival } } }] — first one is the reference listing
function suggest({ days, listings, paceReport, cfg = {}, today, applied = {}, dismissed = {} }) {
  cfg = { ...DEFAULTS, ...cfg };
  const ref = listings[0]; if (!ref || !days.length) return [];
  const st = Object.fromEntries(days.map(x => [x.d, x.s])), price = d => ref.cal[d]?.p ?? null, minAt = d => ref.cal[d]?.min ?? null;
  const used = new Set(), out = [];
  const fmt = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const span = (a, b) => (a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`);
  const add = s => { s.id = `${s.type}:${s.dates[0]}:${s.dates[s.dates.length - 1]}:${s.dates.length}`; if (dismissed[s.id]) return; s.dates.forEach(d => used.add(d)); s.applied = applied[s.id] || null; out.push(s); };

  // 1. gaps: short open runs with a booking or block on both sides
  for (let i = 1; i < days.length; i++) {
    if (days[i].s !== "open" || days[i - 1].s === "open") continue;
    let j = i; while (j + 1 < days.length && days[j + 1].s === "open") j++;
    const len = j - i + 1;
    if (j + 1 < days.length && len <= cfg.gapMax) {
      const run = days.slice(i, j + 1).map(x => x.d), m0 = minAt(run[0]), unbookable = m0 != null && m0 > len;
      add({ type: "gap", tone: unbookable ? "bad" : "warn", pct: -cfg.gapDiscount, dates: run,
        minStay: run.map((d, k) => ({ d, min: len - k })).filter(x => (minAt(x.d) ?? 1) > x.min),
        title: `Fill the ${len}-night gap ${span(run[0], run[run.length - 1])}`,
        why: unbookable ? `Minimum stay is ${m0} nights, so ${len === 1 ? "this night" : `these ${len} nights`} can't be booked at all. Allow ${len}-night stays and take ${cfg.gapDiscount}% off.`
          : `A short gap between two bookings. Take ${cfg.gapDiscount}% off to make it worth booking.` });
    }
    i = j;
  }
  // 2. last-minute: open nights inside the window
  const lmEnd = addDays(today, cfg.lastMinuteDays - 1);
  const lm = days.filter(x => x.s === "open" && x.d <= lmEnd && !used.has(x.d) && price(x.d) != null).map(x => x.d);
  if (lm.length) add({ type: "lastminute", tone: "warn", pct: -cfg.lastMinuteDiscount, dates: lm,
    title: `${lm.length} open night${lm.length === 1 ? "" : "s"} in the next ${cfg.lastMinuteDays} days`,
    why: `Unsold nights this close to arrival usually need a lower price to fill. Take ${cfg.lastMinuteDiscount}% off ${lm.length === 1 ? "it" : "them"}.` });
  // 3. months behind / ahead of last year
  const pm = paceReport ? paceReport.months : [];
  for (const x of pm) {
    const open = days.filter(y => y.d.startsWith(x.m) && y.s === "open" && !used.has(y.d) && price(y.d) != null);
    if (x.status === "behind" && open.length >= 3) {
      const pct = -clamp(Math.round(Math.abs(x.pacePct) * 0.3), 5, cfg.maxStep);
      add({ type: "behind", tone: "bad", pct, dates: open.map(y => y.d), month: x.m,
        title: `${monthName(x.m)} is behind last year — lower open nights ${Math.abs(pct)}%`,
        why: `${x.otb.nights} nights booked vs ${x.stly.nights} at this point last year (${x.pacePct}%). ${open.length} open nights left to sell.` });
    }
    if (x.status === "ahead" && x.stly.nights) {
      const far = open.filter(y => daysBetween(today, y.d) >= cfg.aheadLeadDays);
      if (far.length >= 3) {
        const pct = clamp(Math.round(Math.abs(x.pacePct) * 0.3), 5, cfg.maxStep);
        add({ type: "ahead", tone: "ok", pct, dates: far.map(y => y.d), month: x.m,
          title: `${monthName(x.m)} is ahead of last year — raise open nights ${pct}%`,
          why: `${x.otb.nights} nights booked vs ${x.stly.nights} at this point last year (+${x.pacePct}%). Demand is strong; the ${far.length} remaining nights can sell for more.` });
      }
    }
  }
  // 4. weekend premium
  const win = days.filter(x => daysBetween(today, x.d) >= 14 && price(x.d) != null);
  const we = win.filter(x => [5, 6].includes(dow(x.d))), wd = win.filter(x => ![5, 6].includes(dow(x.d)));
  const avg = a => a.reduce((s, x) => s + price(x.d), 0) / (a.length || 1);
  const weOpen = we.filter(x => x.s === "open" && !used.has(x.d));
  if (we.length && wd.length && avg(we) < avg(wd) * 1.05 && weOpen.length >= 4)
    add({ type: "weekend", tone: "ok", pct: cfg.weekendPremium, dates: weOpen.map(x => x.d),
      title: `Add a ${cfg.weekendPremium}% weekend premium`,
      why: `Friday and Saturday nights are priced about the same as weekdays (avg ${Math.round(avg(we))} vs ${Math.round(avg(wd))}). Weekends usually sell first; ${weOpen.length} open weekend nights could carry a premium.` });

  for (const s of out) s.preview = summarize(changesFor(s, listings, cfg), listings);
  const order = { gap: 0, lastminute: 1, behind: 2, ahead: 3, weekend: 4 };
  return out.sort((a, b) => order[a.type] - order[b.type] || a.dates[0].localeCompare(b.dates[0]));
}
const monthName = m => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });

/* ------------------------------------------------------------------ changes */
function niceRound(v, cur) {
  if (cur === "IDR") return Math.round(v / (v >= 1e6 ? 10000 : 1000)) * (v >= 1e6 ? 10000 : 1000);
  if (["JPY", "KRW", "VND"].includes(cur)) return Math.round(v / 100) * 100;
  return v >= 100 ? Math.round(v / 5) * 5 : Math.round(v);
}
// s: { dates, pct?, setPrice?, minStay?: [{d, min}] }; returns per-listing updates in Hostex request shape
function changesFor(s, listings, cfg = {}, pctOverride) {
  cfg = { ...DEFAULTS, ...cfg };
  const pct = pctOverride ?? s.pct ?? 0;
  const refCur = listings[0]?.currency || "";
  return listings.map(L => {
    const bound = !cfg.currency || !L.currency || cfg.currency === L.currency;
    const setHere = s.setPrice != null && (!refCur || !L.currency || L.currency === refCur); // a fixed price only means something in the reference currency
    const rows = [], floorHits = [];
    for (const d of s.dates) {
      const old = L.cal[d]?.p;
      if (s.setPrice != null && !setHere) continue;
      if (old == null && !setHere) continue;
      let np = setHere ? Number(s.setPrice) : old * (1 + pct / 100);
      np = niceRound(np, L.currency);
      if (!(np > 0) || !isFinite(np)) continue; // never push a zero or broken price
      if (bound && cfg.floor && np < cfg.floor) { np = old != null && old < cfg.floor ? old : Number(cfg.floor); floorHits.push(d); }
      if (bound && cfg.max && np > cfg.max) np = old != null && old > cfg.max ? old : Number(cfg.max);
      if (np !== old) rows.push({ d, v: np, old });
    }
    const mins = (s.minStay || []).map(x => ({ d: x.d, v: x.min, old: L.cal[x.d]?.min ?? null })).filter(x => x.v !== x.old);
    return { key: L.key, channel_type: L.channel_type, listing_id: L.listing_id, label: L.label, currency: L.currency, floorHits: floorHits.length,
      prices: ranges(rows).map(r => ({ start_date: r.a, end_date: r.b, price: r.v })), restrictions: ranges(mins).map(r => ({ start_date: r.a, end_date: r.b, min_stay_on_arrival: r.v })),
      undo: { prices: ranges(rows.filter(x => x.old != null).map(x => ({ d: x.d, v: x.old }))).map(r => ({ start_date: r.a, end_date: r.b, price: r.v })),
        restrictions: ranges(mins.filter(x => x.old != null).map(x => ({ d: x.d, v: x.old }))).map(r => ({ start_date: r.a, end_date: r.b, min_stay_on_arrival: r.v })) },
      nights: rows.length, before: avgOf(rows.map(x => x.old)), after: avgOf(rows.map(x => x.v)) };
  }).filter(c => c.prices.length || c.restrictions.length);
}
const avgOf = a => { const b = a.filter(x => x != null); return b.length ? Math.round(b.reduce((s, x) => s + x, 0) / b.length) : null; };
// consecutive dates with the same value → [{a, b, v}]
function ranges(rows) {
  const out = []; const sorted = [...rows].sort((x, y) => x.d.localeCompare(y.d));
  for (const r of sorted) { const last = out[out.length - 1]; if (last && last.v === r.v && addDays(last.b, 1) === r.d) last.b = r.d; else out.push({ a: r.d, b: r.d, v: r.v }); }
  return out;
}
function summarize(changes) {
  return { listings: changes.map(c => ({ label: c.label, currency: c.currency, nights: c.nights, before: c.before, after: c.after, floorHits: c.floorHits, minStayRanges: c.restrictions.length })),
    nights: Math.max(0, ...changes.map(c => c.nights)) };
}
// custom adjustment → a suggestion-shaped object
const parseNum = v => (v == null || v === "" ? null : Number(String(v).replace(/[%\s,]/g, "")));
function customChange({ start, end, days: which = "all", pct = null, price = null, minStay = null }, statusDays, { includeBooked = false } = {}) {
  pct = parseNum(pct); price = parseNum(price); minStay = parseNum(minStay);
  if (pct != null) pct = isFinite(pct) ? clamp(pct, -50, 50) : null;
  if (price != null && !(price > 0 && isFinite(price))) price = null;
  if (minStay != null && !(Number.isInteger(minStay) && minStay >= 1 && minStay <= 60)) minStay = null;
  const st = Object.fromEntries((statusDays || []).map(x => [x.d, x.s])), dates = [];
  for (let d = start; d <= end && dates.length < 400; d = addDays(d, 1)) {
    const w = dow(d); if (which === "weekends" && ![5, 6].includes(w)) continue; if (which === "weekdays" && [5, 6].includes(w)) continue;
    if (!includeBooked && st[d] && st[d] !== "open") continue; dates.push(d);
  }
  return { type: "custom", dates, pct, setPrice: price,
    minStay: minStay ? dates.map(d => ({ d, min: Number(minStay) })) : [], id: `custom:${start}:${end}:${which}:${pct ?? ""}:${price ?? ""}:${minStay ?? ""}` };
}

G.RevenueCore = { addDays, daysBetween, monthAdd, dim, dow, DEFAULTS, pace, suggest, niceRound, changesFor, ranges, summarize, customChange, parseNum };
})(typeof globalThis !== "undefined" ? globalThis : window);
