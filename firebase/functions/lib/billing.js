/* Monthly owner reports and IndaVillas fee invoices.
 * Draft reports:   clients/{email}/statements/{YYYY-MM}   (admin only, via the portalApi function)
 * Published:       clients/{email}/docs/st-YYYY-MM and inv-<number>   (the Documents tab owners already read)
 * Fee plans:       billing/{email}   (admin only)        Invoice counter + company details: system/portal */
require("./revenue-core");
const R = globalThis.RevenueCore;
const { Timestamp } = require("firebase-admin/firestore");
const { addDays, monthAdd, dim, monthEnd, firstName, clip, monthName, today: todayBali } = require("./util");
const { chLabel, liveTrimmed } = require("./hostex");
const { fetchReviews, parse } = require("./reviews");
const { getSettings, notify } = require("./notify");

const CYCLE_MONTHS = { monthly: 1, quarterly: 3, yearly: 12, once: 0 };
const PLANS = { Growth: 3999, Excellence: 7990 };

/* ------------------------------------------------------------------ report maths */
function monthFigures(res, ids, month, currency) {
  const units = Math.max(1, ids.length), available = dim(month) * units, a = month + "-01", b = addDays(monthEnd(month), 1);
  let nights = 0, revenue = 0, stays = 0; const bookings = [];
  for (const r of res) {
    if (!ids.includes(r.p) || r.co <= a || r.ci >= b) continue;
    const N = Math.max(1, Math.round((Date.parse(r.co) - Date.parse(r.ci)) / 864e5));
    let inM = 0; for (let d = r.ci; d < r.co; d = addDays(d, 1)) if (d >= a && d < b) inM++;
    if (!inM) continue;
    const ok = r.rv != null && (!currency || !r.cur || r.cur === currency), rev = ok ? (r.rv / N) * inM : 0;
    nights += inM; revenue += rev; if (r.ci >= a && r.ci < b) stays++;
    bookings.push({ p: r.p, checkIn: r.ci, checkOut: r.co, nights: N, nightsIn: inM, channel: chLabel(r.ch), guest: firstName(r.guest), guests: r.guests, revenue: Math.round(rev), cleaning: r.ci >= a && r.ci < b ? r.clean : null });
  }
  return { k: { revenue: Math.round(revenue), nights, available, occupancy: Math.round((nights / available) * 1000) / 10, adr: nights ? Math.round(revenue / nights) : 0, revpan: Math.round(revenue / available), stays },
    bookings: bookings.sort((x, y) => x.checkIn.localeCompare(y.checkIn)) };
}
const changeTitle = x => `${x.field}${x.from != null && x.to != null ? `: ${x.from} → ${x.to}${x.unit === "nights" ? " nights" : ""}` : ""}`;

function buildStatement({ month, client, props, res, pricingDoc, strategyDoc, reviews, approvals, now }) {
  const ids = (client.listingIds || []).map(Number), mine = props.filter(p => ids.includes(Number(p.id)));
  const cc = {}; for (const r of res) if (ids.includes(r.p) && r.cur) cc[r.cur] = (cc[r.cur] || 0) + 1;
  const onbCur = client.data?.data?.properties?.[0]?.currency || client.data?.data?.currency || client.data?.currency || "";
  const currency = Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0] || (/^[A-Z]{3}$/.test(onbCur) ? onbCur : "USD");
  const cur = monthFigures(res, ids, month, currency), ly = monthFigures(res, ids, monthAdd(month, -12), currency);
  const y = month.slice(0, 4); let ytd = 0, ytdLy = 0;
  for (let m = y + "-01"; m <= month; m = monthAdd(m, 1)) { ytd += monthFigures(res, ids, m, currency).k.revenue; ytdLy += monthFigures(res, ids, monthAdd(m, -12), currency).k.revenue; }
  const pace = R.pace(res, { today: now, pids: ids, currency, units: Math.max(1, ids.length) });
  const inMonth = d => String(d || "").startsWith(month);
  const revs = (reviews || []).filter(r => ids.includes(r.pid) && inMonth(r.date));
  const avg = revs.filter(r => r.score != null);
  const title = id => mine.find(p => Number(p.id) === Number(id))?.title || "";
  return {
    month, monthLabel: monthName(month), villaName: client.data?.data?.villaName || client.data?.villaName || mine.map(p => p.title).join(", "),
    villas: mine.map(p => ({ id: Number(p.id), title: p.title })), currency, owner: client.data?.data?.ownerName || client.data?.ownerName || "",
    kpi: cur.k, lastYear: ly.k.nights || ly.k.revenue ? ly.k : null, ytd: { revenue: ytd, lastYear: ytdLy || null, year: y },
    bookings: cur.bookings.map(b => ({ ...b, villa: mine.length > 1 ? title(b.p) : "" })),
    ahead: pace.months.slice(0, 3).map(x => ({ m: x.m, nights: x.otb.nights, revenue: x.otb.revenue, occ: x.occ, lyNights: x.stly.nights, status: x.status })),
    reviews: { n: revs.length, avg: avg.length ? Math.round((avg.reduce((s, r) => s + r.score, 0) / avg.length) * 10) / 10 : null,
      items: revs.slice(0, 8).map(r => ({ date: r.date, score: r.score, text: clip(r.text, 400), guest: r.guest, channel: r.channel })) },
    pricing: (pricingDoc?.changes || []).filter(x => inMonth(x.at)).slice(0, 12).map(x => ({ date: x.at, title: x.detail ? `${x.field} — ${x.detail}` : changeTitle(x), source: x.source })),
    work: (strategyDoc?.log || []).filter(x => inMonth(x.date)).map(x => ({ date: x.date, title: x.title, detail: x.detail || "" })),
    repairs: (approvals || []).filter(a => inMonth(a.createdAt) || inMonth(a.decidedAt) || inMonth(a.doneAt)).map(a => ({ title: a.title, cost: a.finalCost ?? a.cost, currency: a.currency, status: a.status })),
  };
}

/* ------------------------------------------------------------------ loading for one client */
async function statementData({ api, db, email, month, now }) {
  const cs = await db.doc("clients/" + email).get();
  if (!cs.exists) throw Object.assign(new Error("Client not found."), { code: "not-found" });
  const client = { email, data: cs.data() }; client.listingIds = client.data.pms === "hostex" ? client.data.listingIds || [] : [];
  if (!client.listingIds.length) throw Object.assign(new Error("Link this client to a Hostex villa first."), { code: "failed-precondition" });
  const props = await api.properties(), from = addDays(monthAdd(month, -12) + "-01", -60), to = monthEnd(monthAdd(now.slice(0, 7), 13));
  const raw = []; for (const pid of client.listingIds) raw.push(...(await api.reservationsBetween(from, to, { propertyId: pid })));
  const res = liveTrimmed(raw);
  const reviews = []; for (const pid of client.listingIds) { try { reviews.push(...(await fetchReviews(api, now, { propertyId: pid, back: 420 })).map(parse)); } catch (e) {} }
  const [pr, st, ap] = await Promise.all([db.doc(`clients/${email}/analytics/pricing`).get(), db.doc(`clients/${email}/strategy/main`).get(), db.collection(`clients/${email}/approvals`).get()]);
  const approvals = ap.docs.map(d => d.data());
  return buildStatement({ month, client: { ...client, listingIds: client.listingIds }, props, res, pricingDoc: pr.exists ? pr.data() : null, strategyDoc: st.exists ? st.data() : null, reviews, approvals, now });
}

async function generate({ api, db, email, month, me, now }) {
  const data = await statementData({ api, db, email, month, now });
  const ref = db.doc(`clients/${email}/statements/${month}`), old = await ref.get(), prev = old.exists ? old.data() : {};
  const rec = { month, status: prev.status === "published" ? "published" : "draft", data, commentary: prev.commentary || "", generatedAt: Timestamp.now(), generatedBy: me || "schedule",
    ...(prev.publishedAt ? { publishedAt: prev.publishedAt, publishedBy: prev.publishedBy || "" } : {}) };
  await ref.set(rec);
  if (rec.status === "published") await publish({ db, email, month, me });
  return { month, status: rec.status, data, commentary: rec.commentary };
}
async function saveCommentary({ db, email, month, commentary }) {
  const ref = db.doc(`clients/${email}/statements/${month}`);
  if (!(await ref.get()).exists) throw Object.assign(new Error("Generate the report first."), { code: "not-found" });
  await ref.set({ commentary: String(commentary || "").slice(0, 4000) }, { merge: true });
  return { ok: true };
}
async function publish({ db, email, month, me, settings }) {
  const ref = db.doc(`clients/${email}/statements/${month}`), s = await ref.get();
  if (!s.exists) throw Object.assign(new Error("Generate the report first."), { code: "not-found" });
  const st = s.data(), first = !st.publishedAt; // email the owner only the first time a month is published
  await db.doc(`clients/${email}/docs/st-${month}`).set({ type: "Monthly report", kind: "statement", generated: true, title: `Monthly report · ${st.data.monthLabel}`, period: month,
    fileName: `report-${month}.pdf`, size: 0, uploadedAt: Timestamp.now(), uploadedBy: me || "schedule", data: { ...st.data, commentary: st.commentary || "" } });
  await ref.set({ status: "published", publishedAt: st.publishedAt || Timestamp.now(), publishedBy: me || "schedule" }, { merge: true });
  if (first) { const cl = (await db.doc("clients/" + email).get()).data() || {};
    await notify(db, email, `Your ${st.data.monthLabel} report for ${st.data.villaName}`, [`Hi ${firstName(cl.ownerName || cl.name) || "there"},`, `Your monthly report for ${st.data.villaName} (${st.data.monthLabel}) is ready in the IndaVillas owner portal, under Documents.`], settings); }
  return { ok: true };
}
async function unpublish({ db, email, month }) {
  await db.doc(`clients/${email}/docs/st-${month}`).delete();
  await db.doc(`clients/${email}/statements/${month}`).set({ status: "draft" }, { merge: true });
  return { ok: true };
}
async function listStatements({ db, email }) {
  const q = await db.collection(`clients/${email}/statements`).get();
  return q.docs.map(d => { const x = d.data(); return { month: x.month, status: x.status, commentary: x.commentary || "", data: x.data, generatedAt: iso(x.generatedAt), publishedAt: iso(x.publishedAt) }; }).sort((a, b) => b.month.localeCompare(a.month));
}
const iso = v => (v?.toDate ? v.toDate().toISOString() : v || null);

/* ------------------------------------------------------------------ fee plans and invoices */
function cleanBilling(b) {
  const n = v => (v === "" || v == null || isNaN(Number(v)) ? null : Math.max(0, Number(v)));
  const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : null);
  return { plan: String(b.plan || "").slice(0, 40), fee: n(b.fee), currency: String(b.currency || "USD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "USD",
    cycle: CYCLE_MONTHS[b.cycle] != null ? b.cycle : "yearly", discountPct: Math.min(100, n(b.discountPct) || 0), startDate: date(b.startDate), nextInvoice: date(b.nextInvoice),
    addons: (Array.isArray(b.addons) ? b.addons : []).slice(0, 10).map(a => ({ name: String(a.name || "").slice(0, 80), amount: n(a.amount) || 0, cycle: a.cycle === "once" ? "once" : "monthly", ...(a.cycle === "once" && a.billed ? { billed: true } : {}) })).filter(a => a.name && a.amount),
    autoInvoice: !!b.autoInvoice, reports: b.reports !== false, autoPublishReports: !!b.autoPublishReports, notes: String(b.notes || "").slice(0, 1000) };
}
const cycleLabel = c => ({ monthly: "monthly", quarterly: "quarterly", yearly: "yearly", once: "one-off" }[c] || c);
function periodLabel(start, cycle) {
  const m = CYCLE_MONTHS[cycle]; if (!start || !m) return "";
  const end = addDays(new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1 + m, +start.slice(8, 10))).toISOString().slice(0, 10), -1);
  const f = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${f(start)} – ${f(end)}`;
}
// suggested invoice lines for the next plan invoice
function planLines(b) {
  const lines = [], m = CYCLE_MONTHS[b.cycle] ?? 12;
  if (b.fee) {
    const base = m ? (b.fee * m) / 12 : b.fee;
    lines.push({ desc: `IndaVillas ${b.plan || "management"} plan — ${cycleLabel(b.cycle)}${b.nextInvoice && m ? ` (${periodLabel(b.nextInvoice, b.cycle)})` : ""}`, qty: 1, unit: Math.round(base * 100) / 100 });
    if (b.discountPct) lines.push({ desc: `Additional villa discount ${b.discountPct}%`, qty: 1, unit: -Math.floor(base * b.discountPct) / 100 });
  }
  for (const a of (b.addons || []).filter(a => !(a.cycle === "once" && a.billed))) lines.push({ desc: a.name + (a.cycle === "monthly" && m > 1 ? ` (${m} months)` : ""), qty: a.cycle === "monthly" ? Math.max(1, m) : 1, unit: a.amount });
  return lines;
}
const advance = (d, cycle) => { const m = CYCLE_MONTHS[cycle]; if (!d || !m) return null; const x = new Date(d + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

async function nextNumber(db, st) {
  const ref = db.doc("system/portal");
  const n = await db.runTransaction(async t => { const s = await t.get(ref); const cur = Math.max(1, Number((s.exists ? s.data() : {}).nextInvoiceNo) || Number(st.nextInvoiceNo) || 1); t.set(ref, { nextInvoiceNo: cur + 1 }, { merge: true }); return cur; });
  return `${String(st.invoicePrefix || "IV").replace(/[^\w-]/g, "") || "IV"}-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`;
}
// a plan period is invoiced once: move nextInvoice on (and mark one-off add-ons billed) before the invoice is written
async function claimPlanPeriod(db, email, period) {
  const ref = db.doc("billing/" + email);
  return db.runTransaction(async t => {
    const s = await t.get(ref), b = s.exists ? s.data() : null;
    if (!b || !b.nextInvoice) throw Object.assign(new Error("This client has no plan with a next invoice date."), { code: "failed-precondition" });
    if (period && b.nextInvoice !== period) throw Object.assign(new Error(`The plan invoice for ${period} has already been made${b.lastInvoice ? ` (${b.lastInvoice})` : ""}. Refresh the page.`), { code: "already-exists" });
    const prev = { nextInvoice: b.nextInvoice, addons: b.addons || [] };
    t.set(ref, { ...b, nextInvoice: advance(b.nextInvoice, b.cycle), lastPlanPeriod: b.nextInvoice, addons: (b.addons || []).map(a => (a.cycle === "once" ? { ...a, billed: true } : a)) });
    return prev;
  });
}
async function createInvoice({ db, email, body, me, fromPlan }) {
  const st = await getSettings(db), cs = await db.doc("clients/" + email).get();
  if (!cs.exists) throw Object.assign(new Error("Client not found."), { code: "not-found" });
  const c = cs.data(), d = c.data || {};
  const lines = (body.lines || []).map(l => ({ desc: String(l.desc || "").slice(0, 200), qty: Number(l.qty) || 1, unit: Math.round(Number(l.unit) * 100) / 100 })).filter(l => l.desc && !isNaN(l.unit));
  if (!lines.length) throw Object.assign(new Error("Add at least one line."), { code: "invalid-argument" });
  const total = Math.round(lines.reduce((s, l) => s + l.qty * l.unit, 0) * 100) / 100;
  const currency = String(body.currency || st.defaultCurrency || "USD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "USD", date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : todayBali();
  let claimed = null;
  if (fromPlan) claimed = await claimPlanPeriod(db, email, body.planPeriod || null);
  const due = addDays(date, Number(body.dueDays ?? st.dueDays) || 14);
  let no, id;
  try {
  const data = { no: "", date, due, currency, lines, total, note: String(body.note || "").slice(0, 1000),
    from: { company: st.companyName, address: st.companyAddress, taxId: st.taxId, email: st.email, phone: st.phone },
    billTo: { name: d.companyName || d.ownerName || c.ownerName || c.name || email, contact: d.companyName ? d.ownerName || c.ownerName || "" : "", address: d.invoiceAddress || "", email, villa: d.villaName || c.villaName || "" },
    payTo: { bankName: st.bankName, bankHolder: st.bankHolder, bankAccount: st.bankAccount, bankSwift: st.bankSwift, note: st.paymentNote } };
  // create() never overwrites: if a number is somehow taken, take the next one
  for (let k = 0; ; k++) {
    no = await nextNumber(db, st); id = "inv-" + no.replace(/[^\w-]+/g, ""); data.no = no;
    try { await db.doc(`clients/${email}/docs/${id}`).create({ type: "Invoice", kind: "invoice", generated: true, title: `Invoice ${no}`, amount: total, currency, status: "Unpaid", period: body.period || date.slice(0, 7),
      fileName: `${no}.pdf`, size: 0, uploadedAt: Timestamp.now(), uploadedBy: me || "schedule", ...(claimed ? { planPeriod: claimed.nextInvoice } : {}), data }); break; }
    catch (e) { if (!(e.code === 6 || e.code === "already-exists" || /already exists/i.test(e.message || "")) || k >= 5) throw e; }
  }
  if (claimed) await db.doc("billing/" + email).set({ lastInvoice: no }, { merge: true });
  } catch (e) {
    if (claimed) await db.doc("billing/" + email).set({ nextInvoice: claimed.nextInvoice, addons: claimed.addons }, { merge: true }).catch(() => {}); // give the period back
    throw e;
  }
  await notify(db, email, `Invoice ${no} from ${st.companyName}`, [`Hi ${firstName(d.ownerName || c.ownerName) || "there"},`, `Invoice ${no} for ${currency} ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} is in your IndaVillas owner portal, under Documents. It's due on ${due}.`], st);
  return { id, no, total, currency };
}

// A file the admin uploaded by hand (report, invoice, other): tell the owner it's in Documents, like the ones the portal makes
async function notifyUpload({ db, email, id }) {
  const s = await db.doc(`clients/${email}/docs/${String(id || "")}`).get();
  if (!s.exists) throw Object.assign(new Error("That file isn't there any more."), { code: "not-found" });
  const x = s.data(), cl = (await db.doc("clients/" + email).get()).data() || {}, st = await getSettings(db);
  const villa = cl.villaName || cl.data?.villaName || cl.data?.data?.villaName || "your villa", hi = `Hi ${firstName(cl.ownerName || cl.name) || "there"},`;
  const period = /^\d{4}-\d{2}$/.test(x.period || "") ? monthName(x.period) : "";
  let subject, line;
  if (x.type === "Invoice") {
    const amt = x.amount != null && !isNaN(Number(x.amount)) ? ` for ${[x.currency, Number(x.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })].filter(Boolean).join(" ")}` : "";
    subject = `${x.title || "New invoice"} from ${st.companyName}`; line = `${x.title || "A new invoice"}${amt} is in your IndaVillas owner portal, under Documents.`;
  } else if (x.type === "Monthly report") {
    subject = `Your ${period ? period + " " : ""}report for ${villa}`; line = `Your ${period ? period + " " : ""}report for ${villa} is ready in the IndaVillas owner portal, under Documents.`;
  } else { subject = `New document from ${st.companyName}: ${x.title || x.fileName || "file"}`; line = `"${x.title || x.fileName || "A new file"}" is in your IndaVillas owner portal, under Documents.`; }
  return { sent: await notify(db, email, subject, [hi, line], st), emailEnabled: !!st.emailEnabled };
}

// Billing overview for every client: plan, next invoice, unpaid invoices, last report
async function overview({ db, now }) {
  const clients = (await db.collection("clients").get()).docs, out = [];
  for (const c of clients) {
    const d = c.data(), [b, docs, sts] = await Promise.all([db.doc("billing/" + c.id).get(), db.collection(`clients/${c.id}/docs`).get(), db.collection(`clients/${c.id}/statements`).get()]);
    const bill = b.exists ? b.data() : null, inv = docs.docs.map(x => x.data()).filter(x => x.type === "Invoice");
    const unpaid = inv.filter(x => x.status !== "Paid"), st = sts.docs.map(x => x.data()).sort((a, z) => z.month.localeCompare(a.month))[0];
    out.push({ email: c.id, villaName: d.villaName || d.data?.villaName || "", owner: d.ownerName || d.name || "", linked: d.pms === "hostex" && (d.listingIds || []).length > 0,
      billing: bill, due: !!(bill?.nextInvoice && bill.nextInvoice <= addDays(now, 7)), overdueInvoices: unpaid.filter(x => x.data?.due && x.data.due < now).length,
      unpaid: unpaid.length, unpaidTotal: unpaid.reduce((s, x) => s + (Number(x.amount) || 0), 0), unpaidCurrency: unpaid[0]?.currency || bill?.currency || "",
      lastReport: st ? { month: st.month, status: st.status } : null, suggested: bill ? planLines(bill) : [] });
  }
  return out.sort((a, z) => Number(z.due) - Number(a.due) || a.villaName.localeCompare(z.villaName));
}

// scheduled: 2nd of the month — last month's reports; daily — invoices that are due on auto plans
async function monthlyRun({ api, db, now, month }) {
  const st = await getSettings(db), done = [], errors = [];
  month = month || monthAdd(now.slice(0, 7), -1);
  for (const c of (await db.collection("clients").get()).docs) {
    const d = c.data(); if (d.pms !== "hostex" || !(d.listingIds || []).length) continue;
    const b = (await db.doc("billing/" + c.id).get()).data() || {};
    if (b.reports === false) continue;
    try { await generate({ api, db, email: c.id, month, me: "schedule", now }); if (b.autoPublishReports || st.autoReports) await publish({ db, email: c.id, month, me: "schedule", settings: st }); done.push(c.id); }
    catch (e) { errors.push(`${c.id}: ${e.message}`); }
  }
  return { month, reports: done.length, errors };
}
async function dueInvoices({ db, now }) {
  const made = [], errors = [];
  for (const b of (await db.collection("billing").get()).docs) {
    const x = b.data(); if (!x.autoInvoice || !x.nextInvoice || x.nextInvoice > now) continue;
    try { const r = await createInvoice({ db, email: b.id, body: { lines: planLines(x), currency: x.currency, period: x.nextInvoice.slice(0, 7), date: now, planPeriod: x.nextInvoice }, me: "schedule", fromPlan: true }); made.push(r.no); }
    catch (e) { errors.push(`${b.id}: ${e.message}`); }
  }
  return { invoices: made, errors };
}

module.exports = { PLANS, CYCLE_MONTHS, monthFigures, buildStatement, statementData, generate, saveCommentary, publish, unpublish, listStatements, cleanBilling, planLines, advance, createInvoice, notifyUpload, overview, monthlyRun, dueInvoices };
