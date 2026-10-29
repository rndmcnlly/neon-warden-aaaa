# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy"]
# ///
"""Side-by-side pairs (ours | comparator) plus simple value/color statistics.
Run from the critique folder: uv run --script scripts/compose.py"""
import pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(".")
OURS, COMP, SIDE = ROOT / "ours", ROOT / "comparators", ROOT / "side"
SIDE.mkdir(exist_ok=True)
H = 480

PAIRS = [
    ("01-playfield-hierarchy", "shot-01-sector-high.jpg", "sky-force-reloaded-1.jpg",
     "Ours: sector, all elements equal white glow", "Sky Force Reloaded: bullets warm, player cool, ground mid-value"),
    ("02-bullet-language", "shot-01-sector-high.jpg", "ikaruga-2.jpg",
     "Ours: player and enemy shots both white-cored", "Ikaruga: polarity colors, enemy shots as rings"),
    ("03-wireframe-enemies", "frame-gameplay-fight.jpg", "rez-infinite-2.jpg",
     "Ours: wire enemies on near-black void", "Rez Infinite: wire forms with a lit grid floor and a lock-on frame"),
    ("04-boss-presence", "frame-boss.jpg", "cygni-1.jpg",
     "Ours: boss off-frame, bullets small", "CYGNI: boss fills a third of the frame, shield bubble, rim light"),
    ("05-bullet-wall-color", "frame-boss.jpg", "returnal-3.jpg",
     "Ours: pink bullets on purple", "Returnal: cyan bullets on an orange, low-saturation set"),
    ("06-track-as-hero", "frame-gameplay-ended.jpg", "thumper-2.jpg",
     "Ours: thin rails, oblique drift camera", "Thumper: track is the composition, strong vanishing point"),
    ("07-color-budget", "shot-02-warden-boss.jpg", "tetris-effect-2.jpg",
     "Ours: warden scene", "Tetris Effect: one hue family per scene, particles carry the motion"),
    ("08-hero-silhouette", "shot-03-pilot-closeup.jpg", "returnal-0.jpg",
     "Ours: pilot closeup, primitive blocks", "Returnal: suit silhouette, rim light, atmospheric depth"),
]


def fit(p: pathlib.Path) -> Image.Image:
    im = Image.open(p).convert("RGB")
    w = round(im.width * H / im.height)
    return im.resize((w, H), Image.LANCZOS)


def stats(im: Image.Image) -> dict:
    a = np.asarray(im).astype(np.float32) / 255
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hsv = np.asarray(im.convert("HSV")).astype(np.float32)
    hue = hsv[..., 0][(sat > 0.35) & (mx > 0.25)]
    hist = np.histogram(hue, bins=12, range=(0, 256))[0]
    hues = int((hist > 0.05 * max(hist.sum(), 1)).sum())
    return {
        "mean_lum": round(float(lum.mean()), 3),
        "pct_black(<0.05)": round(float((lum < 0.05).mean() * 100), 1),
        "pct_hot(>0.85)": round(float((lum > 0.85).mean() * 100), 2),
        "mid_band(0.2-0.6)": round(float(((lum > 0.2) & (lum < 0.6)).mean() * 100), 1),
        "mean_sat": round(float(sat.mean()), 3),
        "hue_families(>5%)": hues,
    }


font = ImageFont.load_default(size=18) if hasattr(ImageFont, "load_default") else None
rows = []
seen = {}
for name, ours, comp, lo, lc in PAIRS:
    a, b = fit(OURS / ours), fit(COMP / comp)
    canvas = Image.new("RGB", (a.width + b.width + 12, H + 34), (18, 18, 22))
    canvas.paste(a, (0, 34))
    canvas.paste(b, (a.width + 12, 34))
    d = ImageDraw.Draw(canvas)
    d.text((6, 8), lo, fill=(235, 235, 235), font=font)
    d.text((a.width + 18, 8), lc, fill=(235, 235, 235), font=font)
    canvas.save(SIDE / f"{name}.jpg", quality=85)
    for label, img, f in (("ours", a, ours), ("comp", b, comp)):
        if f not in seen:
            seen[f] = stats(img)
lines = ["| image | mean lum | % black | % hot | % midtones | mean sat | hue families |", "|---|---|---|---|---|---|---|"]
for f, s in seen.items():
    lines.append(f"| {f} | " + " | ".join(str(v) for v in s.values()) + " |")
(SIDE / "stats.md").write_text("\n".join(lines) + "\n")
print("\n".join(lines))
