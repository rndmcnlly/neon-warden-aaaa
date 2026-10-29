# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow", "scipy"]
# ///
"""Morning fix numbers: lane floor contrast and Writ-on-armor loudness rise.

uv run --script measure.py <capDir>   (capDir holds before/ and after/, each
with floor/, disarm/, armor/ from capture.ts: reel.mp4 and truth.json)

Floor (1 fps, 2-13 s of `floor`, 1280x720, lane x 380-900, y 40-700), with
the key from research/2026-10-29-movement-lane/measure_floor.py: combat is
value >= 0.6 and saturation >= 0.35; floor is everything else that is not
near-white text. Reported per arm (medians over frames):
- floor value median and p95, and combat value median;
- floor local contrast: p99 of (value - 15 px median filter) on floor pixels;
- bright floor marks: connected blobs of floor pixels at least 0.10 above
  their local median, 4-200 px in area (the size of a bullet or pickup),
  more than 15 px from any combat pixel (so halos do not count), per frame.
  The scan cone's edges still count: it is not combat by this key.
Armor: for every Writ hit on the blocking Warden (`hit` with `blocked` and
level > 0), the 50 ms RMS peak 0-600 ms after it, minus the median of the
0.9 s before it (dB), as night verification's contrast.py does for releases;
and, because that pre-window holds the Writ's own release thump 0.18 s
earlier, the band energy (60-250 Hz, 250-1000, 1-4 kHz, 4-12 kHz) of 0-450
ms after the hit minus 500-50 ms before it, median over hits; and the
same 0-450 ms window after minus before (matched shots), median.
"""
import json
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

X0, X1, Y0, Y1 = 380, 900, 40, 700


def frames(mp4: str, start: float, end: float) -> list[np.ndarray]:
    out = []
    for t in np.arange(start, end, 1.0):
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", mp4,
             "-frames:v", "1", "-s", "1280x720", "-f", "rawvideo",
             "-pix_fmt", "rgb24", "-"],
            capture_output=True, check=True).stdout
        out.append(np.frombuffer(raw, np.uint8).reshape(720, 1280, 3) / 255)
    return out


def floor_stats(img: np.ndarray) -> dict:
    lane = img[Y0:Y1, X0:X1]
    v = lane.max(-1)
    s = np.where(v > 1e-6, (v - lane.min(-1)) / np.maximum(v, 1e-6), 0)
    combat = (v >= 0.6) & (s >= 0.35)
    floor = ~combat & ~((v >= 0.8) & (s < 0.2))
    local = v - ndimage.median_filter(v, size=15)
    # Halos and trails around combat pixels are not floor marks.
    near = ndimage.binary_dilation(combat, iterations=15)
    marks = floor & ~near & (local >= 0.10)
    lab, n = ndimage.label(marks)
    sizes = ndimage.sum(marks, lab, range(1, n + 1)) if n else np.array([])
    small = int(((sizes >= 4) & (sizes <= 200)).sum())
    return {
        "floor_v": float(np.median(v[floor])),
        "floor_v_p95": float(np.percentile(v[floor], 95)),
        "combat_v": float(np.median(v[combat])) if combat.sum() > 20 else None,
        "floor_local_p99": float(np.percentile(local[floor], 99)),
        "marks": small,
    }


def audio(mp4: str) -> tuple[np.ndarray, int]:
    sr = 48000
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", mp4, "-ac", "1", "-ar", str(sr),
         "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32), sr


def rms_db(x: np.ndarray, sr: int, win=0.05) -> np.ndarray:
    n = int(sr * win)
    k = len(x) // n
    r = np.sqrt((x[: k * n].reshape(k, n) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(r)


def armor_rise(d: str) -> list[float]:
    truth = json.load(open(f"{d}/truth.json"))
    x, sr = audio(f"{d}/reel.mp4")
    db = rms_db(x, sr)
    rises: list[float] = []
    bands: list[list[float]] = []
    posts: list[list[float]] = []
    for e in truth["log"]:
        ev = e.get("ev")
        if e["k"] != "ev" or ev["type"] != "hit":
            continue
        if not ev.get("blocked") or not ev.get("level"):
            continue
        i = int(e["t"] / 0.05)
        pre = db[max(0, i - 18): i]
        post = db[i: i + 12]
        if len(pre) and len(post):
            rises.append(float(post.max() - np.median(pre)))
        a = x[int((e["t"] - 0.5) * sr): int((e["t"] - 0.05) * sr)]
        b = x[int(e["t"] * sr): int((e["t"] + 0.45) * sr)]
        bands.append([band_db(b, sr, lo, hi) - band_db(a, sr, lo, hi)
                      for lo, hi in BANDS])
        posts.append([band_db(b, sr, lo, hi) for lo, hi in BANDS])
    return rises, bands, posts


BANDS = [(60, 250), (250, 1000), (1000, 4000), (4000, 12000)]


def band_db(seg: np.ndarray, sr: int, lo: float, hi: float) -> float:
    spec = np.abs(np.fft.rfft(seg)) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / sr)
    return float(10 * np.log10(spec[(f >= lo) & (f < hi)].mean() + 1e-12))


cap = sys.argv[1]
result: dict = {}
post_by_arm: dict[str, np.ndarray] = {}
for arm in ["before", "after"]:
    stats = [floor_stats(f) for f in frames(f"{cap}/{arm}/floor/reel.mp4", 2, 13)]
    med = {k: float(np.median([s[k] for s in stats if s[k] is not None]))
           for k in stats[0]}
    rises, bands, posts = armor_rise(f"{cap}/{arm}/armor")
    post_by_arm[arm] = np.array(posts)
    result[arm] = {
        "floor": med,
        "armor_rise_db": {"n": len(rises), "median": float(np.median(rises)),
                          "min": float(min(rises)), "max": float(max(rises))},
        "armor_band_rise_db": dict(zip(
            ["60-250", "250-1k", "1k-4k", "4k-12k"],
            [round(float(v), 1) for v in np.median(bands, axis=0)])),
    }
# Same seed and script: the k-th blocked Writ in each arm is the same shot
# (hit times agree within 35 ms), so after minus before in the same window is
# the energy the new sound adds.
n = min(len(post_by_arm["before"]), len(post_by_arm["after"]))
diff = post_by_arm["after"][:n] - post_by_arm["before"][:n]
result["armor_post_after_minus_before_db"] = dict(zip(
    ["60-250", "250-1k", "1k-4k", "4k-12k"],
    [round(float(v), 1) for v in np.median(diff, axis=0)]))
print(json.dumps(result, indent=1))
