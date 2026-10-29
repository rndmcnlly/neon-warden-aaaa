# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml", "soundfile", "numpy", "scipy", "pyloudnorm", "librosa"]
# ///
"""Audition per-language anchors (for example Spanish) for speakers that already have an English anchor.

Why: render.py clones every line from the speaker's English anchor, even
Spanish lines. Qwen3-TTS Base then carries the English reference's accent
into Spanish, and Spanish ASR round trips sit far below English and Chinese.
A Spanish-speaking anchor gives the clone Spanish phonetics to copy.

Two ways to make a candidate, both kept close to the English identity:
  bootstrap : Qwen3-TTS Base clones the English anchor speaking a Spanish
              anchor line. Same voice by construction; the accent may survive.
  design    : VoiceDesign from a description written in Spanish (the voice
              as `description` in script.yaml says it sounds, not the old
              English `design` prompt) speaking the same line. Native
              phonetics; identity can drift, so pitch is checked.

For each candidate: render the speaker's test lines (its lowest-scoring
current takes in that language) by cloning the candidate, run render.py's
ASR and scorer, and measure median f0 against the English anchor. The pick
rule: highest mean ASR among candidates whose anchor transcribes cleanly
(>= 0.9) and whose median f0 is within 20% of the English anchor's.

Layout: vo/casting/lang_anchors/<lang>/<speaker>/<cand>/anchor.{wav,json}
and .../<cand>/<line>.{wav,json}; vo/casting/lang_anchors/<lang>/index.json.
Nothing in vo/voices or vo/out is written until --promote.

Usage:
  uv run vo/casting/cast_lang_anchors.py --lang es                    # all speakers in ANCHORS[lang]
  uv run vo/casting/cast_lang_anchors.py --lang es --speaker warden --force
  uv run vo/casting/cast_lang_anchors.py --lang es --promote          # copy each speaker's pick to vo/voices
  uv run vo/casting/cast_lang_anchors.py --lang es --promote warden=design_s133
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import librosa
import numpy as np
import yaml

CASTING = Path(__file__).resolve().parent
VO = CASTING.parent
sys.path.insert(0, str(VO))
import render as R  # noqa: E402  (vo/render.py: shared models, ASR, scoring)

N_TEST_LINES = 8
F0_TOLERANCE = 0.20
ANCHOR_ASR_FLOOR = 0.9

# Per language, per speaker: the anchor line (a translation of the English
# anchor, so the reference says comparable things) and a design written in
# that language. tutorial_ai uses the recast anchor (vo/casting/tutorial_ai/PICK).
ANCHORS = {
    "es": {
        "tutorial_ai": {
            "anchor": "Bienvenido al programa de inducción de la Autoridad de Rutas. Estaré contigo en cada paso "
                      "del camino. Empecemos con algo sencillo: mover tu nave.",
            "design": "Una voz femenina adulta y cálida, contralto, de unos cuarenta años, tranquila y sin prisa "
                      "como una capitana de avión hablando por el intercomunicador de cabina, tono medio-bajo, "
                      "tranquilizadora y sincera, con calidez institucional y dicción profesional muy clara. "
                      "Español latinoamericano neutro.",
        },
        "narrator": {
            "anchor": "En un mundo donde el neón nunca duerme, un piloto recuerda. La lluvia. El silencio. "
                      "Y la promesa que no pudo cumplir.",
            "design": "Un narrador masculino de tráiler de cine, de unos cincuenta y cinco años, voz grave, "
                      "lenta y áspera, cansada y dramática, con pausas largas y resonancia de pecho. Habla un "
                      "español latinoamericano neutro y claro, como si cada frase fuera el final de una tragedia.",
        },
        "warden": {
            "anchor": "¿Te atreves a entrar en MI red? ¡Soy el Guardián! He visto arder a mil pilotos, "
                      "¡y a ti te veré arder más que a ninguno!",
            "design": "Una voz masculina aguda, chillona e indignada, operística y exagerada, que grita con "
                      "furia teatral y se quiebra cuando se enoja: un viejo guardián harto de repetir la misma "
                      "advertencia. Nada grave ni ronca, un poco cómica. Español latinoamericano neutro, "
                      "con dicción muy clara.",
        },
        "pilot": {
            "anchor": "Un trabajo es un trabajo. Vuelo la ruta, me pagan, me voy a casa. "
                      "Eso es todo lo que hay que decir.",
            "design": "Una voz masculina adulta, de unos treinta y cinco años, baja, tranquila y seca, oída a "
                      "través de un casco sellado, un poco apagada y cerca del micrófono, sin calidez ni prisa, "
                      "cada palabra deliberada. Español latinoamericano neutro.",
        },
        "scout": {
            "anchor": "Deriva Cuatro a Deriva Seis. El convoy pasa a media campana. Mantengan la ruta "
                      "despejada, y no disparen a menos que dispare.",
            "design": "Una voz joven, rápida y sincera en una radio de corto alcance, de género neutro, con "
                      "frases profesionales y cortas pero cálida por dentro, con un leve brillo sintético, "
                      "hablando bajo como para no ser oída. Español latinoamericano neutro y bien articulado.",
        },
        "authority": {
            "anchor": "Control de Rutas a todos los equipos de reconocimiento. Cimientos del peaje aprobados, "
                      "pendientes de autorización. Registren sus horas antes del fin del ciclo.",
            "design": "Un despachador de control de tráfico de mediana edad, seco y aburrido, en un canal de "
                      "radio corporativo limpio, monótono y sin prisa, ligeramente comprimido, que lo lee todo "
                      "como una partida de una factura. Español latinoamericano neutro.",
        },
    },
    # Chinese scores well from the English anchors (mean 0.975); only the
    # narrator's one-word line 守望者 kept coming back as "Show wander".
    "zh": {
        "tutorial_ai": {
            "anchor": "欢迎参加航道管理局入职培训。我会陪你走过每一步。让我们从简单的事情开始：移动你的飞船。",
            "design": "一位四十多岁的成熟女性，温暖的女低音，像航空机长通过客舱广播说话一样平静从容，"
                      "中低音调，真诚可靠，带有温和的机构式关怀，专业清晰的吐字。说标准普通话。",
        },
        "narrator": {
            "anchor": "在一个霓虹永不熄灭的世界里，一名飞行员记得。那场雨。那片寂静。还有他没能守住的承诺。",
            "design": "一位五十多岁的男性电影预告片旁白，声音低沉、缓慢、沙哑，疲惫而富有戏剧性，带有长长的停顿和"
                      "胸腔共鸣。说标准普通话，吐字清晰，仿佛每一句都是一场悲剧的最后一句。",
        },
    },
}


def median_f0(wav: Path) -> float | None:
    y, sr = librosa.load(str(wav), sr=16000, mono=True)
    f0, voiced, _ = librosa.pyin(y, fmin=60, fmax=600, sr=sr, frame_length=1024)
    f0 = f0[voiced & ~np.isnan(f0)]
    return round(float(np.median(f0)), 1) if f0.size else None


def test_lines(script: dict, speaker: str, lang: str) -> list[dict]:
    """The speaker's lowest-scoring current takes in `lang` (from cues.json), worst first."""
    cues = json.loads((VO / "out" / "cues.json").read_text(encoding="utf-8"))["lines"]
    mine = [ln for ln in script["lines"] if ln["speaker"] == speaker
            and cues.get(ln["id"], {}).get("langs", {}).get(lang, {}).get("asr_similarity") is not None]
    sim = lambda ln: cues.get(ln["id"], {}).get("langs", {}).get(lang, {}).get("asr_similarity") or 0.0
    return sorted(mine, key=sim)[:N_TEST_LINES]


def candidates(speaker: str, sp: dict) -> list[dict]:
    s = int(sp["seed"])
    return ([{"key": f"bootstrap_s{s + k}", "method": "bootstrap", "seed": s + k} for k in (0, 100)]
            + [{"key": f"design_s{s + k}", "method": "design", "seed": s + k} for k in (0, 100)])


def audition(lang: str, speakers: list[str], force: bool) -> None:
    script = yaml.safe_load((VO / "script.yaml").read_text(encoding="utf-8"))
    root = CASTING / "lang_anchors" / lang
    index_path = root / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    for name in speakers:
        spec, sp = ANCHORS[lang][name], script["speakers"][name]
        en_wav, en_meta = VO / "voices" / f"{name}.wav", json.loads((VO / "voices" / f"{name}.json").read_text())
        cands = candidates(name, sp)
        lines = test_lines(script, name, lang)
        base = root / name
        if force:
            shutil.rmtree(base, ignore_errors=True)
        # 1. anchors: bootstrap clones the English anchor, design uses VoiceDesign.
        todo_boot, todo_des = [], []
        for c in cands:
            if (base / c["key"] / "anchor.wav").exists():
                continue
            req = {"id": c["key"], "seed": c["seed"], "language": R.LANGS[lang], "text": spec["anchor"]}
            if c["method"] == "bootstrap":
                todo_boot.append({**req, "voice_ref": str(en_wav), "reference_text": en_meta["request"]["text"]})
            else:
                todo_des.append({**req, "instruct": spec["design"]})
        for task, model, todo in (("tts", R.BASE_MODEL, todo_boot), ("vdes", R.DESIGN_MODEL, todo_des)):
            if not todo:
                continue
            stage, wall = R.run_audiocpp(task, model, todo, f"{name}-{lang}-anchors")
            for req in todo:
                dest = base / req["id"] / "anchor.wav"
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(stage / f"{req['id']}.wav", dest)
                method = "bootstrap" if task == "tts" else "design"
                R.write_sidecar(dest, {"method": method, "request": req, "from_anchor": en_meta["hash"],
                                       **R.audio_stats(dest)})
        # 2. test lines cloned from each candidate anchor (the production clone path).
        todo = []
        for c in cands:
            for ln in lines:
                wav = base / c["key"] / f"{ln['id']}.wav"
                if not wav.exists():
                    todo.append((c, ln, wav, {"id": f"{c['key']}__{ln['id']}", "seed": R.line_seed(ln, sp, lang),
                                              "language": R.LANGS[lang], "text": R.clean(ln[lang]),
                                              "voice_ref": str(base / c["key"] / "anchor.wav"),
                                              "reference_text": spec["anchor"]}))
        if todo:
            stage, wall = R.run_audiocpp("tts", R.BASE_MODEL, [t[3] for t in todo], f"{name}-{lang}-lines")
            for c, ln, wav, req in todo:
                shutil.move(stage / f"{req['id']}.wav", wav)
                R.write_sidecar(wav, {"request": req, **R.audio_stats(wav)})
        # 3. ASR for every clip lacking it (anchors included), then score.
        clips = [(f"{c['key']}__anchor", base / c["key"] / "anchor.wav", spec["anchor"]) for c in cands]
        clips += [(f"{c['key']}__{ln['id']}", base / c["key"] / f"{ln['id']}.wav", R.clean(ln[lang]))
                  for c in cands for ln in lines]
        need = [(k, w, lang) for k, w, _ in clips if "asr" not in json.loads(w.with_suffix(".json").read_text())]
        heard = R.asr_batch(need) if need else {}
        for key, wav, text in clips:
            meta = json.loads(wav.with_suffix(".json").read_text())
            if key in heard:
                meta["asr"] = heard[key]
            meta["asr_similarity"] = R.score(text, meta["asr"], lang) if meta.get("asr") is not None else 0.0
            if "median_f0" not in meta:
                meta["median_f0"] = median_f0(wav)
            R.write_sidecar(wav, meta)
        # 4. summarize against the current production takes and the English anchor's pitch.
        cues = json.loads((VO / "out" / "cues.json").read_text(encoding="utf-8"))["lines"]
        en_f0 = median_f0(en_wav)
        rows = {"current": {"mean": round(float(np.mean([cues[ln["id"]]["langs"][lang]["asr_similarity"]
                                                         for ln in lines])), 3),
                            "min": min(cues[ln["id"]]["langs"][lang]["asr_similarity"] for ln in lines)}}
        for c in cands:
            a = json.loads((base / c["key"] / "anchor.json").read_text())
            sims = [json.loads((base / c["key"] / f"{ln['id']}.json").read_text())["asr_similarity"] for ln in lines]
            f0 = a["median_f0"]
            rows[c["key"]] = {"method": c["method"], "seed": c["seed"], "mean": round(float(np.mean(sims)), 3),
                              "min": min(sims), "anchor_asr": a["asr_similarity"], "anchor_f0": f0,
                              "f0_ratio": round(f0 / en_f0, 3) if f0 and en_f0 else None}
        eligible = [k for k, r in rows.items() if k != "current" and r["anchor_asr"] >= ANCHOR_ASR_FLOOR
                    and r["f0_ratio"] and abs(r["f0_ratio"] - 1) <= F0_TOLERANCE]
        pick = max(eligible, key=lambda k: (rows[k]["mean"], rows[k]["min"], -abs(rows[k]["f0_ratio"] - 1)),
                   default=None)
        index[name] = {"en_anchor_f0": en_f0, "test_lines": [ln["id"] for ln in lines], "anchor": spec["anchor"],
                       "design": spec["design"], "candidates": rows, "pick": pick}
        print(f"[{name}] current {rows['current']}; pick {pick}")
        for k, r in rows.items():
            print(f"  {k:16} {r}")
        root.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def promote(lang: str, picks: list[str]) -> None:
    """Copy picked candidate anchors to vo/voices/<speaker>.<lang>.wav; render.py then re-renders those lines."""
    root = CASTING / "lang_anchors" / lang
    index = json.loads((root / "index.json").read_text(encoding="utf-8"))
    chosen = dict(p.split("=", 1) for p in picks if "=" in p) or {
        n: e["pick"] for n, e in index.items() if e["pick"]}
    for name, key in chosen.items():
        src = root / name / key / "anchor.wav"
        meta = json.loads(src.with_suffix(".json").read_text())
        dest = VO / "voices" / f"{name}.{lang}.wav"
        shutil.copy(src, dest)
        req = {**meta["request"], "id": f"{name}.{lang}"}
        R.write_sidecar(dest, {"hash": R.sha({"lang_anchor": req, "method": meta["method"],
                                              "from_anchor": meta["from_anchor"]}),
                               "method": meta["method"], "candidate": key, "from_anchor": meta["from_anchor"],
                               "request": req, **R.audio_stats(dest), "median_f0": meta.get("median_f0"),
                               "audition": index[name]["candidates"][key]})
        print(f"[promote] {name} {lang}: {key} -> {dest.relative_to(VO.parent)}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", required=True, choices=list(ANCHORS))
    ap.add_argument("--speaker", action="append", help="repeatable; default every speaker in ANCHORS[lang]")
    ap.add_argument("--force", action="store_true", help="redo the selected speakers from scratch")
    ap.add_argument("--promote", nargs="*", metavar="SPEAKER=CAND",
                    help="copy picks to vo/voices (each speaker's index pick if none named)")
    args = ap.parse_args()
    if args.promote is not None:
        promote(args.lang, args.promote)
        return
    audition(args.lang, args.speaker or list(ANCHORS[args.lang]), args.force)


if __name__ == "__main__":
    main()
