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
}

export const QUALITY_TIERS: Readonly<
  Record<Exclude<DisplayPreset, "custom">, QualityTier>
> = Object.freeze({
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
  },
});

/** `custom` means "the player tweaked something"; it renders as High. */
export function tierFor(preset: DisplayPreset): QualityTier {
  return preset === "custom" ? QUALITY_TIERS.high : QUALITY_TIERS[preset];
}
