/**
 * Every player-adjustable option, in one typed shape. Menus write it; audio,
 * renderer, subtitles, input and the game loop read it, always through the
 * `SettingsStore` (never through `localStorage` directly), so a change in the
 * menu reaches every listener the same frame.
 */

import type { Difficulty } from "./sim.ts";
import type { Lang } from "./text.ts";

/**
 * Graphics quality presets; `custom` once any individual option is changed.
 * `school` sits below `low` for managed school Chromebooks and phones: no
 * post-processing at all (research/2026-10-28-chromebook-kids).
 */
export type DisplayPreset =
  | "school"
  | "low"
  | "medium"
  | "high"
  | "ultra"
  | "custom";

/**
 * Touch control schemes (research/2026-10-28-mobile-touch, section 2). All
 * produce the same `InputFrame`; none requires two fingers at once.
 *
 * - `thumbs`: drag to fly, a FIRE button for tap, hold and Writ release.
 * - `oneFinger`: drag to fly; tap FIRE for one shot (or the Writ), long-press
 *   FIRE to latch the stream on, tap again to stop. Never two touches.
 * - `arcade`: the flying finger is the trigger; lift it to rest and charge.
 */
export type TouchScheme = "thumbs" | "oneFinger" | "arcade";

/**
 * Writ aim assist: widens how far off a weapon part or weak point a locked
 * Writ may land and still pick it. `touch` turns it on for runs started from
 * a touchscreen. A sim option, fixed per run, so runs stay deterministic.
 */
export type AimAssist = "touch" | "on" | "off";

/** Bindable actions. Movement is four actions so each direction can be remapped. */
export type Action =
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "fire"
  | "focus"
  | "pause"
  | "confirm"
  | "back";

export interface Binding {
  /** `KeyboardEvent.code` values, layout-independent (e.g. `KeyZ`). */
  readonly keys: readonly string[];
  /** Standard Gamepad API button indices. */
  readonly buttons: readonly number[];
}

export interface Settings {
  readonly display: {
    readonly preset: DisplayPreset;
    /** Internal resolution multiplier, 0.5–2. */
    readonly renderScale: number;
    readonly fullscreen: boolean;
    /**
     * On a touch-primary phone or tablet, the first menu tap enters
     * fullscreen (src/platform/autoFullscreen.ts). Never in an installed app.
     */
    readonly autoFullscreen: boolean;
    /**
     * The game picked the preset from a device probe (src/render/autoTier.ts).
     * Any manual preset or scale change turns this off, so the probe never
     * overrides a player's choice; Settings offers "Detect again".
     */
    readonly autoTier: boolean;
  };
  /** Bus gains, each 0–1. Final gain is `master * bus`. */
  readonly audio: {
    readonly master: number;
    readonly music: number;
    readonly sfx: number;
    readonly voice: number;
    readonly ui: number;
    /**
     * Fold the mix to one channel (spatial panning off), for players who
     * hear with one ear or play on one speaker.
     */
    readonly mono: boolean;
  };
  readonly textLang: Lang;
  readonly voiceLang: Lang;
  readonly subtitles: {
    readonly enabled: boolean;
    /** Text size multiplier, 1–2 (100–200%). */
    readonly scale: number;
    /** Opacity of the box behind subtitle text, 0–1. */
    readonly bgOpacity: number;
    readonly speakerNames: boolean;
    /** At most two lines on screen at once, per subtitle guidelines. */
    readonly maxLines: 1 | 2;
  };
  readonly accessibility: {
    readonly autoFire: boolean;
    /** Whether fire and focus are held down or toggled on and off. */
    readonly holdToggle: "hold" | "toggle";
    /** Camera and cabinet shake intensity, 0–1. */
    readonly shake: number;
    readonly reducedFlashing: boolean;
    /**
     * Calmer camera and menu motion (no shot drift, no parallax swoops).
     * The OS `prefers-reduced-motion` answer also counts, either one is
     * enough.
     */
    readonly reduceMotion: boolean;
    /** Sim ticks per frame multiplier for human play, 0.5–1. */
    readonly gameSpeed: number;
    readonly difficulty: Difficulty;
    /** Pair every color-coded cue with a shape or pattern. */
    readonly colorIndependentCues: boolean;
    readonly aimAssist: AimAssist;
  };
  readonly controls: {
    readonly bindings: Readonly<Record<Action, Binding>>;
    readonly touchScheme: TouchScheme;
    /** Drag gain multiplier, 0.5–2. */
    readonly touchSensitivity: number;
    /** Which thumb owns the FIRE button (mirror for left-handed players). */
    readonly fireSide: "left" | "right";
  };
}

export type SettingsListener = (settings: Settings) => void;

export interface SettingsStore {
  get(): Settings;
  /** Replaces settings with `recipe(current)`, persists, then notifies. */
  update(recipe: (current: Settings) => Settings): void;
  /** Restores defaults, persists, then notifies. */
  reset(): void;
  /** Calls `listener` on every change. Returns an unsubscribe function. */
  subscribe(listener: SettingsListener): () => void;
}
