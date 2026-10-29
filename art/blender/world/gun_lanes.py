"""Sector 3, Gun Lanes: a Lane Authority toll gantry over a side freight
lane, freight pods queued for inspection, and the billing tower behind it.

What the place is: a customs checkpoint built over a free lane. What is
happening: each pod stops, a scanner sweeps it, the barrier arms lift, the
ticker bills it anyway. Inspection capacity zero, billing ready.
"""

import math

import common as c
from kit import Kit, finish, sign

NAVY = "#3f4b63"
NAVY_DARK = "#2a3244"
GOLD = "#a8986a"      # the Authority's trim, dulled
DARK = "#25292f"
ROAD = "#30343a"
PAINT = "#a9aa9c"
WARM = "#ffd9a6"
SCAN = "#a6dcc8"      # pale scanner green: never a combat hue
AMBER = "#e0a75a"
RED = "#b0473a"
WHITE = "#d8d4c8"


def gantry():
    c.reset()
    root = c.root("gl_gantry")
    k = Kit(51)
    # The freight lane: a road deck with dashed center paint and kerbs.
    k.box((24, 64, 1), (0, 0, -0.5), ROAD)
    for i in range(10):
        k.box((0.5, 3, 0.06), (0, -28 + i * 6.4, 0.03), PAINT)
    for s in (-1, 1):
        k.hazard((s * 11.6, -32), (s * 11.6, 32), 0, 0.8, (AMBER, DARK), stripe=2.0)
    # Twin towers with ladders, windows and roof lamps.
    for s in (-1, 1):
        x = s * 15.5
        k.box((6, 6, 22), (x, 0, 11), NAVY)
        k.box((6.6, 6.6, 0.6), (x, 0, 7), NAVY_DARK)
        k.ladder(x - s * 1.5, -3.1, 0, 21, GOLD)
        for z in (9.5, 14, 18.5):
            k.windows(x - 2.2, x + 2.2, -3.06, z, WARM, spacing=1.5, w=0.9, h=1.1, gaps=0.3)
        k.light((x, 0, 22.5), AMBER, 2.0, "y", 0.5)
    # Crossbeam with the Authority's gold trim and a booth on top.
    k.box((37, 5, 4), (0, 0, 22), NAVY)
    for y in (-2.55, 2.55):
        k.box((37, 0.15, 0.4), (0, y, 23.6), GOLD)
    k.box((8, 5.5, 4), (-13, 0.5, 26), NAVY_DARK)
    k.windows(-16.5, -9.5, -2.32, 26.4, WARM, spacing=1.6, w=1.1, h=1.6, gaps=0)
    k.railing((-18, -2.6), (-9, -2.6), 24, GOLD, spacing=1.5)
    k.figure((-6, -1.5, 24), "#a8986a", yaw=0.2)
    k.beam((-13, 2, 28), (-13, 2, 33), 0.2, GOLD)
    k.light((-13, 2, 33.4), RED, 1.0, "z", 0.25)
    sign("gl_ticker", root, (4.5, -3.4, 22.2), 19, 2.6, backing="#11151c", frame=GOLD, kit=k)
    sign("gl_customs", root, (4.5, 0.4, 24.12), 22, 3.4, flat=True)
    # Barrier posts; the arms are pivots the renderer raises and drops.
    for s in (-1, 1):
        k.box((1.6, 1.6, 2.6), (s * 12.2, -7, 1.3), NAVY_DARK)
        k.light((s * 12.2, -7, 2.8), AMBER, 1.0, "x", 0.3)
    k.bake("gl_gantry", root)
    for i, s in enumerate((-1, 1)):
        arm = c.group(f"gl_gantry_arm_{i}", root, (s * 12.2, -7, 2.2))
        a = Kit(52 + i)
        a.hazard((0, 0), (-s * 11.4, 0), 0, 0.7, (RED, WHITE), stripe=1.4)
        a.box((11.4, 0.5, 0.5), (-s * 5.7, 0, -0.2), DARK)
        a.bake(f"gl_gantry_arm_{i}", arm)
    scanner = c.group("gl_gantry_scanner", root, (0, 0, 19.6))
    s = Kit(55)
    s.box((10, 2.4, 1.4), (0, 0, 0), NAVY_DARK)
    s.light((0, -1.25, -0.4), SCAN, 9, "x", 0.35)
    s.bake("gl_gantry_scanner", scanner)
    return finish("gl_gantry")


def pod():
    c.reset()
    root = c.root("gl_pod")
    k = Kit(56)
    k.box((9, 16, 1), (0, 0, 0.5), DARK)
    k.box((8, 14, 6), (0, 0, 4), "#77808a")
    for i in range(7):
        k.box((8.2, 0.4, 6.2), (0, -6 + i * 2, 4), "#5d656e")
    k.box((8.4, 1.2, 0.4), (0, -7.4, 7.2), NAVY_DARK)
    k.windows(-3, 3, -7.06, 2.2, AMBER, spacing=2, w=1.2, h=0.4, gaps=0)
    sign("gl_pod", root, (0, 1.5, 7.08), 6.4, 2.0, flat=True)
    k.bake("gl_pod", root)
    return finish("gl_pod")


def tower():
    """Far layer: the Authority's billing tower, lit late into every shift."""
    c.reset()
    root = c.root("gl_tower")
    k = Kit(57)
    k.box((44, 30, 30), (0, 0, 15), NAVY)
    k.box((32, 22, 12), (0, 2, 36), NAVY_DARK)
    for z in range(4, 29, 4):
        k.windows(-21, 21, -15.06, z, WARM, spacing=2.6, w=1.8, h=1.6, gaps=0.25)
    for z in range(32, 41, 4):
        k.windows(-15, 15, -9.06, z, WARM, spacing=2.6, w=1.8, h=1.6, gaps=0.25)
    for y in (-12, -6, 6, 12):
        k.windows(-20, 20, y, 30.1, "#c8d0d8", spacing=4, w=2.4, h=1.0, face="top", gaps=0.4)
    for x in (-12, 12):
        k.beam((x, 6, 42), (x, 6, 56), 0.6, GOLD)
        k.light((x, 6, 56.6), RED, 1.2, "z", 0.4)
    sign("gl_tower", root, (0, 2, 42.1), 26, 6, flat=True)
    k.bake("gl_tower", root)
    return finish("gl_tower")


def build():
    return [gantry(), pod(), tower()]
