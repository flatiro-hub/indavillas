/* ============================================================
   IndaVillas - instant listing audit (design v4 copy of assets/js/audit.js;
   scoring unchanged, only the page hooks differ: v4 buttons, smooth scroll)
   A faithful browser port of Flatiro's scoring engine. Runs entirely on the
   visitor's device: no request leaves the page, no backend is involved, and
   the score appears the moment the form is submitted.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- weights, bands, constants (unchanged from the engine) ---------- */
  var WEIGHTS = { photos: 20, title: 10, description: 20, amenities: 10, reviews: 25, booking: 15 };
  var GRADE_BANDS = [[90,'A'],[83,'A-'],[76,'B+'],[68,'B'],[60,'B-'],[52,'C+'],[44,'C'],[34,'D'],[0,'E']];
  var IMPACT_ORDER = { high: 0, medium: 1, quick: 2 };

  var ESSENTIALS = [
    ['wifi', /wi.?fi|internet/i],
    ['kitchen', /kitchen/i],
    ['washer', /washer|washing machine|laundry/i],
    ['workspace', /workspace|\bdesk\b|laptop/i],
    ['tv', /\b(?:HD)?TV\b|[Tt]elevision/],
    ['parking', /parking/i]
  ];
  var SELLABLES = /pool|view|kitchen|wi.?fi|air.?con|\bAC\b|workspace|\bdesk\b|beach|garden|staff|breakfast|chef|terrace|balcony|rooftop|sunset|ocean|jungle|rice ?(?:field|paddy)/gi;

  var KNOWN_AREAS = ['Seminyak','Canggu','Ubud','Uluwatu','Kuta','Legian','Sanur','Jimbaran','Bingin','Pererenan','Umalas','Kerobokan','Berawa','Batu Bolong','Nusa Dua','Nusa Penida','Nusa Lembongan','Amed','Lovina','Sidemen','Munduk','Balangan','Padang Padang','Bukit','Bali','Lombok','Phuket','Barcelona','Lisbon','Paris','Rome','London','Berlin','Amsterdam','Prague','Vienna','Budapest','Dubrovnik','Split','Athens','Santorini','Mykonos','Tenerife','Mallorca','Ibiza','Madeira','Algarve','Dubai','Marrakech'];

  function fold(s) { return String(s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase(); }
  var AREA_STEMS = KNOWN_AREAS.map(function (a) {
    var f = fold(a);
    return f.indexOf(' ') > -1 ? f : f.slice(0, Math.max(4, f.length - 2));
  });

  /* ---------- English copy ---------- */
  var S = {
    cat: { photos:'Photos', title:'Title', description:'Description', amenities:'Amenities', reviews:'Reviews & host', booking:'Booking setup' },
    check: {
      photoCount:'Photo count', captions:'Photo captions',
      titleChars:'Characters used', area:'Area in title', style:'Style',
      descLen:'Length', structure:'Structure', sellables:'Selling points', hook:'Opening hook',
      essentials:'Guest essentials', amenityCount:'Amenity count',
      rating:'Guest rating', reviewCount:'Review count', superhost:'Superhost',
      instantBook:'Instant Book', minNights:'Minimum stay', cancellation:'Cancellation policy'
    },
    ess: { wifi:'Wifi', kitchen:'Kitchen', washer:'Washer', workspace:'Dedicated workspace', tv:'TV', parking:'Parking' },
    cancelName: { flexible:'Flexible', moderate:'Moderate', firm:'Firm', strict:'Strict' },
    note: {
      photos: function (n) { return n + (n === 1 ? ' photo' : ' photos'); },
      captioned: function (a, b) { return a + ' of ' + b + ' captioned'; },
      titleChars: function (n) { return n + ' of 50 characters'; },
      areaYes: 'Area mentioned', areaNo: 'No area name',
      styleClean: 'Reads clean', styleSpam: 'Caps/emoji heavy',
      descChars: function (n) { return n + ' characters (full marks at 1200+)'; },
      breaks: function (n) { return n + ' line ' + (n === 1 ? 'break' : 'breaks'); },
      oneBlock: 'One block of text',
      sellables: function (n) { return n + ' named in the text'; },
      hookYes: 'Strong first line', hookNo: 'Generic opening',
      missing: function (l) { return 'Missing: ' + l; }, allPresent: 'All 6 present',
      amenityCount: function (n) { return n + ' listed'; },
      rating: function (r) { return r + ' average'; },
      reviews: function (n) { return n + (n === 1 ? ' review' : ' reviews'); },
      shYes: 'Yes', shNo: 'Not yet', ibOn: 'On', ibOff: 'Off',
      minNights: function (m) { return m + ' night minimum'; },
      notVisible: "Not answered: its weight moved to this area's other checks"
    },
    fix: {
      photosMore: function (n) { return 'Add more photos: you have ' + n + ', and full marks start at 30. Cover every bedroom and bathroom, then the kitchen, living areas and any view or outdoor space.'; },
      captions: 'Add a caption to every photo. Guests skim them and the platform uses them to understand the listing. One line each: what the space is and why it is good.',
      titleChars: function (n) { return 'Your title uses only ' + n + ' of the 50 characters available. Spell out your strongest hook, e.g. "Clifftop 5BR Villa, Infinity Pool, 5 min to Beach".'; },
      area: function (a) { return 'Put the area name in the title. Travellers search by place, and "' + (a || 'your area') + '" does nothing for you hidden in the description.'; },
      style: 'Drop the ALL-CAPS, emoji strings and exclamation marks. Guests read them as spam.',
      descLen: function (n) { return 'Flesh out the description: ' + n + ' characters will not sell the villa. Aim for 1,200 or more, covering the space, the location and what is walkable.'; },
      structure: "Break the description into short sections, because a wall of text gets skimmed past. Use leads like 'The space', 'Guest access', 'The area'.",
      sellables: 'Name the things guests filter for (pool, view, fast wifi, AC, a workspace, a terrace or parking) in the text itself, not just the amenity list.',
      hookWelcome: "Rewrite the first line. 'Welcome to…' is what every listing says. Lead with the single best thing: the view, the pool, the location.",
      hookGeneric: "Lead with your strongest hook in the first sentence. It is the part guests see before tapping 'read more'.",
      essentials: function (l) { return 'Add or switch on these amenities guests filter by: ' + l + '. Every missing filter makes you invisible in that search.'; },
      amenityCount: function (n) { return 'Only ' + n + ' amenities listed. Walk through the villa with the amenity checklist open; each one is a search filter.'; },
      rating: function (r) { return 'Your ' + r + ' star average holds back your search placement. Read your recent critical reviews for the one recurring complaint and fix that first.'; },
      reviewsNone: 'No reviews yet. Price 15 to 20% under the market until the first five reviews land, and personally ask every guest for a review.',
      reviewsFew: function (n) { return 'Only ' + n + ' reviews. Message every guest at checkout with a short, personal request for a review. More reviews help both trust and placement.'; },
      superhost: 'Go for Superhost status: a 4.8+ rating, under 1% cancellations and a 90% response rate. It is a badge guests look for.',
      instantBook: 'Turn on Instant Book. Airbnb says it can help your placement in search, and many guests filter for it.',
      minNights: function (m) { return 'A ' + m + ' night minimum filters you out of many searches. Drop to 2 or 3 nights, at least outside high season.'; },
      cancellation: "A strict cancellation policy costs bookings, and 'flexible' is a filter guests use. Consider loosening it outside peak dates."
    },
    impactLabel: { high: 'High impact', medium: 'Medium', quick: 'Quick win' }
  };

  function gradeFor(score) {
    for (var i = 0; i < GRADE_BANDS.length; i++) if (score >= GRADE_BANDS[i][0]) return GRADE_BANDS[i][1];
    return 'E';
  }

  /* ---------- category builder ---------- */
  function category(key, label) {
    var cat = { key: key, label: label, points: 0, possible: 0, checks: [], fixes: [] };
    cat.add = function (checkLabel, possible, points, note, fix) {
      points = Math.max(0, Math.min(possible, Math.round(points)));
      cat.checks.push({ label: checkLabel, points: points, possible: possible, note: note });
      if (fix) { fix._ci = cat.checks.length - 1; cat.fixes.push(fix); }
    };
    cat.addNA = function (checkLabel, note) {
      cat.checks.push({ label: checkLabel, points: 0, possible: 0, note: note, na: true });
    };
    return cat;
  }

  // Largest-remainder rounding, so the parts always sum to the whole.
  function apportion(exact, total) {
    var floors = exact.map(function (v) { return Math.floor(v); });
    var rest = total - floors.reduce(function (s, v) { return s + v; }, 0);
    var order = exact.map(function (v, i) { return { i: i, frac: v - Math.floor(v) }; })
      .sort(function (a, b) { return b.frac - a.frac; });
    for (var k = 0; k < order.length && rest > 0; k++) { floors[order[k].i] += 1; rest -= 1; }
    return floors;
  }

  function finalize(cat, W) {
    var vis = cat.checks.filter(function (ch) { return ch.possible > 0; });
    var rawPos = vis.reduce(function (s, c) { return s + c.possible; }, 0);
    if (!rawPos) { cat.points = 0; cat.possible = 0; return; }
    var rawPts = vis.reduce(function (s, c) { return s + c.points; }, 0);
    var scale = W / rawPos;
    var newPos = apportion(vis.map(function (c) { return c.possible * scale; }), W);
    var targetPts = Math.round(rawPts * scale);
    var newPts = apportion(vis.map(function (c) { return c.points * scale; }), targetPts);
    for (var i = 0; i < vis.length; i++) {
      while (newPts[i] > newPos[i]) {
        newPts[i] -= 1;
        var j = -1;
        for (var k = 0; k < newPts.length; k++) if (newPts[k] < newPos[k]) { j = k; break; }
        if (j === -1) break;
        newPts[j] += 1;
      }
    }
    vis.forEach(function (c, i) { c.possible = newPos[i]; c.points = newPts[i]; });
    cat.points = targetPts;
    cat.possible = W;
    cat.fixes = cat.fixes.map(function (f) {
      var ch = cat.checks[f._ci];
      return { text: f.text, impact: f.impact, lost: Math.max(0, ch.possible - ch.points) };
    }).filter(function (f) { return f.lost > 0; });
  }

  /* ---------- the six scorers ---------- */
  function scorePhotos(l) {
    var cat = category('photos', S.cat.photos);
    var count = l.photoCount;
    if (count != null) {
      var p = count >= 30 ? 12 : count >= 25 ? 11 : count >= 20 ? 9 : count >= 15 ? 6 : count >= 10 ? 4 : count >= 5 ? 2 : 1;
      cat.add(S.check.photoCount, 12, p, S.note.photos(count), count < 20 ? {
        text: S.fix.photosMore(count), impact: count < 12 ? 'high' : 'medium'
      } : null);
    }
    if (l.captionedCount != null && l.photoCount) {
      var ratio = l.captionedCount / l.photoCount;
      var cp = ratio >= 0.8 ? 8 : ratio >= 0.5 ? 5 : ratio > 0 ? 3 : 0;
      cat.add(S.check.captions, 8, cp, S.note.captioned(l.captionedCount, l.photoCount), ratio < 0.8 ? {
        text: S.fix.captions, impact: ratio === 0 ? 'medium' : 'quick'
      } : null);
    } else if (l.captionsKnown === false) {
      cat.addNA(S.check.captions, S.note.notVisible);
    }
    return cat;
  }

  function scoreTitle(l) {
    var t = (l.title || '').trim();
    if (!t) return null;
    var cat = category('title', S.cat.title);
    var len = t.length;
    var lenPts = (len >= 30 && len <= 50) ? 4 : len >= 20 ? 2 : 1;
    cat.add(S.check.titleChars, 4, lenPts, S.note.titleChars(len), len < 30 ? {
      text: S.fix.titleChars(len), impact: 'high'
    } : null);

    var STOP = ['south','north','east','west','central','beach','villa','pool','house','home','near','walk','this','that','with','provinsi','regency','kabupaten','indonesia','airbnb','stays','restaurants','guests','getting'];
    var hints = (l.locationHints && l.locationHints.length) ? l.locationHints : [l.location || ''];
    var stems = [], areaDisplay = null;
    hints.forEach(function (h) {
      String(h).split(/[^A-Za-zÀ-ɏ]+/).forEach(function (w) {
        if (w.length < 4) return;
        var f = fold(w);
        if (STOP.indexOf(f) > -1) return;
        var stem = f.slice(0, Math.max(4, f.length - 2));
        if (stems.indexOf(stem) === -1) { stems.push(stem); if (!areaDisplay) areaDisplay = w; }
      });
    });
    var tl = fold(t);
    var titleWords = tl.split(/[^a-z0-9]+/);
    var stemHit = function (stem) {
      return stem.indexOf(' ') > -1
        ? tl.indexOf(stem) > -1
        : titleWords.some(function (w) { return w.indexOf(stem) === 0; });
    };
    var gazetteerHit = AREA_STEMS.some(stemHit);
    if (stems.length || gazetteerHit) {
      var hit = gazetteerHit || stems.some(stemHit);
      var area = l.location || areaDisplay;
      cat.add(S.check.area, 3, hit ? 3 : 0, hit ? S.note.areaYes : S.note.areaNo, hit ? null : {
        text: S.fix.area(area), impact: 'medium'
      });
    }

    var letters = t.replace(/[^A-Za-z]/g, '');
    var caps = t.replace(/[^A-Z]/g, '');
    var capsRatio = letters.length ? caps.length / letters.length : 0;
    var emoji = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
    var clean = capsRatio <= 0.45 && emoji <= 2 && !/!{2,}/.test(t);
    cat.add(S.check.style, 3, clean ? 3 : 1, clean ? S.note.styleClean : S.note.styleSpam, clean ? null : {
      text: S.fix.style, impact: 'medium'
    });
    return cat;
  }

  function scoreDescription(l) {
    var d = (l.description || '').trim();
    if (!d) return null;
    var cat = category('description', S.cat.description);
    var chars = d.length;
    var lenPts = chars >= 1200 ? 6 : chars >= 700 ? 4 : chars >= 300 ? 2 : 1;
    cat.add(S.check.descLen, 6, lenPts, S.note.descChars(chars), chars < 700 ? {
      text: S.fix.descLen(chars), impact: 'high'
    } : null);

    var breaks = (d.match(/\n/g) || []).length;
    var structPts = breaks >= 6 ? 5 : breaks >= 2 ? 3 : 1;
    cat.add(S.check.structure, 5, structPts, breaks >= 2 ? S.note.breaks(breaks) : S.note.oneBlock, structPts < 5 ? {
      text: S.fix.structure, impact: 'medium'
    } : null);

    var matches = d.match(SELLABLES) || [];
    var uniq = {};
    matches.forEach(function (s) { uniq[s.toLowerCase().replace(/[^a-z]/g, '')] = 1; });
    var uniqSize = Object.keys(uniq).length;
    var sellPts = uniqSize >= 6 ? 5 : uniqSize >= 4 ? 4 : uniqSize >= 2 ? 2 : uniqSize > 0 ? 1 : 0;
    cat.add(S.check.sellables, 5, sellPts, S.note.sellables(uniqSize), uniqSize < 4 ? {
      text: S.fix.sellables, impact: 'medium'
    } : null);

    var first = d.slice(0, 160);
    var generic = /^\s*welcome to/i.test(first);
    var hook = !generic && (/\d/.test(first) || new RegExp(SELLABLES.source, 'i').test(first));
    cat.add(S.check.hook, 4, hook ? 4 : 2, hook ? S.note.hookYes : S.note.hookNo, hook ? null : {
      text: generic ? S.fix.hookWelcome : S.fix.hookGeneric, impact: 'quick'
    });
    return cat;
  }

  function scoreAmenities(l) {
    var list = Array.isArray(l.amenities) ? l.amenities : null;
    var count = list ? list.length : (l.amenitiesCount != null ? l.amenitiesCount : null);
    if (!list && count == null) return null;
    var cat = category('amenities', S.cat.amenities);
    if (list) {
      var joined = list.join(' | ');
      var missing = ESSENTIALS.filter(function (e) { return !e[1].test(joined); }).map(function (e) { return S.ess[e[0]]; });
      var missingList = missing.join(', ');
      cat.add(S.check.essentials, 6, 6 - missing.length, missing.length ? S.note.missing(missingList) : S.note.allPresent, missing.length ? {
        text: S.fix.essentials(missingList), impact: missing.length >= 3 ? 'high' : 'medium'
      } : null);
    }
    if (count != null) {
      var p = count >= 40 ? 4 : count >= 25 ? 3 : count >= 15 ? 2 : 1;
      cat.add(S.check.amenityCount, 4, p, S.note.amenityCount(count), count < 25 ? {
        text: S.fix.amenityCount(count), impact: 'quick'
      } : null);
    }
    return cat;
  }

  function scoreReviews(l) {
    var cat = category('reviews', S.cat.reviews);
    var r = l.rating;
    if (r != null && r > 0) {
      var p = r >= 4.9 ? 10 : r >= 4.8 ? 8 : r >= 4.6 ? 6 : r >= 4.2 ? 4 : 2;
      cat.add(S.check.rating, 10, p, S.note.rating(r), r < 4.8 ? {
        text: S.fix.rating(r), impact: 'high'
      } : null);
    }
    var n = l.reviewCount;
    if (n != null) {
      var rp = n >= 150 ? 10 : n >= 75 ? 8 : n >= 30 ? 6 : n >= 10 ? 4 : n >= 1 ? 2 : 0;
      cat.add(S.check.reviewCount, 10, rp, S.note.reviews(n), n < 30 ? {
        text: n === 0 ? S.fix.reviewsNone : S.fix.reviewsFew(n), impact: 'medium'
      } : null);
    }
    if (l.isSuperhost != null) {
      cat.add(S.check.superhost, 5, l.isSuperhost ? 5 : 0, l.isSuperhost ? S.note.shYes : S.note.shNo, l.isSuperhost ? null : {
        text: S.fix.superhost, impact: 'quick'
      });
    } else {
      cat.addNA(S.check.superhost, S.note.notVisible);
    }
    return cat;
  }

  function scoreBooking(l) {
    var cat = category('booking', S.cat.booking);
    if (l.instantBook != null) {
      cat.add(S.check.instantBook, 6, l.instantBook ? 6 : 2, l.instantBook ? S.note.ibOn : S.note.ibOff, l.instantBook ? null : {
        text: S.fix.instantBook, impact: 'quick'
      });
    } else { cat.addNA(S.check.instantBook, S.note.notVisible); }

    if (l.minNights != null) {
      var m = l.minNights;
      var p = m <= 2 ? 4 : m === 3 ? 3 : m <= 5 ? 2 : 1;
      cat.add(S.check.minNights, 4, p, S.note.minNights(m), m > 3 ? {
        text: S.fix.minNights(m), impact: 'medium'
      } : null);
    } else { cat.addNA(S.check.minNights, S.note.notVisible); }

    var c = (l.cancellationPolicy || '').toLowerCase();
    var kind = /flexible/.test(c) ? 'flexible' : /moderate/.test(c) ? 'moderate' : /firm/.test(c) ? 'firm' : /strict/.test(c) ? 'strict' : null;
    if (kind) {
      var cp = { flexible: 5, moderate: 4, firm: 3, strict: 1 }[kind];
      cat.add(S.check.cancellation, 5, cp, S.cancelName[kind], cp <= 3 ? {
        text: S.fix.cancellation, impact: 'medium'
      } : null);
    } else { cat.addNA(S.check.cancellation, S.note.notVisible); }
    return cat;
  }

  function scoreListing(l) {
    var built = [scorePhotos(l), scoreTitle(l), scoreDescription(l), scoreAmenities(l), scoreReviews(l), scoreBooking(l)]
      .filter(Boolean);
    built.forEach(function (c) { finalize(c, WEIGHTS[c.key]); });
    var cats = built.filter(function (c) { return c.possible > 0; });
    var points = cats.reduce(function (s, c) { return s + c.points; }, 0);
    var possible = cats.reduce(function (s, c) { return s + c.possible; }, 0);
    var score = possible === 100 ? points : possible ? Math.round((points / possible) * 100) : 0;
    var fixes = [];
    cats.forEach(function (c) {
      c.fixes.forEach(function (f) { fixes.push({ text: f.text, impact: f.impact, lost: f.lost, category: c.label }); });
    });
    fixes.sort(function (a, b) { return IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || b.lost - a.lost; });
    return { score: score, grade: gradeFor(score), points: points, possible: possible, categories: cats, fixes: fixes };
  }

  /* ---------- raw scraper item -> listing object ----------
     Ported from Flatiro's lib/scrape.js. The PHP endpoint returns the raw
     Apify item untouched; every bit of interpretation happens here. */
  function str(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }
  function numOf(v) {
    var n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && isFinite(n) ? n : null;
  }
  function pickNum() {
    for (var i = 0; i < arguments.length; i++) { var n = numOf(arguments[i]); if (n != null) return n; }
    return null;
  }
  function firstBool() {
    for (var i = 0; i < arguments.length; i++) if (typeof arguments[i] === 'boolean') return arguments[i];
    return null;
  }
  function firstArray() {
    for (var i = 0; i < arguments.length; i++) { var v = arguments[i]; if (Array.isArray(v) && v.length) return v; }
    return null;
  }
  function stripHtml(x) {
    return x.replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+\n/g, '\n').trim();
  }

  function normalizeScraped(item, url) {
    var title = str(item.name) || str(item.title) || null;

    // Prefer the HTML description: some actors flatten the line breaks out of
    // the plain-text field, which would unfairly fail the structure check.
    var html = (item.htmlDescription && str(item.htmlDescription.htmlText))
      || (typeof item.htmlDescription === 'string' ? str(item.htmlDescription) : null);
    var description = html ? stripHtml(html) : (str(item.description) || null);
    if (!description && item.sectionedDescription && typeof item.sectionedDescription === 'object') {
      description = Object.keys(item.sectionedDescription)
        .map(function (k) { return item.sectionedDescription[k]; })
        .filter(function (v) { return typeof v === 'string' && v.trim(); })
        .join('\n\n') || null;
    }
    if (description) description = stripHtml(description);

    var photosRaw = firstArray(item.images, item.photos, item.pictures);
    var photoCount = null, captionedCount = null, captionsKnown = false;
    if (photosRaw) {
      photoCount = photosRaw.length;
      captionsKnown = photosRaw.some(function (p) {
        return p && typeof p === 'object' && ('caption' in p || 'accessibilityLabel' in p);
      });
      if (captionsKnown) {
        captionedCount = photosRaw.filter(function (p) {
          var c = p && typeof p === 'object' ? (p.caption || p.accessibilityLabel || '') : '';
          var t = String(c).trim();
          // Airbnb auto-fills "Listing image N" when the host wrote no caption.
          return t.length > 3 && !/^listing image \d+$/i.test(t);
        }).length;
      }
    } else if (typeof item.photosCount === 'number') {
      photoCount = item.photosCount;
    }

    var rating = null, reviewCount = null;
    var r = item.rating;
    if (typeof r === 'number') rating = r;
    else if (r && typeof r === 'object') {
      rating = pickNum(r.guestSatisfaction, r.value, r.average);
      reviewCount = pickNum(r.reviewsCount, r.count);
    }
    if (rating == null) rating = pickNum(item.stars, item.averageRating);
    if (reviewCount == null) {
      reviewCount = pickNum(item.reviewsCount, item.numberOfReviews);
      if (reviewCount == null && Array.isArray(item.reviews)) reviewCount = item.reviews.length;
    }

    var amenities = null;
    if (Array.isArray(item.amenities)) {
      amenities = item.amenities.reduce(function (acc, a) {
        if (typeof a === 'string') return acc.concat([a]);
        if (a && Array.isArray(a.values)) {
          return acc.concat(a.values.filter(function (v) { return v && v.available !== false; })
            .map(function (v) { return str(v.title) || str(v.name) || ''; })
            .filter(Boolean));
        }
        var one = str(a && a.title) || str(a && a.name);
        return one ? acc.concat([one]) : acc;
      }, []).map(function (t) { return t.slice(0, 60); }).slice(0, 80);
      if (!amenities.length) amenities = null;
    }

    var host = item.host || {};
    var isSuperhost = firstBool(host.isSuperhost, host.isSuperHost, item.isSuperhost, item.isHostedBySuperhost);

    var location = str(item.city) || (item.location && str(item.location.city))
      || (typeof item.location === 'string' ? item.location : null)
      || (item.address && str(item.address.city))
      || (typeof item.address === 'string' ? item.address : null) || null;

    // Area names the title could legitimately mention: official fields plus
    // proper nouns from the host's own neighbourhood text, which catches
    // marketed areas filed under an administrative name.
    var locationHints = [];
    var pushHint = function (x) {
      if (typeof x === 'string' && x.trim() && locationHints.length < 40) locationHints.push(x.trim());
    };
    pushHint(location);
    pushHint(str(item.locationSubtitle));
    if (Array.isArray(item.breadcrumbs)) {
      item.breadcrumbs.forEach(function (b) { pushHint(str(b && b.searchText) || str(b && b.linkText)); });
    }
    if (Array.isArray(item.locationDescriptions)) {
      item.locationDescriptions.forEach(function (ld) {
        (String((ld && ld.content) || '').match(/\b[A-ZÀ-Ý][a-zà-ɏ]{3,}\b/g) || []).forEach(pushHint);
      });
    }

    var instantBook = firstBool(item.isInstantBookable, item.instantBookable, item.instantBook);
    var minNights = pickNum(item.minNights, item.minimumStay, item.minimumNights);
    var cancellationPolicy = typeof item.cancellationPolicy === 'string'
      ? item.cancellationPolicy
      : (str(item.cancellationPolicy && item.cancellationPolicy.title)
        || str(item.cancellationPolicies && item.cancellationPolicies[0] && item.cancellationPolicies[0].policyName)
        || null);

    return {
      url: String(url), title: title, description: description,
      location: location, locationHints: locationHints,
      photoCount: photoCount, captionedCount: captionedCount, captionsKnown: captionsKnown,
      amenities: amenities, amenitiesCount: amenities ? amenities.length : null,
      rating: rating, reviewCount: reviewCount, isSuperhost: isSuperhost,
      instantBook: instantBook, minNights: minNights, cancellationPolicy: cancellationPolicy
    };
  }

  function isListingUrl(u) {
    var m;
    try { m = new URL(u); } catch (e) { return false; }
    var h = m.hostname, p = m.pathname;
    if (/(^|\.)airbnb\./.test(h) && /\/(rooms|h|luxury)\//.test(p)) return true;
    if (/(^|\.)booking\.com$/i.test(h) && /^\/hotel\//.test(p)) return true;
    return false;
  }

  /* ---------- elements ---------- */
  var urlForm  = document.getElementById('audit-url-form');
  var manual   = document.getElementById('audit-manual');
  var form     = document.getElementById('audit-form');
  var out      = document.getElementById('audit-result');
  var status   = document.getElementById('audit-status');
  var openManual = document.getElementById('audit-open-manual');
  if (!urlForm || !form || !out) return;

  var LOAD_MSGS = [
    'Fetching your listing…',
    'Counting photos and captions…',
    'Reading the description…',
    'Checking the amenity list…',
    'Benchmarking your reviews…',
    'Scoring booking settings…'
  ];
  var ERRORS = {
    bad_url: 'That does not look like an Airbnb or Booking.com listing URL. Paste the full link, e.g. https://www.airbnb.com/rooms/12345678',
    scrape_unconfigured: 'Automatic fetching is not switched on yet. Enter the details by hand and you will still get the full score.',
    scrape_failed: 'We could not fetch that listing. The platform may have blocked the request. Try again, or enter the details by hand.',
    scrape_empty: 'The fetch came back empty. The listing may be very new or hidden, so enter the details by hand instead.',
    method: 'Something went wrong on our side. Try again, or enter the details by hand.',
    network: 'Could not reach the audit service. Check your connection, try again, or enter the details by hand.'
  };

  /* ---------- status panel ---------- */
  var msgTimer = null;
  function showLoading() {
    var i = 0;
    status.className = 'astatus astatus--busy';
    status.hidden = false;
    status.innerHTML = '<span class="astatus__spin" aria-hidden="true"></span>' +
      '<div><b id="astatus-msg">' + LOAD_MSGS[0] + '</b>' +
      '<em>Usually 20 to 60 seconds. Worth the wait.</em></div>';
    clearInterval(msgTimer);
    msgTimer = setInterval(function () {
      i = (i + 1) % LOAD_MSGS.length;
      var el = document.getElementById('astatus-msg');
      if (el) el.textContent = LOAD_MSGS[i];
    }, 3200);
  }
  function showError(code) {
    clearInterval(msgTimer);
    status.className = 'astatus astatus--error';
    status.hidden = false;
    status.innerHTML = '<div><b>We could not finish that</b><em>' + esc(ERRORS[code] || ERRORS.method) + '</em>' +
      '<span class="astatus__acts">' +
      '<button class="btn btn--ghost btn--sm" type="button" data-retry>Try again</button> ' +
      '<button class="btn btn--sm" type="button" data-manual>Enter details by hand</button>' +
      '</span></div>';
  }
  function hideStatus() { clearInterval(msgTimer); status.hidden = true; status.innerHTML = ''; }

  function revealManual(focus) {
    manual.hidden = false;
    if (openManual) openManual.hidden = true;
    if (focus !== false) {
      form.querySelector('#af-title').focus({ preventScroll: true });
      goTo(manual);
    }
  }
  function smooth() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }
  // v4: newly shown blocks change the page height, so ScrollTrigger re-measures,
  // and scrolling goes through the page's smooth scroll when it is running.
  function goTo(el) {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    if (typeof window.ivScrollTo === 'function') window.ivScrollTo(el);
    else el.scrollIntoView({ behavior: smooth(), block: 'start' });
  }

  status.addEventListener('click', function (e) {
    if (e.target.closest('[data-manual]')) { hideStatus(); revealManual(); }
    if (e.target.closest('[data-retry]')) { hideStatus(); urlForm.requestSubmit(); }
  });
  if (openManual) openManual.addEventListener('click', function () { revealManual(); });

  /* ---------- automatic: URL -> PHP endpoint -> normalize -> score ---------- */
  urlForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var field = urlForm.elements.url;
    var url = field.value.trim();
    out.hidden = true;
    out.innerHTML = '';

    if (!isListingUrl(url)) { showError('bad_url'); return; }

    var btn = urlForm.querySelector('button[type=submit]');
    var lab = btn.querySelector('[data-label]') || btn;
    var label = lab.textContent;
    btn.disabled = true;
    lab.textContent = 'Auditing…';
    showLoading();

    fetch('/api/audit.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    })
      .then(function (res) { return res.json().catch(function () { return { ok: false, code: 'method' }; }); })
      .then(function (data) {
        if (!data || !data.ok || !data.item) throw Object.assign(new Error('audit'), { code: (data && data.code) || 'method' });
        hideStatus();
        render(scoreListing(normalizeScraped(data.item, url)), url);
      })
      .catch(function (err) {
        showError(err && err.code ? err.code : 'network');
      })
      .then(function () {
        btn.disabled = false;
        lab.textContent = label;
      });
  });

  /* ---------- manual fallback ---------- */
  var numField = function (name) {
    var v = form.elements[name].value.trim();
    if (v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  };
  var bool = function (name) { return form.elements[name].checked; };
  // yes / no / "not sure" - an unanswered question is dropped from the score
  // and its weight moves to the other checks, never counted against you.
  var tri = function (name) {
    var v = form.elements[name].value;
    return v === 'yes' ? true : v === 'no' ? false : null;
  };

  function readForm() {
    var photos = numField('photos');
    var capMode = form.elements.captions.value;
    var captioned = null, captionsKnown = true;
    if (photos != null && capMode === 'most') captioned = Math.round(photos * 0.9);
    else if (photos != null && capMode === 'some') captioned = Math.round(photos * 0.4);
    else if (capMode === 'none') captioned = 0;
    else captionsKnown = false;

    // Rebuild an amenity list: the ticked essentials, padded to the stated
    // total so both the essentials check and the count check stay honest.
    var total = numField('amenities');
    var names = { wifi: 'Wifi', kitchen: 'Kitchen', washer: 'Washer', workspace: 'Dedicated workspace', tv: 'TV', parking: 'Parking' };
    var picked = [];
    Object.keys(names).forEach(function (k) { if (bool('ess_' + k)) picked.push(names[k]); });
    var amenities = null;
    if (total != null) {
      amenities = picked.slice();
      for (var i = picked.length; i < total; i++) amenities.push('Other amenity ' + i);
    } else if (picked.length) {
      amenities = picked;
    }

    var area = form.elements.area.value.trim();
    return {
      title: form.elements.title.value,
      description: form.elements.description.value,
      location: area,
      locationHints: area ? [area] : [],
      photoCount: photos,
      captionedCount: captioned,
      captionsKnown: captionsKnown,
      amenities: amenities,
      amenitiesCount: total,
      rating: numField('rating'),
      reviewCount: numField('reviews'),
      isSuperhost: tri('superhost'),
      instantBook: tri('instant'),
      minNights: numField('minnights'),
      cancellationPolicy: form.elements.cancellation.value
    };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    hideStatus();
    render(scoreListing(readForm()), '');
  });

  form.addEventListener('reset', function () {
    out.hidden = true;
    out.innerHTML = '';
    var cta = document.getElementById('audit-followup');
    if (cta) cta.hidden = true;
  });

  /* ---------- rendering ---------- */
  function esc(x) {
    return String(x).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function render(res, url) {
    var pct = Math.max(0, Math.min(100, res.score));
    var tone = pct >= 76 ? 'good' : pct >= 52 ? 'mid' : 'low';

    var cats = res.categories.map(function (c) {
      var checks = c.checks.map(function (ch) {
        if (ch.na) return '<li class="chk chk--na"><span>' + esc(ch.label) + '</span><em>' + esc(ch.note) + '</em><b>-</b></li>';
        var state = ch.points === ch.possible ? 'full' : ch.points === 0 ? 'zero' : 'part';
        return '<li class="chk chk--' + state + '"><span>' + esc(ch.label) + '</span><em>' + esc(ch.note) + '</em><b>' + ch.points + '/' + ch.possible + '</b></li>';
      }).join('');
      var w = c.possible ? Math.round(c.points / c.possible * 100) : 0;
      return '<article class="acat">' +
        '<header><h4>' + esc(c.label) + '</h4><span class="acat__pts">' + c.points + '<i>/' + c.possible + '</i></span></header>' +
        '<span class="acat__bar"><i style="width:' + w + '%"></i></span>' +
        '<ul class="acat__checks">' + checks + '</ul>' +
        '</article>';
    }).join('');

    var fixes = res.fixes.length
      ? res.fixes.map(function (f, i) {
          return '<li class="afix afix--' + f.impact + '">' +
            '<span class="afix__n">' + (i + 1) + '</span>' +
            '<div><p>' + esc(f.text) + '</p>' +
            '<span class="afix__meta"><b>' + S.impactLabel[f.impact] + '</b><em>' + esc(f.category) + '</em><i>+' + f.lost + ' pts</i></span>' +
            '</div></li>';
        }).join('')
      : '<li class="afix afix--none"><div><p>Nothing major to fix: this listing is in great shape.</p></div></li>';

    out.innerHTML =
      '<div class="ascore ascore--' + tone + '">' +
        '<div class="ascore__dial" style="--pct:' + pct + '">' +
          '<span class="ascore__n">' + pct + '<i>/100</i></span>' +
          '<span class="ascore__grade">Grade ' + res.grade + '</span>' +
        '</div>' +
        '<div class="ascore__txt">' +
          '<h3>Your listing scored ' + pct + ' out of 100.</h3>' +
          '<p>' + (res.fixes.length
            ? 'There are <b>' + res.fixes.length + '</b> fixes below, ordered by what they are worth. Recovering them all would take you to <b>100</b>.'
            : 'No material problems found: the fundamentals are all in place.') + '</p>' +
          '<p class="ascore__fine">Guidance based on hosting best practice, not the platforms’ official ranking. Nobody outside Airbnb has that.</p>' +
        '</div>' +
      '</div>' +
      '<div class="abreak"><h3>The breakdown</h3><div class="acats">' + cats + '</div></div>' +
      '<div class="afixes"><h3>' + (res.fixes.length ? 'Fixes, in order of impact' : 'Fixes') + '</h3><ol class="afix-list">' + fixes + '</ol></div>';

    out.hidden = false;

    // hand the score (and the link, when we have it) to the follow-up form
    var carry = document.querySelector('[name="listing_score"]');
    if (carry) carry.value = pct + '/100 (grade ' + res.grade + ', ' + res.fixes.length + ' fixes)';
    var link = document.querySelector('.afollow__form [name="listing_url"]');
    if (link && url) link.value = url;
    var cta = document.getElementById('audit-followup');
    if (cta) cta.hidden = false;

    out.setAttribute('tabindex', '-1');
    out.focus({ preventScroll: true });
    goTo(out);
  }

})();
