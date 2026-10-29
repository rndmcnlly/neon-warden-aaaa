import { assert, assertEquals } from "@std/assert";
import { ALL_BANKS, allVariants } from "../src/scenes/banks/index.ts";
import { spliceBankYaml } from "../src/scenes/banks/emit_yaml.ts";
import { SCRIPT_LINES } from "../src/i18n/script.gen.ts";
import { lineId } from "../src/contracts/index.ts";
import { hasText, t } from "../src/i18n/index.ts";

const script: Readonly<
  Record<string, { speaker: string; text: Record<string, string> }>
> = SCRIPT_LINES;

Deno.test("bank and variant ids are unique", () => {
  const banks = ALL_BANKS.map((b) => b.id);
  assertEquals(new Set(banks).size, banks.length);
  const ids = allVariants().map((v) => v.id);
  assertEquals(new Set(ids).size, ids.length);
});

Deno.test("voiced variants are script lines with the same text and speaker", () => {
  for (const v of allVariants().filter((v) => v.vo)) {
    const line = script[v.id];
    assert(line, `${v.id}: voiced but not in vo/script.yaml`);
    assertEquals(line.speaker, v.bank.speaker, v.id);
    for (const lang of ["en", "es", "zh"] as const) {
      assertEquals(line.text[lang], v[lang], `${v.id} ${lang}`);
    }
  }
});

Deno.test("text-only variants use bank ids and resolve through t()", () => {
  for (const v of allVariants().filter((v) => !v.vo)) {
    assert(v.id.startsWith(`bank.${v.bank.id}.`), v.id);
    assert(hasText(v.id), v.id);
    assertEquals(t(lineId(v.id), "es"), v.es);
  }
});

Deno.test("every variant has all three languages and house style", () => {
  for (const v of allVariants()) {
    for (const lang of ["en", "es", "zh"] as const) {
      assert(v[lang].trim().length > 0, `${v.id} ${lang} empty`);
      assert(!v[lang].includes("—"), `${v.id} ${lang} has an emdash`);
    }
  }
});

Deno.test("pools are deep enough not to repeat", () => {
  for (const bank of ALL_BANKS) {
    assert(
      bank.variants.length >= 4,
      `${bank.id}: only ${bank.variants.length}`,
    );
  }
  const shipFine = ALL_BANKS.find((b) => b.id === "shipFine")!;
  assert(shipFine.variants.length >= 12);
});

Deno.test("vo/script.yaml mirrors the voiced variants", async () => {
  const yaml = await Deno.readTextFile("vo/script.yaml");
  assertEquals(
    spliceBankYaml(yaml),
    yaml,
    "stale; run deno run --allow-read --allow-write src/scenes/banks/emit_yaml.ts",
  );
});
