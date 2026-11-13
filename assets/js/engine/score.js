// Deterministic Airbnb listing scoring.
// Every check carries points/possible. Fields the scrape couldn't see are left
// out of `possible`, so a listing is never punished for unknown data.
// Overall score = round(total points / total possible x 100).
//
// All user-visible text comes from lib/i18n.js — pass the UI language as the
// second argument (defaults to English).

import { pick } from "./i18n.js?v=20261006a";

// Fixed category weights that sum to exactly 100, so the per-category maxima a
// reader adds up always equal the /100 the dial shows. Inside a category, the
// weight of any check the data source can't see is redistributed pro-rata to
// the visible checks (extrapolation, not punishment: a listing at 40% of what
// we CAN see is scored as 40% of the category).
const WEIGHTS = { photos: 20, title: 10, description: 20, amenities: 10, reviews: 25, booking: 15 };

const GRADE_BANDS = [
  [90, "A"], [83, "A-"], [76, "B+"], [68, "B"], [60, "B-"],
  [52, "C+"], [44, "C"], [34, "D"], [0, "E"],
];

const IMPACT_ORDER = { high: 0, medium: 1, quick: 2 };

// Matching runs against Airbnb's own (usually English) amenity names; the
// display name shown to the user comes from the language dictionary.
// Deliberately property-type-neutral (no pool/AC — a city flat shouldn't be
// punished for lacking villa amenities).
const ESSENTIALS = [
  ["wifi", /wi.?fi|internet/i],
  ["kitchen", /kitchen/i],
  ["washer", /washer|washing machine|laundry/i],
  ["workspace", /workspace|\bdesk\b|laptop/i],
  ["tv", /\b(?:HD)?TV\b|[Tt]elevision/],
  ["parking", /parking/i],
];

const SELLABLES = /pool|view|kitchen|wi.?fi|air.?con|\bAC\b|workspace|\bdesk\b|beach|garden|staff|breakfast|chef|terrace|balcony|rooftop|sunset|ocean|jungle|rice ?(?:field|paddy)/gi;

export function gradeFor(score) {
  for (const [min, g] of GRADE_BANDS) if (score >= min) return g;
  return "E";
}

function category(key, label) {
  const cat = { key, label, points: 0, possible: 0, checks: [], fixes: [] };
  cat.add = (checkLabel, possible, points, note, fix) => {
    points = Math.max(0, Math.min(possible, Math.round(points)));
    cat.checks.push({ label: checkLabel, points, possible, note });
    if (fix) cat.fixes.push({ ...fix, _ci: cat.checks.length - 1 });
  };
  // A check the data source couldn't see: shown in the report for honesty;
  // its weight is redistributed to the category's visible checks in finalize().
  cat.addNA = (checkLabel, note) => {
    cat.checks.push({ label: checkLabel, points: 0, possible: 0, note, na: true });
  };
  return cat;
}

// Largest-remainder rounding: scale `exact` values to integers summing to `total`.
function apportion(exact, total) {
  const floors = exact.map(v => Math.floor(v));
  let rest = total - floors.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] += 1;
    rest -= 1;
  }
  return floors;
}

// Rescale a category's visible checks so they sum to its fixed weight, keeping
// every number an integer and every check's points <= its possible.
function finalize(cat, W) {
  const vis = cat.checks.filter(ch => ch.possible > 0);
  const rawPos = vis.reduce((s, c) => s + c.possible, 0);
  if (!rawPos) {
    cat.points = 0;
    cat.possible = 0;
    return;
  }
  const rawPts = vis.reduce((s, c) => s + c.points, 0);
  const scale = W / rawPos;
  const newPos = apportion(vis.map(c => c.possible * scale), W);
  const targetPts = Math.round(rawPts * scale);
  const newPts = apportion(vis.map(c => c.points * scale), targetPts);
  // Rounding can nudge a check's points past its possible; shift the excess to
  // a check that still has headroom (totals stay untouched).
  for (let i = 0; i < vis.length; i++) {
    while (newPts[i] > newPos[i]) {
      newPts[i] -= 1;
      const j = newPts.findIndex((p, k) => p < newPos[k]);
      if (j === -1) break;
      newPts[j] += 1;
    }
  }
  vis.forEach((c, i) => { c.possible = newPos[i]; c.points = newPts[i]; });
  cat.points = targetPts;
  cat.possible = W;
  // Fix chips advertise the SCALED recoverable points, so score + chips
  // reconcile with the /100 total by hand.
  cat.fixes = cat.fixes.map(f => {
    const ch = cat.checks[f._ci];
    const { _ci, ...rest } = f;
    return { ...rest, lost: Math.max(0, ch.possible - ch.points) };
  }).filter(f => f.lost > 0);
}

// Diacritic-insensitive lowercase: "Jūrmalā" → "jurmala", "Rīga" → "riga".
function fold(s) {
  return String(s).normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

// Marketed area names often differ from Airbnb's administrative location
// fields (a "Seminyak" villa is filed under "Kuta Utara"; "Bingin" under
// "South Kuta"). So besides the listing's own location hints, the title is
// checked against this gazetteer of holiday-rental areas — Bali and the
// Baltics first (Flatiro's markets), then common city-break destinations.
// Extend freely; matching is diacritic-folded and stemmed like everything else.
const KNOWN_AREAS = [
  // Bali
  "Seminyak", "Canggu", "Ubud", "Uluwatu", "Kuta", "Legian", "Sanur",
  "Jimbaran", "Bingin", "Pererenan", "Umalas", "Kerobokan", "Berawa",
  "Batu Bolong", "Nusa Dua", "Nusa Penida", "Nusa Lembongan", "Amed",
  "Lovina", "Sidemen", "Munduk", "Balangan", "Padang Padang", "Bukit", "Bali",
  // Latvia
  "Rīga", "Vecrīga", "Jūrmala", "Liepāja", "Ventspils", "Sigulda", "Cēsis",
  "Kuldīga", "Daugavpils",
  // Lithuania
  "Vilnius", "Kaunas", "Klaipėda", "Palanga", "Nida", "Neringa", "Trakai",
  "Druskininkai", "Šventoji", "Birštonas",
  // Estonia
  "Tallinn", "Pärnu", "Tartu", "Saaremaa", "Kuressaare", "Haapsalu", "Otepää",
  // Common city-break / holiday destinations
  "Lombok", "Phuket", "Barcelona", "Lisbon", "Paris", "Rome", "London",
  "Berlin", "Amsterdam", "Prague", "Vienna", "Budapest", "Warsaw", "Krakow",
  "Gdańsk", "Helsinki", "Stockholm", "Oslo", "Copenhagen", "Dubrovnik",
  "Split", "Athens", "Santorini", "Mykonos", "Tenerife", "Mallorca", "Ibiza",
  "Madeira", "Algarve", "Dubai", "Marrakech", "Tbilisi", "Batumi",
];
// Single words are stemmed (so "Vilniuje" still hits "Vilnius"); multi-word
// names are matched as folded phrases.
const AREA_STEMS = KNOWN_AREAS.map(a => {
  const f = fold(a);
  return f.includes(" ") ? f : f.slice(0, Math.max(4, f.length - 2));
});

function scorePhotos(l, warnings, S) {
  const cat = category("photos", S.cat.photos);
  const count = l.photoCount;
  if (count == null) {
    warnings.push(S.warn.photos);
  } else {
    // Full marks at 100+ photos: a fully documented listing shows every room,
    // the outdoor space and the details, and that depth is what converts.
    const p = count >= 100 ? 12 : count >= 75 ? 10 : count >= 50 ? 8 : count >= 35 ? 6
      : count >= 25 ? 5 : count >= 15 ? 4 : count >= 10 ? 3 : count >= 5 ? 2 : count >= 1 ? 1 : 0;
    cat.add(S.check.photoCount, 12, p, S.note.photos(count), count < 100 ? {
      text: S.fix.photosMore(count),
      impact: count < 20 ? "high" : count < 50 ? "medium" : "quick",
    } : null);
  }
  if (l.captionedCount != null && l.photoCount) {
    const ratio = l.captionedCount / l.photoCount;
    const p = ratio >= 0.8 ? 8 : ratio >= 0.5 ? 5 : ratio > 0 ? 3 : 0;
    cat.add(S.check.captions, 8, p, S.note.captioned(l.captionedCount, l.photoCount), ratio < 0.8 ? {
      text: S.fix.captions,
      impact: ratio === 0 ? "medium" : "quick",
    } : null);
  } else if (l.captionsKnown === false) {
    cat.addNA(S.check.captions, S.note.notVisible);
  }
  return cat;
}

function scoreTitle(l, warnings, S) {
  const t = (l.title || "").trim();
  if (!t) {
    warnings.push(S.warn.title);
    return null;
  }
  const cat = category("title", S.cat.title);
  const len = t.length;
  const lenPts = len >= 30 && len <= 50 ? 4 : len >= 20 ? 2 : 1;
  cat.add(S.check.titleChars, 4, lenPts, S.note.titleChars(len), len < 30 ? {
    text: S.fix.titleChars(len),
    impact: "high",
  } : null);

  // Generic words that appear in location data but don't identify an area.
  const STOP = new Set(["south", "north", "east", "west", "central", "beach", "villa", "pool", "house", "home", "near", "walk", "this", "that", "with", "provinsi", "regency", "kabupaten", "indonesia", "airbnb", "stays", "restaurants", "guests", "getting"]);
  const hintStrings = l.locationHints?.length ? l.locationHints : [l.location || ""];
  // Compare diacritic-folded STEMS, not raw substrings: Baltic place names
  // inflect ("Jūrmala" appears in titles as "Jūrmalā", "Vilnius" as
  // "Vilniuje"), so we trim up to two trailing letters from each hint token
  // (never below four) before looking for it in the folded title.
  const stems = [];
  let areaDisplay = null;
  for (const h of hintStrings) {
    for (const w of String(h).split(/[^A-Za-zÀ-ɏ]+/)) {
      if (w.length < 4) continue;
      const f = fold(w);
      if (STOP.has(f)) continue;
      const stem = f.slice(0, Math.max(4, f.length - 2));
      if (!stems.includes(stem)) {
        stems.push(stem);
        if (!areaDisplay) areaDisplay = w;
      }
    }
  }
  const tl = fold(t);
  // Stems must match at a word START ("Vilniuje" hits "vilni…"), never inside
  // a word — otherwise "framed" would hit Amed and "syndrome" would hit Rome.
  const titleWords = tl.split(/[^a-z0-9]+/);
  const stemHit = stem => stem.includes(" ")
    ? tl.includes(stem)
    : titleWords.some(w => w.startsWith(stem));
  // Pass if the title names either the listing's own location hints OR any
  // known holiday-rental area — hosts market "Seminyak" even when Airbnb
  // files the listing under an administrative name like "Kuta Utara".
  const gazetteerHit = AREA_STEMS.some(stemHit);
  if (stems.length || gazetteerHit) {
    const hit = gazetteerHit || stems.some(stemHit);
    const area = l.location || areaDisplay;
    cat.add(S.check.area, 3, hit ? 3 : 0, hit ? S.note.areaYes : S.note.areaNo, hit ? null : {
      text: S.fix.area(area),
      impact: "medium",
    });
  }

  const letters = t.replace(/[^A-Za-z]/g, "");
  const caps = t.replace(/[^A-Z]/g, "");
  const capsRatio = letters.length ? caps.length / letters.length : 0;
  const emoji = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
  const clean = capsRatio <= 0.45 && emoji <= 2 && !/!{2,}/.test(t);
  cat.add(S.check.style, 3, clean ? 3 : 1, clean ? S.note.styleClean : S.note.styleSpam, clean ? null : {
    text: S.fix.style,
    impact: "medium",
  });
  return cat;
}

function scoreDescription(l, warnings, S) {
  const d = (l.description || "").trim();
  if (!d) {
    warnings.push(S.warn.desc);
    return null;
  }
  const cat = category("description", S.cat.description);
  const chars = d.length;
  const lenPts = chars >= 1200 ? 6 : chars >= 700 ? 4 : chars >= 300 ? 2 : 1;
  cat.add(S.check.descLen, 6, lenPts, S.note.descChars(chars), chars < 700 ? {
    text: S.fix.descLen(chars),
    impact: "high",
  } : null);

  const breaks = (d.match(/\n/g) || []).length;
  const structPts = breaks >= 6 ? 5 : breaks >= 2 ? 3 : 1;
  cat.add(S.check.structure, 5, structPts, breaks >= 2 ? S.note.breaks(breaks) : S.note.oneBlock, structPts < 5 ? {
    text: S.fix.structure,
    impact: "medium",
  } : null);

  const uniq = new Set((d.match(SELLABLES) || []).map(s => s.toLowerCase().replace(/[^a-z]/g, "")));
  const sellPts = uniq.size >= 6 ? 5 : uniq.size >= 4 ? 4 : uniq.size >= 2 ? 2 : uniq.size > 0 ? 1 : 0;
  cat.add(S.check.sellables, 5, sellPts, S.note.sellables(uniq.size), uniq.size < 4 ? {
    text: S.fix.sellables,
    impact: "medium",
  } : null);

  const first = d.slice(0, 160);
  const generic = /^\s*welcome to/i.test(first);
  const hook = !generic && (/\d/.test(first) || new RegExp(SELLABLES.source, "i").test(first));
  cat.add(S.check.hook, 4, hook ? 4 : 2, hook ? S.note.hookYes : S.note.hookNo, hook ? null : {
    text: generic ? S.fix.hookWelcome : S.fix.hookGeneric,
    impact: "quick",
  });
  return cat;
}

function scoreAmenities(l, warnings, S) {
  const list = Array.isArray(l.amenities) ? l.amenities : null;
  const count = list ? list.length : l.amenitiesCount ?? null;
  if (!list && count == null) {
    warnings.push(S.warn.amenities);
    return null;
  }
  const cat = category("amenities", S.cat.amenities);
  if (list) {
    const joined = list.join(" | ");
    const missing = ESSENTIALS.filter(([, re]) => !re.test(joined)).map(([key]) => S.ess[key]);
    const missingList = missing.join(", ");
    cat.add(S.check.essentials, 6, 6 - missing.length, missing.length ? S.note.missing(missingList) : S.note.allPresent, missing.length ? {
      text: S.fix.essentials(missingList),
      impact: missing.length >= 3 ? "high" : "medium",
    } : null);
  }
  if (count != null) {
    const p = count >= 40 ? 4 : count >= 25 ? 3 : count >= 15 ? 2 : 1;
    cat.add(S.check.amenityCount, 4, p, S.note.amenityCount(count), count < 25 ? {
      text: S.fix.amenityCount(count),
      impact: "quick",
    } : null);
  }
  return cat;
}

function scoreReviews(l, warnings, S) {
  const cat = category("reviews", S.cat.reviews);
  const r = l.rating;
  // r === 0 means "no rating yet" on every platform (scales start at 1) —
  // the zero-review-count row below already tells that story.
  if (r != null && r > 0) {
    const p = r >= 4.9 ? 10 : r >= 4.8 ? 8 : r >= 4.6 ? 6 : r >= 4.2 ? 4 : 2;
    const shown = l.ratingDisplay ?? r; // Booking listings show their native /10 figure
    cat.add(S.check.rating, 10, p, S.note.rating(shown), r < 4.8 ? {
      text: S.fix.rating(shown),
      impact: "high",
    } : null);
  } else if (r == null && l.reviewCount !== 0) {
    // With zero reviews the missing rating is self-evident — the review-count
    // row says it; a "rating unavailable" warning would just be noise.
    warnings.push(S.warn.rating);
  }
  const n = l.reviewCount;
  if (n != null) {
    const p = n >= 150 ? 10 : n >= 75 ? 8 : n >= 30 ? 6 : n >= 10 ? 4 : n >= 1 ? 2 : 0;
    cat.add(S.check.reviewCount, 10, p, S.note.reviews(n), n < 30 ? {
      text: n === 0 ? S.fix.reviewsNone : S.fix.reviewsFew(n),
      impact: "medium",
    } : null);
  } else {
    warnings.push(S.warn.reviews);
  }
  if (l.isSuperhost != null) {
    cat.add(S.check.superhost, 5, l.isSuperhost ? 5 : 0, l.isSuperhost ? S.note.shYes : S.note.shNo, l.isSuperhost ? null : {
      text: S.fix.superhost,
      impact: "quick",
    });
  } else {
    cat.addNA(S.check.superhost, S.note.notVisible);
  }
  return cat;
}

function scoreBooking(l, warnings, S) {
  const cat = category("booking", S.cat.booking);
  if (l.instantBook != null) {
    cat.add(S.check.instantBook, 6, l.instantBook ? 6 : 2, l.instantBook ? S.note.ibOn : S.note.ibOff, l.instantBook ? null : {
      text: S.fix.instantBook,
      impact: "quick",
    });
  } else {
    cat.addNA(S.check.instantBook, S.note.notVisible);
  }
  if (l.minNights != null) {
    const m = l.minNights;
    const p = m <= 2 ? 4 : m === 3 ? 3 : m <= 5 ? 2 : 1;
    cat.add(S.check.minNights, 4, p, S.note.minNights(m), m > 3 ? {
      text: S.fix.minNights(m),
      impact: "medium",
    } : null);
  } else {
    cat.addNA(S.check.minNights, S.note.notVisible);
  }
  const c = (l.cancellationPolicy || "").toLowerCase();
  const kind = /flexible/.test(c) ? "flexible" : /moderate/.test(c) ? "moderate" : /firm/.test(c) ? "firm" : /strict/.test(c) ? "strict" : null;
  if (kind) {
    const p = { flexible: 5, moderate: 4, firm: 3, strict: 1 }[kind];
    cat.add(S.check.cancellation, 5, p, S.cancelName[kind] || l.cancellationPolicy, p <= 3 ? {
      text: S.fix.cancellation,
      impact: "medium",
    } : null);
  } else {
    cat.addNA(S.check.cancellation, S.note.notVisible);
  }
  return cat;
}

export function scoreListing(l, lang = "en") {
  const S = pick(lang);
  const warnings = [];
  const built = [
    scorePhotos(l, warnings, S),
    scoreTitle(l, warnings, S),
    scoreDescription(l, warnings, S),
    scoreAmenities(l, warnings, S),
    scoreReviews(l, warnings, S),
    scoreBooking(l, warnings, S),
  ].filter(Boolean);

  // How much was genuinely verifiable, before redistribution (drives the
  // limited-data warning; the display always rescales to the fixed weights).
  const rawVerifiable = built.reduce(
    (s, c) => s + c.checks.reduce((t, ch) => t + ch.possible, 0), 0);

  built.forEach(c => finalize(c, WEIGHTS[c.key]));
  const cats = built.filter(c => c.possible > 0);

  const points = cats.reduce((s, c) => s + c.points, 0);
  const possible = cats.reduce((s, c) => s + c.possible, 0);
  const score = possible === 100 ? points : possible ? Math.round((points / possible) * 100) : 0;
  if (rawVerifiable < 30) {
    warnings.unshift(S.warn.limited);
  }

  const fixes = cats
    .flatMap(c => c.fixes.map(f => ({ ...f, category: c.label })))
    .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || b.lost - a.lost);

  return {
    score,
    grade: gradeFor(score),
    points,
    possible,
    categories: cats.map(({ key, label, points: p, possible: q, checks }) => ({ key, label, points: p, possible: q, checks })),
    fixes,
    warnings,
  };
}
