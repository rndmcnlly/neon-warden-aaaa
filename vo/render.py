# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml", "soundfile", "numpy", "scipy", "pyloudnorm"]
# ///
"""Render Neon Warden AAAA voiceover from vo/script.yaml with local Qwen3-TTS.

Pipeline (all local, audiocpp on Metal):
  1. cast   : each speaker's `design` + `anchor` -> vo/voices/<speaker>.wav
              via Qwen3-TTS VoiceDesign (task vdes). The anchor recording IS the
              character identity. Anchors are LOCKED: once a speaker has an
              anchor, editing `design`, `anchor` or the speaker `seed` only
              prints a notice; nothing recasts until `--recast <speaker>`. The
              anchor's sidecar (<speaker>.json) is the frozen record of the
              prompt and transcript that made it, and the clone reference text
              is read from there, not from the editable YAML.
              Per-language anchors: if vo/voices/<speaker>.<lang>.wav (+ .json)
              exists, lines in that language clone it instead of the English
              anchor (cloning an English reference into Spanish carries an
              English accent). They are made and auditioned by
              vo/casting/cast_lang_anchors.py; render.py only reads them.
  2. render : each line x language -> vo/out/<lang>/<id>.wav.
              clone mode (default): Qwen3-TTS Base clones the anchor
                cross-lingually. `direction` is hashed but not consumed.
              design mode: VoiceDesign with design + direction per line.
                Acts more, but identity can drift between lines/languages.
              Every take is loudness-normalized once, right after synthesis, to
              -18 LUFS integrated with true peak at or under -1 dBTP (gain,
              plus a latency-compensated peak limiter only on shouted takes).
              The measurement lives in the sidecar's `loudness`, so the build
              step can verify instead of processing again.
  3. asr    : optional (--asr) Qwen3-ASR round trip without the script, then a
              similarity score against the requested text. One audiocpp
              session per language; results live in each line's sidecar.
  4. retry  : optional (--retry-low) re-render every take scoring under
              --threshold with up to --retry-seeds new seeds, keep the best,
              and write the winning seed back into script.yaml.
  5. align  : Qwen3 Forced Aligner maps the script text (not the ASR guess)
              onto each take: word spans for en and es, character spans for
              zh, stored in the sidecar's `words` and in cues.json. Each span
              carries `char`, its [start, end) offsets into the cue's `text`, so
              a subtitle view can pulse the spoken word inside the punctuated
              line. Runs for every current take that lacks spans (seconds).
  6. cues   : vo/out/cues.json (durations, hashes, ASR, loudness, words),
              vo/out/REPORT.md, and one WebVTT per line: sentence cues timed
              from the aligned words, with WebVTT inline word timestamps.

Cache: a line is re-rendered only when the sha256 of its render inputs
(mode, text, language, direction, speaker identity, seed, model file) differs
from the hash in its sidecar <id>.json. File existence alone never counts.
Speaker identity is the anchor sidecar's hash, so it changes only on a recast.
A line's `seed` is the speaker seed unless the line overrides it, either for
every language (`seed: 7`) or per language (`seed: {es: 144, zh: 244}`).

Usage:
  uv run vo/render.py --dry-run       # report what would cast and render
  uv run vo/render.py                 # cast + render stale lines + cues
  uv run vo/render.py --asr --retry-low
  uv run vo/render.py --prune         # delete outputs for retired line ids
  uv run vo/render.py --mode design --out vo/out-design
  uv run vo/render.py --only boss_taunt_001 --lang zh --force
  uv run vo/render.py --speaker warden --lang es --asr --retry-low
  uv run vo/render.py --recast warden # re-make one anchor (recasts all its lines)
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf
import yaml

VO = Path(__file__).resolve().parent
# Qwen3 GGUF weights are not in the repo: point VO_MODELS_DIR at your audio.cpp models folder.
MODELS = Path(os.environ.get("VO_MODELS_DIR", VO / "models")).expanduser()
BASE_MODEL = MODELS / "Qwen3-TTS-12Hz-1.7B-Base-GGUF/qwen3-tts-12hz-1.7b-base-q8_0_v2.gguf"
DESIGN_MODEL = MODELS / "Qwen3-TTS-12Hz-1.7B-VoiceDesign-GGUF/qwen3-tts-12hz-1.7b-voicedesign-q8_0.gguf"
ASR_MODEL = MODELS / "Qwen3-ASR-0.6B-GGUF/qwen3-asr-0.6b-q8_0.gguf"
ALIGN_MODEL = MODELS / "Qwen3-ForcedAligner-0.6B-GGUF/qwen3-forced-aligner-0.6b-q8_0.gguf"

LANGS = {"en": "English", "es": "Spanish", "zh": "Chinese"}
SENTENCE_END = re.compile(r"(?<=[.!?。！？…])(?![.!?。！？…])\s*")  # a run like "..." or "!?" ends one sentence
TARGET_LUFS, CEILING_DBTP = -18.0, -1.0
ALIGN_SR = 16000  # the aligner reports sample indices at this rate
OUTPUT_SUFFIXES = (".wav", ".json", ".vtt")


def sha(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


def clean(text: str) -> str:
    return " ".join(text.split())


def read_sidecar(wav: Path) -> dict | None:
    meta = wav.with_suffix(".json")
    if wav.exists() and meta.exists():
        return json.loads(meta.read_text(encoding="utf-8"))
    return None


def write_sidecar(wav: Path, meta: dict) -> None:
    # audiocpp needs an absolute voice_ref; the committed sidecar keeps it repo-relative.
    ref = meta.get("request", {}).get("voice_ref")
    if ref and Path(ref).is_relative_to(VO.parent):
        meta = {**meta, "request": {**meta["request"], "voice_ref": str(Path(ref).relative_to(VO.parent))}}
    wav.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def run_audiocpp(task: str, model: Path, requests: list[dict], label: str) -> tuple[Path, float]:
    """Run one audiocpp session over many requests; return (staging dir, wall seconds)."""
    stage = Path(tempfile.mkdtemp(prefix=f"vo-{label}-"))
    seq = stage / "requests.json"
    seq.write_text(json.dumps({"requests": requests}, ensure_ascii=False, indent=2), encoding="utf-8")
    cmd = ["audiocpp", "--task", task, "--family", "qwen3_tts", "--model", str(model),
           "--backend", "metal", "--request-sequence", str(seq), "--out-dir", str(stage), "--metrics"]
    print(f"[{label}] {len(requests)} request(s): {' '.join(cmd[:8])} ...", flush=True)
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    wall = time.time() - t0
    if proc.returncode != 0:
        sys.exit(f"[{label}] audiocpp failed rc={proc.returncode}\n{proc.stdout[-2000:]}\n{proc.stderr[-2000:]}")
    return stage, wall


def audio_stats(wav: Path) -> dict:
    data, sr = sf.read(str(wav), always_2d=True)
    peak = float(np.max(np.abs(data))) if data.size else 0.0
    return {"duration": round(len(data) / sr, 3), "sample_rate": sr, "peak": round(peak, 3),
            "clipping_suspect": peak >= 0.999}


def true_peak_dbtp(data: np.ndarray) -> float:
    """BS.1770-style true peak: max magnitude after 4x oversampling, in dBTP."""
    from scipy.signal import resample_poly
    up = resample_poly(data, 4, 1, axis=0)
    return float(20 * np.log10(max(np.max(np.abs(up)), 1e-9)))


LOUDNESS_RECIPE = "gain+alimiter-v1"  # bump to re-normalize every take once


def integrated_lufs(data: np.ndarray, sr: int) -> float:
    import pyloudnorm
    try:
        return float(pyloudnorm.Meter(sr).integrated_loudness(data))
    except ValueError:  # shorter than one 400 ms gating block
        return float("-inf")


def normalize_loudness(wav: Path) -> dict:
    """Bring the take to TARGET_LUFS with true peak at or under CEILING_DBTP. Returns the sidecar record.

    Gain first. If that would push true peak over the ceiling (shouted lines),
    a fast look-ahead limiter (ffmpeg alimiter, latency-compensated so word
    timing is unchanged) shaves only those peaks; `limited_db` is how far
    over they were. A final trim makes the ceiling hold after the limiter.
    """
    data, sr = sf.read(str(wav), always_2d=True)
    subtype = sf.info(str(wav)).subtype
    before, tp = integrated_lufs(data, sr), true_peak_dbtp(data)
    record = {"recipe": LOUDNESS_RECIPE, "target_lufs": TARGET_LUFS, "ceiling_dbtp": CEILING_DBTP}
    if not np.isfinite(before):
        return {**record, "lufs": None, "true_peak_dbtp": round(tp, 2), "gain_db": 0.0, "limited_db": 0.0,
                "peak_bound": False, "note": "too short or silent to measure"}
    gain = TARGET_LUFS - before
    over = tp + gain - CEILING_DBTP
    out = data * 10 ** (gain / 20)
    if over > 0:
        with tempfile.TemporaryDirectory() as tmp:
            src, dst = Path(tmp) / "in.wav", Path(tmp) / "out.wav"
            sf.write(str(src), out, sr, subtype="FLOAT")
            limit = 10 ** ((CEILING_DBTP - 0.5) / 20)  # sample-peak limit under the true-peak ceiling
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-af",
                            f"alimiter=limit={limit:.4f}:attack=1:release=60:level=false:latency=true",
                            "-c:a", "pcm_f32le", str(dst)], check=True)
            out, _ = sf.read(str(dst), always_2d=True)
        out = out[:len(data)]
    trim = min(0.0, CEILING_DBTP - 0.05 - true_peak_dbtp(out))  # margin for requantization
    out = out * 10 ** (trim / 20)
    sf.write(str(wav), out, sr, subtype=subtype)
    out, _ = sf.read(str(wav), always_2d=True)
    after = integrated_lufs(out, sr)
    return {**record, "lufs": round(after, 2), "true_peak_dbtp": round(true_peak_dbtp(out), 2),
            "gain_db": round(gain + trim, 2), "limited_db": round(max(over, 0.0), 2),
            "measured_before_lufs": round(before, 2), "peak_bound": bool(after < TARGET_LUFS - 0.5)}


# -- 1. casting ---------------------------------------------------------------

def cast(speakers: dict, recast: set[str] | None, dry_run: bool) -> dict:
    """Return {speaker: {"hash", "ref_text"}} read from each locked anchor's sidecar."""
    voices = VO / "voices"
    voices.mkdir(exist_ok=True)
    identity, todo = {}, []
    for name, sp in speakers.items():
        wanted = sha({"design": clean(sp["design"]), "anchor": clean(sp["anchor"]),
                      "seed": sp["seed"], "model": DESIGN_MODEL.name})
        wav = voices / f"{name}.wav"
        meta = read_sidecar(wav)
        if meta is None or (recast is not None and (not recast or name in recast)):
            todo.append({"id": name, "seed": sp["seed"], "language": "English",
                         "instruct": clean(sp["design"]), "text": clean(sp["anchor"])})
            identity[name] = {"hash": wanted, "ref_text": clean(sp["anchor"])}
            continue
        if meta["hash"] != wanted:
            print(f"[cast] {name}: casting fields differ from the locked anchor; keeping the anchor "
                  f"(--recast {name} to re-make it and re-render its lines)")
        identity[name] = {"hash": meta["hash"], "ref_text": meta["request"]["text"]}
    if not todo:
        print("[cast] all anchors locked and present")
    elif dry_run:
        print(f"[cast] would cast: {', '.join(r['id'] for r in todo)}")
    else:
        stage, wall = run_audiocpp("vdes", DESIGN_MODEL, todo, "cast")
        for req in todo:
            wav = voices / f"{req['id']}.wav"
            shutil.move(stage / f"{req['id']}.wav", wav)
            write_sidecar(wav, {"hash": identity[req["id"]]["hash"], "request": req,
                                "wall_batch_s": round(wall, 2), **audio_stats(wav)})
        print(f"[cast] {len(todo)} voice(s) in {wall:.1f}s")
    for name in speakers:
        identity[name]["ref"] = str(voices / f"{name}.wav")
        identity[name]["langs"] = {}
        for lang in LANGS:
            wav = voices / f"{name}.{lang}.wav"
            meta = read_sidecar(wav)
            if meta is not None:
                identity[name]["langs"][lang] = {"hash": meta["hash"], "ref_text": meta["request"]["text"],
                                                 "ref": str(wav)}
        if identity[name]["langs"]:
            print(f"[cast] {name}: per-language anchor(s) for {', '.join(identity[name]['langs'])}")
    return identity


def voice_for(identity: dict, speaker: str, lang: str) -> dict:
    """The anchor a line clones: the speaker's per-language anchor if one exists, else the English one."""
    return identity[speaker]["langs"].get(lang, identity[speaker])


# -- 2. rendering -------------------------------------------------------------

def line_seed(line: dict, sp: dict, lang: str) -> int:
    seed = line.get("seed")
    if isinstance(seed, dict):
        return int(seed.get(lang, sp["seed"]))
    return int(seed) if seed is not None else int(sp["seed"])


def take(line: dict, lang: str, script: dict, identity: dict, mode: str, seed: int | None = None) -> tuple[str, dict]:
    """Return (cache hash, audiocpp request) for one line x language x seed."""
    sp = script["speakers"][line["speaker"]]
    seed = line_seed(line, sp, lang) if seed is None else seed
    mode = line.get("mode", mode)
    model = BASE_MODEL if mode == "clone" else DESIGN_MODEL
    text, direction = clean(line[lang]), clean(line.get("direction", ""))
    # Design mode never clones, so only the English (design) identity applies there.
    voice = voice_for(identity, line["speaker"], lang) if mode == "clone" else identity[line["speaker"]]
    h = sha({"mode": mode, "text": text, "lang": lang, "direction": direction,
             "cast": voice["hash"], "seed": seed, "model": model.name})
    req = {"id": f"{lang}__{line['id']}", "seed": seed, "language": LANGS[lang], "text": text}
    if mode == "clone":
        req["voice_ref"] = voice["ref"]
        req["reference_text"] = voice["ref_text"]
    else:
        req["instruct"] = f"{clean(sp['design'])} Delivery for this line: {direction}"
    return h, req


def synthesize(todo: list[tuple[dict, str, str, dict, Path]], label: str) -> dict:
    """Render (line, lang, hash, request, dest wav) items, one session per mode; write wav + sidecar."""
    audio_total = wall = 0.0
    for mode in ("clone", "design"):
        group = [t for t in todo if ("instruct" in t[3]) == (mode == "design")]
        if not group:
            continue
        stage, w = run_audiocpp("tts" if mode == "clone" else "vdes",
                                BASE_MODEL if mode == "clone" else DESIGN_MODEL,
                                [req for _, _, _, req, _ in group], f"{label}-{mode}")
        wall += w
        for line, lang, h, req, wav in group:
            wav.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(stage / f"{req['id']}.wav", wav)
            loudness = normalize_loudness(wav)
            stats = audio_stats(wav)
            audio_total += stats["duration"]
            write_sidecar(wav, {"hash": h, "mode": mode, "request": req,
                                "direction": clean(line.get("direction", "")), **stats, "loudness": loudness})
        shutil.rmtree(stage, ignore_errors=True)
    return {"lines": len(todo), "wall_s": round(wall, 2), "audio_s": round(audio_total, 2),
            "rtf_incl_load": round(wall / audio_total, 2) if audio_total else None}


def render(script: dict, identity: dict, out: Path, mode: str, langs: list[str],
           only: set[str] | None, force: bool, dry_run: bool) -> dict:
    todo, current = [], 0
    for line in script["lines"]:
        if only and line["id"] not in only:
            continue
        for lang in langs:
            h, req = take(line, lang, script, identity, mode)
            wav = out / lang / f"{line['id']}.wav"
            meta = read_sidecar(wav)
            if not force and meta and meta.get("hash") == h:
                current += 1
                continue
            todo.append((line, lang, h, req, wav))
    print(f"[render] {current} take(s) current, {len(todo)} stale")
    if dry_run:
        for line, lang, *_ in todo:
            print(f"  would render {lang}/{line['id']}")
        return {}
    if not todo:
        return {}
    timing = synthesize(todo, "render")
    print(f"[render] {timing}")
    return timing


def prune(script: dict, out: Path, dry_run: bool) -> list[str]:
    """Delete <out>/<lang>/<id>.{wav,json,vtt} for ids no longer in the script."""
    live = {line["id"] for line in script["lines"]}
    removed = []
    for lang in LANGS:
        for path in sorted((out / lang).glob("*")) if (out / lang).exists() else []:
            if path.suffix in OUTPUT_SUFFIXES and path.stem not in live:
                removed.append(str(path.relative_to(out)))
                if not dry_run:
                    path.unlink()
    print(f"[prune] {'would remove' if dry_run else 'removed'} {len(removed)} file(s)"
          + "".join(f"\n  {p}" for p in removed))
    return removed


# -- 3. ASR round trip ----------------------------------------------------------

def normalize(text: str, lang: str) -> list[str]:
    # Accent-insensitive: ASR often drops Spanish accents (contestó -> contesto)
    # on audio that says the right word, which is a transcript artifact.
    text = unicodedata.normalize("NFKD", text).lower()
    text = "".join(ch for ch in text if not unicodedata.category(ch).startswith(("P", "Mn")))
    return [ch for ch in text if not ch.isspace()] if lang == "zh" else text.split()


def score(requested: str, heard: str, lang: str) -> float:
    return round(difflib.SequenceMatcher(None, normalize(requested, lang), normalize(heard, lang)).ratio(), 3)


def asr_batch(items: list[tuple[str, Path, str]]) -> dict[str, str | None]:
    """Transcribe (key, wav, lang) items, one audiocpp session per language; return key -> text."""
    heard: dict[str, str | None] = {key: None for key, _, _ in items}
    for lang in LANGS:
        group = [(key, wav) for key, wav, lg in items if lg == lang]
        if not group:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            for key, wav in group:
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-ac", "1", "-ar", "16000",
                                str(Path(tmp) / f"{key}.wav")], check=True)
            t0 = time.time()
            proc = subprocess.run(["audiocpp", "--task", "asr", "--family", "qwen3_asr", "--model", str(ASR_MODEL),
                                   "--backend", "metal", "--batch-audio-dir", tmp, "--language", LANGS[lang],
                                   "--text", ""], capture_output=True, text=True)
            if proc.returncode != 0:
                print(f"[asr] {lang} batch failed: {(proc.stderr or proc.stdout)[-400:]}")
                continue
            rid = None
            for row in proc.stdout.splitlines():
                if row.startswith("request_id="):
                    rid = row.split("=", 1)[1].strip()
                elif row.startswith("text_output=") and rid in heard:
                    heard[rid] = row.split("=", 1)[1].strip()
            print(f"[asr] {lang}: {len(group)} clip(s) in {time.time() - t0:.1f}s", flush=True)
    return heard


def ensure_asr(script: dict, out: Path, langs: list[str], do_asr: bool) -> None:
    """Fill each current take's sidecar with an ASR result (migrating cached results from cues.json)."""
    prior = json.loads((out / "cues.json").read_text(encoding="utf-8")) if (out / "cues.json").exists() else {}
    need = []
    for line in script["lines"]:
        for lang in langs:
            wav = out / lang / f"{line['id']}.wav"
            meta = read_sidecar(wav)
            if meta is None:
                continue
            if "asr" in meta:  # rescore from the stored transcript, so scorer changes need no re-ASR
                s = score(clean(line[lang]), meta["asr"], lang) if meta["asr"] is not None else None
                if s != meta.get("asr_similarity"):
                    meta["asr_similarity"] = s
                    write_sidecar(wav, meta)
                continue
            old = prior.get("lines", {}).get(line["id"], {}).get("langs", {}).get(lang, {})
            if old.get("hash") == meta["hash"] and "asr" in old:
                meta["asr"], meta["asr_similarity"] = old["asr"], old.get("asr_similarity")
                write_sidecar(wav, meta)
            elif do_asr:
                need.append((f"{lang}__{line['id']}", wav, lang, line))
    if not need:
        return
    heard = asr_batch([(k, w, lg) for k, w, lg, _ in need])
    for key, wav, lang, line in need:
        meta = read_sidecar(wav)
        text = heard.get(key)
        meta["asr"] = text
        meta["asr_similarity"] = score(clean(line[lang]), text, lang) if text is not None else None
        write_sidecar(wav, meta)


# -- 4. retry low scorers -----------------------------------------------------------

def set_line_seed(path: Path, line_id: str, lang: str, seed: int, langs_default: int) -> None:
    """Write a per-language seed override into script.yaml without disturbing comments."""
    rows = path.read_text(encoding="utf-8").splitlines(keepends=True)
    start = next(i for i, r in enumerate(rows) if re.fullmatch(rf"  - id: {re.escape(line_id)}\s*", r))
    end = next((i for i in range(start + 1, len(rows)) if re.match(r"  - id: |\S|  #", rows[i])), len(rows))
    seeds, at = {}, None
    for i in range(start, end):
        if rows[i].startswith("    seed:"):
            at = i
            val = yaml.safe_load(rows[i])["seed"]
            seeds = dict(val) if isinstance(val, dict) else {lg: int(val) for lg in LANGS}
    seeds[lang] = seed
    seeds = {lg: seeds[lg] for lg in LANGS if lg in seeds and seeds[lg] != langs_default}
    new = f"    seed: {{{', '.join(f'{lg}: {s}' for lg, s in seeds.items())}}}\n" if seeds else None
    if at is not None:
        rows[at:at + 1] = [new] if new else []
    elif new:
        after = next(i for i in range(start, end) if rows[i].startswith("    speaker:"))
        rows.insert(after + 1, new)
    path.write_text("".join(rows), encoding="utf-8")


def retry_low(script: dict, script_path: Path, identity: dict, out: Path, mode: str, langs: list[str],
              threshold: float, n_seeds: int, only: set[str] | None) -> dict:
    low = []
    for line in script["lines"]:
        if only and line["id"] not in only:
            continue
        for lang in langs:
            meta = read_sidecar(out / lang / f"{line['id']}.wav")
            if meta and meta.get("asr_similarity") is not None and meta["asr_similarity"] < threshold:
                low.append((line, lang, meta))
    print(f"[retry] {len(low)} take(s) under {threshold}")
    if not low:
        return {}
    stage = Path(tempfile.mkdtemp(prefix="vo-retry-"))
    todo = []
    for line, lang, meta in low:
        base = meta["request"]["seed"]
        for k in range(1, n_seeds + 1):
            seed = base + 100 * k
            h, req = take(line, lang, script, identity, mode, seed)
            req["id"] = f"{lang}__{line['id']}__s{seed}"
            todo.append((line, lang, h, req, stage / f"{req['id']}.wav"))
    timing = synthesize(todo, "retry")
    heard = asr_batch([(req["id"], wav, lang) for _, lang, _, req, wav in todo])
    results = []
    for line, lang, meta in low:
        best = (meta["asr_similarity"], None)
        for cl, clang, h, req, wav in todo:
            if cl is line and clang == lang and heard.get(req["id"]) is not None:
                s = score(clean(line[lang]), heard[req["id"]], lang)
                print(f"  {lang}/{line['id']} seed {req['seed']}: {s}  heard: {heard[req['id']]}")
                if s > best[0]:
                    best = (s, (h, req, wav))
        if best[1]:
            h, req, wav = best[1]
            dest = out / lang / f"{line['id']}.wav"
            cand = json.loads(wav.with_suffix(".json").read_text(encoding="utf-8"))
            shutil.move(wav, dest)
            cand["asr"], cand["asr_similarity"] = heard[req["id"]], best[0]
            cand["request"] = {**req, "id": f"{lang}__{line['id']}"}
            write_sidecar(dest, cand)
            sp = script["speakers"][line["speaker"]]
            set_line_seed(script_path, line["id"], lang, req["seed"], sp["seed"])
            line["seed"] = {**{lg: line_seed(line, sp, lg) for lg in LANGS}, lang: req["seed"]}
        results.append({"id": line["id"], "lang": lang, "before": meta["asr_similarity"], "after": best[0],
                        "seed": best[1][1]["seed"] if best[1] else meta["request"]["seed"]})
        print(f"[retry] {lang}/{line['id']}: {meta['asr_similarity']} -> {best[0]}"
              + (f" (seed {results[-1]['seed']})" if best[1] else " (kept original)"))
    shutil.rmtree(stage, ignore_errors=True)
    return {**timing, "results": results}


# -- 5. loudness migration and forced alignment ---------------------------------------

def current_takes(script: dict, out: Path, langs: list[str]):
    for line in script["lines"]:
        for lang in langs:
            wav = out / lang / f"{line['id']}.wav"
            meta = read_sidecar(wav)
            if meta is not None:
                yield line, lang, wav, meta


def ensure_loudness(script: dict, out: Path, langs: list[str]) -> int:
    """Normalize takes rendered before render-time normalization existed (once: the sidecar records it)."""
    n = 0
    for _, _, wav, meta in current_takes(script, out, langs):
        if meta.get("loudness", {}).get("recipe") != LOUDNESS_RECIPE:
            meta["loudness"] = normalize_loudness(wav)
            meta.update(audio_stats(wav))
            meta.pop("words", None)  # same audio timeline, but re-align against the final file anyway
            write_sidecar(wav, meta)
            n += 1
    if n:
        print(f"[loudness] normalized {n} older take(s) to {TARGET_LUFS} LUFS / {CEILING_DBTP} dBTP")
    return n


def lexical_units(text: str, lang: str) -> list[tuple[int, int]]:
    """[start, end) offsets of what should get a span: words (en, es) or CJK characters plus Latin runs (zh)."""
    pattern = r"[㐀-鿿]|[^\W_]+(?:['’][^\W_]+)*" if lang == "zh" else r"[^\W_]+(?:['’-][^\W_]+)*"
    return [m.span() for m in re.finditer(pattern, text)]


def fold(ch: str) -> str:
    """Case- and accent-insensitive key for one character."""
    return (unicodedata.normalize("NFKD", ch)[:1] or ch).lower()


def attach_chars(spans: list[dict], text: str) -> None:
    """Give each aligned span `char`: its [start, end) offsets in `text`, searched left to right.

    Matching uses letters and digits only, because the aligner drops hyphens and
    apostrophes ("non-performance" comes back as "nonperformance")."""
    where = [i for i, ch in enumerate(text) if ch.isalnum()]
    hay = "".join(fold(text[i]) for i in where)
    cursor = 0  # index into hay
    for sp in spans:
        needle = "".join(fold(ch) for ch in sp["word"] if ch.isalnum())
        at = hay.find(needle, cursor) if needle else -1
        # Accept a match only if at most one text word was skipped to reach it;
        # otherwise leave the span unmapped rather than jump far ahead.
        prev_end = where[cursor - 1] + 1 if cursor else 0
        if at < 0 or len(lexical_units(text[prev_end:where[at]], "zh")) > 1:
            sp["char"] = None
            continue
        sp["char"] = [where[at], where[at + len(needle) - 1] + 1]
        cursor = at + len(needle)


def align_batch(items: list[tuple[str, Path, str, str]]) -> dict[str, list[dict] | None]:
    """Forced-align (key, wav, lang, text) items in one audiocpp session; return key -> spans."""
    spans: dict[str, list[dict] | None] = {key: None for key, *_ in items}
    with tempfile.TemporaryDirectory() as tmp:
        reqs = []
        for key, wav, lang, text in items:
            mono = Path(tmp) / f"{key}.wav"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-ac", "1", "-ar", str(ALIGN_SR),
                            str(mono)], check=True)
            reqs.append({"id": key, "audio": str(mono), "language": LANGS[lang], "text": text})
        seq = Path(tmp) / "requests.json"
        seq.write_text(json.dumps({"requests": reqs}, ensure_ascii=False), encoding="utf-8")
        t0 = time.time()
        proc = subprocess.run(["audiocpp", "--task", "align", "--family", "qwen3_forced_aligner",
                               "--model", str(ALIGN_MODEL), "--backend", "metal", "--request-sequence", str(seq),
                               "--words-out", str(Path(tmp) / "w" / "words.json")], capture_output=True, text=True)
        if proc.returncode != 0:
            print(f"[align] failed: {(proc.stderr or proc.stdout)[-400:]}")
            return spans
        for key in spans:
            f = Path(tmp) / "w" / f"words_{key}.json"
            if f.exists():
                spans[key] = [{"word": w["word"], "start": round(w["start_sample"] / ALIGN_SR, 3),
                               "end": round(w["end_sample"] / ALIGN_SR, 3)}
                              for w in json.loads(f.read_text(encoding="utf-8"))]
        print(f"[align] {len(items)} take(s) in {time.time() - t0:.1f}s", flush=True)
    return spans


def align_check(spans: list[dict] | None, text: str, lang: str, duration: float) -> dict:
    """Listen-free sanity: monotonic, inside the take, and how much of the text got a span."""
    if not spans:
        return {"ok": False, "monotonic": False, "within": False, "coverage": 0.0, "mapped": 0.0}
    mono = all(s["end"] >= s["start"] for s in spans) and all(
        b["start"] >= a["start"] and b["start"] >= a["end"] - 0.001 for a, b in zip(spans, spans[1:]))
    within = all(0 <= s["start"] and s["end"] <= duration + 0.02 for s in spans)
    units = lexical_units(text, lang)
    covered = sum(1 for u in units if any(s["char"] and s["char"][0] <= u[0] < s["char"][1] for s in spans))
    coverage = round(covered / len(units), 3) if units else 1.0
    mapped = round(sum(1 for s in spans if s["char"]) / len(spans), 3)
    return {"ok": mono and within and coverage >= 0.95, "monotonic": mono, "within": within,
            "coverage": coverage, "mapped": mapped}


def words_key(meta: dict) -> str:
    """Spans belong to one take hash and one output format; either changing re-aligns."""
    return f"{meta['hash']}/wordtiming-v1"


def ensure_words(script: dict, out: Path, langs: list[str]) -> None:
    """Align every current take that has no `words` yet; store spans and their sanity check in the sidecar."""
    need = [(f"{lang}__{line['id']}", wav, lang, clean(line[lang]))
            for line, lang, wav, meta in current_takes(script, out, langs)
            if meta.get("words_for") != words_key(meta)]
    if not need:
        return
    spans = align_batch(need)
    for key, wav, lang, text in need:
        meta = read_sidecar(wav)
        words = spans.get(key)
        if words is not None:
            attach_chars(words, text)
        meta["align"] = align_check(words, text, lang, meta["duration"])
        meta["words"] = None if words is None else [word_timing(w, text) for w in words if w["char"]]
        meta["words_for"] = words_key(meta)
        write_sidecar(wav, meta)


def utf16(text: str, i: int) -> int:
    """Code-point offset -> UTF-16 offset, the unit JavaScript string indices use."""
    return len(text[:i].encode("utf-16-le")) // 2


def word_timing(span: dict, text: str) -> dict:
    """One aligned span in the `WordTiming` shape of src/contracts/text.ts."""
    a, b = span["char"]
    return {"text": text[a:b], "charStart": utf16(text, a), "charEnd": utf16(text, b),
            "startS": span["start"], "endS": span["end"]}


# -- 6. cues and report ---------------------------------------------------------------

def vtt_ts(t: float) -> str:
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def write_vtt(path: Path, speaker: str, text: str, duration: float, words: list[dict] | None) -> None:
    """One cue per sentence. With aligned words, cue times come from them and each
    word gets a WebVTT inline timestamp (<00:00:01.230>); without, times are
    proportional to character count."""
    bounds, at = [], 0
    for s in SENTENCE_END.split(text):
        if s.strip():
            start = text.index(s, at)
            bounds.append((start, start + len(s.rstrip())))
            at = start + len(s)
    back = {utf16(text, i): i for i in range(len(text) + 1)}  # UTF-16 offset -> code point
    mapped = [{"char": [back[w["charStart"]], back[w["charEnd"]]], "start": w["startS"]} for w in words or []]
    cues, t = ["WEBVTT", ""], 0.0
    for i, (a, b) in enumerate(bounds, 1):
        mine = [w for w in mapped if a <= w["char"][0] < b]
        if mine:
            start = t if i > 1 else 0.0
            nxt = [w for w in mapped if w["char"][0] >= b]
            end = duration if i == len(bounds) or not nxt else nxt[0]["start"]
            body, pos = "", a
            for w in mine:
                body += text[pos:w["char"][0]] + (f"<{vtt_ts(w['start'])}>" if w["start"] > start else "")
                body += text[w["char"][0]:w["char"][1]]
                pos = w["char"][1]
            body += text[pos:b]
        else:
            total = sum(y - x for x, y in bounds) or 1
            start, end, body = t, duration if i == len(bounds) else t + duration * (b - a) / total, text[a:b]
        cues += [str(i), f"{vtt_ts(start)} --> {vtt_ts(end)}", f"<v {speaker}>{body.strip()}", ""]
        t = end
    path.write_text("\n".join(cues), encoding="utf-8")


def build_cues(script: dict, identity: dict, out: Path, mode: str, langs: list[str], timing: dict) -> dict:
    cues = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "timing_note":
            "Durations are measured from rendered audio. `words` are forced-aligned spans (Qwen3 Forced "
            "Aligner, 80 ms resolution) of the script text in the WordTiming shape of src/contracts/text.ts: "
            "one per word in en and es, one per character in zh; `startS`/`endS` are seconds into the take, "
            "`charStart`/`charEnd` are UTF-16 [start, end) offsets into `text`. Spans the aligner could not "
            "place in the text are omitted (see `align.mapped`). `loudness` is measured after render-time normalization to -18 LUFS "
            "and -1 dBTP; do not normalize again.", "last_render": timing, "lines": {}}
    for line in script["lines"]:
        entry = {"speaker": line["speaker"], "scene": line["scene"], "direction": clean(line.get("direction", "")),
                 "langs": {}}
        for lang in langs:
            wav = out / lang / f"{line['id']}.wav"
            meta = read_sidecar(wav)
            if meta is None or meta["hash"] != take(line, lang, script, identity, mode)[0]:
                continue  # missing or stale: never ship a cue for audio that no longer matches the text
            text = clean(line[lang])
            words = meta.get("words") if meta.get("words_for") == words_key(meta) else None
            write_vtt(wav.with_suffix(".vtt"), line["speaker"], text, meta["duration"], words)
            item = {"file": str(wav.relative_to(out)), "vtt": str(wav.with_suffix(".vtt").relative_to(out)),
                    "duration": meta["duration"], "peak": meta["peak"], "hash": meta["hash"],
                    "seed": meta["request"]["seed"], "text": text}
            if "asr" in meta:
                item["asr"], item["asr_similarity"] = meta["asr"], meta.get("asr_similarity")
            if "loudness" in meta:
                item["loudness"] = {k: meta["loudness"][k] for k in ("lufs", "true_peak_dbtp", "limited_db")
                                    if k in meta["loudness"]}
            if words is not None:
                item["words"], item["align"] = words, meta["align"]
            entry["langs"][lang] = item
        cues["lines"][line["id"]] = entry
    (out / "cues.json").write_text(json.dumps(cues, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[cues] wrote {out / 'cues.json'}")
    return cues


def write_report(cues: dict, out: Path, langs: list[str], threshold: float, run: dict) -> None:
    lines = cues["lines"]
    scenes = list(dict.fromkeys(e["scene"] for e in lines.values()))
    fmt = lambda s: f"{int(s // 60)}:{s % 60:04.1f}"
    rows = [f"# VO render report ({cues['generated']})", "",
            "Generated by `vo/render.py`; regenerate rather than edit.", "",
            "## Run", ""]
    rows += [f"- {k}: {v}" for k, v in run.items()]
    rows += ["", "## Per language", "", "| lang | takes | mean ASR | min ASR | under "
             f"{threshold} | audio (m:s) |", "|---|---|---|---|---|---|"]
    under = []
    for lang in langs:
        items = [(lid, e["langs"][lang]) for lid, e in lines.items() if lang in e["langs"]]
        sims = [it["asr_similarity"] for _, it in items if it.get("asr_similarity") is not None]
        low = [(lid, it) for lid, it in items if it.get("asr_similarity") is not None and it["asr_similarity"] < threshold]
        under += [(lang, lid, it) for lid, it in low]
        dur = sum(it["duration"] for _, it in items)
        rows.append(f"| {lang} | {len(items)} | {np.mean(sims):.3f} | {min(sims):.3f} | {len(low)} | {fmt(dur)} |"
                    if sims else f"| {lang} | {len(items)} | n/a | n/a | n/a | {fmt(dur)} |")
    rows += ["", "## Alignment and loudness", "",
             "| lang | aligned | ok | min coverage | non-monotonic | out of bounds | LUFS range | max dBTP | limited (max dB) |",
             "|---|---|---|---|---|---|---|---|---|"]
    flagged = []
    for lang in langs:
        items = [(lid, e["langs"][lang]) for lid, e in lines.items() if lang in e["langs"]]
        al = [(lid, it) for lid, it in items if "align" in it]
        lo = [it["loudness"] for _, it in items if it.get("loudness", {}).get("lufs") is not None]
        flagged += [(lang, lid, it["align"]) for lid, it in al if not it["align"]["ok"]]
        rows.append(f"| {lang} | {len(al)}/{len(items)} | {sum(it['align']['ok'] for _, it in al)} | "
                    f"{min((it['align']['coverage'] for _, it in al), default=0):.3f} | "
                    f"{sum(not it['align']['monotonic'] for _, it in al)} | "
                    f"{sum(not it['align']['within'] for _, it in al)} | "
                    + (f"{min(x['lufs'] for x in lo):.1f} to {max(x['lufs'] for x in lo):.1f} | "
                       f"{max(x['true_peak_dbtp'] for x in lo):.2f} | "
                       f"{sum(x.get('limited_db', 0) > 0 for x in lo)} ({max(x.get('limited_db', 0) for x in lo):.1f}) |"
                       if lo else "n/a | n/a | n/a |"))
    rows += [""] + ([f"- align flag {lang}/{lid}: {a}" for lang, lid, a in flagged] or ["- no alignment flags"])
    rows += ["", "## Per scene (audio m:s)", "", "| scene | lines | " + " | ".join(langs) + " |",
             "|---|---|" + "---|" * len(langs)]
    for scene in scenes:
        ents = [e for e in lines.values() if e["scene"] == scene]
        rows.append(f"| {scene} | {len(ents)} | " + " | ".join(
            fmt(sum(e["langs"][lg]["duration"] for e in ents if lg in e["langs"])) for lg in langs) + " |")
    rows += ["", f"## Takes still under {threshold}", ""]
    rows += [f"- {lang}/{lid} ({it['asr_similarity']}, seed {it['seed']}): wanted \"{it['text']}\", "
             f"heard \"{it['asr']}\"" for lang, lid, it in under] or ["- none"]
    (out / "REPORT.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(f"[report] wrote {out / 'REPORT.md'}")


def main() -> None:
    t0 = time.time()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--script", type=Path, default=VO / "script.yaml")
    ap.add_argument("--out", type=Path, default=VO / "out")
    ap.add_argument("--mode", choices=["clone", "design"], default="clone")
    ap.add_argument("--lang", action="append", choices=list(LANGS), help="repeatable; default all")
    ap.add_argument("--only", action="append", help="line id, repeatable")
    ap.add_argument("--speaker", action="append", help="only lines by this speaker, repeatable (narrows --only)")
    ap.add_argument("--force", action="store_true", help="ignore cache for selected lines")
    ap.add_argument("--recast", nargs="*", metavar="SPEAKER",
                    help="re-make these anchors (all if none named); recasts every line they speak")
    ap.add_argument("--dry-run", action="store_true", help="report what would cast, render and prune")
    ap.add_argument("--prune", action="store_true", help="delete outputs for line ids not in the script")
    ap.add_argument("--asr", action="store_true", help="Qwen3-ASR round trip for takes without a result")
    ap.add_argument("--retry-low", action="store_true", help="reseed takes under --threshold (implies --asr)")
    ap.add_argument("--threshold", type=float, default=0.85)
    ap.add_argument("--retry-seeds", type=int, default=3)
    args = ap.parse_args()

    script = yaml.safe_load(args.script.read_text(encoding="utf-8"))
    langs = args.lang or list(LANGS)
    out = args.out.resolve()
    only = set(args.only) if args.only else None
    if args.speaker:
        by_speaker = {ln["id"] for ln in script["lines"] if ln["speaker"] in args.speaker}
        only = by_speaker & only if only else by_speaker
    recast = set(args.recast) if args.recast is not None else None
    if args.prune:
        prune(script, out, args.dry_run)
    identity = cast(script["speakers"], recast, args.dry_run)
    timing = render(script, identity, out, args.mode, langs, only, args.force, args.dry_run)
    if args.dry_run:
        return
    ensure_loudness(script, out, langs)
    t_asr = time.time()
    ensure_asr(script, out, langs, args.asr or args.retry_low)
    run = {"render": timing, "asr_s": round(time.time() - t_asr, 1)}
    if args.retry_low:
        run["retry"] = retry_low(script, args.script, identity, out, args.mode, langs,
                                 args.threshold, args.retry_seeds, only)
    t_align = time.time()
    ensure_words(script, out, langs)
    run["align_s"] = round(time.time() - t_align, 1)
    cues = build_cues(script, identity, out, args.mode, langs, timing)
    run["invocation_wall_s"] = round(time.time() - t0, 1)
    write_report(cues, out, langs, args.threshold, {
        "invocation wall time": f"{run['invocation_wall_s']} s",
        "render": json.dumps(timing) if timing else "nothing stale",
        "ASR (first pass)": f"{run['asr_s']} s",
        "forced alignment": f"{run['align_s']} s",
        "retry": json.dumps({k: v for k, v in run["retry"].items() if k != "results"})
        if run.get("retry") else "none"})


if __name__ == "__main__":
    main()
