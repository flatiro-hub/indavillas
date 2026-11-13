/* Villa managers: each manager signs in to the portal with their own email and runs the day-to-day of the villas
 * IndaVillas assigned to them — calendar, prices, bookings, guest messages and tasks — without a Hostex login. Reviews stay with admins.
 *
 *   managers/{email}  { name, phone, propertyIds: [Hostex property ids], perms: { calendar, prices, bookings, money, messages, tasks },
 *                       active, invitedAt, authUid, authSince, createdAt, updatedAt, by }   written only by these functions (admin Managers page)
 *   mgrlog/{email}    { entries: [{ at, action, pid, villa, detail }] }      the last 150 things each manager did, shown to admins
 *
 * Every manager action checks on the server that the login is switched on, that it has the permission,
 * and that the villa, booking, conversation or task belongs to one of the manager's villas.
 *
 * Logins: "Send login" (invited) creates the Firebase account on the server, or gives an existing one a new random password
 * and signs it out everywhere, then records its uid and the time. Manager actions only run for that uid and for sessions
 * that started after it, so nobody can pre-register a manager's email and walk in: the real manager sets their password
 * from the reset email the page sends straight after. */
const crypto = require("crypto");
const { Timestamp } = require("firebase-admin/firestore");
const { addDays, daysBetween, firstName, pool, clip } = require("./util");
const { chLabel, LIVE } = require("./hostex");
const { aiOn } = require("./ai");
const inbox = require("./inbox");
const revenue = require("./revenue");

const fail = (code, msg) => Object.assign(new Error(msg), { code });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const lc = s => String(s || "").trim().toLowerCase();
const str = (v, n) => String(v ?? "").trim().slice(0, n);

// what a manager can do; each can be switched off per manager on the admin page
const PERMS = {
  calendar: "Calendar: see it, block and open dates",
  prices: "Prices and minimum stay",
  bookings: "Bookings: create, edit, cancel direct bookings, approve requests, check-in details",
  money: "See booking amounts and payments",
  messages: "Guest messages",
  tasks: "Tasks: cleaning, maintenance, assign staff",
};
const PERM_NAMES = { calendar: "the calendar", prices: "prices", bookings: "bookings", money: "booking amounts", messages: "guest messages", tasks: "tasks" };
const allPerms = v => Object.fromEntries(Object.keys(PERMS).map(k => [k, v]));
const permsOf = mg => Object.fromEntries(Object.keys(PERMS).map(k => [k, mg?.perms?.[k] !== false]));
const TASK_TYPES = ["cleaning", "maintenance", "reception", "room_service", "other"];
const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"];
const STAY_STATUSES = ["checkin_pending", "in_house", "stay_completed"];
const DIRECT = ["hostex_direct"]; // bookings made outside the OTAs: the only ones Hostex lets us cancel or re-date
const ON_CAL = [...LIVE, "wait_accept"];
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const hm = t => (t && t.hour != null ? `${String(t.hour).padStart(2, "0")}:${String(t.minute || 0).padStart(2, "0")}` : "");
const toHM = s => { const m = String(s || "").trim().match(TIME); return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null; };
const amount = v => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/[\s,]/g, "")); return isFinite(n) ? n : NaN; };

// the signed-in account has to be the one activated by the last "Send login", with a session that started after it
function checkLogin(mg, uid, token) {
  if (!mg.authUid || !mg.authSince) throw fail("permission-denied", "Your manager login isn't activated yet. Ask IndaVillas to press Send login, then set your password from the email.");
  if (uid !== mg.authUid || Number(token?.auth_time || 0) < Math.floor(Number(mg.authSince) / 1000))
    throw fail("unauthenticated", "Your login was renewed. Sign out, then sign in with the password you set from the latest IndaVillas email.");
}
async function getManager(db, email) {
  if (!email) return null;
  const s = await db.doc("managers/" + lc(email)).get();
  return s.exists ? { email: s.id, ...s.data() } : null;
}

/* ------------------------------------------------------------------ scope checks */
function requireActive(mg) {
  if (!mg || mg.active === false) throw fail("permission-denied", "Your manager login is switched off. Ask IndaVillas.");
}
function need(mg, perm) {
  requireActive(mg);
  if (!permsOf(mg)[perm]) throw fail("permission-denied", `Your login doesn't include ${PERM_NAMES[perm] || perm}. Ask IndaVillas.`);
}
const myPids = mg => (mg.propertyIds || []).map(Number).filter(Boolean);
const mine = (mg, pid) => myPids(mg).includes(Number(pid));
async function villa(api, mg, pid) {
  if (!mine(mg, pid)) throw fail("permission-denied", "That villa isn't one of yours.");
  const p = (await api.properties()).find(x => Number(x.id) === Number(pid));
  if (!p) throw fail("not-found", "That villa isn't in Hostex any more. Ask IndaVillas.");
  return p;
}
async function ownBooking(api, mg, code) {
  code = str(code, 80); if (!code) throw fail("invalid-argument", "Which booking?");
  const rows = api.firstArray(await api.hx("GET", "/reservations", { query: { reservation_code: code, offset: 0, limit: 100 } })).filter(x => x.reservation_code === code || x.stay_code === code);
  if (!rows.length) throw fail("not-found", "Booking not found in Hostex.");
  // a reservation can hold stays at several villas; approve, decline and cancel act on all of them
  if (rows.some(x => !mine(mg, x.property_id))) throw fail("permission-denied", "That booking isn't at one of your villas.");
  return rows.find(x => x.stay_code === code) || rows[0];
}
// every villa a guest conversation touches; null if any part of it can't be placed (then nobody but admins opens it)
async function threadPids(api, props, t, id) {
  const acts = t.activities || [], out = new Set();
  if (!acts.length) return null;
  for (const a of acts) {
    let pid = null;
    const pp = a.property && (a.property.id || a.property.property_id);
    if (pp && props.some(p => String(p.id) === String(pp))) pid = Number(pp);
    else if (a.listing_id) {
      const ct = a.channel_type || t.channel_type;
      const hits = props.filter(p => (p.channels || []).some(c => String(c.listing_id) === String(a.listing_id) && (!ct || !c.channel_type || c.channel_type === ct)));
      if (hits.length === 1) pid = Number(hits[0].id);
    }
    if (pid == null && a.reservation_code) {
      const rows = api.firstArray(await api.hx("GET", "/reservations", { query: { reservation_code: a.reservation_code, offset: 0, limit: 100 } }).catch(() => null))
        .filter(r => r.reservation_code === a.reservation_code && (!r.conversation_id || String(r.conversation_id) === String(id)));
      const ps = [...new Set(rows.map(r => Number(r.property_id)))];
      if (ps.length) { ps.forEach(x => out.add(x)); continue; }
    }
    if (pid == null) return null;
    out.add(pid);
  }
  return [...out];
}
async function ownThread(api, mg, rawId) {
  const id = inbox.convId(rawId);
  const [props, t] = await Promise.all([api.properties(), api.hx("GET", "/conversations/" + encodeURIComponent(id))]);
  if (!t) throw fail("not-found", "Conversation not found.");
  const pids = await threadPids(api, props, t, id);
  if (!pids || !pids.length || !pids.every(p => mine(mg, p))) throw fail("permission-denied", "That conversation isn't about one of your villas.");
  return { t, pid: pids[0], props, id };
}
function dates(a, b, { from, maxNights = 365, what = "dates" } = {}) {
  if (!ISO.test(a || "") || !ISO.test(b || "")) throw fail("invalid-argument", `Choose the ${what}.`);
  if (b < a) throw fail("invalid-argument", "The end date is before the start date.");
  if (from && a < from) throw fail("invalid-argument", "Pick dates from today onwards.");
  if (daysBetween(a, b) > maxNights) throw fail("invalid-argument", `That's more than ${maxNights} nights. Use a shorter range.`);
}

// activity log the admins see on the Managers page
async function log(db, mg, action, pid, villaTitle, detail) {
  const ref = db.doc("mgrlog/" + mg.email), entry = { at: new Date().toISOString(), action, pid: pid ? Number(pid) : null, villa: villaTitle || "", detail: clip(detail || "", 300) };
  try {
    await db.runTransaction(async tx => { const s = await tx.get(ref); const cur = s.exists ? s.data().entries || [] : []; tx.set(ref, { entries: [...cur, entry].slice(-150), updatedAt: Timestamp.now() }); });
  } catch (e) { console.warn("manager log", e.message); } // never fail the action over the log
}

/* ------------------------------------------------------------------ shapes */
function booking(r, props, money) {
  const p = props.find(x => Number(x.id) === Number(r.property_id)) || {}, ci = r.check_in_details || {}, rt = r.rates || {}, pay = r.payment || {};
  const out = { code: r.reservation_code, stay: r.stay_code || r.reservation_code, pid: Number(r.property_id), villa: p.title || "",
    ci: r.check_in_date, co: r.check_out_date, nights: r.check_in_date && r.check_out_date ? daysBetween(r.check_in_date, r.check_out_date) : null,
    guest: r.guest_name || "", phone: r.guest_phone || "", email: r.guest_email || "",
    guests: r.number_of_guests ?? null, adults: r.number_of_adults ?? null, children: r.number_of_children ?? null, infants: r.number_of_infants ?? null, pets: r.number_of_pets ?? null,
    status: r.status || "", stayStatus: r.stay_status || "", channel: DIRECT.includes(r.channel_type) && r.custom_channel?.name ? r.custom_channel.name : chLabel(r.channel_type), chType: r.channel_type || "",
    bookedAt: r.booked_at || r.created_at || "", cancelledAt: r.cancelled_at || "", remarks: r.remarks || "", channelRemarks: r.channel_remarks || "", conv: r.conversation_id || "",
    lock: ci.lock_code || "", arrival: hm(ci.arrival_at), departure: hm(ci.departure_at), guide: ci.check_in_guide_url || "",
    direct: DIRECT.includes(r.channel_type), box: !!r.in_reservation_box };
  if (money) {
    const tot = rt.total_rate || rt.rate || null;
    Object.assign(out, { total: tot ? Number(tot.amount) : null, currency: tot?.currency || pay.currency || "", commission: rt.total_commission ? Number(rt.total_commission.amount) : null,
      payout: pay.total_amount ?? null, paid: pay.received_amount ?? null, balance: pay.balance_amount ?? null, payStatus: pay.status || "" });
  }
  return out;
}
function taskRow(t, props, staff, money) {
  const p = props.find(x => Number(x.id) === Number(t.property_id)) || {}, s = staff.find(x => Number(x.id) === Number(t.staff_id));
  return { id: t.id, type: t.type || "other", status: t.status || "pending", date: t.expected_date || "", time: String(t.expected_time || "").slice(0, 5),
    pid: Number(t.property_id) || null, villa: p.title || "", staffId: t.staff_id ? Number(t.staff_id) : null, staff: s?.name || (t.staff_id ? "#" + t.staff_id : ""),
    note: t.note || "", stay: t.stay_code || "", ...(money ? { fee: t.fee ?? null, currency: t.currency || "" } : {}) };
}
const villaRow = p => ({ id: Number(p.id), title: p.title || "Villa " + p.id, address: p.address || "", checkin: p.default_checkin_time || "", checkout: p.default_checkout_time || "",
  channels: [...new Set((p.channels || []).map(c => chLabel(c.channel_type)))] });
async function staffList(api) {
  const s = await api.all("/staffs", "staffs").catch(() => null);
  return s ? s.filter(x => x.is_active !== false).map(x => ({ id: Number(x.id), name: x.name || "#" + x.id })) : null;
}
async function knownStaff(api, id) {
  const staff = await staffList(api);
  if (!staff) throw fail("unavailable", "Couldn't read staff from Hostex. Try again.");
  if (!staff.some(s => s.id === Number(id))) throw fail("invalid-argument", "Choose someone from the staff list.");
}
async function myTasks(api, mg, from, to) {
  const lists = await pool(myPids(mg), 2, pid => api.all("/tasks", "tasks", { property_id: pid, start_date: from, end_date: to }).catch(() => null));
  if (lists.every(x => x === null) && myPids(mg).length) throw fail("unavailable", "Couldn't read tasks from Hostex. Try again.");
  const seen = new Map();
  for (const t of lists.flat().filter(Boolean)) if (mine(mg, t.property_id)) seen.set(t.id, t);
  return [...seen.values()];
}

/* ------------------------------------------------------------------ the manager app */
async function home({ api, db, mg, now, key }) {
  requireActive(mg);
  const P = permsOf(mg), props = await api.properties(), pids = myPids(mg);
  const villas = pids.map(id => props.find(p => Number(p.id) === id)).filter(Boolean);
  const bookingsOn = P.bookings || P.calendar || P.messages;
  const [raw, tasks, staff, extra] = await Promise.all([
    bookingsOn ? pool(villas, 2, v => api.reservationsBetween(addDays(now, -90), addDays(now, 365), { propertyId: v.id })) : [],
    P.tasks ? myTasks(api, mg, addDays(now, -7), addDays(now, 30)) : [],
    P.tasks ? staffList(api) : [],
    P.bookings ? Promise.all([api.all("/custom_channels", "custom_channels").catch(() => []), api.all("/income_methods", "income_methods").catch(() => [])]) : [[], []],
  ]);
  const seen = new Map();
  for (const r of raw.flat()) if (mine(mg, r.property_id)) seen.set(r.reservation_code, r);
  const bookings = [...seen.values()].filter(r => r.check_in_date && r.check_out_date && (ON_CAL.includes(r.status) || r.check_out_date >= addDays(now, -30)))
    .map(r => { const x = booking(r, props, P.money); if (!P.bookings) Object.assign(x, { phone: "", email: "", lock: "", guide: "", remarks: "", channelRemarks: "" }); return x; })
    .sort((a, b) => a.ci.localeCompare(b.ci));
  return { now, name: mg.name || "", email: mg.email, perms: P, ai: P.messages && aiOn(key), villas: villas.map(villaRow), missing: pids.filter(id => !villas.some(v => Number(v.id) === id)),
    bookings, tasks: tasks.map(t => taskRow(t, props, staff || [], P.money)).sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99"))),
    staff: staff || [], staffError: P.tasks && !staff ? "Couldn't read staff from Hostex" : "",
    channels: (extra[0] || []).map(c => ({ id: Number(c.id), name: c.name || "#" + c.id })), incomeMethods: (extra[1] || []).map(c => ({ id: Number(c.id), name: c.name || "#" + c.id })) };
}

// six weeks of one villa: open / blocked / booked, nightly price per channel, minimum stay
async function calendar({ api, db, mg, b, now }) {
  need(mg, "calendar");
  const prop = await villa(api, mg, b.pid), P = permsOf(mg);
  const start = ISO.test(b.start || "") && b.start >= addDays(now, -62) && b.start <= addDays(now, 720) ? b.start : now, end = addDays(start, 41);
  const [cal, raw, revSnap, owners] = await Promise.all([revenue.loadCalendar(api, prop, start, end), api.reservationsBetween(addDays(start, -90), end, { propertyId: prop.id }),
    db.doc("revenue/" + prop.id).get(), P.prices ? revenue.clientsByProperty(db) : null]);
  const stays = raw.filter(r => Number(r.property_id) === Number(prop.id) && ON_CAL.includes(r.status) && r.check_out_date > start && r.check_in_date <= end);
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const r = stays.find(x => x.check_in_date <= d && x.check_out_date > d), out = stays.find(x => x.check_out_date === d);
    days.push({ d, s: r ? (r.status === "wait_accept" ? "request" : "booked") : cal.avail[d] === false ? "blocked" : "open",
      pp: cal.listings.map(L => L.cal[d]?.p ?? null), min: cal.listings[0]?.cal[d]?.min ?? null,
      code: r?.reservation_code || "", guest: r ? firstName(r.guest_name) || "Guest" : "", first: !!r && (r.check_in_date === d || d === start), out: out ? out.reservation_code : "" });
  }
  const rev = revSnap.exists ? revSnap.data() : {}, st = P.prices ? revenue.cfgFor(rev, owners.get(String(prop.id))?.data, prop.title) : null;
  const history = P.prices ? Object.values(rev.applied || {}).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12)
    .map(x => ({ id: x.id, summary: x.summary, at: x.at, by: x.by === mg.email ? "you" : "IndaVillas", undoneAt: x.undoneAt || null, canUndo: x.by === mg.email && !x.undoneAt && !!x.undo?.length })) : [];
  return { pid: Number(prop.id), title: prop.title, start, end, today: now, days, listings: cal.listings.map(L => ({ label: L.label, currency: L.currency })),
    floor: st?.cfg.floor ?? null, floorCurrency: st?.cfg.currency || "", pricingTool: st?.pricingTool || "", priceUntil: addDays(now, 89), history };
}

async function setAvailability({ api, db, mg, b, now }) {
  need(mg, "calendar");
  const prop = await villa(api, mg, b.pid), open = !!b.available;
  dates(b.start, b.end, { from: now, maxNights: 365 });
  if (b.end > addDays(now, 730)) throw fail("invalid-argument", "The calendar goes up to two years ahead.");
  if (open) { // opening nights that a booking sits on would let a channel sell them twice
    const raw = await api.reservationsBetween(addDays(b.start, -90), b.end, { propertyId: prop.id });
    const hit = raw.find(r => Number(r.property_id) === Number(prop.id) && ON_CAL.includes(r.status) && r.check_in_date <= b.end && r.check_out_date > b.start);
    if (hit) throw fail("failed-precondition", `${hit.guest_name || "A guest"} is booked ${hit.check_in_date} → ${hit.check_out_date}. Open only nights without a booking.`);
  }
  await api.hx("POST", "/availabilities", { body: { property_ids: [Number(prop.id)], available: open, start_date: b.start, end_date: b.end } });
  const n = daysBetween(b.start, b.end) + 1;
  await log(db, mg, open ? "Opened dates" : "Blocked dates", prop.id, prop.title, `${b.start} → ${b.end} (${n} night${n === 1 ? "" : "s"})${b.note ? " · " + str(b.note, 120) : ""}`);
  return { ok: true, nights: n };
}

async function setPrice({ api, db, mg, b, now }) {
  need(mg, "prices");
  const prop = await villa(api, mg, b.pid);
  const custom = { start: b.start, end: b.end, days: ["all", "weekends", "weekdays"].includes(b.days) ? b.days : "all", pct: b.pct ?? "", price: b.price ?? "", minStay: b.minStay ?? "" };
  const r = await revenue.apply({ api, db, me: mg.email, pid: Number(prop.id), body: { custom }, today: now });
  await log(db, mg, "Changed prices", prop.id, prop.title, r.applied?.summary || "");
  return r;
}
async function undoPrice({ api, db, mg, b, now }) {
  need(mg, "prices");
  const prop = await villa(api, mg, b.pid);
  const rec = ((await db.doc("revenue/" + prop.id).get()).data() || {}).applied?.[b.id];
  if (!rec) throw fail("not-found", "Nothing to undo.");
  if (rec.by !== mg.email) throw fail("permission-denied", "You can only undo price changes you made.");
  const r = await revenue.undo({ api, db, me: mg.email, pid: Number(prop.id), id: b.id, today: now });
  await log(db, mg, "Undid a price change", prop.id, prop.title, rec.summary || "");
  return r;
}

/* ------------------------------------------------------------------ bookings */
async function createBooking({ api, db, mg, b, now }) {
  need(mg, "bookings");
  const prop = await villa(api, mg, b.pid);
  dates(b.ci, b.co, { what: "check-in and check-out dates", maxNights: 90 });
  if (b.co <= b.ci) throw fail("invalid-argument", "Check-out has to be at least one night after check-in.");
  if (b.ci < addDays(now, -1)) throw fail("invalid-argument", "Check-in can't be more than a day in the past.");
  if (b.ci > addDays(now, 730)) throw fail("invalid-argument", "Bookings go up to two years ahead.");
  const guest = str(b.guest, 80); if (guest.length < 2) throw fail("invalid-argument", "Enter the guest's name.");
  const email = str(b.email, 120); if (email && !EMAIL.test(email)) throw fail("invalid-argument", "That email address doesn't look right.");
  const guests = Number(b.guests || 0); if (!(Number.isInteger(guests) && guests >= 1 && guests <= 50)) throw fail("invalid-argument", "Number of guests: 1 to 50.");
  const total = amount(b.amount), received = amount(b.received) ?? 0, commission = amount(b.commission) ?? 0;
  if (total == null || !(total >= 0)) throw fail("invalid-argument", "Enter the total price of the stay (0 for an owner or free stay).");
  if (!(received >= 0) || !(commission >= 0)) throw fail("invalid-argument", "Use plain numbers for amounts.");
  if (received > total) throw fail("invalid-argument", "Paid so far is more than the total.");
  const currency = String(b.currency || "").toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw fail("invalid-argument", "Choose the currency.");
  const channelId = Number(b.channelId), methodId = Number(b.methodId);
  if (!channelId) throw fail("invalid-argument", "Choose where the booking came from.");
  if (!methodId) throw fail("invalid-argument", "Choose how the guest pays.");
  const [raw, av] = await Promise.all([api.reservationsBetween(addDays(b.ci, -90), addDays(b.co, -1), { propertyId: prop.id }),
    api.hx("GET", "/availabilities", { query: { property_ids: String(prop.id), start_date: b.ci, end_date: addDays(b.co, -1) } })]);
  const clash = raw.find(r => Number(r.property_id) === Number(prop.id) && ON_CAL.includes(r.status) && r.check_in_date < b.co && r.check_out_date > b.ci);
  if (clash) throw fail("failed-precondition", `Those dates overlap ${clash.guest_name || "another booking"} (${clash.check_in_date} → ${clash.check_out_date}).`);
  const closed = api.firstArray(av).flatMap(x => x.availabilities || x.dates || []).filter(d => d && d.available === false).map(d => d.date);
  if (closed.length) throw fail("failed-precondition", `${closed.length === 1 ? closed[0] + " is" : closed.length + " of those nights are"} blocked in the calendar. Open ${closed.length === 1 ? "it" : "them"} first, or pick other dates.`);
  // our own reference (Hostex channel_id): made here, never taken from the page, so it can't point at an existing booking
  const ref = "IV" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(5).toString("hex").toUpperCase();
  const body = { property_id: Number(prop.id), custom_channel_id: channelId, check_in_date: b.ci, check_out_date: b.co, guest_name: guest, number_of_guests: guests,
    currency, rate_amount: total, commission_amount: commission, received_amount: received, income_method_id: methodId, channel_id: ref,
    remarks: [str(b.remarks, 420), `Added by ${mg.name || mg.email} in the IndaVillas portal`].filter(Boolean).join("\n").slice(0, 500) };
  if (email) body.email = email;
  const mobile = str(b.mobile, 30).replace(/[^\d+ ()-]/g, ""); if (mobile) body.mobile = mobile;
  const out = await api.hx("POST", "/reservations", { body });
  const code = out?.reservation?.reservation_code || out?.reservation_code || out?.stay_code || "";
  const made = code ? api.firstArray(await api.hx("GET", "/reservations", { query: { reservation_code: code, offset: 0, limit: 5 } }).catch(() => null)).find(r => r.reservation_code === code) : null;
  if (made && (Number(made.property_id) !== Number(prop.id) || made.check_in_date !== b.ci || made.check_out_date !== b.co))
    throw fail("aborted", "Hostex answered with a different booking. Check the calendar before trying again.");
  await log(db, mg, "Created a booking", prop.id, prop.title, `${guest} · ${b.ci} → ${b.co} · ${guests} guest${guests === 1 ? "" : "s"}`);
  return { ok: true, code, ref };
}

async function updateBooking({ api, db, mg, b, now }) {
  need(mg, "bookings");
  const r = await ownBooking(api, mg, b.code), prop = await villa(api, mg, r.property_id), f = b.fields || {}, body = {};
  if (["cancelled", "denied", "timeout"].includes(r.status)) throw fail("failed-precondition", "That booking isn't active any more.");
  if (f.guest !== undefined) { const g = str(f.guest, 80); if (g.length < 2) throw fail("invalid-argument", "Enter the guest's name."); body.guest_name = g; }
  if (f.email !== undefined) { const e = str(f.email, 120); if (e && !EMAIL.test(e)) throw fail("invalid-argument", "That email address doesn't look right."); if (e) body.email = e; }
  if (f.mobile !== undefined) body.mobile = str(f.mobile, 30).replace(/[^\d+ ()-]/g, "");
  if (f.guests !== undefined) { const n = Number(f.guests); if (!(Number.isInteger(n) && n >= 1 && n <= 50)) throw fail("invalid-argument", "Number of guests: 1 to 50."); body.number_of_guests = n; }
  if (f.remarks !== undefined) body.remarks = str(f.remarks, 500);
  const direct = DIRECT.includes(r.channel_type);
  if ((f.ci !== undefined || f.co !== undefined || f.amount !== undefined) && !direct) throw fail("failed-precondition", `Dates and price of ${chLabel(r.channel_type)} bookings are changed on ${chLabel(r.channel_type)}.`);
  if (f.ci !== undefined || f.co !== undefined) {
    const ci = f.ci ?? r.check_in_date, co = f.co ?? r.check_out_date;
    dates(ci, co, { what: "check-in and check-out dates", maxNights: 90 });
    if (co <= ci) throw fail("invalid-argument", "Check-out has to be at least one night after check-in.");
    if ((ci !== r.check_in_date && ci < addDays(now, -1)) || (co !== r.check_out_date && co < now)) throw fail("invalid-argument", "Bookings can't be moved into the past.");
    if (ci !== r.check_in_date || co !== r.check_out_date) {
      const raw = await api.reservationsBetween(addDays(ci, -90), addDays(co, -1), { propertyId: prop.id });
      const clash = raw.find(x => x.reservation_code !== r.reservation_code && Number(x.property_id) === Number(prop.id) && ON_CAL.includes(x.status) && x.check_in_date < co && x.check_out_date > ci);
      if (clash) throw fail("failed-precondition", `Those dates overlap ${clash.guest_name || "another booking"} (${clash.check_in_date} → ${clash.check_out_date}).`);
      body.check_in_date = ci; body.check_out_date = co;
    }
  }
  if (f.amount !== undefined) { if (!permsOf(mg).money) throw fail("permission-denied", "Your login doesn't include booking amounts."); const a = amount(f.amount); if (a == null || !(a >= 0)) throw fail("invalid-argument", "Enter the total price as a number."); if (a > 999999) throw fail("invalid-argument", "Hostex only takes totals up to 999,999 from here. Change bigger totals (e.g. in IDR) in Hostex."); body.rate_amount = a; }
  if (!Object.keys(body).length) throw fail("invalid-argument", "Nothing to change.");
  await api.hx("PATCH", "/reservations/" + encodeURIComponent(r.stay_code || r.reservation_code), { body });
  await log(db, mg, "Edited a booking", prop.id, prop.title, `${r.guest_name || r.reservation_code}: ${Object.keys(body).map(k => k.replace(/_/g, " ")).join(", ")}`);
  return { ok: true };
}

async function checkinDetails({ api, db, mg, b }) {
  need(mg, "bookings");
  const r = await ownBooking(api, mg, b.code), body = {};
  if (b.lock !== undefined) { const l = str(b.lock, 40); body.lock_code = l || null; }
  for (const [k, key] of [["arrival", "arrival_at"], ["departure", "departure_at"]]) if (b[k] !== undefined) {
    if (!b[k]) continue; const t = toHM(b[k]); if (!t) throw fail("invalid-argument", "Times look like 15:00."); body[key] = t;
  }
  if (!Object.keys(body).length) throw fail("invalid-argument", "Nothing to change.");
  await api.hx("PATCH", "/reservations/" + encodeURIComponent(r.stay_code || r.reservation_code) + "/check_in_details", { body });
  await log(db, mg, "Updated check-in details", r.property_id, "", `${r.guest_name || r.reservation_code}${body.lock_code !== undefined ? " · lock code" : ""}${body.arrival_at ? " · arrival " + hm(body.arrival_at) : ""}${body.departure_at ? " · departure " + hm(body.departure_at) : ""}`);
  return { ok: true };
}

async function stayStatus({ api, db, mg, b }) {
  need(mg, "bookings");
  if (!STAY_STATUSES.includes(b.status)) throw fail("invalid-argument", "Unknown stay status.");
  const r = await ownBooking(api, mg, b.code);
  if (!LIVE.includes(r.status)) throw fail("failed-precondition", "Only confirmed bookings can be checked in or out.");
  await api.hx("PUT", "/reservations/" + encodeURIComponent(r.stay_code || r.reservation_code) + "/stay_status", { body: { stay_status: b.status } });
  await log(db, mg, { in_house: "Checked a guest in", stay_completed: "Checked a guest out", checkin_pending: "Reset check-in" }[b.status], r.property_id, "", `${r.guest_name || r.reservation_code} · ${r.check_in_date} → ${r.check_out_date}`);
  return { ok: true, stayStatus: b.status };
}

async function answerRequest({ api, db, mg, b }) {
  need(mg, "bookings");
  const yes = b.decision === "approve"; if (!yes && b.decision !== "decline") throw fail("invalid-argument", "Approve or decline?");
  const r = await ownBooking(api, mg, b.code);
  if (r.status !== "wait_accept") throw fail("failed-precondition", "This booking isn't waiting for an answer any more.");
  await api.hx("POST", "/reservations/" + encodeURIComponent(r.reservation_code) + (yes ? "/approve" : "/decline"), { body: {} });
  await log(db, mg, yes ? "Approved a booking request" : "Declined a booking request", r.property_id, "", `${r.guest_name || r.reservation_code} · ${r.check_in_date} → ${r.check_out_date} · ${chLabel(r.channel_type)}`);
  return { ok: true };
}

async function cancelBooking({ api, db, mg, b }) {
  need(mg, "bookings");
  const r = await ownBooking(api, mg, b.code);
  if (!DIRECT.includes(r.channel_type)) throw fail("failed-precondition", `${chLabel(r.channel_type)} bookings are cancelled on ${chLabel(r.channel_type)}, not here.`);
  if (["cancelled", "denied", "timeout"].includes(r.status)) throw fail("failed-precondition", "That booking is already cancelled.");
  await api.hx("DELETE", "/reservations/" + encodeURIComponent(r.reservation_code));
  await log(db, mg, "Cancelled a booking", r.property_id, "", `${r.guest_name || r.reservation_code} · ${r.check_in_date} → ${r.check_out_date}${b.reason ? " · " + str(b.reason, 160) : ""}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ guest messages */
async function inboxList({ api, mg }) {
  need(mg, "messages");
  const props = await api.properties(), titles = new Set(props.filter(p => mine(mg, p.id)).map(p => p.title).filter(Boolean));
  const d = await api.hx("GET", "/conversations", { query: { offset: 0, limit: 100 } });
  const convs = inbox.dedupe(d?.conversations || api.firstArray(d)).sort((a, b) => String(b.last_message_at).localeCompare(String(a.last_message_at)));
  // a conversation titled with another villa is never opened; untitled ones are opened to find their villa
  const cand = convs.filter(c => !c.property_title || titles.has(c.property_title)).slice(0, 30);
  const rows = await pool(cand, 4, async c => {
    const t = await api.hx("GET", "/conversations/" + encodeURIComponent(c.id)).catch(() => null); if (!t) return null;
    const pids = await threadPids(api, props, t, c.id).catch(() => null); if (!pids || !pids.length || !pids.every(p => mine(mg, p))) return null;
    const pid = pids[0];
    const row = inbox.row(c, t, props), p = props.find(x => Number(x.id) === pid);
    return { ...row, pid, villa: p?.title || row.villa };
  });
  return rows.filter(Boolean);
}
async function inboxThread({ api, db, mg, b }) {
  need(mg, "messages");
  const { t, pid, id } = await ownThread(api, mg, b.id);
  const out = await inbox.thread({ api, db, id, raw: t });
  const P = permsOf(mg);
  if (out.booking && !P.money) for (const k of ["total", "currency", "paid", "balance"]) delete out.booking[k];
  if (!P.bookings) { out.contact = { phone: "", email: "" }; if (out.booking) { out.booking.lock = ""; out.booking.remarks = ""; } }
  return { ...out, pid, client: "" };
}
async function inboxDraft({ api, db, mg, key, b }) {
  need(mg, "messages");
  const { t, id } = await ownThread(api, mg, b.id);
  return inbox.draft({ api, db, key, id, instruction: b.instruction, raw: t });
}
async function inboxSend({ api, db, mg, b }) {
  need(mg, "messages");
  const { t, pid, props, id } = await ownThread(api, mg, b.id);
  const r = await inbox.send({ api, db, id, message: b.message, me: mg.email, ai: !!b.ai });
  await log(db, mg, "Messaged a guest", pid, props.find(x => Number(x.id) === pid)?.title || "", `${t.guest?.name || "Guest"}: ${clip(String(b.message || "").trim(), 140)}`);
  return r;
}

/* ------------------------------------------------------------------ tasks */
async function tasks({ api, mg, now }) {
  need(mg, "tasks");
  const [props, list, staff] = await Promise.all([api.properties(), myTasks(api, mg, addDays(now, -7), addDays(now, 30)), staffList(api)]);
  return { tasks: list.map(t => taskRow(t, props, staff || [], permsOf(mg).money)), staff: staff || [], staffError: staff ? "" : "Couldn't read staff from Hostex" };
}
async function createTask({ api, db, mg, b, now }) {
  need(mg, "tasks");
  const prop = await villa(api, mg, b.pid);
  if (!TASK_TYPES.includes(b.type)) throw fail("invalid-argument", "Choose the kind of task.");
  if (!ISO.test(b.date || "") || b.date < addDays(now, -1) || b.date > addDays(now, 365)) throw fail("invalid-argument", "Choose a date from today up to a year ahead.");
  const body = { type: b.type, expected_date: b.date, currency: "IDR", property_id: Number(prop.id), note: str(b.note, 500) };
  if (b.time) { const t = toHM(b.time); if (!t) throw fail("invalid-argument", "Times look like 11:00."); body.expected_time = hm(t) + ":00"; }
  if (b.staffId) { await knownStaff(api, b.staffId); body.staff_id = Number(b.staffId); }
  if (b.stay) { const r = await ownBooking(api, mg, b.stay); body.stay_code = r.stay_code || r.reservation_code; }
  if (b.fee !== undefined && b.fee !== "" && permsOf(mg).money) { const f = amount(b.fee); if (f == null || !(f >= 0)) throw fail("invalid-argument", "Fee: a number in IDR."); body.fee = f; }
  const out = await api.hx("POST", "/tasks", { body });
  await log(db, mg, "Created a task", prop.id, prop.title, `${b.type.replace("_", " ")} on ${b.date}${body.expected_time ? " " + body.expected_time.slice(0, 5) : ""}${body.note ? " · " + clip(body.note, 100) : ""}`);
  return { ok: true, id: out?.task?.id ?? out?.id ?? null };
}
async function updateTask({ api, db, mg, b, now }) {
  need(mg, "tasks");
  const id = Number(b.id); if (!id) throw fail("invalid-argument", "Which task?");
  const t = api.firstArray(await api.hx("GET", "/tasks", { query: { id, offset: 0, limit: 1 } })).find(x => Number(x.id) === id);
  if (!t || !mine(mg, t.property_id)) throw fail("permission-denied", "That task isn't at one of your villas.");
  const patch = {};
  if (b.status !== undefined) { if (!TASK_STATUSES.includes(b.status)) throw fail("invalid-argument", "Unknown status."); patch.status = b.status; }
  if (b.staffId !== undefined) { if (Number(b.staffId)) await knownStaff(api, b.staffId); patch.staff_id = Number(b.staffId) || 0; } // 0 = nobody
  if (b.date !== undefined) { if (!ISO.test(b.date) || b.date > addDays(now, 365)) throw fail("invalid-argument", "Choose a date."); patch.expected_date = b.date; }
  if (b.time !== undefined && b.time !== "") { const x = toHM(b.time); if (!x) throw fail("invalid-argument", "Times look like 11:00."); patch.expected_time = hm(x) + ":00"; }
  if (b.note !== undefined) patch.note = str(b.note, 500);
  if (b.type !== undefined) { if (!TASK_TYPES.includes(b.type)) throw fail("invalid-argument", "Unknown task type."); patch.type = b.type; }
  if (!Object.keys(patch).length) throw fail("invalid-argument", "Nothing to change.");
  await api.hx("PATCH", "/tasks/" + id, { body: patch });
  await log(db, mg, "Updated a task", t.property_id, "", `${(t.type || "task").replace("_", " ")} on ${t.expected_date}: ${Object.keys(patch).map(k => k.replace(/_id$|expected_/g, "").replace("_", " ")).join(", ")}${patch.status ? " → " + patch.status.replace("_", " ") : ""}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ admin: who can sign in as a manager */
async function list({ api, db }) {
  const [snap, props] = await Promise.all([db.collection("managers").get(), api.properties().catch(() => null)]);
  const managers = snap.docs.map(d => ({ email: d.id, ...d.data(), perms: permsOf(d.data()) })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const logs = await Promise.all(managers.map(m => db.doc("mgrlog/" + m.email).get().then(s => (s.exists ? s.data().entries || [] : []).map(e => ({ ...e, email: m.email, name: m.name || m.email }))).catch(() => [])));
  return { managers, perms: PERMS, villas: (props || []).map(p => ({ id: Number(p.id), title: p.title || "Villa " + p.id })), villasError: props ? "" : "Couldn't read villas from Hostex",
    log: logs.flat().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 80) };
}
async function save({ api, db, b, me }) {
  const email = lc(b.email);
  if (!EMAIL.test(email)) throw fail("invalid-argument", "Enter a valid email address.");
  const ref = db.doc("managers/" + email), cur = await ref.get(), old = cur.exists ? cur.data() : null;
  if (!old) {
    const [ad, cl, ow] = await Promise.all(["admins/", "cleaners/", "clients/"].map(c => db.doc(c + email).get()));
    if (ad.exists) throw fail("already-exists", "That email belongs to an admin. Admins can already do everything; use another email for the manager login.");
    if (cl.exists) throw fail("already-exists", "That email is a cleaner login. Use another email for the manager login.");
    if (ow.exists) throw fail("already-exists", "That email is a villa owner's login. Use another email for the manager login.");
  }
  const name = str(b.name ?? old?.name, 80); if (!name) throw fail("invalid-argument", "Enter the manager's name.");
  let propertyIds = old?.propertyIds || [];
  if (b.propertyIds !== undefined) {
    const ids = [...new Set((Array.isArray(b.propertyIds) ? b.propertyIds : []).map(Number).filter(Boolean))];
    const known = await api.properties().catch(() => null);
    if (known) { const bad = ids.filter(id => !known.some(p => Number(p.id) === id)); if (bad.length) throw fail("invalid-argument", "Some of those villas aren't in Hostex: " + bad.join(", ")); }
    propertyIds = ids;
  }
  const active = b.active !== undefined ? !!b.active : old?.active ?? true;
  if (!propertyIds.length && active) throw fail("invalid-argument", "Choose at least one villa they manage.");
  const perms = { ...allPerms(true), ...(old?.perms || {}) };
  if (b.perms && typeof b.perms === "object") for (const k of Object.keys(PERMS)) if (b.perms[k] !== undefined) perms[k] = !!b.perms[k];
  const rec = { name, propertyIds, perms, active, phone: str(b.phone ?? old?.phone, 24).replace(/[^\d+ ]/g, ""), updatedAt: Timestamp.now(), by: me };
  if (!old) rec.createdAt = Timestamp.now();
  await ref.set(rec, { merge: true });
  return { email, ...(old || {}), ...rec };
}
async function invited({ db, auth, b }) {
  const email = lc(b.email), ref = db.doc("managers/" + email), cur = await ref.get();
  if (!cur.exists) throw fail("not-found", "Manager not found.");
  if (cur.data().active === false) throw fail("failed-precondition", "Switch the login on first.");
  const pw = crypto.randomBytes(24).toString("base64url");
  let user = await auth.getUserByEmail(email).catch(e => { if (e.code === "auth/user-not-found") return null; throw e; });
  if (user) { await auth.updateUser(user.uid, { password: pw }); await auth.revokeRefreshTokens(user.uid); } // whoever set the old password is out
  else user = await auth.createUser({ email, password: pw });
  await ref.update({ invitedAt: Timestamp.now(), authUid: user.uid, authSince: Date.now() });
  return { ok: true };
}
async function remove({ db, b }) {
  const ref = db.doc("managers/" + lc(b.email));
  if (!(await ref.get()).exists) throw fail("not-found", "Manager not found.");
  await ref.delete();
  return { ok: true };
}

module.exports = { bookingRow: booking, villaRow, log, PERMS, getManager, checkLogin, permsOf, home, calendar, setAvailability, setPrice, undoPrice, createBooking, updateBooking, checkinDetails, stayStatus, answerRequest, cancelBooking,
  inboxList, inboxThread, inboxDraft, inboxSend, tasks, createTask, updateTask, list, save, invited, remove };
