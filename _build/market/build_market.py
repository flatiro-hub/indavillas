"""Builds the Bali market dataset behind the Foundation snapshot (api/market.php).

    python3 _build/market/build_market.py [master.csv] [--idr-rate 17285]

Reads the AirDNA Bali master (default ~/STR/Bali/airdna-bali-master.csv: every AirDNA
export merged, one row per listing, see the README next to it) and writes
api/data/market-bali.php with the listings the snapshot compares against: Bali entire
homes, updated in the 12 months to the newest export, with revenue.

Currency. The master's own "Revenue USD" columns convert rupiah exports at 16,500 IDR/USD,
while AirDNA's USD exports use AirDNA's rate, about 17,285 (what the same listing exported
the same day in both currencies implies). Mixing the two would make a listing look about 5%
richer when it came from a rupiah export, inside the same comp set. So rupiah rows are
converted here from their original values at --idr-rate (default 17,285); pass
--idr-rate 16500 to match the master's USD columns instead.

The output starts with a PHP exit line, so fetching it directly returns nothing: the
purchased AirDNA data never leaves the server, only the aggregates api/market.php computes.
_build/ is never uploaded; after re-running this, upload api/data/market-bali.php.
"""
import argparse, csv, json, os
from collections import Counter
from datetime import date

ap = argparse.ArgumentParser()
ap.add_argument("master", nargs="?", default="~/STR/Bali/airdna-bali-master.csv")
ap.add_argument("--idr-rate", type=float, default=17285)
args = ap.parse_args()
SRC = os.path.expanduser(args.master)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "api", "data", "market-bali.php")
FLAGS = [("Has Pool", "pool", 1), ("Has Air Conditioning", "ac", 2), ("Has Kitchen", "kitchen", 4), ("Has Gym", "gym", 8),
         ("Has Hot Tub", "hotTub", 16), ("Has Parking", "parking", 32), ("Has Pets", "pets", 64)]
TIERS = {"Budget": 1, "Economy": 2, "Midscale": 3, "Upscale": 4, "Luxury": 5}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


with open(SRC, encoding="utf-8-sig") as fh:
    rows = list(csv.DictReader(fh))
for col in ("Revenue USD", "ADR USD", "Original Currency", "Latitude", "Longitude", "Bedrooms", "Last Update"):
    if col not in rows[0]:
        raise SystemExit(f"{SRC} has no '{col}' column - is it the AirDNA Bali master?")


def usd(r, col):
    # Rupiah rows from their original value at --idr-rate; USD rows as exported.
    if r.get("Original Currency") == "IDR":
        return num(r.get(col)) / args.idr_rate
    return num(r.get(col + " USD") or r.get(col))


skipped = Counter()
keep = []
newest = max((r.get("Last Update") or "")[:10] for r in rows)
cutoff = f"{int(newest[:4]) - 1}{newest[4:7]}"  # 12 months before the newest export, by month
for r in rows:
    lt = r.get("Listing Type") or ""
    if lt and lt != "Home/Apartment":  # blank = rows merged from the portal files, all entire homes
        skipped["not an entire home"] += 1
        continue
    beds = int(num(r.get("Bedrooms")))
    rev = round(usd(r, "Revenue"))
    days = int(num(r.get("Days Available") or r.get("Available Nights")))
    upd = (r.get("Last Update") or "")[:10]
    if upd[:7] < cutoff:
        skipped["not updated in the last 12 months"] += 1
        continue
    if rev <= 0 or not 1 <= beds <= 30:
        skipped["no revenue or bedrooms"] += 1
        continue
    if 0 < days < 90:  # part-time listings; rows without the column are kept
        skipped["available under 90 nights"] += 1
        continue
    pid = r.get("Airbnb Property ID") or ("v" + r["Vrbo Property ID"] if r.get("Vrbo Property ID") else "")
    if not pid:
        skipped["no listing id"] += 1
        continue
    keep.append([pid, round(num(r["Latitude"]), 4), round(num(r["Longitude"]), 4), beds, rev, round(usd(r, "ADR")),
                 round(num(r.get("Occupancy")), 1), days, round(num(r.get("Overall Rating")), 2), int(num(r.get("Number of Reviews"))),
                 1 if r.get("Airbnb Superhost") == "true" else 0, int(num(r.get("Minimum Stay"))),
                 sum(bit for col, _, bit in FLAGS if r.get(col) == "true"), TIERS.get(r.get("Price Tier"), 0),
                 int(upd[:7].replace("-", ""))])
keep.sort(key=lambda v: (v[3], v[1], v[2]))

data = {
    "source": "AirDNA", "fx": args.idr_rate, "newest": newest, "cutoff": cutoff, "built": date.today().isoformat(),
    "master": os.path.basename(SRC),
    "flags": {name: bit for _, name, bit in FLAGS},
    "cols": ["id", "lat", "lng", "beds", "rev", "adr", "occ", "days", "rating", "reviews", "sh", "min", "flags", "tier", "upd"],
    "rows": keep,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("<?php exit; ?>\n")
    json.dump(data, fh, separators=(",", ":"))

by_beds = Counter(min(v[3], 10) for v in keep)
print(f"{len(rows)} listings in {os.path.basename(SRC)}; rupiah rows at {args.idr_rate:,.0f} IDR/USD")
print(f"{len(keep)} kept (updated {cutoff} to {newest[:7]}); by bedrooms (10 = 10+): {dict(sorted(by_beds.items()))}")
print("left out: " + ", ".join(f"{n} {why}" for why, n in skipped.most_common()))
print(f"wrote {os.path.relpath(OUT)} ({os.path.getsize(OUT) // 1024} KB)")
