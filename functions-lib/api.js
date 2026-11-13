/* The two server endpoints of indavillas.com, as Cloudflare Pages Functions.
 * Ported from api/audit.php and api/market.php (same requests, same answers), so the pages' scripts
 * work unchanged: functions/api/[[path]].js routes both /api/audit.php and /api/audit (and market).
 *
 *   POST /api/audit   { url }                      → the raw Airbnb / Booking listing via Apify
 *   POST /api/market  { lat, lng, beds, id? }      → how a villa compares with same-size listings nearby
 *
 * Settings (Cloudflare Pages → Settings → Variables and secrets):
 *   APIFY_TOKEN              Apify API token (secret). Without it the audit page asks for details by hand.
 *   APIFY_ACTOR_ID           optional, default tri_angle~airbnb-rooms-urls-scraper
 *   APIFY_BOOKING_ACTOR_ID   optional, default voyager~booking-scraper
 *   MARKET_KEY               key that unlocks the AirDNA dataset in functions-lib/market-data.js (secret)
 */
import MARKET from "./market-data.js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/* ------------------------------------------------------------------ audit */
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
// [isAirbnbListing, isBookingListing, isAppShareLink]
export function classify(u) {
  let x; try { x = new URL(u); } catch (e) { return [false, false, false]; }
  const host = x.hostname, path = x.pathname;
  const ab = /(^|\.)airbnb\./i.test(host), bk = /(^|\.)booking\.com$/i.test(host);
  return [ab && /\/(rooms|h|luxury)\//.test(path), bk && /^\/hotel\//i.test(path),
    /(^|\.)abnb\.me$/i.test(host) || (ab && /^\/l\//i.test(path)) || (bk && /^\/Share-/i.test(path))];
}
// app share links carry no listing id, only a redirect: follow it once
async function resolveShort(u, head) {
  try { const r = await fetch(u, { method: head ? "HEAD" : "GET", redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) }); return r.url || ""; } catch (e) { return ""; }
}
const ymd = t => new Date(t).toISOString().slice(0, 10);

export async function audit(request, env) {
  if (request.method !== "POST") return json(405, { ok: false, code: "method" });
  // no token yet is the normal state before set-up: the page then offers manual entry
  if (!env.APIFY_TOKEN) return json(503, { ok: false, code: "scrape_unconfigured" });
  let input = {}; try { input = await request.json(); } catch (e) { input = {}; }
  let url = String((input && input.url) || "").trim();
  let [isAirbnb, isBooking, isShort] = classify(url);
  if (!isAirbnb && !isBooking && isShort) {
    for (const head of [true, false]) { // HEAD first; some hosts only answer GET
      const resolved = await resolveShort(url, head);
      if (!resolved || resolved === url) continue;
      const [a2, b2] = classify(resolved);
      if (a2 || b2) { url = resolved; isAirbnb = a2; isBooking = b2; break; }
    }
  }
  if (!isAirbnb && !isBooking) return json(400, { ok: false, code: "bad_url" });
  const actor = isBooking ? env.APIFY_BOOKING_ACTOR_ID || "voyager~booking-scraper" : env.APIFY_ACTOR_ID || "tri_angle~airbnb-rooms-urls-scraper";
  const endpoint = `${env.APIFY_BASE || "https://api.apify.com"}/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_TOKEN)}&timeout=100`;
  // a sample stay ~60 days out: Airbnb only returns a price with dates, and the price drives the calculator
  const now = Date.now();
  const body = { startUrls: [{ url }], checkIn: ymd(now + 60 * 864e5), checkOut: ymd(now + 65 * 864e5), adults: 2, currency: "EUR", ...(isBooking ? { language: "en-us", maxItems: 1 } : {}) };
  let res;
  try { res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(115000) }); }
  catch (e) { return json(502, { ok: false, code: "scrape_failed", detail: String(e && e.message || e) }); }
  if (res.status >= 300) { console.warn("[audit] apify", res.status, (await res.text()).slice(0, 300)); return json(502, { ok: false, code: "scrape_failed", detail: "HTTP " + res.status }); }
  let items = null; try { items = await res.json(); } catch (e) { items = null; }
  const item = Array.isArray(items) ? items.find(it => it && typeof it === "object" && ("name" in it || "title" in it || "description" in it)) : null;
  if (!item) return json(502, { ok: false, code: "scrape_empty" });
  return json(200, { ok: true, item, url });
}

/* ------------------------------------------------------------------ market */
const MIN_COMPS = 30, RADII = [3, 5, 8, 12, 20, 40];
const [ID, LAT, LNG, BEDS, REV, ADR, OCC, DAYS, RATING, REVIEWS, SH, MIN, FLAGS] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const keys = new Map(), cache = new Map();
async function open(env, b64) {
  if (!keys.has(env.MARKET_KEY)) keys.set(env.MARKET_KEY, crypto.subtle.importKey("raw", Uint8Array.from(atob(env.MARKET_KEY), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"]));
  if (cache.has(b64)) return cache.get(b64);
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await keys.get(env.MARKET_KEY), bytes.slice(12));
  const v = JSON.parse(new TextDecoder().decode(plain));
  if (cache.size > 40) cache.clear();
  cache.set(b64, v);
  return v;
}
function km(a, b, c, d) {
  const r = Math.PI / 180, h = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
function quantile(vals, q) {
  if (!vals.length) return null;
  const s = [...vals].sort((x, y) => x - y), i = q * (s.length - 1), lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
const med = v => quantile(v, 0.5);
const col = (rows, i, positiveOnly) => rows.map(r => r[i]).filter(v => !positiveOnly || v > 0);
// PHP round(): half away from zero
const rnd = (v, d = 0) => { if (v === null) return null; const f = 10 ** d, x = Math.abs(v) * f; return Math.sign(v) * Math.round(x + 1e-9) / f; };
const r0 = v => (v === null ? null : rnd(v, 0)), r1 = v => (v === null ? null : rnd(v, 1)), r2 = v => (v === null ? null : rnd(v, 2));
const num = v => (v !== null && v !== "" && typeof v !== "boolean" && !Array.isArray(v) && isFinite(Number(v)) ? Number(v) : null);

export async function market(request, env) {
  if (request.method !== "POST") return json(405, { ok: false, code: "method" });
  let input; try { input = await request.json(); } catch (e) { input = null; }
  if (!input || typeof input !== "object") return json(400, { ok: false, code: "bad_input" });
  const beds = input.beds != null ? Math.trunc(Number(input.beds)) || 0 : 0;
  let lat = num(input.lat), lng = num(input.lng);
  const id = input.id != null ? String(input.id).replace(/[^0-9v]/g, "") : "";
  if (beds < 1 || beds > 30) return json(400, { ok: false, code: "no_bedrooms" });
  if (!env.MARKET_KEY) return json(503, { ok: false, code: "no_data" });
  let meta, rows;
  try { meta = await open(env, MARKET.meta); rows = MARKET.beds[beds] ? await open(env, MARKET.beds[beds]) : []; }
  catch (e) { console.warn("[market] can't open the dataset:", e && e.message); return json(503, { ok: false, code: "no_data" }); }

  let self = null;
  if (id) {
    self = rows.find(r => String(r[ID]) === id) || null;
    if (!self) { const idx = await open(env, MARKET.idx), b = idx[id]; if (b != null && MARKET.beds[b]) self = (await open(env, MARKET.beds[b])).find(r => String(r[ID]) === id) || null; }
  }
  // outside Bali, or no location: compare with every same-size listing on the island
  if ((lat === null || lng === null) && self) { lat = self[LAT]; lng = self[LNG]; }
  const inBali = lat !== null && lng !== null && lat > -9.0 && lat < -8.0 && lng > 114.4 && lng < 115.8;
  const same = rows.filter(r => r[BEDS] === beds && !(self && r[ID] === self[ID])).map(r => ({ r, d: inBali ? km(lat, lng, r[LAT], r[LNG]) : 0 }));
  let comps = same.map(x => x.r), radius = null;
  if (inBali) for (const k of RADII) { const within = same.filter(x => x.d <= k); if (within.length >= MIN_COMPS) { comps = within.map(x => x.r); radius = k; break; } }
  if (comps.length < 5) return json(200, { ok: false, code: "too_few", n: comps.length });

  const revs = col(comps, REV, true), p90 = quantile(revs, 0.9);
  const top = comps.filter(r => r[REV] >= (p90 ?? 0));
  const amenities = {};
  for (const [name, bit] of Object.entries(meta.flags)) {
    amenities[name] = { top: r0(100 * top.filter(r => r[FLAGS] & bit).length / top.length), all: r0(100 * comps.filter(r => r[FLAGS] & bit).length / comps.length) };
  }
  const shTop = top.reduce((s, r) => s + r[SH], 0);
  const profile = rs => ({ revenue: r0(med(col(rs, REV, true))), adr: r0(med(col(rs, ADR, true))), occupancy: r1(med(col(rs, OCC, true))), days: r0(med(col(rs, DAYS, true))),
    rating: r2(med(col(rs, RATING, true))), reviews: r0(med(col(rs, REVIEWS, false))), minStay: r0(med(col(rs, MIN, true))) });
  let selfOut = null;
  if (self) {
    const below = revs.filter(v => v < self[REV]).length;
    selfOut = { revenue: self[REV], adr: self[ADR], occupancy: self[OCC], days: self[DAYS], rating: self[RATING], reviews: self[REVIEWS], superhost: !!self[SH], minStay: self[MIN],
      flags: self[FLAGS], percentile: r0(100 * below / Math.max(1, revs.length)) };
  }
  return json(200, { ok: true, source: meta.source, dataTo: String(meta.newest).slice(0, 7), beds, n: comps.length, radiusKm: radius, area: inBali ? "near" : "bali",
    market: { ...profile(comps), p75: r0(quantile(revs, 0.75)), p90: r0(p90) },
    top: { ...profile(top), n: top.length, superhostShare: r0(100 * shTop / top.length) },
    amenities, self: selfOut });
}
