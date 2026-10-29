"""Sector 4, Lancer Gate: a container interchange where the Saltline Haulers
transfer freight, with side bays opening onto the lane.

What the place is: a switchyard at the gate. What is happening: a gantry crane
shuttles a Saltline container between stacks while the bays stay clear for the
next convoy. Stack colors come from per-instance tints, not separate meshes.
"""

import common as c
from kit import Kit, finish, sign

CRANE = "#a8913c"      # crane yellow, desaturated toward the world band
DARK = "#2a2e34"
CONCRETE = "#4a4d50"
STEEL = "#5a6067"
NEUTRAL = "#c8c8c8"   # container base: tinted per instance by the renderer
SALT = "#b0683a"
CREAM = "#cfc4a6"
WARM = "#ffd9a6"
AMBER = "#e0a75a"
COOL = "#9fc0b8"


def container_parts(k, at, color, door=True):
    x, y, z = at
    k.box((2.44, 12.2, 2.6), (x, y, z + 1.3), color)
    for i in range(19):
        k.box((2.5, 0.22, 0.12), (x, y - 5.6 + i * 0.62, z + 2.62), color)
    for sx in (-1, 1):
        for sy in (-1, 1):
            k.box((0.4, 0.4, 2.7), (x + sx * 1.1, y + sy * 5.95, z + 1.3), DARK)
    if door:
        for i in range(4):
            k.box((0.12, 0.1, 2.3), (x - 0.9 + i * 0.6, y - 6.13, z + 1.3), DARK)


def container():
    c.reset()
    root = c.root("lg_container")
    k = Kit(61)
    container_parts(k, (0, 0, 0), NEUTRAL)
    k.bake("lg_container", root)
    return finish("lg_container")


def crane():
    c.reset()
    root = c.root("lg_crane")
    k = Kit(62)
    k.box((60, 36, 0.6), (4, 0, -0.3), CONCRETE)
    for y in range(-16, 17, 4):
        k.box((60, 0.25, 0.04), (4, y, 0.02), "#6a6d6e")
    for sx in (-12, 12):
        for sy in (-8, 8):
            k.beam((sx, sy, 0), (sx, sy, 28), 1.4, CRANE)
        k.beam((sx, -8, 0.8), (sx, 8, 0.8), 1.6, CRANE)
        k.beam((sx, -8, 24), (sx, 8, 24), 1.2, CRANE)
        k.beam((sx, -8, 4), (sx, 8, 22), 0.5, CRANE)
        k.ladder(sx, -9, 0, 27, DARK)
    for sy in (-3, 3):
        k.beam((-24, sy, 28.5), (32, sy, 28.5), 1.8, CRANE)
        k.railing((-24, sy * 1.55), (32, sy * 1.55), 27.6, DARK, spacing=2.5)
    k.box((4, 4, 3.4), (20, -5.5, 26), DARK)
    k.windows(18.4, 21.6, -7.56, 26.2, WARM, spacing=1.1, w=0.9, h=1.4, gaps=0)
    k.figure((24, -4.6, 29.4), "#c9a85a")
    for x in (-24, 32):
        k.light((x, 0, 29.8), AMBER, 2.4, "y", 0.4)
    # Stacks under the crane are separate instanced containers; here only
    # the yard markings and a Saltline office kiosk.
    k.box((7, 5, 3.4), (26, 12, 1.7), "#5c5a54")
    k.windows(23.5, 28.5, 9.44, 2.2, WARM, spacing=1.6, w=1.1, h=1.0, gaps=0)
    sign("lg_yard", root, (26, 8.6, 5.4), 9, 2.4, backing="#3a2a20", frame=SALT, kit=k)
    k.bake("lg_crane", root)
    trolley = c.group("lg_crane_trolley", root, (0, 0, 29.6))
    t = Kit(63)
    t.box((5, 9, 2), (0, 0, 0.6), CRANE)
    t.box((3, 3, 1.4), (0, 0, 2), DARK)
    t.light((0, -4.6, 0.6), AMBER, 2.4, "x", 0.3)
    t.bake("lg_crane_trolley", trolley)
    cable = c.group("lg_crane_cable", trolley, (0, 0, 0))
    cb = Kit(64)
    for sx in (-0.8, 0.8):
        for sy in (-3, 3):
            cb.beam((sx, sy, 0), (sx, sy, -1), 0.1, DARK)
    cb.bake("lg_crane_cable", cable)
    hoist = c.group("lg_crane_hoist", trolley, (0, 0, -12))
    h = Kit(65)
    h.box((2.8, 12.6, 0.6), (0, 0, 0), CRANE)
    container_parts(h, (0, 0, -2.9), SALT)
    h.box((2.5, 4, 0.14), (0, 3.5, -0.24), CREAM)
    sign("lg_saltline", hoist, (0, -2.0, -0.18), 2.2, 6.6, flat=True)
    h.bake("lg_crane_hoist", hoist)
    return finish("lg_crane")


def bay():
    """A side bay facing -X (toward the lane); the renderer mirrors it."""
    c.reset()
    root = c.root("lg_bay")
    k = Kit(66)
    k.box((16, 12, 1), (8, 0, 0), CONCRETE)
    k.box((16, 12, 1.2), (8, 0, 9.4), STEEL)
    k.box((1.4, 12, 10), (15.3, 0, 5), STEEL)
    for y in (-5.6, 5.6):
        k.box((16, 0.8, 10), (8, y, 5), STEEL)
    k.panels(8, 0, 15, 11, 10, "#626870", n=5, max_size=3)
    for y in (-2, 2):
        k.box((15, 0.3, 0.2), (8, y, 0.6), DARK)
    k.light((8, 0, 0.75), COOL, 12, "x", 0.25)
    k.hazard((0.2, -6), (0.2, 6), 10.0, 0.8, (AMBER, DARK), stripe=1.5)
    k.hazard((0.2, -5.2), (0.2, 5.2), 0.5, 0.8, (AMBER, DARK), stripe=1.5)
    k.light((0.4, 0, 10.4), WARM, 6, "y", 0.4)
    k.figure((5, -4, 0.5), "#7fa0a8", yaw=1.5)
    sign("lg_bay", root, (8.5, 0, 10.05), 6.4, 9.6, flat=True)
    k.bake("lg_bay", root)
    return finish("lg_bay")


def build():
    return [container(), crane(), bay()]
