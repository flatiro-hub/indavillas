/* Cleaning calendar links: a secret link per villa (or group of villas) that cleaners open on their phone, no login.
 *
 *   calendarLinks/{key}  { name, propertyIds: [Hostex property ids], lang: "id"|"en", createdAt, updatedAt, by, openedAt }
 *                        written only by these functions (admin Cleaners page); Firestore rules give the page no access
 *
 * The page portal/clean.html?k=<key> calls the public cleanCalendar function. It returns stays only: dates, check-in and
 * check-out times and how many guests. No guest names, contact details, booking codes, channels or amounts leave the server.
 * The key is 24 random characters; removing the link switches it off at once. */
const crypto = require("crypto");
const { Timestamp } = require("firebase-admin/firestore");
const { addDays, daysBetween, pool } = require("./util");
const { LIVE } = require("./hostex");

const fail = (code, msg) => Object.assign(new Error(msg), { code });
const KEY = /^[A-Za-z0-9_-]{20,64}$/;
const str = (v, n) => String(v ?? "").trim().slice(0, n);
const hm = t => (t && t.hour != null ? `${String(t.hour).padStart(2, "0")}:${String(t.minute || 0).padStart(2, "0")}` : "");
const hhmm = s => { const m = String(s || "").match(/^(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, "0") + ":" + m[2] : ""; };
const DAYS_AHEAD = 92;

/* ---------- admin (portalApi "callinks.*") ---------- */
async function list({ api, db }) {
  const [snap, props] = await Promise.all([db.collection("calendarLinks").get(), api.properties().catch(() => null)]);
  const links = snap.docs.map(d => ({ key: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { links, villas: (props || []).map(p => ({ id: Number(p.id), title: p.title || "Villa " + p.id })), villasError: props ? "" : "Couldn't read villas from Hostex" };
}

async function save({ api, db, b, me }) {
  const pids = [...new Set((Array.isArray(b.propertyIds) ? b.propertyIds : []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 30);
  if (!pids.length) throw fail("invalid-argument", "Tick at least one villa.");
  const props = await api.properties(), titles = pids.map(id => props.find(p => Number(p.id) === id)?.title);
  if (titles.some(t => t === undefined)) throw fail("invalid-argument", "One of those villas isn't in Hostex any more. Refresh and try again.");
  const data = { name: str(b.name, 80) || titles.join(", "), propertyIds: pids, lang: b.lang === "en" ? "en" : "id", updatedAt: Timestamp.now(), by: me || "" };
  if (b.key) {
    if (!KEY.test(b.key)) throw fail("invalid-argument", "That link isn't valid.");
    const ref = db.doc("calendarLinks/" + b.key);
    if (!(await ref.get()).exists) throw fail("not-found", "That link was removed. Make a new one.");
    await ref.set(data, { merge: true });
    return { key: b.key, ...(await ref.get()).data() };
  }
  const key = crypto.randomBytes(18).toString("base64url");
  await db.doc("calendarLinks/" + key).set({ ...data, createdAt: Timestamp.now() });
  return { key, ...data };
}

async function remove({ db, b }) {
  if (!KEY.test(b.key || "")) throw fail("invalid-argument", "That link isn't valid.");
  await db.doc("calendarLinks/" + b.key).delete();
  return { ok: true };
}

/* ---------- public (cleanCalendar function) ---------- */
// Hostex answers are kept for two minutes per set of villas, so a team refreshing their phones doesn't hammer Hostex.
// The link itself is read every time, so a removed link stops working straight away.
const cache = new Map();
function stayOf(r, villa) {
  const d = r.check_in_details || {};
  return { pid: Number(r.property_id), ci: r.check_in_date, co: r.check_out_date, nights: daysBetween(r.check_in_date, r.check_out_date),
    guests: r.number_of_guests ?? null, adults: r.number_of_adults ?? null, children: r.number_of_children ?? null, infants: r.number_of_infants ?? null, pets: r.number_of_pets ?? null,
    in: hm(d.arrival_at) || villa.checkin, inGuest: !!hm(d.arrival_at), out: hm(d.departure_at) || villa.checkout, outGuest: !!hm(d.departure_at),
    confirmed: r.status === "accepted", left: r.stay_status === "stay_completed", inHouse: r.stay_status === "in_house" };
}
async function publicView({ api, db, key, now, at = Date.now() }) {
  if (!KEY.test(key || "")) throw fail("not-found", "This calendar link isn't valid. Ask IndaVillas for the link again.");
  const ref = db.doc("calendarLinks/" + key), s = await ref.get();
  if (!s.exists) throw fail("not-found", "This calendar link was switched off. Ask IndaVillas for the new one.");
  const L = s.data(), pids = (L.propertyIds || []).map(Number), ck = pids.join(",") + "|" + now;
  let hit = cache.get(ck);
  if (!hit || at - hit.at > 120000) {
    const props = await api.properties();
    const villas = pids.map(id => props.find(p => Number(p.id) === id)).filter(Boolean)
      .map(p => ({ id: Number(p.id), title: p.title || "Villa " + p.id, checkin: hhmm(p.default_checkin_time), checkout: hhmm(p.default_checkout_time) }));
    const from = addDays(now, -1), to = addDays(now, DAYS_AHEAD), seen = new Map();
    for (const r of (await pool(villas, 2, v => api.reservationsBetween(addDays(from, -60), to, { propertyId: v.id }))).flat())
      if (pids.includes(Number(r.property_id)) && LIVE.includes(r.status) && r.check_in_date && r.check_out_date && r.check_out_date >= from && r.check_in_date <= to)
        seen.set((r.stay_code || r.reservation_code) + "|" + r.property_id, r);
    const stays = [...seen.values()].map(r => stayOf(r, villas.find(v => v.id === Number(r.property_id)))).sort((a, b) => a.ci.localeCompare(b.ci) || a.pid - b.pid);
    hit = { at, villas, stays };
    cache.set(ck, hit);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
  }
  const opened = L.openedAt?.toMillis ? L.openedAt.toMillis() : 0;
  if (at - opened > 30 * 60000) await ref.set({ openedAt: Timestamp.now() }, { merge: true }).catch(() => {});
  return { name: L.name || "", lang: L.lang === "en" ? "en" : "id", today: now, until: addDays(now, DAYS_AHEAD), updatedAt: new Date(hit.at).toISOString(), villas: hit.villas, stays: hit.stays };
}

// the HTTP side, kept here so it can be tested without the Functions runtime
async function handleHttp(req, res, { db, api, now }) {
  res.set("Cache-Control", "private, max-age=60");
  res.set("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET") { res.status(405).json({ error: "Use GET." }); return; }
  try { res.status(200).json(await publicView({ db, api, key: String(req.query?.k || ""), now })); }
  catch (e) {
    const nf = e.code === "not-found";
    if (!nf) console.error("cleanCalendar", e.message);
    res.status(nf ? 404 : 502).json({ error: nf ? e.message : "Couldn't read the calendar from Hostex. Try again in a minute." });
  }
}

module.exports = { list, save, remove, publicView, handleHttp, KEY, _cache: cache };
