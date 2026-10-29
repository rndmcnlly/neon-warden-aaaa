# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Picture alignment of every take-backed shot in a master against its take.

    uv run --script research/2026-10-29-trailer-render/picsync.py <cut> <lang>

For each shot, frames of the master at shot start + k are matched against
take frames around inPoint*60 + k (search +-15 frames); the best offset (in
frames, median over sampled k) is the picture's shift from the intended
in-point. Audio in the shot is cut sample-exact from the same in-point, so a
non-zero offset is picture-against-sound lag. Writes qa/<cut>-<lang>.picsync.json.
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 240, 135


def frames(path, ss, t):
    o = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, ss):.4f}", "-t", f"{t:.4f}", "-i", path,
                        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,format=gray",
                        "-f", "rawvideo", "-"], capture_output=True).stdout
    return np.frombuffer(o, np.uint8).reshape(-1, W * H).astype(np.int16)


cut, lang = sys.argv[1], sys.argv[2]
r = json.load(open(f"{ROOT}/trailer/out/{cut}/{lang}/{cut}-{lang}.report.json"))
master = f"{ROOT}/trailer/out/{cut}/{lang}/{cut}-{lang}.mp4"
rows = []
S = 15
for s in r["shots"]:
    if s["kind"] != "take":
        continue
    take = f"{ROOT}/trailer/.cache/takes/{s['take']}/take.mp4"
    m = frames(master, s["start"], s["dur"])
    pre = min(S / 60, s["inPoint"])
    t = frames(take, s["inPoint"] - pre, s["dur"] + 2 * S / 60)
    base = int(round(pre * 60))
    offs, motion = [], []
    for k in range(3, len(m) - 3, 6):
        cands = [(np.abs(m[k] - t[base + k + o]).mean(), o) for o in range(-S, S + 1)
                 if 0 <= base + k + o < len(t)]
        if not cands:
            continue
        cands.sort()
        if k + 1 < len(m):
            motion.append(float(np.abs(m[k + 1] - m[k]).mean()))
        offs.append(cands[0][1])
    med = int(np.median(offs)) if offs else None
    rows.append({"shot": s["id"], "frames": len(m), "offsetFrames": med,
                 "offsets": offs[:12], "motion": round(float(np.median(motion)), 2) if motion else 0})
    print(f"{s['id']:16s} {len(m):4d}f offset {med} {offs[:10]}")
os.makedirs(f"{HERE}/qa", exist_ok=True)
json.dump(rows, open(f"{HERE}/qa/{cut}-{lang}.picsync.json", "w"), indent=1)
