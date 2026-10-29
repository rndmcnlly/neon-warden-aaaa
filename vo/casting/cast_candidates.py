# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml", "soundfile", "numpy", "librosa"]
# ///
"""Audition candidate voices for one speaker without touching the locked anchor.

For each candidate in CANDIDATES[speaker]:
  1. design : VoiceDesign (vdes) makes vo/casting/<speaker>/<cand>/anchor.wav
              from the candidate's written description and a shared anchor line.
  2. clone  : Qwen3-TTS Base clones that anchor for the audition lines in en, es,
              zh -> vo/casting/<speaker>/<cand>/<lang>/<line>.wav (same path as
              vo/render.py's clone mode, so the comparison is fair).
  3. check  : Qwen3-ASR round trip and similarity (render.py's scorer); takes
              under --threshold get up to --retry-seeds reseeds, best kept.
  4. pitch  : median f0 over voiced frames (librosa pyin), per clip and anchor.
  5. index  : vo/casting/<speaker>/index.json (+ index.js for file:// viewing).

Reuses vo/render.py's audiocpp, ASR and scoring helpers, so models and scoring
stay identical to the production pipeline. Nothing in vo/voices or vo/out is
written. Cached: a candidate is skipped when its anchor and clips exist and
its recorded design hash matches; --force redoes everything.

Usage:
  uv run vo/casting/cast_candidates.py               # tutorial_ai, all candidates
  uv run vo/casting/cast_candidates.py --only b_keynote --force
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

import librosa
import numpy as np
import yaml

CASTING = Path(__file__).resolve().parent
VO = CASTING.parent
sys.path.insert(0, str(VO))
import render as R  # noqa: E402  (vo/render.py: shared models, ASR, scoring)

SEED = 11
ANCHOR_TEXT = {
    "tutorial_ai": "Welcome to the Lane Authority onboarding program. I will be with you every step "
                   "of the way. Let's begin with something simple: moving your ship.",
}
LINES = {"tutorial_ai": ["tut_wink_001", "tut_warden_001", "tut_move_001"]}
CANDIDATES = {
    "tutorial_ai": {
        "a_captain": {
            "label": "Adult female alto, airline-captain calm, 40s",
            "design": "A warm adult female alto voice in her forties, calm and unhurried like an "
                      "airline captain on the cabin intercom, low-medium pitch, reassuring and "
                      "sincere, gentle institutional warmth, clear professional diction.",
        },
        "b_keynote": {
            "label": "Adult female, crisp corporate keynote presenter, 30s to 40s",
            # First pass (without "lower-medium pitch, mature, not girlish") measured 290 Hz.
            "design": "A confident mature woman in her early forties, a crisp corporate keynote "
                      "presenter, lower-medium pitch, adult and grounded, not girlish, polished and "
                      "upbeat, precise enunciation, sincere enthusiasm for the product, measured pace.",
        },
        "c_service": {
            "label": "Male, calm mid-Atlantic customer-service baritone",
            "design": "A calm adult male baritone voice, mid-Atlantic accent, a friendly "
                      "customer-service representative, smooth and patient, medium-low pitch, "
                      "warm, courteous and sincere, steady relaxed pace.",
        },
        "d_synthetic": {
            "label": "Androgynous synthetic, smooth and neutral, slightly processed",
            "design": "An androgynous synthetic assistant voice, neither clearly male nor female, "
                      "medium pitch, smooth and even, neutral and polite, slightly digitally "
                      "processed timbre, calm consistent pace, helpful institutional tone.",
        },
        "e_narrator": {
            "label": "Older male, kindly orientation-video narrator",
            # First pass ("older male voice ... medium-low pitch") measured 178 Hz, too high for the brief.
            "design": "An elderly man in his late sixties with a low, deep male voice, a kindly "
                      "orientation-video narrator, warm grandfatherly tone, slightly husky, unhurried "
                      "and reassuring, sincere and earnest, clear old-fashioned delivery.",
        },
    },
}


def median_f0(wav: Path) -> float | None:
    y, sr = librosa.load(str(wav), sr=16000, mono=True)
    f0, voiced, _ = librosa.pyin(y, fmin=60, fmax=500, sr=sr, frame_length=1024)
    f0 = f0[voiced & ~np.isnan(f0)]
    return round(float(np.median(f0)), 1) if f0.size else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--speaker", default="tutorial_ai")
    ap.add_argument("--only", action="append", help="candidate key, repeatable")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--threshold", type=float, default=0.85)
    ap.add_argument("--retry-seeds", type=int, default=2)
    args = ap.parse_args()

    t0 = time.time()
    speaker = args.speaker
    script = yaml.safe_load((VO / "script.yaml").read_text(encoding="utf-8"))
    lines = {l["id"]: l for l in script["lines"] if l["id"] in LINES[speaker]}
    root = CASTING / speaker
    index_path = root / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"candidates": {}}
    cands = {k: v for k, v in CANDIDATES[speaker].items() if not args.only or k in args.only}

    # 1. design anchors (one vdes session)
    todo = []
    for key, cand in cands.items():
        h = R.sha({"design": cand["design"], "anchor": ANCHOR_TEXT[speaker], "seed": SEED,
                   "model": R.DESIGN_MODEL.name})
        old = index["candidates"].get(key, {})
        if args.force or old.get("hash") != h or not (root / key / "anchor.wav").exists():
            todo.append((key, h))
        cand["hash"] = h
    if todo:
        reqs = [{"id": key, "seed": SEED, "language": "English", "instruct": cands[key]["design"],
                 "text": ANCHOR_TEXT[speaker]} for key, _ in todo]
        stage, wall = R.run_audiocpp("vdes", R.DESIGN_MODEL, reqs, "cast-candidates")
        for req in reqs:
            dest = root / req["id"] / "anchor.wav"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(stage / f"{req['id']}.wav", dest)
            R.write_sidecar(dest, {"hash": cands[req["id"]]["hash"], "request": req, **R.audio_stats(dest)})
        print(f"[design] {len(reqs)} anchor(s) in {wall:.1f}s")
    redo = {key for key, _ in todo}

    # 2. clone audition lines (one tts session)
    def clone_req(key: str, line: dict, lang: str, seed: int) -> dict:
        return {"id": f"{key}__{lang}__{line['id']}__s{seed}", "seed": seed, "language": R.LANGS[lang],
                "text": R.clean(line[lang]), "voice_ref": str(root / key / "anchor.wav"),
                "reference_text": ANCHOR_TEXT[speaker]}

    clips = [(key, lines[lid], lang) for key in cands for lid in LINES[speaker] for lang in R.LANGS
             if key in redo or not (root / key / lang / f"{lid}.wav").exists()]
    if clips:
        reqs = [clone_req(k, l, lg, SEED) for k, l, lg in clips]
        stage, wall = R.run_audiocpp("tts", R.BASE_MODEL, reqs, "clone-candidates")
        for (key, line, lang), req in zip(clips, reqs):
            dest = root / key / lang / f"{line['id']}.wav"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(stage / f"{req['id']}.wav", dest)
            R.write_sidecar(dest, {"request": req, **R.audio_stats(dest)})
        print(f"[clone] {len(reqs)} clip(s) in {wall:.1f}s")

    # 3. ASR on clips lacking a result, then reseed low scorers
    def all_clips():
        for key in cands:
            for lid in LINES[speaker]:
                for lang in R.LANGS:
                    yield key, lines[lid], lang, root / key / lang / f"{lid}.wav"

    need = [(k, l, lg, w) for k, l, lg, w in all_clips() if "asr" not in R.read_sidecar(w)]
    if need:
        heard = R.asr_batch([(f"{k}__{lg}__{l['id']}", w, lg) for k, l, lg, w in need])
        for k, l, lg, w in need:
            meta, text = R.read_sidecar(w), heard.get(f"{k}__{lg}__{l['id']}")
            meta["asr"] = text
            meta["asr_similarity"] = R.score(R.clean(l[lg]), text, lg) if text is not None else None
            R.write_sidecar(w, meta)
    low = [(k, l, lg, w) for k, l, lg, w in all_clips()
           if (R.read_sidecar(w).get("asr_similarity") or 0) < args.threshold and "retried" not in R.read_sidecar(w)]
    if low and args.retry_seeds:
        reqs, items = [], []
        for k, l, lg, w in low:
            for n in range(1, args.retry_seeds + 1):
                req = clone_req(k, l, lg, SEED + 100 * n)
                reqs.append(req)
                items.append((k, l, lg, w, req))
        stage, _ = R.run_audiocpp("tts", R.BASE_MODEL, reqs, "retry-candidates")
        heard = R.asr_batch([(req["id"], stage / f"{req['id']}.wav", lg) for _, _, lg, _, req in items])
        for k, l, lg, w in low:
            meta = R.read_sidecar(w)
            best = (meta.get("asr_similarity") or 0, None)
            for k2, l2, lg2, w2, req in items:
                if w2 == w and heard.get(req["id"]) is not None:
                    s = R.score(R.clean(l[lg]), heard[req["id"]], lg)
                    if s > best[0]:
                        best = (s, req)
            if best[1]:
                req = best[1]
                shutil.move(stage / f"{req['id']}.wav", w)
                meta = {"request": req, **R.audio_stats(w), "asr": heard[req["id"]], "asr_similarity": best[0]}
            meta["retried"] = True
            R.write_sidecar(w, meta)
            print(f"[retry] {k} {lg}/{l['id']}: -> {meta['asr_similarity']} (seed {meta['request']['seed']})")
        shutil.rmtree(stage, ignore_errors=True)

    # 4. pitch + index
    for key, cand in cands.items():
        anchor = root / key / "anchor.wav"
        entry = {"label": cand["label"], "design": cand["design"], "hash": cand["hash"],
                 "anchor": {"file": f"{key}/anchor.wav", "text": ANCHOR_TEXT[speaker],
                            "duration": R.read_sidecar(anchor)["duration"], "median_f0_hz": median_f0(anchor)},
                 "clips": {}}
        for lid in LINES[speaker]:
            for lang in R.LANGS:
                w = root / key / lang / f"{lid}.wav"
                meta = R.read_sidecar(w)
                entry["clips"][f"{lang}/{lid}"] = {
                    "file": f"{key}/{lang}/{lid}.wav", "lang": lang, "line": lid, "text": R.clean(lines[lid][lang]),
                    "seed": meta["request"]["seed"], "duration": meta["duration"], "peak": meta["peak"],
                    "asr": meta.get("asr"), "asr_similarity": meta.get("asr_similarity"),
                    "median_f0_hz": median_f0(w)}
        f0s = [c["median_f0_hz"] for c in entry["clips"].values() if c["median_f0_hz"]]
        entry["median_f0_hz"] = round(float(np.median(f0s)), 1) if f0s else None
        entry["asr_by_lang"] = {lg: round(float(np.mean([c["asr_similarity"] or 0 for c in entry["clips"].values()
                                                          if c["lang"] == lg])), 3) for lg in R.LANGS}
        index["candidates"][key] = entry
        print(f"[index] {key}: f0 {entry['median_f0_hz']} Hz, ASR {entry['asr_by_lang']}")
    index.update({"speaker": speaker, "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                  "current_anchor": {"file": f"../../voices/{speaker}.wav",
                                     "design": R.clean(script["speakers"][speaker]["design"])},
                  "lines": {lid: {lg: R.clean(lines[lid][lg]) for lg in R.LANGS} for lid in LINES[speaker]},
                  "models": {"design": R.DESIGN_MODEL.name, "clone": R.BASE_MODEL.name, "asr": R.ASR_MODEL.name},
                  "seed": SEED, "threshold": args.threshold})
    index["candidates"] = dict(sorted(index["candidates"].items()))
    blob = json.dumps(index, ensure_ascii=False, indent=2)
    index_path.write_text(blob, encoding="utf-8")
    (root / "index.js").write_text(f"window.CASTING_INDEX = window.CASTING_INDEX || {{}};\n"
                                   f"window.CASTING_INDEX[{json.dumps(speaker)}] = {blob};\n", encoding="utf-8")
    print(f"[done] {index_path} in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
