// Pacing curves from the live wave data (read-only import, no sim run).
// deno run research/2026-10-28-level-design/scripts/pacing.ts
import { SECTORS, sectorSchedule } from "../../../src/sim/waves.ts";

const HZ = 60;
const BIN = 120; // 2 s bins
const WEIGHT: Record<string, number> = { drone: 1, dart: 1.5, turret: 4, lancer: 2 };
const BARS = " .:-=+*#%@";

SECTORS.forEach((plan, i) => {
  const spawns = sectorSchedule(plan);
  const bins = new Array(Math.ceil(plan.capTicks / BIN)).fill(0);
  for (const s of spawns) bins[Math.floor(s.at / BIN)] += WEIGHT[s.kind];
  const max = Math.max(...bins);
  const curve = bins.map((b) => BARS[Math.round((b / max) * (BARS.length - 1))]).join("");
  const gaps: string[] = [];
  const times = [...new Set(spawns.map((s) => s.at))];
  for (let k = 1; k < times.length; k++) {
    const g = times[k] - times[k - 1];
    if (g >= 180) gaps.push(`${(times[k - 1] / HZ).toFixed(1)}s+${(g / HZ).toFixed(1)}`);
  }
  console.log(
    `S${i + 1} ${spawns.length} ships, weight ${bins.reduce((a, b) => a + b, 0)}, ` +
      `min ${(plan.minTicks / HZ).toFixed(0)} s, cap ${(plan.capTicks / HZ).toFixed(0)} s`,
  );
  console.log(`   |${curve}|  rests >=3 s: ${gaps.join(", ") || "none"}`);
});
