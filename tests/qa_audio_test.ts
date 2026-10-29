import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
  audibleSpans,
  bestLine,
  overlap,
  parseSilence,
  pearson,
  similarity,
  stereoBalance,
  wordAlignment,
} from "../qa/lib/audio.ts";
import { canary } from "../qa/lib/canary.ts";

Deno.test("silencedetect output becomes spans, an open silence runs to the end", () => {
  const err = [
    "[silencedetect @ 0x1] silence_start: 0",
    "[silencedetect @ 0x1] silence_end: 2.5 | silence_duration: 2.5",
    "[silencedetect @ 0x1] silence_start: 7.25",
  ].join("\n");
  const silent = parseSilence(err, 10);
  assertEquals(silent, [{ start: 0, end: 2.5 }, { start: 7.25, end: 10 }]);
  assertEquals(audibleSpans(silent, 10), [{ start: 2.5, end: 7.25 }]);
  assertAlmostEquals(
    overlap([{ start: 2.5, end: 7.25 }], { start: 7, end: 9 }),
    0.25,
  );
});

Deno.test("stereo balance reads hard left, centre and hard right", () => {
  const rate = 1000;
  const pcm = new Float32Array(3 * rate * 2);
  for (let f = 0; f < 3 * rate; f++) {
    const sec = Math.floor(f / rate);
    const v = Math.sin(f / 3) * 0.5;
    pcm[2 * f] = sec === 2 ? 0 : v; // left silent in the last second
    pcm[2 * f + 1] = sec === 0 ? 0 : v; // right silent in the first
  }
  const w = stereoBalance(pcm, rate, 0.5);
  assertEquals(w.length, 6);
  assertAlmostEquals(w[0].balance, -1, 1e-6);
  assertAlmostEquals(w[2].balance, 0, 1e-6);
  assertAlmostEquals(w[5].balance, 1, 1e-6);
  assertAlmostEquals(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-9);
});

Deno.test("word alignment fits the line offset and measures per-word error", () => {
  const words = [0, 0.4, 0.9, 1.5];
  const shown = [
    { index: 0, t: 10.0 },
    { index: 1, t: 10.42 },
    { index: 1, t: 10.6 }, // a re-render of the same word is ignored
    { index: 2, t: 10.9 },
    { index: 3, t: 11.6 },
  ];
  const a = wordAlignment(shown, words)!;
  assertEquals(a.pairs, 4);
  assert(a.maxErrMs > 80 && a.maxErrMs < 120, `max ${a.maxErrMs}`);
  assertEquals(wordAlignment([], words), null);
});

Deno.test("transcripts match script lines across scripts and fragments", () => {
  const lines = [
    {
      id: "a",
      lang: "en",
      text: "Hello, and welcome to Lane Authority onboarding!",
    },
    { id: "b", lang: "zh", text: "欢迎来到航道管理局入职培训" },
  ];
  assert(
    similarity(
      "hello and welcome to lane authority onboarding",
      lines[0].text,
    ) > 0.95,
  );
  assertEquals(bestLine("Hello and welcome", lines)?.id, "a");
  assertEquals(bestLine("欢迎来到航道", lines)?.id, "b");
});

Deno.test("canary trusts heard lines only when scripted and actually audible", () => {
  const script = [{
    id: "desc_001",
    lang: "en",
    text: "You dare enter MY grid? I am the Warden!",
  }];
  const heard = [{
    start_s: 10,
    end_s: 14,
    transcript: "You dare enter my grid? I am the Warden!",
  }];
  assert(canary(heard, script, [{ start: 9.9, end: 14.9 }]).trusted);
  // Same words, but the capture had no voice there: read from subtitles.
  assert(!canary(heard, script, [{ start: 30, end: 31 }]).trusted);
  assert(canary([], script, []).trusted);
  assert(!canary([], script, [{ start: 0, end: 5 }]).trusted);
});
