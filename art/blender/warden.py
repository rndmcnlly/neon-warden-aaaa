"""warden.glb: the Warden, a guardian, not a monster. Original: 200 x 140 px
crimson crest (a downward heart or shield) with an inner ring (r 34 px), a
horizontal bar, and a pulsing gold core. Here: a lacquered crest-shaped
bulwark, a crimson crown along its top edge, two gold halo rings with lights
("the Warden's lights go dark, one ring at a time"), a sealed blast door
across a caged sun, and four armor plates that can break away by phase.
No eyes, no teeth: it reads as a badge or a shield, which is the point.

Faces +Z in glTF (toward the player); the crest tip points down-screen.
Width 20 x height 14 units, matching 200 x 140 px.

Nodes (all children of `warden`):
  warden_hull, warden_bulwark, warden_core_well, warden_trim, warden_crown,
  warden_crest_fin, warden_keel, warden_emitters, warden_muzzle,
  armor (group) > warden_plate_ul, _ur, _ll, _lr
      (phase breakaway: hide or fling them at phase 2 and 3),
  halo (pivot whose local Z points up: spin it with rotation.z) >
      warden_ring_outer, warden_ring_inner (pivots, local Z up after export;
      each holds a gold ring mesh and a *_lights mesh with its own emissive
      material, so rings can go dark one at a time),
  core (separate node, emissive gold: pulse and hit-flash this),
  warden_cage, warden_blast_door (pivot) with warden_blast_door_l/_r halves
      (slide apart along X to open).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("warden")

hull_m = c.mat("warden_hull", "#4a0c1d", metallic=0.3, roughness=0.4, coat=0.6)
lacquer = c.mat("warden_lacquer", "#c2203f", metallic=0.15, roughness=0.22, coat=1.0)
gold = c.mat("warden_gold", "#d8a93c", metallic=1.0, roughness=0.22)
dark = c.mat("warden_dark", "#120a10", metallic=0.7, roughness=0.42)
crimson = c.emit("warden_crimson", "crimson")
outer_lights = c.emit("warden_ring_outer_lights", "crimson", strength=8)
inner_lights = c.emit("warden_ring_inner_lights", "crimson", strength=8)
core_m = c.emit("warden_core", "gold", strength=12)

CORE = (0.0, 1.8)
crest = [(-10, 7), (-2.6, 7), (0, 5.7), (2.6, 7), (10, 7), (9.6, 1.0), (0, -7), (-9.6, 1.0)]

c.bevel(c.obj("warden_hull", c.prism(crest, -1.0, 0.6, top_scale=0.96), hull_m, root),
        0.12, 2, angle=30)
c.bevel(c.obj("warden_bulwark", c.prism([(x * 0.72, y * 0.72 + 0.4) for x, y in crest],
                                        -1.7, -0.9), dark, root), 0.08)
c.obj("warden_core_well", c.cylinder(4.0, 0.12, 48, z0=0.56), dark, root, loc=(*CORE, 0))

# Emissive trim: the crest outline inset, riding on the top surface.
cx = sum(p[0] for p in crest) / len(crest)
cy = sum(p[1] for p in crest) / len(crest)
inset = [(cx + (x - cx) * 0.9, cy + (y - cy) * 0.9) for x, y in crest]
c.obj("warden_trim", c.merge(*[c.strip(inset[i], inset[(i + 1) % len(inset)], 0.16, 0.58, 0.7)
                               for i in range(len(inset))]), crimson, root)

# Armor plates: four separate nodes so phases can shed them.
ul = [(-9.4, 6.5), (-2.9, 6.5), (-3.7, 5.0), (-4.6, 2.4), (-9.2, 1.9)]
ll = [(-9.0, 1.2), (-4.7, 1.7), (-3.6, -1.0), (-1.0, -2.9), (-0.6, -5.6)]
plates = {
    "warden_plate_ul": ul,
    "warden_plate_ur": [(-x, y) for x, y in ul],
    "warden_plate_ll": ll,
    "warden_plate_lr": [(-x, y) for x, y in ll],
}
armor = c.group("armor", root)  # the renderer shrinks this group as plates shed
for nm, pts in plates.items():
    c.bevel(c.obj(nm, c.prism(pts, 0.6, 1.05, top_scale=0.94), lacquer, armor), 0.07, 2, angle=30)

# Crimson crown: flat spikes along the top edge (reads top-down) and a
# vertical crest fin over the heart notch (reads in profile).
spikes = []
for x0, x1, tip in ((3.4, 5.4, (4.7, 9.0)), (6.6, 8.6, (8.4, 8.4))):
    spk = c.prism([(x0, 6.7), (x1, 6.7), tip], -0.4, 0.3, top_scale=0.85)
    spikes += [spk, c.mirror_part(spk)]
spikes.append(c.prism([(-1.2, 6.2), (1.2, 6.2), (0, 9.6)], -0.3, 0.4, top_scale=0.85))
c.bevel(c.obj("warden_crown", c.merge(*spikes), lacquer, root), 0.05, 1)
fin = c.transform(c.prism([(5.4, 0.0), (8.2, 0.0), (9.4, 1.6), (6.4, 2.2)], -0.12, 0.12),
                  rot=(math.radians(90), 0, math.radians(90)))
c.bevel(c.obj("warden_crest_fin", fin, gold, root, loc=(0, 0, 0.5)), 0.03)

# Gold keel down the lower tip, side emitters, and the fan muzzle at the tip.
c.bevel(c.obj("warden_keel", c.prism([(-0.35, -2.4), (0.35, -2.4), (0.25, -6.2), (0, -6.6),
                                      (-0.25, -6.2)], 0.5, 0.9, top_scale=0.7), gold, root), 0.03)
housing = c.transform(c.cylinder(0.55, 0.9, 12, z0=0.3), loc=(9.0, 1.4, 0))
lens = c.transform(c.cylinder(0.36, 0.12, 12, z0=1.2), loc=(9.0, 1.4, 0))
c.obj("warden_emitter_housings", c.merge(housing, c.mirror_part(housing)), gold, root,
      smooth=True)
c.obj("warden_emitters", c.merge(lens, c.mirror_part(lens)), crimson, root)
c.obj("warden_muzzle", c.ico(0.4, 1), crimson, root, loc=(0, -6.3, 0.7))

# Halo rings. The renderer spins `halo` with three.js rotation.z, so the
# pivot is tipped -90 deg about X (its local Z points up, glTF +Y) and each
# ring is tipped back to lie flat. Each ring is also its own pivot, so rings
# can turn (or go dark) independently.
halo = c.group("halo", root, loc=(*CORE, 1.2), rot=(math.radians(-90), 0, 0))
for nm, R, r, n, lights_m, z in (("warden_ring_outer", 3.6, 0.17, 12, outer_lights, 0.0),
                                 ("warden_ring_inner", 2.75, 0.12, 8, inner_lights, 0.4)):
    piv = c.group(nm, halo, loc=(0, -z, 0), rot=(math.radians(90), 0, 0))
    c.obj(nm + "_mesh", c.torus(R, r, 56, 8), gold, piv, smooth=True)
    stud = c.box(0.3, 0.3, 0.16, (R, 0, r + 0.02))
    c.obj(nm + "_lights", c.merge(*[c.transform(stud, rot=(0, 0, 2 * math.pi * i / n))
                                    for i in range(n)]), lights_m, piv)

# The caged sun: core sphere, meridian cage, sealed blast door across it.
c.obj("core", c.ico(1.5, 3), core_m, root, loc=(*CORE, 1.4), smooth=True)
cage = [c.transform(c.torus(1.75, 0.07, 32, 6), rot=(math.radians(90), 0, math.radians(a)))
        for a in (0, 60, 120)]
c.obj("warden_cage", c.merge(*cage), gold, root, loc=(*CORE, 1.4), smooth=True)
door = c.group("warden_blast_door", root, loc=(*CORE, 3.15))
half_door = c.prism([(0.05, -0.45), (3.3, -0.45), (3.55, 0.0), (3.3, 0.45), (0.05, 0.45)],
                    -0.18, 0.18, top_scale=0.94)
c.bevel(c.obj("warden_blast_door_r", half_door, lacquer, door), 0.04)
c.bevel(c.obj("warden_blast_door_l", c.mirror_part(half_door), lacquer, door), 0.04)
c.obj("warden_blast_door_seam", c.box(0.1, 0.92, 0.1, (0, 0, 0.16)), crimson, door)

c.finish("warden", views=[(-30, 30), (60, 15), (160, 25), (0, 90)])
