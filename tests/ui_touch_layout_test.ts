/**
 * Touch layout cases (src/ui/touchLayout.ts) and the device-tier decision
 * (src/render/autoTier.ts): both pure, so phones are pinned without one.
 */
import { assert, assertEquals } from "@std/assert";
import { MIN_DECK, STAGE_ASPECT, touchLayout } from "../src/ui/touchLayout.ts";
import {
  type DeviceHints,
  hintedPreset,
  p90,
  probedPreset,
} from "../src/render/autoTier.ts";
import { QUALITY_TIERS } from "../src/render/quality.ts";

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

Deno.test("layout: iPhone 15 portrait gets a deck below the playfield", () => {
  const insets = { top: 59, right: 0, bottom: 34, left: 0 };
  const l = touchLayout(393, 852, insets);
  assertEquals(l.mode, "deck");
  assertEquals(l.stage.y, 59, "inside the top safe area");
  assert(l.stage.width === 393);
  assert(l.stage.height >= 393 * STAGE_ASPECT - 1, "playfield fits the width");
  assert(l.controls.height >= MIN_DECK);
  assertEquals(l.controls.y, l.stage.y + l.stage.height, "no overlap");
  assertEquals(l.controls.y + l.controls.height, 852 - 34, "above home bar");
});

Deno.test("layout: iPhone Safari with toolbars narrows the stage for a deck", () => {
  const l = touchLayout(393, 659, NONE);
  assertEquals(l.mode, "deck");
  assertEquals(l.controls.height, MIN_DECK);
  assert(l.stage.width < 393 && l.stage.width >= 393 * 0.8);
  assertEquals(l.stage.x * 2 + l.stage.width, 393, "centered");
});

Deno.test("layout: a short phone with browser chrome falls back to overlay", () => {
  const l = touchLayout(375, 553, NONE);
  assertEquals(l.mode, "overlay");
  assertEquals(l.stage.height, 553);
  assert(l.controls.y > l.stage.y);
});

Deno.test("layout: landscape phone gets side decks inside the notch insets", () => {
  const l = touchLayout(852, 393, { top: 0, right: 59, bottom: 21, left: 59 });
  assertEquals(l.mode, "side");
  assert(l.stage.x >= 59);
  assertEquals(l.stage.height, 393 - 21);
  assert(l.controls.x + l.controls.width <= 852 - 59 + 0.001);
});

Deno.test("layout: very tall screens cap the deck and grow the stage", () => {
  const l = touchLayout(360, 1200, NONE);
  assertEquals(l.mode, "deck");
  assert(l.controls.height <= 300);
  assert(l.stage.height > 360 * STAGE_ASPECT);
});

const DESKTOP: DeviceHints = {
  memoryGb: 8,
  cores: 12,
  coarse: false,
  phone: false,
  chromeOs: false,
  softwareGl: false,
};

Deno.test("auto tier: hints nudge, never promote", () => {
  assertEquals(hintedPreset(DESKTOP), "high");
  assertEquals(hintedPreset({ ...DESKTOP, softwareGl: true }), "school");
  assertEquals(
    hintedPreset({ ...DESKTOP, coarse: true, phone: true }),
    "school",
    "phones start on School",
  );
  assertEquals(
    hintedPreset({ ...DESKTOP, chromeOs: true, memoryGb: 4, cores: 4 }),
    "school",
    "a 4 GB school Chromebook",
  );
  assertEquals(hintedPreset({ ...DESKTOP, memoryGb: 4 }), "low");
  assertEquals(hintedPreset({ ...DESKTOP, coarse: true }), "medium");
  // Unknown renderer (fingerprinting resistance) is "unknown", not "fast".
  assertEquals(hintedPreset({ ...DESKTOP, softwareGl: null }), "high");
});

Deno.test("auto tier: the probe steps down on slow frames only", () => {
  assertEquals(probedPreset("high", 16.7), "high");
  assertEquals(probedPreset("high", 25), "medium");
  assertEquals(probedPreset("low", 25), "school");
  assertEquals(probedPreset("medium", 40), "school");
  assertEquals(probedPreset("school", 25), "school");
  assertEquals(p90([]), 0);
  const samples = Array.from({ length: 100 }, (_, i) => (i < 85 ? 16 : 40));
  assertEquals(p90(samples), 40);
});

Deno.test("school tier keeps bullets but drops post and caps pixels", () => {
  const s = QUALITY_TIERS.school;
  assertEquals(s.post, false);
  assertEquals(s.bloom, false);
  assert((s.maxPixels ?? Infinity) <= 1_000_000);
  assert(s.starCount < QUALITY_TIERS.low.starCount);
  assert(s.maxParticles < QUALITY_TIERS.low.maxParticles);
});
