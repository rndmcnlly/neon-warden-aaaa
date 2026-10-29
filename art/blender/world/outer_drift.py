"""Sector 1, Outer Drift: a public beacon buoy with civilian haulers queued
for passage, and a free waystation ahead on the route.

What the place is: a maintained public navigation buoy (the Commons' lighthouse).
What is happening: small Saltline haulers idle in line, running lights on, while
the lamp turns. Nobody pays here; that is the joke the Authority does not get.
"""

import math

import common as c
from kit import Kit, finish, rock, sign  # noqa: F401

STEEL = "#57626c"
DECK = "#4b545d"
DARK = "#2a2f35"
TRIM = "#8e969c"
CIVIC = "#c2a35a"     # public-works ochre, faded
WARM = "#ffd8a0"      # inhabited windows
AMBER = "#ffbf6a"     # the beacon lens
COOL = "#a8cad8"      # exhaust
PORT = "#d0805a"      # running lights, kept warm and dim: never bullet magenta
STARBOARD = "#86b8a0"


def beacon():
    c.reset()
    root = c.root("od_beacon")
    k = Kit(11)
    k.add(c.prism(c.ngon(16, 8, math.pi / 8), -2.5, 0), DECK)
    k.add(c.prism(c.ngon(16.6, 8, math.pi / 8), -3.2, -2.5), DARK)
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        k.cyl(3.0, 9, (math.cos(a) * 17.5, math.sin(a) * 17.5, -3.6), STEEL, n=10,
              rot=(math.pi / 2, 0, a))
    rim = c.ngon(15.2, 8, math.pi / 8)
    for i in range(8):
        k.hazard(rim[i], rim[(i + 1) % 8], 0, 1.0, (CIVIC, DARK), stripe=1.6)
        if i % 2:  # railings leave the docking gaps open
            k.railing(c.ngon(15.8, 8, math.pi / 8)[i], c.ngon(15.8, 8, math.pi / 8)[(i + 1) % 8],
                      0, TRIM)
    k.panels(0, 0, 18, 18, 0, "#555f69", n=12)
    k.add(c.torus(9, 0.4, 40, 4), CIVIC, loc=(0, 0, 0.05), scale=(1, 1, 0.2))
    # Four docking arms with mooring clamps and berth lights.
    for i in range(4):
        a = 2 * math.pi * i / 4 + math.pi / 4
        d = (math.cos(a), math.sin(a))
        k.beam((d[0] * 15, d[1] * 15, -0.8), (d[0] * 31, d[1] * 31, -0.8), 2.6, STEEL)
        k.box((4.5, 4.5, 3), (d[0] * 32, d[1] * 32, -0.3), DARK, (0, 0, a))
        k.light((d[0] * 32, d[1] * 32, 1.35), WARM, 2.4, "x")
        k.railing((d[0] * 16 - d[1] * 1.4, d[1] * 16 + d[0] * 1.4),
                  (d[0] * 30 - d[1] * 1.4, d[1] * 30 + d[0] * 1.4), 0.5, TRIM)
    # Keeper's hut: lit windows facing the camera, roof plant, antenna.
    k.box((9, 5, 3.6), (-8, 7, 1.8), STEEL)
    k.box((9.6, 5.6, 0.4), (-8, 7, 3.8), DARK)
    k.windows(-12, -4, 4.45, 2.0, WARM, spacing=2.0, w=1.2, h=1.0)
    k.box((2, 2, 1.2), (-10, 8, 4.6), TRIM)
    k.beam((-5, 8.5, 4), (-5, 8.5, 11), 0.25, TRIM)
    k.light((-5, 8.5, 11.4), PORT, 1.2, "z", 0.3)
    k.figure((-3.5, 3.5, 0), yaw=0.3)
    k.figure((5.5, -11, 0), yaw=1.2)
    # Lattice tower to the lantern gallery.
    for sx in (-1, 1):
        for sy in (-1, 1):
            k.beam((sx * 4, sy * 4, 0), (sx * 1.6, sy * 1.6, 20), 0.6, TRIM)
    for z, r in ((5, 3.4), (10, 2.8), (15, 2.2)):
        pts = [(-r, -r), (r, -r), (r, r), (-r, r)]
        for i in range(4):
            k.beam((*pts[i], z), (*pts[(i + 1) % 4], z), 0.3, TRIM)
    k.ladder(0, -3.9, 0, 19, TRIM)
    k.add(c.prism(c.ngon(3.6, 8), 19.6, 20.2), DARK)
    k.railing((-3.4, -3.4), (3.4, -3.4), 20.2, TRIM, spacing=1.2)
    k.cyl(2.1, 0.6, (0, 0, 24.3), DARK, n=12)
    k.cyl(1.6, 3.4, (0, 0, 22.2), AMBER, n=12, lit=True)
    sign("od_beacon", root, (-8, 3.4, 6.2), 10, 2.6, kit=k)
    sign("od_deck", root, (5, -9, 0.15), 12, 3.4, flat=True)
    k.bake("od_beacon", root)
    lamp = c.group("od_beacon_lamp", root, (0, 0, 22.2))
    shutter = Kit(12)
    for s in (-1, 1):
        shutter.box((0.5, 3.0, 3.8), (s * 1.95, 0, 0), DARK)
    shutter.bake("od_beacon_lamp", lamp)
    return finish("od_beacon")


def hauler(name, pods, colors, seed):
    c.reset()
    root = c.root(name)
    k = Kit(seed)
    k.add(c.prism([(-3, 9), (3, 9), (2.2, 15.5), (-2.2, 15.5)], -1.8, 1.8, top_scale=0.82), STEEL)
    k.windows(-1.6, 1.6, 13.4, 1.55, WARM, spacing=1.0, w=0.8, h=1.6, face="top", gaps=0)
    k.windows(-2.4, 2.4, 8.9, 0.6, WARM, spacing=1.2, w=0.8, h=0.6)
    k.box((1.6, 26, 1.6), (0, -1, 0), DARK)
    for i in range(pods):
        y = 5.2 - i * 6.6
        k.cyl(2.5, 5.8, (0, y, 0), colors[i % len(colors)], n=8, rot=(math.pi / 2, 0, 0))
        k.cyl(2.65, 0.5, (0, y + 2.7, 0), DARK, n=8, rot=(math.pi / 2, 0, 0))
        k.box((0.4, 4.4, 0.2), (0, y, 2.5), TRIM)
    k.box((5.2, 5, 3.6), (0, -14, 0), STEEL)
    k.panels(0, -14, 5.2, 5, 1.8, "#606a74", n=3, max_size=1.8)
    for s in (-1, 1):
        k.cyl(1.3, 2.6, (s * 1.4, -17.6, 0), DARK, n=10, rot=(math.pi / 2, 0, 0))
        k.cyl(1.0, 0.3, (s * 1.4, -19.0, 0), COOL, n=10, rot=(math.pi / 2, 0, 0), lit=True)
    k.box((10, 1.6, 0.5), (0, -12, 0.4), STEEL)
    k.light((-4.8, -12, 0.8), PORT, 1.6, "y", 0.35)
    k.light((4.8, -12, 0.8), STARBOARD, 1.6, "y", 0.35)
    k.light((0, 15.2, 1.2), WARM, 1.6, "x", 0.3)
    k.bake(name, root)
    return finish(name)


def waystation():
    """Far layer: a free waystation ring ahead on the route (LOD-friendly)."""
    c.reset()
    root = c.root("od_waystation")
    k = Kit(21)
    k.add(c.torus(38, 4, 36, 6), STEEL, scale=(1, 1, 0.8))
    k.cyl(8, 10, (0, 0, 0), DECK, n=12)
    k.cyl(5, 2, (0, 0, 5.5), DARK, n=12)
    for i in range(4):
        a = math.pi * i / 2 + math.pi / 4
        k.beam((math.cos(a) * 8, math.sin(a) * 8, 0), (math.cos(a) * 35, math.sin(a) * 35, 0),
               2.2, TRIM)
    for i in range(72):
        if k.rnd.random() < 0.22:
            continue
        a = 2 * math.pi * i / 72
        k.box((1.6, 2.6, 0.3), (math.cos(a) * 38, math.sin(a) * 38, 3.3), WARM,
              (0, 0, a), lit=True)
    for s in (-1, 1):
        k.box((26, 9, 0.4), (s * 58, 0, 0), "#33404e")
        for g in range(5):
            k.box((0.4, 9.2, 0.5), (s * (47 + g * 5.2), 0, 0.1), TRIM)
    k.beam((0, -8, 0), (0, -30, 0), 2, STEEL)
    k.light((0, -30, 1.4), WARM, 3, "x", 0.6)
    sign("od_waystation", root, (0, 0, 6.6), 16, 4.4, flat=True)
    k.bake("od_waystation", root)
    return finish("od_waystation")


def build(render=True):
    return [beacon(),
            hauler("od_hauler_a", 3, ("#8a6a48", "#6f7c86", "#8a6a48"), 31),
            hauler("od_hauler_b", 2, ("#5f7a8c", "#9a8f7a"), 32),
            waystation()]
