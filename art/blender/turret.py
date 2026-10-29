"""turret.glb: orbital gun platform. Original: 48 px violet hexagon with a
white core, slowly rotating. Here: an armored hexagonal drum on three
stabilizer legs, a six-barrel crown that rotates independently, and a white
reactor core.

Faces +Z in glTF. Nodes: turret (root), turret_drum, turret_trim,
turret_legs (deploy on arrival), crown (pivot: the renderer spins it about Y),
turret_crown_ring, turret_barrels, turret_core (emissive white, flash on hit).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("turret")

ceramic = c.mat("turret_ceramic", "#5a479a", metallic=0.0, roughness=0.62, coat=0.15)
steel = c.mat("turret_steel", "#2a2638", metallic=0.85, roughness=0.35)
violet = c.emit("turret_violet", "violet")
core_m = c.emit("turret_core", "ice", strength=12)

hexo = c.ngon(2.2, 6, phase=math.radians(30))
drum = c.obj("turret_drum", c.prism(hexo, -0.45, 0.35, top_scale=0.86), ceramic, root)
c.bevel(drum, 0.08, 2, angle=30)
skirt = c.obj("turret_skirt", c.prism(c.ngon(1.7, 6, phase=math.radians(30)), -0.8, -0.4,
                                       top_scale=1.15), steel, root)
c.bevel(skirt, 0.04)

# Trim: emissive band around the drum's upper rim, one strip per hex edge.
h2 = c.ngon(2.08, 6, phase=math.radians(30))
c.obj("turret_trim", c.merge(*[c.strip(h2[i], h2[(i + 1) % 6], 0.08, 0.3, 0.38)
                                for i in range(6)]), violet, root)

# Three stabilizer legs folded under the drum.
leg = c.prism([(1.2, -0.2), (2.6, -0.12), (2.6, 0.12), (1.2, 0.2)], -0.95, -0.7,
              top_scale=0.9)
legs = c.merge(*[c.transform(leg, rot=(0, math.radians(8), math.radians(a)))
                 for a in (90, 210, 330)])
c.bevel(c.obj("turret_legs", legs, steel, root), 0.03)

# Crown: a pivot empty so the renderer can spin it about glTF Y.
crown = c.group("crown", root, loc=(0, 0, 0.35))
c.bevel(c.obj("turret_crown_ring", c.prism(c.ngon(1.25, 12), 0.0, 0.32, top_scale=0.85),
              steel, crown), 0.03)
barrel = c.transform(c.cylinder(0.11, 1.1, 8), loc=(1.55, 0, 0.18),
                     rot=(0, math.radians(90), 0))
muzzle = c.transform(c.cylinder(0.15, 0.18, 8), loc=(2.12, 0, 0.18),
                     rot=(0, math.radians(90), 0))
barrels = c.merge(*[c.transform(c.merge(barrel, muzzle), rot=(0, 0, math.radians(60 * i)))
                    for i in range(6)])
c.obj("turret_barrels", barrels, steel, crown, smooth=False)

c.obj("turret_core", c.ico(0.55, 2, sz=0.8), core_m, root, loc=(0, 0, 0.8), smooth=True)
c.obj("turret_core_cage", c.torus(0.62, 0.06, 20, 6), violet, root, loc=(0, 0, 0.75))

c.finish("turret")
