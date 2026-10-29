import { assert, assertEquals } from "@std/assert";
import { DEFAULT_LOADOUT } from "../src/contracts/index.ts";
import { CODEX_INDEX, payForRank, rankForPay } from "../src/data/hangar.ts";
import { hasText } from "../src/i18n/index.ts";
import {
  codexLines,
  createProgressStore,
  PROGRESS_KEY,
  sanitizeProgress,
} from "../src/ui/progress.ts";
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

Deno.test("legacy helmet saves retain ship choices, pay, codex and settings", () => {
  for (const helmetLivery of ["corporateIssue", "worn", "repainted"]) {
    const cosmetics = {
      paint: "rustRed",
      trimColor: "#ff4d6d",
      decal: "tallyMarks",
      trail: "ember",
    } as const;
    const loadout = { weapon: "notary", sensor: "auditor", cosmetics } as const;
    const mem = new Map([
      [
        PROGRESS_KEY,
        JSON.stringify({
          loadout: { ...loadout, cosmetics: { ...cosmetics, helmetLivery } },
          codex: ["codex.warden"],
          careerPay: 5000,
        }),
      ],
      ["neon-warden.settings", "untouched settings sentinel"],
    ]);
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    const store = createProgressStore(storage);
    assertEquals(store.get(), {
      loadout,
      codex: ["codex.warden"],
      careerPay: 5000,
    });
    store.setLoadout(store.get().loadout);
    assertEquals(mem.get(PROGRESS_KEY)?.includes("helmet"), false);
    assertEquals(
      mem.get("neon-warden.settings"),
      "untouched settings sentinel",
    );
    assertEquals(createProgressStore(storage).get(), store.get());
  }
});

Deno.test("every hangar codex id resolves to codex text, not a raw id", () => {
  for (const entry of CODEX_INDEX) {
    const lines = codexLines(entry.id);
    assert(lines, `${entry.id} has no codex entry`);
    assert(hasText(lines.title), `${lines.title} missing`);
  }
  assertEquals(codexLines("codex.nope"), null);
});
