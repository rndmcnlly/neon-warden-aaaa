# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
"""Lane floor versus combat, in value and saturation (HSV, 0-1), per frame.

uv run --script measure_floor.py <frame.png> [...]   (or a video: frames
sampled every second with ffmpeg first, see README).

The playfield is the lane rectangle at 1280x720 (x 380-900, the camera's
fixed framing); pixels there are split by a simple key:
- combat: saturated, bright pixels (value >= 0.6 and saturation >= 0.35):
  bullet cores and rings, the ship's glow, explosions;
- floor: everything else inside the lane that is not near-white text or HUD.
Reported: the floor's median and 95th-percentile value and saturation, and
the combat pixels' median value and saturation; also chroma (max - min of
RGB), because HSV saturation of a dark navy is high even when it looks dim
and grey, while chroma tracks how colorful a pixel actually looks. The floor must stay below
combat in both (night plan item 9). A key, not a segmentation: debris,
dim enemies and the scan cone count as floor, which makes the floor numbers
conservative (higher), not flattering.
"""
import json
import sys

import numpy as np
from PIL import Image

X0, X1, Y0, Y1 = 380, 900, 40, 700


def hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return mx, sat


def measure(path: str) -> dict:
    img = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255
    if img.shape[1] != 1280:
        img = np.asarray(
            Image.open(path).convert("RGB").resize((1280, 720)), dtype=np.float32
        ) / 255
    lane = img[Y0:Y1, X0:X1]
    v, s = hsv(lane)
    combat = (v >= 0.6) & (s >= 0.35)
    floor = ~combat & ~((v >= 0.8) & (s < 0.2))
    out = {
        "frame": path.split("/")[-1],
        "floor_v_median": float(np.median(v[floor])),
        "floor_v_p95": float(np.percentile(v[floor], 95)),
        "floor_s_median": float(np.median(s[floor])),
        "floor_s_p95": float(np.percentile(s[floor], 95)),
        "combat_pixels": int(combat.sum()),
    }
    chroma = lane.max(axis=-1) - lane.min(axis=-1)
    out["floor_c_median"] = float(np.median(chroma[floor]))
    out["floor_c_p95"] = float(np.percentile(chroma[floor], 95))
    if combat.sum() > 20:
        out["combat_v_median"] = float(np.median(v[combat]))
        out["combat_s_median"] = float(np.median(s[combat]))
        out["combat_c_median"] = float(np.median(chroma[combat]))
    return {k: round(x, 3) if isinstance(x, float) else x for k, x in out.items()}


if __name__ == "__main__":
    print(json.dumps([measure(p) for p in sys.argv[1:]], indent=1))
