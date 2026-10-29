import { assertEquals } from "@std/assert";
import type { Settings } from "../src/contracts/index.ts";
import { DEFAULT_SETTINGS } from "../src/settings/defaults.ts";
import { createSaveStore, parseCheckpoint } from "../src/settings/saveGame.ts";
import { createSettingsStore, SETTINGS_KEY } from "../src/settings/store.ts";
import {
  applyPreset,
  sanitizeSettings,
  setRenderScale,
} from "../src/settings/validate.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

Deno.test("out-of-range values are clamped on write", () => {
  const store = createSettingsStore(memoryStorage());
  store.update((c) => ({
    ...c,
    audio: { ...c.audio, music: 4 },
    subtitles: { ...c.subtitles, scale: 9 },
    accessibility: { ...c.accessibility, gameSpeed: 0.1 },
  }));
  assertEquals(store.get().audio.music, 1);
  assertEquals(store.get().subtitles.scale, 2);
  assertEquals(store.get().accessibility.gameSpeed, 0.5);
});

Deno.test("corrupt saved fields fall back to defaults", () => {
  const storage = memoryStorage();
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      version: 1,
      settings: { textLang: "fr", subtitles: { maxLines: 7 } },
    }),
  );
  const store = createSettingsStore(storage);
  assertEquals(store.get().textLang, "en");
  assertEquals(store.get().subtitles.maxLines, 2);
});

Deno.test("one store per storage object, so main and menus agree", () => {
  const storage = memoryStorage();
  assertEquals(createSettingsStore(storage), createSettingsStore(storage));
});

Deno.test("presets set render scale; a custom scale sets preset custom", () => {
  const low = applyPreset(DEFAULT_SETTINGS, "low");
  assertEquals(low.display.renderScale, 0.5);
  const custom = setRenderScale(low, 0.9);
  assertEquals(custom.display.preset, "custom");
  assertEquals(setRenderScale(custom, 1).display.preset, "high");
});

Deno.test("sanitize keeps a valid settings object unchanged", () => {
  assertEquals(sanitizeSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  const bad = {
    ...DEFAULT_SETTINGS,
    display: { preset: "max" },
  } as unknown as Settings;
  assertEquals(sanitizeSettings(bad).display, DEFAULT_SETTINGS.display);
});

Deno.test("checkpoint round-trips and rejects unknown beats", () => {
  const saves = createSaveStore(memoryStorage());
  assertEquals(saves.load(), null);
  const checkpoint = {
    at: "boss" as const,
    difficulty: "story" as const,
    savedAt: "2026-10-28T12:00:00Z",
  };
  let heard = 0;
  saves.subscribe(() => heard++);
  saves.save(checkpoint);
  assertEquals(saves.load(), checkpoint);
  assertEquals(heard, 1);
  assertEquals(
    parseCheckpoint(
      JSON.stringify({
        version: 1,
        checkpoint: { ...checkpoint, at: "sector9" },
      }),
    ),
    null,
  );
});
