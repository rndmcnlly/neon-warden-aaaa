/**
 * Copies the rendered voice-over (`vo/out/`) into `public/vo/` so Vite serves
 * it at `vo/cues.json` and `vo/<lang>/<id>.wav`, where `src/audio/` looks.
 *
 * Why a copy instead of pointing Vite at `vo/out/`: `vo/` is the VO
 * pipeline's workspace (scripts, voices, per-line ASR reports), and only the
 * manifest and the audio belong in a shipped build. `public/vo/` is
 * gitignored; `deno task dev` and `deno task build` run this first, so it is
 * always fresh. Run it alone with `deno task vo:sync`.
 */

const SOURCE = "vo/out";
const TARGET = "public/vo";

/** Only what the game reads: the manifest and the rendered takes. */
function shipped(name: string): boolean {
  return name === "cues.json" || name.endsWith(".wav");
}

async function copyTree(from: string, to: string): Promise<number> {
  await Deno.mkdir(to, { recursive: true });
  let copied = 0;
  for await (const entry of Deno.readDir(from)) {
    const src = `${from}/${entry.name}`;
    const dst = `${to}/${entry.name}`;
    if (entry.isDirectory) copied += await copyTree(src, dst);
    else if (entry.isFile && shipped(entry.name)) {
      await Deno.copyFile(src, dst);
      copied++;
    }
  }
  return copied;
}

// Start clean so a retired line (a deleted take) does not linger in builds.
await Deno.mkdir(TARGET, { recursive: true });
for await (const entry of Deno.readDir(TARGET)) {
  if (entry.name !== ".gitkeep") {
    await Deno.remove(`${TARGET}/${entry.name}`, { recursive: true });
  }
}
const count = await copyTree(SOURCE, TARGET);
console.log(`vo:sync copied ${count} files from ${SOURCE} to ${TARGET}`);
