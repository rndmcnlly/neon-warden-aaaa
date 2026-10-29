# /// script
# dependencies = ["pillow"]
# ///
"""Mean luma of the world band (beside the lane) vs the lane, per desktop clip still."""
import json, os
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)) + "/out"
rows = []
for arm in ("before", "after", "after2"):
    for s in range(1, 6):
        p = f"{D}/{arm}-s{s}-desktop/mid.jpg"
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("L")
        w, h = im.size
        def mean(box):
            c = im.crop(box); px = list(c.getdata()); return sum(px) / len(px) / 255
        # Lane spans roughly 29%-71% of a 1366x768 frame; HUD rows excluded.
        side = (mean((int(w * .02), int(h * .12), int(w * .26), int(h * .85))) + mean((int(w * .74), int(h * .12), int(w * .98), int(h * .85)))) / 2
        lane = mean((int(w * .33), int(h * .12), int(w * .67), int(h * .80)))
        r = json.load(open(f"{D}/{arm}-s{s}-desktop/result.json"))
        sm = [x for x in r["samples"] if x.get("tick")]
        rate = (sm[-1]["tick"] - sm[0]["tick"]) / ((sm[-1]["t"] - sm[0]["t"]) / 1000)
        last = sm[-1].get("world") or {}
        rows.append({"arm": arm, "sector": s, "sideLuma": round(side, 3), "laneLuma": round(lane, 3), "ticksPerSecond": round(rate, 1),
                     "pageErrors": len(r["errors"]), "avChecks": {c["id"]: c["status"] for c in r["av"]["checks"]},
                     "world": {k: last.get(k) for k in ("tier", "drawCalls", "triangles", "textureBytes", "updateMs")}})
json.dump({"stills": rows, "budgets": json.load(open(f"{D}/budgets.json")), "stillsLowReduced": json.load(open(f"{D}/stills/stills.json"))}, open(f"{D}/../performance.json", "w"), indent=1)
for r in rows: print(r["arm"], r["sector"], r["sideLuma"], r["laneLuma"], r["ticksPerSecond"], r["world"].get("drawCalls"))
