#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["librosa>=0.10", "numpy"]
# ///
"""Promote picked music candidates into public/music/ for the game.

    uv run music/promote.py             # encode picks, write manifest
    uv run music/promote.py --dry-run   # show what would happen

Reads music/picks.json (absent means nothing picked yet):
    { "gameplay": { "file": "gameplay/gameplay_02.wav",
                    "loopStart": 0.0, "loopEnd": 59.5 }, "boss": null, ... }
Writes public/music/<cue>.ogg (Ogg Opus 128 kb/s, loudness-normalized to
-16 LUFS so cues sit together on the music bus) and public/music/manifest.json
in the shape src/audio/manifests.ts reads. The manifest is always written,
with every runtime cue listed (null when unpicked), so the game never
requests a missing file. Needs ffmpeg on PATH only when something is picked.

Each promoted cue also gets its beat grid, measured here rather than trusted
from the brief (Stable Audio does not reliably honor a BPM tag): `bpm`
(beat-tracked; a pick may override it with "bpm"), `beatOffset` (seconds to
the first tracked beat), `beatsPerBar` (4), and `key` ({root: MIDI note,
mode}, from a Krumhansl-Schmuckler chroma match). The game snaps its musical
sound layer to that grid and key (src/audio/beatGrid.ts), so check the
numbers by ear: a pick may override any of them.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

MUSIC = Path(__file__).resolve().parent
ROOT = MUSIC.parent
PUBLIC = ROOT / "public" / "music"

# Candidate cue name -> runtime MusicCueId (src/contracts/timeline.ts).
RUNTIME_ID = {"ending_kill": "endingKill", "ending_pacifist": "endingPacifist"}
# Every MusicCueId that plays a track ("silence" plays none).
RUNTIME_CUES = ("logos", "tutorial", "gameplay", "flashback", "boss", "menu",
                "ending", "endingKill", "endingPacifist")


# Krumhansl-Kessler key profiles.
MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]


def measure_grid(path: Path) -> dict:
    """Tempo, first beat and key of a music file (a starting point for ears)."""
    import librosa
    import numpy as np
    y, sr = librosa.load(path, sr=22050, mono=True)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    times = librosa.frames_to_time(beats, sr=sr)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
    best = (-2.0, 0, "major")
    for mode, profile in (("major", MAJOR), ("minor", MINOR)):
        for root in range(12):
            r = float(np.corrcoef(chroma, np.roll(profile, root))[0, 1])
            best = max(best, (r, root, mode))
    _, root, mode = best
    return {"bpm": round(float(np.atleast_1d(tempo)[0]), 2),
            "beatOffset": round(float(times[0]) if len(times) else 0.0, 3),
            "beatsPerBar": 4,
            "key": {"root": 57 + (root - 9) % 12, "mode": mode}}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    picks_file = MUSIC / "picks.json"
    picks = json.loads(picks_file.read_text()) if picks_file.exists() else {}
    index_file = MUSIC / "candidates" / "index.json"
    index = json.loads(index_file.read_text()) if index_file.exists() else {"cues": {}}
    loops = {e["file"]: e["loop"] for es in index["cues"].values() for e in es}
    manifest: dict = {"version": 1, "cues": {cue: None for cue in RUNTIME_CUES}}
    for cue, pick in picks.items():
        runtime = RUNTIME_ID.get(cue, cue)
        if not pick or manifest["cues"].get(runtime):
            manifest["cues"].setdefault(runtime, None)
            continue
        src = MUSIC / "candidates" / pick["file"]
        dest = PUBLIC / f"{runtime}.ogg"
        print(f"{src.relative_to(MUSIC)} -> {dest.relative_to(ROOT)}")
        if not args.dry_run:
            PUBLIC.mkdir(parents=True, exist_ok=True)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
                            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000",
                            "-c:a", "libopus", "-b:a", "128k", str(dest)], check=True)
        entry = {"src": f"music/{runtime}.ogg", "loop": loops.get(pick["file"], False),
                 "source": {"file": pick["file"], "model": index.get("model")}}
        for k in ("loopStart", "loopEnd"):
            if k in pick:
                entry[k] = pick[k]
        grid = measure_grid(src)
        entry |= grid | {k: pick[k] for k in ("bpm", "beatOffset", "beatsPerBar", "key") if k in pick}
        print(f"  grid: {grid['bpm']} BPM, first beat {grid['beatOffset']} s, key {grid['key']}")
        manifest["cues"][runtime] = entry
    if not args.dry_run:
        PUBLIC.mkdir(parents=True, exist_ok=True)
        (PUBLIC / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    main()
