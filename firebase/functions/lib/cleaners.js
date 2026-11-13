/* Cleaner app: every cleaner signs in to the portal with their own email and password, and sees and updates
 * only the Hostex tasks assigned to their Hostex staff member. They never reach Hostex itself.
 *
 *   cleaners/{email}   { name, staffId, phone, lang: "id" | "en", active, invitedAt, createdAt, updatedAt, by }
 *                      written only by these functions (admins manage them on the Cleaners page)
 *
 * Cleaners get: villa, date and time of each job, what to do (task note), who is leaving and who arrives next
 * (first name and number of guests only; no contact details, prices or booking codes). */
const { Timestamp } = require("firebase-admin/firestore");
const { TZ, addDays, daysBetween, firstName } = require("./util");
const { liveTrimmed } = require("./hostex");
const { getSettings, notify, adminList } = require("./notify");

const fail = (code, msg) => Object.assign(new Error(msg), { code });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const lc = s => String(s || "").trim().toLowerCase();
const CLEANER_STATUSES = ["pending", "in_progress", "completed"];
const stamp = () => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

async function getCleaner(db, email) {
  if (!email) return null;
  const s = await db.doc("cleaners/" + lc(email)).get();
  return s.exists ? { email: s.id, ...s.data() } : null;
}

/* ------------------------------------------------------------------ admin */
async function list({ api, db }) {
  const [snap, staff] = await Promise.all([db.collection("cleaners").get(), api.all("/staffs", "staffs").catch(() => null)]);
  const cleaners = snap.docs.map(d => ({ email: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return {
    cleaners,
    staffError: staff ? "" : "Couldn't read staff from Hostex",
    staff: (staff || []).map(s => ({ id: Number(s.id), name: s.name || "", mobile: s.mobile || "", active: s.is_active !== false })),
  };
}

async function save({ db, b, me }) {
  const email = lc(b.email);
  if (!EMAIL.test(email)) throw fail("invalid-argument", "Enter a valid email address.");
  const ref = db.doc("cleaners/" + email), cur = await ref.get(), old = cur.exists ? cur.data() : null;
  if (!old && (await db.doc("admins/" + email).get()).exists) throw fail("already-exists", "That email belongs to an admin. Use another email for the cleaner login.");
  const name = String(b.name ?? old?.name ?? "").trim().slice(0, 80);
  if (!name) throw fail("invalid-argument", "Enter the cleaner's name.");
  const staffId = b.staffId !== undefined ? (Number(b.staffId) || null) : old?.staffId ?? null;
  if (!staffId) throw fail("invalid-argument", "Choose their Hostex staff member, otherwise they won't see any jobs.");
  const rec = {
    name, staffId,
    phone: String(b.phone ?? old?.phone ?? "").replace(/[^\d+ ]/g, "").slice(0, 24),
    lang: ["id", "en"].includes(b.lang) ? b.lang : old?.lang || "id",
    active: b.active !== undefined ? !!b.active : old?.active ?? true,
    updatedAt: Timestamp.now(), by: me,
  };
  if (!old) rec.createdAt = Timestamp.now();
  await ref.set(rec, { merge: true });
  return { email, ...(old || {}), ...rec };
}

async function invited({ db, b }) {
  const ref = db.doc("cleaners/" + lc(b.email));
  if (!(await ref.get()).exists) throw fail("not-found", "Cleaner not found.");
  await ref.update({ invitedAt: Timestamp.now() });
  return { ok: true };
}

async function remove({ db, b }) {
  const ref = db.doc("cleaners/" + lc(b.email));
  if (!(await ref.get()).exists) throw fail("not-found", "Cleaner not found.");
  await ref.delete();
  return { ok: true };
}

/* ------------------------------------------------------------------ cleaner */
function requireActive(cl) {
  if (!cl || cl.active === false) throw fail("permission-denied", "Your cleaner login is switched off. Ask IndaVillas.");
  if (!cl.staffId) throw fail("failed-precondition", "Your login isn't linked to a Hostex staff member yet. Ask IndaVillas.");
}
const mine = (t, cl) => String(t.staff_id) === String(cl.staffId);

async function myTasks(api, cl, from, to) {
  const list = await api.all("/tasks", "tasks", { staff_id: cl.staffId, start_date: from, end_date: to });
  return list.filter(t => mine(t, cl) && t.status !== "cancelled");
}

async function jobs({ api, cl, now }) {
  requireActive(cl);
  const from = addDays(now, -3), to = addDays(now, 30);
  const [tasks, props] = await Promise.all([myTasks(api, cl, from, to), api.properties()]);
  const pids = [...new Set(tasks.map(t => Number(t.property_id)).filter(Boolean))];
  const res = pids.length ? liveTrimmed(await api.reservationsBetween(addDays(now, -60), addDays(to, 30))).filter(r => pids.includes(r.p)) : [];
  const prop = id => props.find(p => Number(p.id) === Number(id)) || {};
  const out = tasks.map(t => {
    const p = prop(t.property_id), pid = Number(t.property_id), date = t.expected_date;
    const stays = res.filter(r => r.p === pid).sort((a, b) => a.ci.localeCompare(b.ci));
    const leaving = stays.find(r => (t.stay_code && r.stay === t.stay_code) || r.co === date) || null;
    const next = stays.find(r => r.ci >= date && r !== leaving) || null;
    return {
      id: t.id, type: t.type, status: t.status, date, time: String(t.expected_time || "").slice(0, 5), note: t.note || "",
      pid, villa: p.title || "", address: p.address || "", lat: p.latitude ?? null, lng: p.longitude ?? null,
      checkout: p.default_checkout_time || "", checkin: p.default_checkin_time || "",
      leaving: leaving ? { guest: firstName(leaving.guest), guests: leaving.guests, nights: daysBetween(leaving.ci, leaving.co) } : null,
      next: next ? { date: next.ci, guest: firstName(next.guest), guests: next.guests, nights: daysBetween(next.ci, next.co) } : null,
      sameDay: !!next && next.ci === date,
    };
  }).sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));
  const villas = pids.map(id => ({ id, title: prop(id).title || "Villa " + id }));
  return { now, name: cl.name, lang: cl.lang || "id", jobs: out, villas };
}

async function update({ api, cl, b }) {
  requireActive(cl);
  const id = Number(b.id); if (!id) throw fail("invalid-argument", "Which job?");
  const found = api.firstArray(await api.hx("GET", "/tasks", { query: { id, offset: 0, limit: 1 } }))[0];
  if (!found || !mine(found, cl)) throw fail("permission-denied", "That job isn't assigned to you.");
  if (found.status === "cancelled") throw fail("failed-precondition", "This job was cancelled.");
  const patch = {};
  if (b.status) { if (!CLEANER_STATUSES.includes(b.status)) throw fail("invalid-argument", "Unknown status."); patch.status = b.status; }
  const text = String(b.note || "").trim();
  if (text) patch.note = ((found.note ? found.note + "\n" : "") + `[${firstName(cl.name)} ${stamp()}] ${text.slice(0, 400)}`).slice(-500);
  if (!Object.keys(patch).length) throw fail("invalid-argument", "Nothing to update.");
  await api.hx("PATCH", "/tasks/" + id, { body: patch });
  return { id, status: patch.status || found.status, note: patch.note ?? found.note ?? "" };
}

async function report({ api, db, cl, b, now }) {
  requireActive(cl);
  const pid = Number(b.pid), text = String(b.text || "").trim();
  if (text.length < 3) throw fail("invalid-argument", "Describe the problem.");
  const tasks = await myTasks(api, cl, addDays(now, -30), addDays(now, 60));
  if (!tasks.some(t => Number(t.property_id) === pid)) throw fail("permission-denied", "You can only report problems for villas you clean.");
  const urgent = !!b.urgent, note = `${urgent ? "URGENT · " : ""}Reported by ${cl.name}: ${text}`.slice(0, 500);
  const created = await api.hx("POST", "/tasks", { body: { type: "maintenance", expected_date: now, currency: "IDR", property_id: pid, note } });
  const villa = (await api.properties()).find(p => Number(p.id) === pid)?.title || "villa " + pid;
  const st = await getSettings(db);
  await notify(db, adminList(st), `${urgent ? "URGENT: " : ""}${villa} — problem reported by ${cl.name}`, [`${cl.name} reported a problem at ${villa}:`, text, "It's in Hostex as a maintenance task for today."], st);
  return { ok: true, id: created?.task?.id ?? created?.id ?? null };
}

module.exports = { getCleaner, list, save, invited, remove, jobs, update, report };
