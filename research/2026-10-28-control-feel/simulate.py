#!/usr/bin/env python3
"""Deterministic toy controller, NOT game code or a playtest. No dependencies.

Run: uv run --script research/2026-10-28-control-feel/simulate.py
Writes only beside this file. Units: original playfield pixels and seconds.
Semi-implicit Euler at 60 Hz: update speed, then integrate position.
"""
from pathlib import Path
import csv
import hashlib
import html
import json
import math

OUT = Path(__file__).resolve().parent
HZ = 60
DT = 1 / HZ
PROFILES = ("legacy", "classic", "ramp", "hybrid")
COLORS = dict(zip(PROFILES, ("#777777", "#1565c0", "#ba4a00", "#00846b")))


def sequence(*parts):
    return [dict(x=x, y=y, focus=f) for ticks, x, y, f in parts for _ in range(ticks)]


SCENARIOS = {
    "tap": sequence((6, 1, 0, False), (24, 0, 0, False)),
    "hold-release": sequence((60, 1, 0, False), (30, 0, 0, False)),
    "turn90": sequence((30, 1, 0, False), (30, 0, 1, False)),
    "turn180": sequence((30, 1, 0, False), (30, -1, 0, False)),
    "corner-gap": sequence((30, 1, 0, False), (1, 0, 0, False), (30, 0, 1, False)),
    "focus-entry-exit": sequence((24, 1, 0, False), (24, 1, 0, True), (24, 1, 0, False)),
    "focus-brake": sequence((30, 1, 0, False), (12, 0, 0, True)),
    "diagonal": sequence((60, 1, 1, False)),
    "analogue-half": sequence((60, 0.5, 0, False)),
}


class Controller:
    def __init__(self, profile):
        self.profile = profile
        self.x = self.y = self.vx = self.vy = 0.0
        self.cruise = 0.0
        self.neutral = 999
        self.focus = False
        self.brake = 0.0

    def tick(self, u):
        x, y, f = u["x"], u["y"], u["focus"]
        m = math.hypot(x, y)
        if self.profile in ("legacy", "classic"):
            div = max(1, m) if self.profile == "classic" else 1
            self.vx, self.vy = x / div * (120 if f else 252), y / div * (120 if f else 252)
        elif self.profile == "hybrid" and f:
            self.vx, self.vy = x / max(1, m) * 120, y / max(1, m) * 120
            self.cruise = 0
            self.neutral = 999
        elif m > 0:
            # Scalar cruise envelope is independent of steering direction.
            # Six neutral ticks retain envelope, NOT unbraked velocity.
            if self.neutral > 6 or (self.profile == "hybrid" and self.focus):
                self.cruise = 126
            else:
                self.cruise = min(252, self.cruise + 504 * DT)
            self.neutral = 0
            speed = self.cruise * min(1, m)
            if f:
                speed *= 120 / 252
            self.vx, self.vy = x / m * speed, y / m * speed
        else:
            self.neutral += 1
            speed = math.hypot(self.vx, self.vy)
            # On focus entry, cap existing coast as well as driven speed.
            if f and not self.focus and speed > 120:
                self.vx *= 120 / speed
                self.vy *= 120 / speed
                speed = 120
            if self.neutral == 1 or f != self.focus:
                self.brake = speed / 0.05
            ratio = max(0, speed - self.brake * DT) / speed if speed else 0
            self.vx *= ratio
            self.vy *= ratio
        self.focus = f
        self.x += self.vx * DT
        self.y += self.vy * DT
        return dict(x=self.x, y=self.y, vx=self.vx, vy=self.vy,
                    speed=math.hypot(self.vx, self.vy), focus=f)


def run(profile, inputs):
    c = Controller(profile)
    return [dict(tick=i + 1, t=(i + 1) * DT, **c.tick(u)) for i, u in enumerate(inputs)]


def metrics(rows, inputs):
    distance = sum(r["speed"] * DT for r in rows)
    release_distance = sum(r["speed"] * DT for r, u in zip(rows, inputs) if not (u["x"] or u["y"]))
    return dict(final_x=rows[-1]["x"], final_y=rows[-1]["y"],
                path_px=distance, release_path_px=release_distance,
                peak_px_s=max(r["speed"] for r in rows),
                first_px_s=rows[0]["speed"],
                cruise_first_tick=next((r["tick"] for r in rows if r["speed"] >= 252 - 1e-8), None))


def svg_plot(data, key):
    width, height, pad = 660, 190, 32
    max_t = max(rows[-1]["t"] for rows in data.values())
    vals = [r[key] for rows in data.values() for r in rows] + [0]
    lo, hi = min(vals), max(vals)
    if lo == hi:
        hi += 1
    def pt(t, v):
        return f'{pad + t / max_t * (width - 2 * pad):.2f},{height-pad-(v-lo)/(hi-lo)*(height-2*pad):.2f}'
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{key} over seconds">',
             '<rect width="660" height="190" fill="white"/>',
             f'<path d="M{pad},10 V{height-pad} H{width-pad}" fill="none" stroke="#aaa"/>',
             f'<text x="4" y="18" font-size="12">{hi:.1f}</text>',
             f'<text x="4" y="{height-pad}" font-size="12">{lo:.1f}</text>',
             f'<text x="{width-80}" y="{height-8}" font-size="12">{max_t:.2f} s</text>']
    for p, rows in data.items():
        points = " ".join(pt(r["t"], r[key]) for r in rows)
        lines.append(f'<polyline points="{points}" fill="none" stroke="{COLORS[p]}" stroke-width="2"/>')
    return "\n".join(lines + ["</svg>"])


def selftest(data):
    checks = []
    def check(name, ok):
        assert ok, name
        checks.append(dict(name=name, status="pass"))
    check("rerunning yields identical trajectories", data == {s: {p: run(p, u) for p in PROFILES} for s, u in SCENARIOS.items()})
    for p in PROFILES:
        check(f"{p}: no wrong-way displacement on reversal", data["turn180"][p][30]["vx"] < 0)
        check(f"{p}: ninety-degree turn clears old velocity", abs(data["turn90"][p][30]["vx"]) < 1e-10)
    for p in ("classic", "ramp", "hybrid"):
        check(f"{p}: normalized diagonal", abs(data["diagonal"][p][-1]["speed"] - 252) < 1e-8)
        check(f"{p}: analogue half magnitude", abs(data["analogue-half"][p][-1]["speed"] - 126) < 1e-8)
    check("hybrid focus entry while neutral brakes immediately", data["focus-brake"]["hybrid"][30]["speed"] == 0)
    check("hybrid focus driven speed immediately 120", data["focus-entry-exit"]["hybrid"][24]["speed"] == 120)
    check("hybrid focus exit restarts at 126", data["focus-entry-exit"]["hybrid"][48]["speed"] == 126)
    check("ramp coast finishes within 3 ticks", data["hold-release"]["ramp"][62]["speed"] < 1e-8)
    check("one neutral corner tick retains full cruise on resumption", data["corner-gap"]["hybrid"][31]["speed"] == 252)
    # Rendering only decides when ticks are consumed, never controller math.
    for fps in (30, 60, 144):
        c, rows, next_tick = Controller("hybrid"), [], 0
        inputs = SCENARIOS["focus-entry-exit"]
        for frame in range(math.ceil(len(inputs) / HZ * fps) + 1):
            due = min(len(inputs), math.floor((frame + 1) * HZ / fps + 1e-9))
            while next_tick < due:
                rows.append(c.tick(inputs[next_tick]))
                next_tick += 1
        expected = data["focus-entry-exit"]["hybrid"]
        check(f"{fps} Hz rendering consumes identical 60 Hz ticks", all(r == {k: e[k] for k in r} for r, e in zip(rows, expected)) and len(rows) == len(expected))
    return checks


def main():
    data = {s: {p: run(p, u) for p in PROFILES} for s, u in SCENARIOS.items()}
    checks = selftest(data)
    summary = {s: {p: metrics(rows, SCENARIOS[s]) for p, rows in profiles.items()} for s, profiles in data.items()}
    (OUT / "metrics.json").write_text(json.dumps(summary, indent=2) + "\n")
    with (OUT / "trajectories.csv").open("w") as f:
        writer = csv.DictWriter(f, fieldnames=["scenario", "profile", "tick", "t", "x", "y", "vx", "vy", "speed", "focus"])
        writer.writeheader()
        for s, profiles in data.items():
            for p, rows in profiles.items():
                writer.writerows(dict(scenario=s, profile=p, **r) for r in rows)
    legend = " · ".join(f'<span style="color:{COLORS[p]}">{p}</span>' for p in PROFILES)
    page = ['<!doctype html><html lang="en"><meta charset="utf-8"><title>Control response: numerical comparison</title>',
            '<style>body{max-width:1050px;margin:2rem auto;padding:0 1rem;font:16px system-ui;color:#222;background:#fafafa}svg{width:100%}.plots{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem}section{margin:2rem 0}table{border-collapse:collapse}td,th{padding:.4rem;text-align:right;border-bottom:1px solid #ddd}</style>',
            '<h1>Control response: numerical comparison</h1><p>Deterministic 60 Hz toy model, not a game capture or evidence of player preference. No bounds, bullets, collision, input latency or camera. Original playfield pixels. Legacy is the actual audited movement law; classic is a proposed normalized baseline.</p>', f'<p>{legend}</p>']
    for s, profiles in data.items():
        page += [f'<section><h2>{html.escape(s)}</h2><div class="plots">']
        for key, label in (("speed", "Speed (px/s)"), ("x", "X displacement (px)"), ("y", "Y displacement (px)")):
            svg = svg_plot(profiles, key)
            (OUT / f"{s}-{key}.svg").write_text(svg)
            page += [f'<div><h3>{label}</h3>{svg}</div>']
        page += ['</div><table><tr><th>Profile</th><th>Path px</th><th>Release px</th><th>Peak px/s</th></tr>']
        for p, m in summary[s].items():
            page += [f'<tr><td>{p}</td><td>{m["path_px"]:.2f}</td><td>{m["release_path_px"]:.2f}</td><td>{m["peak_px_s"]:.2f}</td></tr>']
        page += ['</table></section>']
    (OUT / "comparison.html").write_text("\n".join(page) + "</html>\n")
    report = dict(status="pass", note="Toy model invariants only, not game QA or playtest.",
                  checks=checks, source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (OUT / "simulator-checks.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(dict(status="pass", checks=len(checks), scenarios=len(data), profiles=len(PROFILES),
                          report=str(OUT / "comparison.html"))))


if __name__ == "__main__":
    main()
