#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["numpy"]
# ///
"""Pick one window per topic and arm from capture truth; cut neutral clips.

uv run pick.py out/rec out

Anchors come from sim events and audio buffer starts in truth.json, never
from looking at the video. The BEFORE probe (8ad8598) kept no per-shot
events (`hit`, `playerFired`), so Writ tier and release time come from the
release sample's URL (`writ_release_<tier>`), and a Writ counts as a hit
when a kill, disarm or part break follows it within 0.8 s. The same rule is
used for both arms, so ground truth is symmetric. Clips get neutral ids;
the arm and topic key lives in out/key.json, never in a judge prompt.
"""
import json
import random
import subprocess
import sys
from pathlib import Path

import numpy as np

REC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
PRE, POST = 2.5, 4.0
SKIP = {"payChanged", "nearMiss", "statsMoment", "enemyFired", "graze", "hit", "playerFired"}


def truth(arm, clip):
    return json.loads((REC / arm / clip / "truth.json").read_text())


def events(arm, clip):
    return [{"t": x["t"], **x["ev"]} for x in truth(arm, clip)["log"] if x.get("k") == "ev"]


def sources(arm, clip):
    return [{"t": s["t"], "name": s["url"].split("/")[-1]} for s in truth(arm, clip)["sources"]]


def end_of(arm, clip):
    return truth(arm, clip)["log"][-1]["t"]


def writs(arm, clip):
    """Writ releases with tier and outcome (hit = kill/disarm/partBreak in 0.8 s)."""
    evs = events(arm, clip)
    out = []
    for s in sources(arm, clip):
        if not s["name"].startswith("writ_release_"):
            continue
        tier = int(s["name"].split("_")[2])
        hit = next((e for e in evs if s["t"] < e["t"] <= s["t"] + 0.8
                    and e["type"] in ("kill", "disarm", "partBreak") and e.get("target", "enemy") != "player"), None)
        out.append({"t": s["t"], "tier": tier, "hit": hit is not None, "result": hit and hit["type"]})
    return out


def lifelost_near(evs, t, w=1.5):
    return any(e["type"] == "lifeLost" and abs(e["t"] - t) < w for e in evs)


def time_at_tick(arm, clip, tick):
    evs = [e for e in events(arm, clip) if "tick" in e]
    a = max((e for e in evs if e["tick"] <= tick), key=lambda e: e["tick"])
    b = min((e for e in evs if e["tick"] >= tick), key=lambda e: e["tick"])
    if b["tick"] == a["tick"]:
        return a["t"]
    return a["t"] + (b["t"] - a["t"]) * (tick - a["tick"]) / (b["tick"] - a["tick"])


def densest_tick():
    bs = sources("after", "boss-fight")
    hitty = [s["t"] for s in bs if s["name"].startswith(("hit_", "kill_", "part_", "pod_")) or s["name"] == ""]
    end = end_of("after", "boss-fight")
    best = max((t for t in hitty if 10 < t < end - POST), key=lambda t: sum(1 for x in hitty if t <= x < t + 1.0))
    evs = [e for e in events("after", "boss-fight") if "tick" in e]
    near = min(evs, key=lambda e: abs(e["t"] - (best + 0.5)))
    return near["tick"]


def pick(arm):
    chosen = {}
    rec = truth(arm, "move")
    first_hold = next(m["t"] for m in rec["marks"] if m["label"].startswith("hold"))
    chosen["move"] = ("move", {"t": first_hold + 2.0, "type": "move"}, first_hold - 0.5, first_hold + 10.5)

    tap = events(arm, "tap")
    tap_writs = writs(arm, "tap")
    # A tap disarm: no Writ released in the 0.8 s before it.
    d = next(e for e in tap if e["type"] == "disarm" and e["t"] > 3
             and not any(0 <= e["t"] - w["t"] <= 0.8 for w in tap_writs) and not lifelost_near(tap, e["t"])
             and not any(x["type"] == "kill" and abs(x["t"] - e["t"]) < 1.0 for x in tap))
    chosen["disarm"] = ("tap", d)

    # Writ moments: the scripted Writ clip first, then other scripted clips.
    # Exclude windows where a life is lost from 0.5 s before to 1.0 s after.
    for tier in (1, 3):
        for hit in (True, False):
            found = None
            for clip in ("writ", "ram", "tap", "move"):
                evs, end = events(arm, clip), end_of(arm, clip)
                w = next((w for w in writs(arm, clip) if w["tier"] == tier and w["hit"] == hit
                          and 3 < w["t"] < end - POST and not any(
                              e["type"] == "lifeLost" and -0.5 < e["t"] - w["t"] < 1.0 for e in evs)), None)
                if w:
                    found = (clip, {**w, "type": f"writ{tier}"})
                    break
            chosen[f"writ{tier}-{'hit' if hit else 'miss'}"] = found or ("writ", None)

    bs = sources(arm, "boss-fight")
    rel = [s["t"] for s in bs if s["name"].startswith("writ_release_")]
    defl = [s for s in bs if s["name"].startswith("hit_deflect") and s["t"] > 3]
    chosen["writ-deflect"] = ("boss-fight", next(({"t": r, "type": "writ-deflect"} for r in rel if r > 3
                                                   and any(0 < s["t"] - r < 0.4 for s in defl)), None))
    bf = events(arm, "boss-fight")
    chosen["pod-break"] = ("boss-fight", next(e for e in bf if e["type"] == "partBreak" and e["target"] == "boss"))
    # Dense: the after arm's densest second of hit sounds, then the same sim
    # tick in both arms (hitstop shifts wall time, never ticks).
    chosen["dense"] = ("boss-fight", {"t": time_at_tick(arm, "boss-fight", DENSE_TICK), "type": "dense",
                                      "tick": DENSE_TICK})

    lost = {e["tick"] for e in tap if e["type"] == "lifeLost"}
    lk = next(e for e in tap if e["type"] == "lifeLost" and e["tick"] in
              {k["tick"] for k in tap if k["type"] == "kill"} and e["t"] > 3)
    chosen["life-kill"] = ("tap", lk)
    return chosen


def probe(wav, t, start, end):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ss", str(start), "-to", str(end),
                          "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    win = 400
    n = len(x) // win
    db = 20 * np.log10(np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12))
    i0 = int((t - start) / 0.05)
    peak = float(db[max(0, i0 - 1): i0 + 12].max())
    silent = float((db < -50).mean())
    return {"peakDb": round(peak, 1), "medianDb": round(float(np.median(db)), 1),
            "overMedianDb": round(peak - float(np.median(db)), 1), "silentFrac": round(silent, 3)}


def main():
    global DENSE_TICK
    DENSE_TICK = densest_tick()
    print("dense tick", DENSE_TICK)
    (OUT / "clips").mkdir(parents=True, exist_ok=True)
    rng = random.Random(1029)
    rows = []
    for arm in ["before", "after"]:
        for topic, spec in pick(arm).items():
            clip, ev = spec[0], spec[1]
            if ev is None:
                rows.append({"topic": topic, "arm": arm, "missing": True})
                print(f"{topic} {arm}: none")
                continue
            start, end = (spec[2], spec[3]) if len(spec) == 4 else (max(0.0, ev["t"] - PRE), ev["t"] + POST)
            rows.append({"topic": topic, "arm": arm, "src": clip, "anchor": ev, "start": start, "end": end})
    ids = rng.sample(range(100, 999), len(rows))
    for row, n in zip(rows, ids):
        if row.get("missing"):
            continue
        row["id"] = f"v{n}"
        src = REC / row["arm"] / row["src"] / "reel.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{row['start']:.3f}", "-to", f"{row['end']:.3f}",
                        "-i", str(src), "-vf", "scale=854:480", "-c:v", "libx264", "-crf", "26", "-preset",
                        "veryfast", "-c:a", "aac", "-b:a", "128k", str(OUT / "clips" / f"{row['id']}.mp4")], check=True)
        row["anchorAt"] = round(row["anchor"]["t"] - row["start"], 2)
        row["audio"] = probe(src, row["anchor"]["t"], row["start"], row["end"])
        s0 = row["start"]
        row["events"] = [{"t": round(e["t"] - s0, 2), **{k: v for k, v in e.items() if k in
                          ("type", "kind", "part", "target", "level", "by", "cancelled")}}
                         for e in events(row["arm"], row["src"]) if s0 <= e["t"] <= row["end"] and e["type"] not in SKIP]
        row["writs"] = [{**w, "t": round(w["t"] - s0, 2)} for w in writs(row["arm"], row["src"])
                        if s0 <= w["t"] <= row["end"]]
        print(row["id"], row["topic"], row["arm"], row["src"], round(row["anchor"]["t"], 2), row["audio"])
    # Pass B pairs: X/Y order randomized per topic.
    pairs = []
    topics = list(dict.fromkeys(r["topic"] for r in rows))
    # Balanced order: half the pairs show the after arm as X.
    after_first = [i % 2 == 0 for i in range(len(topics))]
    rng.shuffle(after_first)
    for topic, af in zip(topics, after_first):
        two = [r for r in rows if r["topic"] == topic and not r.get("missing")]
        if len(two) != 2:
            continue
        two.sort(key=lambda r: (r["arm"] == "after") != af)
        pairs.append({"topic": topic, "X": two[0]["id"], "Y": two[1]["id"],
                      "X_arm": two[0]["arm"], "Y_arm": two[1]["arm"]})
    (OUT / "key.json").write_text(json.dumps({"clips": rows, "pairs": pairs}, indent=1) + "\n")


main()
