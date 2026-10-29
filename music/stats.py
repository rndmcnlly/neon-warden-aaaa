#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["librosa>=0.10", "numpy"]
# ///
"""Objective stats for every music candidate, and a provisional pick per cue.

    uv run music/stats.py            # writes music/candidates/stats.json
    uv run music/stats.py --picks    # also writes music/picks.json (provisional)

Ears decide in the end (audition, then the in-context A/B reels); this only
gives every scene *some* music meanwhile, picked by numbers that predict
trouble:

- loudness consistency: the spread (p90 - p10) of 3 s short-term loudness,
  in LU. A take that swells and dies sits badly under VO.
- loopability (looping cues only): the best seam a whole number of bars
  after the first beat, scored by the cosine similarity of the log-mel
  spectrum just before the loop end and just after the loop start (1 is a
  seamless join).
- tempo fit: distance from the briefed BPM (gameplay wants about 129, the
  sim's beat; see src/audio/beatGrid.ts), allowing double and half time.

Score = loopability - 0.03 * spread_lu - 0.01 * tempo_err_bpm (stings and
endings skip the loop term). The weights are a rough guess, written down so
they can be argued with.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

MUSIC = Path(__file__).resolve().parent
CANDS = MUSIC / "candidates"

# Briefed tempo per cue; gameplay targets the sim's 129 BPM grid.
TARGET_BPM = {"gameplay": 129.0}


def short_term_spread(path: Path) -> tuple[float, float, float]:
    """(integrated LUFS, p10-p90 spread of short-term loudness, true peak)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
                        "-af", "ebur128=peak=true:framelog=info", "-f", "null", "-"],
                       capture_output=True, text=True)
    st = [float(m) for m in re.findall(r"S:\s*(-?[\d.]+)", r.stderr)]
    st = sorted(x for x in st if x > -70)
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1))
    if len(st) < 10:
        return i, 0.0, tp
    p10 = st[len(st) // 10]
    p90 = st[(len(st) * 9) // 10]
    return i, p90 - p10, tp


def analyse(path: Path, loop: bool, target: float | None) -> dict:
    import librosa
    import numpy as np
    y, sr = librosa.load(path, sr=22050, mono=True)
    dur = len(y) / sr
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])
    times = librosa.frames_to_time(beats, sr=sr)
    first = float(times[0]) if len(times) else 0.0
    lufs, spread, tp = short_term_spread(path)
    out = {"bpm": round(bpm, 2), "beatOffset": round(first, 3),
           "duration": round(dur, 2), "lufs": lufs, "truePeak": tp,
           "spreadLu": round(spread, 2)}
    if target:
        err = min(abs(bpm - target), abs(bpm * 2 - target), abs(bpm / 2 - target))
        out["tempoErr"] = round(err, 2)
    if loop:
        mel = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=sr, n_mels=64))
        hop = 512 / sr
        win = int(0.75 / hop)

        def frames(t: float) -> int:
            return int(round(t / hop))

        bar = 4 * 60.0 / bpm
        best = (-1.0, dur)
        n = 1
        while first + n * bar <= dur - 0.05:
            end = first + n * bar
            if end > dur * 0.6:
                a = mel[:, max(0, frames(end) - win):frames(end)]
                b = mel[:, frames(first) - win if frames(first) >= win else 0:frames(first)]
                # Compare what precedes the seam on both sides: if the bar before
                # loopEnd sounds like the bar before loopStart, the jump is seamless.
                if a.shape[1] == b.shape[1] and a.shape[1] > 0:
                    va, vb = a.mean(axis=1), b.mean(axis=1)
                    va, vb = va - va.mean(), vb - vb.mean()
                    sim = float(va @ vb / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-9))
                    best = max(best, (sim, end))
                after_a = mel[:, frames(end):frames(end) + win]
                after_b = mel[:, frames(first):frames(first) + win]
                if after_a.shape[1] == after_b.shape[1] == win:
                    va, vb = after_a.mean(axis=1), after_b.mean(axis=1)
                    va, vb = va - va.mean(), vb - vb.mean()
                    sim = float(va @ vb / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-9))
                    best = max(best, (sim, end))
            n += 1
        out["loopStart"] = round(first, 3)
        out["loopEnd"] = round(best[1], 3)
        out["loopability"] = round(best[0], 3)
    score = out.get("loopability", 0.0) - 0.03 * spread - 0.01 * out.get("tempoErr", 0.0)
    out["score"] = round(score, 3)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--picks", action="store_true", help="write music/picks.json")
    args = ap.parse_args()
    index = json.loads((CANDS / "index.json").read_text())
    stats: dict = {}
    picks: dict = {}
    for cue, entries in index["cues"].items():
        target = TARGET_BPM.get(cue)
        if target is None:
            m = re.search(r"(\d+) BPM", entries[0]["prompt"])
            target = float(m.group(1)) if m else None
        rows = []
        for i, e in enumerate(entries, start=1):
            s = analyse(CANDS / e["file"], e["loop"], target)
            s |= {"file": e["file"], "variant": f"cand{i}", "loop": e["loop"]}
            rows.append(s)
            print(f"{cue:16} cand{i}: {json.dumps({k: s[k] for k in s if k not in ('file',)})}")
        stats[cue] = rows
        best = max(rows, key=lambda r: r["score"])
        pick = {"file": best["file"], "variant": best["variant"], "provisional": True,
                "why": f"highest objective score {best['score']} (stats.py)"}
        if best["loop"]:
            pick |= {"loopStart": best["loopStart"], "loopEnd": best["loopEnd"]}
        picks[cue] = pick
    (CANDS / "stats.json").write_text(json.dumps(stats, indent=1) + "\n")
    print(f"wrote {CANDS / 'stats.json'}")
    if args.picks:
        (MUSIC / "picks.json").write_text(json.dumps(picks, indent=2) + "\n")
        print(f"wrote {MUSIC / 'picks.json'}")


if __name__ == "__main__":
    main()
