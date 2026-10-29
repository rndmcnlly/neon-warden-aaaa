"""pilot_figure.py: builder for the two helmet variants of the contractor
(pilot_figure_issued.py and pilot_figure_worn.py are the asset wrappers).

The contractor: a lone gun for hire whose face is never seen. Wave-3 helmet
(research/2026-10-28-critique-visual/, "Pilot helmet"): a taller, narrower
head with a hard, forward-raked brow, a dark glossy visor band recessed
between crown and jaw (never emissive, never a T), no mouth grille, a collar
ring hiding the neck, bevels on hard edges, one asymmetric detail (a single
vertical cheek vent on the left) and one small emissive status light at the
right temple, the "eye" the camera can find in the dark.

Two variants, per AGENTS.md ("corporate-issue early, worn by the end"):
- issued: sleek Lane Authority livery, gloss white shell, a cyan stripe, the
  serial LA-0121 on the right side. Armor in matching white.
- worn: the same helmet after the job: matte, repainted rust over grey with
  the serial painted out, scuffs and a dented brow, darker weathered armor.

Authored in meters (1.8 tall, feet at the origin). Faces +Z in glTF. Static
pose, no rig. Nodes: pilot_figure (root), pilot_helmet (pivot at the neck),
pilot_helmet_crown, pilot_helmet_jaw, pilot_visor, pilot_brow,
pilot_collar, pilot_cheek_vent, pilot_temple_light (emissive),
pilot_helmet_livery (stripe or repaint), pilot_serial (issued) or
pilot_scuffs (worn), pilot_body, pilot_armor, pilot_pauldron, pilot_belt,
pilot_sidearm, pilot_cape, pilot_chest_light, pilot_bracer_light.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as c  # noqa: E402

R = math.radians

LIVERY = {
    "issued": dict(armor="#d9dde3", armor_rough=0.25, coat=0.9, paint="#35e0ff",
                   cloth="#2a3a4a"),
    "worn": dict(armor="#59585a", armor_rough=0.7, coat=0.0, paint="#8a3b22",
                 cloth="#4a3526"),
}


def limb(r0, r1, length, n=8):
    return c.cylinder(r0, length, n, r_top=r1, z0=0.0)


def build(variant):
    name = f"pilot_figure_{variant}"
    lv = LIVERY[variant]
    c.reset()
    root = c.root("pilot_figure")

    armor = c.mat("pilot_armor", lv["armor"], metallic=0.15, roughness=lv["armor_rough"], coat=lv["coat"])
    suit = c.mat("pilot_suit", "#1d1b24", metallic=0.0, roughness=0.8)
    cloth = c.mat("pilot_cloth", lv["cloth"], metallic=0.0, roughness=0.92)
    leather = c.mat("pilot_leather", "#2e2420", metallic=0.0, roughness=0.65)
    paint = c.mat("pilot_paint", lv["paint"], metallic=0.1, roughness=0.45)
    visor_m = c.mat("pilot_visor", "#05070a", metallic=0.4, roughness=0.06, coat=1.0)
    gun_m = c.mat("pilot_gunmetal", "#23262c", metallic=0.85, roughness=0.35)
    cyan = c.emit("pilot_cyan", "cyan", strength=4)
    dark = c.mat("pilot_dark", "#141518", metallic=0.5, roughness=0.5)





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


    # ---- helmet ----------------------------------------------------------------
    c.obj("pilot_collar", c.torus(0.085, 0.022, 24, 8), armor, root, loc=(0, 0, 1.47), smooth=True)
    helm = c.group("pilot_helmet", root, loc=(0, 0, 1.5))
    # Taller and narrower than wide: a crown dome, a tapered jaw tucked into
    # the collar, and a dark glossy visor band that sits proud at the front
    # and sinks into the shell toward the back (front-only, never a T).
    c.obj("pilot_helmet_crown", c.uv_sphere(0.118, 20, 10, sx=0.9, sy=1.02, sz=1.12), armor, helm,
          loc=(0, 0.0, 0.17), smooth=True)
    jaw = c.transform(c.cylinder(0.084, 0.17, 20, r_top=0.102, z0=0.0), scale=(0.95, 1.08, 1))
    c.bevel(c.obj("pilot_helmet_jaw", jaw, armor, helm, loc=(0, 0.004, -0.04)), 0.008, 2)
    band = c.uv_sphere(0.121, 24, 8, sx=0.9, sy=1.04, sz=0.34)
    c.obj("pilot_visor", band, visor_m, helm, loc=(0, -0.014, 0.15), smooth=True)
    # Hard brow line, raked forward over the visor.
    brow = c.box(0.15, 0.022, 0.012, (0, 0, 0))
    c.bevel(c.obj("pilot_brow", c.transform(brow, rot=(R(-28), 0, 0)), armor, helm,
                  loc=(0, -0.113, 0.198)), 0.004, 2)
    # One asymmetric detail: a vertical vent on the left cheek.
    vent = [c.box(0.006, 0.012, 0.05, (-0.096, -0.03 + 0.016 * i, 0.06)) for i in range(3)]
    c.obj("pilot_cheek_vent", c.merge(*vent), dark, helm)
    temple = c.emit("pilot_temple", "cyan" if variant == "issued" else "amber", strength=5)
    c.obj("pilot_temple_light", c.box(0.01, 0.02, 0.008, (0.1, -0.05, 0.2)), temple, helm)
    if variant == "issued":
        stripe = c.uv_sphere(0.1195, 20, 10, sx=0.1, sy=1.03, sz=1.12)
        c.obj("pilot_helmet_livery", stripe, paint, helm, loc=(0, 0.0, 0.17), smooth=True)
        serial = c.obj("pilot_serial", c.text_mesh("pilot_serial", "LA-0121", size=0.022,
                                                   extrude=0.001, bevel_depth=0.0),
                       dark, helm, loc=(0.1, 0.035, 0.06), rot=(R(90), 0, R(90)))
    else:
        # Repaint: the rear half of the crown in rust, over the grey.
        rep = c.uv_sphere(0.1195, 20, 10, sx=0.9, sy=0.55, sz=1.12)
        c.obj("pilot_helmet_livery", rep, paint, helm, loc=(0, 0.05, 0.17), smooth=True)
        # Scuffs, a painted-out serial and a dent in the brow.
        # Scuffs sit on the sides and jaw, never in a pair on the brow (two
        # marks there read as closed eyes: pareidolia breaks "faceless").
        sc = [c.transform(c.box(0.004, 0.03, 0.004, (0, 0, 0)), loc=(x, y, z),
                          rot=(R(ang), 0, 0))
              for x, y, z, ang in ((-0.1, 0.02, 0.2, 25), (0.098, -0.02, 0.24, -30),
                                   (0.088, -0.06, 0.0, 10))]
        sc.append(c.box(0.004, 0.06, 0.02, (0.101, 0.035, 0.06)))
        c.obj("pilot_scuffs", c.merge(*sc), dark, helm)
        c.obj("pilot_brow_dent", c.uv_sphere(0.018, 8, 4, sz=0.4), dark, helm, loc=(0.045, -0.118, 0.205))

    c.finish(name, views=[(-25, 10), (-70, 8), (160, 15), (0, 0)])
    if "--no-render" not in sys.argv:
        c.preview(name + "_helmet", views=[(0, 0), (-40, 10), (-90, 0), (150, 20)],
                  frame=[o.name for o in helm.children_recursive])
