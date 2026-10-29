"""World kit: kitbash helpers for the sector set pieces (Blender as code).

Units are meters; the renderer scales them (src/world/kit.ts). Axes, before
glTF's Y-up conversion: X lateral, +Y forward along the route (up the screen),
+Z up toward the near-top-down gameplay camera. The camera sees mostly top
faces and a little of the -Y faces, so detail goes there.

Draw-call discipline: every part is vertex-colored and merged into at most two
meshes per node: `<node>_body` (lit PBR) and `<node>_lit_emit` (self-lit
lights the renderer draws unshaded). A set piece is two draw calls plus two
per moving pivot, and instancing-friendly as a result.

Scale cues are the point of the kit: windows, railings, ladders, bar lights
and panel seams at human scale, so a 100 m truss reads as 100 m, not as a box.
Lights are bars (aspect 3:1 or more), never round dots that resemble bullets.
Signs are empties named `sign__<id>` (tilted toward the camera) or
`paint__<id>` (flat on a deck); their glTF scale carries the panel size in
meters (x = width, z = height after Y-up conversion). The renderer paints
localized text on them.
"""

import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import common as c  # noqa: E402

REPO = c.REPO
OUT_DIR = os.path.join(REPO, "public", "models", "world")
STATS_DIR = os.path.join(HERE, "stats")
RENDERS_DIR = os.path.join(REPO, "research", "2026-10-29-sector-worlds-v2", "renders")
# The gameplay camera tilt (src/render/cameraRig.ts GAMEPLAY_TILT): signs face it.
TILT = 0.47
# Every glow mesh shares this name; the renderer swaps it for an unlit material.
LIT = "world_lit_emit"
BODY = "world_body"


def materials():
    if BODY in c._MATS:
        return c._MATS[BODY], c._MATS[LIT]
    body = c.mat(BODY, "#ffffff", metallic=0.35, roughness=0.72)
    lit = c.mat(LIT, "#ffffff", emit="#ffffff", strength=2.0)
    for m in (body, lit):
        # Vertex colors drive base color in the preview, as they will in three.js.
        nt = m.node_tree
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Col"
        p = nt.nodes["Principled BSDF"]
        nt.links.new(attr.outputs["Color"], p.inputs["Base Color"])
        if m is lit:
            nt.links.new(attr.outputs["Color"], p.inputs["Emission Color"])
    return body, lit


def strut(p0, p1, w, h=None):
    """Square bar of width w (height h) between two 3D points."""
    h = w if h is None else h
    a, b = Vector(p0), Vector(p1)
    d = b - a
    length = d.length or 1e-4
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return c.transform(c.box(w, h, length), (a + b) / 2, rot)


def rock(r, seed, sx=1.0, sy=1.0, sz=1.0, n=7):
    """Faceted asteroid chunk: a jittered latitude-longitude hull."""
    rnd = random.Random(seed)
    rings = 4
    verts = [(0, 0, -r * sz)]
    for i in range(1, rings):
        phi = math.pi * i / rings - math.pi / 2
        for j in range(n):
            th = 2 * math.pi * (j + 0.5 * (i % 2)) / n
            k = r * rnd.uniform(0.7, 1.15)
            verts.append((k * math.cos(phi) * math.cos(th) * sx,
                          k * math.cos(phi) * math.sin(th) * sy, k * math.sin(phi) * sz))
    verts.append((0, 0, r * sz))
    faces = [[0, 1 + (j + 1) % n, 1 + j] for j in range(n)]
    for i in range(rings - 2):
        a0, b0 = 1 + i * n, 1 + (i + 1) * n
        for j in range(n):
            faces.append([a0 + j, a0 + (j + 1) % n, b0 + (j + 1) % n, b0 + j])
    top = len(verts) - 1
    last = 1 + (rings - 2) * n
    faces += [[last + j, last + (j + 1) % n, top] for j in range(n)]
    return verts, faces


class Kit:
    """Collects vertex-colored parts, then bakes them into body + lit meshes."""

    def __init__(self, seed=1):
        self.body = []
        self.lit = []
        self.rnd = random.Random(seed)

    def add(self, part, color, lit=False, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
        (self.lit if lit else self.body).append((c.transform(part, loc, rot, scale), color))

    def box(self, size, at, color, rot=(0, 0, 0), lit=False):
        self.add(c.box(*size), color, lit, at, rot)

    def cyl(self, r, h, at, color, n=12, rot=(0, 0, 0), r_top=None, lit=False):
        self.add(c.cylinder(r, h, n, r_top), color, lit, at, rot)

    def beam(self, p0, p1, w, color, lit=False):
        self.add(strut(p0, p1, w), color, lit)

    def light(self, at, color, length=1.6, axis="x", w=0.4):
        """A bar light: elongated on purpose, never a bullet-like dot."""
        size = {"x": (length, w, w), "y": (w, length, w), "z": (w, w, length)}[axis]
        self.box(size, at, color, lit=True)

    def windows(self, x0, x1, y, z, color, spacing=2.2, w=1.3, h=0.8, face="front",
                gaps=0.15):
        """A row of lit windows; a few are dark, as in any inhabited building."""
        n = max(1, int((x1 - x0) / spacing))
        for i in range(n):
            if self.rnd.random() < gaps:
                continue
            x = x0 + (i + 0.5) * (x1 - x0) / n
            if face == "front":    # on a -Y face, visible to the tilted camera
                self.box((w, 0.12, h), (x, y, z), color, lit=True)
            else:                  # a skylight on a top face
                self.box((w, h, 0.12), (x, y, z), color, lit=True)

    def railing(self, p0, p1, z, color, h=1.1, spacing=2.0):
        a, b = Vector((*p0, z)), Vector((*p1, z))
        n = max(1, int((b - a).length / spacing))
        for i in range(n + 1):
            p = a.lerp(b, i / n)
            self.beam(p, p + Vector((0, 0, h)), 0.12, color)
        self.beam(a + Vector((0, 0, h)), b + Vector((0, 0, h)), 0.1, color)
        self.beam(a + Vector((0, 0, h * 0.5)), b + Vector((0, 0, h * 0.5)), 0.07, color)

    def ladder(self, x, y, z0, z1, color, w=0.6):
        for s in (-1, 1):
            self.beam((x + s * w / 2, y, z0), (x + s * w / 2, y, z1), 0.08, color)
        z = z0 + 0.3
        while z < z1:
            self.beam((x - w / 2, y, z), (x + w / 2, y, z), 0.05, color)
            z += 0.35

    def panels(self, cx, cy, sx, sy, z, color, n=6, max_size=4.0):
        """Raised hatches and service plates on a top face (panel seams)."""
        for _ in range(n):
            w = self.rnd.uniform(1.0, max_size)
            d = self.rnd.uniform(1.0, max_size)
            x = cx + self.rnd.uniform(-(sx - w) / 2, (sx - w) / 2)
            y = cy + self.rnd.uniform(-(sy - d) / 2, (sy - d) / 2)
            self.box((w, d, 0.25), (x, y, z + 0.12), color)

    def hazard(self, p0, p1, z, w, colors=("#b8a24a", "#24262a"), stripe=1.2, lit=False):
        """Painted chevron stripes along a deck edge or barrier arm."""
        a, b = Vector(p0), Vector(p1)
        n = max(1, int((b - a).length / stripe))
        for i in range(n):
            q0, q1 = a.lerp(b, i / n), a.lerp(b, (i + 1) / n)
            self.add(c.strip((q0.x, q0.y), (q1.x, q1.y), w, z, z + 0.08),
                     colors[i % 2], lit)

    def figure(self, at, color="#c9b07a", yaw=0.0):
        """A worker at true human scale (1.8 m): a scale cue, not a character."""
        x, y, z = at
        self.box((0.55, 0.35, 0.9), (x, y, z + 1.05), color, (0, 0, yaw))
        self.box((0.3, 0.3, 0.3), (x, y, z + 1.65), "#d8d4c8", (0, 0, yaw))
        self.box((0.5, 0.3, 0.6), (x, y, z + 0.3), "#3a3e44", (0, 0, yaw))

    def bake(self, name, parent):
        """Merge collected parts into `<name>_body` and `<name>_lit_emit`."""
        body_m, lit_m = materials()
        made = []
        for parts, m, suffix in ((self.body, body_m, "_body"), (self.lit, lit_m, "_lit_emit")):
            if not parts:
                continue
            verts, faces, cols = [], [], []
            for (v, f), color in parts:
                off = len(verts)
                verts += list(v)
                faces += [[i + off for i in face] for face in f]
                cols += [c.rgb(color)] * len(v)
            o = c.obj(name + suffix, (verts, faces), m, parent)
            attr = o.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
            for i, col in enumerate(cols):
                attr.data[i].color = col
            o.data.color_attributes.active_color = attr
            made.append(o)
        self.body, self.lit = [], []
        return made


def sign(name, parent, at, w, h, flat=False, backing="#1d2126", frame="#5d646b", kit=None):
    """A localized sign: empty sized in meters plus its physical backing plate."""
    o = c.group(("paint__" if flat else "sign__") + name, parent, at,
                (0, 0, 0) if flat else (TILT, 0, 0))
    o.scale = (w, h, 1)  # glTF: scale.x = width, scale.z = height (Y-up swap)
    if kit is not None:
        rot = (0, 0, 0) if flat else (TILT, 0, 0)
        if not flat:
            kit.add(c.box(w + 0.6, h + 0.6, 0.2), frame, False, at, rot)
            kit.add(c.box(w + 0.2, h + 0.2, 0.1), backing, False,
                    Vector(at) + Vector((0, -0.12 * math.sin(TILT), 0.12 * math.cos(TILT))), rot)
    return o


def export(name):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_apply=True, export_yup=True,
        export_texcoords=False, export_normals=True, export_tangents=False,
        export_materials="EXPORT", export_vertex_color="ACTIVE",
        export_cameras=False, export_lights=False, export_animations=False,
        export_extras=False,
    )
    return path


def finish(name, render=True):
    """Export, write stats and an optional two-view preview sheet."""
    c.STATS_DIR, c.RENDERS_DIR = STATS_DIR, RENDERS_DIR
    path = export(name)
    total, per = c.tri_count()
    os.makedirs(STATS_DIR, exist_ok=True)
    stats = {
        "asset": name,
        "file": os.path.relpath(path, REPO),
        "bytes": os.path.getsize(path),
        "triangles": total,
        "meshes": sum(1 for o in bpy.context.scene.objects if o.type == "MESH"),
        "nodes": c.node_names(),
        "triangles_per_node": per,
        # Blender meters, Z up: [min x, min y, min z, max x, max y, max z].
        "bounds": [round(v, 2) for v in (*c._bounds()[0], *c._bounds()[1])],
        # Sign panels in meters [width, height], for texture budgets.
        "signs": {o.name: [round(o.scale.x, 2), round(o.scale.y, 2)]
                  for o in bpy.context.scene.objects
                  if o.name.startswith(("sign__", "paint__"))},
    }
    with open(os.path.join(STATS_DIR, name + ".json"), "w") as f:
        json.dump(stats, f, indent=2)
    if render and "--no-render" not in sys.argv:
        c.preview(name, [(-30, 32), (0, 63)], tile=420)
    print(f"[world] {name}: {total} tris, {stats['meshes']} meshes, {stats['bytes']} bytes")
    return stats
