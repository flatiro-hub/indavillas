# indavillas.com

The whole IndaVillas website in one repo: the public site, the owner/cleaner/manager portal (`/portal/`),
the two small server endpoints, and the portal's Firebase backend. Hosted on **Cloudflare Pages**;
every push to `main` deploys.

| Path | What it is |
|---|---|
| `index.html`, `services/`, `system/`, `pricing/`, `revenue-calculator/`, `listing-audit/`, `foundation/`, `privacy/`, `terms/`, `404.html` | The website pages (built files) |
| `v4/`, `v3/`, `assets/` | Styles, scripts and images of the pages |
| `portal/` | The portal: `index.html` (owners, cleaners, villa managers, admin), `clean.html` (cleaners' calendar links) |
| `functions/api/[[path]].js` + `functions-lib/api.js` | `/api/audit(.php)` and `/api/market(.php)`: Cloudflare Functions that replaced the PHP scripts in `api/` |
| `functions-lib/market-data.js` | The AirDNA Bali dataset for `/api/market`, **AES-256-GCM encrypted**; readable only with `MARKET_KEY` |
| `_v4/`, `_v3/`, `_build/`, `_design-guide/` | Sources and build scripts of the pages (never published) — see `SITE-README.md` |
| `firebase/` | The portal's backend (Firebase Functions, Firestore and Storage rules) — see `firebase/PORTAL-README.md` |
| `api/` | The old PHP versions of the endpoints, kept for the old host; not used on Cloudflare |
| `scripts/build.sh` | Cloudflare build: copies everything that's published into `dist/` |
| `_headers`, `_redirects` | Cloudflare headers (security, caching) and redirects; they replace `.htaccess` |

## Cloudflare Pages settings

- Framework preset: none · Build command: `bash scripts/build.sh` · Build output directory: `dist`
- Variables and secrets (Production and Preview):
  - `APIFY_TOKEN` (secret): the Apify API token for the listing audit. Without it, the audit asks visitors to type the details.
  - `MARKET_KEY` (secret): unlocks `functions-lib/market-data.js`. Without it, the Foundation snapshot shows no market figures.
  - optional: `APIFY_ACTOR_ID`, `APIFY_BOOKING_ACTOR_ID`
- Custom domains: `indavillas.com` and `www.indavillas.com` (www redirects to the bare domain with a Cloudflare redirect rule).

## Editing

- Pages: edit `_v4/pages/*.html`, run `python3 _v4/build.py`, commit, push. Foundation and 404: `bash _build/build.sh`. Details in `SITE-README.md`.
- Portal: edit `portal/index.html`, commit, push. Backend: `cd firebase && firebase deploy --only functions` (from a Mac with the Firebase CLI; `npm install` in `firebase/functions` first).
- Market data: run `_build/market/build_market.py` (writes `api/data/market-bali.php`, ignored by git), then
  `MARKET_KEY=… node scripts/encrypt-market.mjs` and commit `functions-lib/market-data.js`.

## Local preview

```
bash scripts/build.sh
npx wrangler pages dev dist      # with MARKET_KEY / APIFY_TOKEN in .dev.vars (ignored by git)
```

## Never commit

`api/config.php` (Apify token), `api/data/market-bali.php` (purchased AirDNA data, unencrypted), any `.dev.vars` / `.env`.
`.gitignore` already keeps them out.
