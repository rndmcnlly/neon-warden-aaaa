"""Studio and incubator logos for the boot sequence. Shared builder; run
logo_adamsmith_systems.py or logo_cm121.py (one per asset).

Both stand upright facing +Z in glTF (toward a camera on +Z), centered on
the origin, about 12 units wide. Text is Orbitron (OFL, fonts/OFL.txt), the
original game's title face, converted to meshes. Parts are separate nodes so
the renderer can stagger their reveal.

logo_adamsmith_systems > ass_emblem (steel hex frame), ass_emblem_glow
    (emissive cyan inner hex), ass_glyph (chevron monogram), ass_wordmark,
    ass_underline (emissive cyan)
logo_cm121 > cm_plate, cm_plate_rim (emissive pink), cm_wordmark,
    cm_cohort_badge, cm_cohort_text (emissive gold "f26 COHORT"),
    cm_tagline
"""

import math
import os
import sys

from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

UP = (math.radians(90), 0, 0)  # XY layout plane -> facing Blender -Y (glTF +Z)
VIEWS = [(0, 0), (-35, 10), (35, 20), (-70, 5)]


def up(part, loc=(0, 0, 0)):
    """Lay out in XY (y = screen up), then stand the part up."""
    x, y, z = loc
    return c.transform(c.transform(part, loc=(x, y, z)), rot=UP)


def text(name, body, size, mat, parent, loc=(0, 0, 0), **kw):
    me = c.text_mesh(name, body, size=size, **kw)
    me.transform(Matrix.Rotation(math.radians(90), 4, "X") @ Matrix.Translation(loc))
    return c.obj(name, me, mat, parent)


def build_adamsmith_systems():
    c.reset()
    root = c.root("logo_adamsmith_systems")
    steel = c.mat("ass_steel", "#c6d2df", metallic=0.95, roughness=0.18)
    ice = c.mat("ass_ice", "ice", metallic=0.2, roughness=0.3, coat=1.0)
    cyan = c.emit("ass_cyan", "cyan", strength=7)

    hexo = c.ngon(1.9, 6, phase=math.radians(90))
    hexi = c.ngon(1.6, 6, phase=math.radians(90))
    frame = [c.strip(hexo[i], hexo[(i + 1) % 6], 0.26, -0.15, 0.15) for i in range(6)]
    glow = [c.strip(hexi[i], hexi[(i + 1) % 6], 0.07, -0.05, 0.12) for i in range(6)]
    oy = 1.9  # emblem center above the wordmark
    c.bevel(c.obj("ass_emblem", up(c.merge(*frame), (0, oy, 0)), steel, root), 0.03)
    c.obj("ass_emblem_glow", up(c.merge(*glow), (0, oy, 0)), cyan, root)
    # Monogram: an upward chevron (the a) over a split bar (the s), echoing the ship.
    chev = c.prism([(0, 0.95), (0.85, -0.55), (0.5, -0.55), (0, 0.32), (-0.5, -0.55),
                    (-0.85, -0.55)], -0.12, 0.18, top_scale=0.95)
    bar = c.merge(c.box(0.55, 0.16, 0.26, (-0.38, -0.85, 0.03)),
                  c.box(0.55, 0.16, 0.26, (0.38, -0.95, 0.03)))
    c.bevel(c.obj("ass_glyph", up(c.merge(chev, bar), (0, oy, 0)), ice, root), 0.02)

    text("ass_wordmark", "adamsmith.systems", 0.78, ice, root, loc=(0, -0.65, 0),
         extrude=0.1, bevel_depth=0.012)
    c.obj("ass_underline", up(c.box(8.2, 0.06, 0.08, (0, -1.25, 0))), cyan, root)
    c.finish("logo_adamsmith_systems", views=VIEWS)


def build_cm121():
    c.reset()
    root = c.root("logo_cm121")
    plate_m = c.mat("cm_plate", "#140f26", metallic=0.6, roughness=0.3, coat=1.0)
    white = c.mat("cm_white", "#f2f0f7", metallic=0.3, roughness=0.25, coat=1.0)
    pink = c.emit("cm_pink", "pink", strength=7)
    gold_m = c.mat("cm_gold", "#d8a93c", metallic=1.0, roughness=0.22)
    gold = c.emit("cm_gold", "gold", strength=8)

    # Chamfered plate behind the wordmark.
    w, h, k = 5.6, 1.9, 0.45
    plate = [(-w, -h + k), (-w + k, -h), (w - k, -h), (w, -h + k), (w, h - k), (w - k, h),
             (-w + k, h), (-w, h - k)]
    c.bevel(c.obj("cm_plate", up(c.prism(plate, -0.3, 0.0, top_scale=0.98)), plate_m, root), 0.04)
    ins = [(x * 0.965, y * 0.9) for x, y in plate]
    c.obj("cm_plate_rim", up(c.merge(*[c.strip(ins[i], ins[(i + 1) % 8], 0.07, -0.02, 0.06)
                                       for i in range(8)])), pink, root)
    text("cm_wordmark", "CM121", 2.1, white, root, loc=(0, 0.12, 0.0), extrude=0.16,
         bevel_depth=0.02, spacing=1.15)
    text("cm_tagline", "INCUBATOR", 0.42, white, root, loc=(0, -1.35, 0.0), extrude=0.04,
         bevel_depth=0.005, spacing=1.6)

    # Cohort badge: a gold hex medallion hanging off the upper right corner.
    bx, by = 5.4, 1.85
    c.bevel(c.obj("cm_cohort_badge", up(c.prism(c.ngon(1.05, 6), -0.05, 0.22, top_scale=0.92),
                                        (bx, by, 0)), gold_m, root), 0.03)
    text("cm_cohort_text", "f26", 0.62, gold, root, loc=(bx, by + 0.12, 0.25), extrude=0.04,
         bevel_depth=0.004)
    text("cm_cohort_label", "COHORT", 0.2, gold, root, loc=(bx, by - 0.38, 0.25), extrude=0.03,
         bevel_depth=0.0, spacing=1.3)
    c.finish("logo_cm121", views=VIEWS)


if __name__ == "__main__":
    build_adamsmith_systems()
    build_cm121()
