#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
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
        manifest["cues"][runtime] = entry
    if not args.dry_run:
        PUBLIC.mkdir(parents=True, exist_ok=True)
        (PUBLIC / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    main()
