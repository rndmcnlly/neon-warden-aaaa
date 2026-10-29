import { assert, assertEquals } from "@std/assert";
import { acceptsFullscreenKey } from "../src/platform/fullscreen.ts";

Deno.test("fullscreen shortcut respects focus, rebinding, bound controls and modifiers", () => {
  const key = {
    code: "KeyF",
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  };
  assert(acceptsFullscreenKey(key, false, false, false));
  for (
    const field of [
      "repeat",
      "altKey",
      "ctrlKey",
      "metaKey",
      "shiftKey",
    ] as const
  ) {
    assert(
      !acceptsFullscreenKey({ ...key, [field]: true }, false, false, false),
    );
  }
  assert(!acceptsFullscreenKey(key, true, false, false));
  assert(!acceptsFullscreenKey(key, false, true, false));
  assert(!acceptsFullscreenKey(key, false, false, true));
  assert(!acceptsFullscreenKey({ ...key, code: "KeyG" }, false, false, false));
});

Deno.test("manifest has standalone same-scope identity and valid local PNG icons", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile("public/manifest.webmanifest"),
  );
  // The game page is `play/`; the landing page at the root is outside scope.
  assertEquals(manifest.id, "./play/");
  assertEquals(manifest.scope, "./play/");
  assertEquals(manifest.start_url, "./play/");
  assertEquals(manifest.display, "standalone");
  assertEquals(manifest.icons.length, 4);
  for (const icon of manifest.icons) {
    assert(!icon.src.includes(":"));
    const data = await Deno.readFile(`public/${icon.src}`);
    assertEquals(Array.from(data.slice(0, 8)), [
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10,
    ]);
    const view = new DataView(data.buffer);
    const size = Number(icon.sizes.split("x")[0]);
    assertEquals(view.getUint32(16), size);
    assertEquals(view.getUint32(20), size);
    assert([192, 512].includes(size));
    assert(["any", "maskable"].includes(icon.purpose));
  }
});
