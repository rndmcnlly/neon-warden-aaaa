/**
 * Headless smoke test: the sim runs without a browser, and the same seed and
 * pilot always produce the same run. If this fails, something in `src/sim/`
 * is reading a clock, `Math.random`, or iteration order it should not.
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import type { Pilot, SimOptions } from "../src/contracts/index.ts";
import { parseUrlFlags } from "../src/contracts/index.ts";
import { createSim } from "../src/sim/sim.ts";
import { hashSimState } from "../src/sim/hash.ts";
import { FightingAutopilot } from "../src/pilots/fighting.ts";
import { PacifistAutopilot } from "../src/pilots/pacifist.ts";
import { createSettingsStore, SETTINGS_KEY } from "../src/settings/store.ts";
import { DEFAULT_SETTINGS } from "../src/settings/defaults.ts";

const TICKS = 10_000;

function run(seed: number, pilot: Pilot): { hash: string; kills: number } {
  const options: SimOptions = {
    seed,
    start: { kind: "sector", sector: 1 },
    difficulty: "normal",
  };
  const sim = createSim(options);
  for (let i = 0; i < TICKS; i++) sim.step(pilot.next(sim.snapshot()));
  const state = sim.snapshot();
  assertEquals(state.tick, TICKS);
  return { hash: hashSimState(state), kills: state.kills };
}

Deno.test("same seed and autopilot give the same snapshot hash", () => {
  const a = run(121, new FightingAutopilot());
  const b = run(121, new FightingAutopilot());
  assertEquals(a.hash, b.hash);
});

Deno.test("a different seed gives a different run", () => {
  const a = run(121, new FightingAutopilot());
  const b = run(122, new FightingAutopilot());
  assertNotEquals(a.hash, b.hash);
});

Deno.test("the pacifist autopilot never kills", () => {
  assertEquals(run(121, new PacifistAutopilot()).kills, 0);
});

Deno.test("URL flags parse and clamp", () => {
  const flags = parseUrlFlags("?skipto=boss&autoplay=pacifist&speed=99");
  assertEquals(flags.skipTo, "boss");
  assertEquals(flags.autoPlay, { mode: "pacifist", speed: 32 });
  assertEquals(parseUrlFlags("?skipto=nowhere").skipTo, null);
});

Deno.test("settings persist, merge new defaults, and notify", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
  };
  const store = createSettingsStore(storage);
  let notified = 0;
  store.subscribe(() => notified++);
  store.update((s) => ({ ...s, textLang: "zh" }));
  assertEquals(notified, 1);

  // Simulate an older save missing a key: defaults fill it in.
  const saved = JSON.parse(memory.get(SETTINGS_KEY)!);
  delete saved.settings.subtitles.bgOpacity;
  memory.set(SETTINGS_KEY, JSON.stringify(saved));
  const reloaded = createSettingsStore(storage).get();
  assertEquals(reloaded.textLang, "zh");
  assertEquals(
    reloaded.subtitles.bgOpacity,
    DEFAULT_SETTINGS.subtitles.bgOpacity,
  );
});
