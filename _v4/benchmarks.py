#!/usr/bin/env python3
"""Pricing page benchmarks: Bali villas with 6 or more bedrooms, median vs top 10%.

Reads the full AirDNA Bali pull (trailing 12 months, USD, pulled 31 October 2026)
from ~/STR/Bali, which stays OUTSIDE the web root. Only the rounded aggregates printed
here go on the site; never copy the CSV or per-listing rows into indavillas-v2.

Population: entire home listings, 6+ bedrooms, available 271 to 365 nights a year,
booked at least one night in the 12 months (drops dormant listings).
"Top 10%" = the 90th percentile of yearly revenue.

Run:  python3 -I _v4/benchmarks.py
"""
import csv
import os
import statistics

SRC = os.path.expanduser("~/STR/Bali/Bali-master.csv")


def pct(values, p):
    """Linear interpolation percentile, same as pandas' default."""
    s = sorted(values)
    k = (len(s) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


rows = []
with open(SRC, newline="", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        beds, days, booked, rev = (num(r["Bedrooms"]), num(r["Days Available"]),
                                   num(r["Reserved Days"]), num(r["Revenue"]))
        if (r["Listing Type"] == "Home/Apartment" and beds is not None and beds >= 6
                and days is not None and 271 <= days <= 365 and booked and booked > 0
                and rev is not None):
            rows.append((beds, rev))

groups = {
    "6": [v for b, v in rows if b == 6],
    "7": [v for b, v in rows if b == 7],
    "8+": [v for b, v in rows if b >= 8],
    "6+": [v for _, v in rows],
}
k = lambda v: round(v / 1000)
top_all = max(k(pct(g, .9)) for name, g in groups.items() if name != "6+")
print(f"{'beds':4} {'n':>5} {'median':>7} {'top10%':>7} {'gap':>6}  bar --med/--top")
for name, g in groups.items():
    med, top = k(statistics.median(g)), k(pct(g, .9))
    print(f"{name:4} {len(g):5} {med:6}K {top:6}K {top - med:+5}K  {med / top_all:.3f}/{top / top_all:.3f}")
allrev = groups["6+"]
print(f"share of 6+ earning $90K+: {sum(v >= 90000 for v in allrev) / len(allrev):.1%}")
