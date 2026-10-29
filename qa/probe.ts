/**
 * Watch the QA probe live, for writing or debugging a reel's `until` steps:
 * loads the built bundle (`qa/.build/dist`, from any reel run) with a query,
 * then prints the probe every few seconds, compactly, without recording.
 *
 *   deno run -A --no-lock qa/probe.ts "?skipto=boss&autoplay=fight&speed=4&qa=1" 30
 *
 * Arguments: query (add `qa=1`), seconds to watch (default 20), print
 * interval in seconds (default 3). `--build` rebuilds the bundle first.
 */

import type { QaProbe } from "../src/app/qaProbe.ts";
import { build, launch, serve } from "./capture.ts";

const args = Deno.args.filter((a) => a !== "--build");
if (args.length < Deno.args.length) await build("qa/.build/dist");
const [query = "?qa=1", seconds = "20", every = "3"] = args;
const server = serve("qa/.build/dist");
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on("pageerror", (err) => console.log(`pageerror: ${err.message}`));
await page.goto(server.url + query);

let printed = 0;
const end = Date.now() + Number(seconds) * 1000;
while (Date.now() < end) {
  await page.waitForTimeout(Number(every) * 1000);
  const view = await page.evaluate(() => {
    const p = (globalThis as { __nwqa?: QaProbe }).__nwqa;
    if (!p) return null;
    return {
      scene: p.scene(),
      timeline: p.timeline(),
      sim: p.sim(),
      flagsUp: Object.entries(p.flags()).filter(([, v]) => v).map(([k]) => k),
      log: [...p.log],
      events: p.events.filter((e) => e.type.startsWith("boss")),
    };
  });
  if (!view) {
    console.log("probe absent");
    continue;
  }
  // Only the log entries since the last print, minus per-shot noise.
  const fresh = view.log.slice(printed).filter((e) =>
    !/^sim:(playerFired|hit|spawn|despawn)$/.test(e)
  );
  printed = view.log.length;
  console.log(JSON.stringify({ ...view, log: fresh }));
}
await browser.close();
await server.close();
