import { assert, assertEquals } from "@std/assert";
import { lineId } from "../src/contracts/index.ts";
import { Deck } from "../src/director/ambient.ts";
import { DIRECTOR_TUNING } from "../src/director/director.ts";
import { makeRig } from "../src/director/fakes.ts";

const bark = lineId("bark_1");
const banks = [{
  id: "radio",
  lines: [bark],
  firstAtMs: 1000,
  intervalMs: [5000, 5000] as const,
}];

Deno.test("a scripted line ducks a bark instead of cutting it", () => {
  const rig = makeRig({ bark_1: 4000, line_a: 1000 });
  rig.director.startChatter(banks);
  rig.advance(1000);
  assertEquals(rig.log, ["say ambient bark_1 en @1000"]);
  assertEquals(rig.director.subtitles.view?.layer, "ambient");

  rig.director.play({
    id: "s",
    cues: [{ type: "say", line: lineId("line_a") }],
  });
  assertEquals(rig.log.slice(1), [
    "say scripted line_a en @1000",
    `gain ambient bark_1 ${DIRECTOR_TUNING.barkDuckGain}`,
  ]);
  assert(!rig.log.some((l) => l.startsWith("stop ambient")), "never cut");
  assertEquals(rig.director.subtitles.view?.layer, "scripted");

  rig.advance(1000); // scripted line ends: bark comes back up, caption too
  assertEquals(rig.log.at(-1), "gain ambient bark_1 1");
  assertEquals(rig.director.subtitles.view?.layer, "ambient");
});

Deno.test("chatter yields while a scene runs, then waits a beat", () => {
  const rig = makeRig({ bark_1: 500 });
  rig.director.startChatter(banks);
  rig.director.play({ id: "long", cues: [{ type: "wait", ms: 3000 }] });
  rig.advance(3000);
  assertEquals(rig.log, [], "no bark during the scene");
  rig.advance(DIRECTOR_TUNING.quietAfterScriptMs + 32);
  assertEquals(rig.log.length, 1);
});

Deno.test("deck never repeats a card within a round or across the seam", () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const deck = new Deck(["a", "b", "c"], random);
  const dealt = Array.from({ length: 30 }, () => deck.deal());
  for (let i = 0; i < 30; i += 3) {
    assertEquals(new Set(dealt.slice(i, i + 3)).size, 3);
  }
  for (let i = 1; i < 30; i++) assert(dealt[i] !== dealt[i - 1]);
});
