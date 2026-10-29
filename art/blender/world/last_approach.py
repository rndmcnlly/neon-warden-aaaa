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
    """A masonry pier: square, stepped, ribbed, with stone courses for scale,
    a straight flying buttress toward the lane (-X) and a heart inlaid in its
    cap. Architecture, not a figure: no rounded shoulders, no cape-like curve."""
    c.reset()
    root = c.root("la_buttress")
    k = Kit(71)
    for z0, z1, r in ((-60, -30, 12), (-30, -8, 10.5), (-8, 0, 9)):
        k.add(c.prism(c.ngon(r, 4, math.pi / 4), z0, z1, top_scale=0.94), STONE)
        for z in range(int(z0) + 3, int(z1), 3):
            k.add(c.prism(c.ngon(r * 0.97 + 0.15, 4, math.pi / 4), z, z + 0.35), DARK)
    for sx, sy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        k.beam((sx * 9.6, sy * 9.6, -50), (sx * 7.4, sy * 7.4, 0), 1.6, RIB)
    k.add(c.prism(c.ngon(10, 4, math.pi / 4), 0, 1.6), RIB)
    heart_frame(k, 0.38, 1.6, 1.2, DARK, IVORY)
    # Flying buttress: two straight rails with cross ties, stepping down.
    for y in (-2.2, 2.2):
        k.beam((-7, y, -1), (-30, y, -22), 1.6, STONE)
    for t in range(1, 8):
        x = -7 - t * 23 / 8
        k.beam((x, -2.2, -1 - t * 21 / 8), (x, 2.2, -1 - t * 21 / 8), 0.9, RIB)
    k.add(c.prism(c.ngon(4, 4, math.pi / 4), -40, -20), STONE, loc=(-31, 0, 0))
    # Catwalk ring with railings and lamps: a person-sized edge on a huge pier.
    ring = c.ngon(9.8, 4, math.pi / 4)
    for i in range(4):
        a, b = ring[i], ring[(i + 1) % 4]
        k.add(c.strip(a, b, 1.2, -4.4, -4.1), DARK)
        k.railing(a, b, -4.1, BRASS, h=1.0, spacing=1.6)
        k.light((a[0] * 0.98, a[1] * 0.98, -3.2), IVORY, 1.0, "z", 0.25)
    k.figure((ring[1][0] * 0.8, ring[1][1] * 0.8, -4.1), "#8c8270")
    k.bake("la_buttress", root)
    return finish("la_buttress")


def nursery():
    """A greenhouse bed of scout pods: flat ring-and-core discs (the scouts'
    own silhouette, in muted colors) in hex rows, glazing arches overhead,
    irrigation lines, and a tender arm riding the rail."""
    c.reset()
    root = c.root("la_nursery")
    k = Kit(72)
    k.box((30, 22, 1.6), (0, 0, -0.8), STONE)
    k.box((30.6, 22.6, 0.4), (0, 0, -0.1), RIB)
    k.box((27, 19, 0.2), (0, 0, 0.12), "#3a4a46")
    for row in range(4):
        for col in range(6):
            x = -12.5 + col * 5 + (2.5 if row % 2 else 0)
            y = -7.5 + row * 5
            if x > 13:
                continue
            k.add(c.torus(1.6, 0.35, 16, 4), POD, loc=(x, y, 0.8), scale=(1, 1, 0.8))
            k.add(c.cylinder(0.7, 0.5, 10), "#55605c", loc=(x, y, 0.6))
            k.box((1.0, 0.25, 0.15), (x, y, 0.9), CORE, lit=True)
    for y in (-10, -5, 0, 5, 10):
        k.cyl(0.18, 27, (0, y - 2.5 if y else -2.5, 0.35), BRASS, n=6, rot=(0, math.pi / 2, 0))
    # Glazing arches: thin ribs over the bed, a greenhouse silhouette.
    for x in range(-14, 15, 4):
        pts = [(x, -11 + 22 * i / 8, 2 + 5 * math.sin(math.pi * i / 8)) for i in range(9)]
        for a, b in zip(pts, pts[1:]):
            k.beam(a, b, 0.25, "#8a9a96")
    k.beam((-15, 0, 7), (15, 0, 7), 0.4, "#8a9a96")
    sign("la_nursery", root, (0, -13.4, 3.6), 12, 2.6, backing="#2a2430", frame=BRASS, kit=k)
    k.bake("la_nursery", root)
    tender = c.group("la_nursery_tender", root, (0, 0, 7.4))
    t = Kit(73)
    t.box((2.4, 22, 0.8), (0, 0, 0), RIB)
    t.box((2.2, 2.2, 1.4), (0, 0, -1.1), DARK)
    t.light((0, -1.2, -1.6), IVORY, 1.4, "x", 0.25)
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
