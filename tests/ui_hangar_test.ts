import { assertEquals } from "@std/assert";
import { DEFAULT_LOADOUT } from "../src/contracts/index.ts";
import { payForRank, rankForPay } from "../src/data/hangar.ts";
import { createProgressStore, sanitizeProgress } from "../src/ui/progress.ts";
import { statDelta } from "../src/ui/screens/hangar.ts";

Deno.test("stat deltas know which direction is better", () => {
  assertEquals(statDelta({ value: 14, base: 10, better: "higher" }), {
    text: "+40%",
    tone: "better",
  });
  assertEquals(
    statDelta({ value: 14, base: 10, better: "lower" }).tone,
    "worse",
  );
  assertEquals(statDelta({ value: 10, base: 10, better: "lower" }).text, "±0%");
});

Deno.test("progress repairs bad saves field by field", () => {
  const p = sanitizeProgress({
    loadout: {
      weapon: "laserSword",
      sensor: "auditor",
      cosmetics: { trimColor: "red" },
    },
    codex: ["codex.enemy.drone", 7],
    careerPay: -5,
  });
  assertEquals(p.loadout.weapon, DEFAULT_LOADOUT.weapon);
  assertEquals(p.loadout.sensor, "auditor");
  assertEquals(
    p.loadout.cosmetics.trimColor,
    DEFAULT_LOADOUT.cosmetics.trimColor,
  );
  assertEquals(p.codex, ["codex.enemy.drone"]);
  assertEquals(p.careerPay, 0);
});

Deno.test("progress persists loadout and unlocks codex once", () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  };
  const a = createProgressStore(storage);
  a.setLoadout({ ...DEFAULT_LOADOUT, weapon: "notary" });
  assertEquals(a.unlockCodex("codex.warden"), true);
  assertEquals(a.unlockCodex("codex.warden"), false);
  a.bankPay(5000);
  const b = createProgressStore(storage);
  assertEquals(b.get().loadout.weapon, "notary");
  assertEquals(b.get().codex, ["codex.warden"]);
  assertEquals(b.get().careerPay, 5000);
});

Deno.test("mastery ranks rise with career pay", () => {
  assertEquals(rankForPay(0), 1);
  assertEquals(rankForPay(payForRank(2)), 2);
  assertEquals(rankForPay(payForRank(3) - 1), 2);
  assertEquals(rankForPay(1e12), 50);
});
