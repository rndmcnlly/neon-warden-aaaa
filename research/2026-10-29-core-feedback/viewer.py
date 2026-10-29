#!/usr/bin/env python3
"""Writes index.html: a one-clip-at-a-time viewer over clips/clips.json.

python3 -I viewer.py   (run from this folder)

Watch first; the evidence (sim events in the window, the audio probe and
what to look and listen for) unlocks after the clip has played once.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
rows = [r for r in json.loads((HERE / "clips/clips.json").read_text()) if not r.get("missing")]
ORDER = ["disarm", "pod-break", "writ1-hit", "writ1-miss", "writ3-hit", "writ3-miss",
         "deflect", "writ-deflect", "dense", "life-kill"]
rows.sort(key=lambda r: (ORDER.index(r["topic"]), r["arm"] != "before"))

LOOK = {
    "disarm": "Does the weapon part come off and tumble away, darker, under the bullets? Does the hull "
              "sag, sputter and leave instead of exploding? Is the sound mechanical (unlatch, power-down), not a boom?",
    "pod-break": "Does the pod tear free with plating and a gold ring, a short freeze, and a loud sound of its own?",
    "writ1-hit": "A tier 1 crack at the impact point, louder than the release.",
    "writ1-miss": "The release, then (after) a dry fizzle when the Writ leaves the top of the screen.",
    "writ3-hit": "A tier 3 impact: crack, metallic ring and sub drop, with the music dipping.",
    "writ3-miss": "No impact; (after) the fizzle as it leaves the screen.",
    "deflect": "Shots glance off: thin slate streaks bounce away and a bright tink, no flash on the target.",
    "writ-deflect": "A Writ into the invulnerable Warden: audible as a glancing hit, not silence.",
    "dense": "Many hits in a second: one merged texture rather than a machine-gun buzz; threat cues still heard.",
    "life-kill": "A life lost on the same tick as a ram kill: freeze, a red frame closing in, the alarm; "
                 "the kill's explosion only after (deferred 0.35 s).",
}

data = json.dumps([{**r, "look": LOOK[r["topic"]]} for r in rows])
html = """<!doctype html><meta charset="utf-8"><title>Core feedback: before and after</title>
<style>
body{font:15px/1.45 system-ui,sans-serif;background:#0d0f14;color:#dfe4ee;max-width:900px;margin:24px auto;padding:0 16px}
video{width:100%;background:#000;border-radius:6px}
button{font:inherit;padding:6px 14px;margin-right:6px;border-radius:6px;border:1px solid #3a4150;background:#1a1f29;color:inherit;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
.arm{font-weight:700}.before{color:#e0a96d}.after{color:#7fd6c2}
pre{white-space:pre-wrap;background:#141821;padding:10px;border-radius:6px;font-size:12px;max-height:320px;overflow:auto}
.muted{color:#8a93a6}
</style>
<h1>Core feedback (night plan step 4a)</h1>
<p class="muted">One clip at a time. Before = <code>3b8f258</code>, after = <code>010d6ba</code> (game code; probe overlay noted in the README).
Normal speed, 854x480, game audio. Voice muted and subtitles off, so lore does not compete.
Watch first: the evidence unlocks when the clip has played to the end.</p>
<div><button id="prev">Previous</button><button id="next">Next</button> <span id="pos" class="muted"></span></div>
<h2 id="title"></h2>
<video id="v" controls preload="auto"></video>
<p><button id="reveal" disabled>Reveal evidence</button></p>
<div id="ev" hidden>
<p><b>Look and listen for:</b> <span id="look"></span></p>
<p id="probe"></p>
<p class="muted">Sim events in the window (seconds from clip start; payChanged, nearMiss, enemyFired, graze, statsMoment omitted):</p>
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
  const a = r.audio;
  $("probe").textContent = `Anchor: ${r.eventType} at ${r.eventAt} s (source ${r.source}). ` +
    `Audio probe: 50 ms peak ${a.peakDb} dB, ${a.overMedianDb} dB over the clip median (${a.medianDb} dB).`;
  $("truth").textContent = r.truth.map((e) => {
    const { t, type, ...rest } = e;
    delete rest.tick;
    return `${t.toFixed(2).padStart(6)}  ${type}  ${JSON.stringify(rest)}`;
  }).join("\\n");
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
