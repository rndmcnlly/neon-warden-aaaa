#!/usr/bin/env python3
"""Writes index.html: a one-clip-at-a-time viewer over clips/clips.json
(adapted from research/2026-10-29-core-feedback/viewer.py).

python3 -I viewer.py   (run from this folder)

Watch first; the evidence (sim events in the window, the audio probe and
what to look and listen for) unlocks after the clip has played once.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
rows = [r for r in json.loads((HERE / "clips/clips.json").read_text()) if not r.get("missing")]
ORDER = ["move", "move-sfx", "lane-s1", "lane-s3", "debris", "tutorial-vo"]
rows.sort(key=lambda r: (ORDER.index(r["topic"]), r["arm"] != "before"))
M = json.loads((HERE / "metrics.json").read_text())

LOOK = {
    "move": "Scripted flight, no fire: start, reversals, stops, the same in focus, diagonals. "
            "Do pale puffs appear on the side opposite each push, under the bullets? Does the ship lean "
            "into sideways motion and level out? Is there an engine sound that rises with speed and a "
            "short hiss on each reversal and stop, quieter and narrower in focus?",
    "move-sfx": "The same flight with music muted, to hear the engine bed and transients alone.",
    "lane-s1": "The lane floor in sector 1 combat: busier (data streaks in conduits, small amber and "
               "green signals, panels) but darker and greyer than the bullets and ships on it?",
    "lane-s3": "Sector 3: the floor look is shared by every sector (only the diorama around it changes), "
               "so this checks the same budget against a different world and wave.",
    "debris": "A Warden pod break (and a second one about 3.4 s later): do the torn-off parts read as grey, "
              "rim-lit bodies tumbling away with a smoke streak, and never as bullets?",
    "tutorial-vo": "Tutorial voice with subtitles: does each subtitle arrive with the voice, or well before it?",
}


def probe(r: dict) -> str:
    m = M[r["arm"]]
    if r["topic"] in ("move", "move-sfx"):
        x = m["move"]
        return (f"Music-muted run: direction-change peak {x['change_peak_db']} dBFS, clip median "
                f"{x['clip_median_db']} dBFS, focus cruise {x['focus_cruise_db']} dBFS (50 ms RMS; "
                "enemy sound effects also fall in these windows).")
    if r["topic"].startswith("lane"):
        x = m[r["topic"]]
        return (f"Floor value {x['floor_v_median']} (p95 {x['floor_v_p95']}), saturation "
                f"{x['floor_s_median']}, chroma {x['floor_c_median']} (p95 {x['floor_c_p95']}); combat value "
                f"{x['combat_v_median']}, chroma {x['combat_c_median']}. Medians over 12 frames.")
    if r["topic"] == "tutorial-vo":
        return f"Median subtitle-to-voice lead: {m['vo']['median_lead_s']} s."
    return "See debris-frames.jpg for stills 0.06–1.2 s after the first break."


data = json.dumps([{**r, "look": LOOK[r["topic"]], "probe": probe(r)} for r in rows])
html = """<!doctype html><meta charset="utf-8"><title>Movement, lane, debris, VO: before and after</title>
<style>
body{font:15px/1.45 system-ui,sans-serif;background:#0d0f14;color:#dfe4ee;max-width:900px;margin:24px auto;padding:0 16px}
video{width:100%;background:#000;border-radius:6px}
button{font:inherit;padding:6px 14px;margin-right:6px;border-radius:6px;border:1px solid #3a4150;background:#1a1f29;color:inherit;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
.arm{font-weight:700}.before{color:#e0a96d}.after{color:#7fd6c2}
pre{white-space:pre-wrap;background:#141821;padding:10px;border-radius:6px;font-size:12px;max-height:320px;overflow:auto}
.muted{color:#8a93a6}
</style>
<h1>Movement, lane floor, debris and VO sync (night plan step 4b)</h1>
<p class="muted">One clip at a time. Before = <code>5035bfd</code>, after = <code>5b1acd0</code>, both from <code>git archive</code> builds.
Normal speed, 854x480, game audio. Voice muted and subtitles off, except the tutorial VO clip.
Watch first: the evidence unlocks when the clip has played to the end.</p>
<div><button id="prev">Previous</button><button id="next">Next</button> <span id="pos" class="muted"></span></div>
<h2 id="title"></h2>
<video id="v" controls preload="auto"></video>
<p><button id="reveal" disabled>Reveal evidence</button></p>
<div id="ev" hidden>
<p><b>Look and listen for:</b> <span id="look"></span></p>
<p id="probe"></p>
<p class="muted">Marks, selected sim events, subtitles and voice onsets in the window (seconds from clip start):</p>
<pre id="truth"></pre>
</div>
<script>
const rows = __DATA__;
let i = 0;
const $ = (id) => document.getElementById(id);
function show() {
  const r = rows[i];
  $("pos").textContent = `${i + 1} / ${rows.length}`;
  $("title").innerHTML = `${r.topic} <span class="arm ${r.arm}">${r.arm}</span>`;
  $("v").src = "clips/" + r.file;
  $("ev").hidden = true;
  $("reveal").disabled = true;
  $("look").textContent = r.look;
  $("probe").textContent = `Source ${r.source} from ${r.start} s, ${r.errors} page errors. ${r.probe}`;
  $("truth").textContent = r.evidence.map((e) =>
    `${e.t.toFixed(2).padStart(6)}  ${e.what}`).join("\\n");
}
$("v").addEventListener("ended", () => ($("reveal").disabled = false));
$("reveal").onclick = () => ($("ev").hidden = false);
$("prev").onclick = () => { i = (i + rows.length - 1) % rows.length; show(); };
$("next").onclick = () => { i = (i + 1) % rows.length; show(); };
show();
</script>
"""
(HERE / "index.html").write_text(html.replace("__DATA__", data))
print(f"index.html: {len(rows)} clips")
