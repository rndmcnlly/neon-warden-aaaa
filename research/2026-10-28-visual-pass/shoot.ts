/**
 * Stills from the renderer harness for the visual pass. Needs a dev server
 * (`deno task dev`, default http://localhost:5173/).
 *
 *   deno run -A --no-lock research/2026-10-28-visual-pass/shoot.ts \
 *     out.png "scene=boss&hold=600" [waitMs]
 */

import { chromium } from "npm:playwright@1.58.2";

const [out, query, wait = "4000", base = "http://localhost:5173/"] = Deno.args;
const browser = await chromium.launch({
  headless: true,
  args: ["--ignore-gpu-blocklist", "--use-angle=metal"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(`${base}render-harness.html?${query}`);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
if (errors.length) console.log("errors:\n" + errors.join("\n"));
console.log(out);
