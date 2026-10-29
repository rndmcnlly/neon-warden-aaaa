import { assertEquals } from "@std/assert";
import type { WordTiming } from "../src/contracts/index.ts";
import { activeWord, segmentChunk } from "../src/ui/wordPulse.ts";

const full = "Hello there, pilot. Fly safe.";
const w = (text: string, startS: number, endS: number): WordTiming => {
  const charStart = full.indexOf(text);
  return { text, charStart, charEnd: charStart + text.length, startS, endS };
};
const words = [
  w("Hello", 0, 0.4),
  w("there", 0.5, 0.8),
  w("pilot", 0.9, 1.3),
  w("Fly", 1.8, 2.0),
  w("safe", 2.0, 2.4),
];

Deno.test("segments map line offsets onto a chunk", () => {
  const segs = segmentChunk(full, "Fly safe.", words);
  assertEquals(segs, [
    { text: "Fly", word: 3 },
    { text: " ", word: -1 },
    { text: "safe", word: 4 },
    { text: ".", word: -1 },
  ]);
  assertEquals(segs.map((s) => s.text).join(""), "Fly safe.");
});

Deno.test("no timings: one plain segment", () => {
  assertEquals(segmentChunk(full, full, undefined), [{ text: full, word: -1 }]);
  assertEquals(segmentChunk(full, "missing", words), [
    { text: "missing", word: -1 },
  ]);
});

Deno.test("active word holds across short gaps, clears outside the take", () => {
  assertEquals(activeWord(words, -0.1), -1);
  assertEquals(activeWord(words, 0.2), 0);
  assertEquals(activeWord(words, 0.45), 0);
  assertEquals(activeWord(words, 1.5), 2);
  assertEquals(activeWord(words, 2.1), 4);
  assertEquals(activeWord(words, 3), -1);
});
