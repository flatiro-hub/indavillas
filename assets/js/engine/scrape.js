// Fetches a listing via an Apify Airbnb-scraper actor and normalizes the result
// into the shape lib/score.js expects. Scraper actors differ in output fields,
// so normalization is defensive: anything missing becomes null + a warning,
// and scoring simply excludes it.

import { extractNightlyRate } from "./revenue.js?v=20261006a";

export class AuditError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Note: tri_angle's plain "airbnb-scraper" is search-only and rejects listing
// URLs — the rooms-urls variant is the one that takes a single listing link.
const DEFAULT_ACTOR = "tri_angle~airbnb-rooms-urls-scraper";
const DEFAULT_BOOKING_ACTOR = "voyager~booking-scraper";

export function isAirbnbUrl(url) {
  try {
    const u = new URL(String(url));
    return /(^|\.)airbnb\./.test(u.hostname) && /\/(rooms|h|luxury)\//.test(u.pathname);
  } catch {
    return false;
  }
}

export function isBookingUrl(url) {
  try {
    const u = new URL(String(url));
    return /(^|\.)booking\.com$/i.test(u.hostname) && /^\/hotel\//.test(u.pathname);
  } catch {
    return false;
  }
}

// Share links from the Airbnb/Booking mobile apps ("Share" → Copy link). They
// carry no listing id, so the server resolves the redirect before scraping —
// but they must pass validation here or the paste is rejected on the spot.
export function isShortListingUrl(url) {
  try {
    const u = new URL(String(url));
    return /(^|\.)abnb\.me$/i.test(u.hostname)
      || (/(^|\.)airbnb\./i.test(u.hostname) && /^\/l\//i.test(u.pathname))
      || (/(^|\.)booking\.com$/i.test(u.hostname) && /^\/Share-/i.test(u.pathname));
  } catch {
    return false;
  }
}

export function isListingUrl(url) {
  return isAirbnbUrl(url) || isBookingUrl(url) || isShortListingUrl(url);
}

// People paste "www.airbnb.com/rooms/123" or a link wrapped in spaces/quotes.
// Without a scheme `new URL()` throws, so every check would call it invalid.
export function normalizeInputUrl(raw) {
  let s = String(raw == null ? "" : raw).trim().replace(/^["'<]+|["'>]+$/g, "");
  if (s && !/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  return s;
}

// Routes an item to the right normalizer by its URL's platform.
export function normalizeListing(item, url) {
  return isBookingUrl(url) ? normalizeBooking(item, url) : normalizeScraped(item, url);
}

// Fetches the RAW scraper item (no normalization) — the browser normalizes and
// scores it client-side. This is the same contract as api/audit.php.
export async function fetchListingRaw(url) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new AuditError("scrape_unconfigured", "missing APIFY_TOKEN");
  }
  const booking = isBookingUrl(url);
  const actor = booking
    ? (process.env.APIFY_BOOKING_ACTOR_ID || DEFAULT_BOOKING_ACTOR)
    : (process.env.APIFY_ACTOR_ID || DEFAULT_ACTOR);
  const endpoint = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=100`;

  let res;
  try {
    const { checkIn, checkOut } = auditDates();
    const input = { startUrls: [{ url }], checkIn, checkOut, adults: 2, currency: "EUR" };
    // English output keeps the text heuristics (bedroom words, essentials
    // matching) on known ground; one item is all a detail URL yields.
    if (booking) Object.assign(input, { language: "en-us", maxItems: 1 });
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (e) {
    // message becomes the localized error's detail — keep it short
    throw new AuditError("scrape_failed", e.message);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[scrape] actor error", res.status, body.slice(0, 300));
    throw new AuditError("scrape_failed", `HTTP ${res.status}`);
  }
  const items = await res.json().catch(() => null);
  const item = Array.isArray(items) ? items.find(i => i && (i.name || i.title || i.description)) : null;
  if (!item) {
    throw new AuditError("scrape_empty", "empty scraper result");
  }
  return item;
}

export async function scrapeListing(url) {
  return normalizeListing(await fetchListingRaw(url), url);
}

// Booking.com item (voyager~booking-scraper) → the same normalized shape.
// Booking exposes less host-controlled metadata than Airbnb (no photo
// captions, no Superhost, no instant-book/min-stay, cancellation varies per
// room), so those checks land as honest "not visible" rows via the NA path.
export function normalizeBooking(item, url) {
  const warnings = [];
  const title = str(item.name) || null;
  const description = cleanBookingDescription(str(item.description));

  const photosRaw = Array.isArray(item.images) && item.images.length ? item.images : null;
  const photoCount = photosRaw ? photosRaw.length : null;
  const coverPhoto = str(item.image) || (photosRaw ? str(photosRaw[0]) : null);

  // Booking rates on /10; the scoring bands are calibrated to Airbnb's /5.
  // Halving maps the scales sensibly (9.8→4.9 exceptional, 8.4→4.2 mixed);
  // ratingDisplay keeps the familiar /10 figure for the report text.
  // Booking reports 0 for not-yet-reviewed properties — that's "unrated",
  // not "rated zero", so it must not enter the rating bands.
  const r10 = pickNum(item.rating);
  const rated = r10 != null && r10 > 0;
  const rating = rated ? Math.round(r10 * 50) / 100 : null;
  const ratingDisplay = rated ? `${r10}/10` : null;
  const reviewCount = pickNum(item.reviews, item.reviewsCount);

  let amenities = null;
  if (Array.isArray(item.facilities)) {
    const flat = [];
    for (const g of item.facilities) {
      for (const f of (Array.isArray(g?.facilities) ? g.facilities : [])) {
        const n = str(f?.name);
        if (n) flat.push(n.slice(0, 60));
      }
    }
    amenities = [...new Set(flat)].slice(0, 80);
    if (!amenities.length) amenities = null;
  }

  const location = str(item.address?.city) || null;
  const locationHints = [];
  const pushHint = v => {
    if (typeof v === "string" && v.trim() && locationHints.length < 40) locationHints.push(v.trim());
  };
  pushHint(location);
  // Trail: Home > Hotels > All vacation homes > Country > Region > City > listing
  const crumbs = Array.isArray(item.breadcrumbs)
    ? item.breadcrumbs.map(b => str(b?.name)).filter(Boolean) : [];
  for (const c of crumbs.slice(2, -1)) if (!/^All /i.test(c)) pushHint(c);

  let country = null;
  const cc = str(item.address?.country);
  if (cc && /^[a-z]{2}$/i.test(cc)) {
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(cc.toUpperCase());
      if (name && name.toUpperCase() !== cc.toUpperCase()) country = name;
    } catch { /* no Intl.DisplayNames: fall through to breadcrumbs */ }
  }
  if (!country) {
    const i = crumbs.findIndex(c => /^All /i.test(c));
    if (i >= 0 && crumbs[i + 1]) country = crumbs[i + 1];
  }

  // price is the total for the sampled stay — divide by its nights.
  const total = pickNum(item.price);
  const nights = (Date.parse(item.checkOutDate) - Date.parse(item.checkInDate)) / 86400000;
  const nightlyRate = total != null && nights > 0 ? Math.round((total / nights) * 100) / 100 : null;
  const currency = str(item.currency);

  const roomTypes = Array.isArray(item.rooms)
    ? item.rooms.map(rm => str(rm?.roomType)).filter(Boolean).join(" ") : "";
  const bedrooms = parseBedrooms(roomTypes, title, description);

  if (!title) warnings.push("scrape_title");
  if (!description) warnings.push("scrape_desc");
  if (photoCount == null) warnings.push("scrape_photos");
  if (!amenities) warnings.push("scrape_amenities");

  return {
    source: "scrape", url: String(url), title, description, location, locationHints,
    photoCount, captionedCount: null, captionsKnown: false,
    amenities, amenitiesCount: amenities ? amenities.length : null,
    rating, ratingDisplay, reviewCount, isSuperhost: null,
    instantBook: null, minNights: null, cancellationPolicy: null,
    nightlyRate, currency, coverPhoto, bedrooms, country,
    scrapeWarnings: warnings,
  };
}

// Booking prepends Genius-discount marketing and an "About this property"
// label to the host's text — neither is the host's copy, so neither is scored.
function cleanBookingDescription(s) {
  if (!s) return null;
  const paras = s.split(/\n+/).map(p => p.trim()).filter(Boolean).filter(p => !/genius/i.test(p));
  const t = paras.join("\n\n").replace("About this property", "").trim();
  return t || null;
}

// Booking writes bedroom counts as words ("Two-Bedroom House").
const WORD_NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
function parseBedrooms(...texts) {
  for (const t of texts) {
    const m = String(t || "").match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[-\s]?bedroom/i);
    if (m) return WORD_NUMS[m[1].toLowerCase()] || parseInt(m[1], 10) || null;
  }
  return null;
}

export function normalizeScraped(item, url) {
  const warnings = [];

  const title = str(item.name) || str(item.title) || null;

  // Prefer the HTML description: some actors flatten line breaks out of the
  // plain-text field, which would unfairly fail the structure check.
  const html = str(item.htmlDescription?.htmlText)
    || (typeof item.htmlDescription === "string" ? str(item.htmlDescription) : null);
  let description = html ? stripHtml(html) : (str(item.description) || null);
  if (!description && item.sectionedDescription && typeof item.sectionedDescription === "object") {
    description = Object.values(item.sectionedDescription)
      .filter(v => typeof v === "string" && v.trim())
      .join("\n\n") || null;
  }
  if (description) description = stripHtml(description);

  const photosRaw = firstArray(item.images, item.photos, item.pictures);
  const firstPhoto = photosRaw && photosRaw[0];
  const coverPhoto = str(item.thumbnail)
    || (firstPhoto && typeof firstPhoto === "object" ? str(firstPhoto.imageUrl) || str(firstPhoto.url) : str(firstPhoto))
    || null;

  let photoCount = null, captionedCount = null, captionsKnown = false;
  if (photosRaw) {
    photoCount = photosRaw.length;
    captionsKnown = photosRaw.some(p => p && typeof p === "object" && ("caption" in p || "accessibilityLabel" in p));
    if (captionsKnown) {
      captionedCount = photosRaw.filter(p => {
        const c = p && typeof p === "object" ? (p.caption || p.accessibilityLabel || "") : "";
        const s = String(c).trim();
        // Airbnb auto-fills "Listing image N" when the host wrote no caption.
        return s.length > 3 && !/^listing image \d+$/i.test(s);
      }).length;
    }
  } else if (typeof item.photosCount === "number") {
    photoCount = item.photosCount;
  }

  let rating = null, reviewCount = null;
  const r = item.rating;
  if (typeof r === "number") rating = r;
  else if (r && typeof r === "object") {
    rating = pickNum(r.guestSatisfaction, r.value, r.average);
    reviewCount = pickNum(r.reviewsCount, r.count);
  }
  rating = rating ?? pickNum(item.stars, item.averageRating);
  reviewCount = reviewCount ?? pickNum(item.reviewsCount, item.numberOfReviews)
    ?? (Array.isArray(item.reviews) ? item.reviews.length : null);

  let amenities = null;
  if (Array.isArray(item.amenities)) {
    amenities = item.amenities.flatMap(a => {
      if (typeof a === "string") return [a];
      if (a && Array.isArray(a.values)) {
        return a.values.filter(v => v && v.available !== false).map(v => str(v.title) || str(v.name) || "").filter(Boolean);
      }
      return [str(a?.title) || str(a?.name)].filter(Boolean);
    }).map(s => s.slice(0, 60)).slice(0, 80);
    if (!amenities.length) amenities = null;
  }

  const host = item.host || {};
  const isSuperhost = firstBool(host.isSuperhost, host.isSuperHost, item.isSuperhost, item.isHostedBySuperhost);
  const location = str(item.city) || str(item.location?.city)
    || (typeof item.location === "string" ? item.location : null)
    || str(item.address?.city)
    || (typeof item.address === "string" ? item.address : null) || null;
  // Area names the title could legitimately mention — official area fields plus
  // proper nouns from the host's own neighborhood text (catches marketed areas
  // like "Bingin" that Airbnb files under an administrative name like "South Kuta").
  const locationHints = [];
  const pushHint = s => {
    if (typeof s === "string" && s.trim() && locationHints.length < 40) locationHints.push(s.trim());
  };
  pushHint(location);
  pushHint(str(item.locationSubtitle));
  if (Array.isArray(item.breadcrumbs)) {
    for (const b of item.breadcrumbs) pushHint(str(b?.searchText) || str(b?.linkText));
  }
  if (Array.isArray(item.locationDescriptions)) {
    for (const ld of item.locationDescriptions) {
      const caps = String(ld?.content || "").match(/\b[A-ZÀ-Ý][a-zà-ɏ]{3,}\b/g) || [];
      caps.forEach(pushHint);
    }
  }

  // Pricing only comes back when the scrape supplied dates (see auditDates()).
  const { nightlyRate, currency } = extractNightlyRate(item.price);

  // Bedroom count and country drive the market-comparison teaser.
  // Airbnb states them in the summary line ("… · 9 bedrooms · 12 beds · …")
  // and in the breadcrumb trail (Airbnb > Country > Region > …).
  const summary = `${str(item.sharingConfigTitle) || ""} ${str(item.subDescription) || ""}`;
  const bedroomsMatch = summary.match(/(\d+)\s*bedroom/i);
  const bedrooms = pickNum(item.bedrooms, bedroomsMatch ? bedroomsMatch[1] : null);

  let country = null;
  if (Array.isArray(item.breadcrumbs) && item.breadcrumbs.length > 1) {
    country = str(item.breadcrumbs[1]?.searchText) || str(item.breadcrumbs[1]?.linkText);
  }
  if (!country) {
    const parts = String(str(item.locationSubtitle) || "").split(",").map(s => s.trim()).filter(Boolean);
    country = parts.length ? parts[parts.length - 1] : null;
  }

  const instantBook = firstBool(item.isInstantBookable, item.instantBookable, item.instantBook);
  const minNights = pickNum(item.minNights, item.minimumStay, item.minimumNights);
  const cancellationPolicy = typeof item.cancellationPolicy === "string"
    ? item.cancellationPolicy
    : str(item.cancellationPolicy?.title)
      || str(item.cancellationPolicies?.[0]?.policyName)
      || null;

  // Warning CODES — translated by api/audit.js via lib/i18n.js
  if (!title) warnings.push("scrape_title");
  if (!description) warnings.push("scrape_desc");
  if (photoCount == null) warnings.push("scrape_photos");
  if (!amenities) warnings.push("scrape_amenities");

  return {
    source: "scrape", url: String(url), title, description, location, locationHints,
    photoCount, captionedCount, captionsKnown,
    amenities, amenitiesCount: amenities ? amenities.length : null,
    rating, reviewCount, isSuperhost,
    instantBook, minNights, cancellationPolicy,
    nightlyRate, currency, coverPhoto, bedrooms, country,
    scrapeWarnings: warnings,
  };
}

// A sample stay ~60 days out: far enough to dodge last-minute discounting,
// near enough to reflect current pricing. Same window used by both backends.
export function auditDates(now = new Date()) {
  const iso = d => d.toISOString().slice(0, 10);
  const checkIn = new Date(now.getTime() + 60 * 86400000);
  const checkOut = new Date(checkIn.getTime() + 5 * 86400000);
  return { checkIn: iso(checkIn), checkOut: iso(checkOut) };
}

export function normalizeManual(m) {
  const captions = typeof m.captions === "boolean" ? m.captions : null;
  const photoCount = num(m.photoCount);
  return {
    source: "manual",
    url: str(m.url) || null,
    title: str(m.title) || null,
    description: str(m.description) || null,
    location: str(m.location) || null,
    locationHints: str(m.location) ? [str(m.location)] : [],
    photoCount,
    captionedCount: captions == null || photoCount == null ? null : (captions ? photoCount : 0),
    captionsKnown: captions != null,
    amenities: null,
    amenitiesCount: num(m.amenitiesCount),
    rating: clampNum(num(m.rating), 0, 5),
    reviewCount: num(m.reviewCount),
    isSuperhost: typeof m.superhost === "boolean" ? m.superhost : null,
    instantBook: typeof m.instantBook === "boolean" ? m.instantBook : null,
    minNights: num(m.minNights),
    cancellationPolicy: str(m.cancellation) && m.cancellation !== "unknown" ? m.cancellation : null,
    nightlyRate: num(m.nightlyRate),
    currency: str(m.currency) || null,
    coverPhoto: str(m.coverPhoto) || null,
    bedrooms: num(m.bedrooms),
    country: str(m.country) || null,
    scrapeWarnings: [],
  };
}

// --- helpers ---

function str(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
}
function clampNum(n, min, max) {
  return n == null ? null : Math.max(min, Math.min(max, n));
}
function pickNum(...vals) {
  for (const v of vals) {
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}
function firstBool(...vals) {
  for (const v of vals) if (typeof v === "boolean") return v;
  return null;
}
function firstArray(...vals) {
  for (const v of vals) if (Array.isArray(v) && v.length) return v;
  return null;
}
function stripHtml(s) {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
