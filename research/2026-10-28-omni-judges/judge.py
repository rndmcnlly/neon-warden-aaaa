# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""Audio-visual reel judge (research prototype for a future qa/judge stage).

Sends one reel (video with its audio track) plus a rubric to an omni model on
OpenRouter, and stores structured JSON scores next to the reel.

    uv run --script judge.py out/boss-av/reel.mp4 --model google/gemini-4-argon \
        --title "Warden descent, boss arena" [--context notes.txt] [--zdr]

Design notes, for students reading this:
- Inventory before scores. The model must first say what it hears (each VO
  line with a timestamp and a transcript, whether music or SFX exist at all).
  The VO transcript is a canary: compare it with vo/script.yaml and you know
  whether the model actually received the audio or is guessing from pictures.
- Every score carries evidence with timestamps, so a reviewer can scrub to it.
- The schema is enforced by the API (`response_format: json_schema`), so the
  output is machine-readable without regex scraping.
- Cost comes back from OpenRouter (`usage.cost`); append it to research/SPEND.md.
"""

import argparse
import base64
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time

import httpx

RUBRIC = [
    ("av_sync", "Audio-visual sync: do sounds and voice line up with on-screen events, subtitles and cuts?"),
    ("mix_balance", "Mix balance: VO vs music vs SFX levels, clarity, ducking, clipping, dead air."),
    ("sfx_fit", "SFX fit: do weapon, hit, explosion and UI sounds exist where the picture implies them, and suit the style?"),
    ("music_fit", "Music fit: is there a score, and does it suit the scene's energy and the cyberpunk tone?"),
    ("vo_performance", "VO performance: delivery, character fit, intelligibility."),
    ("polish_vs_aaa", "Overall audiovisual polish compared with a shipped AAA game."),
]

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["inventory", "scores", "fixes", "summary"],
    "properties": {
        "inventory": {
            "type": "object",
            "additionalProperties": False,
            "required": ["vo_lines", "music_present", "sfx_present", "silent_spans", "notes"],
            "properties": {
                "vo_lines": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["start_s", "end_s", "transcript", "voice"],
                        "properties": {
                            "start_s": {"type": "number"},
                            "end_s": {"type": "number"},
                            "transcript": {"type": "string"},
                            "voice": {"type": "string"},
                        },
                    },
                },
                "music_present": {"type": "boolean"},
                "sfx_present": {"type": "boolean"},
                "silent_spans": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["start_s", "end_s"],
                        "properties": {"start_s": {"type": "number"}, "end_s": {"type": "number"}},
                    },
                },
                "notes": {"type": "string"},
            },
        },
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["criterion", "score", "justification", "evidence_s"],
                "properties": {
                    "criterion": {"type": "string", "enum": [k for k, _ in RUBRIC]},
                    "score": {"type": "integer", "minimum": 1, "maximum": 5},
                    "justification": {"type": "string"},
                    "evidence_s": {"type": "array", "items": {"type": "number"}},
                },
            },
        },
        "fixes": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["at_s", "fix", "discipline"],
                "properties": {
                    "at_s": {"type": "number"},
                    "fix": {"type": "string"},
                    "discipline": {"type": "string", "enum": ["sound design", "music", "mix", "VO", "animation", "UI", "VFX", "camera", "other"]},
                },
            },
        },
        "summary": {"type": "string"},
    },
}


def prompt(title: str, context: str | None) -> str:
    rubric = "\n".join(f"- {k}: {d}" for k, d in RUBRIC)
    return f"""You are an audio director reviewing a QA capture from a 3D shoot-'em-up vertical slice.
Reel: {title}. The video includes its full game audio track. Judge sound and picture together.

First, take inventory of what you actually HEAR: every voice line with start and end time in seconds
and a verbatim transcript, whether any music plays, whether any sound effects play, and the spans of
silence longer than 2 s. Do not infer sound from the picture; if you hear nothing, say so.

Then score each criterion 1-5 (5 = shippable AAA, 1 = absent or broken) with a justification that
cites timestamps:
{rubric}
A criterion whose element is absent scores 1 and says so; do not reward silence as restraint.

Then list exactly 5 concrete fixes, highest impact first, each with a timestamp in seconds.
{"Production context: " + context if context else ""}"""


def api_key() -> str:
    if key := os.environ.get("OPENROUTER_API_KEY"):
        return key
    auth = pathlib.Path.home() / ".local/share/opencode/auth.json"
    return json.loads(auth.read_text())["openrouter"]["key"]


def transcode(src: pathlib.Path, dst: pathlib.Path) -> None:
    # 854x480 at 12 fps keeps a minute under ~4 MB; Gemini samples about 1 fps anyway.
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf", "scale=854:-2", "-r", "12",
         "-c:v", "libx264", "-crf", "30", "-preset", "veryfast", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "96k", "-ac", "1", str(dst)],
        check=True,
    )


def judge(video: pathlib.Path, model: str, title: str, context: str | None, zdr: bool) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        small = pathlib.Path(tmp) / "reel.mp4"
        transcode(video, small)
        data_url = "data:video/mp4;base64," + base64.b64encode(small.read_bytes()).decode()
    body = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt(title, context)},
                {"type": "video_url", "video_url": {"url": data_url}},
            ],
        }],
        "response_format": {"type": "json_schema", "json_schema": {"name": "av_judgment", "strict": True, "schema": SCHEMA}},
        "usage": {"include": True},
        "max_tokens": 16000,
    }
    if zdr:
        body["provider"] = {"zdr": True, "data_collection": "deny"}
    t0 = time.time()
    r = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key()}", "X-Title": "neon-warden-aaaa qa judge"},
        json=body,
        timeout=600,
    )
    wall = time.time() - t0
    out = r.json()
    if r.status_code != 200 or "choices" not in out:
        return {"model": model, "error": out, "status": r.status_code, "wall_s": round(wall, 1)}
    text = out["choices"][0]["message"].get("content") or ""
    try:
        judgment = json.loads(text.strip().removeprefix("```json").removesuffix("```"))
    except json.JSONDecodeError:
        judgment = {"unparsed": text}
    return {
        "model": model,
        "provider": out.get("provider"),
        "wall_s": round(wall, 1),
        "usage": out.get("usage"),
        "judgment": judgment,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("video", type=pathlib.Path)
    ap.add_argument("--model", default="google/gemini-4-argon")
    ap.add_argument("--title", default="QA reel")
    ap.add_argument("--context", type=pathlib.Path)
    ap.add_argument("--zdr", action="store_true", help="only route to zero-data-retention endpoints")
    ap.add_argument("--out", type=pathlib.Path)
    a = ap.parse_args()
    context = a.context.read_text() if a.context else None
    result = judge(a.video, a.model, a.title, context, a.zdr)
    out = a.out or a.video.with_name(f"judge-{a.model.replace('/', '_')}.json")
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    cost = (result.get("usage") or {}).get("cost")
    print(json.dumps({"out": str(out), "model": a.model, "cost": cost, "wall_s": result.get("wall_s"), "error": result.get("error")}))
    sys.exit(1 if "error" in result else 0)


if __name__ == "__main__":
    main()
