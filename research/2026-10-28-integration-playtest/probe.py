# /// script
# dependencies = ["playwright"]
# ///
"""Exploratory probe: press keys and print which screen and element has focus."""
import sys
import glob
from playwright.sync_api import sync_playwright

# Reuse whichever headless shell is already installed (no download).
SHELL = sorted(glob.glob(__import__("os").path.expanduser(
    "~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell")))[-1]

URL = sys.argv[1]
KEYS = sys.argv[2].split(",") if len(sys.argv) > 2 else []
STATE = """() => {
  const a = document.activeElement;
  const screens = [...document.querySelectorAll('.nw-screens > *')].map(s => s.dataset.screen || s.id || s.className);
  return {screens, focus: a ? (a.dataset.key || a.textContent.trim().slice(0,40)) : null};
}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=SHELL, args=["--use-gl=angle", "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    errs = []
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    pg.goto(URL); pg.wait_for_timeout(1500)
    print("start", pg.evaluate(STATE))
    for k in KEYS:
        if k.startswith("wait"):
            pg.wait_for_timeout(int(k[4:])); continue
        pg.keyboard.press(k); pg.wait_for_timeout(350)
        print(k, pg.evaluate(STATE))
    print("\n".join(errs[:20]))
    b.close()
