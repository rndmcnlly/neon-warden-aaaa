/** Full-route gameplay validation, not a claim of human preference. */
import { PILOTS, runToEnd } from "../../../tests/sim_harness.ts";
import type { InputFrame } from "../../../src/contracts/index.ts";
const reports = [];
for (const profile of ["classic", "hybrid"] as const) {
  for (const [pilot, make] of Object.entries(PILOTS)) {
    for (const seed of [1, 121]) {
      const frames: InputFrame[] = [];
      const report = runToEnd(seed, () => {
        const actual = make();
        return { kind: actual.kind, next(state) { const frame = actual.next(state); frames.push(frame); return frame; } };
      }, "normal", undefined, undefined, profile);
      const replayFrames: InputFrame[] = JSON.parse(JSON.stringify(frames));
      let cursor = 0;
      const replay = runToEnd(seed, () => ({ kind: "keyboard", next: () => replayFrames[cursor++] }),
        "normal", undefined, undefined, profile);
      reports.push({ profile, pilot, replayHash: replay.hash, replayMatches: replay.hash === report.hash, inputFrames: frames.length, ...report });
      console.log(profile, pilot, seed, report.outcome, report.continuesUsed, report.ticks);
    }
  }
}
await Deno.writeTextFile(new URL("pilot-runs.json", import.meta.url), JSON.stringify({
  recorded: new Date().toISOString(), reports,
  checks: reports.map(r => ({ profile: r.profile, pilot: r.pilot, seed: r.seed,
    pass: r.outcome === (r.pilot === "fight" ? "bossDefeated" : "bossSurvived") &&
      r.replayMatches && (r.pilot === "fight" || r.pacifistIntact) &&
      (r.pilot !== "ghost" || r.neverFired),
  })),
}, null, 2));
if (reports.some(r => r.outcome !== (r.pilot === "fight" ? "bossDefeated" : "bossSurvived"))) Deno.exit(1);
