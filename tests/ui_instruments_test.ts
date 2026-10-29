import { assertEquals } from "@std/assert";
import type { SimState } from "../src/contracts/index.ts";
import { readInstruments } from "../src/ui/instruments.ts";
import { descriptionKey } from "../src/ui/screens/settings.ts";
import { UI_STRINGS } from "../src/i18n/ui.ts";

/** A snapshot built loosely, so the test survives contract growth. */
function snap(over: Record<string, unknown>): SimState {
  return {
    tick: 10,
    phase: "sector",
    enemies: [],
    boss: null,
    player: { pos: { x: 0, y: 0 } },
    ...over,
  } as unknown as SimState;
}

Deno.test("instruments read nothing from a pre-wave-3 snapshot", () => {
  const m = readInstruments(snap({}));
  assertEquals(m.pay, 0);
  assertEquals(m.multiplier, 1);
  assertEquals(m.writLevel, 0);
  assertEquals(m.scanning, false);
  assertEquals(m.intel, []);
});

Deno.test("Writ charge splits into three cells", () => {
  const m = readInstruments(snap({
    player: { chargeLevel: 1, charge: 0.5 },
  }));
  assertEquals(m.writLevel, 1);
  assertEquals(Math.round(m.writProgress * 100), 50);
  assertEquals(
    readInstruments(snap({ player: { chargeLevel: 3, charge: 1 } }))
      .writProgress,
    0,
  );
});

Deno.test("intel shows only for locked targets, and lock reads from target", () => {
  const m = readInstruments(snap({
    player: { scan: { active: true, targetId: 7 } },
    enemies: [
      { id: 7, ai: "aim", lock: 0.4, locked: false, disarmed: false },
      { id: 8, ai: "retreat", lock: 1, locked: true, disarmed: true },
    ],
    pay: { credits: 1200, rate: 2.5 },
    graze: { meter: 0.3, count: 4 },
  }));
  assertEquals(m.scanTarget, "7");
  assertEquals(m.scanProgress, 0.4);
  assertEquals(m.locked, false);
  assertEquals(m.scanState, null);
  assertEquals(m.intel, [
    { id: "8", state: "retreat", disarmed: true, boss: false },
  ]);
  assertEquals([m.pay, m.multiplier, m.graze, m.grazes], [1200, 2.5, 0.3, 4]);
});

Deno.test("every settings description id exists", () => {
  const keys = [
    "preset",
    "renderScale",
    "fullscreen",
    "audio-master",
    "audio-music",
    "audio-sfx",
    "audio-voice",
    "audio-ui",
    "monoAudio",
    "textLang",
    "voiceLang",
    "moreLangs",
    "subtitles",
    "subtitleScale",
    "subtitleBg",
    "speakerNames",
    "maxLines",
    "autoFire",
    "holdToggle",
    "shake",
    "reducedFlashing",
    "reduceMotion",
    "gameSpeed",
    "difficulty",
    "colorCues",
    "narration",
    "resetControls",
    "resetAll",
    "tab-display",
    "tab-audio",
    "tab-language",
    "tab-subtitles",
    "tab-accessibility",
    "tab-controls",
    "bind-fire-key0",
    "bind-moveUp-button0",
  ];
  for (const key of keys) {
    const desc = descriptionKey(key);
    assertEquals(desc !== null && desc in UI_STRINGS, true, key);
  }
});
