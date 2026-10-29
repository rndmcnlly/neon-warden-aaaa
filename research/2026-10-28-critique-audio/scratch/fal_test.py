# /// script
# requires-python = ">=3.11"
# dependencies = ["fal-client>=0.5", "requests"]
# ///
"""Same 4 briefs on 2 fal models (ElevenLabs SFX v2, MMAudio v2), 2 takes each.

Usage: source ~/.tokens/fal-ai && uv run --script fal_test.py <outdir>
Writes <outdir>/<model>_<brief>_<take>.<ext> and <outdir>/runs.json.
Estimated cost: EL 7 s x 2 x $0.002 = $0.028; MMAudio 7 s x 2 x $0.001 = $0.014.
"""
import json, sys, time, pathlib, requests, fal_client

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

BRIEFS = {
    "ui_confirm": ("Premium futuristic console UI confirm sound, crisp glassy digital "
                   "click with a short bright synth chirp, tight, dry, no reverb, single one-shot", 0.6),
    "player_fire": ("Sci-fi spaceship blaster single shot, tight laser pulse tap, punchy "
                    "transient, short, dry, arcade shmup player weapon, single one-shot", 0.5),
    "part_break": ("Armored robot boss plating breaks off, heavy metal crack and shatter, "
                   "electrical sparks burst, debris, punchy impact, sci-fi", 1.5),
    "warden_roar": ("Furious mechanical machine roar, high-pitched angry synthetic scream, "
                    "servo whine and metallic distortion, giant robot rage, sci-fi", 3.0),
}
NEG = "music, melody, speech, voice, room tone, hiss, long reverb"

def get(url, dest):
    r = requests.get(url, timeout=60); r.raise_for_status(); dest.write_bytes(r.content)

runs = []
for brief, (text, dur) in BRIEFS.items():
    for take in (1, 2):
        # ElevenLabs: no seed; variation comes from prompt_influence < 1.
        t0 = time.time()
        res = fal_client.subscribe("fal-ai/elevenlabs/sound-effects/v2", arguments={
            "text": text, "duration_seconds": max(dur, 0.5),
            "prompt_influence": 0.5, "output_format": "pcm_48000"})
        url = res["audio"]["url"]; ext = "wav" if url.endswith(".wav") else url.rsplit(".", 1)[-1][:4]
        dest = OUT / f"elevenlabs_{brief}_{take}.{ext}"; get(url, dest)
        runs.append({"model": "elevenlabs-sfx-v2", "brief": brief, "take": take,
                     "seconds_billed": max(dur, 0.5), "wall_s": round(time.time() - t0, 2), "file": dest.name})
        t0 = time.time()
        res = fal_client.subscribe("fal-ai/mmaudio-v2/text-to-audio", arguments={
            "prompt": text, "negative_prompt": NEG, "duration": max(dur, 1.0),
            "seed": 1000 + take, "num_steps": 25, "cfg_strength": 4.5})
        url = res["audio"]["url"]; ext = url.rsplit(".", 1)[-1][:4]
        dest = OUT / f"mmaudio_{brief}_{take}.{ext}"; get(url, dest)
        runs.append({"model": "mmaudio-v2", "brief": brief, "take": take,
                     "seconds_billed": max(dur, 1.0), "wall_s": round(time.time() - t0, 2), "file": dest.name})
        print(brief, take, "ok", flush=True)

(OUT / "runs.json").write_text(json.dumps(runs, indent=1))
print("billed seconds EL", sum(r["seconds_billed"] for r in runs if r["model"].startswith("eleven")),
      "MM", sum(r["seconds_billed"] for r in runs if r["model"].startswith("mm")))
