#!/usr/bin/env python3
"""Writes index.html: a one-clip-at-a-time blind viewer.

python3 -I viewer.py   (run from this folder, after score.py)

Clips play in the judge's pair order (X then Y) under neutral ids. The arm,
topic, event truth, the judge's blind account and its score unlock only
after the clip has played to the end, so a human can try the same blind
test before seeing the answer.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
key = json.loads((HERE / "out/key.json").read_text())
score = json.loads((HERE / "out/score.json").read_text())
by_id = {c["id"]: c for c in key["clips"] if not c.get("missing")}
scored = {c["id"]: c for c in score["perClip"]}
rows = []
for n, p in enumerate(key["pairs"], 1):
    b = json.loads((HERE / f"out/judge/b-pair{n}.json").read_text())
    for side in ("X", "Y"):
        c = by_id[p[side]]
        a = json.loads((HERE / f"out/judge/a-{c['id']}.json").read_text())
        rows.append({
            "id": c["id"], "pair": n, "side": side, "arm": c["arm"], "topic": c["topic"],
            "src": f"{c['arm']}/{c['src']} {c['start']:.2f}-{c['end']:.2f} s", "anchorAt": c["anchorAt"],
            "audio": c["audio"], "truth": c["events"], "writs": c["writs"],
            "judge": a["events"], "summary": a["summary"], "rows": scored[c["id"]]["rows"],
            "overall": b["overall"] if side == "Y" else None,
        })

html = """<!doctype html><meta charset="utf-8"><title>Night verification: blind before and after</title>
<style>
body{font:15px/1.45 system-ui,sans-serif;background:#0d0f14;color:#dfe4ee;max-width:900px;margin:24px auto;padding:0 16px}
video{width:100%;background:#000;border-radius:6px}
button{font:inherit;padding:6px 14px;margin-right:6px;border-radius:6px;border:1px solid #3a4150;background:#1a1f29;color:inherit;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
.before{color:#e0a96d}.after{color:#7fd6c2}
pre{white-space:pre-wrap;background:#141821;padding:10px;border-radius:6px;font-size:12px;max-height:300px;overflow:auto}
.muted{color:#8a93a6}
</style>
<h1>Night verification (night plan step 5)</h1>
<p class="muted">Before = <code>8ad8598</code>, after = <code>78eebec</code>. Normal speed, 854x480 cut from 1280x720,
game audio, voice muted and subtitles off. Clips play in the judge's pair order under neutral ids.
Watch and listen first, decide what happened, then reveal: which build, the event log, and what the blind judge said.</p>
<div><button id="prev">Previous</button><button id="next">Next</button> <span id="pos" class="muted"></span></div>
<h2 id="title"></h2>
<video id="v" controls preload="auto"></video>
<p><button id="reveal" disabled>Reveal</button></p>
<div id="ev" hidden>
<p id="who"></p>
<p id="probe"></p>
<p><b>Scored truth</b> (recognized by the judge within 1.0 s?):</p>
<pre id="rows"></pre>
<p><b>Judge, blind (Pass A):</b> <span id="summary"></span></p>
<pre id="judge"></pre>
<p class="muted">Event log in the window (seconds from clip start):</p>
<pre id="truth"></pre>
<p id="overall"></p>
</div>
<script>
const rows = __DATA__;
let i = 0;
const $ = (id) => document.getElementById(id);
function show() {
  const r = rows[i];
  $("pos").textContent = `${i + 1} / ${rows.length}`;
  $("title").textContent = `Clip ${r.id} (pair ${r.pair}, ${r.side})`;
  $("v").src = "out/clips/" + r.id + ".mp4";
  $("ev").hidden = true;
  $("reveal").disabled = true;
  $("who").innerHTML = `<b class="${r.arm}">${r.arm}</b>, topic <b>${r.topic}</b>, anchor at ${r.anchorAt} s, source ${r.src}`;
  const a = r.audio;
  $("probe").textContent = `Audio at the anchor: 50 ms peak ${a.peakDb} dB, ${a.overMedianDb} dB over the clip median.`;
  $("rows").textContent = r.rows.map((x) => `${x[0].toFixed(2).padStart(6)}  ${x[1]}: ${x[2]}`).join("\\n") || "(no scored events)";
  $("summary").textContent = r.summary;
  $("judge").textContent = r.judge.map((e) =>
    `${e.t.toFixed(1).padStart(5)}  ${e.type}${e.strength ? " s" + e.strength : ""} [${e.channel}, ${e.confidence}]  ${e.evidence}`).join("\\n");
  $("truth").textContent = r.truth.map((e) => {
    const { t, type, ...rest } = e;
    return `${t.toFixed(2).padStart(6)}  ${type}  ${JSON.stringify(rest)}`;
  }).concat(r.writs.map((w) => `${w.t.toFixed(2).padStart(6)}  Writ ${w.tier} release, ${w.hit ? "hit: " + w.result : "miss"}`)).join("\\n");
  $("overall").textContent = r.overall ? `Pass B, this pair overall: ${r.overall.better} (X = previous clip). ${r.overall.why}` : "";
}
$("v").addEventListener("ended", () => ($("reveal").disabled = false));
$("reveal").onclick = () => ($("ev").hidden = false);
$("prev").onclick = () => { i = (i + rows.length - 1) % rows.length; show(); };
$("next").onclick = () => { i = (i + 1) % rows.length; show(); };
show();
</script>
"""
(HERE / "index.html").write_text(html.replace("__DATA__", json.dumps(rows)))
print(f"index.html: {len(rows)} clips")
