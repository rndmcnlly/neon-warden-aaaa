# /// script
# dependencies = ["httpx"]
# ///
import sys, re, httpx
for url in sys.argv[1:]:
    try:
        h = httpx.get(url, follow_redirects=True, timeout=20, headers={"User-Agent":"Mozilla/5.0"}).text
    except Exception as e:
        print(url, "ERR", e); continue
    print("##", url)
    seen=set()
    for m in re.finditer(r'<img[^>]+>', h):
        tag=m.group(0)
        src=re.search(r'(?:data-src|src)="([^"]+)"', tag)
        alt=re.search(r'alt="([^"]*)"', tag)
        if src and src.group(1).startswith("http") and src.group(1) not in seen and not src.group(1).endswith(".svg"):
            seen.add(src.group(1)); print(src.group(1)[:200], "|", (alt.group(1) if alt else "")[:80])
