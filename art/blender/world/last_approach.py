"""Sector 5, Last Approach: the Warden's buttresses, its nursery beds of
growing scouts, and the heart gate ahead.

What the place is: a guardian's home, maintained for three centuries. What is
happening: very little, quietly: a tender arm checks the pods, lamps breathe.
Imposing, not menacing; the heart motif is architecture, never a target.
"""

import math

import common as c
from kit import Kit, finish, sign

STONE = "#4b4458"
RIB = "#5f566c"
DARK = "#2a2630"
IVORY = "#e6d6b4"     # the heart seam: warm ivory, not bullet magenta
POD = "#6e7e7a"
CORE = "#9fd2c4"
BRASS = "#8c7a58"


def heart(scale, n=40):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x * scale, y * scale))
    return pts


def heart_frame(k, scale, z, w, color, lit_color=None):
    pts = heart(scale)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        k.add(c.strip(a, b, w, z, z + 1.2), color)
        if lit_color:
            k.add(c.strip(a, b, w * 0.4, z + 1.2, z + 1.4), lit_color, True)


def buttress():
    """A monumental pier with a flying arch reaching toward the lane (-X)."""
    c.reset()
    root = c.root("la_buttress")
    k = Kit(71)
    k.add(c.prism(c.ngon(11, 8, math.pi / 8), -60, 0, top_scale=0.78), STONE)
    k.add(c.prism(c.ngon(9.4, 8, math.pi / 8), 0, 2.4, top_scale=0.9), RIB)
    heart_frame(k, 0.46, 2.4, 1.4, RIB, IVORY)
    for i in range(10):
        t = i / 10
        x0, x1 = -t * 26, -(t + 0.1) * 26
        z0, z1 = -2 - 22 * t * t, -2 - 22 * (t + 0.1) ** 2
        k.beam((x0 - 4, 0, z0), (x1 - 4, 0, z1), 5.2 - 2.6 * t, STONE)
        k.beam((x0 - 4, 0, z0 + 2.4), (x1 - 4, 0, z1 + 2.4), 1.2, RIB)
    # A maintenance catwalk: tiny railings and lamps give the pier its size.
    ring = c.ngon(10.6, 16)
    for i in range(16):
        a, b = ring[i], ring[(i + 1) % 16]
        k.add(c.strip(a, b, 1.4, -3.2, -2.9), DARK)
        if i % 2:
            k.railing(a, b, -2.9, BRASS, h=1.0, spacing=1.6)
        if i % 4 == 0:
            k.light((a[0], a[1], -1.9), IVORY, 1.0, "z", 0.25)
    k.figure((ring[3][0], ring[3][1], -2.9), "#8c8270")
    for y in (-8, 8):
        k.beam((8, y, -40), (8, y, 0), 0.8, RIB)
    k.bake("la_buttress", root)
    return finish("la_buttress")


def nursery():
    """Terraced beds of scout pods in cradles; a tender arm rides the rows."""
    c.reset()
    root = c.root("la_nursery")
    k = Kit(72)
    for row in range(3):
        y, z = -6 + row * 6, row * 1.6
        k.box((26, 6.4, 2), (0, y, z - 1), STONE)
        k.box((26, 0.5, 0.6), (0, y - 3.25, z - 0.3), RIB)
        for col in range(4):
            x = -8 + col * 5.2 + row * 0.6
            k.add(c.prism(c.ngon(1.9, 8), z, z + 0.5, top_scale=1.25), BRASS, loc=(x, y, 0))
            k.add(c.prism(c.ngon(1.4, 8), z + 0.5, z + 1.6, top_scale=0.6), POD, loc=(x, y, 0))
            k.box((1.6, 0.3, 0.2), (x, y, z + 1.7), CORE, lit=True)
    # Irrigation pipes and the rail the tender rides on.
    for y in (-3, 3, 9):
        k.cyl(0.35, 26, (0, y, 2.2), BRASS, n=6, rot=(0, math.pi / 2, 0))
    for x in (-12.5, 12.5):
        k.beam((x, -10, 7), (x, 10, 7), 0.8, RIB)
        k.beam((x, -10, 0), (x, -10, 7), 0.8, RIB)
        k.beam((x, 10, 0), (x, 10, 7), 0.8, RIB)
    sign("la_nursery", root, (0, -12.8, 4.4), 12, 2.6, backing="#2a2430", frame=BRASS, kit=k)
    # The repositioned pass-one tollgate cabinets: dormant, dark, unconnected.
    k.box((4, 3, 3), (16, -6, 1.5), DARK)
    k.bake("la_nursery", root)
    tender = c.group("la_nursery_tender", root, (0, 0, 7))
    t = Kit(73)
    t.box((26, 1.6, 1.0), (0, 0, 0), RIB)
    t.box((2.4, 2.4, 1.6), (0, 0, -1.2), DARK)
    t.light((0, -0.9, -1.8), IVORY, 1.6, "x", 0.25)
    t.bake("la_nursery_tender", tender)
    return finish("la_nursery")


def heartgate():
    """Far layer: the gate ahead, a ring of piers around a heart-shaped mouth."""
    c.reset()
    root = c.root("la_heartgate")
    k = Kit(74)
    heart_frame(k, 3.4, 0, 6, STONE, IVORY)
    heart_frame(k, 4.1, -4, 4, RIB)
    for i, (x, y) in enumerate(heart(4.6, 12)):
        k.add(c.prism(c.ngon(4, 6), -40, 6, top_scale=0.7), STONE, loc=(x, y, 0))
        if i % 3 == 0:
            k.light((x, y, 6.8), IVORY, 3, "z", 0.6)
    k.box((36, 10, 3), (0, -68, 0), RIB)
    sign("la_heartgate", root, (0, -68, 1.6), 30, 6, flat=True)
    k.bake("la_heartgate", root)
    return finish("la_heartgate")


def build():
    return [buttress(), nursery(), heartgate()]
