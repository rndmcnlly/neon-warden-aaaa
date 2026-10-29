import { coverage } from "../../../qa/coverage.ts";
import { assets } from "../../../qa/assets.ts";
const stages = [await coverage(), await assets()];
const counts: Record<string, number> = {};
for (const stage of stages) for (const check of stage.checks) counts[check.status] = (counts[check.status] ?? 0) + 1;
await Deno.writeTextFile(new URL("static-qa.json", import.meta.url), JSON.stringify({ recorded: new Date().toISOString(), counts, stages }, null, 2));
console.log(counts);
if (counts.fail) Deno.exit(1);
