# /// script
# dependencies = ["playwright"]
# ///
"""
Integration playtest for Neon Warden against `deno task preview`.

    uv run --script research/2026-10-28-integration-playtest/playtest.py [base]

Runs four checks and prints a JSON report (also written next to this file):
  a. keyboard-only front end and a skip-to run, pause, quit to menu
  b. ?autoplay=fight&speed=16 until the kill ending
  c. ?autoplay=pacifist&speed=16 until the pacifist ending
  d. Extras screen in es and zh at 1280x800 and 800x600: no panel overflows
Screenshots (JPEG, 1280x800, at most 8) land in this folder.
"""

import glob
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
HERE = os.path.dirname(os.path.abspath(__file__))
# Reuse whichever headless shell is already installed (no download).
SHELL = sorted(glob.glob(os.path.expanduser(
    "~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell")))[-1]

STATE = """() => {
  const a = document.activeElement;
  return {
    screens: [...document.querySelectorAll('.nw-screens > *')]
      .map(s => s.className.replace('nw-screen ', '')),
    focus: a ? (a.dataset.key || a.textContent.trim().slice(0, 30)) : null,
    dev: document.querySelector('.dev-overlay p')?.textContent ?? null,
    subtitle: document.querySelector('.nw-subtitle-live:not([hidden])')?.textContent ?? null,
  };
}"""

report = {"base": BASE, "checks": {}, "console": {}}
shots = []


def shoot(page, name):
    if len(shots) >= 8:
        return
    path = os.path.join(HERE, f"{len(shots) + 1:02d}-{name}.jpg")
    page.screenshot(path=path, type="jpeg", quality=70)
    shots.append(os.path.basename(path))


def new_page(browser, name, width=1280, height=800, storage=None):
    ctx = browser.new_context(viewport={"width": width, "height": height})
    if storage:
        ctx.add_init_script(
            f"localStorage.setItem('neon-warden.settings', {json.dumps(json.dumps(storage))})")
    page = ctx.new_page()
    errors = report["console"].setdefault(name, [])
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}")
            if m.type in ("error",) else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    return page


def keys(page, seq, log, gap=300):
    for k in seq:
        page.keyboard.press(k)
        page.wait_for_timeout(gap)
        log.append({"key": k, **page.evaluate(STATE)})


def settings_of(page):
    raw = page.evaluate("() => localStorage.getItem('neon-warden.settings')")
    return json.loads(raw) if raw else None


def check_keyboard(browser):
    page = new_page(browser, "a-keyboard")
    log = []
    page.goto(BASE)
    page.wait_for_timeout(1200)
    keys(page, ["Space"], log, 600)          # gate
    keys(page, ["Enter"], log, 1500)         # notice -> logos
    shoot(page, "logos")
    keys(page, ["Enter"], log, 800)          # skip logos -> title
    keys(page, ["Enter"], log, 600)          # title -> main menu
    shoot(page, "main-menu")
    keys(page, ["ArrowDown", "ArrowDown", "Enter"], log)  # settings
    # Subtitles tab, then the size slider two steps up.
    keys(page, ["ArrowRight", "ArrowRight", "ArrowRight", "Enter"], log)
    keys(page, ["ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight"], log)
    scale = ((settings_of(page) or {}).get("settings") or {}).get("subtitles")
    shoot(page, "settings-subtitles")
    # Controls tab: up to the tab row, right to controls, activate.
    keys(page, ["ArrowUp", "ArrowUp", "ArrowUp", "ArrowRight", "ArrowRight", "Enter"], log)
    keys(page, ["ArrowDown", "Enter"], log)  # first rebind cell: capture
    keys(page, ["KeyJ"], log, 500)            # new key
    after = settings_of(page)
    keys(page, ["Escape"], log, 500)          # back to main menu
    keys(page, ["ArrowUp", "ArrowUp", "Enter"], log, 500)  # new game
    keys(page, ["ArrowDown", "Enter"], log, 2500)  # Start (tutorial)
    keys(page, ["ArrowLeft", "ArrowLeft"], log, 400)  # tutorial: move left
    shoot(page, "new-game")
    report["checks"]["a-keyboard-menus"] = {"log": log, "settings": after, "early": scale}

    # Skip-to flashback, then pause and quit to the menu.
    page = new_page(browser, "a-flashback")
    log = []
    page.goto(BASE + "?skipto=flashback")
    page.wait_for_timeout(5000)
    log.append({"at": "flashback+5s", **page.evaluate(STATE)})
    shoot(page, "flashback")
    keys(page, ["Escape"], log, 600)          # pause
    keys(page, ["ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "Enter"], log, 400)
    # The quit dialog focuses Cancel (the safe choice); move off it.
    for k in ("ArrowLeft", "ArrowRight"):
        if page.evaluate(STATE)["focus"] != "cancel":
            break
        keys(page, [k], log)
    keys(page, ["Enter"], log, 1500)
    shoot(page, "quit-to-menu")
    report["checks"]["a-flashback-pause-quit"] = {"log": log}


def run_autoplay(browser, mode, want, budget_s=420):
    page = new_page(browser, f"autoplay-{mode}")
    page.goto(BASE + f"?autoplay={mode}&speed=16")
    t0 = time.time()
    samples = []
    seen_flashback = False
    while time.time() - t0 < budget_s:
        page.wait_for_timeout(3000)
        s = page.evaluate(STATE)
        samples.append({"t": round(time.time() - t0), "dev": s["dev"], "sub": s["subtitle"]})
        if s["dev"] and "sector 3" in s["dev"] and not seen_flashback:
            seen_flashback = True
        if s["dev"] and f"outcome {want}" in s["dev"]:
            page.wait_for_timeout(4000)
            shoot(page, f"ending-{mode}")
            return {"reached": True, "seconds": round(time.time() - t0), "samples": samples[-6:]}
    return {"reached": False, "samples": samples[-10:]}


def check_overflow(browser):
    results = []
    for lang in ("es", "zh"):
        for w, h in ((1280, 800), (800, 600)):
            page = new_page(browser, f"d-extras-{lang}-{w}", w, h, None)
            page.goto(BASE + "?ui=menu")
            page.wait_for_timeout(600)
            page.evaluate(
                """(lang) => { const k = 'neon-warden.settings';
                   // Partial settings merge with defaults on load.
                   const s = JSON.parse(localStorage.getItem(k)) ??
                     { version: 1, settings: {} };
                   s.settings.textLang = lang;
                   localStorage.setItem(k, JSON.stringify(s)); }""",
                lang)
            page.goto(BASE + "?ui=menu")
            page.wait_for_timeout(800)
            page.focus("[data-key=extras]")
            page.keyboard.press("Enter")
            page.wait_for_timeout(600)
            data = page.evaluate("""() => ({
              lang: document.documentElement.lang,
              title: [...document.querySelectorAll('.nw-panel h2, .nw-panel h1')].at(-1)?.textContent,
              panels: [...document.querySelectorAll('.nw-panel')].map(p => ({
                scroll: p.scrollWidth, client: p.clientWidth })),
            })""")
            data["ok"] = all(p["scroll"] <= p["client"] for p in data["panels"]) and bool(data["panels"])
            results.append({"lang": lang, "size": f"{w}x{h}", **data})
            if w == 800 and lang == "zh":
                page.set_viewport_size({"width": 1280, "height": 800})
                page.wait_for_timeout(300)
                shoot(page, "extras-zh")
    report["checks"]["d-extras-overflow"] = results


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=SHELL, args=["--use-gl=angle"])
    only = os.environ.get("ONLY", "abcd")
    if "a" in only:
        check_keyboard(browser)
    if "d" in only:
        check_overflow(browser)
    if "b" in only:
        report["checks"]["b-autoplay-fight"] = run_autoplay(browser, "fight", "bossDefeated")
    if "c" in only:
        report["checks"]["c-autoplay-pacifist"] = run_autoplay(browser, "pacifist", "bossSurvived")
    browser.close()

report["screenshots"] = shots
with open(os.path.join(HERE, f"report-{os.environ.get('ONLY', 'abcd')}.json"), "w") as f:
    json.dump(report, f, indent=1, ensure_ascii=False)
print(json.dumps(report, indent=1, ensure_ascii=False)[:6000])
