#!/usr/bin/env python3
"""Grades and sizes the blog's inline images (16 November 2026).

    python3 -I _v4/raw/blog/grade_blog.py            (from ~/indavillas-v2)

Reads the Runway masters (*.png, 2752x1536, 16:9) beside this file, applies the site's house
grade (same filter as concepts/hooman-style/_src/grade.py: teal water, olive greens, 20% less
saturation, soft ends, fine grain) and writes /v4/img/blog/in-<name>-1200.jpg and -800.jpg.
Masters stay here in _v4/raw/blog and are never published (the build script skips _v4).
"""
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parents[2] / "v4" / "img" / "blog"
GRADE = ",".join([
    "selectivecolor=correction_method=relative"
    ":cyans='0 0 0.55 0.18':blues='0 0 0.18 0.06'"
    ":greens='0 0.10 0 0.10':yellows='0 0.04 -0.08 0.02'",
    "eq=saturation=0.8",
    "curves=all='0/0.04 0.25/0.235 0.5/0.5 0.78/0.8 1/0.958'",
    "colorbalance=rs=-0.03:gs=0.005:bs=0.01:rh=0.015:bh=-0.015",
])
GRAIN = "noise=alls=5:allf=u"

for src in sorted(HERE.glob("*.png")):
    for width, q in ((1200, 4), (800, 5)):
        out = OUT / f"in-{src.stem}-{width}.jpg"
        vf = f"{GRADE},scale={width}:-2:flags=lanczos,{GRAIN}"
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", vf,
                            "-q:v", str(q), str(out)], capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"ffmpeg failed on {src.name}: {r.stderr[-800:]}")
    print(f"  {src.stem:18} {(OUT / f'in-{src.stem}-1200.jpg').stat().st_size // 1024} KB / "
          f"{(OUT / f'in-{src.stem}-800.jpg').stat().st_size // 1024} KB")
