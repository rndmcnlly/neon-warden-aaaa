/**
 * Asset budgets and the contracts the asset report checks against. Data, so a
 * budget change is a reviewable one-line diff.
 *
 * Budgets assume the slice runs on a 2020-era integrated GPU at 1080p with
 * tens of enemies on screen: small things stay small, the Warden and the
 * logos can spend more because there is one of each.
 */

export interface ModelBudget {
  readonly triangles: number;
  readonly bytes: number;
}

export const DEFAULT_MODEL_BUDGET: ModelBudget = {
  triangles: 4_000,
  bytes: 256_000,
};

export const MODEL_BUDGETS: Readonly<Record<string, ModelBudget>> = {
  warden: { triangles: 30_000, bytes: 1_500_000 },
  pilot_figure: { triangles: 20_000, bytes: 1_000_000 },
  logo_adamsmith_systems: { triangles: 40_000, bytes: 1_500_000 },
  logo_cm121: { triangles: 40_000, bytes: 1_500_000 },
  pickup_spread: { triangles: 1_500, bytes: 96_000 },
  pickup_shield: { triangles: 1_500, bytes: 96_000 },
};

/** Over this fraction of budget a model is a warning, over 1.0 a failure. */
export const BUDGET_WARN = 0.8;

/**
 * Nodes the renderer animates by name (`findPart` in src/render/stage.ts),
 * and which model must carry each. Source: the asset convention comment in
 * src/render/models.ts. The asset report also scans `findPart(..., "x")`
 * calls and flags any name missing here, so this table cannot silently rot.
 */
export const ANIMATED_NODES: Readonly<Record<string, readonly string[]>> = {
  engine: ["pilot_ship"],
  thruster: ["dart"],
  crown: ["turret"],
  halo: ["warden"],
  core: ["warden"],
  armor: ["warden"],
};

/**
 * Third-party sources the licenses or credits screen must name. `match` is
 * tested against the English text of every `ui.licenses.*` and `ui.credits.*`
 * string; `evidence` is a path whose existence proves we ship or used it.
 */
export interface ThirdParty {
  readonly name: string;
  readonly evidence: string;
  readonly match: RegExp;
}

export const THIRD_PARTY: readonly ThirdParty[] = [
  { name: "three.js", evidence: "deno.json", match: /three\.js/i },
  { name: "Vite", evidence: "vite.config.ts", match: /\bvite\b/i },
  { name: "Deno", evidence: "deno.json", match: /\bdeno\b/i },
  {
    name: "Orbitron font (OFL)",
    evidence: "art/blender/fonts/OFL.txt",
    match: /orbitron/i,
  },
  {
    name: "Stable Audio 3 (SFX, music)",
    evidence: "sfx/render.py",
    match: /stable audio/i,
  },
  {
    name: "Qwen3-TTS (voices)",
    evidence: "vo/render.py",
    match: /qwen3?[- ]?tts|qwen/i,
  },
  {
    name: "Blender (models)",
    evidence: "art/blender/build_all.py",
    match: /blender/i,
  },
];
