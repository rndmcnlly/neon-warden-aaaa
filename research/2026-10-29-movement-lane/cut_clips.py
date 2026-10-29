#!/usr/bin/env python3
"""Cuts the reviewable clips from both captured arms; writes clips/clips.json.

python3 -I cut_clips.py <captureRoot>     (run from this folder; needs ffmpeg)

Windows come from the truth logs (marks and sim events), never by eye. Each
clip is short and single-topic, 854x480 H.264 with the game's real audio.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
root = Path(sys.argv[1])
out = HERE / "clips"
out.mkdir(exist_ok=True)
metrics = json.loads((HERE / "metrics.json").read_text())


def truth(arm: str, clip: str) -> dict:
    return json.loads((root / arm / clip / "truth.json").read_text())


def first_event(arm: str, clip: str, kind: str) -> float:
    return min(x["t"] for x in truth(arm, clip)["log"]
               if x["k"] == "ev" and x["ev"]["type"] == kind)


TOPICS = {
    # topic: (source clip, window start, window length, evidence)
    "move": ("move", lambda arm: 3.0, 12.0),
    "move-sfx": ("move-sfx", lambda arm: 3.0, 12.0),
    "lane-s1": ("lane-s1", lambda arm: 2.0, 10.0),
    "lane-s3": ("lane-s3", lambda arm: 2.0, 10.0),
    "debris": ("debris-boss", lambda arm: first_event(arm, "debris-boss", "partBreak") - 1.0, 6.0),
    "tutorial-vo": ("tutorial-vo", lambda arm: 0.0, 19.0),
}

rows = []
for topic, (clip, start_of, length) in TOPICS.items():
    for arm in ("before", "after"):
        start = round(start_of(arm), 2)
        t = truth(arm, clip)
        file = f"{topic}-{arm}.mp4"
        subprocess.run([
            "ffmpeg", "-loglevel", "error", "-y", "-ss", str(start), "-t", str(length),
            "-i", str(root / arm / clip / "reel.mp4"), "-vf", "scale=854:480",
            "-c:v", "libx264", "-crf", "26", "-preset", "veryfast", "-c:a", "aac",
            "-b:a", "128k", str(out / file)], check=True)
        inside = lambda x: start <= x["t"] <= start + length  # noqa: E731
        evidence = [{"t": round(m["t"] - start, 2), "what": m["label"]}
                    for m in t["marks"] if inside(m)]
        evidence += [{"t": round(x["t"] - start, 2), "what": x["ev"]["type"]}
                     for x in t["log"] if x["k"] == "ev" and inside(x)
                     and x["ev"]["type"] in ("partBreak", "disarm", "focusChanged", "kill")]
        if topic == "tutorial-vo":
            evidence += [{"t": round(s["t"] - start, 2), "what": f"subtitle: {s.get('text', '')[:48]}"}
                         for s in t["subs"] if inside(s) and s.get("text")]
            evidence += [{"t": round(r["voice_audible_s"] - start, 2),
                          "what": f"voice audible ({r['line']}, lead {r['lead_s']} s)"}
                         for r in metrics[arm]["vo"]["lines"]
                         if start <= r["voice_audible_s"] <= start + length]
        evidence.sort(key=lambda e: e["t"])
        rows.append({"topic": topic, "arm": arm, "file": file, "source": f"{arm}/{clip}",
                     "start": start, "seconds": length, "errors": len(t["errors"]),
                     "evidence": evidence})
(out / "clips.json").write_text(json.dumps(rows, indent=1) + "\n")
print(f"{len(rows)} clips -> {out}")
