import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
  type BeatGrid,
  degreeToMidi,
  nextGridTime,
  offKeyMidi,
} from "../src/audio/beatGrid.ts";
import {
  closestApproach,
  dopplerRate,
  place,
  SPATIAL,
} from "../src/audio/spatial.ts";

const GRID: BeatGrid = {
  bpm: 120,
  beatOffset: 0.1,
  beatsPerBar: 4,
  key: { root: 57, mode: "minor" },
};

Deno.test("musical sounds wait for the next grid line", () => {
  // 120 BPM: a sixteenth is 0.125 s; lines at 10.1, 10.225, 10.35...
  assertAlmostEquals(nextGridTime(10.2, 10, GRID, "16th"), 10.225);
  assertAlmostEquals(nextGridTime(10.2, 10, GRID, "beat"), 10.6);
  assertAlmostEquals(nextGridTime(10.2, 10, GRID, "bar"), 12.1);
  // A hair late snaps back onto the line just passed (never before now).
  assertAlmostEquals(nextGridTime(10.23, 10, GRID, "16th"), 10.23);
  assertAlmostEquals(nextGridTime(10.23, 10, GRID, "16th", 0), 10.35);
});

Deno.test("scale degrees stay in key; enemy fire never does", () => {
  const key = GRID.key; // A minor
  assertEquals(degreeToMidi(key, 0), 57);
  assertEquals(degreeToMidi(key, 2), 60); // C
  assertEquals(degreeToMidi(key, 7), 69); // the octave
  assertEquals(degreeToMidi(key, -1), 55); // G below
  const inKey = new Set(
    Array.from({ length: 7 }, (_, d) => degreeToMidi(key, d) % 12),
  );
  assert(!inKey.has(offKeyMidi(key) % 12));
});

Deno.test("panning follows the ship's point of view; mono centers", () => {
  const ear = { x: 240, y: 560 };
  assert(place({ x: 100, y: 560 }, ear).pan < 0);
  assert(place({ x: 400, y: 560 }, ear).pan > 0);
  assertEquals(place({ x: 9999, y: 560 }, ear).pan, SPATIAL.maxPan);
  assertEquals(place({ x: 100, y: 560 }, ear, true).pan, 0);
  const near = place({ x: 250, y: 540 }, ear);
  const far = place({ x: 250, y: 0 }, ear);
  assert(near.gain > far.gain && near.cutoffHz > far.cutoffHz);
});

Deno.test("doppler rises on approach and falls on retreat", () => {
  const ear = { x: 240, y: 560 };
  const toward = dopplerRate({ x: 240, y: 300 }, { x: 0, y: 8 }, ear);
  const away = dopplerRate({ x: 240, y: 300 }, { x: 0, y: -8 }, ear);
  const across = dopplerRate({ x: 240, y: 300 }, { x: 8, y: 0 }, ear);
  assert(toward > 1 && away < 1);
  assertAlmostEquals(across, 1);
  const pass = closestApproach({ x: 200, y: 400 }, { x: 0, y: 10 }, ear);
  assertAlmostEquals(pass.distance, 40);
  assertAlmostEquals(pass.ticks, 16);
});
