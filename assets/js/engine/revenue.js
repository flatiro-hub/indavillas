// Direct-booking savings model.
//
// Deliberately simple and auditable — every input is visible and adjustable in
// the UI, because the honest answer to "how much would I save?" depends on
// numbers only the host knows (real occupancy, their actual fee tier).
//
//   annualGross      = nightlyRate x 365 x occupancy
//   otaFeesNow       = annualGross x commission          (all bookings via OTA)
//   otaFeesAfter     = annualGross x commission x (1 - directShare)
//   savings          = otaFeesNow - otaFeesAfter
//                    = annualGross x commission x directShare
//
// The saving is gross: direct bookings still carry payment processing (~2%)
// and website/marketing costs. The UI states that rather than hiding it.

export const DEFAULTS = {
  occupancy: 0.65,     // Boostly-style industry default; user-adjustable
  commission: 0.15,    // Airbnb host-only service fee, common outside the US
  directShare: 0.40,   // conservative first-year direct-booking target
  processingFee: 0.02, // card processing on direct bookings
};

export const LIMITS = {
  occupancy:   { min: 0.20, max: 0.95, step: 0.01 },
  commission:  { min: 0.03, max: 0.25, step: 0.01 },
  directShare: { min: 0.10, max: 0.80, step: 0.05 },
};

export function clamp(v, { min, max }) {
  return Math.min(max, Math.max(min, v));
}

// Missing/invalid values fall back to the default; valid-but-extreme values are
// clamped into range. Either way the result can never go negative or absurd.
function sane(value, fallback, limits) {
  const n = Number(value);
  return clamp(isFinite(n) && n > 0 ? n : fallback, limits);
}

export function computeRevenue({ nightlyRate, occupancy, commission, directShare }) {
  const rateNum = Number(nightlyRate);
  const rate = isFinite(rateNum) && rateNum > 0 ? rateNum : 0;
  const occ = sane(occupancy, DEFAULTS.occupancy, LIMITS.occupancy);
  const com = sane(commission, DEFAULTS.commission, LIMITS.commission);
  const dir = sane(directShare, DEFAULTS.directShare, LIMITS.directShare);

  const annualGross   = rate * 365 * occ;
  const otaFeesNow    = annualGross * com;
  const directRevenue = annualGross * dir;
  const otaFeesAfter  = annualGross * (1 - dir) * com;
  const grossSaving   = otaFeesNow - otaFeesAfter;
  const processing    = directRevenue * DEFAULTS.processingFee;
  const netSaving     = grossSaving - processing;

  return {
    annualGross:  Math.round(annualGross),
    otaFeesNow:   Math.round(otaFeesNow),
    otaFeesAfter: Math.round(otaFeesAfter),
    grossSaving:  Math.round(grossSaving),
    processing:   Math.round(processing),
    netSaving:    Math.round(netSaving),
    monthlySaving: Math.round(netSaving / 12),
    occupancy: occ, commission: com, directShare: dir, nightlyRate: rate,
  };
}

// "€1,160.52" / "1 160,52 €" / "$980" → 1160.52 — tolerant of both decimal
// conventions and of thin/non-breaking spaces used as thousands separators.
export function parseMoney(str) {
  if (typeof str === "number") return isFinite(str) ? str : null;
  if (typeof str !== "string") return null;
  const cleaned = str.replace(/[^\d.,]/g, "").replace(/[  \s]/g, "");
  if (!cleaned) return null;
  // "1,000" is ambiguous on its own, so a separator followed by exactly three
  // digits is read as a thousands separator — the correct reading for currency,
  // where three decimal places effectively never occur.
  const lastSep = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  let normalized;
  if (lastSep === -1) {
    normalized = cleaned;
  } else if (cleaned.length - lastSep - 1 === 3) {
    normalized = cleaned.replace(/[.,]/g, "");
  } else {
    normalized = cleaned.slice(0, lastSep).replace(/[.,]/g, "") + "." + cleaned.slice(lastSep + 1);
  }
  const n = parseFloat(normalized);
  return isFinite(n) && n > 0 ? n : null;
}

const CURRENCY_SYMBOLS = ["€", "$", "£", "¥", "₽", "Rp", "CHF", "SEK", "NOK", "PLN"];

export function parseCurrency(str) {
  if (typeof str !== "string") return null;
  for (const s of CURRENCY_SYMBOLS) if (str.includes(s)) return s;
  return null;
}

// Pulls a per-night rate out of the scraper's `price` object. Airbnb only
// returns pricing when the scrape supplied dates, so this is null-safe.
export function extractNightlyRate(price) {
  if (!price || typeof price !== "object") return { nightlyRate: null, currency: null };

  const bd = price.breakDown || {};
  const base = bd.basePrice || {};
  const currency =
    parseCurrency(base.description) || parseCurrency(base.price) ||
    parseCurrency(price.price) || parseCurrency(price.label) || null;

  // Preferred: "5 nights x €1,160.52" — the per-night figure stated directly.
  const desc = typeof base.description === "string" ? base.description : "";
  const perNight = desc.match(/[x×]\s*([^\d]*[\d.,  \s]+)/);
  if (perNight) {
    const n = parseMoney(perNight[1]);
    if (n) return { nightlyRate: n, currency };
  }

  // Fallback: divide a total by the night count it quotes.
  const nightsMatch = (desc + " " + (price.qualifier || "") + " " + (price.label || "")).match(/(\d+)\s*night/i);
  const total = parseMoney(base.price) || parseMoney(price.price) || parseMoney(price.label);
  const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : null;
  if (total && nights && nights > 0) return { nightlyRate: total / nights, currency };

  return { nightlyRate: null, currency };
}

export function formatMoney(amount, currency = "€", locale = "en") {
  const n = Math.round(Number(amount) || 0);
  const localeTag = { en: "en-GB", lv: "lv-LV", lt: "lt-LT", et: "et-EE" }[locale] || "en-GB";
  const formatted = new Intl.NumberFormat(localeTag, { maximumFractionDigits: 0 }).format(n);
  // Baltic locales conventionally put the symbol after the amount.
  return locale === "en" ? `${currency}${formatted}` : `${formatted} ${currency}`;
}
