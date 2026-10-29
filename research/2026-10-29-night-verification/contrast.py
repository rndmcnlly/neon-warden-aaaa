#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["numpy"]
# ///
"""Local loudness contrast of each Writ moment: how far it rises over the mix.

uv run contrast.py out/rec out

For every Writ release in every recording (release-sample starts), the 50
ms RMS peak from 50 ms before to 600 ms after the release, minus the median
of the 0.9 s before it (the mix the Writ must rise above). A clip-wide
median is unfair when a clip opens in silence (the boss intro), so this is
local. Split by tier, by outcome (pick.py's rule) and by recording.
"""
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

REC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
SR, WIN = 8000, 400


def mono(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    n = len(x) // WIN
    return 20 * np.log10(np.sqrt((x[: n * WIN].reshape(n, WIN) ** 2).mean(axis=1) + 1e-12))


res = defaultdict(list)
for arm in ("before", "after"):
    for clip in ("writ", "ram", "tap", "boss-fight"):
        t = json.loads((REC / arm / clip / "truth.json").read_text())
        evs = [{"t": x["t"], **x["ev"]} for x in t["log"] if x.get("k") == "ev"]
        db = mono(REC / arm / clip / "reel.mp4")
        for s in t["sources"]:
            name = s["url"].split("/")[-1]
            if not name.startswith("writ_release_"):
                continue
            r = s["t"]
            i = int(r / 0.05)
            if i < 20 or i + 12 >= len(db):
                continue
            hit = any(r < e["t"] <= r + 0.8 and e["type"] in ("kill", "disarm", "partBreak") for e in evs)
            c = float(db[i - 1: i + 12].max() - np.median(db[i - 18: i - 2]))
            tier = name.split("_")[2]
            ctx = "boss" if clip == "boss-fight" else "sector"
            res[(arm, f"{ctx} Writ {tier} {'hit' if hit else 'miss'}")].append(c)

rows = {}
print(f"{'moment':28} {'before':>16} {'after':>16}")
for k in sorted({k for (_, k) in res}):
    cell = {}
    for arm in ("before", "after"):
        v = res.get((arm, k), [])
        cell[arm] = {"n": len(v), "medianDb": round(float(np.median(v)), 1) if v else None}
    rows[k] = cell
    f = lambda c: f"{c['medianDb']} dB (n={c['n']})" if c["n"] else "none"
    print(f"{k:28} {f(cell['before']):>16} {f(cell['after']):>16}")
(OUT / "contrast.json").write_text(json.dumps(rows, indent=1) + "\n")
