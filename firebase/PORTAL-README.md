# IndaVillas portal — Hostex version (indavillas.com/portal)

Same portal, same Firebase project (`indavillas-portal`), same logins and client records.
This replaces the old Guesty portal. It adds, for admins, owners, villa managers and cleaners:

| Section | Who | What it does |
|---|---|---|
| **Pricing & pace** | Admins (top menu, and each client's *Pricing & pace* tab) | Booking pace vs the same date last year, forecast, price suggestions (gaps, last-minute, months behind/ahead, weekend premium), one-click apply to every channel in Hostex, undo, custom changes, per-villa limits (owner's lowest/highest rate from onboarding). |
| **Booking pace** | Owners (Performance) | Nights booked now vs this date last year, year forecast. |
| **Reviews** | Owners + admins | Rating trend, category scores, what guests praise and complain about (with quotes), latest reviews, optional AI summary. Admins also get *Replies to write* with AI drafts and posting to the channel. |
| **Approvals** | Owners + admins | Repair requests with cost and photos. Under the owner's onboarding limits they're approved automatically; above, the owner approves or declines in the portal. |
| **Operations** | Admins | Next 14 days of check-outs, same-day turnovers, cleaning tasks in Hostex (create missing ones in bulk, or automatically each morning), other open tasks, repairs waiting for owners. |
| **Inbox** | Admins (managers get the same screen for their villas) | Every Hostex conversation, each guest once (Hostex lists some Airbnb threads twice; the copies are hidden). Search, a "Waiting" filter, messages grouped by day, automatic messages marked. Tap a guest for their details: phone, email, stay, guests, status, lock code, amounts and notes. Ctrl+Enter sends. New messages appear by themselves every 45 seconds. AI drafts are switched off for now. |
| **Cleaners** | Admins (top menu) manage logins; cleaners sign in on the same page | Each cleaner logs in with their own email and sees only the Hostex tasks assigned to their Hostex staff member: today, coming up, same-day turnovers, instructions. They press Start / Done, add notes and report problems (created in Hostex as a maintenance task). Bahasa Indonesia by default, English on a tap. No guest contact details, prices or Hostex access. |
| **Villa managers** | Admins (top menu → *Managers*) manage logins; managers sign in on the same page | Each manager logs in with their own email and runs only the villas you tick for them. **Today**: who's in the villa tonight, the next arrival, how booked the next 30 days are, booking requests to approve or decline, arrivals and departures this week, today's tasks. **Calendar**: six weeks per villa with prices and minimum stay; block and open dates, change prices or minimum stay (owner's lowest rate always holds, up to 90 days ahead, undo their own changes), add a booking from the selected dates. **Bookings**: every channel, search, check guests in and out, lock code and arrival/departure times, edit guest details, create direct bookings (WhatsApp, repeat guests, walk-ins…) and cancel them, approve or decline requests. **Messages**: guest conversations for their villas only, guest details on tap, send. **Tasks**: create, assign staff, start, done. Reviews stay with IndaVillas. Per manager you can switch off prices, bookings, booking amounts, messages, tasks or the calendar. Everything they change is logged on the Managers page. They never get a Hostex login. |
| **Onboarding form: several villas per owner** | Owners: the onboarding form; admins: client → *Edit answers* | The owner's details are asked once; each villa has its own 15 steps (listings and channels, basics, bedrooms, guests and location, style, amenities, services and feedback, listing and brand, online accounts, revenue, rules and arrival, team and suppliers, emergencies and systems, photos, documents). *+ Add property* in the side menu, the property bar or the phone step picker adds another villa; *Remove property* deletes one. Every question of the original Tally intake form has its own field (each OTA, each bedroom, each team member and supplier, each emergency contact, each upsell) — repeat lists have *+ Add* (e.g. *+ Add another OTA*). Passwords and codes are hidden while typing, masked in every view until *Show*, and left out of copies, files and the CSV export. The answers view lists every field (blank = —, missing required = *Required*) with *Hide empty fields*. *Import old form (CSV)* maps each Tally column to its field; a second response for the same email becomes another property. Records saved before this change are converted the first time they're opened (combined answers such as beds, team, emergency contacts, channels and house rules move into their fields). Pricing, the Hostex auto-link, statements and guest messages read each villa's own answers. Needs the functions deployed (portalApi, hostexSyncNow, hostexSyncDaily, monthlyReports). |
| **Edit a client** | Admins: open the client → *Edit client* | Owner's name, villa name, WhatsApp, **login email** and **portal access** in one place. A new login email moves everything to it — answers, documents, photos, figures, statements, billing, and any manager or cleaner login on the same email — and switches the Firebase sign-in; the password stays the same, the old email stops working, and it's refused if the new email belongs to another login. Unticking *Portal access* disables their Firebase sign-in and signs them out (nothing is deleted); *Switch on* on their page undoes it. Managers and cleaners: *Edit* → *Change login email*. Needs the functions deployed. |
| **Cleaning calendar (no login)** | Admins: *Cleaners* → *Cleaning calendar links* → *New link*; cleaners open `indavillas.com/portal/clean.html?k=…` on their phone | A private page per villa (or group of villas): what is happening today, every check-out to clean after, same-day changeovers with the time between guests, arrivals to get ready for, and how many guests (adults, children, babies) are coming, as a list and a month calendar, in Bahasa or English. Dates, times and guest counts only: no names, contacts, booking codes or prices. Data comes live from Hostex through the public `cleanCalendar` function (cached 2 minutes) and refreshes every 10 minutes; offline it shows the last schedule it loaded. Links are 24 random characters; *Remove* switches one off at once. *Copy link* / *WhatsApp* to share. Needs `clean.html` uploaded and the `cleanCalendar` function deployed. |
| **Availability calendar** | Owners: top of *Performance*; admins: client → *Performance* | One timeline row per linked Hostex villa, six weeks at a time (Earlier / Today / Later): booked nights with the guest's first name, booking requests, blocked and open nights with the price and minimum stay. Tap a night, then the last night, then **Block** (with an optional reason, for one villa or all of them) or **Open**. Admins also get **Price & min stay** (same engine as Pricing & pace, respects the owner's lowest rate, 90 days ahead). Changes go to every channel through Hostex; opening nights under a booking is refused. Every change is listed under *Recent calendar changes* with who made it (Owner / IndaVillas) and the reason. Server: `functions/lib/ownercal.js` (`cal.overview`, `cal.set`, `cal.price`). |
| **Booking-site access** | Onboarding → *Listings & channels* | For Airbnb, Booking.com, Vrbo/Expedia, Agoda, Trip.com, Traveloka, Google Vacation Rentals and every other site: main account login, main account password (hidden, team-only), who receives the 2-step verification code, date access shared. Shown only when the owner has an account there. The old "IndaVillas added as co-host" answer is kept for earlier answers and the Tally import, and only shows when it has a value. |
| **Folding form groups** | Onboarding form and the review / admin answers view | Fields fold under their heading (Pool maintenance, Housekeeping, Airbnb…); tap a heading to fill it in. Each heading shows how many are answered. Groups with a required answer still missing start open and show *Required*; Continue with an error opens the group and jumps to the field. *Expand all / Collapse all* on every step and on the review. |
| **TVs, guestbook and print files** | Onboarding → *Bedrooms* / *Amenities* / *Listing & brand*; *Online accounts* | Each bedroom with a TV asks brand and model, TV type (smart, streaming box, regular) and whether it's on Wi-Fi; *Amenities → Entertainment* lists every other TV (room, brand, type, Wi-Fi). *Listing & brand → Guestbook and print materials*: physical guestbook, printed items, and — once there is something printed — the link to the print files and who designs/prints them. *Online accounts*: Facebook, Instagram, Meta Business Suite and Meta Ads are shared with garda.renar@gmail.com, Google accounts with hi.flatiro@gmail.com, each with click-by-click steps. |
| **One email, two logins** | Sign-in; admin client page; Managers page | If an email is both an owner and a villa manager (or cleaner), sign-in asks which to open (Owner portal / Villa manager app) and a **Switch** button sits at the top; a switched-off manager or cleaner login no longer blocks the owner. The client page says when the owner's email is also a manager or cleaner login, with **Remove manager login** to send them straight to the owner portal. *Add client* refuses an email that is already an admin, manager or cleaner login; the Managers page marks *Also an owner* and warns before *Send login* replaces the owner's password. |
| **AI bots (Grok, Claude, ChatGPT)** | Admin → *AI bots* | Bot keys for AI assistants, through the portal's MCP server `portalMcp`. Each key: name, villas (all or chosen), what it can see (figures, owners, calendar, prices, guest contacts, amounts, guest messages, tasks) and whether it can make changes. The key is shown once; *Renew key* replaces it, *Switch off* / *Delete* stop it. Everything a bot changes is listed under *What bots changed*. See *AI assistants* below. |
| **Reports & billing** | Admins (top menu + each client's *Reports & billing* tab); owners see the results in *Documents* | Monthly owner reports (made automatically on the 2nd, as drafts or published), IndaVillas fee plans (Growth / Excellence / custom, yearly by default, add-ons, multi-villa discount), invoices with your bank details, numbered automatically. |

Language: the EN / ID switch at the top right turns the whole portal into Bahasa Indonesia (or back). The choice is kept in that browser. Cleaners start in Bahasa. Guest messages, names and the printed reports stay as they are.

Login fix: on indavillas.com the page now always uses the live sign-in (email + password only).
The *Preview as owner/admin* buttons only appear when the file is opened somewhere else (or with `?preview` in the address).
The Firebase config is already inside `portal/index.html`, so there's nothing to paste any more.

## 1. Deploy the functions (once, from your Mac)

```bash
cd ~/indavillas/indavillas-portal-hostex
npm install -g firebase-tools          # skip if already installed
firebase login                          # skip if already logged in
cd functions && npm install && cd ..
firebase functions:secrets:set HOSTEX_ACCESS_TOKEN    # Hostex → Settings → OpenAPI → token (needs write access: reservations, calendar, prices, tasks, messages, reviews)
firebase functions:secrets:set ANTHROPIC_API_KEY      # from console.anthropic.com, for AI drafts and review summaries — type none to leave AI off
firebase deploy --only functions,firestore:rules
```

When it asks to delete functions that aren't in this folder, answer **Yes** only if the list is just `guestySyncDaily` and `guestySyncNow` (the old Guesty sync).
If anything else is listed (for example `amenityPlanRun`, from another tool in the same Firebase project), answer **No**: the portal still deploys and the other function keeps running.
If you only changed the portal code, `firebase deploy --only functions:portalApi,firestore:rules` updates just the portal's function.
You get four functions in `asia-southeast1`: `portalApi`, `hostexSyncNow`, `hostexSyncDaily` (05:30 Bali) and `monthlyReports` (2nd of each month, 06:00 Bali).

The Firestore rules gain two blocks: a cleaner can read their own `cleaners/<email>` record and a villa manager their own `managers/<email>` record (nothing else; everything a manager does goes through `portalApi`, which checks their villas and permissions on every call). Storage rules don't change. All new data is written only by the functions.

## 2. Upload the page

Upload `portal-ftp-upload-hostex/portal/index.html`, `hero-addressbali.avif` and the hidden `.htaccess` to `public_html/portal/` on indavillas.com, replacing the current files.

## 3. First run

1. Sign in as admin → **Clients** → **Sync with Hostex**. Link any client still marked *Relink to Hostex* (open the client → Link villas).
2. **Billing** → *Invoice and email settings*: company name, address, bank details, invoice prefix and next number.
3. Each client → **Reports & billing**: choose the plan (Growth $3,999 / Excellence $7,990 a year; 25% off extra villas), next invoice date, add-ons.
4. **Operations** → *Cleaning setup per villa*: default cleaner, time and fee. Only switch on *Automatic* if Hostex's own automation doesn't already create cleaning tasks (Villa Dew's does — leave it off there).
5. **Cleaners** → for each Hostex staff member under *Hostex staff without a portal login*, click the name, enter their email, keep *Send the login email now* ticked → **Add cleaner**.
   They get a Firebase email to set a password, then sign in at indavillas.com/portal and land straight in their jobs.
6. **Managers** → **Add manager**: name, email, tick their villas, untick anything they shouldn't do (e.g. *See booking amounts*), keep *Send the login email now* ticked.
   They sign in at indavillas.com/portal and land on *Today*. One email can only be one thing: an admin, an owner, a cleaner or a manager.
   For direct bookings they pick *Booked through* and *Paid by* from Hostex's custom channels and income methods, so add those in Hostex first (e.g. a "WhatsApp" or "Direct" custom channel).

## Optional: emails to owners

Reports, invoices and repair requests can email the owner. Install the free Firebase extension *Trigger Email from Firestore*
(`firebase ext:install firebase/firestore-send-email`, collection `mail`, with your SMTP details), then tick
*Email owners…* in Billing → settings. Without the extension nothing is sent; owners still see everything in the portal.


## AI assistants (Grok, Claude, ChatGPT)

The function `portalMcp` is a remote MCP server (Streamable HTTP, stateless):
`https://asia-southeast1-indavillas-portal.cloudfunctions.net/portalMcp`

1. Deploy the functions (`firebase deploy --only functions`); `portalMcp` is new.
2. Admin → **AI bots** → **Add bot**. Choose the villas, what it can see, and whether it can make changes. Copy the key (`ivb_…`); it's shown once.
3. Connect:
   - **Grok through the xAI API** (your own bot): in the Responses API `tools`, add
     `{"type":"mcp","server_url":"<address above>","server_label":"indavillas","authorization":"ivb_…"}`
   - **grok.com / Claude / ChatGPT custom connector** (apps that only take a URL): use the address with the key in it,
     `…/portalMcp/k/ivb_…` (shown with the key). Anyone with that URL can use the key: keep it private, renew it if it leaks.
   - Any other MCP client: header `Authorization: Bearer ivb_…` or `X-Api-Key: ivb_…`.

Tools (each needs the matching permission on the key):

| Read | Change (only with "Can make changes") |
|---|---|
| `list_villas`, `portfolio_summary`, `villa_report`, `owner_performance`, `reviews_to_answer`, `availability_calendar`, `bookings`, `tasks`, `guest_conversations`, `guest_conversation`, `draft_guest_reply`, `owners` | `block_dates`, `open_dates`, `change_prices`, `apply_pricing_suggestion`, `undo_price_change`, `create_task`, `update_task`, `send_guest_message` |

Safety: a change tool called without `confirm: true` only returns a preview, so the assistant asks you first.
A bot acts like a villa manager limited to its key: never below an owner's lowest rate, prices up to 90 days ahead,
no opening nights under a booking, undo only its own price changes, no deletes, no logins or emails, no onboarding passwords.
60 calls a minute per key. Keys are stored as a SHA-256 hash in `botkeys/` (closed to the page); bot changes are logged in `mgrlog/bot:<id>`.

## Notes

- Rental revenue = accommodation fare (before cleaning fees, taxes and channel commission), as before.
- If a villa uses a dynamic pricing tool (from onboarding, e.g. PriceLabs), the pricing page warns that the tool will overwrite changes.
- AI drafts never include private review feedback, never promise refunds or early check-in unless you tell them to, and mark missing facts as `[TEAM: …]` — the portal won't send a message until those are filled in.
- Repair photos are stored under `clients/<email>/repairs/` in Storage (covered by the existing rules).
- `functions/lib/revenue-core.js` is the same pricing engine the page uses for live previews.
- Villa photos at the top of the page: AddressBali Uluwatu's owner, manager and cleaners (and admins on that client's page) see `hero-addressbali.avif` instead of the standard photo. To give another villa its own photo, upload it next to `index.html` and add its Hostex property id to `HERO_IMAGES` in `index.html`. If a photo file is missing, the standard one shows.
- Manager rules worth knowing: OTA bookings (Airbnb, Booking.com…) can't be cancelled or re-dated from the portal, only on the channel; a night with a booking can't be "opened"; new bookings are refused if the dates overlap a booking or a blocked night; price changes by a manager show in the owner's Strategy change log like yours, and a manager can only undo their own.
