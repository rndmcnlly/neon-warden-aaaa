# /// script
# requires-python = ">=3.11"
# ///
"""Compact per-clip truth timeline from capture.ts truth.json files.

uv run --script timeline.py <rec dir> <clip> [start end]
Prints marks, core sim events, Writ spends (charge level dropping to 0)
and named SFX buffer starts, in recording seconds. Unnamed starts are
Web Audio synth voices (shots, charge pips, writ chord, focus), counted
per second instead.
"""

import json
import sys
from collections import Counter

rec, clip = sys.argv[1], sys.argv[2]
lo, hi = (float(sys.argv[3]), float(sys.argv[4])) if len(sys.argv) > 4 else (0, 1e9)
d = json.load(open(f"{rec}/{clip}/truth.json"))
CORE = {"partBreak", "disarm", "kill", "lifeLost", "focusChanged", "coreExposed",
        "bossPhase", "gameOver", "pickup", "scanLock", "sectorCleared"}
rows = []
for m in d["marks"]:
    rows.append((m["t"], "INPUT", m["label"]))
level = 0
for x in d["log"]:
    if x["k"] == "shots":
        rows.append((x["t"], "shots", f"+{x['n']}"))
        continue
    e = x["ev"]
    if e["type"] == "chargeLevel":
        if e["level"] == 0 and level > 0:
            rows.append((x["t"], "WRIT", f"level {level} spent"))
        level = e["level"]
    elif e["type"] in CORE:
        extra = {k: v for k, v in e.items() if k in ("part", "partKind", "by", "kind", "clean", "active", "phase", "byRam", "cancelled", "target")}
        rows.append((x["t"], e["type"], json.dumps(extra)))
unnamed = Counter()
for s in d["sources"]:
    if not s["url"]:
        unnamed[int(s["t"])] += 1
    elif "/vo/" in s["url"] or s["url"].startswith("vo/"):
        rows.append((s["t"], "vo(muted)", s["url"]))
    elif "music" not in s["url"]:
        rows.append((s["t"], "sfx", s["url"].split("/")[-1].replace("_1.ogg", "")))
rows.sort()
last = None
for t, k, v in rows:
    if lo <= t <= hi:
        # collapse runs of identical sfx / shot rows
        key = (k, v)
        if key == last and k in ("sfx", "shots"):
            continue
        last = key
        print(f"{t:7.2f}  {k:10s} {v}")
print("synth starts per second:", {k: v for k, v in sorted(unnamed.items()) if lo <= k <= hi})
