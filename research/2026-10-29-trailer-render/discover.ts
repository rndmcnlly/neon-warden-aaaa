/**
 * Event-time discovery for re-timing cut sheets at true speed: long draft
 * (real-time, 720p) takes of every scenario the sheets use, captured in
 * parallel, summarized to `discover/<id>.txt` (one line per notable event,
 * log line or screen change). Real-time pacing only needs to be roughly
 * right here; the recipes it informs end on `until` probes.
 *
 *   deno run -A --no-lock research/2026-10-29-trailer-render/discover.ts [ids]
 */
import { captureTake, frozenBuild } from "../../trailer/capture.ts";
import type { ResolvedTake } from "../../trailer/plan.ts";

const HERE = new URL(".", import.meta.url).pathname;
const q = (s: string) => `${s}&seed=121&qa=1`;
const quiet = { audio: { music: 0, voice: 0 }, subtitles: { enabled: false } };
const SCEN: Record<string, { query: string; secs: number }> = {
  s1: { query: q("?skipto=sector1&autoplay=fight&speed=1"), secs: 150 },
  s2: { query: q("?skipto=sector2&autoplay=fight&speed=1"), secs: 150 },
  s2p: { query: q("?skipto=sector2&autoplay=pacifist&speed=1"), secs: 120 },
  s3: { query: q("?skipto=sector3&autoplay=fight&speed=1"), secs: 200 },
  s4: { query: q("?skipto=sector4&autoplay=fight&speed=1"), secs: 150 },
  s5: { query: q("?skipto=sector5&autoplay=fight&speed=1"), secs: 150 },
  bossf: { query: q("?skipto=boss&autoplay=fight&speed=1"), secs: 300 },
  bossp: { query: q("?skipto=boss&autoplay=pacifist&speed=1"), secs: 300 },
  tut: { query: q("?skipto=tutorial&autoplay=fight&speed=1"), secs: 480 },
  s1p: { query: q("?skipto=sector1&autoplay=pacifist&speed=1"), secs: 90 },
  s4p: { query: q("?skipto=sector4&autoplay=pacifist&speed=1"), secs: 90 },
  s5p: { query: q("?skipto=sector5&autoplay=pacifist&speed=1"), secs: 90 },
  endp: { query: q("?skipto=ending-pacifist"), secs: 100 },
};
const NOISY = new Set([
  "focusChanged",
  "payChanged",
  "enemyFired",
  "spawn",
  "nearMiss",
]);

const ids = Deno.args.length ? Deno.args : Object.keys(SCEN);
const build = await frozenBuild(false);
await Deno.mkdir(`${HERE}discover`, { recursive: true });
await Promise.all(ids.map(async (id) => {
  const s = SCEN[id];
  const t: ResolvedTake = {
    id: `discover-${id}`,
    lang: "any",
    query: s.query,
    settings: quiet,
    steps: [{ do: "wait", ms: s.secs * 1000 }],
    maxSeconds: s.secs + 5,
    viewport: { width: 1280, height: 720 },
  };
  const r = await captureTake(t, build, (m) => console.log(`${id}: ${m}`));
  const tl = JSON.parse(await Deno.readTextFile(`${r.dir}/timeline.json`));
  const lines: string[] = [`# ${id} ${s.query} ${tl.seconds.toFixed(1)} s`];
  for (const x of tl.entries) {
    if (x.k === "ev") {
      if (NOISY.has(x.e?.type)) continue;
      const { type, tick, ...rest } = x.e;
      lines.push(
        `${x.t.toFixed(2)} [${tick}] ${type} ${JSON.stringify(rest)}`,
      );
    } else if (x.k === "log") {
      if (String(x.e).startsWith("lang:")) continue;
      lines.push(`${x.t.toFixed(2)} log ${x.e}`);
    } else lines.push(`${x.t.toFixed(2)} dom ${x.value}`);
  }
  await Deno.writeTextFile(`${HERE}discover/${id}.txt`, lines.join("\n"));
  console.log(`${id}: done, ${lines.length} lines`);
}));
