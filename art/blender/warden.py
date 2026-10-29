"""warden.glb: the Warden, rebuilt for the top-down read (wave 3).

Design: a guardian, not a monster. The heart silhouette is kept on purpose
(the "misunderstood guardian" turn: from above the player is shooting at a
heart). Modeled from the top orthographic view first, then given height in
stacked tiers that shadow each other, as the visual critique asked
(research/2026-10-28-critique-visual/, item 7).

Size: 19.2 units wide = 192 px = 40% of the playfield. 1 unit = 10 px.
Faces +Z in glTF (toward the player); the heart's tip points down-screen.

Gameplay positions match src/sim/tuning.ts exactly (Blender XY = playfield,
Blender -Y = sim +y, down-screen):
  core at the origin (WARDEN_CORE, radius 18 px),
  pod_0 fanPodL (-62, 0), pod_1 fanPodR (62, 0),
  pod_2 cannonPod (-26, 44), pod_3 spiralPod (26, 44), radius 14 px.

Nodes (children of `warden`):
  warden_base, warden_hull       the two lower tiers (dark bulwark, lacquer)
  armor > warden_plate_ul/ur/ll/lr  upper tier plates (renderer shrinks `armor`)
  warden_collar                  gold ring around the core well
  halo > warden_ring_outer, warden_ring_inner (pivots; spin halo.rotation.z)
  core                           the gold heart-light (pulse, hit flash)
  warden_seams > warden_seam_1, _2, _3  emissive seams, one tier per phase
                                 (material names warden_seam_<n>_emit)
  pod_0..pod_3                   weapon pods (pivots), each with a housing,
                                 barrels and an emissive lens; the renderer
                                 hides a pod when the sim breaks it
  warden_shield                  translucent shell; the renderer swaps in its
                                 fresnel shader and shows it while invulnerable
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("warden")

base_m = c.mat("warden_dark", "#120a10", metallic=0.7, roughness=0.42)
hull_m = c.mat("warden_hull", "#5a1022", metallic=0.3, roughness=0.38, coat=0.6)
lacquer = c.mat("warden_lacquer", "#c2203f", metallic=0.15, roughness=0.22, coat=1.0)
gold = c.mat("warden_gold", "#d8a93c", metallic=1.0, roughness=0.25)
steel = c.mat("warden_steel", "#3a3f4a", metallic=0.9, roughness=0.35)
lens_m = c.emit("warden_pod_lens", "crimson", strength=4)
core_m = c.emit("warden_core", "gold", strength=10)
shield_m = c.mat("warden_shield", "#ff4d6d", roughness=0.1, alpha=0.25)
seam_m = {n: c.emit(f"warden_seam_{n}", "crimson", strength=5) for n in (1, 2, 3)}


def heart(scale=1.0, n=72, dy=1.5):
    """Classic heart curve, 19.2 wide at scale 1, tip at -Y, CCW."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x * 0.6 * scale, (y * 0.6 + dy) * scale))
    # The curve runs clockwise; prism() wants CCW.
    return pts[::-1]


def ring_strip(outline, width, z0, z1):
    """A thin band riding along a closed outline (for seams and trims)."""
    return c.merge(*[c.strip(outline[i], outline[(i + 1) % len(outline)], width, z0, z1)
                     for i in range(len(outline))])


# Tier 0 and 1: dark bulwark below, lacquered hull above, each smaller.
c.bevel(c.obj("warden_base", c.prism(heart(1.0), -1.6, -0.6, top_scale=0.97), base_m, root),
        0.1, 2, angle=30)
c.bevel(c.obj("warden_hull", c.prism(heart(0.9), -0.6, 0.5, top_scale=0.95), hull_m, root),
        0.1, 2, angle=30)

# Tier 2: four lacquer plates, split by a cross-shaped gap through the core.
# Built by clipping the 0.78 heart to quadrants around the origin.
def clip(poly, keep):
    """Sutherland-Hodgman: clip a polygon to the half-plane keep(p) >= 0
    (keep is linear, so the crossing point is found by interpolation)."""
    out = []
    for i, cur in enumerate(poly):
        prev = poly[i - 1]
        kc, kp = keep(cur), keep(prev)
        if kc >= 0:
            if kp < 0:
                t = kp / (kp - kc)
                out.append((prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t))
            out.append(cur)
        elif kp >= 0:
            t = kp / (kp - kc)
            out.append((prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t))
    # Drop near-duplicate points: degenerate faces export NaN normals.
    clean = []
    for p in out:
        if not clean or abs(p[0] - clean[-1][0]) + abs(p[1] - clean[-1][1]) > 1e-3:
            clean.append(p)
    return clean


def quadrant(pts, sx, sy, gap=0.45):
    q = clip(pts, lambda p: p[0] * sx - gap)
    return clip(q, lambda p: p[1] * sy - gap)

armor = c.group("armor", root)
upper = heart(0.78)
for nm, sx, sy in (("warden_plate_ul", -1, 1), ("warden_plate_ur", 1, 1),
                   ("warden_plate_ll", -1, -1), ("warden_plate_lr", 1, -1)):
    c.bevel(c.obj(nm, c.prism(quadrant(upper, sx, sy), 0.5, 1.0, top_scale=0.93), lacquer, armor),
            0.06, 2, angle=30)

# Core well, gold collar, the core itself.
c.obj("warden_core_well", c.cylinder(2.5, 0.2, 48, z0=0.9), base_m, root)
c.obj("warden_collar", c.torus(2.55, 0.22, 64, 8), gold, root, loc=(0, 0, 1.1), smooth=True)
c.obj("core", c.ico(1.8, 3, sz=0.75), core_m, root, loc=(0, 0, 1.3), smooth=True)

# Halo rings: kept from the first model (the renderer spins `halo`).
halo = c.group("halo", root, loc=(0, 0, 1.9), rot=(math.radians(-90), 0, 0))
for nm, R, r, z in (("warden_ring_outer", 3.6, 0.14, 0.0), ("warden_ring_inner", 3.0, 0.1, 0.3)):
    piv = c.group(nm, halo, loc=(0, -z, 0), rot=(math.radians(90), 0, 0))
    # Broken rings (three arcs) read as a rotating gate from above.
    arcs = []
    for k in range(3):
        a0 = 2 * math.pi * k / 3 + 0.25
        for j in range(10):
            a = a0 + j * 0.16
            arcs.append(c.transform(c.box(0.42, r * 2.2, r * 2), loc=(R * math.cos(a), R * math.sin(a), 0),
                                    rot=(0, 0, a + math.pi / 2)))
    c.obj(nm + "_mesh", c.merge(*arcs), gold, piv)

# Seams: one heart-shaped seam per tier, plus radial seams for phase 3.
seams = c.group("warden_seams", root)
c.obj("warden_seam_1", ring_strip(heart(0.86, 60), 0.14, 0.48, 0.56), seam_m[1], seams)
c.obj("warden_seam_2", ring_strip(heart(0.66, 48), 0.12, 0.98, 1.06), seam_m[2], seams)
rad = []
for a in (30, 150, 210, 330, 270):
    t = math.radians(a)
    rad.append(c.strip((2.9 * math.cos(t), 2.9 * math.sin(t)), (6.0 * math.cos(t), 6.0 * math.sin(t)),
                       0.12, 1.0, 1.08))
c.obj("warden_seam_3", c.merge(*rad), seam_m[3], seams)

# Weapon pods at the sim's pod offsets. Fan pods: three short barrels in a
# spread; cannon: one long barrel; spiral: a rotary cluster.
PODS = (("pod_0", -6.2, 0.0, "fan"), ("pod_1", 6.2, 0.0, "fan"),
        ("pod_2", -2.6, -4.4, "cannon"), ("pod_3", 2.6, -4.4, "spiral"))
for nm, x, y, kind in PODS:
    piv = c.group(nm, root, loc=(x, y, 0.6))
    c.bevel(c.obj(nm + "_housing", c.prism(c.ngon(1.5, 8, math.pi / 8), 0.0, 1.1, top_scale=0.8),
                  steel, piv), 0.06, 1)
    c.obj(nm + "_ring", c.torus(1.35, 0.1, 32, 6), gold, piv, loc=(0, 0, 1.1), smooth=True)
    if kind == "fan":
        barrels = [c.transform(c.cylinder(0.16, 1.4, 10), loc=(0, 0, 0), rot=(math.radians(90), 0, math.radians(a)))
                   for a in (-22, 0, 22)]
    elif kind == "cannon":
        barrels = [c.transform(c.cylinder(0.32, 2.2, 12), rot=(math.radians(90), 0, 0))]
    else:
        barrels = [c.transform(c.cylinder(0.12, 1.3, 8), loc=(0.35 * math.cos(a), 0, 0.35 * math.sin(a)),
                               rot=(math.radians(90), 0, 0))
                   for a in [2 * math.pi * k / 6 for k in range(6)]]
    # Barrels point down-screen (Blender -Y), toward the player.
    c.obj(nm + "_barrels", c.merge(*barrels), steel, piv, loc=(0, -0.6, 0.55), smooth=True)
    c.obj(nm + "_lens", c.cylinder(0.55, 0.12, 16, z0=1.12), lens_m, piv)

# Shield shell: a flattened dome inside the footprint.
shell = c.obj("warden_shield", c.uv_sphere(1.0, 32, 12, sx=9.5, sy=8.6, sz=3.2), shield_m, root,
              loc=(0, 0.6, 0.2), smooth=True)
shell.hide_render = True  # exported, but kept out of the preview sheet

c.finish("warden", views=[(-30, 30), (60, 15), (160, 25), (0, 90)])
