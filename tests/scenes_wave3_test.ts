import { assert, assertEquals } from "@std/assert";
import { LANGS, type SimEvent } from "../src/contracts/index.ts";
import { lookup, speakerName } from "../src/i18n/index.ts";
import { SCRIPT_LINES } from "../src/i18n/script.gen.ts";
import { RADIO_TEXT } from "../src/i18n/radio.ts";
import { CODEX_TEXT } from "../src/i18n/codex.ts";
import {
  CODEX_ENTRIES,
  codexUnlockedBy,
  FLAGS,
  RADIO_BANK,
  radioFor,
  radioLines,
  runFlagsAfter,
  timelineForEvent,
} from "../src/scenes/index.ts";

const EMDASH = String.fromCharCode(0x2014);

Deno.test("radio and codex text: all languages, no emdashes", () => {
  const problems: string[] = [];
  for (const table of [RADIO_TEXT, CODEX_TEXT]) {
    for (const [key, text] of Object.entries(table)) {
      for (const lang of LANGS) {
        const s = (text as Record<string, string>)[lang] ?? "";
        if (!s.trim()) problems.push(`${key}:${lang} empty`);
        if (s.includes(EMDASH)) problems.push(`${key}:${lang} emdash`);
      }
    }
  }
  assertEquals(problems, []);
});

Deno.test("every radio line resolves; voiced flags match the VO table", () => {
  for (const situations of Object.values(RADIO_BANK)) {
    for (const lines of Object.values(situations)) {
      for (const line of lines ?? []) {
        for (const lang of LANGS) assert(lookup(line.line, lang), line.line);
        assertEquals(line.voiced, line.line in SCRIPT_LINES, line.line);
        if (line.voiced) assert(speakerName(line.line, "zh"), line.line);
      }
    }
  }
});

Deno.test("every text-only radio line is in the bank", () => {
  const banked = new Set<string>(
    Object.values(RADIO_BANK).flatMap((s) =>
      Object.values(s).flatMap((lines) => (lines ?? []).map((l) => l.line))
    ),
  );
  const orphans = Object.keys(RADIO_TEXT).filter((key) =>
    !key.startsWith("radio.callsign.") && !banked.has(key)
  );
  assertEquals(orphans, []);
});

Deno.test("kill-only radio lines only play when a scout is lost", () => {
  for (const [source, situations] of Object.entries(RADIO_BANK)) {
    for (const [situation, lines] of Object.entries(situations)) {
      for (const line of lines ?? []) {
        const data = SCRIPT_LINES[line.line as keyof typeof SCRIPT_LINES];
        if (data?.route === "kill") {
          assertEquals(situation, "lost", `${source}: ${line.line}`);
        }
      }
    }
  }
});

Deno.test("the scouts' no-fire rule is only said to a Pilot who has not fired", () => {
  const fired = radioLines("drone", "patrol", { hasFired: true });
  const cold = radioLines("drone", "patrol", { hasFired: false });
  assert(!fired.some((l) => l.line === "rad_drone_patrol_002"));
  assert(cold.some((l) => l.line === "rad_drone_patrol_002"));
  assert(radioFor("drone", "patrol", -7, { hasFired: true }) !== null);
});

/** Only the fields scenes read; the rest of each event is irrelevant here. */
const ev = (fields: Record<string, unknown>): SimEvent =>
  ({ tick: 0, ...fields }) as unknown as SimEvent;

Deno.test("codex entries resolve and intel unlocks them", () => {
  for (const entry of CODEX_ENTRIES) {
    for (const lang of LANGS) {
      assert(lookup(entry.title, lang), entry.title);
      assert(lookup(entry.body, lang), entry.body);
    }
  }
  const intel = (codexId: string) =>
    codexUnlockedBy(
      ev({ type: "intel", id: 1, codexId, ai: null, first: true }),
    )
      .map((e) => e.id);
  assertEquals(intel("codex.enemy.lancer"), ["lancer", "commons"]);
  assertEquals(intel("codex.recorder.0121"), ["recorder"]);
  assertEquals(intel("codex.warden.core"), ["wardencore"]);
});

Deno.test("wave 3 events start their beats, only the first time", () => {
  const cases: [SimEvent, string | null][] = [
    [ev({ type: "pickup", kind: "recorder", firstPowerup: true }), "recorder"],
    [ev({ type: "pickup", kind: "recorder", firstPowerup: false }), "recorder"],
    [ev({ type: "scanLock", kind: "drone", first: true }), "beat-first-lock"],
    [ev({ type: "scanLock", kind: "drone", first: false }), null],
    [ev({ type: "disarm", kind: "turret", first: true }), "beat-first-disarm"],
    [ev({ type: "graze", first: true }), "beat-first-graze"],
    [ev({ type: "graze", first: false }), null],
    [ev({ type: "partBreak", target: "boss", first: true }), "beat-warden-pod"],
    [ev({ type: "partBreak", target: "enemy", first: true }), null],
  ];
  for (const [event, expected] of cases) {
    assertEquals(timelineForEvent(event)?.id ?? null, expected, event.type);
  }
  assertEquals(runFlagsAfter(ev({ type: "disarm", kind: "drone" })), {
    [FLAGS.runDisarmed]: true,
  });
});
