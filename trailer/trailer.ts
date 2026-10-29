/**
 * One command per cut:
 *
 *   deno task trailer <cut> [--lang en|es|zh|all] [--draft | --master]
 *                           [--shots a,b] [--no-capture] [--plan] [--rebuild]
 *   deno task trailer estimate
 *
 * <cut> is a file in trailer/cuts/ (teaser30, trailer90, compendium120).
 * Default: capture every take the cut needs (cached by recipe hash against
 * the frozen build), then assemble a master per language into
 * trailer/out/<cut>/<lang>/. `--draft` renders 640x360 from takes captured
 * at the sheet's viewport and puts named placeholders where takes or anchors
 * are missing; a full master captures at the master size and refuses
 * placeholders. `--master` captures takes by deterministic frame stepping
 * (trailer/master.ts: 60 fps, lossless grabs, audio clock slaved to the
 * frame clock, graphics preset forced to High) and assembles at 60 fps;
 * use it for anything public. Without it, a full-size render uses the
 * real-time recorder, which is soft and runs the game off pace (see
 * research/2026-10-29-trailer-capture/README.md).
 * `--shots` limits capture to the takes those shots use; with `--master`
 * it makes a `-partial` master (placeholders allowed, never public).
 * `--plan` prints timing and warnings only. `--rebuild` refreezes the build
 * (invalidating every cached take). TRAILER_PLAY_URL fills the CTA.
 */

import {
  type Lang,
  LANGS,
  loadSheet,
  planCut,
  type ResolvedTake,
  resolveTake,
  ROOT,
} from "./plan.ts";
import { assemble } from "./assemble.ts";
import { captureTake, frozenBuild, takeDir } from "./capture.ts";

const CUTS = ["teaser30", "trailer90", "compendium120"];
/**
 * Wall seconds per second of master take, measured October 29, 2026 on the
 * M3 Max (PNG grabs, one browser: 6.4x and 6.9x on the two teaser takes).
 * research/2026-10-29-trailer-capture/README.md.
 */
const MASTER_WALL_FACTOR = 6.9;
const args = Deno.args;
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  if (hit) return hit.slice(n.length + 3);
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const cut = args.find((a) =>
  !a.startsWith("--") && !args[args.indexOf(a) - 1]?.match(/^--(lang|shots)$/)
);

if (!cut || (!CUTS.includes(cut) && cut !== "estimate")) {
  console.log(
    `usage: deno task trailer <${
      CUTS.join("|")
    }|estimate> [--lang en|es|zh|all] [--draft | --master] [--shots a,b] [--no-capture] [--plan] [--rebuild]`,
  );
  Deno.exit(2);
}

if (cut === "estimate") {
  await estimate();
  Deno.exit(0);
}

const sheet = await loadSheet(cut);
const langArg = opt("lang") ?? "en";
const langs: Lang[] = langArg === "all" ? [...LANGS] : [langArg as Lang];
if (!langs.every((l) => (LANGS as readonly string[]).includes(l))) {
  throw new Error(`unknown --lang ${langArg}`);
}
const draft = flag("draft");
const master = flag("master");
if (draft && master) throw new Error("--draft and --master are exclusive");
const only = opt("shots")?.split(",");
const partial = master && !!only;
const viewport = draft
  ? sheet.viewport
  : { width: sheet.master.width, height: sheet.master.height };

for (const lang of langs) {
  const plan = await planCut(sheet, lang);
  console.log(
    `${sheet.id} [${lang}] ${
      plan.seconds.toFixed(2)
    } s, ${plan.shots.length} shots, ${plan.vo.length} VO lines`,
  );
  for (const w of plan.warnings) console.log(`  WARN ${w}`);
  if (flag("plan")) {
    for (const s of plan.shots) {
      console.log(
        `  ${s.start.toFixed(2).padStart(6)} +${
          s.dur.toFixed(2)
        }  ${s.spec.id}  ${s.spec.take ?? "card:" + s.spec.card}`,
      );
    }
    continue;
  }
  const build = await frozenBuild(flag("rebuild"));
  console.log(
    `  build ${build.id} (${build.rev}${
      build.dirty ? ", dirty" : ""
    }, ${build.builtAt})`,
  );
  const used = new Set(
    plan.shots.filter((s) => s.spec.take && (!only || only.includes(s.spec.id)))
      .map((s) => s.spec.take!),
  );
  const takes: Record<string, { dir: string; key: string } | undefined> = {};
  for (const id of Object.keys(sheet.takes)) {
    const t = await resolveTake(id, sheet.takes[id], lang, viewport);
    if (master) asMaster(t);
    const { key, dir } = await takeDir(t, build);
    const exists = await Deno.stat(`${dir}/timeline.json`).then(
      () => true,
      () => false,
    );
    if (used.has(id) && !flag("no-capture")) {
      const r = await captureTake(t, build, (s) => console.log(`  ${s}`));
      if (r.cached) console.log(`  [take ${key}] cached`);
      takes[id] = { dir, key };
    } else if (exists) takes[id] = { dir, key };
  }
  if (!draft && !partial) {
    const missing = plan.shots.filter((s) =>
      s.spec.take && !takes[s.spec.take]
    );
    if (missing.length) {
      throw new Error(
        `master needs every take; missing for ${
          missing.map((s) => s.spec.id).join(", ")
        } (use --draft for placeholders)`,
      );
    }
  }
  const out = `${ROOT}trailer/out/${sheet.id}/${lang}`;
  const report = await assemble(plan, {
    out,
    draft,
    partial,
    fps: master ? 60 : undefined,
    takes,
    playUrl: Deno.env.get("TRAILER_PLAY_URL"),
    log: (s) => console.log(s),
  });
  console.log(`  -> ${report.master}`);
  console.log(
    `  loudness ${report.loudness.measured.lufs} LUFS, ${report.loudness.measured.truePeak} dBTP; assembled in ${
      report.assembleSeconds.toFixed(1)
    } s`,
  );
  for (const w of report.warnings.filter((w) => !plan.warnings.includes(w))) {
    console.log(`  WARN ${w}`);
  }
}

/** Master recipe: stepped capture, High graphics forced (its own cache key). */
function asMaster(t: ResolvedTake): ResolvedTake {
  t.capture = "master";
  const display = (t.settings.display ?? {}) as Record<string, unknown>;
  t.settings = {
    ...t.settings,
    display: { ...display, preset: "high", renderScale: 1 },
  };
  return t;
}

/** Take inventory and an upper bound on capture time, per cut and language. */
async function estimate() {
  const build = await frozenBuild(false).catch(() => undefined);
  const seen = new Set<string>();
  let grand = 0;
  for (const id of CUTS) {
    const sheet = await loadSheet(id);
    const vp = { width: sheet.master.width, height: sheet.master.height };
    for (const lang of LANGS) {
      let n = 0, cached = 0, shared = 0, bound = 0;
      for (const [tid, spec] of Object.entries(sheet.takes)) {
        const t = await resolveTake(tid, spec, lang, vp);
        const key = build ? (await takeDir(t, build)).key : `${tid}-${t.lang}`;
        n++;
        if (seen.has(key)) {
          shared++;
          continue;
        }
        seen.add(key);
        if (
          build &&
          await Deno.stat(`${(await takeDir(t, build)).dir}/timeline.json`)
            .then(() => true, () => false)
        ) {
          cached++;
          continue;
        }
        bound += t.maxSeconds;
      }
      grand += bound;
      console.log(
        `${id} [${lang}]: ${n} takes (${shared} shared with earlier masters, ${cached} cached), new capture <= ${
          (bound / 60).toFixed(1)
        } min real time`,
      );
    }
  }
  console.log(
    `all cuts, all languages: new capture <= ${
      (grand / 60).toFixed(1)
    } min of game time at master size`,
  );
  console.log(
    `--master wall time at ${MASTER_WALL_FACTOR}x game time (one browser): <= ${
      ((grand * MASTER_WALL_FACTOR) / 3600).toFixed(1)
    } h`,
  );
}
