import { assert, assertEquals } from "@std/assert";
import { parseUrlFlags } from "../src/contracts/flags.ts";
import { VariantRegistry } from "../src/audio/variants.ts";
import { driveCompensation, driveCurve } from "../src/audio/arenaPa.ts";
import { ceilingCurve, compressorMakeupDb } from "../src/audio/engine.ts";

Deno.test("variant URL parsing and registry reject unknown choices", () => {
  const f = parseUrlFlags(
    "?dev=1&v.voice.tutorial_ai=original&v.music.gameplay=nope",
  );
  assert(f.dev);
  const r = new VariantRegistry(f.variants);
  r.define({
    id: "voice.tutorial_ai",
    kind: "voice",
    choices: ["original", "a_captain"],
    defaultChoice: "original",
  });
  r.define({
    id: "music.gameplay",
    kind: "music",
    choices: ["cand1", "cand2"],
    defaultChoice: "cand2",
  });
  assertEquals(r.get("voice.tutorial_ai"), "original");
  assertEquals(r.get("music.gameplay"), "cand2");
  assertEquals(r.warnings.length, 1);
  let changes = 0;
  r.subscribe(() => changes++);
  r.set("music.gameplay", "cand1");
  r.set("music.gameplay", "cand1");
  assertEquals(changes, 1);
  assertEquals(r.toQuery(), ["v.music.gameplay=cand1"]);
});

Deno.test("master ceiling is monotonic, symmetric and bounded", () => {
  const curve = ceilingCurve(-3.2, -1.2);
  const ceiling = 10 ** (-1.2 / 20);
  for (let i = 0; i < curve.length; i++) {
    assert(Math.abs(curve[i]) <= ceiling);
    assert(Math.abs(curve[i] + curve[curve.length - 1 - i]) < 1e-6);
    if (i) assert(curve[i] >= curve[i - 1]);
  }
  assertEquals(compressorMakeupDb(-6, 20), 3.42);
});

Deno.test("Warden PA distortion cannot secretly amplify quiet speech", () => {
  const curve = driveCurve(0.35, 2049);
  const step = 2 / (curve.length - 1);
  const slope = (curve[1025] - curve[1023]) / (2 * step);
  assert(Math.abs(slope * driveCompensation(0.35) - 1) < 0.001);
});
