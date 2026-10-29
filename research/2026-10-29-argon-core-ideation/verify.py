# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Check specific Pass A claims against truth: sound starts near a clip time
and the mix's short-term level there versus the clip's median.

uv run --script verify.py <rec dir>
Writes out/verify.json; prints one line per probe.
"""

import json
import subprocess
import sys

import numpy as np

rec = sys.argv[1]
clips = {c["id"]: c for c in json.load(open("clips.json"))}
# (clip, clip time, question) probes chosen from Pass A's claims.
PROBES = [
    ("B", 7.1, "focus on: any sound?"),
    ("B", 6.1, "scan codex popup: any sound?"),
    ("H", 0.2, "first huge ring: any sound?"),
    ("H", 2.0, "second huge ring: any sound?"),
    ("H", 6.9, "screech: what is it?"),
    ("H", 12.1, "screech + pop"),
    ("D", 3.0, "Argon: core scanned, not shot"),
    ("D", 6.1, "screech at core"),
    ("D", 11.2, "second screech"),
    ("C", 0.4, "big shot, miss"),
    ("C", 6.4, "big shot, miss"),
    ("C", 4.3, "big shot, hit"),
    ("C", 9.6, "big shot, hit"),
    ("F", 2.9, "big shot, miss"),
    ("G", 3.5, "stream: own firing sound?"),
    ("A", 3.5, "two flashes, no sound?"),
    ("E", 8.0, "pink ring, enemy disappears"),
    ("G", 7.6, "pink ring around player"),
]


def mix_levels(clip_id: str) -> tuple[np.ndarray, float]:
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", f"clips/clip-{clip_id}.mp4",
         "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
        capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    win = 400  # 50 ms
    n = len(x) // win
    rms = np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    return 20 * np.log10(rms), 0.05


results = []
truths = {}
for cid, t, q in PROBES:
    c = clips[cid]
    if c["src"] not in truths:
        truths[c["src"]] = json.load(open(f"{rec}/{c['src']}/truth.json"))
    d = truths[c["src"]]
    at = c["start"] + t
    near = lambda x: abs(x - at) <= 0.6
    sounds = [f"{s['t'] - c['start']:.2f} {s['url'].split('/')[-1].replace('_1.ogg', '') or 'synth'}"
              for s in d["sources"] if near(s["t"]) and "music" not in s["url"] and "/vo/" not in "/" + s["url"]]
    events = []
    level = None
    for x in d["log"]:
        if x["k"] == "ev" and near(x["t"]) and x["ev"]["type"] not in ("payChanged", "nearMiss", "graze", "enemyFired", "spawn", "focusChanged" if cid != "B" else "_"):
            e = x["ev"]
            events.append(f"{x['t'] - c['start']:.2f} {e['type']} {e.get('part', '')}{e.get('level', '') if e['type'] == 'chargeLevel' else ''}")
    db, step = mix_levels(cid)
    i = int(t / step)
    local = float(db[max(0, i - 6): i + 12].max())
    results.append({"clip": cid, "t": t, "q": q, "sounds": sounds, "events": events,
                    "peak50ms_dB": round(local, 1), "median_dB": round(float(np.median(db)), 1)})
    print(f"{cid} {t:5.1f} {q:34s} peak {local:6.1f} med {np.median(db):6.1f} | {'; '.join(sounds)[:160]} | {'; '.join(events)[:160]}")
json.dump(results, open("out/verify.json", "w"), indent=1)
