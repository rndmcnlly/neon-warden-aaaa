"""drone.glb: the Warden's scout pod. Original: 36 px pink ellipse ring
(28 x 16 px) around a solid pink core dot. Here: a gunmetal pod with a
glowing eye inside a flattened ring, so the swarm reads as surveillance.

Faces +Z in glTF (toward the player). Nodes: drone (root), drone_body,
drone_ring, drone_ring_trim, drone_eye (emissive, flash it on hit), drone_fins.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("drone")

gunmetal = c.mat("drone_gunmetal", "#3a4150", metallic=0.85, roughness=0.32, coat=0.3)
dark = c.mat("drone_dark", "#151820", metallic=0.6, roughness=0.5)
pink = c.emit("drone_pink", "pink")
eye_m = c.emit("drone_eye", "pink", strength=10)

# Pod: a flattened sphere, slightly longer front to back.
c.obj("drone_body", c.uv_sphere(0.62, 16, 10, sx=1.0, sy=1.1, sz=0.62), gunmetal,
      root, smooth=True)
# Eye: socket ring plus emissive lens on the front-top, visible top-down.
c.obj("drone_eye_socket", c.torus(0.3, 0.07, 16, 6), dark, root,
      loc=(0, -0.42, 0.22), rot=(math.radians(62), 0, 0), smooth=True)
c.obj("drone_eye", c.uv_sphere(0.26, 12, 8), eye_m, root,
      loc=(0, -0.4, 0.22), smooth=True)

# Ring: 28 x 16 px ellipse -> 2.8 x 1.6 units outer, lying in the playfield plane.
c.obj("drone_ring", c.torus(1.2, 0.13, 40, 8, sx=1.15, sy=0.62), gunmetal, root,
      smooth=True)
c.obj("drone_ring_trim", c.torus(1.2, 0.05, 40, 6, sx=1.15, sy=0.62), pink, root,
      loc=(0, 0, 0.11), smooth=True)

# Struts tying ring to pod (left and right), and twin stabilizer fins at the back.
strut = c.strip((0.5, 0), (1.3, 0), 0.14, -0.05, 0.07)
c.obj("drone_struts", c.merge(strut, c.mirror_part(strut)), dark, root)
fin = c.prism([(0.12, 0.45), (0.22, 0.45), (0.3, 1.05), (0.2, 1.05)], 0.05, 0.42,
              top_scale=0.7)
fins = c.obj("drone_fins", c.merge(fin, c.mirror_part(fin)), gunmetal, root)
c.bevel(fins, 0.02)

c.finish("drone")
