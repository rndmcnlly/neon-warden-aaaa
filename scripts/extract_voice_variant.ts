/**
 * Freezes one speaker's takes from a past commit as a runtime voice variant,
 * so a recast never destroys the voice it replaces:
 *
 *   deno run --allow-run=git --allow-write=public/vo/variants \
 *     scripts/extract_voice_variant.ts tutorial_ai original d62dd09
 *
 * Writes `public/vo/variants/<speaker>/<variant>/<lang>/<id>.ogg` for every
 * line of that speaker in `<commit>:public/vo/cues.json`, and merges the
 * variant into `public/vo/variants/index.json` (the file
 * `src/audio/variants.ts` reads). Each take keeps its duration, word timings
 * and the text it actually speaks, so subtitles stay in sync and a line whose
 * script text has changed since can be flagged.
 */

const [speaker, variant, commit] = Deno.args;
if (!speaker || !variant || !commit) {
  console.error("usage: extract_voice_variant.ts <speaker> <variant> <commit>");
  Deno.exit(2);
}

async function git(args: string[]): Promise<Uint8Array> {
  const r = await new Deno.Command("git", { args, stdout: "piped" }).output();
  if (!r.success) throw new Error(`git ${args.join(" ")} failed`);
  return r.stdout;
}

interface Take {
  readonly file: string;
  readonly duration: number;
  readonly text?: string;
  readonly hash?: string;
  readonly words?: unknown;
}

const cues = JSON.parse(
  new TextDecoder().decode(
    await git(["show", `${commit}:public/vo/cues.json`]),
  ),
) as {
  lines: Record<string, { speaker: string; langs: Record<string, Take> }>;
};

const root = `public/vo/variants/${speaker}/${variant}`;
const lines: Record<string, Record<string, Take>> = {};
let n = 0;
for (const [id, line] of Object.entries(cues.lines)) {
  if (line.speaker !== speaker) continue;
  lines[id] = {};
  for (const [lang, take] of Object.entries(line.langs)) {
    const bytes = await git(["show", `${commit}:public/vo/${take.file}`]);
    await Deno.mkdir(`${root}/${lang}`, { recursive: true });
    await Deno.writeFile(`${root}/${take.file}`, bytes);
    lines[id][lang] = {
      file: `variants/${speaker}/${variant}/${take.file}`,
      duration: take.duration,
      text: take.text,
      hash: take.hash,
      ...(take.words ? { words: take.words } : {}),
    };
    n++;
  }
}

const indexPath = "public/vo/variants/index.json";
let index: { version: 1; speakers: Record<string, unknown> } = {
  version: 1,
  speakers: {},
};
try {
  index = JSON.parse(await Deno.readTextFile(indexPath));
} catch { /* first variant */ }
const entry = (index.speakers[speaker] ?? { variants: {} }) as {
  variants: Record<string, unknown>;
};
entry.variants[variant] = { from: commit, lines };
index.speakers[speaker] = entry;
await Deno.writeTextFile(indexPath, JSON.stringify(index, null, 1) + "\n");
console.log(
  `${n} takes of ${Object.keys(lines).length} ${speaker} lines -> ${root}`,
);
