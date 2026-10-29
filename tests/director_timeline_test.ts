import { assertEquals } from "@std/assert";
import {
  type Cue,
  lineId,
  sfxRole,
  type Timeline,
} from "../src/contracts/index.ts";
import { makeRig } from "../src/director/fakes.ts";

const A = lineId("line_a");
const B = lineId("line_b");

const scene: Timeline = {
  id: "test",
  cues: [
    { type: "music", cue: "flashback", fadeMs: 500 },
    { type: "freezeSim" },
    { type: "say", line: A },
    { type: "wait", until: "lineEnds" },
    { type: "wait", ms: 500 },
    { type: "sfx", role: sfxRole("notify") },
    { type: "say", line: B },
    { type: "wait", until: "lineEnds" },
    { type: "camera", shot: "gameplay", durationMs: 800 },
    { type: "resumeSim" },
  ],
};

Deno.test("timeline plays in order against the clock", async () => {
  const rig = makeRig({ line_a: 1000, line_b: 2000 });
  const done = rig.director.play(scene);
  assertEquals(rig.log, [
    "music flashback 500",
    "freeze",
    "say scripted line_a en @0",
  ]);

  rig.advance(1490);
  assertEquals(rig.log.length, 3, "still waiting: line (1000) plus 500");
  rig.advance(20);
  assertEquals(rig.log.slice(3), [
    "sfx notify",
    "say scripted line_b en @1506",
  ]);

  rig.advance(2000);
  assertEquals(rig.log.slice(5), ["camera gameplay 800", "resume"]);
  await done;
  assertEquals(rig.director.timeline, null);
});

Deno.test("subtitles follow textLang, audio follows voiceLang", () => {
  const rig = makeRig({ line_a: 1000 });
  rig.settings = {
    textLang: "es",
    voiceLang: "zh",
    subtitles: { maxLines: 2 },
  };
  rig.director.play({ id: "t", cues: [{ type: "say", line: A }] });
  assertEquals(rig.log, ["say scripted line_a zh @0"]);
  assertEquals(rig.director.subtitles.view?.text, "es:line_a");
  rig.advance(1100);
  assertEquals(rig.director.subtitles.view, null);
});

Deno.test("branch on flag, including a flag set earlier in the scene", () => {
  const branchy: Cue[] = [
    { type: "setFlag", flag: "spared", value: true },
    {
      type: "branch",
      flag: "spared",
      then: [{ type: "music", cue: "ending", fadeMs: 1 }],
      else: [{ type: "music", cue: "boss", fadeMs: 1 }],
    },
    { type: "branch", flag: "unset", then: [{ type: "freezeSim" }] },
    { type: "resumeSim" },
  ];
  const rig = makeRig();
  rig.director.play({ id: "b", cues: branchy });
  assertEquals(rig.log, ["music ending 1", "resume"]);
  assertEquals(rig.director.getFlag("spared"), true);
});

Deno.test("skipLine cuts the line and releases its wait", () => {
  const rig = makeRig({ line_a: 5000, line_b: 1000 });
  rig.director.play({ id: "s", cues: scene.cues.slice(2, 7) });
  rig.advance(100);
  rig.director.skipLine(); // releases "lineEnds"
  assertEquals(rig.log.at(-1), "stop scripted line_a");
  rig.director.skipLine(); // releases the 500 ms gap
  assertEquals(rig.log.slice(-2), [
    "sfx notify",
    "say scripted line_b en @100",
  ]);
});

Deno.test("skipScene keeps lasting state and drops the rest", async () => {
  const rig = makeRig({ line_a: 1000, line_b: 1000 });
  const done = rig.director.play(scene);
  rig.advance(200);
  rig.log.length = 0;
  rig.director.skipScene();
  await done;
  assertEquals(rig.log, [
    "stop scripted line_a",
    "camera gameplay 0",
    "resume",
  ]);
});

Deno.test("waits do not drift with frame timing", () => {
  const rig = makeRig();
  rig.director.play({
    id: "w",
    cues: [
      { type: "wait", ms: 10 },
      { type: "wait", ms: 10 },
      { type: "wait", ms: 10 },
      { type: "sfx", role: sfxRole("x") },
    ],
  });
  rig.advance(16); // one frame: first wait ends at 10, second at 20
  assertEquals(rig.log, []);
  rig.advance(16); // t = 32 >= 30
  assertEquals(rig.log, ["sfx x"]);
});
