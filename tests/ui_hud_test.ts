import { assert, assertEquals } from "@std/assert";
import type { SimEvent, SimState } from "../src/contracts/index.ts";
import {
  bannerFontSize,
  bannerForEvent,
  emptyTally,
  hudModel,
  tallyEvent,
} from "../src/ui/hud.ts";
import { CREDITS } from "../src/ui/creditsRoll.ts";
import { THIRD_PARTY } from "../src/data/thirdParty.ts";
import { id, t } from "../src/i18n/index.ts";
import { UI_STRINGS } from "../src/i18n/ui.ts";
import { LANGS } from "../src/contracts/index.ts";

/** Loose on purpose: the fixture survives the sim contract growing. */
function state(over: Record<string, unknown> = {}): SimState {
  return {
    tick: 100,
    seed: 121,
    phase: "sector",
    outcome: null,
    sector: 2,
    player: {
      pos: { x: 240, y: 560 },
      radius: 3,
      lives: 3,
      power: 2,
      shielded: false,
      graceTicks: 0,
      bank: 0,
    },
    enemies: [],
    bullets: [],
    pickups: [],
    boss: null,
    score: 1200,
    kills: 0,
    flags: { pacifistIntact: true, firstPowerupTaken: false },
    ...over,
  } as unknown as SimState;
}

const spawn = (id: number): SimEvent => ({
  type: "spawn",
  tick: 1,
  id,
  kind: "drone",
});

Deno.test("HUD: spared counts enemies that left alive, not kills or wipes", () => {
  const tally = emptyTally();
  for (let i = 1; i <= 6; i++) tallyEvent(tally, spawn(i));
  tallyEvent(tally, { type: "despawn", tick: 2, id: 6, reason: "wiped" });
  tallyEvent(tally, { type: "spawn", tick: 2, id: 7, kind: "warden" });
  const alive = [{
    id: 5,
    kind: "drone" as const,
    pos: { x: 0, y: 0 },
    radius: 8,
    hp: 1,
    maxHp: 1,
    age: 10,
  }];
  // 6 spawned, 1 wiped, 2 killed, 1 still on screen: 2 spared.
  const m = hudModel(state({ kills: 2, enemies: alive }), tally);
  assertEquals(m.spared, 2);
});

Deno.test("HUD: the tutorial hides the pacifist note and the spared count", () => {
  const tally = emptyTally();
  tallyEvent(tally, spawn(1));
  const m = hudModel(state({ phase: "tutorial" }), tally);
  assertEquals([m.tutorial, m.pacifist, m.spared], [true, false, 0]);
});

Deno.test("HUD: Warden meter shows health, phase and the shielded descent", () => {
  const boss = {
    id: 9,
    pos: { x: 240, y: 120 },
    radius: 60,
    hp: 150,
    maxHp: 600,
    phase: 2 as const,
    invulnerable: false,
  };
  const m = hudModel(state({ phase: "boss", boss }), emptyTally());
  assertEquals(m.warden, { fraction: 0.25, phase: 2, shielded: false });
  const ended = hudModel(state({ phase: "ended", boss }), emptyTally());
  assertEquals(ended.warden, null);
});

Deno.test("HUD: the serial stays hidden until the flashback reveals it", () => {
  const tally = emptyTally();
  assertEquals(hudModel(state(), tally).serial, null);
  tally.serialRevealed = true;
  assertEquals(hudModel(state(), tally).serial, "0122");
});

Deno.test("banners: sectors 1-5 announce, the Warden gets a warning", () => {
  const s3 = bannerForEvent({ type: "sectorStarted", tick: 1, sector: 3 });
  assertEquals(s3?.title, ["ui.sector.3.name"]);
  assertEquals(
    bannerForEvent({ type: "sectorStarted", tick: 1, sector: 6 }),
    null,
  );
  assertEquals(
    bannerForEvent({ type: "bossWarning", tick: 1 })?.tone,
    "warning",
  );
});

Deno.test("banners: longer titles get smaller type (ES runs wider)", () => {
  const en = t(id("ui.banner.wardenDown"), "en");
  const es = t(id("ui.banner.wardenDown"), "es");
  const ratio = (css: string) => Number(/\/ ([\d.]+)\)/.exec(css)![1]);
  assert(ratio(bannerFontSize(es)) > ratio(bannerFontSize(en)));
});

Deno.test("licenses and credits: Orbitron and Stable Audio 3 are listed", () => {
  const names = THIRD_PARTY.map((e) => e.name).join("|");
  assert(names.includes("Orbitron"));
  assert(names.includes("Stable Audio 3"));
  assert(!names.includes("Phaser"));
  const notes: Record<string, unknown> = UI_STRINGS;
  for (const entry of THIRD_PARTY) {
    assert(entry.note in notes, entry.note);
  }
  const licenses = CREDITS.find((s) => s.heading === "ui.crawl.dept.licenses");
  assertEquals(licenses?.roles[0].names.length, THIRD_PARTY.length);
});

Deno.test("credits crawl: every department and role resolves in all languages", () => {
  for (const section of CREDITS) {
    for (const lang of LANGS) {
      assert(!t(id(section.heading), lang).startsWith("["));
      for (const role of section.roles) {
        if (role.role) assert(!t(id(role.role), lang).startsWith("["));
      }
    }
  }
});
