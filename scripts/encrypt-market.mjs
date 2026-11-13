// Encrypts the AirDNA market dataset for the Cloudflare function behind /api/market.
//
//   MARKET_KEY=<base64 key> node scripts/encrypt-market.mjs [api/data/market-bali.php]
//   node scripts/encrypt-market.mjs --new-key        prints a fresh key (keep it; add it to Cloudflare)
//
// The dataset is purchased AirDNA data and must never be readable from this public repo, so it is
// stored AES-256-GCM encrypted, one piece per bedroom count plus an id → bedrooms index. Only the
// Cloudflare function holds MARKET_KEY (Pages project → Settings → Variables and secrets).
// Input: api/data/market-bali.php as written by _build/market/build_market.py (kept out of git).
// Output: functions-lib/market-data.js (encrypted, safe to commit).
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

if (process.argv.includes("--new-key")) { console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64")); process.exit(0); }
const KEY = process.env.MARKET_KEY;
if (!KEY) { console.error("Set MARKET_KEY (node scripts/encrypt-market.mjs --new-key makes one)."); process.exit(1); }
const src = process.argv[2] || "api/data/market-bali.php";
const raw = readFileSync(src, "utf8");
const data = JSON.parse(raw.slice(raw.indexOf("\n") + 1));
const key = await crypto.subtle.importKey("raw", Buffer.from(KEY, "base64"), "AES-GCM", false, ["encrypt"]);
const seal = async obj => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  return Buffer.concat([Buffer.from(iv), Buffer.from(ct)]).toString("base64");
};
const BEDS = 3, ID = 0, byBeds = {}, idx = {};
for (const r of data.rows) { (byBeds[r[BEDS]] ||= []).push(r); idx[String(r[ID])] = r[BEDS]; }
const out = { meta: await seal({ source: data.source, newest: data.newest, flags: data.flags, cols: data.cols, built: data.built }), idx: await seal(idx), beds: {} };
for (const [b, rows] of Object.entries(byBeds)) out.beds[b] = await seal(rows);
writeFileSync("functions-lib/market-data.js",
  "// AirDNA Bali market dataset, AES-256-GCM encrypted (scripts/encrypt-market.mjs). Needs MARKET_KEY to read.\n" +
  `// ${data.rows.length} listings, newest export ${data.newest}, built ${data.built}.\n` +
  "export default " + JSON.stringify(out) + ";\n");
console.log(`functions-lib/market-data.js: ${data.rows.length} listings in ${Object.keys(byBeds).length} bedroom groups`);
