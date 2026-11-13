/* Guest inbox: every Hostex conversation (admins) or the ones about a manager's villas (lib/managers.js).
 * Hostex lists some Airbnb threads twice (once per connected account, e.g. 0-2710708520 and 0-2710708520-340733738);
 * the list shows each thread once. Sent replies are logged in inbox/{conversationId}.
 * draft() (AI reply drafts) is kept on the server but the page doesn't offer it at the moment. */
const { Timestamp } = require("firebase-admin/firestore");
const { firstName, pool, clip } = require("./util");
const { chLabel, propOfListing, rentalRevenue } = require("./hostex");
const { aiText } = require("./ai");
const { clientsByProperty, onbFor } = require("./revenue");

const fail = (code, msg) => Object.assign(new Error(msg), { code });
// Hostex conversation ids look like 0-2710838108; anything else is refused before it reaches Hostex or Firestore paths
const convId = id => { const s = String(id ?? ""); if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(s)) throw fail("invalid-argument", "Unknown conversation."); return s; };

function propOfThread(props, t) {
  for (const a of t.activities || []) {
    if (a.property && (a.property.id || a.property.property_id)) { const p = props.find(x => String(x.id) === String(a.property.id || a.property.property_id)); if (p) return p; }
    if (a.listing_id) { const p = propOfListing(props, a.listing_id); if (p) return p; }
  }
  if (t.property_title) return props.find(p => p.title === t.property_title) || null;
  return null;
}
// oldest first, each message once (same id, or same sender + text + minute)
const ordered = t => { const seen = new Set(), out = [];
  for (const m of [...(t.messages || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    const k1 = "i" + m.id, k2 = [m.sender_role, String(m.content || "").trim(), String(m.created_at || "").slice(0, 16)].join("|");
    if ((m.id && seen.has(k1)) || seen.has(k2)) continue; if (m.id) seen.add(k1); seen.add(k2); out.push(m);
  }
  return out; };
// one entry per real conversation: drop "<id>-<account>" copies of a listed "<id>", then same guest + same last message
function dedupe(convs) {
  const ids = new Set(convs.map(c => String(c.id))), byKey = new Map();
  for (const c of convs) {
    const m = String(c.id).match(/^(.+)-(\d{6,})$/); if (m && ids.has(m[1])) continue;
    const k = [c.channel_type, c.guest?.name || "", c.last_message_at || "", c.check_in_date || ""].join("|"), cur = byKey.get(k);
    if (!cur || String(c.id).length < String(cur.id).length) byKey.set(k, c);
  }
  return [...byKey.values()];
}

// one row of the conversation list (t = the opened thread, if we have it)
function row(c, t, props) {
  const msgs = t ? ordered(t) : [], last = msgs[msgs.length - 1], p = t ? propOfThread(props, t) : props.find(x => x.title && x.title === c.property_title);
  const act = (t?.activities || [])[0] || {};
  return { id: c.id, channel: chLabel(c.channel_type), channelType: c.channel_type || "", guest: c.guest?.name || "Guest", at: c.last_message_at, villa: p?.title || c.property_title || "", pid: p ? Number(p.id) : null,
    checkIn: c.check_in_date || act.check_in_date || "", checkOut: c.check_out_date || act.check_out_date || "", kind: act.activity_type || "",
    waiting: last ? last.sender_role === "guest" : null, preview: last ? clip(last.content || (last.attachment ? "[image]" : ""), 140) : "" };
}
async function list({ api, limit = 40 }) {
  const props = await api.properties();
  const d = await api.hx("GET", "/conversations", { query: { offset: 0, limit: 100 } });
  const convs = dedupe(d?.conversations || api.firstArray(d)).sort((a, b) => String(b.last_message_at).localeCompare(String(a.last_message_at))).slice(0, limit);
  // open the most recent threads to see who wrote last
  const detail = await pool(convs.slice(0, 15), 4, c => api.hx("GET", "/conversations/" + encodeURIComponent(c.id)).catch(() => null));
  return convs.map((c, i) => row(c, detail[i], props));
}

// villa facts for the AI, from onboarding (client record) and Hostex
const FACTS = [["villaName", "Villa"], ["area", "Area"], ["address", "Address"], ["maps", "Google Maps"], ["bedrooms", "Bedrooms"], ["bathrooms", "Bathrooms"], ["guests", "Max guests"], ["rooms", "Bedrooms and beds"],
  ["sleepExtra", "Extra sleeping"], ["checkin", "Check-in time"], ["checkout", "Check-out time"], ["access", "How guests get in"], ["arrival", "Arrival instructions"], ["beforeArrival", "Before arrival"], ["wifiName", "Wi-Fi name"], ["wifiPass", "Wi-Fi password"], ["wifi", "Wi-Fi speed (Mbps)"],
  ["power", "Backup power"], ["pool", "Pool"], ["outdoor", "Outdoor"], ["views", "Views"], ["essentials", "Essentials"], ["entertainment", "Entertainment"], ["bathFeatures", "Bathrooms"], ["kitchenItems", "Kitchen"], ["staff", "Included for guests"], ["services", "Services"], ["family", "Family-friendly"], ["parkingAccess", "Parking and access"],
  ["housekeeping", "Housekeeping during a stay"], ["quietHours", "Quiet hours from"], ["petsAllowed", "Pets allowed"], ["childrenAllowed", "Children allowed"], ["eventsAllowed", "Events allowed"], ["partiesAllowed", "Parties allowed"], ["smoking", "Smoking"], ["earlyRules", "Early check-in"], ["lateRules", "Late check-out"],
  ["extraBed", "Extra bed"], ["extraBedFee", "Extra bed fee per night"], ["extraGuest", "Extra guest fee per night"], ["deposit", "Security deposit"], ["cancel", "Cancellation policy"], ["upsellList", "Extras for sale"], ["parking", "Parking spaces"],
  ["attractions", "Nearby attractions"], ["recommendations", "Recommendations"], ["locationNotes", "About the location"], ["hospitalName", "Nearest hospital"], ["clinicName", "Nearest clinic"], ["managerName", "On-site manager"], ["amenityNotes", "Other notes"], ["listingFeel", "Tone"], ["wordsAvoid", "Words to avoid"],
  // answers saved before the per-property form (older records keep these instead)
  ["beds", "Beds"], ["checkinBy", "How guests check in"], ["inside", "Comfort"], ["rules", "House rules"], ["events", "Events"], ["upsells", "Extras for sale"], ["hospital", "Nearest hospital"]];
function knowledge(prop, onb) {
  const v = x => (Array.isArray(x) ? x.map(y => (y && typeof y === "object" ? Object.values(y).filter(Boolean).join(" / ") : y)).filter(Boolean).join("; ") : String(x ?? "").trim());
  const rows = FACTS.map(([k, l]) => [l, v(onb?.[k])]).filter(([, x]) => x);
  if (prop) {
    if (prop.default_checkin_time && !onb?.checkin) rows.push(["Check-in time", prop.default_checkin_time]);
    if (prop.default_checkout_time && !onb?.checkout) rows.push(["Check-out time", prop.default_checkout_time]);
    if (prop.wifi_ssid && !onb?.wifiName) rows.push(["Wi-Fi name", prop.wifi_ssid]);
    if (prop.wifi_password && !onb?.wifiPass) rows.push(["Wi-Fi password", prop.wifi_password]);
    if (prop.address && !onb?.address) rows.push(["Address", prop.address]);
  }
  return rows.map(([l, x]) => `${l}: ${x}`).join("\n");
}

// raw: the Hostex conversation when the caller already opened it (villa managers check the villa first)
async function thread({ api, db, id, raw }) {
  id = convId(id);
  const [props, t] = await Promise.all([api.properties(), raw || api.hx("GET", "/conversations/" + encodeURIComponent(id))]);
  if (!t) throw fail("not-found", "Conversation not found.");
  const p = propOfThread(props, t), owners = p ? await clientsByProperty(db) : new Map(), cl = p ? owners.get(String(p.id)) : null;
  const act = (t.activities || []).find(a => a.reservation_code) || (t.activities || [])[0] || {};
  let booking = null;
  if (act.reservation_code) { try { const r = api.firstArray(await api.hx("GET", "/reservations", { query: { reservation_code: act.reservation_code, offset: 0, limit: 5 } })).find(x => x.reservation_code === act.reservation_code);
    if (r) { const v = rentalRevenue(r), tot = r.rates?.total_rate || null, pay = r.payment || {}, ci = r.check_in_details || {}, hm = x => (x && x.hour != null ? `${String(x.hour).padStart(2, "0")}:${String(x.minute || 0).padStart(2, "0")}` : "");
      booking = { code: r.reservation_code, checkIn: r.check_in_date, checkOut: r.check_out_date, guests: r.number_of_guests, adults: r.number_of_adults ?? null, children: r.number_of_children ?? null, infants: r.number_of_infants ?? null, pets: r.number_of_pets ?? null,
        status: r.status, stayStatus: r.stay_status || "", channel: chLabel(r.channel_type), bookedAt: r.booked_at || r.created_at || "", remarks: r.remarks || "",
        lock: ci.lock_code || "", arrival: hm(ci.arrival_at), departure: hm(ci.departure_at),
        total: tot ? Number(tot.amount) : v ? Math.round(v.amount) : null, currency: tot?.currency || v?.currency || "", paid: pay.received_amount ?? null, balance: pay.balance_amount ?? null }; } } catch (e) {} }
  const g = t.guest || {};
  return { id, channel: chLabel(t.channel_type), channelType: t.channel_type || "", guest: g.name || "Guest", contact: { phone: g.phone || "", email: g.email || "" },
    villa: p?.title || "", pid: p ? Number(p.id) : null, client: cl?.email || "",
    activity: { kind: act.activity_type || "", checkIn: act.check_in_date || "", checkOut: act.check_out_date || "" }, booking, note: t.note || "",
    messages: ordered(t).map(m => ({ id: m.id, from: m.sender_role === "guest" ? "guest" : "host", auto: /^bot:/i.test(m.sender_name || ""), text: m.content || "", image: !!m.attachment, at: m.created_at })),
    hasFacts: !!cl };
}

async function draft({ api, db, key, id, instruction, raw }) {
  id = convId(id);
  const [props, t] = await Promise.all([api.properties(), raw || api.hx("GET", "/conversations/" + encodeURIComponent(id))]);
  const p = propOfThread(props, t), cl = p ? (await clientsByProperty(db)).get(String(p.id)) : null;
  const msgs = ordered(t).slice(-20), act = (t.activities || [])[0] || {}, guest = firstName(t.guest?.name || "");
  const ota = ["airbnb", "booking.com", "agoda", "expedia", "vrbo"].includes(t.channel_type);
  const system = `You draft replies to holiday-villa guests for IndaVillas, who manage ${p?.title || "the villa"} in Bali. A team member reviews every draft before it is sent.
Rules:
- Use only the villa facts below and what the conversation says. If the guest asks something the facts don't cover, write [TEAM: what to confirm] in square brackets at that spot instead of guessing.
- Warm, concise, practical: usually 2–5 short sentences. Greet the guest by first name. Sign off as "The IndaVillas team".
- Reply in the guest's language.${ota ? "\n- This is an OTA thread: no phone numbers, emails, links or payment requests outside the platform." : ""}
- Never promise refunds, discounts, early check-in or late check-out unless the facts or the instruction say so; offer to check instead.
Villa facts:
${knowledge(p, onbFor(cl?.data, p?.title)) || "(no onboarding answers on file for this villa)"}`;
  const prompt = `Booking: ${act.activity_type || "unknown"}${act.check_in_date ? `, ${act.check_in_date} → ${act.check_out_date}` : ""}, channel ${chLabel(t.channel_type)}\nGuest: ${guest || "unknown"}\n\nConversation, oldest first:\n${msgs.map(m => `${m.sender_role === "guest" ? "GUEST" : "HOST"} (${String(m.created_at).slice(0, 16)}): ${(m.content || (m.attachment ? "[image]" : "")).slice(0, 1500)}`).join("\n")}\n\n${instruction ? `Instruction from the team: ${String(instruction).slice(0, 500)}\n\n` : ""}Write only the reply to send next.`;
  const text = await aiText(key, { system, prompt, maxTokens: 600 });
  return { draft: text, needsCheck: /\[TEAM:/i.test(text), facts: !!cl };
}

async function send({ api, db, id, message, me, ai }) {
  id = convId(id);
  const text = String(message || "").trim();
  if (!text) throw fail("invalid-argument", "Write a message first.");
  if (/\[TEAM:/i.test(text)) throw fail("failed-precondition", "Fill in the [TEAM: …] parts before sending.");
  await api.hx("POST", "/conversations/" + encodeURIComponent(id), { body: { message: text.slice(0, 5000) } });
  const ref = db.doc("inbox/" + id), cur = (await ref.get()).data() || {};
  await ref.set({ sent: [...(cur.sent || []), { at: new Date().toISOString(), by: me, text: text.slice(0, 5000), ai: !!ai }].slice(-50), updatedAt: Timestamp.now() }, { merge: true });
  return { ok: true };
}

module.exports = { list, row, ordered, dedupe, convId, thread, draft, send, knowledge, propOfThread };
