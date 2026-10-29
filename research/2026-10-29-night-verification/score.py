#!/usr/bin/env python3
"""Score blind Pass A against event-log truth; tally Pass B by arm.

python3 score.py out

A truth event counts as recognized when the judge reports the matching
event type within TOL seconds (judge timestamps drift 0.3-0.8 s). Writ
releases come from release-sample starts, their outcome from a kill,
disarm or part break within 0.8 s (pick.py), so both arms use one rule.
Judge claims with no truth within TOL are listed as rejected.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

OUT = Path(sys.argv[1])
TOL = 1.0
key = json.loads((OUT / "key.json").read_text())
clips = [c for c in key["clips"] if not c.get("missing")]


def near(evs, t, types, tol=TOL):
    return [e for e in evs if e["type"] in types and abs(e["t"] - t) <= tol]


CHARGED = {"charged_release", "charged_hit", "charged_miss"}
tally = defaultdict(lambda: [0, 0])  # (arm, weakness) -> [recognized, total]
rejected = []
per_clip = []


def count(arm, name, ok):
    tally[(arm, name)][0] += int(bool(ok))
    tally[(arm, name)][1] += 1


for c in clips:
    j = json.loads((OUT / "judge" / f"a-{c['id']}.json").read_text())
    je = j["events"]
    arm, truth = c["arm"], c["events"]
    rows = []
    kill_ticks = defaultdict(set)
    for e in truth:
        if e["type"] == "kill":
            kill_ticks[e["t"]].add("kill")
    for e in truth:
        t = e["t"]
        if e["type"] == "disarm":
            got = near(je, t, {"enemy_disarmed"})
            misread = not got and near(je, t, {"enemy_destroyed"})
            count(arm, "disarm read as disarm", got)
            count(arm, "disarm misread as kill", misread)
            rows.append((t, "disarm", "disarm" if got else "kill" if misread else "missed"))
        elif e["type"] == "partBreak" and e.get("target") == "boss":
            got = near(je, t, {"boss_part_broken_off", "enemy_part_broken_off"})
            count(arm, "pod break", got)
            rows.append((t, f"pod break ({e.get('part')})", "seen" if got else "missed"))
        elif e["type"] == "lifeLost":
            same_tick_kill = t in kill_ticks
            got = near(je, t, {"life_lost"})
            count(arm, "life lost on kill tick" if same_tick_kill else "life lost (other)", got)
            rows.append((t, "life lost" + (" on kill tick" if same_tick_kill else ""), "seen" if got else "missed"))
        elif e["type"] == "kill" and e.get("kind") != "boss":
            got = near(je, t, {"enemy_destroyed"})
            count(arm, "kill", got)
    for w in c["writs"]:
        t = w["t"]
        got = near(je, t, CHARGED)
        tier_ok = any(g["strength"] == w["tier"] for g in got)
        out = {"charged_hit"} if w["hit"] else {"charged_miss"}
        outcome_ok = bool(near(je, t, out, 1.2))
        heard = any(g["channel"] in ("heard", "both") for g in got)
        count(arm, "Writ noticed", got)
        count(arm, f"Writ {w['tier']} tier correct", tier_ok)
        count(arm, "Writ outcome correct (hit/miss)", outcome_ok)
        count(arm, "Writ heard", heard)
        rows.append((t, f"Writ {w['tier']} {'hit' if w['hit'] else 'miss'}",
                     f"noticed={bool(got)} tier={'ok' if tier_ok else 'wrong'} outcome={'ok' if outcome_ok else 'wrong'} heard={heard}"))
    # Rejected claims: discrete events with no truth nearby.
    truth_types = {
        "enemy_disarmed": {"disarm"},
        "enemy_destroyed": {"kill"},
        "boss_part_broken_off": {"partBreak"},
        "enemy_part_broken_off": {"partBreak"},
        "life_lost": {"lifeLost"},
    }
    for g in je:
        if g["type"] in truth_types and not near(truth, g["t"], truth_types[g["type"]]):
            rejected.append({"clip": c["id"], "arm": arm, "topic": c["topic"], "claim": g["type"], "t": g["t"],
                             "evidence": g["evidence"][:160], "confidence": g["confidence"]})
        if g["type"] in CHARGED and not any(abs(w["t"] - g["t"]) <= TOL for w in c["writs"]):
            rejected.append({"clip": c["id"], "arm": arm, "topic": c["topic"], "claim": g["type"], "t": g["t"],
                             "evidence": g["evidence"][:160], "confidence": g["confidence"]})
    for s in j["speech"]:
        rejected.append({"clip": c["id"], "arm": arm, "topic": c["topic"], "claim": "speech", "t": s["t"],
                         "evidence": s["words"][:160], "confidence": None})
    per_clip.append({"id": c["id"], "topic": c["topic"], "arm": arm, "rows": rows,
                     "audio": c["audio"], "summary": j["summary"], "issues": j["readability_issues"]})

# Pass B: map X/Y back to arms.
items = ["movement and focus", "tap hit", "disarm vs destroy", "Writ strength", "Writ hit vs miss",
         "deflect off armor", "boss part break", "life lost", "many hits at once"]
pref = defaultdict(lambda: defaultdict(int))
clutter, overall = [], []
for i, p in enumerate(key["pairs"]):
    b = json.loads((OUT / "judge" / f"b-pair{i + 1}.json").read_text())
    arm_of = {"X": p["X_arm"], "Y": p["Y_arm"], "same": "same", "not_present": "not_present"}
    for e in b["per_event"]:
        if 1 <= e["item"] <= len(items):
            pref[items[e["item"] - 1]][arm_of[e["better"]]] += 1
    for cl in b["clutter"]:
        clutter.append({"topic": p["topic"], "arm": arm_of[cl["clip"]], **cl})
    overall.append({"topic": p["topic"], "better": arm_of[b["overall"]["better"]], "why": b["overall"]["why"]})

audio = {}
for c in clips:
    audio.setdefault(c["topic"], {})[c["arm"]] = c["audio"]["overMedianDb"]

result = {
    "tally": {f"{a}|{n}": v for (a, n), v in sorted(tally.items())},
    "rejected": rejected,
    "passB": {"preferences": pref, "clutter": clutter, "overall": overall},
    "audioOverMedianDb": audio,
    "perClip": per_clip,
}
(OUT / "score.json").write_text(json.dumps(result, indent=1, default=dict) + "\n")
names = sorted({n for (_, n) in tally})
print(f"{'weakness':40} before      after")
for n in names:
    b, a = tally.get(("before", n), [0, 0]), tally.get(("after", n), [0, 0])
    print(f"{n:40} {b[0]}/{b[1]:<9} {a[0]}/{a[1]}")
print("\nPass B preferences:")
for k, v in pref.items():
    print(f"  {k:22} {dict(v)}")
print("\noverall:", [(o["topic"], o["better"]) for o in overall])
print("\nclutter by arm:", {a: sum(1 for c in clutter if c["arm"] == a) for a in ("before", "after")},
      "high/medium after:", [(c["topic"], c["t"], c["severity"], c["issue"][:90]) for c in clutter
                             if c["arm"] == "after" and c["severity"] != "low"])
print("\nrejected:", len(rejected))
for r in rejected:
    print(" ", r["arm"], r["topic"], r["claim"], r["t"], r["confidence"], r["evidence"][:90])
print("\naudio over median dB:", audio)
