/* Operations: turnover board (check-outs, same-day flips, cleaning tasks in Hostex) and repair approvals.
 * ops/settings              { villas: { [propertyId]: { autoClean, staffId, time, fee, currency, level } } }
 * clients/{email}/approvals/{id}   repair requests owners approve or decline */
const { Timestamp } = require("firebase-admin/firestore");
const { addDays, daysBetween, firstName, uid, num } = require("./util");
const { chLabel, liveTrimmed } = require("./hostex");
const { getSettings, notify, adminList } = require("./notify");
const { clientsByProperty } = require("./revenue");

const fail = (code, msg) => Object.assign(new Error(msg), { code });
const hhmmss = t => { const m = String(t || "").match(/^(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, "0")}:${m[2]}:00` : "11:00:00"; };

/* ------------------------------------------------------------------ turnovers */
async function board({ api, db, now, days = 14, strict = false }) {
  const end = addDays(now, days); let tasksError = "";
  const [props, raw, tasks, staff, opsS, owners] = await Promise.all([
    api.properties(), api.reservationsBetween(addDays(now, -45), addDays(end, 30)),
    api.all("/tasks", "tasks", { start_date: addDays(now, -1), end_date: end }).catch(e => { if (strict) throw e; tasksError = e.message || "Couldn't read tasks"; return []; }), api.all("/staffs", "staffs").catch(() => []),
    db.doc("ops/settings").get(), clientsByProperty(db)]);
  const res = liveTrimmed(raw), cfg = (opsS.exists ? opsS.data() : {}).villas || {};
  const staffName = id => staff.find(s => String(s.id) === String(id))?.name || "";
  const rows = [];
  for (const p of props) {
    const mine = res.filter(r => r.p === Number(p.id)).sort((a, b) => a.ci.localeCompare(b.ci));
    for (const r of mine) {
      if (r.co < now || r.co > end) continue;
      const next = mine.find(x => x.ci >= r.co && x !== r);
      const task = tasks.find(t => t.type === "cleaning" && String(t.property_id) === String(p.id) && (t.stay_code && t.stay_code === r.stay || t.expected_date === r.co) && t.status !== "cancelled");
      rows.push({ pid: Number(p.id), villa: p.title, client: owners.get(String(p.id))?.email || "", date: r.co, time: p.default_checkout_time || "", stay: r.stay, code: r.code,
        guest: firstName(r.guest), channel: chLabel(r.ch), nights: daysBetween(r.ci, r.co), next: next ? { date: next.ci, guest: firstName(next.guest), guests: next.guests, nights: daysBetween(next.ci, next.co), time: p.default_checkin_time || "" } : null,
        sameDay: !!next && next.ci === r.co, gap: next ? daysBetween(r.co, next.ci) : null,
        task: task ? { id: task.id, status: task.status, staff: staffName(task.staff_id), staffId: task.staff_id || null, time: String(task.expected_time || "").slice(0, 5) } : null });
    }
  }
  const other = tasks.filter(t => t.type !== "cleaning" && t.status !== "cancelled" && t.status !== "completed").map(t => ({ id: t.id, type: t.type, status: t.status, date: t.expected_date, time: String(t.expected_time || "").slice(0, 5),
    villa: props.find(p => String(p.id) === String(t.property_id))?.title || "", staff: staffName(t.staff_id), note: t.note || "" }));
  return { now, days, tasksError, rows: rows.sort((a, b) => a.date.localeCompare(b.date) || a.villa.localeCompare(b.villa)), other, staff: staff.filter(s => s.is_active !== false).map(s => ({ id: s.id, name: s.name })),
    villas: props.map(p => ({ id: Number(p.id), title: p.title, checkout: p.default_checkout_time || "", ...(cfg[p.id] || {}) })) };
}
async function createTasks({ api, items, defaults = {} }) {
  const out = [];
  for (const it of items.slice(0, 50)) {
    const d = { ...defaults, ...it };
    const body = { type: "cleaning", expected_date: d.date, expected_time: hhmmss(d.time), currency: d.currency || "IDR", level: d.level || "standard", property_id: Number(d.pid) };
    if (d.stay) body.stay_code = d.stay; if (d.staffId) body.staff_id = Number(d.staffId); if (num(d.fee) != null) body.fee = num(d.fee); if (d.note) body.note = String(d.note).slice(0, 500);
    try { const r = await api.hx("POST", "/tasks", { body }); out.push({ ok: true, pid: d.pid, date: d.date, id: r?.task?.id ?? r?.id ?? null }); }
    catch (e) { out.push({ ok: false, pid: d.pid, date: d.date, error: e.message }); }
  }
  return out;
}
async function saveVilla({ db, pid, body }) {
  const ref = db.doc("ops/settings"), cur = (await ref.get()).data() || {}, villas = { ...(cur.villas || {}) };
  villas[pid] = { autoClean: !!body.autoClean, staffId: body.staffId ? Number(body.staffId) : null, time: /^\d{1,2}:\d{2}/.test(body.time || "") ? body.time.slice(0, 5) : "",
    fee: num(body.fee), currency: String(body.currency || "IDR").toUpperCase().slice(0, 3), level: ["standard", "simple", "advanced"].includes(body.level) ? body.level : "standard" };
  await ref.set({ villas }, { merge: true });
  return villas[pid];
}
// daily sync: create the missing cleaning tasks for the next 7 days on villas set to automatic
async function autoTasks({ api, db, now }) {
  const cfg = ((await db.doc("ops/settings").get()).data() || {}).villas || {};
  if (!Object.values(cfg).some(v => v.autoClean)) return { created: 0 };
  const b = await board({ api, db, now, days: 7, strict: true }); // if Hostex tasks can't be read, create nothing rather than duplicates
  const items = b.rows.filter(r => !r.task && cfg[r.pid]?.autoClean).map(r => { const v = cfg[r.pid]; return { pid: r.pid, date: r.date, stay: r.stay, staffId: v.staffId, time: v.time || r.time, fee: v.fee, currency: v.currency, level: v.level, note: `Turnover after ${r.guest || "guest"}${r.sameDay ? " — same-day check-in" : ""}` }; });
  const out = await createTasks({ api, items });
  return { created: out.filter(x => x.ok).length, failed: out.filter(x => !x.ok).length };
}

/* ------------------------------------------------------------------ repair approvals */
const STATUS = ["pending", "approved", "auto", "declined", "in_progress", "done", "cancelled"];
const iso = v => (v?.toDate ? v.toDate().toISOString() : v || null);
const out = (id, x) => ({ id, ...x, createdAt: iso(x.createdAt), decidedAt: iso(x.decidedAt), doneAt: iso(x.doneAt) });

// the owner's own limits from onboarding: approve without asking up to repairLimit (IDR), urgent guest issues up to emergencyLimit
function autoRule(onb, cost, currency, urgent) {
  if (currency !== "IDR" || cost == null) return null;
  const lim = onb.repairApproval === "Yes, up to a limit" ? num(onb.repairLimit) : null, em = num(onb.emergencyLimit);
  if (urgent && em && cost <= em) return `Within your urgent-issue limit of IDR ${em.toLocaleString("en-US")}`;
  if (lim && cost <= lim) return `Within your repair limit of IDR ${lim.toLocaleString("en-US")}`;
  return null;
}
async function createApproval({ db, email, body, me }) {
  const cs = await db.doc("clients/" + email).get(); if (!cs.exists) throw fail("not-found", "Client not found.");
  const c = cs.data(), title = String(body.title || "").trim().slice(0, 140); if (!title) throw fail("invalid-argument", "Describe the repair.");
  const cost = num(body.cost), currency = String(body.currency || "IDR").toUpperCase().slice(0, 3), urgent = body.urgency === "urgent";
  const rule = body.skipAuto ? null : autoRule(c.data || {}, cost, currency, urgent);
  const id = uid(), rec = { title, detail: String(body.detail || "").slice(0, 3000), cost, currency, urgency: urgent ? "urgent" : "normal", villa: c.villaName || c.data?.villaName || "",
    photos: (body.photos || []).slice(0, 8).map(p => ({ path: String(p.path || ""), name: String(p.name || "").slice(0, 120) })).filter(p => p.path.startsWith(`clients/${email}/`)),
    quoteFrom: String(body.quoteFrom || "").slice(0, 120), status: rule ? "auto" : "pending", rule: rule || "", createdAt: Timestamp.now(), createdBy: me, history: [{ at: new Date().toISOString(), by: me, what: rule ? "Created · approved under the owner's limit" : "Created · waiting for the owner" }] };
  await db.doc(`clients/${email}/approvals/${id}`).set(rec);
  const money = cost != null ? `${currency} ${cost.toLocaleString("en-US")}` : "cost to be confirmed";
  await notify(db, email, rule ? `Repair at ${rec.villa}: ${title}` : `Approval needed: ${title} (${money})`,
    [`Hi ${firstName(c.ownerName || c.name) || "there"},`, rule ? `We're going ahead with a repair at ${rec.villa}: ${title} (${money}). ${rule}, so no action is needed.` : `We'd like your approval for a repair at ${rec.villa}: ${title}, ${money}. Open the portal to approve or decline.`]);
  return out(id, rec);
}
async function listApprovals({ db, email }) {
  const q = await db.collection(`clients/${email}/approvals`).get();
  return q.docs.map(d => out(d.id, d.data())).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
async function listAllApprovals({ db }) {
  const rows = [];
  for (const c of (await db.collection("clients").get()).docs) for (const a of await listApprovals({ db, email: c.id })) rows.push({ ...a, email: c.id, villa: a.villa || c.data().villaName || "" });
  return rows.sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || String(b.createdAt).localeCompare(String(a.createdAt)));
}
async function decide({ db, email, id, decision, note, me, asAdmin }) {
  if (!["approved", "declined"].includes(decision)) throw fail("invalid-argument", "Choose approve or decline.");
  const ref = db.doc(`clients/${email}/approvals/${id}`), s = await ref.get(); if (!s.exists) throw fail("not-found", "Request not found.");
  const x = s.data(); if (x.status !== "pending") throw fail("failed-precondition", "This request has already been answered.");
  const hist = [...(x.history || []), { at: new Date().toISOString(), by: me, what: `${decision === "approved" ? "Approved" : "Declined"}${asAdmin ? " (recorded by IndaVillas)" : ""}${note ? ": " + String(note).slice(0, 500) : ""}` }];
  await ref.set({ status: decision, decidedAt: Timestamp.now(), decidedBy: me, decisionNote: String(note || "").slice(0, 1000), history: hist }, { merge: true });
  if (!asAdmin) { const st = await getSettings(db); await notify(db, adminList(st), `${x.villa}: owner ${decision} “${x.title}”`, [`${me} ${decision} the repair “${x.title}” at ${x.villa}.${note ? " Note: " + note : ""}`], st); }
  return out(id, { ...x, status: decision, decisionNote: note || "", history: hist });
}
async function updateApproval({ db, email, id, body, me }) {
  const ref = db.doc(`clients/${email}/approvals/${id}`), s = await ref.get(); if (!s.exists) throw fail("not-found", "Request not found.");
  const x = s.data(), patch = {}, what = [];
  if (body.status && STATUS.includes(body.status) && body.status !== x.status && ["in_progress", "done", "cancelled"].includes(body.status)) {
    patch.status = body.status; what.push({ in_progress: "Work started", done: "Marked done", cancelled: "Cancelled" }[body.status]); if (body.status === "done") patch.doneAt = Timestamp.now(); }
  if (body.finalCost !== undefined) { patch.finalCost = num(body.finalCost); if (patch.finalCost != null) what.push(`Final cost ${x.currency} ${patch.finalCost.toLocaleString("en-US")}`); }
  if (body.note) what.push(String(body.note).slice(0, 500));
  if (body.photos) patch.photos = [...(x.photos || []), ...body.photos.filter(p => String(p.path || "").startsWith(`clients/${email}/`)).map(p => ({ path: p.path, name: String(p.name || "").slice(0, 120) }))].slice(0, 12);
  if (!Object.keys(patch).length && !what.length) return out(id, x);
  patch.history = [...(x.history || []), { at: new Date().toISOString(), by: me, what: what.join(" · ") || "Updated" }];
  await ref.set(patch, { merge: true });
  return out(id, { ...x, ...patch });
}

module.exports = { board, createTasks, saveVilla, autoTasks, autoRule, createApproval, listApprovals, listAllApprovals, decide, updateApproval };
