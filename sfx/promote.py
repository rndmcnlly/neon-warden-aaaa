#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Promote picked UI sound candidates into the game.

    uv run sfx/promote.py              # sfx/picks.json -> public/sfx/
    uv run sfx/promote.py --dry-run    # show what would happen
    uv run sfx/promote.py --gameplay   # sfx/picks-gameplay.json -> public/sfx/gameplay/
    uv run sfx/promote.py --gameplay --provisional   # pick the cleanest take per
                                                     # unpicked role first

Gameplay roles may pick several takes: they become round-robin variants
(public/sfx/gameplay/<role>_<k>.ogg, listed in public/sfx/gameplay.json).
Levels are not baked per role there: src/audio/gameplaySounds.ts owns them.

For each role with a pick, copies sfx/candidates/<role>/<role>_<nn>.wav to
public/sfx/<role>.ogg (Opus, 96 kb/s, via ffmpeg) and writes
public/sfx/manifest.json for the game's audio code. A pick records the render
hash, so if a role was re-rendered after picking and the file now holds a
different sound, promotion stops instead of shipping the wrong one.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

SFX = Path(__file__).resolve().parent
ROOT = SFX.parent
PUBLIC = ROOT / "public" / "sfx"


FLAG_COST = {"silent": 9, "late_onset": 3, "too_short": 3, "clipped": 2, "peak_limited": 1,
             "noisy": 1, "truncated": 0}


def cleanest(cands: list[dict]) -> dict:
    """The take with the fewest (weighted) quality flags; earliest wins ties."""
    return min(cands, key=lambda c: (sum(FLAG_COST.get(f, 1) for f in c["flags"]), c["nn"]))


def promote_gameplay(args) -> None:
    gdir = SFX / "candidates" / "gameplay"
    index = json.loads((gdir / "index.json").read_text())
    picks_path = SFX / "picks-gameplay.json"
    picks = json.loads(picks_path.read_text()) if picks_path.exists() else {}
    if args.provisional:
        for role in index["order"]:
            if not picks.get(role):
                c = cleanest(index["roles"][role]["candidates"])
                picks[role] = [{"file": c["file"], "hash": c["hash"], "provisional": True}]
        if not args.dry_run:
            picks_path.write_text(json.dumps(picks, indent=1) + "\n")
    out_dir = PUBLIC / "gameplay"
    sounds: dict[str, dict | None] = {}
    wanted: set[str] = set()
    for role in index["order"]:
        cands = {c["file"]: c for c in index["roles"][role]["candidates"]}
        chosen = []
        for k, pick in enumerate(picks.get(role) or [], start=1):
            cand = cands.get(pick["file"])
            if cand is None or cand["hash"] != pick.get("hash", cand["hash"]):
                sys.exit(f"{role}: {pick['file']} no longer holds the picked render; re-pick")
            name = f"{role}_{k}.ogg"
            wanted.add(name)
            if not args.dry_run:
                out_dir.mkdir(parents=True, exist_ok=True)
                subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i",
                                str(gdir / pick["file"]), "-c:a", "libopus", "-b:a", "96k",
                                "-ac", "1", "-ar", "48000", "-map_metadata", "-1",
                                str(out_dir / name)], check=True)
            chosen.append({"src": f"sfx/gameplay/{name}", "from": pick["file"], "hash": cand["hash"],
                           "provisional": bool(pick.get("provisional"))})
        sounds[role] = {"variants": [c["src"] for c in chosen], "takes": chosen} if chosen else None
    if not args.dry_run and out_dir.exists():
        for stale in out_dir.glob("*.ogg"):
            if stale.name not in wanted:
                stale.unlink()
        (PUBLIC / "gameplay.json").write_text(json.dumps({
            "version": 1,
            "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "model": index.get("model"),
            "note": "Normalized to one level; runtime gains live in src/audio/gameplaySounds.ts.",
            "sounds": sounds,
        }, indent=1) + "\n")
    n = sum(1 for v in sounds.values() if v)
    print(f"gameplay: {n}/{len(sounds)} roles promoted ({sum(len(v['variants']) for v in sounds.values() if v)} variants)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--picks", type=Path, default=SFX / "picks.json")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--gameplay", action="store_true", help="gameplay roles (multi-take picks)")
    ap.add_argument("--provisional", action="store_true",
                    help="with --gameplay: auto-pick the cleanest take for unpicked roles")
    args = ap.parse_args()
    if args.gameplay:
        return promote_gameplay(args)

    picks = json.loads(args.picks.read_text())
    index = json.loads((SFX / "candidates" / "index.json").read_text())
    ffmpeg = shutil.which("ffmpeg")
    ext = "ogg" if ffmpeg else "wav"
    if not ffmpeg:
        print("ffmpeg not found: copying WAV instead of encoding Ogg Opus")

    manifest_path = PUBLIC / "manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"sounds": {}}
    sounds: dict[str, dict | None] = {}
    problems = []
    for role in index["order"]:
        pick = picks.get(role)
        if not pick:
            sounds[role] = None
            continue
        cands = {c["file"]: c for c in index["roles"][role]["candidates"]}
        cand = cands.get(pick["file"])
        if cand is None or cand["hash"] != pick.get("hash", cand["hash"]):
            problems.append(f"{role}: {pick['file']} no longer holds the picked render "
                            f"(hash {pick.get('hash')}); re-pick in audition.html")
            continue
        src = SFX / "candidates" / pick["file"]
        dest = PUBLIC / f"{role}.{ext}"
        print(f"{role:12s} {pick['file']} -> {dest.relative_to(ROOT)}")
        if not args.dry_run:
            PUBLIC.mkdir(parents=True, exist_ok=True)
            if ffmpeg:
                subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                                "-c:a", "libopus", "-b:a", "96k", "-ac", "1", "-ar", "48000",
                                "-map_metadata", "-1", str(dest)], check=True)
            else:
                shutil.copyfile(src, dest)
        sounds[role] = {
            "src": f"sfx/{role}.{ext}",
            "duration_ms": cand["duration_ms"],
            "active_rms_dbfs": cand["active_rms_dbfs"],
            "gain_db_baked": index["roles"][role]["gain_db"],
            "source": {"file": pick["file"], "hash": cand["hash"], "seed": cand["seed"], "model": index["model"]},
        }

    if problems:
        sys.exit("refusing to promote:\n  " + "\n  ".join(problems))

    # remove files we promoted earlier for roles that are now unpicked
    for role, entry in old.get("sounds", {}).items():
        if entry and sounds.get(role) is None:
            stale = ROOT / "public" / entry["src"]
            print(f"{role:12s} unpicked, removing {stale.relative_to(ROOT)}")
            if not args.dry_run:
                stale.unlink(missing_ok=True)

    out = {
        "version": 1,
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "note": "Role levels are baked in (family loudness target plus role gain_db); play at unity on the UI bus.",
        "sounds": sounds,
    }
    if args.dry_run:
        print(json.dumps(out, indent=1))
    else:
        PUBLIC.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(out, indent=1) + "\n")
        n = sum(1 for v in sounds.values() if v)
        print(f"promoted {n}/{len(sounds)} roles; wrote {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
