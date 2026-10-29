/** Static per-sector budgets from the Blender manifest (same code the test uses). */
import { estimateBudget, SECTOR_LAYOUTS } from "../../src/world/sectors.ts";
import { canvasSize } from "../../src/world/signage.ts";
const manifest = JSON.parse(await Deno.readTextFile(new URL("../../public/models/world/manifest.json", import.meta.url)));
const bytes = (a: string, n: string) => { const [w, h] = manifest[a].signs[n]; const [cw, ch] = canvasSize(w, h); return cw * ch * 4 * 4 / 3; };
const geometryBytes = Object.values(manifest).reduce((n: number, e) => n + (e as { bytes: number }).bytes, 0);
console.log(JSON.stringify({ geometryBytesAllGlb: geometryBytes, sectors: SECTOR_LAYOUTS.map((l) => ({ sector: l.sector, high: estimateBudget(l, false, manifest, bytes), low: estimateBudget(l, true, manifest, bytes) })) }, null, 1));
