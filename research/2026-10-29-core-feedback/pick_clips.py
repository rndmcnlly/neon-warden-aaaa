#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["numpy"]
# ///
"""Pick one event window per topic and arm from capture truth, cut clips.

uv run select.py <rec-root> <out-dir>

Windows come from sim events in truth.json (recording seconds), never from
looking at the video. Each clip gets its truth (events inside the window,
relative to clip start) and a loudness probe: the 50 ms RMS peak just after
the event versus the clip's median, in dB (as in the Argon step's verify).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

REC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
PRE, POST = 2.5, 4.5


def events(arm: str, clip: str) -> list[dict]:
    t = json.loads((REC / arm / clip / "truth.json").read_text())
    return [{"t": x["t"], **x["ev"]} for x in t["log"] if x.get("k") == "ev"]


def first(evs, pred, after=3.0):
    return next((e for e in evs if e["t"] >= after and pred(e)), None)


def writ_moments(evs, end):
    """Writ releases split into hit and miss by what follows within 1 s.
    A hit is anchored on its impact (the first unblocked hit after the
    release), a miss on the release. Only Writs alone in that second count,
    so no other round's hit is mistaken for the Writ's."""
    out = {}
    for e in evs:
        if e["type"] != "playerFired" or e.get("shot") != "writ":
            continue
        if not 3 <= e["t"] <= end - POST:
            continue
        others = [x for x in evs if x["type"] == "playerFired" and x is not e
                  and abs(x["t"] - e["t"]) < 0.8]
        if others:
            continue
        follow = [x for x in evs if e["t"] < x["t"] <= e["t"] + 0.8
                  and x["type"] == "hit" and x.get("target") != "player" and not x.get("blocked")]
        key = f"writ{e['level']}-{'hit' if follow else 'miss'}"
        out.setdefault(key, follow[0] if follow else e)
    return out


def dense(evs):
    hits = [e for e in evs if e["type"] == "hit" and e.get("target") != "player"
            and not e.get("blocked") and 10 < e["t"] < 70]
    best, at = 0, None
    for e in hits:
        n = sum(1 for x in hits if e["t"] <= x["t"] < e["t"] + 1.0)
        if n > best:
            best, at = n, e
    return at


def life_kill(arm):
    for clip in ["ram", "writ", "disarm", "boss-fight", "boss-pacifist"]:
        evs = events(arm, clip)
        lost = {e["tick"] for e in evs if e["type"] == "lifeLost"}
        for e in evs:
            if e["type"] == "kill" and e["tick"] in lost and e["t"] > 3:
                return clip, next(x for x in evs if x["type"] == "lifeLost" and x["tick"] == e["tick"])
    return None, None


def clip_end(arm, clip):
    return json.loads((REC / arm / clip / "truth.json").read_text())["log"][-1]["t"]


def pick(arm):
    chosen = {}
    # A disarm with room after it: the sector 2 run's first pickup starts
    # the unskippable flashback at about 17.5 s, so prefer scripted clips.
    chosen["disarm"] = (None, None)
    for clip in ["writ", "ram", "disarm"]:
        end = clip_end(arm, clip)
        hit = first(events(arm, clip), lambda e: e["type"] == "disarm" and e["t"] < end - POST)
        if hit:
            chosen["disarm"] = (clip, hit)
            break
    bp = events(arm, "boss-pacifist")
    chosen["pod-break"] = ("boss-pacifist", first(bp, lambda e: e["type"] == "partBreak" and e["target"] == "boss"))
    bf = events(arm, "boss-fight")
    chosen["deflect"] = ("boss-fight", first(bf, lambda e: e["type"] == "hit" and e.get("blocked")))
    chosen["dense"] = ("boss-fight", dense(bf))
    w = {}
    for clip in ["writ", "writ1", "boss-fight"]:
        for k, v in writ_moments(events(arm, clip), clip_end(arm, clip)).items():
            w.setdefault(k, (clip, v))
    # The after arm's hits carry their Writ level, so a Writ hit in the
    # fight autopilot's stream is unambiguous there.
    for clip in ["writ", "writ1", "boss-fight"]:
        for e in events(arm, clip):
            lvl = e.get("level") if e["type"] == "hit" else None
            if lvl and not e.get("blocked") and e["t"] > 3:
                w.setdefault(f"writ{lvl}-hit", (clip, e))
    for k in ["writ1-hit", "writ1-miss", "writ3-hit", "writ3-miss"]:
        chosen[k] = w.get(k, (None, None))
    # A Writ into a deflecting Warden (verified weakness 4).
    bf_writs = [e for e in bf if e["type"] == "playerFired" and e.get("shot") == "writ"]
    chosen["writ-deflect"] = ("boss-fight", next(
        (x for x in bf if x["type"] == "hit" and x.get("blocked") and x["t"] > 3
         and any(0 < x["t"] - r["t"] < 0.5 for r in bf_writs)), None))
    chosen["life-kill"] = life_kill(arm)
    return chosen


def probe(wav: Path, t: float, start: float, end: float) -> dict:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ss", str(start), "-to", str(end),
                          "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    win = 400  # 50 ms at 8 kHz
    n = len(x) // win
    rms = np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    # The 50 ms peak from 50 ms before the event to 600 ms after it.
    i0 = int((t - start) / 0.05)
    peak = float(db[max(0, i0 - 1): i0 + 12].max())
    return {"peakDb": round(peak, 1), "medianDb": round(float(np.median(db)), 1),
            "overMedianDb": round(peak - float(np.median(db)), 1)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    summary = []
    for arm in ["before", "after"]:
        for topic, (clip, ev) in pick(arm).items():
            if ev is None:
                summary.append({"topic": topic, "arm": arm, "missing": True})
                print(f"{topic} {arm}: no moment found")
                continue
            src = REC / arm / clip / "reel.mp4"
            start = max(0.0, ev["t"] - PRE)
            end = ev["t"] + POST
            name = f"{topic}-{arm}.mp4"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
                            "-i", str(src), "-vf", "scale=854:480", "-c:v", "libx264", "-crf", "27",
                            "-preset", "veryfast", "-c:a", "aac", "-b:a", "128k", str(OUT / name)], check=True)
            truth = [{"t": round(x["t"] - start, 2), **{k: v for k, v in x.items() if k not in ("t",)}}
                     for x in events(arm, clip) if start <= x["t"] <= end
                     and x["type"] not in ("payChanged", "nearMiss", "statsMoment", "enemyFired", "graze")]
            row = {"topic": topic, "arm": arm, "file": name, "source": f"{arm}/{clip}",
                   "eventAt": round(ev["t"] - start, 2), "eventType": ev["type"], "tick": ev.get("tick"),
                   "audio": probe(src, ev["t"], start, end), "truth": truth}
            summary.append(row)
            print(f"{topic} {arm}: {clip} t={ev['t']:.2f} {row['audio']}")
    (OUT / "clips.json").write_text(json.dumps(summary, indent=1) + "\n")


main()
