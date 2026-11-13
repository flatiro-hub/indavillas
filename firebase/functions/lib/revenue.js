/* Pricing & pace: booking pace vs last year, forecast, price suggestions, one-click apply to Hostex with undo.
 * The maths is lib/revenue-core.js (the same engine the portal page uses for live previews).
 * Firestore (Admin SDK only): revenue/{propertyId} { cfg, applied{}, dismissed{}, row, rowAt } */
require("./revenue-core");
const R = globalThis.RevenueCore;
const { Timestamp } = require("firebase-admin/firestore");
const { addDays, daysBetween, monthAdd, num, pool } = require("./util");
const { chLabel, liveTrimmed } = require("./hostex");

/* ------------------------------------------------------------------ data */
async function loadCalendar(api, prop, start, end) {
  // Trip.com/Ctrip calendars report the net (floor) price but updates set the selling price, so they're left out
  const chans = (prop.channels || []).filter(c => c.channel_type !== "hostex_direct" && c.listing_id && !/ctrip|trip/i.test(c.channel_type))
    .sort((a, b) => (a.channel_type === "airbnb" ? -1 : b.channel_type === "airbnb" ? 1 : 0));
  const [cal, avail] = await Promise.all([
    chans.length ? api.hx("POST", "/listings/calendar", { body: { start_date: start, end_date: end, listings: chans.map(c => ({ channel_type: c.channel_type, listing_id: String(c.listing_id) })) } }).catch(() => null) : null,
    api.hx("GET", "/availabilities", { query: { property_ids: String(prop.id), start_date: start, end_date: end } }).catch(() => null),
  ]);
  const got = api.firstArray(cal);
  const listings = chans.map(c => {
    const L = got.find(x => String(x.listing_id) === String(c.listing_id) && (!x.channel_type || x.channel_type === c.channel_type)) || {};
    const map = {};
    for (const d of L.calendar || L.calendars || L.dates || api.firstArray(L)) {
      if (!d || !d.date) continue; const r = d.restrictions || {};
      map[d.date] = { p: d.price != null ? Number(d.price) : null, min: d.min_stay_on_arrival ?? r.min_stay_on_arrival ?? d.min_stay ?? r.min_stay ?? null };
    }
    return { key: c.channel_type + ":" + c.listing_id, channel_type: c.channel_type, listing_id: String(c.listing_id), label: chLabel(c.channel_type), currency: c.currency || L.currency || "", cal: map };
  }).filter(L => Object.keys(L.cal).length);
  const av = {};
  for (const x of api.firstArray(avail)) for (const d of x.availabilities || x.dates || api.firstArray(x)) if (d && d.date) av[d.date] = d.available !== false;
  return { at: Date.now(), start, listings, avail: av };
}

const dominantCurrency = (res, pids) => { const c = {}; for (const r of res) if (pids.includes(r.p) && r.cur) c[r.cur] = (c[r.cur] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || ""; };

// the owner's onboarding answers for one villa: answers are per property (data.properties[]); take the one whose name
// matches the Hostex villa, else the first. Older records keep the answers directly in data.
const normName = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
function onbFor(clientDoc, title) {
  const data = clientDoc?.data || {}, ps = Array.isArray(data.properties) ? data.properties : [];
  if (!ps.length) return data;
  return ps.find(p => normName(p.villaName) && normName(p.villaName) === normName(title)) || ps[0];
}
// villa settings = stored overrides on top of the owner's onboarding answers (lowest / highest rate, currency)
function cfgFor(revDoc, clientData, title) {
  const onb = onbFor(clientData, title);
  const fromOnboarding = { floor: num(onb.floor), max: num(onb.maxPrice), currency: /^[A-Z]{3}$/.test(onb.currency || "") ? onb.currency : "" };
  const cfg = { ...R.DEFAULTS, ...Object.fromEntries(Object.entries(fromOnboarding).filter(([, v]) => v != null && v !== "")), ...(revDoc?.cfg || {}) };
  return { cfg, fromOnboarding, pricingTool: onb.pricingTool && onb.pricingTool !== "None" ? onb.pricingTool : "" };
}
// an applied suggestion stays "applied" until its last night has passed (ids are type:start:end:…), so it can't be stacked twice
const idEnd = id => { const m = String(id).match(/^[a-z]+:\d{4}-\d{2}-\d{2}:(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; };
const idSpan = id => { const m = String(id).match(/^[a-z]+:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})/); return m ? [m[1], m[2]] : null; };
const activeApplied = (obj, today) => Object.fromEntries(Object.entries(obj || {}).filter(([id, v]) => v && !v.undoneAt && (idEnd(id) ? idEnd(id) >= today : Date.now() - Date.parse(v.at) < 7 * 864e5)));
const recent = (obj, days) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v && Date.now() - Date.parse(typeof v === "string" ? v : v.at) < days * 864e5 && !(typeof v === "object" && v.undoneAt)));

/* ------------------------------------------------------------------ report (pure) */
function villaReport({ prop, res, cal, revDoc, client, today }) {
  const id = Number(prop.id);
  const st = cfgFor(revDoc, client?.data, prop.title);
  const currency = dominantCurrency(res, [id]) || cal.listings[0]?.currency || "";
  const paceReport = R.pace(res, { today, pids: [id], currency, units: 1, band: st.cfg.paceBand || 15 });
  const days = [];
  for (let i = 0; i < 90; i++) {
    const d = addDays(today, i), booked = res.some(r => r.p === id && r.ci <= d && r.co > d);
    days.push({ d, s: booked ? "booked" : cal.avail[d] === false ? "blocked" : "open", p: cal.listings[0]?.cal[d]?.p ?? null, min: cal.listings[0]?.cal[d]?.min ?? null });
  }
  const cfg = { ...st.cfg, currency: st.cfg.currency || cal.listings[0]?.currency || currency };
  const appliedAll = revDoc?.applied || {};
  const suggestions = R.suggest({ days, listings: cal.listings, paceReport, cfg, today, applied: activeApplied(appliedAll, today), dismissed: recent(revDoc?.dismissed, 14) });
  const history = Object.values(appliedAll).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20).map(({ undo, ...x }) => ({ ...x, canUndo: !x.undoneAt && !!undo?.length }));
  const occ = n => Math.round((days.slice(0, n).filter(x => x.s === "booked").length / n) * 1000) / 10;
  return { property: { id, title: prop.title }, client: client ? { email: client.email, villaName: onbFor(client.data, prop.title).villaName || client.data?.villaName || "", owner: client.data?.ownerName || client.data?.data?.ownerName || client.data?.name || "" } : null,
    currency, today, pace: paceReport, days, listings: cal.listings, calAt: cal.at, suggestions, cfg, fromOnboarding: st.fromOnboarding, pricingTool: st.pricingTool,
    history, occ30: occ(30), occ90: occ(90) };
}
function portfolioRow(r) {
  const m3 = r.pace.months.slice(0, 3), otb = m3.reduce((s, x) => s + x.otb.nights, 0), stly = m3.reduce((s, x) => s + x.stly.nights, 0);
  const open = r.suggestions.filter(s => !s.applied);
  return { id: r.property.id, title: r.property.title, client: r.client, currency: r.currency, occ30: r.occ30, occ90: r.occ90, otb3: otb, stly3: stly,
    pace3: stly ? Math.round((otb / stly - 1) * 1000) / 10 : null, forecastYear: r.pace.year.forecastRevenue, lastYear: r.pace.year.lastYearRevenue,
    open: open.length, gaps: open.filter(s => s.type === "gap").length, top: open[0]?.title || "", pricingTool: r.pricingTool, channels: r.listings.length };
}

/* ------------------------------------------------------------------ live loading */
async function clientsByProperty(db) {
  const map = new Map();
  for (const c of (await db.collection("clients").get()).docs) {
    const d = c.data(); if (d.pms !== "hostex") continue;
    for (const id of d.listingIds || []) if (!map.has(String(id))) map.set(String(id), { email: c.id, data: d });
  }
  return map;
}
async function liveVilla({ api, db, pid, today }) {
  const prop = (await api.properties()).find(p => Number(p.id) === Number(pid));
  if (!prop) { const e = new Error("Villa not found in Hostex."); e.code = "not-found"; throw e; }
  const cur = today.slice(0, 7);
  const [raw, cal, revSnap, owners] = await Promise.all([
    api.reservationsBetween(addDays(monthAdd(cur, -25) + "-01", -60), monthAdd(cur, 13) + "-01", { propertyId: prop.id }),
    loadCalendar(api, prop, today, addDays(today, 89)), db.doc("revenue/" + prop.id).get(), clientsByProperty(db)]);
  const res = liveTrimmed(raw).filter(r => r.p === Number(prop.id));
  const rep = villaReport({ prop, res, cal, revDoc: revSnap.exists ? revSnap.data() : null, client: owners.get(String(prop.id)) || null, today });
  await db.doc("revenue/" + prop.id).set({ row: portfolioRow(rep), rowAt: Timestamp.now() }, { merge: true });
  return rep;
}
// whole portfolio from the cached rows written by the daily sync (or recomputed live with fresh=true)
async function portfolio({ api, db, today, fresh }) {
  const props = await api.properties();
  if (fresh) await pool(props, 3, p => liveVilla({ api, db, pid: p.id, today }).catch(() => null));
  const rows = [];
  for (const p of props) {
    const s = await db.doc("revenue/" + p.id).get(), x = s.exists ? s.data() : null;
    rows.push(x?.row ? { ...x.row, title: p.title, rowAt: x.rowAt?.toDate ? x.rowAt.toDate().toISOString() : null } : { id: Number(p.id), title: p.title, pending: true });
  }
  return { villas: rows, today };
}

/* ------------------------------------------------------------------ apply / undo */
const sign = p => (p > 0 ? "Raised" : "Lowered");
function describe(s, changes, pct) {
  const n = Math.max(0, ...changes.map(c => c.nights)), chans = [...new Set(changes.map(c => c.label))].join(", ");
  const d0 = s.dates[0], d1 = s.dates[s.dates.length - 1], span = d0 === d1 ? d0 : `${d0} → ${d1}`, parts = [];
  if (s.setPrice != null && n) parts.push(`Set price to ${s.setPrice} on ${n} night${n === 1 ? "" : "s"}`);
  else if (pct && n) parts.push(`${sign(pct)} prices ${Math.abs(pct)}% on ${n} night${n === 1 ? "" : "s"}`);
  if (changes.some(c => c.restrictions.length)) parts.push(s.type === "gap" ? "allowed shorter stays" : `min stay ${s.minStay?.[0]?.min} nights`);
  const fl = changes.filter(c => c.floorHits), fh = fl.length ? Math.max(...fl.map(c => c.floorHits)) : 0;
  return `${parts.join(", ") || "Updated"} (${span}) on ${chans}${fl.length ? ` — ${fl.map(c => c.label).join(", ")} held at the owner's lowest rate on ${fh} night${fh === 1 ? "" : "s"}` : ""}`;
}
async function push(api, changes, which) {
  const results = [];
  for (const c of changes) for (const [path, key] of [["/listings/prices", "prices"], ["/listings/restrictions", "restrictions"]]) {
    const rows = which ? c[which][key] : c[key]; if (!rows?.length) continue;
    for (let i = 0; i < rows.length; i += 60) {
      try { await api.hx("POST", path, { body: { channel_type: c.channel_type, listing_id: String(c.listing_id), [key]: rows.slice(i, i + 60) } }); results.push({ label: c.label, what: key, ok: true }); }
      catch (e) { results.push({ label: c.label, what: key, ok: false, error: e.message || "Hostex error" }); }
    }
  }
  return results;
}
// owner's Strategy change log gets the entry now; the next sync won't log the same move twice
async function logForOwner(db, rep, entry, refChange) {
  if (!rep.client) return;
  const ref = db.doc(`clients/${rep.client.email}/analytics/pricing`), s = await ref.get(); if (!s.exists) return;
  const pr = s.data(), snap = pr.snapshot || {}, pid = String(rep.property.id);
  if (refChange && snap[pid]?.prices) for (const q of refChange.prices) for (let d = q.start_date; d <= q.end_date; d = addDays(d, 1)) if (d in snap[pid].prices) snap[pid].prices[d] = q.price;
  await ref.set({ changes: [entry, ...(pr.changes || [])].slice(0, 120), snapshot: snap }, { merge: true });
}
const fail = (code, msg) => { const e = new Error(msg); e.code = code; return e; };

async function apply({ api, db, me, pid, body, today }) {
  const rep = await liveVilla({ api, db, pid, today });
  let s;
  if (body.custom) {
    const c = { ...body.custom }, pn = R.parseNum, raw = [pn(c.pct), pn(c.price), pn(c.minStay)];
    if (raw.some(x => x != null && !isFinite(x))) throw fail("invalid-argument", "Use plain numbers, e.g. -10 for 10% less.");
    if (raw[1] != null && raw[1] <= 0) throw fail("invalid-argument", "The price has to be more than 0.");
    if (raw[2] != null && !(Number.isInteger(raw[2]) && raw[2] >= 1 && raw[2] <= 60)) throw fail("invalid-argument", "Minimum stay is a whole number of nights, 1–60.");
    if (raw.every(x => x == null)) throw fail("invalid-argument", "Enter a % change, a price or a minimum stay.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(c.end || "") || c.end < c.start) throw fail("invalid-argument", "Choose a start and end date.");
    if (c.start < rep.today) throw fail("invalid-argument", "Pick dates from today onwards.");
    if (daysBetween(rep.today, c.end) > 89) throw fail("invalid-argument", "Custom changes work up to 90 days ahead.");
    s = R.customChange(c, rep.days, { includeBooked: !!c.includeBooked }); s.title = "Custom change";
    s.id += ":" + Date.now().toString(36); // a repeated custom change gets its own record, so earlier undo snapshots survive
    if (!s.dates.length) throw fail("invalid-argument", "No open nights in that range.");
  } else {
    s = rep.suggestions.find(x => x.id === body.id);
    if (!s) throw fail("aborted", "That suggestion has changed since you loaded the page. Refresh and try again.");
    if (s.applied) throw fail("already-exists", "Already applied. Undo it first if you want to change it.");
  }
  const pct = body.pct != null && body.pct !== "" ? Math.max(-50, Math.min(50, Number(body.pct))) : s.pct;
  const changes = R.changesFor(s, rep.listings, rep.cfg, pct);
  if (!changes.length) throw fail("failed-precondition", "Nothing to change — prices are already at these levels or at the owner's lowest rate.");
  const results = await push(api, changes);
  if (!results.some(r => r.ok)) throw fail("unavailable", "Hostex refused the change: " + (results[0]?.error || "unknown error"));
  const summary = describe(s, changes, pct), at = new Date().toISOString();
  const record = { id: s.id, type: s.type, title: s.title, summary, pct, nights: Math.max(0, ...changes.map(c => c.nights)), at, by: me,
    undo: changes.map(c => ({ channel_type: c.channel_type, listing_id: c.listing_id, label: c.label, undo: c.undo })), failed: results.filter(r => !r.ok).length };
  const ref = db.doc("revenue/" + pid);
  await db.runTransaction(async tx => { // two people applying at once both keep their record
    const cur = (await tx.get(ref)).data() || {}, all = { ...(cur.applied || {}), [s.id]: record };
    const keep = Object.fromEntries(Object.entries(all).sort((a, b) => String(b[1].at).localeCompare(String(a[1].at))).slice(0, 60));
    tx.set(ref, { ...cur, applied: keep }); // full write: merge would keep trimmed entries
  });
  const refL = changes.find(c => c.key === rep.listings[0]?.key);
  const avg = refL && refL.before != null && refL.after != null ? { from: refL.before, to: refL.after, unit: "money", currency: refL.currency } : {};
  await logForOwner(db, rep, { at: today, listing: "", field: s.type === "custom" ? "Price change by IndaVillas" : s.title, detail: summary, ...avg, source: "indavillas" }, refL);
  return { results, applied: { ...record, undo: undefined } };
}
async function undo({ api, db, me, pid, id, today }) {
  const ref = db.doc("revenue/" + pid), cur = (await ref.get()).data() || {}, rec = cur.applied?.[id];
  if (!rec || rec.undoneAt) throw fail("not-found", "Nothing to undo.");
  const sp = idSpan(id), newer = Object.values(cur.applied || {}).find(x => x.id !== id && !x.undoneAt && String(x.at) > String(rec.at) && (() => { const o = idSpan(x.id); return sp && o && o[0] <= sp[1] && o[1] >= sp[0]; })());
  if (newer) throw fail("failed-precondition", `A newer change covers some of the same nights (${newer.summary}). Undo that one first.`);
  const results = await push(api, rec.undo, "undo");
  if (!results.some(r => r.ok)) throw fail("unavailable", "Hostex refused the undo: " + (results[0]?.error || "unknown error"));
  const undoneAt = new Date().toISOString();
  await db.runTransaction(async tx => { const now_ = (await tx.get(ref)).data() || {}, r = now_.applied?.[id]; if (r) tx.set(ref, { ...now_, applied: { ...now_.applied, [id]: { ...r, undoneAt, undoneBy: me } } }); });
  const rep = await liveVilla({ api, db, pid, today }).catch(() => null);
  if (rep) await logForOwner(db, rep, { at: today, listing: "", field: "Price change undone", detail: rec.summary, source: "indavillas" }, null);
  return { results, undone: id };
}
async function dismiss({ db, pid, id, restore }) {
  const ref = db.doc("revenue/" + pid), cur = (await ref.get()).data() || {}, all = { ...(cur.dismissed || {}) };
  if (restore) delete all[id]; else all[String(id).slice(0, 120)] = new Date().toISOString();
  await ref.set({ ...cur, dismissed: all }); // full write so a restored suggestion really disappears from the map
  return { ok: true };
}
function cleanCfg(b) {
  const out = {}, n = (k, a, z) => { if (b[k] === "" || b[k] === null) out[k] = null; else if (b[k] !== undefined && !isNaN(Number(b[k]))) out[k] = Math.max(a, Math.min(z, Number(b[k]))); };
  n("floor", 0, 1e10); n("max", 0, 1e10); n("gapMax", 1, 7); n("gapDiscount", 0, 50); n("lastMinuteDays", 1, 30); n("lastMinuteDiscount", 0, 50);
  n("paceBand", 5, 50); n("maxStep", 1, 40); n("weekendPremium", 0, 50); n("aheadLeadDays", 0, 120);
  if (typeof b.currency === "string") out.currency = b.currency.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  return out;
}
async function saveSettings({ db, pid, body }) {
  const ref = db.doc("revenue/" + pid), cur = (await ref.get()).data() || {};
  const next = { ...(cur.cfg || {}), ...cleanCfg(body || {}) };
  for (const k of Object.keys(next)) if (next[k] == null || next[k] === "") delete next[k]; // cleared → back to onboarding answer / default
  await ref.set({ ...cur, cfg: next });
  return next;
}

module.exports = { R, loadCalendar, villaReport, portfolioRow, liveVilla, portfolio, apply, undo, dismiss, saveSettings, cfgFor, dominantCurrency, clientsByProperty, onbFor };
