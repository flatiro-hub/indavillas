/* Small shared helpers: Bali dates, maths, text. */
const TZ = "Asia/Makassar"; // Bali

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const monthAdd = (m, n) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };
const dim = m => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
const monthEnd = m => m + "-" + String(dim(m)).padStart(2, "0");
const dow = s => new Date(s + "T00:00:00Z").getUTCDay();
const median = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const mode = a => { const c = {}; let best = null; for (const x of a) if (x != null) { c[x] = (c[x] || 0) + 1; if (best == null || c[x] > c[best]) best = x; } return best == null ? null : Number(best); };
const norm = s => String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const round1 = v => Math.round(v * 10) / 10;
const firstName = s => (String(s || "").trim().split(/\s+/)[0] || "");
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const monthName = m => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const clip = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const num = v => (v === "" || v == null || isNaN(Number(String(v).replace(/[, ]/g, ""))) ? null : Number(String(v).replace(/[, ]/g, "")));

// run fn over items with at most n in flight
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

module.exports = { TZ, today, addDays, daysBetween, monthAdd, dim, monthEnd, dow, median, mode, norm, round1, firstName, uid, monthName, clip, num, pool };
