# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
"""Value-structure stats for QA reel frames, same metrics as the critique
(research/2026-10-28-critique-visual/scripts/compose.py): % hot (lum > 0.85)
and % midtone (0.2 < lum < 0.6), Rec. 709 luma on sRGB values.

Usage: uv run --script measure.py <reel.webm> [<reel.webm> ...]

Samples one frame every 2 s with ffmpeg, skips near-black frames (fades,
loading), and prints per-reel medians.
"""

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image


def stats(im: Image.Image) -> tuple[float, float, float]:
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    hot = float((lum > 0.85).mean() * 100)
    mid = float(((lum > 0.2) & (lum < 0.6)).mean() * 100)
    return float(lum.mean()), hot, mid


def main() -> None:
    for reel in sys.argv[1:]:
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-i", reel, "-vf",
                 "fps=0.5,scale=640:-1", f"{tmp}/f%03d.png"],
                check=True,
            )
            rows = []
            for f in sorted(Path(tmp).glob("f*.png")):
                m, hot, mid = stats(Image.open(f))
                if m < 0.02:
                    continue
                rows.append((f.name, m, hot, mid))
        if not rows:
            print(f"{reel}: no lit frames")
            continue
        hots = np.array([r[2] for r in rows])
        mids = np.array([r[3] for r in rows])
        print(f"{reel}: {len(rows)} frames  hot median {np.median(hots):.2f}% "
              f"(max {hots.max():.2f})  mid median {np.median(mids):.1f}% "
              f"(max {mids.max():.1f})")
        for name, m, hot, mid in rows:
            print(f"  {name} lum {m:.3f} hot {hot:.2f} mid {mid:.1f}")


if __name__ == "__main__":
    main()
