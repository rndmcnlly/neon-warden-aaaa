# /// script
# requires-python = ">=3.11"
# dependencies = ["librosa>=0.10", "pyloudnorm", "numpy", "soundfile", "scipy"]
# ///
"""Objective audio stats, printed as compact tables (never the audio itself).

uv run --script analyze.py <repo-root> <scratch-dir>
Writes <scratch-dir>/stats.json.
Metrics: duration, integrated LUFS (if >= 0.4 s), 4x true peak, active RMS
(samples within 40 dB of envelope peak), attack ms (onset to envelope peak),
spectral centroid (Hz), spectral flatness (0 tonal – 1 noise), tempo for music.
"""
import json, sys, pathlib, subprocess, tempfile, warnings
import numpy as np, librosa, pyloudnorm as pyln, scipy.signal as ss
warnings.filterwarnings("ignore")
ROOT, SCR = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])

def load(p, sr=48000):
    try:
        y, _ = librosa.load(str(p), sr=sr, mono=True)
    except Exception:
        # ElevenLabs "pcm_48000" may arrive as headerless s16le despite .wav
        raw = np.fromfile(p, dtype="<i2").astype(np.float32) / 32768
        y = raw
    return y

def stats(p, music=False):
    sr = 48000; y = load(p, sr)
    if len(y) < 64: return {"file": p.name, "silent": True}
    env = np.abs(ss.hilbert(y)) if len(y) < 48000 * 10 else np.abs(y)
    env = np.convolve(env, np.ones(48) / 48, "same")
    pk = env.max() + 1e-12
    act = y[env > pk * 0.01]
    tp = np.abs(ss.resample_poly(y, 4, 1)).max() if len(y) < 48000 * 30 else np.abs(y).max()
    above = np.where(env > pk * 0.1)[0]
    attack = (np.argmax(env) - above[0]) / sr * 1000 if len(above) else None
    tail = np.where(env > pk * 10 ** (-40 / 20))[0]
    dur_active = (tail[-1] - tail[0]) / sr if len(tail) else 0
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    cen = float(np.median(librosa.feature.spectral_centroid(S=S, sr=sr)))
    flat = float(np.median(librosa.feature.spectral_flatness(S=S)))
    d = {"file": str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else p.name,
         "dur_s": round(len(y) / sr, 3), "active_s": round(dur_active, 3),
         "tp_dbtp": round(20 * np.log10(tp + 1e-12), 1),
         "active_rms_dbfs": round(20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-12), 1),
         "attack_ms": round(attack, 1) if attack is not None else None,
         "centroid_hz": round(cen), "flatness": round(flat, 3)}
    if len(y) >= 0.4 * sr:
        try: d["lufs"] = round(pyln.Meter(sr).integrated_loudness(y), 1)
        except Exception: pass
    if music:
        tempo, _ = librosa.beat.beat_track(y=librosa.resample(y, orig_sr=sr, target_sr=22050), sr=22050)
        d["tempo_est"] = round(float(np.atleast_1d(tempo)[0]), 1)
        # loop seam: RMS jump between last and first 50 ms
        a, b = y[:2400], y[-2400:]
        d["seam_db"] = round(20 * np.log10((np.sqrt(np.mean(b ** 2)) + 1e-9) / (np.sqrt(np.mean(a ** 2)) + 1e-9)), 1)
    return d

out = {}
out["fal"] = [stats(p) for p in sorted((SCR / "fal").glob("*")) if p.suffix in (".wav", ".mp3")]
cands = sorted((ROOT / "sfx/candidates").glob("*/*.wav"))
out["sa3_ui"] = [stats(p) for p in cands]
out["music"] = [stats(p, music=True) for p in sorted((ROOT / "music/candidates").glob("*/*.wav"))]
vo = []
for lang in ("en", "es", "zh"):
    for p in sorted((ROOT / "vo/out" / lang).glob("*.wav")):
        s = stats(p); s["lang"] = lang; vo.append(s)
out["vo"] = vo
(SCR / "stats.json").write_text(json.dumps(out, indent=1, default=float))

def med(xs): xs = [x for x in xs if x is not None]; return round(float(np.median(xs)), 2) if xs else None
print("FAL"); [print(f" {d['file'][:34]:34} dur={d['dur_s']} act={d['active_s']} lufs={d.get('lufs')} tp={d['tp_dbtp']} rms={d['active_rms_dbfs']} atk={d['attack_ms']} cen={d['centroid_hz']} flat={d['flatness']}") for d in out["fal"]]
print("SA3 UI candidates n=", len(cands), "med centroid", med([d["centroid_hz"] for d in out["sa3_ui"]]),
      "med flat", med([d["flatness"] for d in out["sa3_ui"]]), "med attack", med([d["attack_ms"] for d in out["sa3_ui"]]),
      "share flat>0.3", round(np.mean([d["flatness"] > 0.3 for d in out["sa3_ui"]]), 2))
print("MUSIC"); [print(f" {d['file'][-34:]:34} dur={d['dur_s']} lufs={d.get('lufs')} tp={d['tp_dbtp']} cen={d['centroid_hz']} tempo={d.get('tempo_est')} seam={d.get('seam_db')}") for d in out["music"]]
print("VO per lang")
for lang in ("en", "es", "zh"):
    v = [d for d in vo if d["lang"] == lang]
    if v: print(f" {lang} n={len(v)} lufs med={med([d.get('lufs') for d in v])} min={min(d.get('lufs', 0) for d in v)} max={max(d.get('lufs', -99) for d in v)} tp max={max(d['tp_dbtp'] for d in v)} cen med={med([d['centroid_hz'] for d in v])}")
