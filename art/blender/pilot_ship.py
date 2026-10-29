"""pilot_ship.glb: the contractor's interceptor. Original: 48 px cyan kite /
arrowhead outline with a white cockpit dot. Here: a delta-wing hull that keeps
that kite silhouette from the top-down camera, with canards, a gimballed
thrust ring, a canopy, and a glowing core gem marking the 6 px hitbox.

Nose points -Z in glTF (up the screen). Bank by rotating the root about its
forward axis. Nodes: pilot_ship (root), ship_hull, ship_spine, ship_canopy,
ship_canards, ship_trim, ship_nozzle, ship_thrust_ring (pivot for gimbal),
engine (the emissive exhaust disk; the renderer pulses it by this name), ship_core_gem (hitbox marker,
radius 0.6 = 6 px).

Customization (wave 3, read by src/render/loadout.ts):
- Materials the renderer recolors per loadout: `ship_paint` (the light
  panels: spine, canards, wing plates), `ship_trim_emit` (trim color),
  `ship_engine_emit` (trail color). The carbon hull stays dark: it is the
  value contrast that makes any paint read.
- Sockets: `socket_weapon` holds `weapon_<id>` and `socket_sensor` holds
  `sensor_<id>` for every package id in src/contracts/loadout.ts, all
  exported; the renderer shows one of each. `ship_decals` holds
  `decal_<id>` (lowercased DecalId; `decal_none` is an empty).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("pilot_ship")

hull_m = c.mat("ship_carbon", "#1d2533", metallic=0.45, roughness=0.3, coat=0.8)
plate_m = c.mat("ship_paint", "#d8dde4", metallic=0.35, roughness=0.32, coat=0.5)
dark_m = c.mat("ship_dark", "#0d1118", metallic=0.6, roughness=0.45)
glass_m = c.mat("ship_glass", "#0a2a36", metallic=0.0, roughness=0.05, coat=1.0,
                alpha=0.55, transmission=0.6)
cyan = c.emit("ship_trim", "cyan", strength=3)
engine_m = c.emit("ship_engine", "cyan", strength=8)
gun_m = c.mat("ship_gunmetal", "#2a2f38", metallic=0.9, roughness=0.3)
sensor_m = c.emit("ship_sensor", "pale_cyan", strength=3)
decal_m = c.mat("ship_decal", "#101318", roughness=0.6)
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
      engine_m, root, loc=(0, -2.12, 0.18))

# Hitbox core gem: radius 0.6 (6 px) in the original; this is the visible marker.
c.obj("ship_core_gem", c.ico(0.22, 1, sz=0.7), gem_m, root, loc=(0, -0.35, 0.5))

# ---- weapon packages (socket under the wing roots) ---------------------------
FWD = (math.radians(-90), 0, 0)  # cylinders along +Y (forward)
sw = c.group("socket_weapon", root)


def pair(part):
    return c.merge(part, c.mirror_part(part))


def barrel(r, length, x, y, z, n=8):
    return c.transform(c.cylinder(r, length, n), loc=(x, y, z), rot=FWD)


# standard: two short wing guns.
c.obj("weapon_standard", pair(c.merge(barrel(0.09, 0.9, 1.0, 0.1, -0.05),
                                      c.box(0.26, 0.5, 0.18, (1.0, -0.35, -0.05)))), gun_m, sw)
# magistrate: one heavy centerline cannon under the nose (a slow, hard Writ).
c.obj("weapon_magistrate", c.merge(barrel(0.2, 2.2, 0, 0.3, -0.3, 12),
                                   c.box(0.6, 0.9, 0.32, (0, -0.6, -0.3))), gun_m, sw)
# courier: twin rotary clusters (fast stream).
rot = [barrel(0.05, 1.1, 1.2 + 0.1 * math.cos(a), -0.1, -0.05 + 0.1 * math.sin(a), 6)
       for a in [2 * math.pi * k / 4 for k in range(4)]]
c.obj("weapon_courier", pair(c.merge(*rot, c.box(0.34, 0.4, 0.3, (1.2, -0.6, -0.05)))), gun_m, sw)
# notary: long thin precision rails beside the spine.
c.obj("weapon_notary", pair(c.box(0.08, 2.6, 0.08, (0.55, 0.3, 0.3))), gun_m, sw)
# injunction (beyond the slice): bulky twin launchers.
c.obj("weapon_injunction", pair(c.box(0.5, 1.4, 0.4, (1.45, -0.4, -0.1))), gun_m, sw)

# ---- sensor packages (socket on the nose and spine) ---------------------------
ss = c.group("socket_sensor", root)
# standard: a small nose dome.
c.obj("sensor_standard", c.uv_sphere(0.16, 10, 5, sz=0.6), sensor_m, ss, loc=(0, 2.25, 0.2))
# surveyor: a wide flat fan dish (wide cone, patient lock).
c.obj("sensor_surveyor", c.merge(c.prism([(-0.7, 2.0), (0.7, 2.0), (0.25, 2.5), (-0.25, 2.5)], 0.2, 0.26),
                                 c.box(0.1, 0.4, 0.1, (0, 1.8, 0.24))), sensor_m, ss)
# auditor: a long narrow spike (narrow cone, fast lock).
c.obj("sensor_auditor", c.transform(c.cone(0.07, 1.2, 8), loc=(0, 2.5, 0.1), rot=FWD), sensor_m, ss)
# archivist: a dorsal mast with a ring (long reach).
c.obj("sensor_archivist", c.merge(c.cylinder(0.04, 0.7, 6, z0=0.4),
                                  c.transform(c.torus(0.22, 0.03, 16, 4), loc=(0, 0, 1.1),
                                              rot=(math.radians(90), 0, 0))),
      sensor_m, ss, loc=(0, -0.6, 0))
# witness (beyond the slice): a twin-eye array.
c.obj("sensor_witness", pair(c.uv_sphere(0.14, 8, 4, sz=0.7)), sensor_m, ss, loc=(0, 1.6, 0.36))

# ---- decals (on the wing plates) ----------------------------------------------
dec = c.group("ship_decals", root)
c.group("decal_none", dec)
Z0, Z1 = 0.22, 0.235
# authorityNumber: four serial bars on the left wing.
c.obj("decal_authoritynumber", c.merge(*[c.box(0.07, 0.36, Z1 - Z0, (-1.0 - 0.15 * i, -0.55 - 0.12 * i, Z0 + 0.007))
                                         for i in range(4)]), decal_m, dec)
# tallyMarks: four strokes and a cross stroke on the right wing.
tally = [c.box(0.05, 0.4, Z1 - Z0, (1.0 + 0.12 * i, -0.6, Z0 + 0.007)) for i in range(4)]
tally.append(c.transform(c.box(0.05, 0.62, Z1 - Z0, (0, 0, 0)), loc=(1.18, -0.6, Z0 + 0.012),
                         rot=(0, 0, math.radians(60))))
c.obj("decal_tallymarks", c.merge(*tally), decal_m, dec)
# wardenCrest: a small heart on the right wing (a contractor's trophy, or a confession).
hp = []
for i in range(24):
    t = 2 * math.pi * i / 24
    hp.append((1.25 + 0.016 * 16 * math.sin(t) ** 3,
               -0.6 + 0.016 * (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))))
c.obj("decal_wardencrest", c.prism(hp[::-1], Z0, Z1), decal_m, dec)
# payGrade: three chevrons down the spine.
chev = [c.prism([(-0.3, y), (0, y + 0.18), (0.3, y), (0.3, y - 0.07), (0, y + 0.11), (-0.3, y - 0.07)],
                0.42, 0.44) for y in (-0.4, -0.65, -0.9)]
c.obj("decal_paygrade", c.merge(*chev), decal_m, dec)

# The preview sheet shows the default loadout; every variant still exports.
DEFAULTS = {"weapon_standard", "sensor_standard", "decal_authoritynumber"}
for sock in (sw, ss, dec):
    for o in sock.children:
        o.hide_render = o.name not in DEFAULTS

c.finish("pilot_ship", views=[(-35, 25), (60, 20), (160, 25), (180, 90)])
