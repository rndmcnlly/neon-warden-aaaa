# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
"""Numbers for the README from the captured arms (before, after).

uv run --script analyze.py <captureRoot>      (writes metrics.json here)

- move-sfx (music muted): 50 ms RMS of the mix in dBFS, median over held
  cruise legs, over stops and rests, and the peak within 150 ms of each
  marked direction change. The engine bed should lift cruise over rest;
  the transients should lift direction changes.
- lane-s1, lane-s3: floor value and saturation per frame (1 fps, 2-14 s),
  via measure_floor.py's key; medians over frames.
- tutorial-vo: per voice line, subtitle appearance versus the first audible
  speech: the take's measured onset minus where playback started.
"""
import json
import statistics as st
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from measure_floor import measure  # noqa: E402

root = Path(sys.argv[1])
REPO = HERE.parent.parent
cues = json.loads((REPO / "public/vo/cues.json").read_text())["lines"]
KEEP = 0.12  # VO_LEAD_KEEP_S in src/audio/manifests.ts


def audio(clip: Path, rate: int = 16000) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(clip / "reel.mp4"), "-ac", "1",
         "-ar", str(rate), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def rms_db(x: np.ndarray, t0: float, t1: float, rate: int = 16000) -> float:
    seg = x[int(t0 * rate):int(t1 * rate)]
    return float(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)) if len(seg) else -120


def windows(x: np.ndarray, t0: float, t1: float, w: float = 0.05) -> list[float]:
    return [rms_db(x, t, t + w) for t in np.arange(t0, t1 - w, w)]


def move(arm: str) -> dict:
    clip = root / arm / "move-sfx"
    truth = json.loads((clip / "truth.json").read_text())
    marks = truth["marks"]
    x = audio(clip)
    cruise, rest, changes = [], [], []
    for i, m in enumerate(marks[:-1]):
        nxt = marks[i + 1]["t"]
        label = m["label"]
        span = windows(x, m["t"] + 0.15, nxt)
        if "stop" in label:
            rest += span
        elif "focus on" not in label and "focus off" not in label:
            cruise += [(label.startswith("focus"), v) for v in span]
        if "reverse" in label or "stop" in label:
            changes.append(max(windows(x, m["t"], m["t"] + 0.2)))
    return {
        "cruise_db": round(st.median(v for f, v in cruise if not f), 1),
        "focus_cruise_db": round(st.median(v for f, v in cruise if f), 1),
        "rest_db": round(st.median(rest), 1),
        "change_peak_db": round(st.median(changes), 1),
        "clip_median_db": round(st.median(windows(x, 3, 20)), 1),
    }


def lane(arm: str, clip_id: str) -> dict:
    clip = root / arm / clip_id
    out = Path("/tmp") / f"nw-lane-{arm}-{clip_id}"
    out.mkdir(exist_ok=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", "2", "-t", "12", "-i",
                    str(clip / "reel.mp4"), "-vf", "fps=1", str(out / "f%02d.png")], check=True)
    rows = [measure(str(p)) for p in sorted(out.glob("f*.png"))]
    keys = ["floor_v_median", "floor_v_p95", "floor_s_median", "floor_s_p95",
            "floor_c_median", "floor_c_p95", "combat_v_median", "combat_s_median",
            "combat_c_median"]
    return {k: round(st.median(r[k] for r in rows if k in r), 3) for k in keys} | {"frames": len(rows)}


def vo(arm: str) -> dict:
    truth = json.loads((root / arm / "tutorial-vo" / "truth.json").read_text())
    rows = []
    for s in truth["sources"]:
        if not s["url"].startswith("vo/"):
            continue
        lang, name = s["url"].split("/")[1:3]
        take = cues[name.removesuffix(".ogg")]["langs"][lang]
        onset = take.get("onsetS", 0)
        start = max(0.0, onset - KEEP) if arm == "after" else 0.0
        subs = [u["t"] for u in truth["subs"] if abs(u["t"] - s["t"]) < 0.3]
        sub = min(subs, key=lambda u: abs(u - s["t"])) if subs else s["t"]
        rows.append({"line": name, "subtitle_s": round(sub, 2),
                     "voice_audible_s": round(s["t"] + onset - start, 2),
                     "lead_s": round(s["t"] + onset - start - sub, 2)})
    return {"lines": rows, "median_lead_s": round(st.median(r["lead_s"] for r in rows), 2)}


metrics = {arm: {"move": move(arm), "lane-s1": lane(arm, "lane-s1"),
                 "lane-s3": lane(arm, "lane-s3"), "vo": vo(arm)} for arm in ("before", "after")}
(HERE / "metrics.json").write_text(json.dumps(metrics, indent=1) + "\n")
print(json.dumps(metrics, indent=1))
