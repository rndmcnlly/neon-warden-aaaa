import { assert, assertEquals } from "@std/assert";
import {
  type Cue,
  LANGS,
  type LineId,
  type SimEvent,
  SKIP_TARGETS,
} from "../src/contracts/index.ts";
import { lookup } from "../src/i18n/index.ts";
import { SCRIPT_LINES } from "../src/i18n/script.gen.ts";
import {
  BARK_LINES,
  fightChatter,
  FLAGS,
  noFireChatter,
  RADIO_LINES,
  runFlagsAfter,
  spokenLines,
  timelineForEvent,
  TIMELINES,
} from "../src/scenes/index.ts";

const timelineLines = TIMELINES.flatMap((timeline) =>
  spokenLines(timeline.cues)
);
const allReferenced: LineId[] = [
  ...timelineLines,
  ...fightChatter.lines,
  ...noFireChatter.lines,
  ...BARK_LINES,
  ...RADIO_LINES,
];

Deno.test("every line a scene can speak exists in all three languages", () => {
  const missing = allReferenced.flatMap((line) =>
    LANGS.filter((lang) => !lookup(line, lang)).map((lang) => `${line}:${lang}`)
  );
  assertEquals(missing, []);
});

Deno.test("every scripted VO line is used by some scene, chatter bank or bark", () => {
  const used = new Set<string>(allReferenced);
  const orphans = Object.keys(SCRIPT_LINES).filter((key) => !used.has(key));
  assertEquals(orphans, []);
});

Deno.test("timeline ids are unique and cover the scene skip targets", () => {
  const ids = TIMELINES.map((timeline) => timeline.id);
  assertEquals(new Set(ids).size, ids.length);
  for (const target of SKIP_TARGETS) {
    assert(ids.includes(target), `no timeline for ?skipto=${target}`);
  }
});

Deno.test("every say is followed by a wait, so pacing follows the audio", () => {
  const check = (cues: readonly Cue[], where: string) => {
    cues.forEach((cue, i) => {
      if (cue.type === "say") {
        assertEquals(cues[i + 1]?.type, "wait", `${where}: ${cue.line}`);
      }
      if (cue.type === "branch") {
        check(cue.then, where);
        check(cue.else ?? [], where);
      }
    });
  };
  for (const timeline of TIMELINES) check(timeline.cues, timeline.id);
});

/**
 * Route safety: walk each timeline knowing whether the run is pacifist
 * (true, false or unknown) and make sure no kill-only line can play on a
 * pacifist run, or the reverse, and that Pilot's optional line is gated.
 */
Deno.test("route-specific lines only play on their route", () => {
  const problems: string[] = [];
  const walk = (
    cues: readonly Cue[],
    pacifist: boolean | null,
    pilotGate: boolean,
    where: string,
  ) => {
    for (const cue of cues) {
      if (cue.type === "say") {
        const data = SCRIPT_LINES[cue.line as keyof typeof SCRIPT_LINES];
        if (data.route === "kill" && pacifist !== false) {
          problems.push(`${where}: ${cue.line} is kill-only`);
        }
        if (data.route === "pacifist" && pacifist !== true) {
          problems.push(`${where}: ${cue.line} is pacifist-only`);
        }
        if (data.optional && !pilotGate) {
          problems.push(`${where}: ${cue.line} is optional but ungated`);
        }
      }
      if (cue.type === "branch") {
        const isRoute = cue.flag === FLAGS.runPacifist;
        const isPilot = cue.flag === FLAGS.storyPilotSpeaks;
        walk(cue.then, isRoute ? true : pacifist, pilotGate || isPilot, where);
        walk(cue.else ?? [], isRoute ? false : pacifist, pilotGate, where);
      }
    }
  };
  const routeOf: Record<string, boolean | null> = {
    "ending-kill": false,
    "ending-pacifist": true,
  };
  for (const timeline of TIMELINES) {
    walk(timeline.cues, routeOf[timeline.id] ?? null, false, timeline.id);
  }
  assertEquals(problems, []);
});

Deno.test("sim events start the right scenes", () => {
  const at = { tick: 0 } as const;
  const cases: [SimEvent, string | null][] = [
    [{ ...at, type: "sectorStarted", sector: 3 }, "sector3"],
    [{ ...at, type: "sectorStarted", sector: 6 }, null],
    [
      { ...at, type: "pickup", kind: "spread", firstPowerup: true },
      "flashback",
    ],
    [{ ...at, type: "pickup", kind: "spread", firstPowerup: false }, null],
    [{ ...at, type: "bossWarning" }, "boss"],
    [{ ...at, type: "bossPhase", phase: 3 }, "boss-phase3"],
    [{ ...at, type: "bossDefeated" }, "ending-kill"],
    [{ ...at, type: "bossSurvived" }, "ending-pacifist"],
  ];
  for (const [event, expected] of cases) {
    assertEquals(timelineForEvent(event)?.id ?? null, expected);
  }
});

Deno.test("a ram kill still ends the pacifist run", () => {
  const kill: SimEvent = {
    tick: 1,
    type: "kill",
    id: 7,
    kind: "drone",
    score: 100,
    byRam: true,
    clean: false,
  };
  assertEquals(runFlagsAfter(kill), { [FLAGS.runPacifist]: false });
});
