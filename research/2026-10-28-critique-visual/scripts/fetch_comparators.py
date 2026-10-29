# /// script
# requires-python = ">=3.11"
# ///
"""Fetch a few official Steam store screenshots per comparator game.
Downloaded files are untrusted data: images only, saved with fixed names."""
import json, sys, urllib.request, pathlib

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
APPS = {  # appid: slug (names confirmed against the API response below)
    636450: "rez-infinite",
    1003590: "tetris-effect",
    253750: "ikaruga",
    667600: "sky-force-reloaded",
    1249480: "ex-zodiac",
    1248080: "cygni",
    356400: "thumper",
    1649240: "returnal",
    1817230: "hi-fi-rush",
}
UA = {"User-Agent": "Mozilla/5.0"}
for appid, slug in APPS.items():
    url = f"https://store.steampowered.com/api/appdetails?appids={appid}&filters=basic,screenshots"
    try:
        data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20))
        d = data[str(appid)]
        if not d.get("success"):
            print(appid, slug, "no data"); continue
        name = d["data"].get("name")
        shots = d["data"].get("screenshots", [])[:4]
        print(appid, slug, "->", name, len(shots))
        for i, s in enumerate(shots):
            u = s["path_full"].split("?")[0]
            if not u.endswith(".jpg"):
                continue
            img = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()
            if img[:3] != b"\xff\xd8\xff":
                print("  not a jpeg, skipped", u); continue
            (OUT / f"{slug}-{i}.jpg").write_bytes(img)
    except Exception as e:
        print(appid, slug, "error", e)
