"""pickup_spread.glb and pickup_shield.glb. Original: 28 px diamond outlines,
green with three dots in a row (spread) or cyan with a small ring (shield);
both fall, spin and pulse. Here: one holographic diamond cage shared by
both, with a different heart.

- Spread: a data crystal sleeved in a flight-recorder casing. Its three
  emissive status dots are the original's three dots. This is the object
  that triggers the flashback: a memory you pick up.
- Shield: a ring core with a small spark at its center.

Both lie in the playfield plane; spin them about glTF Y. Cage spans 2.8
units point to point (28 px).
Nodes: pickup_spread > spread_cage, spread_crystal, spread_recorder, spread_dots
       pickup_shield > shield_cage, shield_ring, shield_core
Shared builder; run pickup_spread.py or pickup_shield.py (one per asset).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402


def cage(name, color, parent):
    octa = ([(1.4, 0, 0), (0, 1.4, 0), (-1.4, 0, 0), (0, -1.4, 0), (0, 0, 0.75), (0, 0, -0.75)],
            [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [1, 0, 5], [2, 1, 5], [3, 2, 5], [0, 3, 5]])
    o = c.obj(name, octa, c.emit(name, color, strength=4), parent)
    c.wireframe(o, 0.07)
    return o


def build_spread():
    c.reset()
    root = c.root("pickup_spread")
    cage("spread_cage", "mint", root)
    crystal = c.transform(c.bipyramid(0.5, 1.1, 1.1, 6), rot=(math.radians(-90), 0, 0))
    c.obj("spread_crystal", crystal, c.mat("spread_crystal", "#2a6b45", roughness=0.08,
                                            coat=1.0, emit="mint", strength=3), root)
    casing = c.mat("spread_casing", "#2b3038", metallic=0.9, roughness=0.3)
    sleeve = c.transform(c.cylinder(0.56, 0.5, 6), rot=(math.radians(90), 0, 0))
    c.bevel(c.obj("spread_recorder", sleeve, casing, root), 0.03)
    dot = c.cylinder(0.07, 0.06, 8, z0=0.0)
    dots = c.merge(*[c.transform(dot, loc=(x, 0, 0.49)) for x in (-0.2, 0.0, 0.2)])
    c.obj("spread_dots", dots, c.emit("spread_dots", "mint", strength=10), root)
    c.finish("pickup_spread", views=[(-35, 25), (40, 10), (130, 30), (0, 90)])


def build_shield():
    c.reset()
    root = c.root("pickup_shield")
    cage("shield_cage", "cyan", root)
    c.obj("shield_ring", c.torus(0.5, 0.09, 32, 8), c.emit("shield_ring", "cyan", strength=7),
          root, smooth=True)
    c.obj("shield_ring_frame", c.torus(0.5, 0.05, 32, 6, sx=1.0, sy=1.0), c.mat(
        "shield_frame", "#2b3038", metallic=0.9, roughness=0.3), root,
        rot=(math.radians(90), 0, 0), smooth=True)
    c.obj("shield_core", c.ico(0.16, 1), c.emit("shield_core", "pale_cyan", strength=12), root)
    c.finish("pickup_shield", views=[(-35, 25), (40, 10), (130, 30), (0, 90)])


if __name__ == "__main__":
    build_spread()
    build_shield()
