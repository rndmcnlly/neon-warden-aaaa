/**
 * Moments gallery, step 3: index.html from moments.json (data inlined, so it
 * opens from disk with no server).
 *
 *   deno run -A --no-lock research/2026-10-28-moments/gallery.ts
 */

const HERE = new URL(".", import.meta.url).pathname;
const data = JSON.parse(await Deno.readTextFile(`${HERE}moments.json`));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Neon Warden: moments gallery</title>
<style>
  :root { color-scheme: dark; --bg: #0b0d14; --card: #151a26; --ink: #e6ecff; --dim: #8b96b5; --acc: #5ee7ff; --warn: #ffb35e; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.45 system-ui, sans-serif; }
  header, main, section { max-width: 1400px; margin: 0 auto; padding: 0 20px; }
  h1 { font-size: 1.6rem; margin: 24px 0 4px; }
  .dim { color: var(--dim); }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
  .filters button { background: var(--card); color: var(--ink); border: 1px solid #2a3350; border-radius: 999px; padding: 6px 14px; cursor: pointer; font: inherit; }
  .filters button[aria-pressed="true"] { border-color: var(--acc); color: var(--acc); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr)); gap: 18px; }
  article[hidden] { display: none; }
  article { background: var(--card); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
  video { width: 100%; aspect-ratio: 16 / 9; background: #000; display: block; }
  .body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
  h2 { font-size: 1.05rem; margin: 0; }
  .tags span { font-size: 0.75rem; border: 1px solid #2a3350; border-radius: 4px; padding: 1px 6px; margin-right: 4px; color: var(--dim); }
  .meters { font-variant-numeric: tabular-nums; font-size: 0.85rem; color: var(--dim); }
  .meters b { color: var(--ink); font-weight: 600; }
  .hot { color: var(--warn) !important; }
  .src { font-size: 0.78rem; color: var(--dim); word-break: break-all; }
  .bal { display: inline-block; width: 60px; height: 6px; background: #2a3350; position: relative; vertical-align: middle; border-radius: 3px; }
  .bal i { position: absolute; top: -2px; width: 3px; height: 10px; background: var(--acc); }
  .missing li, .caps li { margin: 6px 0; }
  table { border-collapse: collapse; font-size: 0.85rem; }
  td, th { padding: 4px 10px; text-align: left; border-bottom: 1px solid #222a40; }
  code { font-size: 0.85em; }
</style>
</head>
<body>
<header>
  <h1>Neon Warden: moments gallery</h1>
  <p class="dim">Short A/V clips cut automatically from long captures of real runs (1280x720, the game's own stereo mix via the qa/av.ts tap), anchored on the QA probe's event log. Generated ${
  data.generated.slice(0, 16).replace("T", " ")
} UTC. Loudness is the clip's integrated LUFS (game mix, not normalized); balance is R/(L+R) RMS, 0.5 is centre. Clips never autoplay.</p>
  <div class="filters" role="group" aria-label="Filter by category"></div>
</header>
<main><div class="grid"></div></main>
<section>
  <h2 style="margin-top:32px">Missing moments</h2>
  <ul class="missing"></ul>
  <h2 style="margin-top:24px">Source captures</h2>
  <div style="overflow-x:auto"><table class="caps"><thead><tr><th>capture</th><th>query</th><th>s</th><th>LUFS</th><th>dBTP</th><th>notes</th></tr></thead><tbody></tbody></table></div>
  <p class="dim" style="margin:24px 0 40px">Scripts: capture.ts, cut.ts, gallery.ts. See README.md.</p>
</section>
<script>
const DATA = ${JSON.stringify(data)};
const CATS = ["all", "combat", "nonviolence", "narrative", "audio", "ui"];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const grid = document.querySelector(".grid");
for (const c of DATA.clips) {
  const a = document.createElement("article");
  a.dataset.cats = c.categories.join(" ");
  const loud = Number.isFinite(c.lufs) ? c.lufs.toFixed(1) : "n/a";
  const hot = c.lufs > -10 || c.truePeak > -1;
  const bal = c.balance ?? 0.5;
  a.innerHTML = \`
    <video controls preload="none" playsinline poster="clips/\${c.id}.jpg" src="clips/\${c.id}.mp4"></video>
    <div class="body">
      <h2>\${esc(c.title)}</h2>
      <div class="tags">\${c.categories.map((t) => "<span>" + t + "</span>").join("")}</div>
      <div>\${esc(c.caption)}</div>
      <div class="meters"><span class="\${hot ? "hot" : ""}"><b>\${loud}</b> LUFS, LRA \${c.lra}, peak \${c.truePeak} dBTP</span>
        &nbsp; L/R <span class="bal" title="balance \${bal}"><i style="left:\${(bal * 100).toFixed(0)}%"></i></span> \${bal.toFixed(3)}\${c.lrDb !== null ? " (" + c.lrDb + " dB R-L)" : ""}</div>
      <div class="src">\${esc(c.capture)} at \${c.start}–\${(c.start + c.seconds).toFixed(1)} s, anchor \${c.anchor} s: \${esc(c.why)}\${c.lines.length ? "<br>lines: " + c.lines.map(esc).join(", ") : ""}</div>
    </div>\`;
  grid.append(a);
}
const filters = document.querySelector(".filters");
for (const cat of CATS) {
  const b = document.createElement("button");
  const n = cat === "all" ? DATA.clips.length : DATA.clips.filter((c) => c.categories.includes(cat)).length;
  b.textContent = cat + " (" + n + ")";
  b.setAttribute("aria-pressed", String(cat === "all"));
  b.onclick = () => {
    for (const o of filters.children) o.setAttribute("aria-pressed", String(o === b));
    for (const a of grid.children) a.hidden = cat !== "all" && !a.dataset.cats.split(" ").includes(cat);
  };
  filters.append(b);
}
// One clip plays at a time.
grid.addEventListener("play", (e) => { for (const v of grid.querySelectorAll("video")) if (v !== e.target) v.pause(); }, true);
document.querySelector(".missing").innerHTML = DATA.missing.map((m) =>
  "<li><b>" + esc(m.title) + "</b> <span class=dim>(" + m.categories.join(", ") + ")</span>: " + esc(m.reason) + "</li>").join("");
document.querySelector(".caps tbody").innerHTML = DATA.captures.map((c) =>
  "<tr><td>" + esc(c.id) + "</td><td><code>" + esc(c.query) + "</code></td><td>" + c.seconds + "</td><td>" + c.lufs + "</td><td>" + c.truePeak + "</td><td>" + esc(c.notes.join("; ")) + "</td></tr>").join("");
</script>
</body>
</html>
`;
await Deno.writeTextFile(`${HERE}index.html`, html);
console.log(
  `index.html: ${data.clips.length} clips, ${data.missing.length} missing`,
);
