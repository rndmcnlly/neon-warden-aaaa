"""Shared toolkit for Neon Warden AAAA asset scripts (Blender 5.2, headless).

Every asset script does the same four things:

    import common as c
    c.reset()                      # empty scene
    root = c.root("drone")         # empty named after the asset
    ...build meshes, parent them to root...
    c.finish("drone")              # export .glb, write stats, render preview

Conventions (the renderer codes against these; see README.md):

- Units: 1 Blender unit = 10 original pixels (the 480 x 640 playfield is
  48 x 64 units). Exception: pilot_figure is authored in meters (1.8 tall).
- Axes: authored in Blender Z-up; the glTF exporter converts to Y-up, so
  Blender +Y becomes glTF -Z. Gameplay meshes lie in the playfield plane
  (glTF XZ) with "up the screen" = glTF -Z. The player ship's nose points
  -Z; enemies face +Z (toward the player). Logos and the figure face +Z.
- Emissive trims are separate objects with their own material whose name
  ends in "_emit", so bloom (and per-part flashing) can find them.
- Node names use only [a-z0-9_] so three.js keeps them verbatim.
"""

import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
MODELS_DIR = os.path.join(REPO, "public", "models")
RENDERS_DIR = os.path.join(REPO, "research", "2026-10-28-art-renders")
STATS_DIR = os.path.join(HERE, "stats")
FONT_PATH = os.path.join(HERE, "fonts", "Orbitron.ttf")

# Palette from the original textures.ts / style.css (sRGB hex).
PALETTE = {
    "void": "#04020c",
    "deep_violet": "#1a0f3a",
    "panel": "#0e0a22",
    "ice": "#e8fdff",
    "cyan": "#5ef2ff",
    "pale_cyan": "#c8fbff",
    "pink": "#ff5ea8",
    "shot_pink": "#ff7bd5",
    "amber": "#ffb84d",
    "violet": "#9d7bff",
    "mint": "#7dff9b",
    "crimson": "#ff4d6d",
    "gold": "#ffe066",
    "heavy_gold": "#ffd24d",
    "cream": "#ffe8b0",
    "slate": "#6f86a8",
    "slate_light": "#8aa4c8",
}

EMIT_STRENGTH = 6.0  # exported via KHR_materials_emissive_strength


# ---------------------------------------------------------------- color


def srgb_to_linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def rgb(hex_or_name, scale=1.0):
    """Linear RGBA from a palette name or '#rrggbb'; scale darkens/brightens."""
    h = PALETTE.get(hex_or_name, hex_or_name).lstrip("#")
    lin = [srgb_to_linear(int(h[i : i + 2], 16) / 255) * scale for i in (0, 2, 4)]
    return (*[min(x, 1.0) for x in lin], 1.0)


# ---------------------------------------------------------------- materials

_MATS = {}


def mat(name, color, metallic=0.0, roughness=0.5, coat=0.0, emit=None,
        strength=EMIT_STRENGTH, alpha=1.0, transmission=0.0):
    """Principled BSDF material, cached by name.

    emit: palette name or hex for emission; emissive materials should be
    named with an '_emit' suffix (enforced here) so the renderer can find
    them by name.
    """
    if emit is not None and not name.endswith("_emit"):
        name += "_emit"
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = rgb(color)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Coat Weight"].default_value = coat
    if emit is not None:
        p.inputs["Emission Color"].default_value = rgb(emit)
        p.inputs["Emission Strength"].default_value = strength
    if transmission:
        p.inputs["Transmission Weight"].default_value = transmission
    if alpha < 1.0:
        p.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    _MATS[name] = m
    return m


def emit(name, color, strength=EMIT_STRENGTH):
    """Pure emissive trim: dark base so it reads as light, not paint."""
    return mat(name, color, roughness=0.4, emit=color, strength=strength)


# ---------------------------------------------------------------- scene


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()


def root(name):
    o = bpy.data.objects.new(name, None)
    o.empty_display_type = "PLAIN_AXES"
    bpy.context.scene.collection.objects.link(o)
    return o


def group(name, parent, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Empty used as a pivot node (for example a rotating crown)."""
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o


def obj(name, mesh_data, material, parent=None, loc=(0, 0, 0), rot=(0, 0, 0),
        scale=(1, 1, 1), smooth=False):
    """Wrap (verts, faces) or a bpy Mesh in an object."""
    if isinstance(mesh_data, tuple):
        verts, faces = mesh_data
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in verts], [], faces)
        me.validate()
        # Generators are closed shells; let bmesh make every normal point
        # outward so outline winding (CW or CCW) never matters.
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        me.update()
    else:
        me = mesh_data
        me.name = name
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if material is not None:
        me.materials.append(material)
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    for poly in me.polygons:
        poly.use_smooth = smooth
    if smooth:
        # Smooth curved surfaces but keep caps and creases crisp (the 4.1+
        # replacement for the old auto-smooth checkbox).
        me.set_sharp_from_angle(angle=math.radians(40))
    return o


def linked_copy(src, name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0),
                scale=(1, 1, 1)):
    o = src.copy()  # shares mesh data; exporter writes one mesh
    o.name = name
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent if parent is not None else src.parent
    o.location, o.rotation_euler, o.scale = loc, rot, scale
    return o


# ---------------------------------------------------------------- modifiers


def bevel(o, width=0.05, segments=1, angle=40):
    m = o.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.harden_normals = True
    return o


def mirror_x(o):
    m = o.modifiers.new("mirror", "MIRROR")
    m.use_axis = (True, False, False)
    m.use_clip = True
    return o


def wireframe(o, thickness=0.05):
    m = o.modifiers.new("wire", "WIREFRAME")
    m.thickness = thickness
    m.use_even_offset = True
    return o


def weighted_normals(o):
    o.modifiers.new("wn", "WEIGHTED_NORMAL").keep_sharp = True
    return o


# ---------------------------------------------------------------- mesh generators
# All return (verts, faces) for obj(). 2D outlines are lists of (x, y) in
# counter-clockwise order, lying in Blender XY (the playfield plane).


def prism(outline, z0, z1, top_scale=1.0, top_offset=(0, 0)):
    """Extrude a 2D outline from z0 to z1; top cap scaled toward its centroid."""
    n = len(outline)
    cx = sum(p[0] for p in outline) / n
    cy = sum(p[1] for p in outline) / n
    bot = [(x, y, z0) for x, y in outline]
    top = [(cx + (x - cx) * top_scale + top_offset[0],
            cy + (y - cy) * top_scale + top_offset[1], z1) for x, y in outline]
    verts = bot + top
    faces = [list(reversed(range(n))), [n + i for i in range(n)]]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    return verts, faces


def box(sx, sy, sz, center=(0, 0, 0)):
    cx, cy, cz = center
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    outline = [(cx - hx, cy - hy), (cx + hx, cy - hy), (cx + hx, cy + hy),
               (cx - hx, cy + hy)]
    return prism(outline, cz - hz, cz + hz)


def ngon(r, n, phase=0.0, sx=1.0, sy=1.0):
    return [(r * sx * math.cos(phase + 2 * math.pi * i / n),
             r * sy * math.sin(phase + 2 * math.pi * i / n)) for i in range(n)]


def cylinder(r, h, n=16, r_top=None, z0=None):
    """Vertical (Z) cylinder or frustum centered on the origin."""
    r_top = r if r_top is None else r_top
    z0 = -h / 2 if z0 is None else z0
    return prism(ngon(r, n), z0, z0 + h, top_scale=r_top / r if r else 1)


def cone(r, h, n=12, z0=0.0):
    verts = [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z0)
             for i in range(n)] + [(0, 0, z0 + h)]
    faces = [list(reversed(range(n)))] + [[i, (i + 1) % n, n] for i in range(n)]
    return verts, faces


def torus(R, r, seg=32, sides=8, sx=1.0, sy=1.0):
    """Ring lying in XY (axis Z). sx/sy stretch it into an ellipse."""
    verts, faces = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for j in range(sides):
            b = 2 * math.pi * j / sides
            rr = R + r * math.cos(b)
            verts.append((rr * math.cos(a) * sx, rr * math.sin(a) * sy, r * math.sin(b)))
    for i in range(seg):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            c_ = ((i + 1) % seg) * sides + (j + 1) % sides
            d = ((i + 1) % seg) * sides + j
            faces.append([a, d, c_, b])
    return verts, faces


def uv_sphere(r, seg=16, rings=8, sx=1.0, sy=1.0, sz=1.0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return _bm_to_mesh(bm)


def ico(r, subdiv=1, sx=1.0, sy=1.0, sz=1.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return _bm_to_mesh(bm)


def bipyramid(r, h_top, h_bot, n=6, phase=0.0):
    """Crystal: n-gon belt with apexes above and below (axis Z)."""
    ring = [(x, y, 0.0) for x, y in ngon(r, n, phase)]
    verts = ring + [(0, 0, h_top), (0, 0, -h_bot)]
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n])
        faces.append([j, i, n + 1])
    return verts, faces


def strip(p0, p1, width, z0, z1):
    """Thin bar from 2D point p0 to p1 (for trims along an edge)."""
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln * width / 2, dx / ln * width / 2
    outline = [(x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny),
               (x0 + nx, y0 + ny)]
    return prism(outline, z0, z1)


def merge(*parts):
    """Concatenate several (verts, faces) into one mesh."""
    verts, faces = [], []
    for v, f in parts:
        off = len(verts)
        verts += list(v)
        faces += [[i + off for i in face] for face in f]
    return verts, faces


def transform(part, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """Bake a transform into (verts, faces)."""
    from mathutils import Euler
    m = (Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4()
         @ Matrix.Diagonal((*scale, 1)))
    v, f = part
    return [tuple(m @ Vector(p)) for p in v], f


def mirror_part(part):
    """Mirror (verts, faces) across X, flipping winding."""
    v, f = part
    return [(-x, y, z) for x, y, z in v], [list(reversed(face)) for face in f]


def _bm_to_mesh(bm):
    verts = [tuple(v.co) for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return verts, faces


def text_mesh(name, body, size=1.0, extrude=0.08, bevel_depth=0.015,
              align="CENTER", spacing=1.0):
    """Orbitron text as a real mesh (Blender XY plane, extruded along Z)."""
    cu = bpy.data.curves.new(name + "_curve", "FONT")
    cu.body = body
    if os.path.exists(FONT_PATH):
        cu.font = bpy.data.fonts.load(FONT_PATH, check_existing=True)
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = bevel_depth
    cu.bevel_resolution = 0
    cu.resolution_u = 2
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.space_character = spacing
    tmp = bpy.data.objects.new(name + "_tmp", cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    # Weld the curve tessellation so the exporter does not duplicate seams.
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    return me


def stand_up(o):
    """Rotate an XY-plane object (logo, text) to face Blender -Y (glTF +Z)."""
    o.rotation_euler = (math.radians(90), 0, 0)
    return o


# ---------------------------------------------------------------- stats and export


def tri_count(objs=None):
    dg = bpy.context.evaluated_depsgraph_get()
    total, per = 0, {}
    for o in objs or bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        n = len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
        per[o.name] = n
        total += n
    return total, per


def node_names():
    return sorted(o.name for o in bpy.context.scene.objects)


def export(name):
    os.makedirs(MODELS_DIR, exist_ok=True)
    path = os.path.join(MODELS_DIR, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,          # bake modifiers (bevels, mirrors, wires)
        export_yup=True,
        export_texcoords=False,     # no textures in this project
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=False,
    )
    return path


def write_stats(name, path):
    total, per = tri_count()
    os.makedirs(STATS_DIR, exist_ok=True)
    emissive = sorted(m.name for m in bpy.data.materials if m.name.endswith("_emit"))
    stats = {
        "asset": name,
        "file": os.path.relpath(path, REPO),
        "bytes": os.path.getsize(path),
        "triangles": total,
        "nodes": node_names(),
        "emissive_materials": emissive,
        "triangles_per_node": per,
    }
    with open(os.path.join(STATS_DIR, name + ".json"), "w") as f:
        json.dump(stats, f, indent=2)
    return stats


# ---------------------------------------------------------------- preview render


def _bounds(frame=None):
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and (frame is None or o.name in frame):
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def _look_at(cam, target):
    d = target - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def preview(name, views=None, tile=360, frame=None):
    """Four-view turntable sheet: three orbit angles plus the gameplay view.

    views: list of (azimuth_deg, elevation_deg); azimuth 0 looks from
    Blender -Y (the side enemies and logos face). Elevation 90 is top-down
    with screen-up = Blender +Y, i.e. the gameplay camera. frame: optional
    object names to frame (a close-up); name is then the output file stem.
    """
    import numpy as np

    sc = bpy.context.scene
    views = views or [(-35, 25), (55, 20), (150, 25), (0, 90)]
    lo, hi = _bounds(frame)
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 0.01)

    world = bpy.data.worlds.new("preview_world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = rgb("deep_violet", 0.6)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    sc.world = world

    def light(nm, kind, loc, energy, color=(1, 1, 1), size=None):
        ld = bpy.data.lights.new(nm, kind)
        ld.energy = energy
        ld.color = color
        if size is not None:
            ld.size = size
        lo_ = bpy.data.objects.new(nm, ld)
        sc.collection.objects.link(lo_)
        lo_.location = center + Vector(loc) * radius
        _look_at(lo_, center)
        return lo_

    r2 = radius * radius
    temp = [
        light("_key", "AREA", (-1.6, -2.0, 2.4), 450 * r2, (1.0, 0.95, 0.9), radius * 1.5),
        light("_rim", "AREA", (2.2, 2.2, 1.0), 320 * r2, (0.55, 0.85, 1.0), radius),
        light("_fill", "AREA", (2.0, -1.5, -0.6), 120 * r2, (0.9, 0.6, 1.0), radius),
    ]
    camd = bpy.data.cameras.new("_cam")
    camd.lens = 60
    cam = bpy.data.objects.new("_cam", camd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    temp.append(cam)

    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 24
    sc.render.resolution_x = tile
    sc.render.resolution_y = tile
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Punchy"

    tmp_dir = os.path.join(STATS_DIR, "_tiles")
    os.makedirs(tmp_dir, exist_ok=True)
    fov_dist = radius / math.tan(camd.angle / 2) * 1.08
    tiles = []
    for k, (az, el) in enumerate(views):
        a, e = math.radians(az), math.radians(el)
        dirv = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = center + dirv * fov_dist
        if el >= 89.9:
            cam.rotation_euler = (0, 0, 0)  # straight down, screen-up = +Y
        else:
            _look_at(cam, center)
        p = os.path.join(tmp_dir, f"{name}_{k}.png")
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(p)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(tile, tile, 4)
        tiles.append(px)
        bpy.data.images.remove(img)
        os.remove(p)

    sheet = np.concatenate(tiles, axis=1)  # one row, bottom-up pixel order
    out = bpy.data.images.new(name + "_sheet", tile * len(tiles), tile, alpha=True)
    out.pixels[:] = sheet.ravel()
    os.makedirs(RENDERS_DIR, exist_ok=True)
    out.filepath_raw = os.path.join(RENDERS_DIR, name + ".png")
    out.file_format = "PNG"
    out.save()

    for o in temp:
        bpy.data.objects.remove(o)
    try:
        os.rmdir(tmp_dir)
    except OSError:
        pass


def finish(name, views=None, render=True):
    """Export first (so lights/cameras never leak into the glb), then preview."""
    path = export(name)
    stats = write_stats(name, path)
    if render and "--no-render" not in sys.argv:
        preview(name, views)
    print(f"[art] {name}: {stats['triangles']} tris, {stats['bytes']} bytes -> {stats['file']}")
    return stats
