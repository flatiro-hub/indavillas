/* IndaVillas owner portal — Firebase Cloud Functions (Hostex).
 *
 *   hostexSyncNow     callable  "Sync with Hostex" button (admins)
 *   hostexSyncDaily   schedule  every morning 05:30 Bali: figures, pace, prices, reviews, suggestions, auto cleaning tasks, due invoices
 *   monthlyReports    schedule  2nd of each month 06:00 Bali: last month's owner reports (drafts, or published if set to automatic)
 *   portalApi         callable  everything else the portal page asks for (pricing, reviews, reports, invoices, turnovers, approvals, inbox, cleaners, managers)
 *   portalMcp         https     MCP server for AI assistants (Grok, Claude, ChatGPT…) with a bot key from the admin Bots page (lib/mcp.js, lib/bot.js)
 *
 * Secrets:  firebase functions:secrets:set HOSTEX_ACCESS_TOKEN
 *           firebase functions:secrets:set ANTHROPIC_API_KEY      (AI reply drafts + review summaries; enter "none" to leave AI off)
 * Deploy:   firebase deploy --only functions,firestore:rules
 *
 * Admins are the emails in Firestore admins/{email}, as before. Owners can only reach their own clients/{email} data.
 * Cleaners are the emails in cleaners/{email} (managed on the admin Cleaners page); they only reach their own Hostex tasks.
 * Villa managers are the emails in managers/{email} (admin Managers page); they run calendar, bookings, messages and tasks
 * for the villas assigned to them, checked on every call in lib/managers.js. */
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");

const { TZ, today } = require("./lib/util");
const { hostexClient } = require("./lib/hostex");
const { runSync, analytics, pricing } = require("./lib/sync");
const revenue = require("./lib/revenue");
const reviews = require("./lib/reviews");
const billing = require("./lib/billing");
const ops = require("./lib/ops");
const inbox = require("./lib/inbox");
const cleaners = require("./lib/cleaners");
const managers = require("./lib/managers");
const accounts = require("./lib/accounts");
const calendarLinks = require("./lib/calendarLinks");
const ownercal = require("./lib/ownercal");
const bot = require("./lib/bot");
const mcp = require("./lib/mcp");
const { aiOn, MODEL } = require("./lib/ai");
const { getSettings, DEFAULT_SETTINGS } = require("./lib/notify");

const REGION = "asia-southeast1"; // must match FUNCTIONS_REGION in the portal page
const HOSTEX_TOKEN = defineSecret("HOSTEX_ACCESS_TOKEN");
const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");
setGlobalOptions({ region: REGION });
if (!getApps().length) initializeApp();

const secret = s => { try { return s.value() || ""; } catch (e) { return ""; } };
const CODES = new Set(["invalid-argument", "failed-precondition", "out-of-range", "unauthenticated", "permission-denied", "not-found", "already-exists", "aborted", "resource-exhausted", "cancelled", "unavailable", "deadline-exceeded"]);
const toHttps = e => (e instanceof HttpsError ? e : new HttpsError(CODES.has(e.code) ? e.code : "internal", e.message || "Something went wrong"));
// Firestore Timestamps → ISO strings so the page gets plain JSON
const ser = v => (v && typeof v.toDate === "function" ? v.toDate().toISOString() : Array.isArray(v) ? v.map(ser) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)])) : v);

async function who(req, db) {
  const email = String(req.auth?.token?.email || "").toLowerCase();
  if (!email) throw new HttpsError("unauthenticated", "Sign in first.");
  const isAdmin = (await db.doc("admins/" + email).get()).exists;
  return { email, isAdmin };
}
async function clientPids(db, email) {
  const s = await db.doc("clients/" + email).get(); if (!s.exists) throw new HttpsError("not-found", "Client not found.");
  const d = s.data(); return { data: d, pids: d.pms === "hostex" ? (d.listingIds || []).map(Number) : [] };
}
const cleanSettings = b => { const out = {}; for (const k of Object.keys(DEFAULT_SETTINGS)) if (b[k] !== undefined && k !== "nextInvoiceNo") out[k] = typeof DEFAULT_SETTINGS[k] === "boolean" ? !!b[k] : typeof DEFAULT_SETTINGS[k] === "number" ? Math.max(0, Number(b[k]) || 0) : String(b[k]).slice(0, 1000); if (b.nextInvoiceNo != null && Number(b.nextInvoiceNo) >= 1) out.nextInvoiceNo = Math.floor(Number(b.nextInvoiceNo)); return out; };

/* ------------------------------------------------------------------ portalApi actions */
// owner: true → an owner may call it for their own email; everything else is admin-only
const ACTIONS = {
  "config.get": { fn: async ({ db, key }) => ({ ai: aiOn(key), model: MODEL, settings: await getSettings(db) }) },
  "settings.save": { fn: async ({ db, b }) => {
    const out = cleanSettings(b.settings || {}), cur = await getSettings(db);
    if (out.nextInvoiceNo != null && out.nextInvoiceNo <= (Number(cur.nextInvoiceNo) || 1)) delete out.nextInvoiceNo; // the counter only ever moves forward
    await db.doc("system/portal").set(out, { merge: true }); return getSettings(db); } },

  "revenue.portfolio": { fn: ({ api, db, now, b }) => revenue.portfolio({ api, db, today: now, fresh: !!b.fresh }) },
  "revenue.villa": { fn: ({ api, db, now, b }) => revenue.liveVilla({ api, db, pid: b.pid, today: now }) },
  "revenue.apply": { fn: ({ api, db, now, b, me }) => revenue.apply({ api, db, me, pid: b.pid, body: b, today: now }) },
  "revenue.undo": { fn: ({ api, db, now, b, me }) => revenue.undo({ api, db, me, pid: b.pid, id: b.id, today: now }) },
  "revenue.dismiss": { fn: ({ db, b }) => revenue.dismiss({ db, pid: b.pid, id: b.id, restore: !!b.restore }) },
  "revenue.settings": { fn: ({ db, b }) => revenue.saveSettings({ db, pid: b.pid, body: b.cfg || {} }) },

  "reviews.pending": { fn: async ({ api, db, now, b }) => { const { pids } = await clientPids(db, b.email); return reviews.pendingReplies({ api, pids, now }); } },
  "reviews.draft": { fn: async ({ db, key, b }) => { const { data } = await clientPids(db, b.email); return { draft: await reviews.draftReply({ key, review: b.review || {}, villa: data.villaName || data.data?.villaName || "the villa", knowledge: String(b.notes || "").slice(0, 1500) }) }; } },
  "reviews.reply": { fn: async ({ api, b }) => { const t = String(b.text || "").trim(); if (!t || !b.code) throw new HttpsError("invalid-argument", "Write the reply first."); await api.hx("POST", "/reviews/" + encodeURIComponent(b.code), { body: { host_reply_content: t.slice(0, 2000) } }); return { ok: true }; } },

  "billing.overview": { fn: ({ db, now }) => billing.overview({ db, now }) },
  "billing.get": { fn: async ({ db, b }) => { const s = await db.doc("billing/" + b.email).get(), bill = s.exists ? s.data() : null; return { billing: bill, suggested: bill ? billing.planLines(bill) : [], statements: await billing.listStatements({ db, email: b.email }), plans: billing.PLANS }; } },
  "billing.save": { fn: async ({ db, b }) => {
    const ref = db.doc("billing/" + b.email), old = (await ref.get()).data() || {}, x = billing.cleanBilling(b.billing || {});
    // the form doesn't know which one-off add-ons were invoiced already; keep that from the stored plan
    x.addons = x.addons.map(a => (a.cycle === "once" && (old.addons || []).some(o => o.cycle === "once" && o.billed && o.name === a.name && Number(o.amount) === Number(a.amount)) ? { ...a, billed: true } : a));
    for (const k of ["lastInvoice", "lastPlanPeriod"]) if (old[k]) x[k] = old[k];
    await ref.set(x); return { billing: x, suggested: billing.planLines(x) }; } },
  "billing.generate": { fn: ({ api, db, now, b, me }) => billing.generate({ api, db, email: b.email, month: b.month, me, now }) },
  "billing.commentary": { fn: ({ db, b }) => billing.saveCommentary({ db, email: b.email, month: b.month, commentary: b.commentary }) },
  "billing.publish": { fn: ({ db, b, me }) => billing.publish({ db, email: b.email, month: b.month, me }) },
  "billing.unpublish": { fn: ({ db, b }) => billing.unpublish({ db, email: b.email, month: b.month }) },
  "billing.invoice": { fn: ({ db, b, me }) => billing.createInvoice({ db, email: b.email, body: b, me, fromPlan: !!b.fromPlan }) },

  "ops.board": { fn: ({ api, db, now, b }) => ops.board({ api, db, now, days: Math.min(30, Math.max(3, Number(b.days) || 14)) }) },
  "ops.tasks": { fn: ({ api, b }) => ops.createTasks({ api, items: b.items || [] }) },
  "ops.villa": { fn: ({ db, b }) => ops.saveVilla({ db, pid: b.pid, body: b }) },

  "approvals.all": { fn: ({ db }) => ops.listAllApprovals({ db }) },
  "approvals.create": { fn: ({ db, b, me }) => ops.createApproval({ db, email: b.email, body: b, me }) },
  "approvals.update": { fn: ({ db, b, me }) => ops.updateApproval({ db, email: b.email, id: b.id, body: b, me }) },
  "approvals.list": { owner: true, fn: ({ db, b }) => ops.listApprovals({ db, email: b.email }) },
  "approvals.decide": { owner: true, fn: ({ db, b, me, isAdmin }) => ops.decide({ db, email: b.email, id: b.id, decision: b.decision, note: b.note, me, asAdmin: isAdmin && me !== b.email }) },

  "inbox.list": { fn: ({ api }) => inbox.list({ api }) },
  "inbox.thread": { fn: ({ api, db, b }) => inbox.thread({ api, db, id: b.id }) },
  "inbox.draft": { fn: ({ api, db, key, b }) => inbox.draft({ api, db, key, id: b.id, instruction: b.instruction }) },
  "inbox.send": { fn: ({ api, db, b, me }) => inbox.send({ api, db, id: b.id, message: b.message, me, ai: !!b.ai }) },

  // cleaners: admins manage the logins, each cleaner only ever reaches their own Hostex tasks
  "cleaners.list": { fn: ({ api, db }) => cleaners.list({ api, db }) },
  "cleaners.save": { fn: ({ db, b, me }) => cleaners.save({ db, b: b.cleaner || {}, me }) },
  "cleaners.invited": { fn: ({ db, b }) => cleaners.invited({ db, b }) },
  "cleaners.remove": { fn: ({ db, b }) => cleaners.remove({ db, b }) },
  "cleaner.jobs": { cleaner: true, fn: ({ api, cl, now }) => cleaners.jobs({ api, cl, now }) },
  "cleaner.update": { cleaner: true, fn: ({ api, cl, b }) => cleaners.update({ api, cl, b }) },
  "cleaner.report": { cleaner: true, fn: ({ api, db, cl, b, now }) => cleaners.report({ api, db, cl, b, now }) },

  // villa managers: admins manage the logins; each manager only reaches the villas assigned to them (checked in lib/managers.js)
  // a new login email for an owner, manager, cleaner or admin: moves their records and files, keeps their password
  "users.changeEmail": { fn: ({ db, auth, bucket, b }) => accounts.changeEmail({ db, auth, bucket, b }) },
  "users.setAccess": { fn: ({ db, auth, b }) => accounts.setAccess({ db, auth, b }) },
  // availability calendar on the Performance page: owners for their own villas, admins for any client; prices admins only
  "cal.overview": { owner: true, fn: ({ api, db, b, now, isAdmin }) => ownercal.overview({ api, db, b, now, isAdmin }) },
  "cal.set": { owner: true, fn: ({ api, db, b, now, me, isAdmin }) => ownercal.setDates({ api, db, b, now, me, isAdmin }) },
  "cal.price": { fn: ({ api, db, b, now, me }) => ownercal.setPrice({ api, db, b, now, me }) },
  "callinks.list": { fn: ({ api, db }) => calendarLinks.list({ api, db }) },
  "callinks.save": { fn: ({ api, db, b, me }) => calendarLinks.save({ api, db, b, me }) },
  "callinks.remove": { fn: ({ db, b }) => calendarLinks.remove({ db, b }) },

  // bot keys for AI assistants (Bots page): which villas, which permissions, read-only or allowed to make changes
  "bots.list": { fn: ({ api, db }) => bot.list({ api, db }) },
  "bots.save": { fn: ({ api, db, b, me }) => bot.save({ api, db, b, me }) },
  "bots.rotate": { fn: ({ db, b, me }) => bot.rotate({ db, b, me }) },
  "bots.remove": { fn: ({ db, b }) => bot.remove({ db, b }) },

  "managers.list": { fn: ({ api, db }) => managers.list({ api, db }) },
  "managers.save": { fn: ({ api, db, b, me }) => managers.save({ api, db, b: b.manager || {}, me }) },
  "managers.invited": { fn: ({ db, auth, b }) => managers.invited({ db, auth, b }) },
  "managers.remove": { fn: ({ db, b }) => managers.remove({ db, b }) },
  "mgr.home": { manager: true, fn: managers.home },
  "mgr.calendar": { manager: true, fn: managers.calendar },
  "mgr.availability": { manager: true, fn: managers.setAvailability },
  "mgr.price": { manager: true, fn: managers.setPrice },
  "mgr.price.undo": { manager: true, fn: managers.undoPrice },
  "mgr.booking.create": { manager: true, fn: managers.createBooking },
  "mgr.booking.update": { manager: true, fn: managers.updateBooking },
  "mgr.booking.checkin": { manager: true, fn: managers.checkinDetails },
  "mgr.booking.stay": { manager: true, fn: managers.stayStatus },
  "mgr.booking.answer": { manager: true, fn: managers.answerRequest },
  "mgr.booking.cancel": { manager: true, fn: managers.cancelBooking },
  "mgr.inbox.list": { manager: true, fn: managers.inboxList },
  "mgr.inbox.thread": { manager: true, fn: managers.inboxThread },
  "mgr.inbox.draft": { manager: true, fn: managers.inboxDraft },
  "mgr.inbox.send": { manager: true, fn: managers.inboxSend },
  "mgr.tasks": { manager: true, fn: managers.tasks },
  "mgr.task.create": { manager: true, fn: managers.createTask },
  "mgr.task.update": { manager: true, fn: managers.updateTask },
};

async function handle(req, deps = {}) {
  const db = deps.db || getFirestore(), { email, isAdmin } = await who(req, db), b = { ...(req.data || {}) }, a = ACTIONS[b.action];
  if (!a) throw new HttpsError("invalid-argument", "Unknown action.");
  let cl = null, mg = null;
  if (a.cleaner) {
    // cleaner actions run only for the signed-in cleaner's own login, even when an admin calls them
    cl = await cleaners.getCleaner(db, email);
    if (!cl) throw new HttpsError("permission-denied", "This email isn't set up as a cleaner. Ask IndaVillas.");
  } else if (a.manager) {
    // the same for managers: their own login, their own villas
    mg = await managers.getManager(db, email);
    if (!mg) throw new HttpsError("permission-denied", "This email isn't set up as a villa manager. Ask IndaVillas.");
    try { managers.checkLogin(mg, req.auth?.uid, req.auth?.token); } catch (e) { throw toHttps(e); }
  } else if (!isAdmin) {
    if (!a.owner) throw new HttpsError("permission-denied", "Only IndaVillas admins can do that.");
    b.email = email; // owners only ever reach their own record
  }
  if (b.email) b.email = String(b.email).toLowerCase();
  const ctx = { db, b, cl, mg, me: email, isAdmin, now: today(), key: deps.key ?? secret(ANTHROPIC_KEY), api: hostexClient(deps.token ?? secret(HOSTEX_TOKEN)), get auth() { return deps.auth || getAuth(); }, get bucket() { if (deps.bucket !== undefined) return deps.bucket; try { return getStorage().bucket(); } catch (e) { return null; } } };
  try { return ser(await a.fn(ctx)); } catch (e) { throw toHttps(e); }
}

/* ------------------------------------------------------------------ exports */
exports.portalApi = onCall({ secrets: [HOSTEX_TOKEN, ANTHROPIC_KEY], timeoutSeconds: 300, memory: "512MiB" }, req => handle(req));

// public cleaning calendar behind a secret link (portal/clean.html?k=...): dates, times and guest counts only
exports.cleanCalendar = onRequest({ secrets: [HOSTEX_TOKEN], cors: true, timeoutSeconds: 60, memory: "256MiB", maxInstances: 5 },
  (req, res) => calendarLinks.handleHttp(req, res, { db: getFirestore(), api: hostexClient(secret(HOSTEX_TOKEN)), now: today() }));

// MCP server for AI assistants; a bot key decides what it can see and change
exports.portalMcp = onRequest({ secrets: [HOSTEX_TOKEN, ANTHROPIC_KEY], cors: true, timeoutSeconds: 120, memory: "512MiB", maxInstances: 3 },
  (req, res) => mcp.handle(req, res, { db: getFirestore(), api: hostexClient(secret(HOSTEX_TOKEN)), key: secret(ANTHROPIC_KEY), now: today() }));

exports.hostexSyncNow = onCall({ secrets: [HOSTEX_TOKEN, ANTHROPIC_KEY], timeoutSeconds: 540, memory: "1GiB" }, async req => {
  const db = getFirestore(), { email, isAdmin } = await who(req, db);
  if (!isAdmin) throw new HttpsError("permission-denied", "Only IndaVillas admins can sync.");
  try { return ser(await runSync({ db, token: secret(HOSTEX_TOKEN), aiKey: secret(ANTHROPIC_KEY), by: email })); } catch (e) { throw toHttps(e); }
});
exports.hostexSyncDaily = onSchedule({ schedule: "every day 05:30", timeZone: TZ, secrets: [HOSTEX_TOKEN, ANTHROPIC_KEY], timeoutSeconds: 540, memory: "1GiB" },
  async () => { await runSync({ db: getFirestore(), token: secret(HOSTEX_TOKEN), aiKey: secret(ANTHROPIC_KEY), by: "schedule" }); });
exports.monthlyReports = onSchedule({ schedule: "0 6 2 * *", timeZone: TZ, secrets: [HOSTEX_TOKEN], timeoutSeconds: 540, memory: "512MiB" },
  async () => { const db = getFirestore(); const r = await billing.monthlyRun({ api: hostexClient(secret(HOSTEX_TOKEN)), db, now: today() }); await db.doc("system/monthlyReports").set({ ...r, at: new Date() }); });

if (process.env.HOSTEX_SYNC_TEST) module.exports._test = { runSync, analytics, pricing, hostexClient, handle, ACTIONS, billing, ops, inbox, reviews, revenue, cleaners, managers, accounts, calendarLinks, ownercal, bot, mcp }; // local tests only
