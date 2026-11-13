/* Hostex Open API v3 client + booking helpers. */
const { addDays } = require("./util");

// Tolerate how tokens get pasted: spaces, line breaks, quotes, or the whole "Hostex-Access-Token: …" header line.
const cleanToken = t => { const s = String(t || "").replace(/^\s*hostex-access-token\s*:/i, "").replace(/^\s*bearer\s+/i, "").trim().replace(/^["'`]+|["'`]+$/g, "").trim(); return s.split(/\s+/).pop() || ""; };

function hostexClient(token, base = process.env.HOSTEX_BASE_URL || "https://api.hostex.io/v3") {
  token = cleanToken(token);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function hx(method, path, { query, body } = {}, attempt = 0) {
    const qs = query ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])) : "";
    const res = await fetch(base + path + qs, { method, headers: { "Hostex-Access-Token": token, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({ error_code: res.status, error_msg: "Unexpected response from Hostex" }));
    if ((res.status === 429 || j.error_code === 429) && attempt < 4) { await sleep(1000 * (Number(res.headers.get("retry-after")) || 2 ** attempt * 2)); return hx(method, path, { query, body }, attempt + 1); }
    if (j.error_code !== undefined && j.error_code !== 0 && j.error_code !== 200) {
      const msg = String(j.error_msg || j.error_code);
      if (!token || res.status === 401 || res.status === 403 || [401, 403].includes(Number(j.error_code)) || /access.?token|unauthori[sz]ed|authenticat/i.test(msg))
        throw Object.assign(new Error(`Hostex rejected the access token (${msg}). Copy a fresh token from Hostex → Settings → OpenAPI and set it again (README, step 1).`), { code: "failed-precondition" });
      throw new Error(`Hostex ${path}: ${msg}`);
    }
    return j.data ?? j;
  }
  const firstArray = o => { if (Array.isArray(o)) return o; if (o && typeof o === "object") for (const v of Object.values(o)) if (Array.isArray(v)) return v; return []; };
  async function all(path, key, query = {}, cap = 5000) {
    let out = [], offset = 0;
    while (out.length < cap) {
      const d = await hx("GET", path, { query: { ...query, offset, limit: 100 } });
      const items = (d && d[key]) || firstArray(d); out = out.concat(items);
      if (items.length < 100 || (d && d.total != null && out.length >= d.total)) break;
      offset += items.length;
    }
    return out;
  }
  // Hostex wants both ends of a check-in range and at most ~180 days per request.
  async function reservationsBetween(from, to, { propertyId } = {}) {
    const seen = new Map();
    for (let a = from; a <= to; a = addDays(a, 171)) {
      const b = addDays(a, 170) < to ? addDays(a, 170) : to;
      for (const r of await all("/reservations", "reservations", { start_check_in_date: a, end_check_in_date: b, order_by: "check_in_date", property_id: propertyId }))
        seen.set((r.stay_code || r.reservation_code) + "|" + r.property_id, r);
    }
    return [...seen.values()];
  }
  let propsCache = null;
  const properties = async () => (propsCache ||= await all("/properties", "properties"));
  return { hx, all, reservationsBetween, firstArray, properties };
}

/* ------------------------------------------------------------------ bookings */
const LIVE = ["accepted", "wait_pay"];
const CH = { airbnb: "Airbnb", "booking.com": "Booking.com", booking_site: "Direct", hostex_direct: "Direct", vrbo: "Vrbo", agoda: "Agoda", expedia: "Expedia", "trip.com": "Trip.com", ctrip: "Trip.com" };
const chLabel = c => CH[c] || (c ? c[0].toUpperCase() + c.slice(1) : "Other");
function pick(v, cur) { return v && typeof v === "object" && v.amount != null ? { amount: Number(v.amount), currency: v.currency || cur } : typeof v === "number" ? { amount: v, currency: cur } : null; }
// Rental revenue = accommodation fare (what the portal reports), else the booking total.
function rentalRevenue(r) {
  const rt = r.rates || {}, det = Array.isArray(rt.details) ? rt.details : [];
  const acc = det.filter(d => ["ACCOMMODATION", "HOUSE_EXTENSION_FEE", "SPECIAL_RATE"].includes(d.type));
  if (acc.length) return { amount: acc.reduce((s, d) => s + (Number(d.amount) || 0), 0), currency: acc[0].currency || rt.currency || "" };
  const g = pick(rt.total_rate, rt.currency) || pick(rt.rate, rt.currency) || pick(rt.total, rt.currency);
  if (g) return g;
  if (det.length) return { amount: det.filter(d => d.type !== "HOST_SERVICE_FEE").reduce((s, d) => s + (Number(d.amount) || 0), 0), currency: det[0].currency || "" };
  return null;
}
const cleaningFeeOf = r => { const d = (r.rates?.details || []).find(x => x.type === "CLEANING_FEE"); return d ? Number(d.amount) : null; };
// compact booking used by the pace engine, statements and the turnover board
function trim(r) {
  const v = rentalRevenue(r);
  return { p: Number(r.property_id), ci: r.check_in_date, co: r.check_out_date, ba: String(r.booked_at || r.created_at || "").slice(0, 10),
    rv: v ? Math.round(v.amount * 100) / 100 : null, cur: v?.currency || "", code: r.reservation_code || "", stay: r.stay_code || "", ch: r.channel_type || "",
    guest: r.guest_name || "", guests: r.number_of_guests ?? null, status: r.status, clean: cleaningFeeOf(r) };
}
const liveTrimmed = list => list.filter(r => LIVE.includes(r.status) && r.check_in_date && r.check_out_date).map(trim);

// which Hostex property a channel listing belongs to
const propOfListing = (props, listingId) => props.find(p => (p.channels || []).some(c => String(c.listing_id) === String(listingId)));

module.exports = { cleanToken, hostexClient, LIVE, CH, chLabel, rentalRevenue, cleaningFeeOf, trim, liveTrimmed, propOfListing };
