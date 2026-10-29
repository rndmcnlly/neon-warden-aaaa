/** Iteration stills from the isolated dev server: deno run -A peek.ts <sector..> */
import { chromium } from "npm:playwright@1.58.2";
const out = new URL("./peek/", import.meta.url).pathname;
await Deno.mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu"] });
const portrait = Deno.env.get("PORTRAIT") === "1";
const wait = Number(Deno.env.get("WAIT") ?? 2500);
try {
  for (const s of Deno.args.length ? Deno.args : ["1", "2", "3", "4", "5"]) {
    const context = await browser.newContext({ viewport: portrait ? { width: 390, height: 844 } : { width: 1366, height: 768 } });
    if (Deno.env.get("LOW") === "1") {
      await context.addInitScript(() => localStorage.setItem("neon-warden.settings", JSON.stringify({ version: 1, settings: { display: { preset: "low" } } })));
    }
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" || m.type() === "warning" ? errors.push(m.text()) : null);
    await page.goto(`http://127.0.0.1:5189/?skipto=sector${s}&autoplay=pacifist&speed=1&seed=121&qa=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(wait);
    const name = `${out}s${s}${portrait ? "-portrait" : ""}${Deno.env.get("LOW") === "1" ? "-low" : ""}.jpg`;
    await page.screenshot({ path: name, quality: 72, type: "jpeg" });
    const world = await page.evaluate(() => (globalThis as any).__nwWorld?.stats());
    console.log(s, JSON.stringify({ ...world, render: undefined }), errors.slice(0, 4));
    await context.close();
  }
} finally { await browser.close(); }
