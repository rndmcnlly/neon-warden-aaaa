"""dart.glb: kamikaze lancet. Original: 36 x 40 px amber downward chevron.
Here: a narrow swept blade with an exposed thruster and no weapon at all
(its gun is commented out in the original source; it is visibly unarmed).

Faces +Z in glTF (dives toward the player). Nodes: dart (root), dart_blade,
dart_spine, dart_trim, dart_nozzle (housing), thruster (emissive exhaust disk; the
renderer flares it by this name at tick 50, when the dart commits).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("dart")

amber_m = c.mat("dart_anodized", "#a8661a", metallic=0.9, roughness=0.33, coat=0.2)
dark_m = c.mat("dart_dark", "#1a1410", metallic=0.6, roughness=0.5)
amber = c.emit("dart_amber", "amber")
glow = c.emit("dart_thruster_glow", "amber", strength=9)

# Chevron pointing down the screen (Blender -Y): tip, swept wings, rear notch.
chev = [(0.0, -2.0), (1.8, 1.4), (1.35, 1.75), (0.0, 0.45), (-1.35, 1.75), (-1.8, 1.4)]
blade = c.obj("dart_blade", c.prism(chev, -0.1, 0.1, top_scale=0.9, top_offset=(0, -0.05)),
              amber_m, root)
c.bevel(blade, 0.04, 2, angle=30)

spine = [(0.0, -1.7), (0.22, 0.2), (0.18, 1.0), (-0.18, 1.0), (-0.22, 0.2)]
s = c.obj("dart_spine", c.prism(spine, 0.05, 0.32, top_scale=0.6), dark_m, root)
c.bevel(s, 0.03)

edge = c.strip((0.05, -1.95), (1.78, 1.38), 0.06, 0.06, 0.14)
c.obj("dart_trim", c.merge(edge, c.mirror_part(edge)), amber, root)

# Exposed thruster at the back of the spine (nozzle points up-screen, +Y).
c.obj("dart_nozzle", c.transform(c.cylinder(0.22, 0.6, 12, r_top=0.28),
                                   loc=(0, 1.15, 0.2), rot=(math.radians(-90), 0, 0)),
      dark_m, root, smooth=True)
c.obj("thruster", c.transform(c.cylinder(0.22, 0.04, 12),
                                        rot=(math.radians(90), 0, 0)),
      glow, root, loc=(0, 1.47, 0.2))

c.finish("dart")
