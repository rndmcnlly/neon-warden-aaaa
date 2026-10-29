import { assertEquals } from "@std/assert";
import type { SimEvent } from "../src/contracts/index.ts";
import { LADDER } from "../src/render/feedbackLadder.ts";
import {
  Hitstop,
  HITSTOP_MAX_SPEED,
  HITSTOP_TICKS,
  hitstopFor,
} from "../src/render/hitstop.ts";

const kill = (kind: string) =>
  ({
    type: "kill",
    tick: 1,
    id: 7,
    kind,
    score: 100,
    byRam: false,
    clean: false,
  }) as unknown as SimEvent;

const bossBreak = {
  type: "partBreak",
  tick: 1,
  id: 1,
  target: "boss",
  part: "pod_0",
  partKind: "pod",
  pos: { x: 0, y: 0 },
  blocked: false,
} as unknown as SimEvent;

Deno.test("hitstop: big hits only (turret, lancer, boss parts)", () => {
  assertEquals(hitstopFor(kill("turret")), HITSTOP_TICKS);
  assertEquals(hitstopFor(kill("lancer")), HITSTOP_TICKS);
  assertEquals(hitstopFor(kill("drone")), 0);
  assertEquals(hitstopFor(bossBreak), LADDER.podBreak.hitstopTicks);
  assertEquals(
    hitstopFor({ ...bossBreak, target: "enemy" } as unknown as SimEvent),
    0,
  );
});

Deno.test("hitstop: holds N ticks, overlapping hits do not stack", () => {
  const h = new Hitstop();
  h.note([kill("turret"), bossBreak]);
  // The longer freeze wins; the two do not add up.
  const longest = LADDER.podBreak.hitstopTicks;
  const held = Array.from({ length: longest + 2 }, () => h.hold());
  assertEquals(held.filter(Boolean).length, longest);
  assertEquals(held[longest], false);
  h.note([kill("lancer")]);
  h.reset();
  assertEquals(h.hold(), false);
});

Deno.test("hitstop: off under fast autoplay", () => {
  const h = new Hitstop(HITSTOP_MAX_SPEED);
  h.note([kill("turret")]);
  assertEquals(h.hold(), false);
  assertEquals(new Hitstop(1).enabled, true);
});
