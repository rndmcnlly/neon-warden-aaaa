#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "soundfile", "pyyaml"]
# ///
"""Render music cue candidates from music/cues.yaml with Stable Audio 3 (MLX).

    uv run music/render.py                 # every cue, default count
    uv run music/render.py --cue boss      # one cue (repeatable)
    uv run music/render.py --count 1       # quick smoke test

Writes music/candidates/<cue>/<cue>_<nn>.wav (stereo 44.1 kHz, as rendered,
with a short fade-out on non-looping cues) and music/candidates/index.json /
index.js (prompt, seed, model, wall time, peak) for audition.html. Renders
whose inputs are unchanged are skipped, keyed by a hash of the inputs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import yaml

MUSIC = Path(__file__).resolve().parent
OUT = MUSIC / "candidates"
# Stable Audio 3 MLX weights are not in the repo: point SA3_DIR at your checkout.
SA3_DIR = Path(os.environ.get("SA3_DIR", MUSIC / "sa3")).expanduser()
DECODER = {"medium": "same-l", "sm-music": "same-s"}
BASE_SEED = 121


def spec_for(cue_id: str, cue: dict, cfg: dict, n: int) -> dict:
    d = {**cfg["defaults"], **cue}
    return {
        "prompt": f"{' '.join(cue['brief'].split())}. {' '.join(cfg['family'].split())}",
        "negative": cfg["negative"],
        "model": d["model"],
        "seconds": float(d["seconds"]),
        "steps": int(d["steps"]),
        "cfg": float(d["cfg"]),
        "seed": BASE_SEED + 1000 * n + sum(map(ord, cue_id)),
    }


def spec_hash(spec: dict) -> str:
    return hashlib.sha256(json.dumps(spec, sort_keys=True).encode()).hexdigest()[:16]


def render(spec: dict, dest: Path) -> float:
    cmd = [
        str(SA3_DIR / ".venv/bin/python"), "scripts/sa3_mlx.py",
        "--prompt", spec["prompt"], "--negative-prompt", spec["negative"],
        "--dit", spec["model"], "--decoder", DECODER[spec["model"]],
        "--seconds", str(spec["seconds"]), "--steps", str(spec["steps"]),
        "--cfg", str(spec["cfg"]), "--seed", str(spec["seed"]), "--out", str(dest),
    ]
    t0 = time.perf_counter()
    r = subprocess.run(cmd, cwd=SA3_DIR, capture_output=True, text=True)
    if r.returncode != 0 or not dest.exists():
        sys.exit(f"sa3 failed for {dest.name}:\n{r.stderr[-1500:]}")
    return time.perf_counter() - t0


def fade_out(path: Path, ms: float = 1500) -> float:
    """Applies a tail fade (non-looping cues) and returns the peak."""
    x, sr = sf.read(path, always_2d=True)
    n = min(len(x), int(sr * ms / 1000))
    x[-n:] *= np.linspace(1, 0, n)[:, None]
    sf.write(path, x, sr, subtype="PCM_16")
    return float(np.max(np.abs(x)))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cue", action="append")
    ap.add_argument("--count", type=int)
    args = ap.parse_args()
    cfg = yaml.safe_load((MUSIC / "cues.yaml").read_text())
    index_path = OUT / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"cues": {}}
    for cue_id, cue in cfg["cues"].items():
        if args.cue and cue_id not in args.cue:
            continue
        count = args.count or cue.get("count", cfg["defaults"]["count"])
        entries = []
        for n in range(count):
            spec = spec_for(cue_id, cue, cfg, n)
            h = spec_hash(spec)
            dest = OUT / cue_id / f"{cue_id}_{n + 1:02d}.wav"
            prior = next((e for e in index["cues"].get(cue_id, []) if e["hash"] == h), None)
            if prior and dest.exists():
                entries.append(prior)
                print(f"[cache] {dest.relative_to(MUSIC)}")
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            wall = render(spec, dest)
            peak = fade_out(dest) if not cue.get("loop") else float(np.max(np.abs(sf.read(dest)[0])))
            entries.append({"file": str(dest.relative_to(OUT)), "hash": h, "wall_s": round(wall, 1),
                            "peak": round(peak, 3), "loop": bool(cue.get("loop")), **spec})
            print(f"[render] {dest.relative_to(MUSIC)} {spec['seconds']:.0f}s in {wall:.1f}s")
        index["cues"][cue_id] = entries
    index["model"] = f"stable-audio-3/{cfg['defaults']['model']}"
    OUT.mkdir(exist_ok=True)
    index_path.write_text(json.dumps(index, indent=2))
    (OUT / "index.js").write_text(f"globalThis.MUSIC_INDEX = {json.dumps(index)};\n")


if __name__ == "__main__":
    main()
