"""Sector 2, Shatter Belt: a snapped bridge truss and the Commons crew
patching it, with drifting rock from whatever broke it.

What the place is: an old public bridge across the belt, its asset number
crossed out by the Authority. What is happening: a volunteer crew bolts on
mismatched plates, welding while a small boom swings the next plate in.
"""

import math

import common as c
from kit import Kit, finish, rock, sign

STEEL = "#5c6269"
DARK = "#2b2e33"
RUST = "#6d5446"
DECK = "#41464c"
SCAFFOLD = "#a08c58"
LAMP = "#ffe2b0"
COOL = "#a6c0cc"
PATCHES = ("#7a8a5c", "#8a6a48", "#5f7a8c", "#9a8f7a", "#6c5f78", "#8c5a50")


def truss_segment(k, y0, y1, broken_end=None):
    """A Warren truss along Y, 10 m wide and 8 m deep, deck on the bottom chords."""
    for x in (-5, 5):
        for z in (0, 8):
            k.beam((x, y0, z), (x, y1, z), 0.9, STEEL)
    step = 6.0
    n = int((y1 - y0) / step)
    for i in range(n + 1):
        y = y0 + i * step
        for x in (-5, 5):
            k.beam((x, y, 0), (x, y, 8), 0.5, STEEL)
            if i < n:
                ya, yb = (y, y + step) if i % 2 else (y + step, y)
                k.beam((x, ya, 0), (x, yb, 8), 0.45, RUST if (i * 7) % 5 == 0 else STEEL)
        k.beam((-5, y, 8), (5, y, 8), 0.45, STEEL)
        if i < n:
            k.beam((-5, y, 8), (5, y + step, 8), 0.3, DARK)
            if (i * 3) % 4:
                k.box((9.6, step - 0.4, 0.4), (0, y + step / 2, 0.2), DECK)
            if i % 3 == 1:
                k.light((-4.6, y + 3, 8.7), COOL, 1.8, "y", 0.3)
    k.railing((-4.4, y0), (-4.4, y1), 0.4, "#7a8088", spacing=3)
    if broken_end is not None:
        # Torn members: chord stubs bent out at odd angles.
        for x, z, dx, dz in ((-5, 8, -1.5, 2.5), (5, 8, 2.2, -1), (-5, 0, 0.5, -3), (5, 0, 2, 1.5)):
            k.beam((x, broken_end, z), (x + dx, broken_end + 3.2 * (1 if broken_end > 0 else -1),
                                        z + dz), 0.7, RUST)


def truss():
    c.reset()
    root = c.root("sb_truss")
    k = Kit(41)
    truss_segment(k, -54, 6, broken_end=6)
    # The far half sags and twists away from the break.
    far = Kit(42)
    truss_segment(far, 0, 42, broken_end=0)
    for part, color in far.body:
        k.add(part, color, False, (1.5, 14, -1.2), (0.06, 0.03, 0.12))
    for part, color in far.lit:
        k.add(part, color, True, (1.5, 14, -1.2), (0.06, 0.03, 0.12))
    # Asset plate with the number struck through (geometry, not tiny numerals).
    k.box((6, 2.2, 0.3), (0, -30, 8.6), "#2a3038")
    k.beam((-2.6, -30.9, 8.9), (2.6, -29.1, 8.9), 0.3, "#b8ad94")
    k.beam((-2.6, -29.1, 8.9), (2.6, -30.9, 8.9), 0.3, "#b8ad94")
    k.bake("sb_truss", root)
    return finish("sb_truss")


def repair():
    """The crew's rig at the break; origin in the gap between the halves."""
    c.reset()
    root = c.root("sb_repair")
    k = Kit(43)
    for x in (-7, -2, 3, 8):
        for y in (-6, 0, 6):
            k.beam((x, y, -2), (x, y, 11), 0.25, SCAFFOLD)
    for z in (2, 6.5, 11):
        for y in (-6, 0, 6):
            k.beam((-7, y, z), (8, y, z), 0.22, SCAFFOLD)
        for x in (-7, 8):
            k.beam((x, -6, z), (x, 6, z), 0.22, SCAFFOLD)
    k.box((15.5, 12.5, 0.3), (0.5, 0, 11.2), "#6b5a3e")
    k.railing((-7, -6.2), (8, -6.2), 11.4, SCAFFOLD, spacing=2.5)
    # Two temporary girders across the gap, then mismatched patch plates.
    for x in (-4, 4):
        k.beam((x, -10, 8.4), (x + 0.6, 10, 7.6), 1.1, "#7d8a6a")
    for i in range(11):
        w, d = k.rnd.uniform(2.2, 4.2), k.rnd.uniform(1.8, 3.6)
        k.box((w, d, 0.35), (k.rnd.uniform(-5, 5), k.rnd.uniform(-9, 9), 8.9 + 0.05 * i),
              PATCHES[i % len(PATCHES)], (k.rnd.uniform(-0.05, 0.05), 0, k.rnd.uniform(-0.3, 0.3)))
    # The crew's work pod, docked on the near side: lit cabin, tool rack.
    k.box((6, 8, 4), (13.5, -2, 6), "#6f7a70")
    k.box((6.4, 3, 0.5), (13.5, -5, 8.2), DARK)
    k.windows(11, 16, -6.06, 6.6, LAMP, spacing=1.4, w=1.0, h=1.2, gaps=0)
    k.windows(11.5, 15.5, 0.5, 8.1, LAMP, spacing=1.6, w=1.0, h=1.6, face="top", gaps=0)
    k.beam((10.5, -2, 6), (8, -2, 9), 0.6, DARK)
    for i, (x, y) in enumerate(((-3, -6.6), (2, -6.6), (5.5, 4))):
        k.figure((x, y, 11.35), "#c9a85a" if i % 2 else "#7fa0a8", yaw=i)
    for x, y in ((-7, -6), (8, -6), (8, 6)):
        k.light((x, y, 11.9), LAMP, 1.6, "x", 0.5)
    # Hand-painted crew sign on plywood, propped on the scaffold deck.
    sign("sb_commons", root, (0.5, -4.2, 13.2), 11, 3.0, backing="#5e4c33", frame="#7a6440", kit=k)
    for i, (x, y, z) in enumerate(((-3, -1.5, 9.2), (2, 2, 9.2), (0.5, -8, 9.0))):
        c.group(f"spark__{i}", root, (x, y, z))
    k.bake("sb_repair", root)
    boom = c.group("sb_repair_boom", root, (-7, 6, 11))
    b = Kit(44)
    b.cyl(0.9, 1.6, (0, 0, 0.8), DARK, n=8)
    b.beam((0, 0, 1.6), (-12, 0, 4), 0.6, SCAFFOLD)
    b.beam((-12, 0, 4), (-12, 0, -1), 0.08, DARK)
    b.box((3.6, 2.4, 0.3), (-12, 0, -1.2), PATCHES[4], (0.1, 0, 0.2))
    b.bake("sb_repair_boom", boom)
    return finish("sb_repair")


def rocks():
    c.reset()
    root = c.root("sb_rock")
    k = Kit(45)
    k.add(rock(7, 3, 1.3, 1.0, 0.8, n=9), "#45424a")
    k.add(rock(2.5, 5, 1, 1.2, 0.9), "#4c4850", loc=(8, 3, 1))
    k.add(rock(1.6, 9), "#3f3c44", loc=(-7, -4, -1))
    # A Commons survey stake: someone charted this rock as a hazard.
    k.beam((2, -2, 4), (2, -2, 9), 0.25, "#8c8270")
    k.light((2, -2, 9.4), LAMP, 1.0, "z", 0.3)
    k.bake("sb_rock", root)
    return finish("sb_rock")


def build():
    return [truss(), repair(), rocks()]
