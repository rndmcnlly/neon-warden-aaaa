"""Atomic update of this workstream's own entry in production/status.json.

Reads, parses, replaces only the entry whose owner is "Trailer render", then
writes a temp file and renames it over the original (never truncates first).

    python3 research/2026-10-29-trailer-render/status.py <status> <detail>
"""
import json, os, sys, tempfile, datetime

PATH = os.path.join(os.path.dirname(__file__), "../../production/status.json")
OWNER = "Trailer render"
status, detail = sys.argv[1], sys.argv[2]
with open(PATH) as f:
    data = json.load(f)
entry = {
    "title": "Trailer masters: teaser30, trailer90, compendium120 x EN/ES/ZH",
    "owner": OWNER,
    "status": status,
    "detail": detail,
    "updated": datetime.date.today().isoformat(),
    "revision": "build f9b72a422589c40f from 73f6cf7",
}
tasks = [t for t in data["tasks"] if t.get("owner") != OWNER]
tasks.append(entry)
data["tasks"] = tasks
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(PATH), suffix=".tmp")
with os.fdopen(fd, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
os.replace(tmp, PATH)
print("ok", len(tasks), "tasks")
