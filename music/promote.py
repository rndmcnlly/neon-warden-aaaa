#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Promote picked music candidates into public/music/ for the game.

    uv run music/promote.py             # encode picks, write manifest
    uv run music/promote.py --dry-run   # show what would happen

Reads music/picks.json:
    { "gameplay": { "file": "gameplay/gameplay_02.wav",
                    "loopStart": 0.0, "loopEnd": 59.5 }, "boss": null, ... }
Writes public/music/<cue>.ogg (Ogg Opus 128 kb/s, loudness-normalized to
-16 LUFS so cues sit together on the music bus) and public/music/manifest.json
in the shape src/audio/manifests.ts reads. Needs ffmpeg on PATH.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

MUSIC = Path(__file__).resolve().parent
ROOT = MUSIC.parent
PUBLIC = ROOT / "public" / "music"

# Candidate cue name -> runtime MusicCueId. "menu" and the two endings wait on
# a contract change (see music/README.md); until then both endings share
# "ending", and the pacifist pick wins only if no kill pick exists.
RUNTIME_ID = {"ending_kill": "ending", "ending_pacifist": "ending"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    picks = json.loads((MUSIC / "picks.json").read_text())
    index = json.loads((MUSIC / "candidates" / "index.json").read_text())
    loops = {e["file"]: e["loop"] for es in index["cues"].values() for e in es}
    manifest: dict = {"version": 1, "cues": {}}
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
        manifest["cues"][runtime] = entry
    if not args.dry_run:
        (PUBLIC / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    main()
