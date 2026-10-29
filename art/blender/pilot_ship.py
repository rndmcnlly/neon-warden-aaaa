"""pilot_ship.glb: the contractor's interceptor. Original: 48 px cyan kite /
arrowhead outline with a white cockpit dot. Here: a delta-wing hull that keeps
that kite silhouette from the top-down camera, with canards, a gimballed
thrust ring, a canopy, and a glowing core gem marking the 6 px hitbox.

Nose points -Z in glTF (up the screen). Bank by rotating the root about its
forward axis. Nodes: pilot_ship (root), ship_hull, ship_spine, ship_canopy,
ship_canards, ship_trim, ship_nozzle, ship_thrust_ring (pivot for gimbal),
engine (the emissive exhaust disk; the renderer pulses it by this name), ship_core_gem (hitbox marker,
radius 0.6 = 6 px).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("pilot_ship")

hull_m = c.mat("ship_carbon", "#1d2533", metallic=0.45, roughness=0.3, coat=0.8)
plate_m = c.mat("ship_plate", "#c9d6e3", metallic=0.7, roughness=0.28)
dark_m = c.mat("ship_dark", "#0d1118", metallic=0.6, roughness=0.45)
glass_m = c.mat("ship_glass", "#0a2a36", metallic=0.0, roughness=0.05, coat=1.0,
                alpha=0.55, transmission=0.6)
cyan = c.emit("ship_cyan", "cyan")
gem_m = c.emit("ship_core", "pale_cyan", strength=12)

# Half outline (x >= 0) of the kite, nose at +Y. Mirrored for the full hull.
half = [(0.0, 2.7), (0.42, 1.5), (0.7, 0.4), (2.45, -1.35), (2.35, -1.85),
        (0.95, -1.25), (0.55, -2.0), (0.0, -1.7)]
outline = half + [(-x, y) for x, y in reversed(half[1:-1])]
hull = c.obj("ship_hull", c.prism(outline, -0.18, 0.18, top_scale=0.93), hull_m, root)
c.bevel(hull, 0.06, 2, angle=30)

# Raised spine from canopy to engine.
spine_out = [(0.0, 2.2), (0.32, 1.2), (0.42, -0.2), (0.38, -1.6), (-0.38, -1.6),
             (-0.42, -0.2), (-0.32, 1.2)]
spine = c.obj("ship_spine", c.prism(spine_out[::-1], 0.1, 0.42, top_scale=0.72),
              plate_m, root)
c.bevel(spine, 0.04, 2, angle=30)

# Canopy: stretched half-dome over the spine's front.
c.obj("ship_canopy", c.uv_sphere(0.3, 16, 8, sx=1.0, sy=2.6, sz=0.9), glass_m, root,
      loc=(0, 0.95, 0.42), smooth=True)
c.obj("ship_seat", c.box(0.26, 0.3, 0.3, (0, 0.6, 0.45)), dark_m, root)

# Canards: small swept plates either side of the nose.
canard = c.prism([(0.38, 1.25), (1.05, 0.85), (1.05, 0.65), (0.45, 0.75)], 0.1, 0.17)
canards = c.obj("ship_canards", c.merge(canard, c.mirror_part(canard)), plate_m, root)
c.bevel(canards, 0.02)

# Wing armor plates (lighter panels inset on top of the carbon hull).
wplate = c.prism([(0.75, 0.0), (2.05, -1.25), (1.0, -1.05), (0.7, -0.5)], 0.16, 0.22)
wp = c.obj("ship_wing_plates", c.merge(wplate, c.mirror_part(wplate)), plate_m, root)
c.bevel(wp, 0.015)

# Emissive trim along the wing leading edges and wingtip lights.
le = c.strip((0.46, 1.45), (2.4, -1.35), 0.07, 0.12, 0.2)
tip = c.box(0.12, 0.42, 0.12, (2.38, -1.6, 0.02))
c.obj("ship_trim", c.merge(le, c.mirror_part(le), tip, c.mirror_part(tip)), cyan, root)

# Engine: nozzle at the tail, gimbal ring around it, emissive glow disk.
c.obj("ship_nozzle", c.transform(c.cylinder(0.34, 0.6, 16, r_top=0.26),
                                 loc=(0, -1.8, 0.18), rot=(math.radians(90), 0, 0)),
      dark_m, root, smooth=True)
gimbal = c.group("ship_thrust_ring", root, loc=(0, -1.95, 0.18))
c.obj("ship_thrust_ring_mesh", c.torus(0.46, 0.06, 24, 6), plate_m, gimbal,
      rot=(math.radians(90), 0, 0), smooth=True)
c.obj("engine", c.transform(c.cylinder(0.27, 0.05, 16), rot=(math.radians(90), 0, 0)),
      cyan, root, loc=(0, -2.12, 0.18))

# Hitbox core gem: radius 0.6 (6 px) in the original; this is the visible marker.
c.obj("ship_core_gem", c.ico(0.22, 1, sz=0.7), gem_m, root, loc=(0, -0.35, 0.5))

c.finish("pilot_ship", views=[(-35, 25), (60, 20), (160, 25), (180, 90)])
