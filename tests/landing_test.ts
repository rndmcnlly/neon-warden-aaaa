import { assert, assertEquals } from "@std/assert";
import { LANGS, pickLang, STRINGS } from "../src/landing/strings.ts";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

Deno.test("landing page inline English matches the strings table", async () => {
  const html = await Deno.readTextFile("index.html");
  const tagged = [...html.matchAll(/data-t="([^"]+)"[^>]*>([^<]*)</g)];
  assert(tagged.length > 30, "expected the landing page's tagged text");
  for (const [, key, text] of tagged) {
    assert(key in STRINGS, `unknown key ${key}`);
    assertEquals(
      squash(text),
      STRINGS[key as keyof typeof STRINGS].en,
      `index.html text for ${key}`,
    );
  }
});

Deno.test("landing strings are complete in every language", () => {
  for (const [key, entry] of Object.entries(STRINGS)) {
    for (const lang of LANGS) {
      // The English-only notice is empty in English by design.
      if (key === "made.enOnly" && lang === "en") continue;
      assert(entry[lang].length > 0, `${key}.${lang} is empty`);
      assert(!/—/.test(entry[lang]), `${key}.${lang} has an em dash`);
    }
  }
});

Deno.test("landing language: query, then tab choice, then browser list", () => {
  assertEquals(pickLang("?lang=zh", "es", ["en-US"]), "zh");
  assertEquals(pickLang("?lang=fr", "es", ["en-US"]), "es");
  assertEquals(pickLang("", null, ["fr-FR", "es-MX"]), "es");
  assertEquals(pickLang("", "xx", ["zh-Hans-CN"]), "zh");
  assertEquals(pickLang("", null, ["fr"]), "en");
});
