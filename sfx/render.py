#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "scipy", "soundfile", "pyyaml", "pyloudnorm", "fal-client>=0.5", "requests"]
# ///
"""Render sound candidates from a manifest with one of two engines.

    uv run sfx/render.py                    # UI roles (sfx/manifest.yaml, SA3)
    uv run sfx/render.py --count 2          # quick smoke test
    uv run sfx/render.py --role confirm     # one role (repeatable)
    uv run sfx/render.py --reprocess        # redo post-processing only
    uv run sfx/render.py --manifest sfx/gameplay.yaml   # gameplay (ElevenLabs)

Engines (the manifest's `engine:`):
- `sa3`: local Stable Audio 3 (MLX), free, seeded.
- `elevenlabs`: ElevenLabs SFX v2 on fal (`fal-ai/elevenlabs/sound-effects/v2`),
  US $0.002 per billed second, no seed. Needs FAL_KEY (for example
  an env file you `source`). Before any paid call the script prints the
  estimated cost of the uncached renders and refuses past `--max-usd`
  (default 3). Each call is logged to <out>/.cache/fal_calls.jsonl; copy the
  totals into research/SPEND.md.

Raw model renders are cached in <out>/.cache/<hash>.wav, keyed on the render
spec (model, family brief, role brief, seed or take, render length, sampler).
Post-processing is cheap and always reapplied, so loudness or trim tweaks
never need a re-render. Outputs: sfx/candidates/<role>/<role>_<nn>.wav (mono,
48 kHz, 24-bit) plus sfx/candidates/index.json and index.js (same data, for
opening audition.html straight from disk). <out> is the manifest's `out:`
(default `candidates`; gameplay uses `candidates/gameplay`).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request
from math import gcd
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile as sf
import yaml
from scipy.signal import resample_poly

SFX = Path(__file__).resolve().parent
OUT = SFX / "candidates"
CACHE = OUT / ".cache"
# Stable Audio 3 MLX weights are not in the repo: point SA3_DIR at your checkout.
SA3_DIR = Path(os.environ.get("SA3_DIR", SFX / "sa3")).expanduser()
DECODER = {"sm-sfx": "same-s", "sm-music": "same-s", "medium": "same-l"}
EL_USD_PER_S = 0.002
EL_MIN_S = 0.5


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-12))


# ---------------------------------------------------------------- rendering

def render_spec(manifest: dict, name: str, role: dict, nn: int) -> dict:
    d = manifest["defaults"] | {k: v for k, v in role.items() if k in manifest["defaults"]}
    if manifest.get("engine") == "elevenlabs":
        return {
            "engine": "elevenlabs",
            "model": d["model"],
            "family": " ".join(manifest["family"].split()),
            "brief": brief_for(role, nn),
            "take": nn,  # no seed: the take number keeps candidates distinct in the cache
            "seconds": max(EL_MIN_S, float(d["render_seconds"])),
            "prompt_influence": float(d["prompt_influence"]),
            "loop": bool(role.get("loop", False)),
        }
    return {
        "engine": manifest.get("engine", "sa3"),
        "model": d["model"],
        "family": " ".join(manifest["family"].split()),
        "brief": " ".join(role["brief"].split()),
        "seed": int(role["seed"]) + nn - 1,
        "seconds": float(d["render_seconds"]),
        "steps": int(d["steps"]),
        "cfg": float(d["cfg"]),
        "negative": " ".join(d["negative"].split()),
    }


def brief_for(role: dict, nn: int) -> str:
    """Candidate nn's brief: roles may list deliberately different `briefs`
    (sfx/README.md, "Lesson from the first audition"), cycled per take."""
    briefs = role.get("briefs")
    text = briefs[(nn - 1) % len(briefs)] if briefs else role["brief"]
    return " ".join(text.split())


def role_count(manifest: dict, role: dict, override: int | None) -> int:
    if override:
        return override
    if "count" in role:
        return int(role["count"])
    return len(role["briefs"]) if role.get("briefs") else int(manifest["defaults"]["count"])


def spec_hash(spec: dict) -> str:
    return hashlib.sha256(json.dumps(spec, sort_keys=True).encode()).hexdigest()[:16]


def render_elevenlabs(spec: dict, dest: Path) -> float:
    """One paid call; the response is cached forever under its spec hash."""
    import fal_client  # only needed for this engine
    t0 = time.perf_counter()
    res = fal_client.subscribe(spec["model"], arguments={
        "text": f"{spec['brief']}. {spec['family']}",
        "duration_seconds": spec["seconds"],
        "prompt_influence": spec["prompt_influence"],
        "loop": spec["loop"],
        "output_format": "pcm_48000",
    })
    url = res["audio"]["url"]
    tmp = dest.with_suffix(".download")
    urllib.request.urlretrieve(url, tmp)
    # Whatever container fal returns, cache a plain WAV.
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(tmp),
                    str(dest)], check=True)
    tmp.unlink()
    wall = time.perf_counter() - t0
    with (dest.parent / "fal_calls.jsonl").open("a") as log:
        log.write(json.dumps({"when": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "model": spec["model"],
                              "brief": spec["brief"], "take": spec["take"],
                              "seconds_billed": spec["seconds"],
                              "usd": round(spec["seconds"] * EL_USD_PER_S, 4),
                              "wall_s": round(wall, 2), "hash": dest.stem}) + "\n")
    return wall


def render_raw(spec: dict, dest: Path) -> float:
    if spec["engine"] == "elevenlabs":
        return render_elevenlabs(spec, dest)
    prompt = f"{spec['brief']}. {spec['family']}"
    cmd = [
        str(SA3_DIR / ".venv/bin/python"), "scripts/sa3_mlx.py",
        "--prompt", prompt, "--negative-prompt", spec["negative"],
        "--dit", spec["model"], "--decoder", DECODER[spec["model"]],
        "--seconds", str(spec["seconds"]), "--steps", str(spec["steps"]),
        "--cfg", str(spec["cfg"]), "--seed", str(spec["seed"]),
        "--out", str(dest),
    ]
    t0 = time.perf_counter()
    r = subprocess.run(cmd, cwd=SA3_DIR, capture_output=True, text=True)
    if r.returncode != 0 or not dest.exists():
        sys.exit(f"sa3 failed for seed {spec['seed']}:\n{r.stderr[-1500:]}")
    return time.perf_counter() - t0


# ---------------------------------------------------------- post-processing

def envelope(x: np.ndarray, sr: int, ms: float = 5.0) -> np.ndarray:
    n = max(1, int(sr * ms / 1000))
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode="same"))


def true_peak(x: np.ndarray) -> float:
    return float(np.max(np.abs(resample_poly(x, 4, 1)))) if len(x) else 0.0


def process(raw: np.ndarray, raw_sr: int, role: dict, loud: dict) -> tuple[np.ndarray, dict]:
    """Mono, 48 kHz, trim, cut, fade, normalize. Returns audio and stats/flags."""
    sr = int(loud["sample_rate"])
    flags: list[str] = []
    x = raw.mean(axis=1) if raw.ndim == 2 else raw
    raw_clip = float(np.mean(np.abs(x) >= 0.999))
    if raw_clip > 0.005:  # the model peak-normalizes then clamps, so a few full-scale samples are normal
        flags.append("clipped")
    g = gcd(sr, raw_sr)
    x = resample_poly(x, sr // g, raw_sr // g)
    x = x - np.mean(x)

    env = envelope(x, sr)
    peak = float(env.max())
    if peak < 1e-4:
        return np.zeros(int(sr * 0.05)), {"flags": ["silent"]}
    above = np.nonzero(env > peak * 10 ** (-40 / 20))[0]
    start = max(0, above[0] - int(sr * 0.002))
    natural_end = np.nonzero(env > peak * 10 ** (-50 / 20))[0][-1] + 1
    lead_ms = 1000 * start / sr
    if lead_ms > 400:
        flags.append("late_onset")

    target = int(sr * role["target_ms"] / 1000)
    end = min(natural_end, start + target)
    if natural_end - start > target * 1.15:
        # still sounding at the cut point? compare the last 30 ms to the body
        tail = env[max(start, end - int(sr * 0.03)):end].mean()
        if tail > peak * 10 ** (-18 / 20):
            flags.append("truncated")
    y = x[start:end].copy()

    fade_in = min(len(y), int(sr * 0.001))
    y[:fade_in] *= np.linspace(0, 1, fade_in)
    fade = min(len(y), int(sr * loud["fade_ms"] / 1000))
    y[len(y) - fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2

    if len(y) < sr * 0.025:
        flags.append("too_short")

    # spectral flatness near 1 means noise rather than a tone or click
    spec = np.abs(np.fft.rfft(y * np.hanning(len(y)))) + 1e-12
    flatness = float(np.exp(np.mean(np.log(spec))) / np.mean(spec))
    if flatness > 0.45:  # clicks are broadband by nature, so the bar is high
        flags.append("noisy")

    e = envelope(y, sr)
    active = y[e > e.max() * 10 ** (-40 / 20)]
    rms = float(np.sqrt(np.mean(active ** 2))) if len(active) else 1e-9
    want = loud["target_rms_dbfs"] + role.get("gain_db", 0.0)
    gain = want - db(rms)
    tp = db(true_peak(y))
    if tp + gain > loud["ceiling_dbtp"]:
        gain = loud["ceiling_dbtp"] - tp
        if want - (db(rms) + gain) > 1.5:
            flags.append("peak_limited")
    y *= 10 ** (gain / 20)

    stats = {
        "duration_ms": round(1000 * len(y) / sr),
        "natural_ms": round(1000 * (natural_end - start) / sr),
        "lead_silence_ms": round(lead_ms),
        "active_rms_dbfs": round(db(float(np.sqrt(np.mean(active ** 2))) * 10 ** (gain / 20)), 1),
        "true_peak_dbtp": round(db(true_peak(y)), 1),
        "lufs": None,
        "flatness": round(flatness, 3),
        "flags": flags,
    }
    if len(y) >= int(sr * 0.4):
        stats["lufs"] = round(float(pyloudnorm.Meter(sr).integrated_loudness(y)), 1)
    return y, stats


# --------------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", type=Path, default=SFX / "manifest.yaml")
    ap.add_argument("--role", action="append", help="render only this role (repeatable)")
    ap.add_argument("--count", type=int, help="override candidate count per role")
    ap.add_argument("--reprocess", action="store_true", help="never call the model; cached renders only")
    ap.add_argument("--max-usd", type=float, default=3.0, help="refuse paid renders estimated above this")
    args = ap.parse_args()

    manifest = yaml.safe_load(args.manifest.read_text())
    global OUT, CACHE
    OUT = SFX / manifest.get("out", "candidates")
    CACHE = OUT / ".cache"
    index_var = manifest.get("index_var", "SFX_INDEX")
    roles = manifest["roles"]
    unknown = set(args.role or []) - set(roles)
    if unknown:
        sys.exit(f"unknown role(s): {', '.join(sorted(unknown))}; known: {', '.join(roles)}")
    selected = args.role or list(roles)
    loud = manifest["loudness"]

    CACHE.mkdir(parents=True, exist_ok=True)
    index_path = OUT / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"roles": {}}
    index["roles"] = {k: v for k, v in index.get("roles", {}).items() if k in roles}

    if manifest.get("engine") == "elevenlabs" and not args.reprocess:
        todo = [render_spec(manifest, n, roles[n], nn) for n in selected
                for nn in range(1, role_count(manifest, roles[n], args.count) + 1)]
        todo = [sp for sp in todo if not (CACHE / f"{spec_hash(sp)}.wav").exists()]
        usd = sum(sp["seconds"] for sp in todo) * EL_USD_PER_S
        print(f"elevenlabs: {len(todo)} uncached renders, about US ${usd:.3f}")
        if usd > args.max_usd:
            sys.exit(f"estimate exceeds --max-usd {args.max_usd}; ask before spending more")

    t_all = time.perf_counter()
    n_rendered = 0
    for name in selected:
        role = roles[name]
        count = role_count(manifest, role, args.count)
        role_dir = OUT / name
        role_dir.mkdir(parents=True, exist_ok=True)
        entries = []
        for nn in range(1, count + 1):
            spec = render_spec(manifest, name, role, nn)
            h = spec_hash(spec)
            raw_path = CACHE / f"{h}.wav"
            render_s = None
            if not raw_path.exists():
                if args.reprocess:
                    print(f"  {name}_{nn:02d}: no cached render, skipped")
                    continue
                render_s = round(render_raw(spec, raw_path), 2)
                n_rendered += 1
            raw, raw_sr = sf.read(raw_path, always_2d=False)
            y, stats = process(raw, raw_sr, role, loud)
            fname = f"{name}_{nn:02d}.wav"
            sf.write(role_dir / fname, y, int(loud["sample_rate"]), subtype="PCM_24")
            entries.append({"file": f"{name}/{fname}", "nn": nn, "seed": spec.get("seed"),
                            "brief": spec["brief"],
                            "hash": h, "render_s": render_s, **stats})
            tag = f"{render_s:.1f}s" if render_s is not None else "cached"
            print(f"  {name}_{nn:02d}  {tag:>7}  {stats.get('duration_ms', 0):4d} ms  "
                  f"{','.join(stats['flags']) or 'ok'}")
        keep = {e["file"].split("/")[1] for e in entries}
        for stale in role_dir.glob(f"{name}_*.wav"):
            if stale.name not in keep:
                stale.unlink()
        index["roles"][name] = {
            "brief": " | ".join(role["briefs"]) if role.get("briefs") else " ".join(role["brief"].split()),
            "target_ms": role["target_ms"],
            "gain_db": role.get("gain_db", 0.0),
            "candidates": entries,
        }

    index["family"] = " ".join(manifest["family"].split())
    index["loudness"] = loud
    index["model"] = f"{manifest.get('engine', 'sa3')}/{manifest['defaults']['model']}"
    index["engine"] = manifest.get("engine", "sa3")
    index["order"] = [r for r in roles if r in index["roles"]]
    index["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    text = json.dumps(index, indent=1)
    index_path.write_text(text + "\n")
    (OUT / "index.js").write_text(f"window.{index_var} = {text};\n")
    print(f"{n_rendered} new renders, {time.perf_counter() - t_all:.1f}s total; wrote {index_path.relative_to(SFX.parent)}")


if __name__ == "__main__":
    main()
