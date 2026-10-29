/** Reuse the project's static QA without writing qa/ or its shared latest. */
import { coverage } from "../../qa/coverage.ts";
import { assets } from "../../qa/assets.ts";

const stages = [await coverage(), await assets()];
const counts: Record<string, number> = {};
for (const stage of stages) {
  for (const check of stage.checks) {
    counts[check.status] = (counts[check.status] ?? 0) + 1;
  }
}
const result = {
  capturedAt: new Date().toISOString(),
  scope:
    "Existing coverage and asset checks on the shared checkout. No game edits or captures in this workstream.",
  counts,
  stages,
};
await Deno.writeTextFile(
  new URL("./static-qa.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    report: "research/2026-10-28-control-feel/static-qa.json",
    counts,
  }),
);
if (counts.fail) Deno.exitCode = 1;
