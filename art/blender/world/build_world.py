"""Rebuild every sector set piece inside one Blender process.

    B=/Applications/Blender.app/Contents/MacOS/Blender
    $B -b --factory-startup -P art/blender/world/build_world.py                  # all
    $B -b --factory-startup -P art/blender/world/build_world.py -- gun_lanes     # one sector
    $B -b --factory-startup -P art/blender/world/build_world.py -- --no-render   # no previews

Writes public/models/world/<asset>.glb, `<asset>_lod.glb` for far-layer assets,
art/blender/world/stats/<asset>.json, public/models/world/manifest.json (what
the renderer and the budget test read) and preview sheets in
research/2026-10-29-sector-worlds-v2/renders/.
"""

import importlib
import json
import os
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

import bpy  # noqa: E402

import common as c  # noqa: E402
import kit  # noqa: E402

SECTORS = ["outer_drift", "shatter_belt", "gun_lanes", "lancer_gate", "last_approach"]
# Far-layer assets also ship a decimated level of detail for medium/low tiers.
LOD = {"od_waystation", "sb_rock", "gl_tower", "la_heartgate", "la_buttress"}

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
wanted = [a for a in args if not a.startswith("--")] or SECTORS
start = time.time()
failed = []
for name in wanted:
    try:
        importlib.import_module(name).build()
    except Exception:
        traceback.print_exc()
        failed.append(name)


def lod(asset, ratio=0.35):
    """Reload an exported asset, decimate it and export `<asset>_lod`."""
    c.reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(kit.OUT_DIR, asset + ".glb"))
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and len(o.data.polygons) > 60:
            m = o.modifiers.new("lod", "DECIMATE")
            m.ratio = ratio
    for o in bpy.context.scene.objects:
        # Sign and spark ids stay stable so the renderer finds their text.
        if "__" not in o.name:
            o.name = o.name.replace(asset, asset + "_lod", 1)
    kit.finish(asset + "_lod", render=False)


for asset in sorted(LOD):
    if os.path.exists(os.path.join(kit.OUT_DIR, asset + ".glb")):
        try:
            lod(asset)
        except Exception:
            traceback.print_exc()
            failed.append(asset + "_lod")

manifest = {}
for f in sorted(os.listdir(kit.STATS_DIR)):
    if f.endswith(".json"):
        s = json.load(open(os.path.join(kit.STATS_DIR, f)))
        manifest[s["asset"]] = {k: s[k] for k in ("file", "bytes", "triangles", "meshes", "nodes", "bounds", "signs")}
with open(os.path.join(kit.OUT_DIR, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)
print(f"[world] {len(manifest)} assets, {sum(m['triangles'] for m in manifest.values())} tris;"
      f" {time.time() - start:.1f} s; failed: {failed or 'none'}")
