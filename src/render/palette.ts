/**
 * The original game's palette, by hue, then the roles and scene looks built
 * on top of it.
 *
 * Hex values in PALETTE come straight from
 * research/2026-10-28-original-reference/README.md so a player who knew the
 * 2D game recognizes every entity by color in 3D.
 *
 * Renderer code should prefer ROLE over PALETTE: roles are the value ladder
 * (research/2026-10-28-critique-visual/, items 1 and 4). Enemy fire is the
 * hottest, most saturated small thing on screen; the player ship is the
 * brightest large thing; player shots sit below enemy fire; enemies are mid
 * values; the world is low-mid and desaturated. The numbers after each color
 * are HDR multipliers: bloom only picks up what ends above the threshold in
 * post.ts, so the ladder doubles as the list of what glows.
 */

export const PALETTE = Object.freeze({
  void: 0x04020c,
  deepViolet: 0x1a0f3a,
  panel: 0x0e0a22,
  iceWhite: 0xe8fdff,
  cyan: 0x5ef2ff,
  paleCyan: 0xc8fbff,
  pink: 0xff5ea8,
  enemyShot: 0xff7bd5,
  amber: 0xffb84d,
  violet: 0x9d7bff,
  mint: 0x7dff9b,
  crimson: 0xff4d6d,
  gold: 0xffe066,
  heavyGold: 0xffd24d,
  sparkCream: 0xffe8b0,
  slate: 0x6f86a8,
  gunmetal: 0x1c2030,
});

/** Bloom threshold in post.ts; HDR values above it glow, below it stay crisp. */
export const BLOOM_THRESHOLD = 1.5;

/** A color and the HDR gain it is drawn at. */
export interface RoleColor {
  readonly hex: number;
  readonly gain: number;
}

/** The value ladder, brightest first. */
export const ROLE = Object.freeze(
  {
    /** Enemy bullet ring: the hottest small thing. Over the bloom threshold. */
    dangerRim: { hex: PALETTE.enemyShot, gain: 3.6 },
    /** Enemy bullet center: dark and saturated, so a ring reads after bloom. */
    dangerCore: { hex: 0x3a0626, gain: 1 },
    /** Heavy rounds keep the original gold, same ring language. */
    heavyRim: { hex: PALETTE.heavyGold, gain: 2.25 },
    heavyCore: { hex: 0x3a2600, gain: 1 },
    /** The player's engine plume: the eye finds the ship first. */
    playerEngine: { hex: PALETTE.cyan, gain: 2.6 },
    /** Player shots: thin, cyan, under the threshold, half opacity. */
    playerShot: { hex: PALETTE.cyan, gain: 1.15 },
    /** Ship rim and trim: bright, but not blooming. */
    playerTrim: { hex: PALETTE.cyan, gain: 1.2 },
    /** Lock reticles and intel: the scan language is its own accent. */
    scan: { hex: 0x9ffcff, gain: 1.3 },
    /** Writ charge glow, by level 1–3; level 3 blooms. */
    writ: { hex: 0xfff2c4, gain: 2.4 },
    /** Graze sparks: bright, tiny, short. */
    graze: { hex: PALETTE.iceWhite, gain: 2.2 },
    /** Enemy hull emissive trims: mid, never over the threshold. */
    enemyTrim: { hex: PALETTE.slate, gain: 1.1 },
    /** The floor grid and rails: world value. */
    world: { hex: PALETTE.slate, gain: 0.5 },
  } satisfies Record<string, RoleColor>,
);

/**
 * A per-scene color budget: two world hues plus one accent. Danger is fixed
 * across scenes (pink rings), so the player learns it once; each look picks
 * a world that is not pink, which keeps danger the complement of the set.
 */
export interface SceneLook {
  /** Floor base, nebula main hue. */
  readonly worldA: number;
  /** Floor grid lines, rails, nebula secondary hue. */
  readonly worldB: number;
  /** Pylon bands and set dressing accent. */
  readonly accent: number;
  /** Floor base brightness (display-ish, 0–1): the midtone band. */
  readonly floor: number;
  /** Nebula value cap (critique item 10). */
  readonly nebulaCap: number;
}

export type SceneLookId = "sector" | "boss" | "flashback" | "ending" | "hangar";

export const SCENE_LOOKS: Readonly<Record<SceneLookId, SceneLook>> = Object
  .freeze({
    // Sector: cool teal and violet, gold accent; pink danger pops against it.
    sector: {
      worldA: 0x1a3242,
      worldB: 0x4a5fb0,
      accent: PALETTE.gold,
      floor: 1,
      nebulaCap: 0.35,
    },
    // Boss: a warm, low-saturation rust set, Warden red as accent. Danger
    // stays pink-magenta, cooler than the set (the Returnal inversion).
    boss: {
      worldA: 0x3d2420,
      worldB: 0x8a4a34,
      accent: PALETTE.crimson,
      floor: 1,
      nebulaCap: 0.3,
    },
    // Flashback: the flight recorder, desaturated amber.
    flashback: {
      worldA: 0x3a3020,
      worldB: 0x8a7240,
      accent: PALETTE.amber,
      floor: 0.8,
      nebulaCap: 0.25,
    },
    // Ending: cold slate, almost no accent.
    ending: {
      worldA: 0x1c2430,
      worldB: 0x48566e,
      accent: PALETTE.slate,
      floor: 0.7,
      nebulaCap: 0.2,
    },
    // Hangar: neutral steel with a cyan accent, so paint choices read true.
    hangar: {
      worldA: 0x22262e,
      worldB: 0x55606e,
      accent: PALETTE.cyan,
      floor: 1.2,
      nebulaCap: 0.15,
    },
  });
