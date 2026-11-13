/* Review insights from Hostex reviews: scores, trend, categories, themes guests mention, recent reviews.
 * Owners see the insights (public review text only). Private feedback is only ever shown to admins and never quoted in replies. */
const { addDays, monthAdd, firstName, clip, round1 } = require("./util");
const { chLabel } = require("./hostex");
const { aiOn, aiText } = require("./ai");

// all reviews with a guest review, checked out in the last ~2 years (Hostex allows <180 days per request)
async function fetchReviews(api, now, { propertyId, back = 730 } = {}) {
  const seen = new Map();
  for (const status of ["reviewed", "pending_host_review"]) {
    for (let end = now; end > addDays(now, -back); end = addDays(end, -179)) {
      const start = addDays(end, -178);
      let list = [];
      try { list = await api.all("/reviews", "reviews", { review_status: status, start_check_out_date: start, end_check_out_date: end, property_id: propertyId }, 2000); } catch (e) { if (status === "reviewed" && end === now) throw e; }
      for (const r of list) seen.set(String(r.reservation_code || r.id) + "|" + (r.property_id || ""), { ...r, _status: status });
    }
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ normalising */
const CAT = { cleanliness: "Cleanliness", accuracy: "Accuracy", checkin: "Check-in", check_in: "Check-in", communication: "Communication", location: "Location", value: "Value", staff: "Staff", comfort: "Comfort", facilities: "Facilities", value_for_money: "Value" };
function parse(r) {
  const g = r.guest_review || r.review || {};
  let score = g.score ?? g.rating ?? g.overall_rating ?? r.score ?? null; score = score == null ? null : Number(score);
  const scale = r.channel_type === "booking.com" || (score != null && score > 5) ? 10 : 5;
  const s5 = score == null ? null : round1(scale === 10 ? score / 2 : score);
  let cats = g.category_ratings || g.categories || null; const catOut = {};
  if (Array.isArray(cats)) for (const c of cats) { const k = String(c.category || c.name || "").toLowerCase(); const v = Number(c.rating ?? c.score); if (k && !isNaN(v)) catOut[CAT[k] || k] = v > 5 ? v / 2 : v; }
  else if (cats && typeof cats === "object") for (const [k, v] of Object.entries(cats)) if (!isNaN(Number(v))) catOut[CAT[k.toLowerCase()] || k] = Number(v) > 5 ? Number(v) / 2 : Number(v);
  const text = String(g.content ?? g.comment ?? g.public_review ?? "").trim();
  const reply = r.host_reply?.content ?? (typeof r.host_reply === "string" ? r.host_reply : null);
  return { code: r.reservation_code || "", pid: Number(r.property_id), date: String(r.check_out_date || g.created_at || "").slice(0, 10), channel: chLabel(r.channel_type), channelType: r.channel_type || "",
    score: s5, text, cats: catOut, reply: reply ? String(reply) : "", guest: firstName(r.guest_name || r.guest?.name || ""), priv: String(g.private_feedback || g.private_review || "").trim(), status: r._status || "" };
}

/* ------------------------------------------------------------------ themes */
const THEMES = [
  ["clean", "Cleanliness", /\b(clean|spotless|tidy|immaculate|dirt|dirty|dust|dusty|stain|smell|smelly|mou?ld|ants?|insects?|bugs?|cockroach|hair)\b/i],
  ["staff", "Staff & service", /\b(staff|team|host|service|helpful|friendly|butler|manager|housekeep\w*|responsive|communication|reply|replied)\b/i],
  ["location", "Location", /\b(location|located|beach|walk(ing)?|close to|near(by)?|area|neighbou?rhood|restaurants?|cafes?|shops?)\b/i],
  ["pool", "Pool & garden", /\b(pool|garden|outdoor|terrace|deck|view|sunset|rice ?fields?)\b/i],
  ["comfort", "Beds & comfort", /\b(beds?|pillows?|mattress|sheets?|linen|comfortable|comfy|sleep)\b/i],
  ["ac", "Air con & power", /\b(a\/c|ac|air ?con\w*|aircon|fan|hot water|power|electricity|blackout|generator)\b/i],
  ["wifi", "Wi-Fi", /\b(wi-?fi|internet|connection|signal)\b/i],
  ["noise", "Noise", /\b(noise|noisy|loud|quiet|peaceful|roosters?|dogs? bark\w*|construction|traffic|scooters?)\b/i],
  ["checkin", "Arrival & check-in", /\b(check-?in|check-?out|arrival|arrived|airport|driver|pick-?up|keys?|lock ?box|find the (villa|place))\b/i],
  ["value", "Value", /\b(value|price|priced|worth|expensive|cheap|money)\b/i],
  ["kitchen", "Kitchen & amenities", /\b(kitchen|coffee|towels?|toiletries|tv|netflix|amenities|washing machine|cutlery|cooking)\b/i],
  ["photos", "Matches the photos", /\b(photos?|pictures?|as described|accurate|exactly like|better than|looked like)\b/i],
];
const NEG = /\b(unfortunately|dirty|broken|not working|didn'?t work|did not work|wasn'?t|was not|weren'?t|noisy|loud|smell(s|ed|y)?|problems?|issues?|slow|weak|cold water|no hot water|mosquito\w*|ants|disappoint\w*|could be better|could use|needs? (a|an|some|more|to)|lacking|missing|poor|bad|tired|leak\w*|mou?ld\w*|uncomfortable|hard to find|too (small|hot|cold|far|noisy|loud|dark|soft|hard)|stain\w*|dust\w*|dirt\w*|worn|rusty|stopped working|no wi-?fi|kept dropping|cockroach\w*)\b/i;
const POS = /\b(amazing|great|perfect|lovely|beautiful|clean|spotless|wonderful|excellent|fantastic|best|loved|love|helpful|friendly|comfortable|stunning|incredible|recommend\w*|peaceful|quiet|fast|easy|spacious|gorgeous|superb|immaculate)\b/i;
const sentences = t => String(t).replace(/\s+/g, " ").split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 3);
const clauses = s => s.split(/\b(?:but|however|although|though|except|apart from|other than)\b|;/i).map(x => x.trim()).filter(Boolean);

function themesOf(list) {
  const out = THEMES.map(([key, label]) => ({ key, label, pos: 0, neg: 0, quotes: { pos: [], neg: [] } })), by = Object.fromEntries(out.map(x => [x.key, x]));
  for (const r of list) {
    if (!r.text) continue;
    for (const s of sentences(r.text)) {
      const hit = {}; // theme → negative?  (a theme counts once per sentence; negative wins)
      for (const c of clauses(s)) for (const [key, , re] of THEMES) {
        if (!re.test(c)) continue;
        const neg = NEG.test(c) || (r.score != null && r.score <= 3 && !POS.test(c));
        hit[key] = hit[key] || neg;
      }
      for (const [key, neg] of Object.entries(hit)) {
        const t = by[key]; if (neg) t.neg++; else t.pos++;
        const q = neg ? t.quotes.neg : t.quotes.pos; if (q.length < 3 && !q.some(x => x.text === clip(s, 180))) q.push({ text: clip(s, 180), score: r.score, date: r.date });
      }
    }
  }
  return out.filter(t => t.pos + t.neg).sort((a, b) => b.pos + b.neg - (a.pos + a.neg));
}

/* ------------------------------------------------------------------ insights (owner-visible) */
// parsed: output of parse() for every review in the account
function insights(parsed, pids, now) {
  const ids = pids.map(Number), list = parsed.filter(r => ids.includes(r.pid) && (r.score != null || r.text)).sort((a, b) => b.date.localeCompare(a.date));
  const avg = a => { const b = a.filter(x => x.score != null); return b.length ? round1(b.reduce((s, x) => s + x.score, 0) / b.length) : null; };
  const y1 = addDays(now, -365), y2 = addDays(now, -730);
  const last12 = list.filter(r => r.date >= y1), prev12 = list.filter(r => r.date < y1 && r.date >= y2);
  const dist = [5, 4, 3, 2, 1].map(k => ({ stars: k, n: last12.filter(r => r.score != null && Math.round(r.score) === k).length }));
  const catSum = {}; for (const r of last12) for (const [k, v] of Object.entries(r.cats)) { (catSum[k] ||= [0, 0]); catSum[k][0] += v; catSum[k][1]++; }
  const categories = Object.entries(catSum).map(([k, [s, n]]) => ({ key: k, avg: round1(s / n), n })).sort((a, b) => a.avg - b.avg);
  const q = d => d.slice(0, 4) + " Q" + (Math.floor((+d.slice(5, 7) - 1) / 3) + 1), qs = {};
  for (const r of list.filter(x => x.date >= y2 && x.score != null)) { const k = q(r.date); (qs[k] ||= []).push(r); }
  const channels = {}; for (const r of last12) channels[r.channel] = (channels[r.channel] || 0) + 1;
  return {
    count: list.length, avg: avg(list), last12: { n: last12.length, avg: avg(last12) }, prev12: prev12.length ? { n: prev12.length, avg: avg(prev12) } : null,
    distribution: dist, categories, quarters: Object.entries(qs).sort().map(([k, a]) => ({ q: k, n: a.length, avg: avg(a) })),
    channels: Object.entries(channels).map(([c, n]) => ({ channel: c, n })).sort((a, b) => b.n - a.n),
    themes: themesOf(last12.length >= 5 ? last12 : list).slice(0, 10),
    recent: list.slice(0, 25).map(r => ({ date: r.date, channel: r.channel, score: r.score, text: clip(r.text, 900), guest: r.guest, replied: !!r.reply })),
    low: last12.filter(r => r.score != null && r.score <= 3).length,
    unanswered: list.filter(r => r.text && !r.reply && r.date >= addDays(now, -30)).length,
  };
}

// short "what guests love / what to fix" from the last 12 months, cached by a hash of the review set
async function aiSummary(key, list, villa, prev) {
  if (!aiOn(key) || list.length < 3) return null;
  const sample = list.filter(r => r.text).slice(0, 40);
  const hash = sample.map(r => r.code + r.date + r.score).join("|").length + ":" + sample.length + ":" + (sample[0]?.code || "");
  if (prev && prev.hash === hash) return prev;
  const text = await aiText(key, { maxTokens: 500,
    system: "You analyse guest reviews of a holiday villa for its owner. Be specific and factual, use only what the reviews say, no marketing language. British English.",
    prompt: `Villa: ${villa}\nReviews (newest first, score out of 5):\n${sample.map(r => `- ${r.date} · ${r.score ?? "?"}/5 · ${r.text.replace(/\s+/g, " ").slice(0, 600)}`).join("\n")}\n\nReply with JSON only: {"love":["3 short points guests praise most"],"fix":["up to 3 short, concrete things to improve, or [] if none"],"line":"one sentence summary"}` });
  try { const j = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()); return { hash, love: (j.love || []).slice(0, 3), fix: (j.fix || []).slice(0, 3), line: String(j.line || ""), at: new Date().toISOString() }; }
  catch (e) { return null; }
}

/* ------------------------------------------------------------------ admin: replies */
async function pendingReplies({ api, pids, now }) {
  const out = [];
  for (const pid of pids) { const list = await fetchReviews(api, now, { propertyId: pid, back: 180 }); out.push(...list.map(parse)); }
  return out.filter(r => r.text && !r.reply).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
}
async function draftReply({ key, review, villa, knowledge }) {
  return aiText(key, { maxTokens: 400,
    system: `You write the host's public reply to a guest review of ${villa}, for IndaVillas. Warm, gracious, specific to what the guest wrote, 2–4 sentences. Thank them by first name if given. If they raised a problem, acknowledge it briefly and say what was done or will be done only if the notes say so; never invent fixes. Never mention or hint at private feedback. No emojis, no links, no phone numbers. Reply in the language of the review.`,
    prompt: `Guest: ${review.guest || "(no name)"}\nScore: ${review.score ?? "?"}/5\nReview: ${review.text}\n${knowledge ? "\nNotes from the team (may be empty):\n" + knowledge : ""}\n\nWrite only the reply text.` });
}

module.exports = { fetchReviews, parse, insights, aiSummary, pendingReplies, draftReply, themesOf };
