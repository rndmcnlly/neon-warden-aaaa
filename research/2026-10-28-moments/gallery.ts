/** Build the guided viewer, preserving all original capture evidence.
 * deno run -A --no-lock research/2026-10-28-moments/gallery.ts
 */
import { chapters, notes } from "./guide.ts";
const here = new URL(".", import.meta.url);
const data = JSON.parse(await Deno.readTextFile(new URL("moments.json", here)));
for (const clip of data.clips) {
  if (!notes[clip.id]) throw new Error(`Missing viewing guidance: ${clip.id}`);
}
const template = await Deno.readTextFile(
  new URL("gallery.template.html", here),
);
const payload = JSON.stringify({ ...data, chapters, notes }).replace(
  /</g,
  "\\u003c",
);
await Deno.writeTextFile(
  new URL("index.html", here),
  template.replace("/* GALLERY_DATA */ null", () => payload),
);
console.log(
  `Guided viewer: ${data.clips.length} existing clips, no new captures`,
);
