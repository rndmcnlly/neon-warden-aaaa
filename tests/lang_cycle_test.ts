/**
 * Live language cycling (`src/input/langCycle.ts`), per Adam's spec: `[` `]`
 * and the shoulders step EN, ES, ZH; each press overwrites BOTH languages
 * and persists; key repeats, typing, capture and bound keys never cycle;
 * and the line already playing finishes as it began, the next one switches.
 */

import { assert, assertEquals } from "@std/assert";
import {
  lineId,
  type Settings,
  type Timeline,
} from "../src/contracts/index.ts";
import { makeRig } from "../src/director/fakes.ts";
import type { MenuIntent } from "../src/input/inputLayer.ts";
import {
  cycleLang,
  langCycleButtonStep,
  langCycleKeyStep,
  withCycledLang,
} from "../src/input/langCycle.ts";
import { DEFAULT_SETTINGS } from "../src/settings/defaults.ts";
import { createSettingsStore, SETTINGS_KEY } from "../src/settings/store.ts";
import { decideMenuIntent } from "../src/ui/dispatch.ts";

const key = (code: string, extra: Partial<KeyboardEvent> = {}) => ({
  code,
  repeat: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...extra,
});

Deno.test("cycle order: ] goes EN, ES, ZH, EN; [ goes back", () => {
  assertEquals(cycleLang("en", 1), "es");
  assertEquals(cycleLang("es", 1), "zh");
  assertEquals(cycleLang("zh", 1), "en");
  assertEquals(cycleLang("en", -1), "zh");
  assertEquals(cycleLang("zh", -1), "es");
  assertEquals(cycleLang("es", -1), "en");
});

Deno.test("a press clobbers both languages, from the text language", () => {
  const split: Settings = {
    ...DEFAULT_SETTINGS,
    textLang: "en",
    voiceLang: "zh",
  };
  const next = withCycledLang(split, 1);
  assertEquals([next.textLang, next.voiceLang], ["es", "es"]);
  // Everything else is untouched.
  assertEquals(next.subtitles, split.subtitles);
  assertEquals(next.controls, split.controls);
});

Deno.test("a press persists like any settings change", () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => void saved.set(k, v),
  };
  const store = createSettingsStore(storage);
  let heard = 0;
  store.subscribe(() => heard++);
  store.update((c) => withCycledLang(c, -1));
  const persisted = JSON.parse(saved.get(SETTINGS_KEY)!).settings;
  assertEquals([persisted.textLang, persisted.voiceLang], ["zh", "zh"]);
  assertEquals(heard, 1, "listeners (HUD, audio) hear it once");
});

Deno.test("keys: [ and ] step; repeat, typing, capture, bound, mods do not", () => {
  assertEquals(langCycleKeyStep(key("BracketLeft"), false, false, false), -1);
  assertEquals(langCycleKeyStep(key("BracketRight"), false, false, false), 1);
  const right = key("BracketRight");
  assertEquals(
    langCycleKeyStep({ ...right, repeat: true }, false, false, false),
    null,
    "holding ] must not spin through languages",
  );
  assertEquals(langCycleKeyStep(right, true, false, false), null, "typing");
  assertEquals(langCycleKeyStep(right, false, true, false), null, "capture");
  assertEquals(langCycleKeyStep(right, false, false, true), null, "bound");
  for (const mod of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const) {
    assertEquals(
      langCycleKeyStep({ ...right, [mod]: true }, false, false, false),
      null,
      mod,
    );
  }
  assertEquals(langCycleKeyStep(key("KeyE"), false, false, false), null);
});

Deno.test("shoulders step unless the player bound them to an action", () => {
  assertEquals(langCycleButtonStep(4, false), -1);
  assertEquals(langCycleButtonStep(5, false), 1);
  assertEquals(langCycleButtonStep(5, true), null);
  assertEquals(langCycleButtonStep(0, false), null);
  // Default bindings leave the shoulders free in play.
  for (const binding of Object.values(DEFAULT_SETTINGS.controls.bindings)) {
    assert(!binding.buttons.includes(4) && !binding.buttons.includes(5));
    assert(!binding.keys.includes("BracketLeft"));
    assert(!binding.keys.includes("BracketRight"));
  }
});

Deno.test("dispatch: cycles only in play; menus keep shoulders for tabs", () => {
  // What a shoulder press emits: the tab intent plus the language intent.
  const shoulder = new Set<MenuIntent>(["tabNext", "langNext"]);
  const play = {
    inMenu: false,
    playing: true,
    inTutorial: true,
    focusInTop: false,
  };
  assertEquals(decideMenuIntent(shoulder, play), {
    kind: "cycleLang",
    step: 1,
  });
  assertEquals(decideMenuIntent(new Set(["langPrev"]), play), {
    kind: "cycleLang",
    step: -1,
  });
  assertEquals(
    decideMenuIntent(shoulder, { ...play, inMenu: true, focusInTop: true })
      .kind,
    "ignore",
    "under a menu the screen's own tab handling decides",
  );
  assertEquals(
    decideMenuIntent(shoulder, { ...play, playing: false }).kind,
    "ignore",
  );
});

Deno.test("next line: the playing line finishes as is, the next switches", () => {
  const A = lineId("line_a");
  const B = lineId("line_b");
  const scene: Timeline = {
    id: "t",
    cues: [
      { type: "say", line: A },
      { type: "wait", until: "lineEnds" },
      { type: "say", line: B },
      { type: "wait", until: "lineEnds" },
    ],
  };
  const rig = makeRig({ line_a: 1000, line_b: 1000 });
  rig.director.play(scene);
  const shown: string[] = [];
  rig.director.subtitles.subscribe((v) => v && shown.push(v.text));
  rig.advance(300);
  // The press mid-line: the Director reads settings, so swap them here.
  rig.settings = { ...rig.settings, textLang: "es", voiceLang: "es" };
  rig.advance(400);
  assertEquals(rig.log, ["say scripted line_a en @0"], "no restart, no cut");
  assert(
    shown.every((t) => t.startsWith("en:")),
    `line A keeps its English subtitle: ${shown}`,
  );
  rig.advance(400);
  assertEquals(rig.log.at(-1)?.startsWith("say scripted line_b es"), true);
  assertEquals(shown.at(-1), "es:line_b");
});
