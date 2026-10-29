/**
 * Mobile and touch QA with Playwright device emulation, one short reel per
 * topic per device (QA policy: single-topic videos, never one long capture).
 *
 *   deno run -A --unsafe-proto tests/mobile_touch_browser.ts [baseUrl]
 *
 * Needs a running dev or preview server (default http://127.0.0.1:4391/).
 * Playwright 1.64 because its WebKit build is the one installed locally.
 * Devices: iPhone 15 and Pixel 7, each in WebKit and Chromium, with touch.
 * Topics: menus (every Back by chip, then by history), tutorial (the move
 * and focus lessons by touch), writ (a Writ release and a disarm by touch),
 * back (system Back and a trackpad swipe pause a run), audio (Ogg Opus).
 *
 * Fingers: Playwright's `tap` for menus (real touch input in both engines);
 * drags are synthetic `PointerEvent`s with pointerType "touch", because
 * WebKit offers no multi-step touch API. The deck never checks `isTrusted`.
 */
import {
  type Browser,
  chromium,
  devices,
  type Page,
  webkit,
} from "npm:playwright@1.64.0";

const BASE = Deno.args[0] ?? "http://127.0.0.1:4391/";
const stamp = new Date().toISOString().replaceAll(":", "-");
const report = `qa/reports/mobile-touch-${stamp}`;
await Deno.mkdir(report, { recursive: true });

interface Check {
  device: string;
  topic: string;
  name: string;
  pass: boolean;
  detail?: string;
}
const checks: Check[] = [];

const COMBOS = [
  { id: "iphone15-webkit", engine: webkit, device: "iPhone 15" },
  { id: "pixel7-chromium", engine: chromium, device: "Pixel 7" },
  { id: "iphone15-chromium", engine: chromium, device: "iPhone 15" },
  { id: "pixel7-webkit", engine: webkit, device: "Pixel 7" },
] as const;

type Topic = (page: Page, ok: Ok) => Promise<void>;
type Ok = (name: string, pass: unknown, detail?: string) => void;

// ---------------------------------------------------------------- fingers

/** Synthetic touch pointer, dispatched where a real finger would land. */
async function finger(
  page: Page,
  type: "pointerdown" | "pointermove" | "pointerup",
  id: number,
  x: number,
  y: number,
) {
  await page.evaluate(({ type, id, x, y }) => {
    const w = globalThis as unknown as { __nwTargets?: Map<number, Element> };
    const targets = w.__nwTargets ??= new Map();
    const target = type === "pointerdown"
      ? document.elementFromPoint(x, y)!
      : targets.get(id) ?? document.elementFromPoint(x, y)!;
    if (type === "pointerdown") targets.set(id, target);
    target.dispatchEvent(
      new PointerEvent(type, {
        pointerId: id,
        pointerType: "touch",
        isPrimary: id === 1,
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
      }),
    );
    if (type === "pointerup") targets.delete(id);
  }, { type, id, x, y });
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  dx: number,
  dy: number,
  ms = 400,
  id = 1,
) {
  const steps = Math.max(2, Math.round(ms / 16));
  await finger(page, "pointerdown", id, from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await finger(
      page,
      "pointermove",
      id,
      from.x + (dx * i) / steps,
      from.y + (dy * i) / steps,
    );
    await page.waitForTimeout(16);
  }
  await finger(page, "pointerup", id, from.x + dx, from.y + dy);
}

async function press(page: Page, selector: string, holdMs: number) {
  const box = (await page.locator(selector).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await finger(page, "pointerdown", 7, x, y);
  await page.waitForTimeout(holdMs);
  await finger(page, "pointerup", 7, x, y);
}

/** Where the drag zone is free of buttons: the deck's left part. */
async function dragOrigin(page: Page) {
  const box = (await page.locator(".nw-touch-controls").boundingBox())!;
  return { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 };
}

const sim = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as {
      __nwqa: {
        sim(): {
          player: { x: number; y: number } | null;
          shotsFired: number;
          tick: number;
        };
      };
    }).__nwqa.sim()
  );
const events = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as {
      __nwqa: { events: { type: string; [k: string]: unknown }[] };
    }).__nwqa.events.map((e) => ({ ...e }))
  );
const flags = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as {
      __nwqa: { flags(): Record<string, boolean> };
    }).__nwqa.flags()
  );

// ---------------------------------------------------------------- topics

/** From a fresh load to the main menu by taps only. */
async function toMainMenu(page: Page) {
  await page.goto(`${BASE}?qa=1`);
  for (let i = 0; i < 20; i++) {
    if (await page.locator('[data-key="settings"]').isVisible()) return;
    // The first-run photosensitivity notice wants its Continue button.
    const notice = page.locator(".nw-screen-notice button").last();
    if (await notice.isVisible()) await notice.tap();
    else {
      await page.tap("body", { position: { x: 120, y: 300 } }).catch(() => {});
    }
    await page.waitForTimeout(500);
  }
  throw new Error("never reached the main menu");
}

const menus: Topic = async (page, ok) => {
  await toMainMenu(page);
  const vw = page.viewportSize()!;
  for (const key of ["settings", "extras", "credits", "chapters"]) {
    await page.tap(`[data-key="${key}"]`);
    await page.waitForTimeout(500);
    const chip = page.locator('[data-qa="back-chip"]');
    const box = await chip.boundingBox();
    ok(`${key}: Back chip visible`, await chip.isVisible());
    ok(
      `${key}: Back chip at least 48 by 48 inside the viewport`,
      box && box.width >= 48 && box.height >= 48 && box.x >= 0 &&
        box.y + box.height <= vw.height,
      JSON.stringify(box),
    );
    await page.screenshot({ path: `${report}/${ctxId}-menu-${key}.png` });
    await chip.tap();
    await page.waitForTimeout(450);
    ok(
      `${key}: Back chip returns to the main menu`,
      await page.locator('[data-key="settings"]').isVisible(),
    );
  }
  // History doors: browser/Android Back from a submenu goes Back in-game.
  await page.tap('[data-key="settings"]');
  await page.waitForTimeout(400);
  const url = page.url();
  await page.goBack().catch(() => {});
  await page.waitForTimeout(500);
  ok(
    "system Back in Settings returns to the main menu, same page",
    page.url() === url &&
      await page.locator('[data-key="settings"]').isVisible(),
    page.url(),
  );
  // Controls tab lists the touch schemes first on touch.
  await page.tap('[data-key="settings"]');
  await page.waitForTimeout(400);
  const controlsTab = page.locator('[data-key="tab-controls"]');
  if (await controlsTab.count()) await controlsTab.tap();
  await page.waitForTimeout(300);
  ok(
    "Controls tab offers the touch scheme",
    await page.locator('[data-key="touchScheme"]').count() > 0,
  );
  await page.screenshot({ path: `${report}/${ctxId}-menu-controls.png` });
  ok(
    "page never scrolls",
    await page.evaluate(() => scrollY === 0 && scrollX === 0),
  );
};

async function startRun(page: Page, at: string) {
  await page.goto(`${BASE}?qa=1&skipto=${at}`);
  // A first tap unlocks audio and confirms the device is touch.
  await page.tap("body", { position: { x: 30, y: 30 } }).catch(() => {});
  await page.locator('[data-qa="touch-fire"]').waitFor({ timeout: 15000 });
  await page.waitForFunction(() => "__nwqa" in globalThis, null, {
    timeout: 15000,
  });
  await page.waitForTimeout(800);
}

const tutorial: Topic = async (page, ok) => {
  await startRun(page, "tutorial");
  const stage = (await page.locator("#stage").boundingBox())!;
  const deck = (await page.locator(".nw-touch-controls").boundingBox())!;
  ok(
    "portrait: stage above the deck, no overlap",
    stage.y + stage.height <= deck.y + 1,
    JSON.stringify({ stage, deck }),
  );
  await page.screenshot({ path: `${report}/${ctxId}-tutorial-layout.png` });
  const o = await dragOrigin(page);
  const x0 = (await sim(page)).player!.x;
  await drag(page, o, -100, 0, 400);
  await page.waitForTimeout(200);
  const x1 = (await sim(page)).player!.x;
  ok("drag moves the ship", x1 < x0 - 1, `${x0} -> ${x1}`);
  // The lessons gate on fresh input and open after the intro lines, which
  // run slower in headless WebKit: keep flying until one clears (60 s cap).
  const lessonCleared = async () =>
    Object.entries(await flags(page)).some(([k, v]) =>
      v && /^tut\.(moved|focus)/.test(k)
    );
  const until = Date.now() + 60_000;
  for (
    let i = 0;
    i < 6 || (!(await lessonCleared()) && Date.now() < until);
    i++
  ) {
    await drag(page, o, -120, 0, 500);
    await page.waitForTimeout(700);
    await drag(page, o, 120, 0, 500);
    await page.waitForTimeout(700);
    await drag(page, o, 0, -60, 400);
    await drag(page, o, 0, 60, 400);
    await page.waitForTimeout(500);
  }
  await page.tap('[data-qa="touch-focus"]');
  await drag(page, o, 40, 0, 900);
  await page.waitForTimeout(1500);
  await page.tap('[data-qa="touch-focus"]');
  const f = await flags(page);
  const lessons = Object.entries(f).filter(([k, v]) =>
    v && /^tut\.(moved|focus)/.test(k)
  ).map(([k]) => k);
  ok(
    "touch clears tutorial movement lessons",
    lessons.length >= 1,
    lessons.join(","),
  );
  const shots0 = (await sim(page)).shotsFired;
  await press(page, '[data-qa="touch-fire"]', 60);
  await page.waitForTimeout(300);
  await press(page, '[data-qa="touch-fire"]', 900);
  await page.waitForTimeout(400);
  ok("FIRE tap and hold shoot", (await sim(page)).shotsFired > shots0);
  await page.screenshot({ path: `${report}/${ctxId}-tutorial-play.png` });
};

const writ: Topic = async (page, ok) => {
  await startRun(page, "sector1");
  const o = await dragOrigin(page);
  let writs = 0;
  let disarms = 0;
  const seen = new Set<string>();
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline && disarms === 0) {
    // Rest: the beam sweeps and the Writ charges. Wait for a fresh lock.
    const ev = await events(page);
    const lock = ev.filter((e) => e.type === "scanLock" && e.target === "enemy")
      .find((e) => !seen.has(String(e.tick)));
    if (!lock) {
      await page.waitForTimeout(250);
      continue;
    }
    seen.add(String(lock.tick));
    const target = (lock.pos as { x: number }).x;
    // Closed-loop alignment by small drags (the scale is the stage's).
    for (let i = 0; i < 12; i++) {
      const p = (await sim(page)).player!;
      const gap = target - p.x;
      if (Math.abs(gap) < 2) break;
      await drag(page, o, Math.max(-60, Math.min(60, gap * 0.8)), 0, 120);
    }
    await press(page, '[data-qa="touch-fire"]', 50);
    await page.waitForTimeout(1200);
    const after = await events(page);
    writs = after.filter((e) => e.type === "playerFired" && e.shot === "writ")
      .length || writs;
    disarms = after.filter((e) => e.type === "disarm").length;
  }
  const impacts = await page.evaluate(() =>
    (globalThis as unknown as {
      __nwqa: { impacts: { type: string; shot?: string }[] };
    }).__nwqa.impacts.filter((e) =>
      e.type === "playerFired" && e.shot === "writ"
    )
      .length
  );
  ok(
    "a Writ released by a FIRE tap after rest",
    impacts > 0 || writs > 0,
    `${impacts}`,
  );
  ok("a disarm by touch", disarms > 0, `${disarms}`);
  await page.screenshot({ path: `${report}/${ctxId}-writ.png` });
};

const back: Topic = async (page, ok) => {
  await startRun(page, "sector1");
  const url = page.url();
  await page.goBack().catch(() => {});
  await page.waitForTimeout(600);
  ok(
    "system Back during a run opens Pause, same page",
    page.url() === url && await page.locator(".nw-screen-pause").isVisible(),
    page.url(),
  );
  await page.screenshot({ path: `${report}/${ctxId}-back-pause.png` });
  await page.locator('[data-qa="back-chip"]').tap();
  await page.waitForTimeout(500);
  ok(
    "Back chip on Pause resumes",
    !(await page.locator(".nw-screen-pause").isVisible()) &&
      await page.locator('[data-qa="touch-fire"]').isVisible(),
  );
  // Again, so the guard re-arms after a pop.
  await page.goBack().catch(() => {});
  await page.waitForTimeout(600);
  ok(
    "second system Back pauses again (guard re-armed)",
    page.url() === url && await page.locator(".nw-screen-pause").isVisible(),
  );
  await press(page, '[data-qa="back-chip"]', 40);
};

const audio: Topic = async (page, ok) => {
  await page.goto(`${BASE}?qa=1`);
  const r = await page.evaluate(async () => {
    const a = document.createElement("audio");
    const ac = new AudioContext();
    const out: Record<string, boolean> = {};
    const cues = await (await fetch("vo/cues.json")).json() as {
      lines: Record<string, { langs: Record<string, { file: string }> }>;
    };
    // Cue files are relative to `vo/`.
    const first = "vo/" + Object.values(cues.lines)[0].langs.en.file;
    for (const u of [first, "sfx/back.ogg", "music/logos/cand1.ogg"]) {
      try {
        await ac.decodeAudioData(await (await fetch(u)).arrayBuffer());
        out[u] = true;
      } catch {
        out[u] = false;
      }
    }
    return { can: a.canPlayType('audio/ogg; codecs="opus"'), out };
  });
  ok("canPlayType Ogg Opus", r.can !== "", r.can);
  ok(
    "decodeAudioData VO, SFX and music Ogg",
    Object.values(r.out).every(Boolean),
    JSON.stringify(r.out),
  );
};

// ---------------------------------------------------------------- run

let ctxId = "";
const TOPICS: [string, Topic][] = [
  ["audio", audio],
  ["menus", menus],
  ["tutorial", tutorial],
  ["writ", writ],
  ["back", back],
];
const only = Deno.env.get("TOPICS")?.split(",");
const onlyDevices = Deno.env.get("DEVICES")?.split(",");
const browsers = new Map<unknown, Browser>();
try {
  for (const combo of COMBOS) {
    if (onlyDevices && !onlyDevices.includes(combo.id)) continue;
    const browser = browsers.get(combo.engine) ??
      await combo.engine.launch({
        args: combo.engine === chromium
          ? ["--autoplay-policy=no-user-gesture-required"]
          : [],
      });
    browsers.set(combo.engine, browser);
    for (const [topic, run] of TOPICS) {
      if (only && !only.includes(topic)) continue;
      ctxId = combo.id;
      const dir = `${report}/video/${combo.id}-${topic}`;
      const context = await browser.newContext({
        ...devices[combo.device],
        recordVideo: { dir, size: devices[combo.device].viewport },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const ok: Ok = (name, pass, detail) =>
        checks.push({ device: combo.id, topic, name, pass: !!pass, detail });
      try {
        await run(page, ok);
      } catch (e) {
        ok("topic ran to the end", false, String(e).slice(0, 300));
      }
      ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
      await context.close();
      console.log(
        combo.id,
        topic,
        checks.filter((c) => c.device === combo.id && c.topic === topic)
          .map((c) => (c.pass ? "PASS " : "FAIL ") + c.name).join("\n  "),
      );
    }
  }
} finally {
  for (const b of browsers.values()) await b.close();
}
const failed = checks.filter((c) => !c.pass);
await Deno.writeTextFile(
  `${report}/result.json`,
  JSON.stringify(
    {
      base: BASE,
      at: stamp,
      passed: checks.length - failed.length,
      failed: failed.length,
      checks,
    },
    null,
    2,
  ),
);
console.log(
  `${
    checks.length - failed.length
  }/${checks.length} pass; ${report}/result.json`,
);
if (failed.length) Deno.exitCode = 1;
