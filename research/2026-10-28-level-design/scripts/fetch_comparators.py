# /// script
# requires-python = ">=3.11"
# ///
"""Fetch official Steam store screenshots for level-design comparators.
Resolves app ids with the public storesearch API, then appdetails.
Downloaded files are untrusted data: JPEG only (header checked), fixed names,
never executed. Usage: fetch_comparators.py OUT_DIR"""
import json, sys, urllib.parse, urllib.request, pathlib

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
TERMS = {
    "dodonpachi": "DoDonPachi Resurrection",
    "radiant-silvergun": "Radiant Silvergun",
    "ikaruga": "Ikaruga",
    "sky-force": "Sky Force Reloaded",
    "thumper": "Thumper",
    "rez": "Rez Infinite",
    "ex-zodiac": "Ex-Zodiac",
    "cygni": "CYGNI: All Guns Blazing",
    "returnal": "Returnal",
}
UA = {"User-Agent": "Mozilla/5.0"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()

for slug, term in TERMS.items():
    try:
        q = urllib.parse.quote(term)
        res = json.loads(get(f"https://store.steampowered.com/api/storesearch/?term={q}&cc=us&l=en"))
        items = res.get("items", [])
        if not items:
            print(slug, "not found"); continue
        app = items[0]
        appid = app["id"]
        d = json.loads(get(f"https://store.steampowered.com/api/appdetails?appids={appid}&filters=basic,screenshots"))[str(appid)]
        shots = d["data"].get("screenshots", [])[:8] if d.get("success") else []
        print(slug, appid, app["name"], len(shots))
        for i, s in enumerate(shots):
            u = s["path_full"].split("?")[0]
            img = get(u)
            if img[:3] != b"\xff\xd8\xff":
                print("  not a jpeg, skipped"); continue
            (OUT / f"{slug}-{i}.jpg").write_bytes(img)
    except Exception as e:
        print(slug, "error", e)
