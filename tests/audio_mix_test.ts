import { assert, assertEquals } from "@std/assert";
import { lineId } from "../src/contracts/index.ts";
import { DUCK_TUNING, Ducker } from "../src/audio/ducker.ts";
import { StagedLoader } from "../src/audio/loader.ts";
import {
  sfxUrls,
  VO_LEAD_KEEP_S,
  VoCatalog,
  voStartS,
} from "../src/audio/manifests.ts";
import { onsetFromSamples } from "../scripts/vo_onset.ts";
import { chunkSubtitle } from "../src/director/subtitles.ts";

Deno.test("voice ducks music until the last voice ends", () => {
  const ramps: number[] = [];
  const ducker = new Ducker({
    setTargetAtTime: (v) => ramps.push(v),
    cancelScheduledValues: () => {},
  }, () => 0);
  ducker.voiceStarted();
  ducker.voiceStarted();
  ducker.voiceEnded();
  assertEquals(ramps, [DUCK_TUNING.duckedGain], "one voice still talking");
  ducker.voiceEnded();
  ducker.voiceEnded(); // extra end is ignored
  assertEquals(ramps, [DUCK_TUNING.duckedGain, 1]);
});

Deno.test("VO falls back to English when a language is missing", () => {
  const vo = new VoCatalog({
    lines: {
      a: {
        speaker: "warden",
        scene: "boss",
        langs: {
          en: { file: "en/a.wav", duration: 2 },
          es: { file: "es/a.wav", duration: 3 },
        },
      },
    },
  });
  assertEquals(vo.resolve(lineId("a"), "es")?.durationMs, 3000);
  assertEquals(vo.resolve(lineId("a"), "zh"), {
    lang: "en",
    url: "vo/en/a.wav",
    durationMs: 2000,
    startS: 0,
  });
  assertEquals(vo.resolve(lineId("missing"), "en"), undefined);
});

Deno.test("VO skips measured lead-in silence in playback, duration and words", () => {
  const words = [
    { text: "Hello", charStart: 0, charEnd: 5, startS: 0.72, endS: 0.96 },
    { text: "pilot", charStart: 6, charEnd: 11, startS: 1.2, endS: 1.5 },
  ];
  const vo = new VoCatalog({
    lines: {
      a: {
        speaker: "tutorial_ai",
        scene: "tutorial",
        langs: {
          en: { file: "en/a.ogg", duration: 2, words, onsetS: 0.64 },
          es: { file: "es/a.ogg", duration: 2, onsetS: 0.05 },
        },
      },
    },
  });
  const startS = 0.64 - VO_LEAD_KEEP_S;
  const en = vo.resolve(lineId("a"), "en")!;
  assertEquals(en.startS, startS);
  assertEquals(Math.round(en.durationMs), Math.round((2 - startS) * 1000));
  const shifted = vo.words(lineId("a"), "en")!;
  // Word timing follows the playback clock: the first word lands just after
  // the kept breath, and every word moves by the same amount.
  assertEquals(Math.round(shifted[0].startS * 100), 20);
  assertEquals(
    Math.round((shifted[1].startS - shifted[0].startS) * 100),
    Math.round((1.2 - 0.72) * 100),
  );
  // Same list object every call: the per-frame subtitle lookup stays cheap.
  assertEquals(vo.words(lineId("a"), "en"), shifted);
  // An onset inside the kept breath is never trimmed, nor is a missing one.
  assertEquals(vo.resolve(lineId("a"), "es")!.startS, 0);
  assertEquals(voStartS({}), 0);
});

Deno.test("VO onset: first sustained sound, clicks and silence ignored", () => {
  const rate = 16000;
  const samples = new Float32Array(rate);
  samples[800] = 0.9; // a lone click at 50 ms is not speech
  for (let i = 0.4 * rate; i < rate; i++) {
    samples[i] = 0.1 * Math.sin(i * 0.2);
  }
  assertEquals(onsetFromSamples(samples, rate), 0.4);
  assertEquals(onsetFromSamples(new Float32Array(rate), rate), 0);
});

Deno.test("unpicked sfx roles are silent, not errors", () => {
  const urls = sfxUrls({
    sounds: { confirm: { src: "sfx/c.ogg" }, back: null },
  });
  assertEquals([...urls], [["confirm", "sfx/c.ogg"]]);
  assertEquals(sfxUrls(null).size, 0);
});

Deno.test("staged loader survives failures and reports progress", async () => {
  const loader = new StagedLoader(
    (url) =>
      url === "bad"
        ? Promise.reject(new Error("404"))
        : Promise.resolve(url.toUpperCase()),
    { concurrency: 2 },
  );
  for (const u of ["a", "bad", "c"]) loader.add("menu", u);
  const seen: number[] = [];
  loader.onProgress((p) => seen.push(p.done));
  const report = await loader.loadStage("menu");
  assertEquals(report, { stage: "menu", done: 3, failed: 1, total: 3 });
  assertEquals(seen, [1, 2, 3]);
  assertEquals(loader.get("c"), "C");
  assertEquals(loader.get("bad"), undefined);
});

Deno.test("subtitle chunks respect the line cap and cover the duration", () => {
  const text =
    "Great job pressing the left key! Now, for your next challenge: press the right key. I believe in you. Take all the time you need.";
  const oneLine = chunkSubtitle(text, "en", 9360, 42);
  assert(oneLine.every((c) => [...c.text].length <= 42));
  assertEquals(oneLine.at(-1)?.endMs, 9360);
  const twoLines = chunkSubtitle(text, "en", 9360, 84);
  assert(twoLines.length < oneLine.length);
  const zh = chunkSubtitle(
    "左键按得真棒！现在，你的下一个挑战是：按右键。我相信你。慢慢来，不着急。",
    "zh",
    8000,
    16,
  );
  assert(zh.every((c) => [...c.text].length <= 16));
});
