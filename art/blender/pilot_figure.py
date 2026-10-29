"""pilot_figure.glb: the contractor, for cutscenes and menus. A lone gun for
hire whose face is never seen. Original helmet design (not a T-visor): a
rounded, faceted shell with a swept dorsal ridge, side comm pods and a
downward-chevron visor, the same shape as the ship's nose and, quietly, the
Warden's crest. The visor is opaque dark glass; only a thin cyan line along
its brow glows. Ceramic armor, not polished metal; a weathered half-cape.

Authored in meters (1.8 tall, feet at the origin), unlike the gameplay
assets. Faces +Z in glTF. Static pose, no rig: bob or turn the root.
Nodes: pilot_figure (root), pilot_helmet (pivot at the neck: tilt it for a
nod), pilot_helmet_shell, pilot_helmet_ridge, pilot_helmet_pods, pilot_visor,
pilot_faceplate, pilot_visor_line (emissive), pilot_rebreather, pilot_gorget, pilot_body, pilot_armor,
pilot_cape, pilot_bracer_light (emissive), pilot_chest_light (emissive),
pilot_sidearm.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

c.reset()
root = c.root("pilot_figure")

armor = c.mat("pilot_armor", "#4a505c", metallic=0.15, roughness=0.55, coat=0.2)
suit = c.mat("pilot_suit", "#1d1b24", metallic=0.0, roughness=0.8)
cloth = c.mat("pilot_cloth", "#5b3e2d", metallic=0.0, roughness=0.92)
leather = c.mat("pilot_leather", "#2e2420", metallic=0.0, roughness=0.65)
paint = c.mat("pilot_paint", "#b8682c", metallic=0.1, roughness=0.6)
visor_m = c.mat("pilot_visor", "#05070a", metallic=0.4, roughness=0.06, coat=1.0)
gun_m = c.mat("pilot_gunmetal", "#23262c", metallic=0.85, roughness=0.35)
cyan = c.emit("pilot_cyan", "cyan", strength=8)

R = math.radians


def limb(r0, r1, length, n=8):
    return c.cylinder(r0, length, n, r_top=r1, z0=0.0)


# ---- body (suit) -----------------------------------------------------------
parts = []
for s in (1, -1):
    x = 0.11 * s
    parts += [
        c.transform(limb(0.065, 0.075, 0.42), loc=(x, 0, 0.1)),                 # shin
        c.transform(limb(0.08, 0.095, 0.42), loc=(x, 0, 0.5)),                  # thigh
        c.transform(limb(0.05, 0.055, 0.3), loc=(0.23 * s, 0, 1.12),
                    rot=(0, R(180 - 8 * s), 0)),                                # upper arm
        c.transform(limb(0.04, 0.05, 0.28), loc=(0.27 * s, -0.02, 0.84),
                    rot=(R(-8), R(180 - 4 * s), 0)),                            # forearm
    ]
parts.append(c.prism([(-0.17, -0.09), (0.17, -0.09), (0.19, 0.08), (-0.19, 0.08)], 0.9, 1.44,
                     top_scale=1.15))                                           # torso
c.obj("pilot_body", c.merge(*parts), suit, root, smooth=True)

# ---- armor plates (ceramic) -------------------------------------------------
a = []
for s in (1, -1):
    a += [
        c.box(0.11, 0.22, 0.1, (0.11 * s, -0.04, 0.05)),                        # boot
        c.box(0.1, 0.06, 0.24, (0.11 * s, -0.07, 0.3)),                         # shin guard
        c.box(0.11, 0.05, 0.08, (0.11 * s, -0.09, 0.53)),                       # knee
        c.box(0.1, 0.05, 0.22, (0.11 * s, -0.09, 0.73)),                        # thigh plate
        c.transform(c.box(0.09, 0.1, 0.06, (0, 0, 0)), loc=(0.29 * s, -0.025, 0.6)),  # hand
        c.transform(limb(0.058, 0.062, 0.16), loc=(0.275 * s, -0.022, 0.82),
                    rot=(R(-8), R(180 - 4 * s), 0)),                            # bracer
    ]
a.append(c.prism([(-0.16, -0.11), (0.16, -0.11), (0.13, -0.02), (-0.13, -0.02)], 1.12, 1.42,
                 top_scale=1.08))                                               # chest plate
a.append(c.prism([(-0.14, -0.1), (0.14, -0.1), (0.1, -0.03), (-0.1, -0.03)], 0.98, 1.1))  # abdomen
a.append(c.transform(c.uv_sphere(0.11, 12, 6, sx=1.0, sy=0.9, sz=0.65), loc=(-0.23, 0, 1.4)))
pauldron_r = c.transform(c.uv_sphere(0.1, 12, 6, sx=1.0, sy=0.9, sz=0.6), loc=(0.23, 0, 1.39))
c.bevel(c.obj("pilot_armor", c.merge(*a), armor, root), 0.008)
c.obj("pilot_pauldron", pauldron_r, paint, root, smooth=True)  # the one painted plate

# Belt, pouches, holstered sidearm on the right thigh.
belt = [c.prism([(-0.19, -0.1), (0.19, -0.1), (0.2, 0.09), (-0.2, 0.09)], 0.9, 0.97)]
belt += [c.box(0.06, 0.04, 0.06, (x, -0.11, 0.93)) for x in (-0.13, -0.05, 0.13)]
belt.append(c.box(0.06, 0.1, 0.2, (0.2, 0.0, 0.78)))  # holster
c.obj("pilot_belt", c.merge(*belt), leather, root)
gun = c.merge(c.box(0.03, 0.05, 0.1, (0.2, 0.02, 0.92)), c.box(0.035, 0.16, 0.035, (0.2, -0.02, 0.97)))
c.obj("pilot_sidearm", gun, gun_m, root)

# Half-cape: a thick arc behind the shoulders, narrowing toward the top.
arc_out = [(0.27 * math.cos(t), 0.04 + 0.13 * math.sin(t)) for t in
           [R(d) for d in range(0, 181, 15)]]
arc_in = [(0.25 * math.cos(t), 0.04 + 0.11 * math.sin(t)) for t in
          [R(d) for d in range(180, -1, -15)]]
cape = c.obj("pilot_cape", c.prism(arc_out + arc_in, 0.5, 1.43, top_scale=0.86), cloth, root,
             smooth=True)
cape.rotation_euler = (R(-4), 0, R(-12))  # windblown, slung off one shoulder

# Chest and bracer lights: the only glow besides the visor line.
c.obj("pilot_chest_light", c.box(0.05, 0.01, 0.015, (0.07, -0.122, 1.33)), cyan, root)
c.obj("pilot_bracer_light", c.transform(c.box(0.012, 0.03, 0.09), loc=(-0.272, -0.07, 0.75)),
      cyan, root)

# ---- helmet ------------------------------------------------------------------
c.obj("pilot_gorget", c.cylinder(0.085, 0.07, 16, r_top=0.07, z0=1.43), armor, root, smooth=True)
helm = c.group("pilot_helmet", root, loc=(0, 0, 1.5))
c.obj("pilot_helmet_shell", c.uv_sphere(0.13, 24, 12, sx=1.0, sy=1.1, sz=1.1), armor, helm,
      loc=(0, 0.005, 0.135), smooth=True)
# Midline ridge: a thin, slightly larger copy of the dome, so it hugs the shell.
c.obj("pilot_helmet_ridge", c.uv_sphere(0.137, 24, 12, sx=0.16, sy=1.1, sz=1.1), gun_m, helm,
      loc=(0, 0.012, 0.138), smooth=True)
pod = c.transform(c.cylinder(0.04, 0.035, 16), loc=(0.128, 0.01, 0.11), rot=(0, R(90), 0))
antenna = c.transform(c.cylinder(0.004, 0.13, 6, z0=0.0), loc=(-0.14, 0.02, 0.12),
                      rot=(R(-18), 0, 0))
c.obj("pilot_helmet_pods", c.merge(pod, c.mirror_part(pod), antenna), gun_m, helm, smooth=True)
# Faceplate: a heater-shield plate (the Warden's crest, small) that sinks into
# the shell; the chevron visor is set into its upper half.
face = [(-0.105, 0.055), (0.105, 0.055), (0.1, -0.03), (0.0, -0.105), (-0.1, -0.03)]
c.bevel(c.obj("pilot_faceplate", c.transform(c.prism(face, 0.0, 0.08, top_scale=0.94),
                                            rot=(R(90), 0, 0)), armor, helm,
              loc=(0, -0.065, 0.13)), 0.006, 2)
chev = [(-0.088, 0.03), (0.088, 0.03), (0.088, 0.008), (0.0, -0.045), (-0.088, 0.008)]
c.bevel(c.obj("pilot_visor", c.transform(c.prism(chev, 0.0, 0.012), rot=(R(90), 0, 0)),
              visor_m, helm, loc=(0, -0.143, 0.14)), 0.003)
c.obj("pilot_visor_line", c.box(0.17, 0.006, 0.005, (0, -0.15, 0.174)), cyan, helm)
reb = [c.box(0.006, 0.01, 0.035, (x, -0.147, 0.06)) for x in (-0.024, -0.008, 0.008, 0.024)]
c.obj("pilot_rebreather", c.merge(*reb), gun_m, helm)

c.finish("pilot_figure", views=[(-25, 10), (-70, 8), (160, 15), (0, 0)])
if "--no-render" not in sys.argv:
    c.preview("pilot_figure_helmet", views=[(0, 0), (-40, 10), (-90, 0), (150, 20)],
              frame=[o.name for o in helm.children_recursive])
