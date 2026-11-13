/* Bot access: AI assistants (Grok, Claude, ChatGPT…) work with the portal through the MCP server in lib/mcp.js.
 *
 *   botkeys/{id}   { name, hash, last4, perms, write, allVillas, propertyIds, active, createdAt, updatedAt, by, lastUsedAt, calls, lastTool }
 *   mgrlog/bot:{id} { entries }   every change a bot made (same log format as villa managers)
 *
 * A key looks like ivb_<id>_<secret>. Only a SHA-256 of the secret is stored, so a key is shown once, when it's created
 * or renewed. Each key has its own villas and permissions; with "changes" off it can only read. A bot acts through the
 * villa-manager code (lib/managers.js) as a manager limited to its key's villas and permissions, so it gets the same
 * checks as a person: never below the owner's lowest rate, never opening nights under a booking, its own undo only.
 * Every change needs confirm: true; without it the tool only says what it would do, so the assistant asks the user first. */
const crypto = require("crypto");
const { Timestamp } = require("firebase-admin/firestore");
const { addDays, daysBetween, pool, clip } = require("./util");
const { LIVE } = require("./hostex");
const managers = require("./managers");
const revenue = require("./revenue");
const reviews = require("./reviews");

const fail = (code, msg) => Object.assign(new Error(msg), { code });
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, n) => String(v ?? "").trim().slice(0, n);

const PERMS = {
  analytics: "Figures: performance, pace, pricing suggestions, reviews waiting for a reply",
  owners: "Owners: names, emails and onboarding status",
  calendar: "Calendar: availability, and blocking and opening dates",
  prices: "Prices and minimum stay",
  bookings: "Bookings with guest contact details and notes",
  money: "Booking amounts, payouts and task fees",
  messages: "Guest messages: read, draft and send",
  tasks: "Tasks: cleaning and maintenance",
};
const DEFAULT_PERMS = { analytics: true, owners: false, calendar: true, prices: true, bookings: false, money: true, messages: false, tasks: true };
const permsOf = bot => Object.fromEntries(Object.keys(PERMS).map(k => [k, bot?.perms?.[k] != null ? !!bot.perms[k] : DEFAULT_PERMS[k]]));

/* ------------------------------------------------------------------ keys */
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const newId = () => crypto.randomBytes(6).toString("hex");
const newSecret = () => crypto.randomBytes(24).toString("base64url");
function parseKey(raw) {
  const m = String(raw || "").trim().match(/^ivb_([0-9a-f]{12})_([A-Za-z0-9_-]{20,64})$/);
  return m ? { id: m[1], secret: m[2] } : null;
}
async function verify(db, raw) {
  const k = parseKey(raw);
  if (!k) throw fail("unauthenticated", "Missing or malformed bot key. Create one on the portal's Bots page.");
  const s = await db.doc("botkeys/" + k.id).get();
  const a = Buffer.from(sha(k.secret), "hex"), b = Buffer.from(s.exists ? String(s.data().hash || "") : "", "hex");
  if (!s.exists || a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw fail("unauthenticated", "This bot key isn't valid. It may have been renewed or deleted.");
  const bot = { id: k.id, ...s.data() };
  if (bot.active === false) throw fail("permission-denied", "This bot key is switched off on the portal's Bots page.");
  return bot;
}
// short-term limit per key, per server instance: plenty for a chat, stops a runaway loop
const hits = new Map();
function rateLimit(id, now = Date.now()) {
  const a = (hits.get(id) || []).filter(t => now - t < 60000);
  if (a.length >= 60) throw fail("resource-exhausted", "Too many calls in the last minute. Wait a moment.");
  a.push(now); hits.set(id, a);
}
async function touch(db, bot, tool) {
  try { await db.doc("botkeys/" + bot.id).update({ lastUsedAt: Timestamp.now(), calls: (Number(bot.calls) || 0) + 1, lastTool: tool }); } catch (e) { /* never fail a call over stats */ }
}

/* ------------------------------------------------------------------ admin: Bots page */
const pub = (id, d) => ({ id, name: d.name || "", last4: d.last4 || "", perms: permsOf(d), write: !!d.write, allVillas: d.allVillas !== false, propertyIds: (d.propertyIds || []).map(Number),
  active: d.active !== false, createdAt: d.createdAt || null, updatedAt: d.updatedAt || null, lastUsedAt: d.lastUsedAt || null, calls: Number(d.calls) || 0, lastTool: d.lastTool || "", by: d.by || "" });
async function list({ api, db }) {
  const [snap, props] = await Promise.all([db.collection("botkeys").get(), api.properties().catch(() => null)]);
  const bots = snap.docs.map(d => pub(d.id, d.data())).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const logs = await Promise.all(bots.map(b => db.doc("mgrlog/bot:" + b.id).get().then(s => (s.exists ? s.data().entries || [] : []).slice(-40).reverse().map(x => ({ ...x, bot: b.name, botId: b.id }))).catch(() => [])));
  return { bots, perms: PERMS, defaults: DEFAULT_PERMS, villas: (props || []).map(p => ({ id: Number(p.id), title: p.title || "Villa " + p.id })), villasError: props ? "" : "Couldn't read villas from Hostex",
    log: logs.flat().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 80) };
}
function cleanBot(b, known) {
  const name = str(b.name, 60);
  if (!name) throw fail("invalid-argument", "Give the bot a name, e.g. Grok.");
  const allVillas = b.allVillas !== false, propertyIds = [...new Set((Array.isArray(b.propertyIds) ? b.propertyIds : []).map(Number).filter(Boolean))];
  if (!allVillas && !propertyIds.length) throw fail("invalid-argument", "Choose at least one villa, or all villas.");
  const bad = known ? propertyIds.filter(id => !known.includes(id)) : [];
  if (!allVillas && bad.length) throw fail("invalid-argument", `Villa ${bad.join(", ")} isn't in Hostex.`);
  const perms = Object.fromEntries(Object.keys(PERMS).map(k => [k, b.perms && b.perms[k] != null ? !!b.perms[k] : DEFAULT_PERMS[k]]));
  return { name, allVillas, propertyIds: allVillas ? [] : propertyIds, perms, write: !!b.write, active: b.active !== false };
}
async function save({ api, db, b, me }) {
  const props = await api.properties().catch(() => null), x = cleanBot(b.bot || {}, props && props.map(p => Number(p.id)));
  const id = str(b.bot?.id, 20);
  if (id) {
    const ref = db.doc("botkeys/" + id), s = await ref.get();
    if (!s.exists) throw fail("not-found", "That bot key doesn't exist any more.");
    await ref.update({ ...x, updatedAt: Timestamp.now(), by: me });
    return { bot: pub(id, { ...s.data(), ...x }) };
  }
  const nid = newId(), secret = newSecret(), key = `ivb_${nid}_${secret}`;
  const doc = { ...x, hash: sha(secret), last4: secret.slice(-4), createdAt: Timestamp.now(), updatedAt: Timestamp.now(), by: me, calls: 0 };
  await db.doc("botkeys/" + nid).set(doc);
  return { bot: pub(nid, doc), key };
}
// a new secret: the old key stops working at once
async function rotate({ db, b, me }) {
  const id = str(b.id, 20), ref = db.doc("botkeys/" + id), s = await ref.get();
  if (!id || !s.exists) throw fail("not-found", "That bot key doesn't exist any more.");
  const secret = newSecret();
  await ref.update({ hash: sha(secret), last4: secret.slice(-4), updatedAt: Timestamp.now(), by: me });
  return { bot: pub(id, { ...s.data(), last4: secret.slice(-4) }), key: `ivb_${id}_${secret}` };
}
async function remove({ db, b }) {
  const id = str(b.id, 20); if (!id) throw fail("invalid-argument", "Which bot?");
  await db.doc("botkeys/" + id).delete();
  return { ok: true };
}

/* ------------------------------------------------------------------ the bot as a villa manager */
const scopePids = (bot, props) => (bot.allVillas !== false ? props.map(p => Number(p.id)) : (bot.propertyIds || []).map(Number));
function asManager(bot, props) {
  const P = permsOf(bot);
  return { email: "bot:" + bot.id, name: bot.name || "Bot", active: bot.active !== false, propertyIds: scopePids(bot, props),
    perms: { calendar: P.calendar, prices: P.prices, bookings: P.bookings, money: P.money, messages: P.messages, tasks: P.tasks } };
}
function villaOf(ctx, id) {
  const pid = Number(id);
  if (!pid) throw fail("invalid-argument", "Give villa_id (a number from list_villas).");
  if (!ctx.pids.includes(pid)) throw fail("permission-denied", `Villa ${pid} isn't one this bot can reach. Use list_villas.`);
  const p = ctx.props.find(x => Number(x.id) === pid);
  if (!p) throw fail("not-found", `Villa ${pid} isn't in Hostex any more.`);
  return p;
}
function range(a, b, { from, max = 365 } = {}) {
  if (!ISO.test(a || "") || !ISO.test(b || "")) throw fail("invalid-argument", "Dates are YYYY-MM-DD, e.g. 2026-12-24.");
  if (b < a) throw fail("invalid-argument", "end is before start.");
  if (from && a < from) throw fail("invalid-argument", `Dates must be from today (${from}) onwards.`);
  if (daysBetween(a, b) > max) throw fail("invalid-argument", `That's more than ${max} nights.`);
  return daysBetween(a, b) + 1;
}
const nights = n => `${n} night${n === 1 ? "" : "s"}`;
const ON_CAL = [...LIVE, "wait_accept"];

/* ------------------------------------------------------------------ tools */
// perm: the key needs it to see the tool; any: one of these is enough; write: needs "changes" on and confirm: true
const S = (props, required = []) => ({ type: "object", properties: props, required, additionalProperties: false });
const VILLA = { type: "integer", description: "Villa id from list_villas" };
const DATE = d => ({ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: d });
const CONFIRM = { type: "boolean", description: "Leave out first: you get a preview of the change. Tell the user exactly what will change, and only if they agree call again with the same arguments and confirm: true." };

const TOOLS = [
  { name: "list_villas", title: "Villas", description: "The villas this bot can reach: id, name, channels, check-in/out times, and the owner when allowed. Start here; other tools take villa_id.",
    schema: S({}), run: async ctx => {
      const own = ctx.P.owners ? await revenue.clientsByProperty(ctx.db) : null;
      return { today: ctx.now, villas: ctx.props.filter(p => ctx.pids.includes(Number(p.id))).map(p => ({ ...managers.villaRow(p),
        ...(own ? { owner: (x => (x ? { name: x.data.ownerName || x.data.data?.ownerName || x.data.name || "", email: x.email } : null))(own.get(String(p.id))) } : {}) })) };
    } },
  { name: "portfolio_summary", title: "Portfolio summary", perm: "analytics",
    description: "Every reachable villa's headline figures from the daily sync: occupancy next 30 and 90 days, nights on the books vs same time last year (next 3 months), year forecast vs last year, open pricing suggestions.",
    schema: S({}), run: async ctx => {
      const r = await revenue.portfolio({ api: ctx.api, db: ctx.db, today: ctx.now, fresh: false });
      return { today: ctx.now, villas: r.villas.filter(v => ctx.pids.includes(Number(v.id))).map(({ client, ...v }) => (ctx.P.owners ? { ...v, client } : v)) };
    } },
  { name: "villa_report", title: "Villa revenue report", perm: "analytics",
    description: "Live revenue report for one villa: occupancy, booking pace by month vs last year, year forecast, the owner's lowest rate, open pricing suggestions (ids for apply_pricing_suggestion) and recent price changes (ids for undo_price_change).",
    schema: S({ villa_id: VILLA }, ["villa_id"]), run: async (ctx, a) => {
      const p = villaOf(ctx, a.villa_id), r = await revenue.liveVilla({ api: ctx.api, db: ctx.db, pid: p.id, today: ctx.now });
      return { villa: r.property, currency: r.currency, today: r.today, occupancyNext30: r.occ30, occupancyNext90: r.occ90,
        pace: { months: (r.pace?.months || []).slice(0, 6), year: r.pace?.year || null }, ownersLowestRate: r.cfg?.floor ?? null, pricingTool: r.pricingTool || "",
        channels: (r.listings || []).map(L => ({ label: L.label, currency: L.currency })),
        suggestions: (r.suggestions || []).filter(s => !s.applied).map(s => ({ id: s.id, type: s.type, title: s.title, why: s.why || s.reason || s.detail || "", from: s.dates?.[0], to: s.dates?.[s.dates.length - 1], nights: s.dates?.length || 0, percent: s.pct ?? null, minStay: s.minStay || null })),
        recentChanges: (r.history || []).slice(0, 10).map(h => ({ id: h.id, summary: h.summary, at: h.at, by: String(h.by || "").startsWith("bot:") ? "bot" : h.by ? "IndaVillas" : "", undone: !!h.undoneAt, canUndo: !!h.canUndo })),
        ...(ctx.P.owners && r.client ? { owner: r.client } : {}) };
    } },
  { name: "owner_performance", title: "Owner performance", perm: "analytics",
    description: "The owner's performance figures for a villa, as on their portal Performance page: last 12 months vs the 12 before (revenue, nights, occupancy, average nightly rate, RevPAN, lead time), this month, next 3 months on the books, revenue by channel and month by month.",
    schema: S({ villa_id: VILLA }, ["villa_id"]), run: async (ctx, a) => {
      const p = villaOf(ctx, a.villa_id), own = (await revenue.clientsByProperty(ctx.db)).get(String(p.id));
      if (!own) throw fail("not-found", `No owner in the portal is linked to ${p.title}.`);
      const other = (own.data.listingIds || []).map(Number).filter(x => !ctx.pids.includes(x));
      if (other.length) throw fail("permission-denied", "This owner's figures include villas this bot can't reach.");
      const s = await ctx.db.doc(`clients/${own.email}/analytics/summary`).get();
      if (!s.exists) throw fail("not-found", "No figures yet: they appear after the next daily sync.");
      const x = s.data(), names = ctx.P.bookings || ctx.P.calendar;
      return { villa: p.title, ...(ctx.P.owners ? { owner: own.email } : {}), currency: x.currency, syncedAt: x.syncedAt, kpi: x.kpi, channels: x.channels, leadBuckets: x.leadBuckets,
        months: (x.months || []).map(m => ({ month: m.m, revenue: Math.round(m.revenue), nights: m.nights, available: m.available, occupancy: m.available ? Math.round((m.nights / m.available) * 1000) / 10 : 0, future: !!m.future })),
        upcoming: (x.upcoming || []).map(u => (names ? u : { ...u, guest: "" })) };
    } },
  { name: "reviews_to_answer", title: "Reviews waiting for a reply", perm: "analytics",
    description: "Guest reviews from the last 180 days that have text and no reply yet, newest first (up to 30).",
    schema: S({ villa_id: { ...VILLA, description: "Optional: one villa" } }), run: async (ctx, a) => {
      const pids = a.villa_id ? [Number(villaOf(ctx, a.villa_id).id)] : ctx.pids;
      return { reviews: await reviews.pendingReplies({ api: ctx.api, pids, now: ctx.now }) };
    } },
  { name: "availability_calendar", title: "Availability calendar", perm: "calendar",
    description: "Six weeks of one villa from start (default today): each night open, blocked, booked or request, the nightly price per channel and minimum stay; plus the owner's lowest rate and recent price changes.",
    schema: S({ villa_id: VILLA, start: DATE("Optional first night, YYYY-MM-DD") }, ["villa_id"]),
    run: (ctx, a) => managers.calendar({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { pid: villaOf(ctx, a.villa_id).id, start: a.start }, now: ctx.now }) },
  { name: "bookings", title: "Bookings", any: ["bookings", "calendar"],
    description: "Bookings and booking requests at the reachable villas (or one villa) with check-in between from and to (default: 7 days ago to 60 days ahead). Guest contacts need the bookings permission; amounts need money.",
    schema: S({ villa_id: { ...VILLA, description: "Optional: one villa" }, from: DATE("Optional, YYYY-MM-DD"), to: DATE("Optional, YYYY-MM-DD"), include_cancelled: { type: "boolean" } }),
    run: async (ctx, a) => {
      const from = ISO.test(a.from || "") ? a.from : addDays(ctx.now, -7), to = ISO.test(a.to || "") ? a.to : addDays(ctx.now, 60);
      if (to < from || daysBetween(from, to) > 400) throw fail("invalid-argument", "Use a range of up to 400 days, from before to.");
      const pids = a.villa_id ? [Number(villaOf(ctx, a.villa_id).id)] : ctx.pids;
      const raw = (await pool(pids, 3, pid => ctx.api.reservationsBetween(from, to, { propertyId: pid }))).flat();
      const seen = new Map();
      for (const r of raw) if (pids.includes(Number(r.property_id)) && r.check_in_date >= from && r.check_in_date <= to && (a.include_cancelled || ON_CAL.includes(r.status))) seen.set(r.stay_code || r.reservation_code, r);
      return { from, to, bookings: [...seen.values()].map(r => managers.bookingRow(r, ctx.props, ctx.P.money)).map(x => (ctx.P.bookings ? x : { ...x, phone: "", email: "", lock: "", guide: "", remarks: "", channelRemarks: "" }))
        .sort((x, y) => x.ci.localeCompare(y.ci)) };
    } },
  { name: "tasks", title: "Tasks", perm: "tasks", description: "Cleaning, maintenance and other Hostex tasks at the reachable villas from 7 days ago to 30 days ahead, and the staff list (ids for create_task / update_task).",
    schema: S({}), run: ctx => managers.tasks({ api: ctx.api, mg: ctx.mg, now: ctx.now }) },
  { name: "guest_conversations", title: "Guest conversations", perm: "messages", description: "The latest guest conversations about the reachable villas (up to 30), newest first.",
    schema: S({}), run: ctx => managers.inboxList({ api: ctx.api, mg: ctx.mg }) },
  { name: "guest_conversation", title: "One guest conversation", perm: "messages", description: "All messages of one guest conversation and its booking.",
    schema: S({ conversation_id: { type: "string" } }, ["conversation_id"]), run: (ctx, a) => managers.inboxThread({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { id: a.conversation_id } }) },
  { name: "draft_guest_reply", title: "Draft a guest reply", perm: "messages", description: "A suggested reply to a guest conversation, written from the villa's facts. Nothing is sent.",
    schema: S({ conversation_id: { type: "string" }, instruction: { type: "string", description: "Optional: what the reply should say" } }, ["conversation_id"]),
    run: (ctx, a) => managers.inboxDraft({ api: ctx.api, db: ctx.db, mg: ctx.mg, key: ctx.key, b: { id: a.conversation_id, instruction: str(a.instruction, 400) } }) },
  { name: "owners", title: "Owners", perm: "owners", description: "Owners in the portal whose villas this bot can reach: name, email, villas, onboarding progress and whether portal access is on.",
    schema: S({}), run: async ctx => {
      const snap = await ctx.db.collection("clients").get();
      return { owners: snap.docs.map(d => ({ email: d.id, ...d.data() })).filter(c => c.pms === "hostex" && (c.listingIds || []).some(id => ctx.pids.includes(Number(id))))
        .map(c => ({ email: c.email, name: c.ownerName || c.data?.ownerName || c.name || "", villas: (c.listingIds || []).map(id => ctx.props.find(p => String(p.id) === String(id))?.title || "#" + id),
          onboardingProgress: c.progress ?? null, onboardingSent: !!c.submitted, portalAccess: !c.accessOff })) };
    } },

  /* ---- changes ---- */
  { name: "block_dates", title: "Block dates", perm: "calendar", write: true, destructive: false,
    description: "Close nights on every channel (owner stay, maintenance…). start and end are the first and last night.",
    schema: S({ villa_id: VILLA, start: DATE("First night"), end: DATE("Last night"), reason: { type: "string" }, confirm: CONFIRM }, ["villa_id", "start", "end"]),
    preview: (ctx, a) => { const p = villaOf(ctx, a.villa_id), n = range(a.start, a.end, { from: ctx.now }); return `Block ${p.title} for ${nights(n)}, ${a.start} → ${a.end} (last night), on every channel${a.reason ? ` — reason: ${str(a.reason, 120)}` : ""}.`; },
    run: (ctx, a) => managers.setAvailability({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { pid: villaOf(ctx, a.villa_id).id, start: a.start, end: a.end, available: false, note: str(a.reason, 120) }, now: ctx.now }) },
  { name: "open_dates", title: "Open dates", perm: "calendar", write: true,
    description: "Open blocked nights for booking on every channel. Refused if a booking sits on those nights.",
    schema: S({ villa_id: VILLA, start: DATE("First night"), end: DATE("Last night"), confirm: CONFIRM }, ["villa_id", "start", "end"]),
    preview: (ctx, a) => { const p = villaOf(ctx, a.villa_id), n = range(a.start, a.end, { from: ctx.now }); return `Open ${p.title} for ${nights(n)}, ${a.start} → ${a.end} (last night), for booking on every channel.`; },
    run: (ctx, a) => managers.setAvailability({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { pid: villaOf(ctx, a.villa_id).id, start: a.start, end: a.end, available: true }, now: ctx.now }) },
  { name: "change_prices", title: "Change prices", perm: "prices", write: true,
    description: "Set a nightly price (main channel currency; the other channels follow their usual ratio), or change prices by a percentage, and/or set the minimum stay, on open nights up to 90 days ahead. Never goes below the owner's lowest rate. Returns a change id for undo_price_change.",
    schema: S({ villa_id: VILLA, start: DATE("First night"), end: DATE("Last night"), nights: { type: "string", enum: ["all", "weekends", "weekdays"], description: "weekends = Fri and Sat nights" },
      price: { type: "number", exclusiveMinimum: 0 }, percent: { type: "number", minimum: -50, maximum: 50, description: "e.g. -10 for 10% lower" }, min_stay: { type: "integer", minimum: 1, maximum: 60 }, confirm: CONFIRM }, ["villa_id", "start", "end"]),
    preview: (ctx, a) => {
      const p = villaOf(ctx, a.villa_id), n = range(a.start, a.end, { from: ctx.now, max: 90 });
      if (a.price != null && a.percent != null) throw fail("invalid-argument", "Use either price or percent, not both.");
      if (a.price == null && a.percent == null && a.min_stay == null) throw fail("invalid-argument", "Give a price, a percent or a min_stay.");
      const what = [a.price != null ? `price ${a.price} a night` : "", a.percent != null ? `prices ${a.percent > 0 ? "+" : ""}${a.percent}%` : "", a.min_stay != null ? `minimum stay ${a.min_stay} nights` : ""].filter(Boolean).join(", ");
      return `${p.title}, ${a.start} → ${a.end} (${nights(n)}${a.nights && a.nights !== "all" ? `, ${a.nights} only` : ""}): ${what}. Only open nights change, on every channel, never below the owner's lowest rate.`;
    },
    run: (ctx, a) => managers.setPrice({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { pid: villaOf(ctx, a.villa_id).id, start: a.start, end: a.end, days: a.nights || "all", price: a.price ?? "", pct: a.percent ?? "", minStay: a.min_stay ?? "" }, now: ctx.now })
      .then(r => ({ ok: true, change_id: r.applied?.id || null, summary: r.applied?.summary || "", results: r.results })) },
  { name: "apply_pricing_suggestion", title: "Apply a pricing suggestion", perm: "prices", write: true, heavy: true,
    description: "Apply one of villa_report's open suggestions (gap fills, last-minute drops, pace changes). Returns a change id for undo_price_change.",
    schema: S({ villa_id: VILLA, suggestion_id: { type: "string" }, confirm: CONFIRM }, ["villa_id", "suggestion_id"]),
    preview: async (ctx, a) => {
      const p = villaOf(ctx, a.villa_id), r = await revenue.liveVilla({ api: ctx.api, db: ctx.db, pid: p.id, today: ctx.now }), s = (r.suggestions || []).find(x => x.id === a.suggestion_id && !x.applied);
      if (!s) throw fail("not-found", "That suggestion isn't open any more. Get villa_report again.");
      return `${p.title}: ${s.title}${s.dates?.length ? ` (${s.dates[0]} → ${s.dates[s.dates.length - 1]})` : ""}${s.pct != null ? `, ${s.pct > 0 ? "+" : ""}${s.pct}%` : ""}, on every channel, never below the owner's lowest rate.`;
    },
    run: async (ctx, a) => {
      const p = villaOf(ctx, a.villa_id);
      if (!ctx.mg.perms.prices) throw fail("permission-denied", "This bot key can't change prices.");
      const r = await revenue.apply({ api: ctx.api, db: ctx.db, me: ctx.mg.email, pid: Number(p.id), body: { id: a.suggestion_id }, today: ctx.now });
      await managers.log(ctx.db, ctx.mg, "Applied a pricing suggestion", p.id, p.title, r.applied?.summary || "");
      return { ok: true, change_id: r.applied?.id || null, summary: r.applied?.summary || "", results: r.results };
    } },
  { name: "undo_price_change", title: "Undo a price change", perm: "prices", write: true,
    description: "Put prices back as they were before a change this bot made (change_id from change_prices, apply_pricing_suggestion or villa_report).",
    schema: S({ villa_id: VILLA, change_id: { type: "string" }, confirm: CONFIRM }, ["villa_id", "change_id"]),
    preview: (ctx, a) => `${villaOf(ctx, a.villa_id).title}: undo price change ${a.change_id} and put the earlier prices back on every channel.`,
    run: (ctx, a) => managers.undoPrice({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { pid: villaOf(ctx, a.villa_id).id, id: a.change_id }, now: ctx.now }) },
  { name: "create_task", title: "Create a task", perm: "tasks", write: true,
    description: "Create a Hostex task (cleaning, maintenance…) at a villa, optionally assigned to a staff member (staff ids from tasks).",
    schema: S({ villa_id: VILLA, type: { type: "string", enum: ["cleaning", "maintenance", "reception", "room_service", "other"] }, date: DATE("YYYY-MM-DD"), time: { type: "string", pattern: "^\\d{1,2}:\\d{2}$" },
      staff_id: { type: "integer" }, note: { type: "string" }, booking_code: { type: "string" }, confirm: CONFIRM }, ["villa_id", "type", "date"]),
    preview: (ctx, a) => `${villaOf(ctx, a.villa_id).title}: new ${String(a.type || "").replace("_", " ")} task on ${a.date}${a.time ? " at " + a.time : ""}${a.staff_id ? `, assigned to staff #${a.staff_id}` : ""}${a.note ? ` — ${str(a.note, 120)}` : ""}.`,
    run: (ctx, a) => managers.createTask({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { pid: villaOf(ctx, a.villa_id).id, type: a.type, date: a.date, time: a.time, staffId: a.staff_id, note: a.note, stay: a.booking_code }, now: ctx.now }) },
  { name: "update_task", title: "Update a task", perm: "tasks", write: true,
    description: "Change a task's status, date, time, staff (0 = nobody), type or note.",
    schema: S({ task_id: { type: "integer" }, status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] }, date: DATE("YYYY-MM-DD"), time: { type: "string" },
      staff_id: { type: "integer" }, type: { type: "string", enum: ["cleaning", "maintenance", "reception", "room_service", "other"] }, note: { type: "string" }, confirm: CONFIRM }, ["task_id"]),
    preview: (ctx, a) => `Task ${a.task_id}: ${["status", "date", "time", "staff_id", "type", "note"].filter(k => a[k] !== undefined).map(k => `${k.replace("_id", "")} → ${a[k]}`).join(", ") || "nothing to change"}.`,
    run: (ctx, a) => managers.updateTask({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { id: a.task_id, status: a.status, date: a.date, time: a.time, staffId: a.staff_id, type: a.type, note: a.note }, now: ctx.now }) },
  { name: "send_guest_message", title: "Send a guest message", perm: "messages", write: true,
    description: "Send a message to the guest in a conversation, on the guest's booking channel.",
    schema: S({ conversation_id: { type: "string" }, message: { type: "string" }, confirm: CONFIRM }, ["conversation_id", "message"]),
    preview: (ctx, a) => { const m = String(a.message || "").trim(); if (!m) throw fail("invalid-argument", "Write the message."); return `Send this to the guest in conversation ${a.conversation_id}:\n\n${clip(m, 1500)}`; },
    run: (ctx, a) => managers.inboxSend({ api: ctx.api, db: ctx.db, mg: ctx.mg, b: { id: a.conversation_id, message: String(a.message || "").trim() } }) },
];

// tools a key can see: its permissions, and changes only when switched on
const allowed = (bot, t) => { const P = permsOf(bot); return (!t.perm || P[t.perm]) && (!t.any || t.any.some(k => P[k])) && (!t.write || !!bot.write); };
const toolsFor = bot => TOOLS.filter(t => allowed(bot, t));

async function call({ api, db, key, now, bot, name, args }) {
  const t = TOOLS.find(x => x.name === name);
  if (!t || !allowed(bot, t)) throw fail("not-found", `No tool ${name} for this bot key.`);
  rateLimit(bot.id);
  const props = await api.properties(), a = args && typeof args === "object" ? args : {};
  const ctx = { api, db, key, now, bot, P: permsOf(bot), props, pids: scopePids(bot, props).filter(id => props.some(p => Number(p.id) === id)), mg: asManager(bot, props) };
  await touch(db, bot, name);
  if (t.write && a.confirm !== true) {
    const preview = await t.preview(ctx, a);
    return { needs_confirmation: true, preview, next: "Show the user this preview and ask. Only if they agree, call this tool again with the same arguments plus confirm: true." };
  }
  if (t.write && !t.heavy) await t.preview(ctx, a); // the same checks as the preview before anything changes
  return t.run(ctx, a);
}

module.exports = { PERMS, DEFAULT_PERMS, permsOf, parseKey, verify, list, save, rotate, remove, TOOLS, toolsFor, call, _hits: hits };
