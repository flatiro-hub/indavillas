/* ============================================================
   IndaVillas - Foundation landing page (/foundation/)
   The free snapshot works like flatiro.com/audit: /api/audit.php fetches the
   listing through Apify and the browser scores it with Flatiro's own engine
   (assets/js/engine/, copied unchanged from Flatiro's lib/), so a listing
   scores the same on both sites. Unlike Flatiro, WhatsApp + email are
   required, and every attempt is emailed to you as a lead via FormSubmit.
   Elements marked data-after appear once a report has rendered; data-before
   ones hide at that point.
   ============================================================ */

/* ---------- settings ---------- */
// Same inbox as every other IndaVillas form (assets/js/site.js).
const LEAD_ENDPOINT = "https://formsubmit.co/ajax/hi.flatiro@gmail.com";
// Stripe Payment Link for the $290 package (Stripe > Payment links > + New).
// While it is empty, every "Buy" button opens a short order form instead,
// which emails you the request so you can send a payment link by hand.
const CHECKOUT_URL = "https://buy.stripe.com/14A3cu7ph4L83Yh344gQE03";
// How many fixes the free snapshot shows. The rest are teased, not given
// away - the prioritised plan is what Foundation sells.
const FREE_FIXES = 2;

// The engine loads in the background; handlers await it. Its URLs carry this
// script's own ?v= build stamp so a rebuild busts the long-lived JS cache.
const V = new URL(import.meta.url).search;
const engine = Promise.all([import(`./engine/score.js${V}`), import(`./engine/scrape.js${V}`)])
  .then(([score, scrape]) => ({ ...score, ...scrape }));

/* ---------- elements ---------- */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const zone = $("#report");
const statusEl = $("#fd-status");
const manualWrap = $("#fd-manual");
const manualForm = $("#fd-manual-form");
const out = $("#fd-report");
const dialog = $("#fd-buy");
const snapForms = $$("form[data-snap]");

const state = { contact: null, report: null, lead: null, busy: false };

/* ---------- helpers ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// The engine's English copy was written for Flatiro's city flats; these swap
// its examples for villa ones without touching the shared engine files.
const VILLA_COPY = [
  ["Bright 2BR Old Town Flat, Balcony, 5 min to Centre", "Clifftop 5BR Villa, Infinity Pool, 5 min to Beach"],
  ["fast wifi, AC, a workspace, a balcony or parking", "a pool, the view, fast wifi, AC or a workspace"],
  ["the view, the balcony, the location", "the view, the pool, the location"],
];
// House style: no em or en dashes. The engine's English copy uses both.
const dash = s => VILLA_COPY.reduce((t, [a, b]) => t.split(a).join(b), String(s == null ? "" : s))
  .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
  .replace(/\s*[—–]\s*/g, " - ");
const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const plural = (n, one, many) => (n === 1 ? one : many);
const rand = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1));
const usd = n => "$" + Math.round(n).toLocaleString("en-US");

const LOCK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>';
const IMPACT = { high: "High impact", medium: "Medium", quick: "Quick win" };

const LOAD_MSGS = [
  "Fetching your listing…",
  "Counting photos and captions…",
  "Reading the description…",
  "Checking the amenity list…",
  "Benchmarking your reviews…",
  "Scoring booking settings…",
];
const ERRORS = {
  bad_url: "That does not look like an Airbnb or Booking.com listing link. Paste the full link, e.g. airbnb.com/rooms/12345678",
  scrape_unconfigured: "Automatic fetching is not switched on yet. Enter the details by hand and you still get the full score.",
  scrape_failed: "We could not fetch that listing. The platform may have blocked the request - try again, or enter the details by hand.",
  scrape_empty: "The fetch came back empty. The listing may be very new or hidden - enter the details by hand instead.",
  timeout: "The fetch timed out - the platform was slow to respond. Try again, or enter the details by hand.",
  method: "Something went wrong on our side. Try again, or enter the details by hand.",
  network: "Could not reach the audit service. Check your connection, try again, or enter the details by hand.",
  engine: "The page did not load completely. Refresh and try again.",
};

/* ---------- contact details: validate + keep every form in sync ---------- */
function errBox(form) {
  return form.querySelector(".snap__err") || form.parentElement.querySelector(".snap__err");
}
function showFormError(form, field, msg) {
  const box = errBox(form);
  if (box) { box.textContent = msg; box.hidden = false; }
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}
function clearFormError(form) {
  const box = errBox(form);
  if (box) { box.hidden = true; box.textContent = ""; }
  $$("[aria-invalid]", form).forEach(f => f.removeAttribute("aria-invalid"));
}
// WhatsApp numbers are checked against each country's real numbering plan
// (libphonenumber-js, vendored in assets/js/vendor/). A number written without
// a +country code is read as Indonesian, since most owners are in Bali; 00 works
// as +. A valid number is rewritten in international format, so the lead email
// always carries the country code. Until the library loads, 8+ digits will do.
const PHONE_COUNTRY = "ID";
let phoneLib = null;
import(`./vendor/libphonenumber-max.js${V}`).then(m => { phoneLib = m; }).catch(() => {});
function parseWhatsApp(v) {
  const raw = String(v || "").trim();
  if (!phoneLib) return raw.replace(/\D/g, "").length >= 8 ? raw : null;
  const p = phoneLib.parsePhoneNumberFromString(raw.replace(/^\s*00/, "+"), PHONE_COUNTRY);
  return p && p.isValid() ? p.formatInternational() : null;
}
const validWhatsApp = v => parseWhatsApp(v) !== null;
const WA_ERROR = "That doesn't look like a real WhatsApp number. Include the country code, for example +62 812 3456 7890.";
// Validates and, when valid, tidies the field in place.
function fixWhatsApp(input) {
  const ok = parseWhatsApp(input.value);
  if (ok) input.value = ok;
  return !!ok;
}
const validEmail = input => input.value.trim() !== "" && input.checkValidity();

function checkContact(form) {
  const f = form.elements;
  if (!f.whatsapp.value.trim()) {
    showFormError(form, f.whatsapp, "Add your WhatsApp number, with country code - that is where your snapshot goes.");
    return false;
  }
  if (!fixWhatsApp(f.whatsapp)) {
    showFormError(form, f.whatsapp, WA_ERROR);
    return false;
  }
  if (!validEmail(f.email)) {
    showFormError(form, f.email, "Add a valid email address.");
    return false;
  }
  return true;
}

function syncContact(c) {
  state.contact = { ...state.contact, ...c };
  const forms = [...snapForms, manualForm, $("form", dialog)].filter(Boolean);
  forms.forEach(form => {
    const f = form.elements;
    if (c.whatsapp && f.whatsapp) f.whatsapp.value = c.whatsapp;
    if (c.email && f.email) f.email.value = c.email;
    const urlField = f.url || f.listing_url;
    if (c.url && urlField) urlField.value = c.url;
  });
}

/* ---------- lead email ----------
   One email per attempt. It goes out once the audit settles, so it carries
   the score - or straight away if the visitor leaves while it is running. */
function queueLead(fields) {
  state.lead = { fields, sent: false };
}
function sendLead(extra, keepalive) {
  const lead = state.lead;
  if (!lead || lead.sent) return;
  lead.sent = true;
  postLead({ ...lead.fields, ...extra }, keepalive).catch(() => {});
}
function postLead(fields, keepalive) {
  if (fields._honey) return Promise.resolve(); // a bot filled the hidden field
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v != null && v !== "" && k !== "_honey") fd.append(k, String(v));
  });
  fd.append("_template", "table");
  fd.append("_captcha", "false");
  return fetch(LEAD_ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: fd,
    keepalive: !!keepalive,
  }).then(res => {
    if (!res.ok) throw new Error("lead " + res.status);
    return res;
  });
}
const LEFT_EARLY = { audit_status: "Visitor left before the audit finished" };
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") sendLead(LEFT_EARLY, true);
});
addEventListener("pagehide", () => sendLead(LEFT_EARLY, true));

function leadSummary(listing, report) {
  return {
    audit_status: "Completed",
    snapshot_score: `${report.score}/100 (grade ${report.grade})`,
    listing_title: listing.title || "",
    bedrooms: listing.bedrooms || "",
    location: [listing.location, listing.country].filter(Boolean).join(", "),
    fixes_found: report.fixes.length,
    top_fixes: report.fixes.slice(0, FREE_FIXES).map((f, i) => `${i + 1}) ${dash(f.text)}`).join("\n"),
  };
}

/* ---------- status panel ---------- */
let msgTimer = null;
function showLoading() {
  let i = 0;
  statusEl.className = "astatus astatus--busy";
  statusEl.hidden = false;
  statusEl.innerHTML = '<span class="astatus__spin" aria-hidden="true"></span>' +
    '<div><b id="fd-status-msg">' + LOAD_MSGS[0] + "</b>" +
    "<em>Usually 20-60 seconds. Worth the wait.</em></div>";
  clearInterval(msgTimer);
  msgTimer = setInterval(() => {
    i = (i + 1) % LOAD_MSGS.length;
    const el = $("#fd-status-msg");
    if (el) el.textContent = LOAD_MSGS[i];
  }, 3200);
}
function showError(code) {
  clearInterval(msgTimer);
  statusEl.className = "astatus astatus--error";
  statusEl.hidden = false;
  statusEl.innerHTML = "<div><b>We could not finish that</b><em>" + esc(ERRORS[code] || ERRORS.method) + "</em>" +
    '<span class="astatus__acts">' +
    '<button class="btn btn--outline btn--sm" type="button" data-retry>Try again</button> ' +
    '<button class="btn btn--primary btn--sm" type="button" data-open-manual>Enter details by hand</button>' +
    "</span>" +
    "<em>Your details came through - we will still be in touch with your snapshot.</em></div>";
}
function hideStatus() {
  clearInterval(msgTimer);
  statusEl.hidden = true;
  statusEl.innerHTML = "";
}

function openZone() {
  zone.hidden = false;
}
function resetReport() {
  out.hidden = true;
  out.innerHTML = "";
}

/* ---------- automatic: URL -> /api/audit.php -> normalize -> score ---------- */
let lastForm = null;

async function startAudit(form) {
  if (state.busy) return;
  clearFormError(form);
  const f = form.elements;
  let eng;
  try { eng = await engine; } catch (e) { showFormError(form, null, ERRORS.engine); return; }

  const url = eng.normalizeInputUrl(f.url.value);
  if (!url) { showFormError(form, f.url, "Paste your Airbnb or Booking.com listing link."); return; }
  if (!eng.isListingUrl(url)) { showFormError(form, f.url, ERRORS.bad_url); return; }
  if (!checkContact(form)) return;

  const contact = { url, whatsapp: f.whatsapp.value.trim(), email: f.email.value.trim() };
  f.url.value = url;
  syncContact(contact);
  lastForm = form;

  queueLead({
    _subject: "New Foundation snapshot - IndaVillas",
    _honey: f._honey ? f._honey.value : "",
    listing_url: url,
    whatsapp: contact.whatsapp,
    email: contact.email,
    form: form.dataset.snap === "final" ? "Final CTA" : "Hero",
  });

  setBusy(true);
  resetReport();
  manualWrap.hidden = true;
  openZone();
  showLoading();
  zone.scrollIntoView({ behavior: smooth(), block: "start" });

  try {
    const data = await fetchListing(url);
    const listing = eng.normalizeListing(data.item, data.url || url);
    const report = eng.scoreListing(listing, "en");
    const market = await fetchMarket(listing, placeOf(data.item, data.url || url, listing.location));
    hideStatus();
    render(listing, report, { market });
    sendLead({ ...leadSummary(listing, report), ...marketLead(market) });
  } catch (err) {
    const code = (err && err.code) || "network";
    showError(code);
    sendLead({ audit_status: "Audit failed (" + code + ")" });
  } finally {
    setBusy(false);
  }
}

function setBusy(on) {
  state.busy = on;
  snapForms.forEach(form => {
    const btn = $("button[type=submit]", form);
    if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
    btn.disabled = on;
    btn.innerHTML = on ? "Auditing…" : btn.dataset.label;
  });
}

async function fetchListing(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 140000);
  const fail = code => Object.assign(new Error(code), { code });
  try {
    const res = await fetch("/api/audit.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!data) throw fail("method");
    if (!data.ok || !data.item) throw fail(data.code || "method");
    return data;
  } catch (e) {
    if (e && e.name === "AbortError") throw fail("timeout");
    if (e && e.code) throw e;
    throw fail("network");
  } finally {
    clearTimeout(timer);
  }
}

snapForms.forEach(form => {
  form.addEventListener("submit", e => {
    e.preventDefault();
    startAudit(form);
  });
  form.addEventListener("input", () => clearFormError(form));
});

statusEl.addEventListener("click", e => {
  if (e.target.closest("[data-retry]") && lastForm) {
    hideStatus();
    lastForm.requestSubmit();
  }
});

/* ---------- manual mode ---------- */
function openManual() {
  const hero = snapForms[0];
  if (hero) {
    const h = hero.elements;
    syncContact({ whatsapp: h.whatsapp.value.trim(), email: h.email.value.trim(), url: h.url.value.trim() });
  }
  hideStatus();
  openZone();
  manualWrap.hidden = false;
  const f = manualForm.elements;
  const first = !validWhatsApp(f.whatsapp.value) ? f.whatsapp : !f.email.value.trim() ? f.email : f.title;
  manualWrap.scrollIntoView({ behavior: smooth(), block: "start" });
  first.focus({ preventScroll: true });
}

document.addEventListener("click", e => {
  if (e.target.closest("[data-open-manual]")) { e.preventDefault(); openManual(); }
});

manualForm.addEventListener("input", () => clearFormError(manualForm));
manualForm.addEventListener("submit", async e => {
  e.preventDefault();
  clearFormError(manualForm);
  const f = manualForm.elements;
  if (!checkContact(manualForm)) return;
  if (!f.title.value.trim()) { showFormError(manualForm, f.title, "Add your listing title - it is scored."); return; }
  if (!f.description.value.trim()) { showFormError(manualForm, f.description, "Paste your listing description - it is scored."); return; }

  let eng;
  try { eng = await engine; } catch (err) { showFormError(manualForm, null, ERRORS.engine); return; }

  const url = f.url.value.trim() ? eng.normalizeInputUrl(f.url.value) : "";
  const tri = v => (v === "yes" ? true : v === "no" ? false : null);
  const contact = { whatsapp: f.whatsapp.value.trim(), email: f.email.value.trim(), url };
  syncContact(contact);

  const listing = eng.normalizeManual({
    url,
    title: f.title.value,
    description: f.description.value,
    location: f.location.value,
    bedrooms: f.bedrooms.value,
    photoCount: f.photoCount.value,
    captions: tri(f.captions.value),
    amenitiesCount: f.amenitiesCount.value,
    rating: f.rating.value,
    reviewCount: f.reviewCount.value,
    superhost: tri(f.superhost.value),
    instantBook: tri(f.instantBook.value),
    minNights: f.minNights.value,
    cancellation: f.cancellation.value || "unknown",
  });
  const report = eng.scoreListing(listing, "en");

  queueLead({
    _subject: "New Foundation snapshot - IndaVillas",
    listing_url: url,
    whatsapp: contact.whatsapp,
    email: contact.email,
    form: "Manual entry",
  });
  const market = await fetchMarket(listing, placeOf(null, url, listing.location));
  hideStatus();
  manualWrap.hidden = true;
  render(listing, report, { market });
  sendLead({ ...leadSummary(listing, report), ...marketLead(market) });
});

/* ---------- the report ---------- */
// What the full audit adds, shown blurred behind the lock. Generic on purpose:
// these are not this listing's fixes, only the shape of what is withheld.
const DECOY_FIXES = [
  ["high", "Pricing", "Set your low-season rate against the comparable villas, then hold the weekend premium."],
  ["medium", "Booking setup", "Shorten the minimum stay on the gap nights between bookings."],
  ["medium", "Positioning", "Lead the listing with the guest type that books your villa most."],
  ["quick", "Amenities", "List the three amenities your competitors show and you do not."],
  ["high", "Photos", "Reorder the gallery so the first five photos sell the stay."],
];

/* ---------- the market: same-size AirDNA listings around the villa ----------
   api/market.php compares the villa with listings that have exactly the same
   number of bedrooms, nearest first (3 km, widened until there are 30). Only
   aggregates come back. The villa's own revenue stays locked on the page even
   when it is in the data: that is what Foundation sells. It goes into the lead
   email instead, so you see it before the call. */

// Where the villa is. The shared engine does not keep coordinates, so they are
// read from the raw scrape; a typed-in area falls back to its centre.
const AREAS = {
  uluwatu: [-8.8291, 115.0849], bingin: [-8.8065, 115.1138], pecatu: [-8.8137, 115.1166], balangan: [-8.7908, 115.1235],
  jimbaran: [-8.7768, 115.1715], "nusa dua": [-8.8007, 115.2317], ungasan: [-8.8296, 115.1626], canggu: [-8.6478, 115.1385],
  pererenan: [-8.6420, 115.1240], berawa: [-8.6626, 115.1415], seminyak: [-8.6913, 115.1683], kerobokan: [-8.6672, 115.1686],
  umalas: [-8.6650, 115.1574], legian: [-8.7046, 115.1690], kuta: [-8.7184, 115.1686], sanur: [-8.6935, 115.2620],
  ubud: [-8.5069, 115.2625], tabanan: [-8.5418, 115.1250], "nusa lembongan": [-8.6797, 115.4516], sidemen: [-8.4734, 115.4337],
  amed: [-8.3483, 115.6464], lovina: [-8.1580, 115.0260], dalung: [-8.6170, 115.1688], cemagi: [-8.6290, 115.1060], seseh: [-8.6345, 115.1123],
};
function placeOf(item, url, typedArea) {
  const it = item || {};
  const c = it.coordinates || it.location || it.geo || {};
  const lat = Number(c.latitude ?? c.lat ?? it.latitude ?? it.lat);
  const lng = Number(c.longitude ?? c.lng ?? c.lon ?? it.longitude ?? it.lng);
  const m = String(url || it.url || "").match(/airbnb\.[a-z.]+\/rooms\/(\d+)/i);
  const place = { lat: lat || null, lng: lng || null, id: m ? m[1] : "" };
  if (place.lat == null) {
    const key = Object.keys(AREAS).find(k => String(typedArea || "").toLowerCase().includes(k));
    if (key) [place.lat, place.lng] = AREAS[key];
  }
  return place;
}
async function fetchMarket(listing, place) {
  if (!listing.bedrooms) return null;
  try {
    const res = await fetch("/api/market.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beds: listing.bedrooms, lat: place.lat, lng: place.lng, id: place.id }),
    });
    const d = await res.json();
    return d && d.ok ? d : null;
  } catch (e) { return null; }
}
function marketLead(m) {
  if (!m) return { market: "No market data (no bedroom count, or too few comparable listings)" };
  const f = {
    market: `${m.n} x ${m.beds}-bedroom listings ${m.radiusKm ? "within " + m.radiusKm + " km" : "across Bali"} (AirDNA to ${m.dataTo})`,
    market_median_revenue: usd(m.market.revenue),
    market_top10_starts_at: usd(m.market.p90),
  };
  if (m.self) {
    f.villa_in_airdna = `Yes: ${usd(m.self.revenue)}/yr, ADR ${usd(m.self.adr)}, occupancy ${m.self.occupancy}%, ` +
      `beats ${m.self.percentile}% of the comp set (shown to the visitor as locked)`;
  }
  return f;
}

// What the villa lists, by the amenities AirDNA tracks plus the upgrades we price.
const HAS = {
  pool: /\bpool\b(?!\s*table)/i, ac: /air.?condition|\bAC\b/i, kitchen: /kitchen/i, gym: /\bgym\b|exercise equipment/i,
  hotTub: /hot tub|jacuzzi|whirlpool/i, parking: /parking/i, sauna: /sauna/i, coldPlunge: /cold plunge|ice bath/i,
  firePit: /fire pit/i, cinema: /theater|theatre|cinema|projector/i, games: /pool table|ping pong|table tennis|foosball|game room/i,
  bathtub: /bathtub/i,
};
const hasIt = (listing, key) => (Array.isArray(listing.amenities) ? listing.amenities.some(a => HAS[key].test(a)) : null);

// Upgrades the snapshot prices. Bali installed cost in USD, running cost a year,
// and a cautious yearly revenue lift in %: the same catalogue as the owner portal.
const UPGRADES = [
  { key: "games", name: "Table tennis or a pool table", cost: [1500, 4000], run: 100, lift: 1,
    why: "Groups book around what they will do together. A table by the pool covers every age for hours, with nothing to staff or supervise, and guests post it." },
  { key: "firePit", name: "Fire pit", cost: [800, 2500], run: 100, lift: 1,
    why: "Gives groups a reason to stay in on the nights they would otherwise go out. Cheap to build here, and it photographs beautifully at dusk." },
  { key: "coldPlunge", name: "Cold plunge / ice bath", cost: [2500, 6000], run: 600, lift: 2,
    why: "A tub with a 220-240V chiller. Next to a sauna it becomes the contrast-therapy corner wellness guests search for by name." },
  { key: "sauna", name: "Sauna", cost: [7000, 12000], run: 900, lift: 4,
    why: "A six-person cedar cabin with a 6-9 kW heater. A ready-made outdoor unit retails around Rp 120M in Indonesia." },
  { key: "hotTub", name: "Jacuzzi / hot tub", cost: [6000, 15000], run: 1200, lift: 5,
    why: "The soak after the beach that guests picture when they book a villa. It leads the photos and the search filters." },
  { key: "cinema", name: "Outdoor cinema", cost: [2000, 6000], run: 150, lift: 2,
    why: "A projector and a screen turn the garden into the evening plan, and families filter for it." },
  { key: "bathtub", name: "Bathtub in the main suite", cost: [1500, 3500], run: 50, lift: 1.5,
    why: "Couples and honeymooners filter for a bathtub. One in the main suite is enough." },
  { key: "gym", name: "Gym corner", cost: [3000, 8000], run: 300, lift: 2,
    why: "Longer stays and wellness groups want to train without leaving the villa." },
];
function upgradePlan(listing, base) {
  return UPGRADES.filter(u => hasIt(listing, u.key) !== true).map(u => {
    const net = base * (u.lift / 100) - u.run;
    const months = net > 0 ? ((u.cost[0] + u.cost[1]) / 2) / (net / 12) : null;
    const light = months != null && months <= 12 ? "green" : months != null && months <= 24 ? "amber" : "red";
    return { ...u, months, light };
  }).sort((a, b) => ({ green: 0, amber: 1, red: 2 }[a.light] - { green: 0, amber: 1, red: 2 }[b.light]) || (a.months ?? 1e9) - (b.months ?? 1e9));
}

// Urgency that is true: Bali's two peaks, counted down from today.
function nextPeak(now = new Date()) {
  const y = now.getFullYear(), d = (m, day, yy = y) => new Date(yy, m, day);
  const peaks = [[d(6, 1), d(8, 31), "July-August high season"], [d(11, 20), d(0, 6, y + 1), "Christmas and New Year peak"], [d(6, 1, y + 1), d(8, 31, y + 1), "July-August high season"]];
  for (const [start, end, name] of [[d(11, 20, y - 1), d(0, 6), "Christmas and New Year peak"], ...peaks]) {
    if (now >= start && now <= end) return { name, on: true };
    if (now < start) return { name, on: false, days: Math.ceil((start - now) / 864e5) };
  }
  return null;
}

const blur = v => `<span class="fd-blur">${v}</span>`;
const kUsd = n => "$" + Math.round(n / 1000) + "K";
const LIGHT = { green: "Pays back inside 12 months", amber: "Pays back within 24 months", red: "Takes longer than 24 months" };

function render(listing, report, opts = {}) {
  state.report = report;
  const m = opts.market || null;
  const pct = Math.max(0, Math.min(100, report.score));
  const tone = pct >= 76 ? "good" : pct >= 52 ? "mid" : "low";
  const fixes = report.fixes;
  const shown = fixes.slice(0, FREE_FIXES);
  const locked = fixes.length - shown.length;
  const short = 100 - pct;
  const beds = listing.bedrooms;
  const where = m ? (m.radiusKm ? `within ${m.radiusKm} km` : "across Bali") : "";
  const sizeLabel = beds ? `${beds}-bedroom` : "same-size";
  const prepared = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  /* 1. the header and three tiles */
  const head =
    `<header class="sn-head">` +
      `<div><span class="eyebrow">IndaVillas · Revenue snapshot</span>` +
      (opts.demo ? ' <span class="fd-demo">Sample report</span>' : "") +
      listingLine(listing) + `</div>` +
      `<span class="sn-date">Prepared ${esc(prepared)}</span>` +
    `</header>`;

  const tileMarket = m
    ? `<article class="sn-tile"><span class="sn-tile__k">Your market band</span>` +
        `<b class="sn-tile__v">${kUsd(m.market.revenue)}<i> median</i></b>` +
        `<p>Top 10% of ${esc(sizeLabel)} villas ${esc(where)} earn <b>${kUsd(m.market.p90)}+</b> a year.</p></article>`
    : `<article class="sn-tile"><span class="sn-tile__k">Your market band</span><b class="sn-tile__v">${LOCK_SVG}</b>` +
        `<p>Built for your villa in Foundation, from the listings competing for your guests.</p></article>`;
  const tileScore =
    `<article class="sn-tile sn-tile--${tone}"><span class="sn-tile__k">Listing quality</span>` +
      `<b class="sn-tile__v">${pct}<i> /100</i></b><p>Grade ${esc(report.grade)} · read from your public listing.</p></article>`;
  const tileComps =
    `<article class="sn-tile sn-tile--locked"><span class="sn-tile__k">Revenue vs comps</span>` +
      `<b class="sn-tile__v">${blur("??")}<i> /100</i></b>` +
      `<p>${m && m.self ? "We found your villa in our market data. Where it ranks is in your Foundation audit." : "Locked: it needs your rates and calendar, and the comp audit."}</p></article>`;

  /* 2. the listing score */
  const worst = report.categories.filter(c => c.possible).reduce((a, c) => (!a || c.possible - c.points > a.possible - a.points ? c : a), null);
  const cats = report.categories.map(c => {
    const checks = c.checks.map(ch => {
      if (ch.na) return `<li class="chk chk--na"><span>${esc(dash(ch.label))}</span><em>${esc(dash(ch.note))}</em><b>-</b></li>`;
      const st = ch.points === ch.possible ? "full" : ch.points === 0 ? "zero" : "part";
      return `<li class="chk chk--${st}"><span>${esc(dash(ch.label))}</span><em>${esc(dash(ch.note))}</em><b>${ch.points}/${ch.possible}</b></li>`;
    }).join("");
    const w = c.possible ? Math.round((c.points / c.possible) * 100) : 0;
    const flag = c === worst && c.points < c.possible ? '<span class="sn-flag">Biggest gap</span>' : "";
    return `<article class="acat${flag ? " acat--gap" : ""}"><header><h4>${esc(dash(c.label))}${flag}</h4><span class="acat__pts">${c.points}<i>/${c.possible}</i></span></header>` +
      `<span class="acat__bar"><i style="width:${w}%"></i></span><ul class="acat__checks">${checks}</ul></article>`;
  }).join("");
  const fixItem = f => `<li class="afix afix--${f.impact}"><div><p>${esc(dash(f.text))}</p>` +
    `<span class="afix__meta"><b>${IMPACT[f.impact] || ""}</b><em>${esc(dash(f.category))}</em><i>+${f.lost} pts</i></span></div></li>`;
  const fixesHtml = shown.length
    ? `<div class="afixes"><h3>Top ${shown.length} quick ${plural(shown.length, "fix", "fixes")}</h3><ul class="afix-list fd-fixes">${shown.map(fixItem).join("")}</ul></div>` : "";
  const lockHtml = locked > 0
    ? `<div class="fd-lock"><ul class="afix-list fd-lock__rows" aria-hidden="true">` +
        DECOY_FIXES.slice(0, Math.min(locked, 3)).map(([impact, cat, text]) => fixItem({ impact, category: cat, text, lost: rand(2, 9) })).join("") +
      `</ul><div class="fd-lock__over"><span class="fd-lock__ic">${LOCK_SVG}</span>` +
        `<b>${locked} more ${plural(locked, "fix", "fixes")}, ranked by revenue impact</b>` +
        `<span>Unlocked in your Foundation audit, with the order to tackle them in.</span></div></div>` : "";
  const warn = (report.warnings || []).map(w => `<p class="fd-warn">${esc(dash(w))}</p>`).join("");
  const scoreBlock =
    `<section class="sn-sec"><div class="sn-sec__head"><span class="eyebrow">Listing score</span>` +
      `<h3>${pct} of 100 points.</h3>` +
      (short > 0 ? `<p>${short} ${plural(short, "point", "points")} short, and all of them sit in your listing. None are in your pricing, your minimum-stay rules or your positioning.</p>` : "<p>Nothing to fix in what guests can see. The money is now in pricing and positioning.</p>") +
    `</div>${warn}<div class="acats">${cats}</div>${fixesHtml}${lockHtml}` +
    `<p class="sn-know"><b>Worth knowing:</b> you can score 100/100 and still be priced 20% below your market. That gap never shows up here.</p></section>`;

  /* 3. you vs the top 10% */
  let vsBlock = "";
  if (m) {
    const t = m.top;
    const st = (you, top, tol, higherIsBetter = true) => {
      if (you == null || top == null) return "";
      const d = higherIsBetter ? you - top : top - you;
      return d > tol ? "ahead" : d < -tol ? "behind" : "level";
    };
    const pill = s => (s ? `<span class="sn-pill sn-pill--${s}">${{ ahead: "Ahead", level: "Level", behind: "Behind" }[s]}</span>` : `<span class="sn-pill">In Foundation</span>`);
    const lockCell = `<span class="sn-lock">${LOCK_SVG} Locked</span>`;
    const nights = n => (n == null ? "-" : `${n} ${plural(n, "night", "nights")}`);
    const rows = [
      ["Guest rating", listing.rating != null ? listing.rating.toFixed(2) : "-", t.rating != null ? t.rating.toFixed(2) : "-", pill(st(listing.rating, t.rating, 0.02))],
      ["Reviews", listing.reviewCount ?? "-", t.reviews ?? "-", pill(st(listing.reviewCount, t.reviews, Math.max(2, (t.reviews || 0) * 0.1)))],
      ["Superhost", listing.isSuperhost == null ? "-" : listing.isSuperhost ? "Yes" : "No", `${t.superhostShare}% are`,
        pill(listing.isSuperhost == null ? "" : listing.isSuperhost ? "level" : t.superhostShare >= 50 ? "behind" : "level")],
      ["Photos", listing.photoCount ?? "-", "100+", pill(listing.photoCount == null ? "" : listing.photoCount >= 75 ? "level" : "behind")],
      ["Minimum stay", nights(listing.minNights), nights(t.minStay), pill(st(listing.minNights, t.minStay, 0, false))],
      ["Nightly rate", lockCell, usd(t.adr), pill("")],
      ["Occupancy", lockCell, `${Math.round(t.occupancy)}%`, pill("")],
      ["Yearly revenue", lockCell, usd(t.revenue), pill("")],
    ];
    const amen = [["Private pool", "pool"], ["Air conditioning", "ac"], ["Full kitchen", "kitchen"], ["Parking", "parking"], ["Gym", "gym"], ["Hot tub", "hotTub"]];
    const yes = '<span class="sn-yes" role="img" aria-label="Yes">✓</span>', no = '<span class="sn-no" role="img" aria-label="No">✕</span>';
    const amenRows = amen.map(([label, k]) => {
      const you = hasIt(listing, k);
      const share = m.amenities[k] ? m.amenities[k].top : null;
      return `<tr><th scope="row">${label}</th><td>${you == null ? "-" : you ? yes : no}</td><td><span class="sn-bar"><i style="width:${share || 0}%"></i></span><b>${share ?? "-"}%</b></td></tr>`;
    }).join("");
    vsBlock =
      `<section class="sn-sec"><div class="sn-sec__head"><span class="eyebrow">You vs the top 10%</span>` +
        `<h3>How you measure up against the best-earning ${esc(sizeLabel)} villas ${esc(where)}.</h3>` +
        `<p>Your figures are read from your public listing. The top 10% are the ${t.n} of ${m.n} ${esc(sizeLabel)} listings ${esc(where)} earning the most.</p></div>` +
      `<div class="sn-table-wrap"><table class="sn-table"><thead><tr><th scope="col">Factor</th><th scope="col">You</th><th scope="col">Top 10%</th><th scope="col">Where you stand</th></tr></thead>` +
        `<tbody>${rows.map(r => `<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></div>` +
      `<h4 class="sn-sub">Your amenities, you vs the top 10%</h4>` +
      `<div class="sn-table-wrap"><table class="sn-table sn-table--amen"><thead><tr><th scope="col">Amenity</th><th scope="col">You</th><th scope="col">Top 10% that have it</th></tr></thead>` +
        `<tbody>${amenRows}<tr class="sn-more"><th scope="row">Sauna, cold plunge, fire pit, cinema and 20 more</th><td colspan="2"><span class="sn-lock">${LOCK_SVG} In your Foundation audit</span></td></tr></tbody></table></div>` +
      `</section>`;
  }

  /* 4. the gap: the money, the season, the button */
  let gapBlock = "";
  if (m) {
    const gap = Math.max(0, m.market.p90 - m.market.revenue);
    const topAlready = m.self && m.self.percentile >= 90;
    const peak = nextPeak();
    const peakLine = !peak ? "" : peak.on
      ? `<p class="sn-urgent"><span>Bali's ${esc(peak.name)} is on now. Every week the listing stays as it is costs bookings at the highest rates of the year.</span></p>`
      : `<p class="sn-urgent"><span>Bali's ${esc(peak.name)} starts in <b>${peak.days} days</b>. Guests are booking those dates now, and they book the listings that look best today.</span></p>`;
    const scale = Math.max(m.market.p90, m.market.revenue) || 1;
    gapBlock =
      `<section class="sn-gap"><span class="eyebrow eyebrow--light">The market</span>` +
        (topAlready
          ? `<h3>You are already in the top 10% here. Staying there is the work.</h3><p>New villas open around you every month. The top 10% of ${esc(sizeLabel)} villas ${esc(where)} starts at ${usd(m.market.p90)} a year; Foundation shows what keeps you above it.</p>`
          : `<h3>Same size. Up to <span class="gold">${usd(gap)}</span> more a year.</h3><p>That is up to <b>${usd(gap / 12)} a month</b> between a typical ${esc(sizeLabel)} villa ${esc(where)} and the top 10%. Most of it is pricing, positioning and the listing, not the building.</p>`) +
        `<div class="sn-bars">` +
          `<div class="sn-bars__row"><span>Median ${esc(sizeLabel)} villa</span><span class="sn-bars__track"><i style="width:${Math.round((m.market.revenue / scale) * 100)}%"></i></span><b>${usd(m.market.revenue)}</b></div>` +
          `<div class="sn-bars__row sn-bars__row--top"><span>Top 10% start at</span><span class="sn-bars__track"><i style="width:100%"></i></span><b>${usd(m.market.p90)}</b></div>` +
        `</div>` + peakLine +
        `<div class="sn-gap__cta"><a class="btn btn--gold" href="#foundation" data-buy>Unlock Foundation - $290 <span class="arr" aria-hidden="true">&rarr;</span></a>` +
          `<span>One-time payment. 90-day money-back guarantee.</span></div>` +
        `<p class="sn-src">AirDNA, ${m.n} ${esc(sizeLabel)} listings ${esc(where)}, 12 months to ${esc(monthLabel(m.dataTo))}. Yearly revenue per listing, rounded.</p>` +
      `</section>`;
  }

  /* 5. what would pay for itself */
  const base = m ? (m.self ? m.self.revenue : m.market.revenue) : null;
  let roiBlock = "";
  if (base) {
    const plan = upgradePlan(listing, base);
    const count = k => plan.filter(p => p.light === k).length;
    const fig = (lo, hi) => `$${blur(rand(lo, hi).toLocaleString("en-US"))}`;
    const cards = plan.slice(0, 4).map(u =>
      `<article class="upg l-${u.light}"><header><span class="light" role="img" aria-label="${u.light} light"></span><h4>${esc(u.name)}</h4><span class="sn-chip">Missing</span></header>` +
        `<p class="upgv">${LIGHT[u.light]}</p><p class="upgw">${esc(u.why)}</p>` +
        `<dl class="upgn"><div><dt>Cost</dt><dd>${fig(1000, 9999)} to ${fig(1000, 9999)}</dd></div><div><dt>Extra revenue</dt><dd>${fig(1000, 9999)} / yr</dd></div>` +
        `<div><dt>Running cost</dt><dd>${fig(100, 999)} / yr</dd></div><div><dt>Comps with it</dt><dd>${blur(rand(10, 60))}%</dd></div></dl>` +
        `<p class="sn-fig">${LOCK_SVG} Figures in your Foundation audit</p></article>`).join("");
    roiBlock = plan.length
      ? `<section class="sn-sec"><div class="sn-sec__head"><span class="eyebrow">Amenity ROI</span><h3>What would pay for itself.</h3>` +
          (count("green") + count("amber")
            ? `<p>Features your villa is missing, priced for Bali and checked against comparable villas nearby.</p></div>`
            : `<p>Before you spend: at the revenue of a typical ${esc(sizeLabel)} villa ${esc(where)}, none of the usual upgrades pays back inside two years. At your villa, with your rates, one of them might. Foundation finds which, before you buy anything.</p></div>`) +
          `<div class="apsum">${["green", "amber", "red"].map(k => `<span class="apcount l-${k}"><i aria-hidden="true"></i><b>${count(k)}</b> ${k}</span>`).join("")}</div>` +
          `<div class="upgs">${cards}</div>` +
          `<p class="sn-know">Every number here is modelled for your villa: cost, running cost, added revenue and how many comparable villas already have it. The lights are free. The figures come with your Foundation audit.</p></section>`
      : "";
  }

  /* 6. the comp audit, 7. the room */
  const interior =
    `<section class="sn-sec sn-room"><div class="sn-sec__head"><span class="eyebrow">Interior design</span><h3>The cheapest revenue is already inside the room.</h3>` +
      `<p>A real client bedroom. Same room, same layout, same bed. Styling, artwork, rugs, lighting and textiles only, no building work.</p></div>` +
      `<div class="sn-ba"><figure><img src="/assets/img/styling-before.jpg" alt="A client villa bedroom before styling: bare walls and plain white bedding" width="920" height="690" loading="eager" fetchpriority="low" decoding="async"><figcaption>Before</figcaption></figure>` +
      `<figure><img src="/assets/img/styling-after.jpg" alt="The same bedroom after styling: gallery wall, layered rug, throw, lamp and styled shelving" width="920" height="690" loading="eager" fetchpriority="low" decoding="async"><figcaption>After</figcaption></figure></div>` +
      `<p class="sn-know">Interior suggestions are part of Foundation: what to change, what it costs, and what it should do to your photos and your rate.</p></section>`;

  out.innerHTML =
    head + `<div class="sn-tiles">${tileMarket}${tileScore}${tileComps}</div>` +
    scoreBlock + vsBlock + gapBlock + roiBlock + compsTease(listing, m) + interior;

  // The cover starts hidden and shows once it loads (a hotlinked platform
  // image can fail); no loading="lazy" - a hidden lazy image never loads.
  const cover = $(".fd-listing img", out);
  if (cover) {
    cover.addEventListener("load", () => { cover.hidden = false; }, { once: true });
    cover.addEventListener("error", () => cover.remove(), { once: true });
  }

  out.hidden = false;
  unlockPage();
  if (!opts.quiet) {
    out.scrollIntoView({ behavior: smooth(), block: "start" });
    out.focus({ preventScroll: true });
  }
}
const monthLabel = ym => { const [y, mo] = String(ym).split("-").map(Number); return y ? new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : ym; };

function listingLine(l) {
  if (!l.title && !l.url) return "";
  let href = "", label = "";
  if (l.url) {
    try {
      const u = new URL(l.url);
      href = u.href;
      label = u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
    } catch (e) { /* not a URL - leave the link out */ }
  }
  const meta = [l.bedrooms ? `${l.bedrooms} bedrooms` : "", l.location || "", l.country || ""].filter(Boolean).join(" · ");
  return `<div class="fd-listing">` +
    (l.coverPhoto ? `<img src="${esc(l.coverPhoto)}" alt="" width="64" height="64" referrerpolicy="no-referrer" hidden>` : "") +
    `<div>` +
      (l.title ? `<b>${esc(l.title)}</b>` : "") +
      (meta ? `<span>${esc(meta)}</span>` : "") +
      (href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : "") +
    `</div></div>`;
}

// The comp audit, teased. Only the digits are real-looking: they are decoys,
// re-randomised on every render so an unblurred value can never be read as a
// computed claim. The $ and % stay sharp so the rows read at a glance.
function compsTease(l, m) {
  const n = l.bedrooms ? `${l.bedrooms}-bedroom ` : "";
  const money = (lo, hi) => `<span class="fd-num"><i>$</i>${blur(rand(lo, hi).toLocaleString("en-US"))}</span>`;
  const pct = () => `<span class="fd-num">${blur(rand(38, 86))}<i>%</i></span>`;
  const nights = () => `<span class="fd-num">${blur(rand(1, 5))}<i>nights</i></span>`;
  const vs = (a, b) => `<span class="fd-cmp">${a}<i class="fd-vs">VS</i>${b}</span>`;
  const size = m ? `${m.n} ${n}listings ${m.radiusKm ? "within " + m.radiusKm + " km" : "across Bali"}` : "the properties competing for your guests";
  return `<section class="sn-sec"><div class="sn-sec__head"><span class="eyebrow">Still behind the glass</span>` +
      `<h3>What stays locked, we go through with you on the call.</h3>` +
      `<p>We bring the market and the model. You bring your rates, your calendar and your occupancy: the half that cannot be read from a public page.</p></div>` +
    `<div class="fd-tease">` +
      `<div class="fd-tease__head"><span class="eyebrow">Comp audit · in Foundation</span>` +
        `<h3>Your villa vs comparable ${esc(n)}villas</h3>` +
        `<p>Built from ${esc(size)}: we pick the ones genuinely competing for your guests.</p></div>` +
      `<div class="fd-tease__rows">` +
        `<div class="fd-tease__cols" aria-hidden="true"><span></span><span class="fd-cmp"><em>You</em><i class="fd-vs"></i><em>Comps</em></span></div>` +
        `<div class="fd-tease__row"><span>Nightly rate (ADR)</span>${vs(money(180, 900), money(180, 900))}</div>` +
        `<div class="fd-tease__row"><span>Occupancy</span>${vs(pct(), pct())}</div>` +
        `<div class="fd-tease__row"><span>Yearly revenue</span>${vs(money(40000, 260000), money(40000, 260000))}</div>` +
        `<div class="fd-tease__row"><span>Minimum stay</span>${vs(nights(), nights())}</div>` +
        `<div class="fd-tease__row"><span>Amenities your competitors list that you don't</span><span class="fd-cmp fd-cmp--one"><span class="fd-num">${blur(rand(4, 14))}</span></span></div>` +
      `</div>` +
    `</div></section>`;
}

/* ---------- after the report: the sales half of the page ---------- */
function unlockPage() {
  $$("[data-after]").forEach(el => {
    if (el.hidden) { el.hidden = false; el.classList.add("fd-in"); }
  });
  $$("[data-before]").forEach(el => { el.hidden = true; });
  // header, drawer and phone dock stop asking for the snapshot and start
  // selling Foundation
  $$(".header__cta .btn, .drawer__foot .btn, .dock .btn").forEach(btn => {
    btn.textContent = btn.closest(".header__cta") ? "Unlock Foundation" : "Unlock Foundation - $290";
    btn.setAttribute("href", "#foundation");
    btn.setAttribute("data-buy", "");
  });
}

/* ---------- buying ---------- */
const buyForm = dialog ? $("form", dialog) : null;
const buyDone = dialog ? $(".fd-dialog__done", dialog) : null;

function openBuy() {
  if (!dialog || typeof dialog.showModal !== "function") {
    location.href = "mailto:hi.flatiro@gmail.com?subject=" + encodeURIComponent("Foundation audit - $290");
    return;
  }
  buyForm.hidden = false;
  buyDone.hidden = true;
  clearFormError(buyForm);
  if (state.contact) syncContact(state.contact);
  dialog.showModal();
  const f = buyForm.elements;
  (!f.email.value ? f.email : !f.whatsapp.value ? f.whatsapp : $("button[type=submit]", buyForm)).focus();
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-buy]");
  if (!b) return;
  e.preventDefault();
  if (CHECKOUT_URL) {
    // Stripe Payment Links take the buyer's email, so the one given for the
    // snapshot is already filled in at checkout.
    const pay = new URL(CHECKOUT_URL);
    const email = state.contact && state.contact.email;
    if (email) pay.searchParams.set("prefilled_email", email);
    location.href = pay.href;
    return;
  }
  openBuy();
});

if (dialog) {
  dialog.addEventListener("click", e => {
    if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
  });
  buyForm.addEventListener("input", () => clearFormError(buyForm));
  buyForm.addEventListener("submit", e => {
    e.preventDefault();
    clearFormError(buyForm);
    const f = buyForm.elements;
    if (!validEmail(f.email)) { showFormError(buyForm, f.email, "Add a valid email address."); return; }
    if (!fixWhatsApp(f.whatsapp)) { showFormError(buyForm, f.whatsapp, f.whatsapp.value.trim() ? WA_ERROR : "Add your WhatsApp number, with country code."); return; }
    const btn = $("button[type=submit]", buyForm);
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending…";
    const r = state.report;
    postLead({
      _subject: "Foundation order request ($290) - IndaVillas",
      _honey: f._honey ? f._honey.value : "",
      email: f.email.value.trim(),
      whatsapp: f.whatsapp.value.trim(),
      listing_url: f.listing_url.value.trim(),
      snapshot_score: r ? `${r.score}/100 (grade ${r.grade})` : "No snapshot run",
      product: "Foundation - Airbnb Revenue Audit, $290 one-time",
    })
      .then(() => {
        syncContact({ email: f.email.value.trim(), whatsapp: f.whatsapp.value.trim() });
        buyForm.hidden = true;
        buyDone.hidden = false;
        $("[data-close]", buyDone).focus();
      })
      .catch(() => {
        showFormError(buyForm, null, "Could not send that just now. Try again, or email hi.flatiro@gmail.com.");
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = label;
      });
  });
}

/* ---------- "Get my free snapshot" links land in the hero form ---------- */
document.addEventListener("click", e => {
  if (!e.target.closest("[data-focus-snap]")) return;
  const field = $("#snap-url-hero");
  if (field) setTimeout(() => field.focus({ preventScroll: true }), 450);
});

/* ---------- sample report: /foundation/?demo=1 ---------- */
// Runs the real engine on a made-up villa so the full post-report page can be
// previewed without a scrape. No lead is sent.
if (new URLSearchParams(location.search).has("demo")) {
  engine.then(async eng => {
    const listing = eng.normalizeManual({
      url: "https://www.airbnb.com/rooms/12345678",
      title: "Villa Serenity",
      location: "Uluwatu",
      description: "Welcome to Villa Serenity, a beautiful villa for your holiday.\n\nThe villa has five bedrooms, a big living room and a garden. Our staff will take care of you during your stay.",
      photoCount: 38, captions: false, amenitiesCount: 31,
      rating: 4.78, reviewCount: 23, superhost: false, instantBook: false,
      minNights: 4, cancellation: "strict",
      coverPhoto: "/assets/img/villa-pool.jpg",
      bedrooms: 5, country: "Indonesia",
    });
    listing.amenities = ["Private outdoor pool", "Air conditioning", "Kitchen", "Free parking on premises", "Wifi", "Dedicated workspace"];
    const market = await fetchMarket(listing, placeOf(null, listing.url, listing.location));
    openZone();
    render(listing, eng.scoreListing(listing, "en"), { demo: true, quiet: true, market });
  });
}
