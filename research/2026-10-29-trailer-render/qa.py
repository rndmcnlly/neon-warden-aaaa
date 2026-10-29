# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""QA for trailer masters (trailer/out/<cut>/<lang>/<cut>-<lang>.mp4).

    uv run --script research/2026-10-29-trailer-render/qa.py [cut/lang ...]

Per master: format (1920x1080, 60 fps CFR, every packet 1/60 s apart),
duration against the plan, exact-duplicate frames inside take-backed shots
(a 1/4-size gray decode; a frozen-world shot is reported, not failed),
loudness and true peak (ebur128), an assembly A/V sync spot check (the take's
own audio cross-correlated with the master's audio inside up to three shots;
lag should be ~0, music and VO add noise but not lag), and captions (SRT
present, in the right script, burned caption layers counted). Writes
qa/<cut>-<lang>.json next to this file and prints one summary line.
"""
import json, os, re, subprocess, sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
HERE = os.path.dirname(os.path.abspath(__file__))
TAKES = f"{ROOT}/trailer/.cache/takes"


def run(args, text=True):
    return subprocess.run(args, capture_output=True, text=text, check=False)


def probe(path):
    o = run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path])
    return json.loads(o.stdout)


def packet_deltas(path):
    o = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
             "packet=pts_time", "-of", "csv=p=0", path])
    t = np.array(sorted(float(x) for x in o.stdout.split() if x and x != "N/A"))
    return np.diff(t)


def gray_frames(path, w=480, h=270):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h},format=gray",
                          "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    n = w * h
    prev, diffs = None, []
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        f = np.frombuffer(b, np.uint8).astype(np.int16)
        if prev is not None:
            diffs.append(float(np.abs(f - prev).mean()))
        prev = f
    p.wait()
    return np.array(diffs)  # diffs[i]: frame i+1 against frame i


def ebur(path):
    o = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a", "-af",
             "ebur128=peak=true", "-f", "null", "-"])
    s = o.stderr[o.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", s)
    tp = re.search(r"Peak:\s+(-?[\d.]+) dBFS", s)
    return float(i.group(1)), float(tp.group(1))


def pcm(path, start, dur, rate=16000):
    o = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", path,
                        "-map", "0:a", "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"],
                       capture_output=True)
    return np.frombuffer(o.stdout, np.float32)


def lag_ms(a, b, rate=16000, maxlag=0.25):
    n = min(len(a), len(b))
    if n < rate // 2:
        return None, 0.0
    a, b = a[:n] - a[:n].mean(), b[:n] - b[:n].mean()
    if a.std() < 1e-5 or b.std() < 1e-5:
        return None, 0.0
    m = 1 << int(np.ceil(np.log2(2 * n)))
    c = np.fft.irfft(np.fft.rfft(a, m) * np.conj(np.fft.rfft(b, m)), m)
    L = int(maxlag * rate)
    c = np.concatenate([c[-L:], c[:L + 1]])
    k = int(np.argmax(np.abs(c)))
    corr = float(np.abs(c[k]) / (np.linalg.norm(a) * np.linalg.norm(b)))
    return round((k - L) / rate * 1000, 1), round(corr, 3)


CJK = re.compile(r"[\u4e00-\u9fff]")
ES = re.compile(r"[áéíóúñ¿¡]")


def qa(cut, lang):
    d = f"{ROOT}/trailer/out/{cut}/{lang}"
    mp4, rep = f"{d}/{cut}-{lang}.mp4", f"{d}/{cut}-{lang}.report.json"
    r = json.load(open(rep))
    pr = probe(mp4)
    v = next(s for s in pr["streams"] if s["codec_type"] == "video")
    a = next(s for s in pr["streams"] if s["codec_type"] == "audio")
    dur = float(pr["format"]["duration"])
    deltas = packet_deltas(mp4)
    out = {"cut": cut, "lang": lang, "file": os.path.relpath(mp4, ROOT),
           "sizeMB": round(os.path.getsize(mp4) / 1e6, 1),
           "video": f'{v["width"]}x{v["height"]} {v["codec_name"]} {v.get("pix_fmt")} {v["avg_frame_rate"]}',
           "audio": f'{a["codec_name"]} {a["sample_rate"]} Hz {a["channels"]} ch',
           "duration": round(dur, 3), "planned": round(r["seconds"], 3),
           "frames": len(deltas) + 1,
           "cfr": bool(len(deltas) and np.allclose(deltas, 1 / 60, atol=1e-4)),
           "maxPacketGapMs": round(float(deltas.max()) * 1000, 2) if len(deltas) else None}
    diffs = gray_frames(mp4)
    shots = []
    for s in r["shots"]:
        f0, f1 = int(round(s["start"] * 60)), int(round((s["start"] + s["dur"]) * 60))
        seg = diffs[max(0, f0):max(0, f1 - 2)]  # inside the shot, not across its cut
        row = {"id": s["id"], "kind": s["kind"]}
        if s["kind"] == "take" and len(seg):
            row["dupFrames"] = int((seg < 0.01).sum())
            row["frames"] = len(seg) + 1
        shots.append(row)
    take_shots = [x for x in shots if "dupFrames" in x]
    out["dupFramesInTakeShots"] = sum(x["dupFrames"] for x in take_shots)
    out["takeShotFrames"] = sum(x["frames"] for x in take_shots)
    out["staticShots"] = [x["id"] for x in take_shots if x["dupFrames"] > 0.5 * x["frames"]]
    out["dupByShot"] = {x["id"]: x["dupFrames"] for x in take_shots if x["dupFrames"]}
    out["lufs"], out["truePeak"] = ebur(mp4)
    # A/V sync spot check: shots with the most game audio.
    sync = []
    for s in [s for s in r["shots"] if s["kind"] == "take" and s["dur"] >= 1.5]:
        take = f"{TAKES}/{s['take']}/take.mp4"
        lag, corr = lag_ms(pcm(mp4, s["start"] + 0.2, s["dur"] - 0.4),
                           pcm(take, s["inPoint"] + 0.2, s["dur"] - 0.4))
        if lag is not None and corr >= 0.25:
            sync.append({"shot": s["id"], "lagMs": lag, "corr": corr})
    sync = sorted(sync, key=lambda x: -x["corr"])[:4]
    out["sync"] = sync
    srt = f"{d}/{cut}-{lang}.srt"
    text = open(srt).read() if os.path.exists(srt) else ""
    body = "\n".join(l for l in text.splitlines() if l and not l[0].isdigit())
    out["srtCues"] = len(re.findall(r"-->", text))
    out["srtScript"] = ("zh" if CJK.search(body) else "es" if ES.search(body) else "en") if body else None
    work = f"{d}/work"
    out["burnedCaptionLayers"] = len([f for f in os.listdir(work) if f.startswith("cap-")]) if os.path.isdir(work) else 0
    out["warnings"] = r["warnings"]
    ok = (v["width"], v["height"]) == (1920, 1080) and out["cfr"] and abs(dur - r["seconds"]) < 0.1 \
        and abs(out["lufs"] + 16) <= 0.5 and out["truePeak"] <= -2.0 \
        and all(abs(x["lagMs"]) <= 22 for x in sync) and not r["warnings"]
    if cut != "compendium120":
        ok = ok and out["srtCues"] > 0 and out["srtScript"] == lang and out["burnedCaptionLayers"] > 0
    out["pass"] = bool(ok)
    os.makedirs(f"{HERE}/qa", exist_ok=True)
    json.dump(out, open(f"{HERE}/qa/{cut}-{lang}.json", "w"), indent=1, ensure_ascii=False)
    print(f'{cut}-{lang}: {"PASS" if ok else "FAIL"} {out["duration"]} s {out["video"]} cfr={out["cfr"]} '
          f'dup={out["dupFramesInTakeShots"]}/{out["takeShotFrames"]} static={out["staticShots"]} '
          f'{out["lufs"]} LUFS {out["truePeak"]} dBTP sync={[x["lagMs"] for x in sync]} '
          f'dupBy={out["dupByShot"]} srt={out["srtCues"]}/{out["srtScript"]} caps={out["burnedCaptionLayers"]}')


targets = sys.argv[1:] or [f"{c}/{l}" for c in ("teaser30", "trailer90", "compendium120") for l in ("en", "es", "zh")]
for t in targets:
    c, l = t.split("/")
    if os.path.exists(f"{ROOT}/trailer/out/{c}/{l}/{c}-{l}.mp4"):
        qa(c, l)
