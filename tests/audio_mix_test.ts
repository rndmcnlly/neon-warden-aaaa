import { assert, assertEquals } from "@std/assert";
import { lineId } from "../src/contracts/index.ts";
import { DUCK_TUNING, Ducker } from "../src/audio/ducker.ts";
import { StagedLoader } from "../src/audio/loader.ts";
import { sfxUrls, VoCatalog } from "../src/audio/manifests.ts";
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
  });
  assertEquals(vo.resolve(lineId("missing"), "en"), undefined);
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
