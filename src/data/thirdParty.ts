/**
 * Third-party software, fonts and generative models in this build: the data
 * behind Extras > Third-Party Licenses. One entry per thing we ship or used
 * to make what we ship, so the screen (and any audit) reads from one list.
 *
 * Names, versions and license names are proper nouns and stay untranslated;
 * the explanatory `note` is a UI string id resolved through `src/i18n/`.
 * Extras > Third-Party Licenses and the end credits both iterate this list.
 *
 * Phaser is deliberately absent: the original E4 starter used it, but this
 * rewrite does not ship or import it (`reference/` is read-only design
 * reference, not part of the build).
 */

import type { UiKey } from "../i18n/index.ts";

export type ThirdPartyRole = "runtime" | "toolchain" | "font" | "model";

export interface ThirdPartyEntry {
  readonly name: string;
  readonly version?: string;
  readonly role: ThirdPartyRole;
  /** SPDX identifier where one exists. */
  readonly license: string;
  readonly url: string;
  /** UI string id explaining how it is used (or what its outputs are). */
  readonly note: UiKey;
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
    // The gameplay feel layer (impacts, weapons, whooshes) in public/sfx/:
    // paid cloud generations through fal, commercial use of outputs granted
    // by the paid terms. No seed, so these files cannot be regenerated.
    name: "ElevenLabs Sound Effects v2 (via fal)",
    role: "model",
    license: "ElevenLabs paid-plan terms (commercial use of outputs)",
    url: "https://elevenlabs.io/terms-of-use",
    note: "ui.licenses.note.elevenLabs",
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
