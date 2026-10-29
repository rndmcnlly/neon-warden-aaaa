/**
 * Graphics quality tiers. The settings menu speaks in presets (low to ultra,
 * or custom); the renderer needs concrete knobs. This table is the one place
 * where a preset becomes numbers, which also makes it the place to look when
 * a student asks "what does High actually change?"
 */

import type { DisplayPreset } from "../contracts/index.ts";

export interface QualityTier {
  /** Pixel ratio cap before the player's render scale is applied. */
  readonly maxPixelRatio: number;
  readonly bloom: boolean;
  /** UnrealBloom strength; higher tiers glow more, like a premium monitor ad. */
  readonly bloomStrength: number;
  readonly chromaticAberration: number;
  readonly grain: number;
  /**
   * Afterimage trails (cheap full-frame motion blur). 0 disables the pass.
   * Kept low: full-frame trails smear bullets, and bullets must stay legible.
   */
  readonly trails: number;
  readonly starCount: number;
  readonly maxParticles: number;
  readonly antialias: boolean;
  readonly shadows: boolean;
  /**
   * The post chain runs every frame. False (School) renders straight to the
   * canvas unless a flash or hit needs the finish pass (`post.ts`): on a
   * Celeron each full-screen pass costs a render target write and read.
   */
  readonly post: boolean;
  /**
   * A pixel budget for the drawing buffer (width times height, device px),
   * applied after `maxPixelRatio`. A ratio cap alone is wrong for phones: a
   * 393 px wide screen at DPR 1 is a smear, while the same budget a 1366 by
   * 768 Chromebook gets at DPR 0.85 lets a phone keep DPR 1.5.
   */
  readonly maxPixels?: number;
}

export const QUALITY_TIERS: Readonly<
  Record<Exclude<DisplayPreset, "custom">, QualityTier>
> = Object.freeze({
  /**
   * Managed school Chromebooks and phones (research/2026-10-28-chromebook-
   * kids, "Proposed School tier"). Diff it against Low: fewer stars and
   * particles, no composer. Bullets are untouched: atmosphere goes first,
   * gameplay information never.
   */
  school: {
    maxPixelRatio: 2,
    // About 1090 by 730: the research's 1024 by 576 target plus headroom.
    maxPixels: 800_000,
    bloom: false,
    bloomStrength: 0,
    chromaticAberration: 0,
    grain: 0,
    trails: 0,
    starCount: 250,
    maxParticles: 192,
    antialias: false,
    shadows: false,
    post: false,
  },
  low: {
    maxPixelRatio: 1,
    bloom: false,
    bloomStrength: 0,
    chromaticAberration: 0,
    grain: 0,
    trails: 0,
    starCount: 600,
    maxParticles: 512,
    antialias: false,
    shadows: false,
    post: true,
  },
  medium: {
    maxPixelRatio: 1.5,
    bloom: true,
    bloomStrength: 0.35,
    chromaticAberration: 0.0003,
    grain: 0.03,
    trails: 0,
    starCount: 1500,
    maxParticles: 1024,
    antialias: true,
    shadows: false,
    post: true,
  },
  high: {
    maxPixelRatio: 1.5,
    bloom: true,
    bloomStrength: 0.45,
    chromaticAberration: 0.0005,
    grain: 0.04,
    trails: 0,
    starCount: 3000,
    maxParticles: 2048,
    antialias: true,
    shadows: false,
    post: true,
  },
  ultra: {
    maxPixelRatio: 2,
    bloom: true,
    bloomStrength: 0.55,
    chromaticAberration: 0.0007,
    grain: 0.05,
    trails: 0.3,
    starCount: 6000,
    maxParticles: 4096,
    antialias: true,
    shadows: true,
    post: true,
  },
});

/** `custom` means "the player tweaked something"; it renders as High. */
export function tierFor(preset: DisplayPreset): QualityTier {
  return preset === "custom" ? QUALITY_TIERS.high : QUALITY_TIERS[preset];
}
