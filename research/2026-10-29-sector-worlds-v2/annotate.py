# /// script
# dependencies = ["pillow"]
# ///
"""Annotated pass-one diagnosis stills (frozen c5fa3bf captures)."""
import os
from PIL import Image, ImageDraw, ImageFont
D = os.path.dirname(os.path.abspath(__file__))
NOTES = {
    1: ["1 Same flat value on every top face: blocks read as UI panels",
        "2 No human-scale cue (window, rail, ladder, lamp): size unknowable",
        "3 Mirrored left/right recipe: symmetry says decoration, not place"],
    3: ["1 Five identical gantry recipes per side: repetition without function",
        "2 Nothing moves: no barrier, scanner or traffic to show work",
        "3 Lit strips are thin lines: no signage a glance can read"],
    4: ["1 Ribbed walls at bay heights: a megastructure, not a yard",
        "2 Mover bars are the only motion and read as abstract shuttles",
        "3 Judge: 'nothing is moving... no people, vehicles' (M9)"],
    5: ["1 Buttress boxes and slit lights read as a city of blocks",
        "2 Heart motif sits under the lane floor: invisible in play",
        "3 Judge: 'abstract, untextured urban canyon' (H8)"],
}
font = ImageFont.load_default(size=22)
for s, lines in NOTES.items():
    im = Image.open(f"{D}/out/before-s{s}-desktop/mid.jpg").convert("RGB")
    d = ImageDraw.Draw(im)
    w, h = im.size
    for box in ((int(w * .02), int(h * .12), int(w * .27), int(h * .9)), (int(w * .73), int(h * .12), int(w * .98), int(h * .9))):
        d.rectangle(box, outline=(255, 196, 92), width=3)
    d.rectangle((0, h - 34 * len(lines) - 16, w, h), fill=(10, 10, 14))
    for i, line in enumerate(lines):
        d.text((18, h - 34 * len(lines) - 6 + i * 34), line, fill=(255, 220, 160), font=font)
    im.save(f"{D}/diagnosis-s{s}.jpg", quality=80)
