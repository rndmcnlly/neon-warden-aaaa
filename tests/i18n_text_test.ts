import { assert, assertEquals } from "@std/assert";
import { LANGS, lineId } from "../src/contracts/index.ts";
import {
  allTextIds,
  id,
  scriptLine,
  setMissingTextHandler,
  speakerName,
  t,
} from "../src/i18n/index.ts";
import { SCRIPT_LINES } from "../src/i18n/script.gen.ts";
import { UI_STRINGS } from "../src/i18n/ui.ts";
import type { LocalizedText } from "../src/i18n/types.ts";

const tables: Record<string, Readonly<Record<string, LocalizedText>>> = {
  script: Object.fromEntries(
    Object.entries(SCRIPT_LINES).map(([k, v]) => [k, v.text]),
  ),
  ui: UI_STRINGS,
};

Deno.test("every text id has non-empty EN, ES and ZH", () => {
  const missing: string[] = [];
  for (const [name, table] of Object.entries(tables)) {
    for (const [key, text] of Object.entries(table)) {
      for (const lang of LANGS) {
        if (!text[lang]?.trim()) missing.push(`${name}:${key}:${lang}`);
      }
    }
  }
  assertEquals(missing, []);
});

Deno.test("script and UI ids do not collide, and UI ids start with ui.", () => {
  const ids = allTextIds();
  assertEquals(new Set(ids).size, ids.length);
  for (const key of Object.keys(UI_STRINGS)) assert(key.startsWith("ui."), key);
  for (const key of Object.keys(SCRIPT_LINES)) {
    assert(!key.startsWith("ui."), key);
  }
});

const EMDASH = String.fromCharCode(0x2014);

Deno.test("house style: no emdashes; spoken text has no parentheses", () => {
  for (const [name, table] of Object.entries(tables)) {
    for (const [key, text] of Object.entries(table)) {
      for (const lang of LANGS) {
        const s = text[lang] ?? "";
        assert(!s.includes(EMDASH), `${name}:${key}:${lang} has an emdash`);
        if (name === "script") {
          assert(!/[()（）]/.test(s), `${key}:${lang} has parentheses (TTS)`);
        }
      }
    }
  }
});

Deno.test("t() fills params, falls back, and warns once for unknown ids", () => {
  const warnings: string[] = [];
  setMissingTextHandler((m) => warnings.push(m));
  assertEquals(
    t(id("ui.hud.serial"), "zh", { serial: "0122" }),
    "0122号飞行员",
  );
  assertEquals(t(id("ui.menu.newGame"), "es"), "Nueva partida");
  assertEquals(t(lineId("no_such_line"), "en"), "[no_such_line]");
  t(lineId("no_such_line"), "es");
  assertEquals(warnings.length, 1);
  setMissingTextHandler((m) => console.warn(m));
});

Deno.test("every speaker has a subtitle name; scriptLine fills the contract shape", () => {
  for (const key of Object.keys(SCRIPT_LINES)) {
    for (const lang of LANGS) {
      assert(speakerName(lineId(key), lang), `${key} speaker`);
    }
  }
  const line = scriptLine(id("tut_wink_001"));
  assertEquals(line?.speaker, "tutorial_ai");
  assertEquals(scriptLine(id("ui.menu.quit")), undefined);
});

// Needs file access; run with: deno test --allow-read tests/i18n_text_test.ts
const canRead =
  Deno.permissions.querySync({ name: "read" }).state === "granted";

Deno.test({
  name: "script.gen.ts is in sync with vo/script.yaml",
  ignore: !canRead,
  async fn() {
    const gen = await import("../src/i18n/gen_script.ts");
    const fresh = gen.renderScriptModule(
      await Deno.readTextFile(gen.SCRIPT_YAML_PATH),
    );
    const onDisk = await Deno.readTextFile(gen.SCRIPT_GEN_PATH);
    assert(
      fresh === onDisk,
      "stale: run deno run --allow-read --allow-write src/i18n/gen_script.ts",
    );
  },
});

Deno.test("placeholders match across languages", () => {
  const names = (s: string) =>
    [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
  const bad: string[] = [];
  for (const [name, table] of Object.entries(tables)) {
    for (const [key, text] of Object.entries(table)) {
      const en = names(text.en).join(",");
      for (const lang of LANGS) {
        const got = names(text[lang] ?? "").join(",");
        if (got !== en) bad.push(`${name}:${key}:${lang} {${got}} vs {${en}}`);
      }
    }
  }
  assertEquals(bad, []);
});

Deno.test({
  name: "every ui.* id the front end names exists in the UI table",
  ignore: !canRead,
  async fn() {
    const files: string[] = [];
    const walk = async (dir: string) => {
      for await (const e of Deno.readDir(dir)) {
        const path = `${dir}/${e.name}`;
        if (e.isDirectory) await walk(path);
        else if (path.endsWith(".ts")) files.push(path);
      }
    };
    await walk(new URL("../src/ui", import.meta.url).pathname);
    const keys = Object.keys(UI_STRINGS);
    const missing: string[] = [];
    for (const file of files) {
      const src = await Deno.readTextFile(file);
      // Literal ids: "ui.menu.quit".
      for (const [, key] of src.matchAll(/["'`](ui\.[\w.]+)["'`]/g)) {
        if (!(key in UI_STRINGS)) missing.push(`${file}: ${key}`);
      }
      // Composed ids: `ui.settings.tab.${tab}` needs at least one entry.
      for (const [, prefix] of src.matchAll(/`(ui\.[\w.]+\.)\$\{/g)) {
        if (!keys.some((k) => k.startsWith(prefix))) {
          missing.push(`${file}: ${prefix}*`);
        }
      }
    }
    assertEquals(missing, []);
    for (const lang of LANGS) assert(`ui.lang.${lang}` in UI_STRINGS, lang);
  },
});
