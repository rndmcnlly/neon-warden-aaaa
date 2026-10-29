"""Rebuild every asset inside this one Blender process.

    blender -b --factory-startup -P art/blender/build_all.py              # export + previews
    blender -b --factory-startup -P art/blender/build_all.py -- --no-render   # export only
    blender -b --factory-startup -P art/blender/build_all.py -- drone warden  # a subset

Each asset script runs as if launched on its own (runpy, as __main__), and
each one begins with common.reset(), which reloads factory settings into an
empty scene, so no objects, materials or render settings leak between
assets. One process also means one Dock icon on macOS instead of eleven.

Writes public/models/*.glb, art/blender/stats/*.json, and
public/models/manifest.json (triangles, bytes, node names per asset).
"""

import json
import os
import runpy
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ASSETS = [
    "pilot_ship", "drone", "dart", "turret", "lancer", "warden",
    "pickup_spread", "pickup_shield", "pilot_figure_issued", "pilot_figure_worn",
    "logo_adamsmith_systems", "logo_cm121",
]

sys.path.insert(0, HERE)
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
wanted = [a for a in args if not a.startswith("--")] or ASSETS

failed = []
start = time.time()
for name in wanted:
    if name not in ASSETS:
        print(f"[art] {name}: FAILED (unknown asset; known: {', '.join(ASSETS)})")
        failed.append(name)
        continue
    try:
        runpy.run_path(os.path.join(HERE, name + ".py"), run_name="__main__")
    except Exception:
        traceback.print_exc()
        print(f"[art] {name}: FAILED")
        failed.append(name)

manifest = {}
for name in ASSETS:
    p = os.path.join(HERE, "stats", name + ".json")
    if os.path.exists(p):
        s = json.load(open(p))
        manifest[name] = {k: s[k] for k in ("file", "bytes", "triangles", "nodes",
                                            "emissive_materials")}
with open(os.path.join(REPO, "public", "models", "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)
print(f"[art] total {sum(m['triangles'] for m in manifest.values())} tris;"
      f" {time.time() - start:.1f} s; failed: {failed or 'none'}")
