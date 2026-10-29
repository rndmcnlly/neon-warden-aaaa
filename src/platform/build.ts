/** Content-addressed release inventory, generated only for production builds. */
import { type Plugin, type ResolvedConfig, transformWithOxc } from "vite";

export function offlinePlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "neon-offline",
    apply: "build",
    configResolved(c) {
      config = c;
    },
    async closeBundle() {
      const root = config.build.outDir;
      const files: {
        url: string;
        bytes: number;
        hash: string;
        lang: string | null;
      }[] = [];
      async function walk(dir: string, prefix = "") {
        for await (const entry of Deno.readDir(dir)) {
          const name = prefix + entry.name;
          if (entry.isDirectory) await walk(`${dir}/${entry.name}`, `${name}/`);
          else if (
            !name.endsWith(".map") &&
            // Retain historical art on disk, never in a playable offline pack.
            !/^models\/pilot_figure(?:_[^/]+)?\.glb$/.test(name) &&
            // The landing page (site root) is not part of the game's pack:
            // its HTML, its own scripts/styles and its on-demand teaser media.
            name !== "index.html" &&
            !name.startsWith("making-of/") &&
            !/^assets\/landing-[^/]+$/.test(name) &&
            !name.startsWith("media/") &&
            !name.endsWith(".DS_Store") &&
            !["sw.js", "offline-manifest.json"].includes(name)
          ) {
            const data = await Deno.readFile(`${dir}/${entry.name}`);
            const digest = await crypto.subtle.digest("SHA-256", data);
            const hash = Array.from(
              new Uint8Array(digest),
              (n) => n.toString(16).padStart(2, "0"),
            ).join("");
            const lang = name.startsWith("vo/")
              ? name.match(/\/(en|es|zh)\//)?.[1] ?? null
              : null;
            files.push({ url: name, bytes: data.length, hash, lang });
          }
        }
      }
      await walk(root);
      files.sort((a, b) => a.url.localeCompare(b.url));
      const source = await Deno.readTextFile(
        new URL("./worker.ts", import.meta.url),
      );
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(files) + source),
      );
      const version = Array.from(
        new Uint8Array(digest),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("").slice(0, 20);
      const manifest = { version, files };
      await Deno.writeTextFile(
        `${root}/offline-manifest.json`,
        JSON.stringify(manifest),
      );
      const result = await transformWithOxc(
        source.replace("/* RELEASE */ null", JSON.stringify(manifest)),
        "sw.ts",
        { lang: "ts" },
      );
      await Deno.writeTextFile(`${root}/sw.js`, result.code);
    },
  };
}
