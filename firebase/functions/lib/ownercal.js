/* Availability calendar on the Performance page. Every Hostex villa linked to a client (clients/{email}.listingIds),
 * one row per villa: booked, booking requests, blocked and open nights with the nightly price and minimum stay.
 * Owners and admins block and open nights (one villa or all of them at once); admins also change prices and minimum
 * stay. Owners only ever reach their own villas: portalApi sets b.email to the signed-in owner. Every change is logged
 * on the client record (calLog, last 50) so the team sees what owners blocked and why. */
const { addDays, daysBetween, firstName, pool, clip } = require("./util");
const { LIVE } = require("./hostex");
const revenue = require("./revenue");

const fail = (code, msg) => Object.assign(new Error(msg), { code });
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ON_CAL = [...LIVE, "wait_accept"];
const WINDOW = 42; // six weeks per page

async function linked(db, email) {
  const s = await db.doc("clients/" + email).get();
  if (!s.exists) throw fail("not-found", "Client not found.");
  const c = s.data();
  return { ref: s.ref, c, ids: c.pms === "hostex" ? (c.listingIds || []).map(String) : [] };
}
const logOf = c => (Array.isArray(c.calLog) ? c.calLog : []).slice(-20).reverse();

async function overview({ api, db, b, now, isAdmin }) {
  const { c, ids } = await linked(db, b.email);
  const start = ISO.test(b.start || "") && b.start >= addDays(now, -62) && b.start <= addDays(now, 700) ? b.start : now, end = addDays(start, WINDOW - 1);
  const base = { start, end, today: now, priceUntil: addDays(now, 89), canPrice: !!isAdmin, log: logOf(c) };
  if (!ids.length) return { ...base, villas: [] };
  const props = (await api.properties()).filter(p => ids.includes(String(p.id)));
  const owners = isAdmin ? await revenue.clientsByProperty(db) : null;
  const villas = await pool(props, 2, async prop => {
    const [cal, raw] = await Promise.all([revenue.loadCalendar(api, prop, start, end), api.reservationsBetween(addDays(start, -90), end, { propertyId: prop.id })]);
    const stays = raw.filter(r => Number(r.property_id) === Number(prop.id) && ON_CAL.includes(r.status) && r.check_out_date > start && r.check_in_date <= end);
    const L = cal.listings[0], days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const r = stays.find(x => x.check_in_date <= d && x.check_out_date > d);
      days.push({ d, s: r ? (r.status === "wait_accept" ? "request" : "booked") : cal.avail[d] === false ? "blocked" : "open",
        p: L?.cal[d]?.p ?? null, min: L?.cal[d]?.min ?? null, g: r ? firstName(r.guest_name) || "Guest" : "", first: !!r && (r.check_in_date === d || d === start) });
    }
    const st = isAdmin ? revenue.cfgFor(null, owners.get(String(prop.id))?.data, prop.title) : null;
    return { pid: Number(prop.id), title: prop.title, currency: L?.currency || "", channels: cal.listings.map(x => x.label), days,
      floor: st?.cfg.floor ?? null, floorCurrency: st?.cfg.currency || "", pricingTool: st?.pricingTool || "" };
  });
  villas.sort((x, y) => ids.indexOf(String(x.pid)) - ids.indexOf(String(y.pid)));
  return { ...base, villas };
}

function checkDates(b, now) {
  if (!ISO.test(b.start || "") || !ISO.test(b.end || "")) throw fail("invalid-argument", "Choose the dates.");
  if (b.end < b.start) throw fail("invalid-argument", "The end date is before the start date.");
  if (b.start < now) throw fail("invalid-argument", "Pick dates from today onwards.");
  if (daysBetween(b.start, b.end) > 365) throw fail("invalid-argument", "That's more than 365 nights. Use a shorter range.");
  if (b.end > addDays(now, 730)) throw fail("invalid-argument", "The calendar goes up to two years ahead.");
}
async function addLog(ref, c, entry) {
  const all = (Array.isArray(c.calLog) ? c.calLog : []).concat([{ at: new Date().toISOString(), ...entry }]).slice(-50);
  await ref.update({ calLog: all });
}
const pidsOf = (b, ids) => [...new Set((Array.isArray(b.pids) ? b.pids : [b.pid]).map(String))].filter(x => ids.includes(x));

async function setDates({ api, db, b, now, me, isAdmin }) {
  const { ref, c, ids } = await linked(db, b.email);
  const pids = pidsOf(b, ids);
  if (!pids.length) throw fail("permission-denied", "Choose one of your villas.");
  checkDates(b, now);
  const open = !!b.available, props = (await api.properties()).filter(p => pids.includes(String(p.id)));
  if (open) { // opening nights that a booking sits on would let a channel sell them twice
    for (const prop of props) {
      const raw = await api.reservationsBetween(addDays(b.start, -90), b.end, { propertyId: prop.id });
      const hit = raw.find(r => Number(r.property_id) === Number(prop.id) && ON_CAL.includes(r.status) && r.check_in_date <= b.end && r.check_out_date > b.start);
      if (hit) throw fail("failed-precondition", `${prop.title}: a guest is booked ${hit.check_in_date} → ${hit.check_out_date}. Open only nights without a booking.`);
    }
  }
  await api.hx("POST", "/availabilities", { body: { property_ids: props.map(p => Number(p.id)), available: open, start_date: b.start, end_date: b.end } });
  const n = daysBetween(b.start, b.end) + 1;
  await addLog(ref, c, { by: isAdmin && me !== b.email ? "IndaVillas" : "Owner", email: me, action: open ? "Opened" : "Blocked", villas: props.map(p => p.title), start: b.start, end: b.end, nights: n, note: clip(String(b.note || ""), 160) });
  return { ok: true, nights: n, villas: props.length };
}

// admins only (portalApi): prices and minimum stay through the same engine as Pricing & pace, so they're logged and can be undone there
async function setPrice({ api, db, b, now, me }) {
  const { ref, c, ids } = await linked(db, b.email);
  const pid = pidsOf(b, ids)[0];
  if (!pid) throw fail("permission-denied", "Choose one of the client's villas.");
  checkDates(b, now);
  const custom = { start: b.start, end: b.end, days: ["all", "weekends", "weekdays"].includes(b.days) ? b.days : "all", pct: b.pct ?? "", price: b.price ?? "", minStay: b.minStay ?? "" };
  const r = await revenue.apply({ api, db, me, pid: Number(pid), body: { custom }, today: now });
  const title = ((await api.properties()).find(p => String(p.id) === pid) || {}).title || "";
  await addLog(ref, c, { by: "IndaVillas", email: me, action: "Changed prices", villas: [title], start: b.start, end: b.end, nights: daysBetween(b.start, b.end) + 1, note: clip(r.applied?.summary || "", 160) });
  return r;
}

module.exports = { overview, setDates, setPrice, WINDOW };
