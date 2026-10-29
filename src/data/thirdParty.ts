/**
 * Third-party software, fonts and generative models in this build: the data
 * behind Extras > Third-Party Licenses. One entry per thing we ship or used
 * to make what we ship, so the screen (and any audit) reads from one list.
 *
 * Names, versions and license names are proper nouns and stay untranslated;
 * the explanatory `note` is a UI string id resolved through `src/i18n/`
 * (the strings pass adds the ids and the screen iterates this list).
 *
 * Phaser is deliberately absent: the original E4 starter used it, but this
 * rewrite does not ship or import it (`reference/` is read-only design
 * reference, not part of the build).
 */

export type ThirdPartyRole = "runtime" | "toolchain" | "font" | "model";

export interface ThirdPartyEntry {
  readonly name: string;
  readonly version?: string;
  readonly role: ThirdPartyRole;
  /** SPDX identifier where one exists. */
  readonly license: string;
  readonly url: string;
  /** UI string id explaining how it is used (or what its outputs are). */
  readonly note: string;
}

export const THIRD_PARTY: readonly ThirdPartyEntry[] = [
  {
    name: "three.js",
    version: "0.186.1",
    role: "runtime",
    license: "MIT",
    url: "https://github.com/mrdoob/three.js/blob/dev/LICENSE",
    note: "ui.licenses.note.three",
  },
  {
    name: "Orbitron",
    role: "font",
    license: "OFL-1.1",
    url: "https://fonts.google.com/specimen/Orbitron/license",
    note: "ui.licenses.note.orbitron",
  },
  {
    name: "Vite",
    version: "8.3.1",
    role: "toolchain",
    license: "MIT",
    url: "https://github.com/vitejs/vite/blob/main/LICENSE",
    note: "ui.licenses.note.vite",
  },
  {
    name: "Deno",
    role: "toolchain",
    license: "MIT",
    url: "https://github.com/denoland/deno/blob/main/LICENSE.md",
    note: "ui.licenses.note.deno",
  },
  {
    // Music cues and UI sound effects are this model's outputs.
    name: "Stable Audio 3 (Stability AI)",
    role: "model",
    license: "Stability AI Community License",
    url: "https://stability.ai/license",
    note: "ui.licenses.note.stableAudio",
  },
  {
    // Every voice line is rendered locally with this model.
    name: "Qwen3-TTS (Alibaba Qwen)",
    role: "model",
    license: "Apache-2.0",
    url: "https://huggingface.co/Qwen",
    note: "ui.licenses.note.qwenTts",
  },
  {
    // Used only to check renders against the script (ASR round trip).
    name: "Qwen3-ASR (Alibaba Qwen)",
    role: "model",
    license: "Apache-2.0",
    url: "https://huggingface.co/Qwen",
    note: "ui.licenses.note.qwenAsr",
  },
];

/**
 * English fallbacks for the note ids, for the strings pass to absorb into
 * `src/i18n/` (with ES and ZH) and then delete from here.
 */
export const THIRD_PARTY_NOTES_EN: Readonly<Record<string, string>> = {
  "ui.licenses.note.three": "3D rendering.",
  "ui.licenses.note.orbitron": "Logo lettering, baked into the 3D logos.",
  "ui.licenses.note.vite": "Build tool; not shipped.",
  "ui.licenses.note.deno": "Runtime for tasks and tests; not shipped.",
  "ui.licenses.note.stableAudio":
    "Generated the music and sound effects. Outputs are used under the model license.",
  "ui.licenses.note.qwenTts": "Rendered every voice line locally.",
  "ui.licenses.note.qwenAsr":
    "Checked rendered voice lines against the script; not shipped.",
};
