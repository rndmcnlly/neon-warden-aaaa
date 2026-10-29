/**
 * Every player-adjustable option, in one typed shape. Menus write it; audio,
 * renderer, subtitles, input and the game loop read it, always through the
 * `SettingsStore` (never through `localStorage` directly), so a change in the
 * menu reaches every listener the same frame.
 */

import type { Difficulty } from "./sim.ts";
import type { Lang } from "./text.ts";

/** Graphics quality presets; `custom` once any individual option is changed. */
export type DisplayPreset = "low" | "medium" | "high" | "ultra" | "custom";

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
  };
  /** Bus gains, each 0–1. Final gain is `master * bus`. */
  readonly audio: {
    readonly master: number;
    readonly music: number;
    readonly sfx: number;
    readonly voice: number;
    readonly ui: number;
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
  };
  readonly controls: {
    readonly bindings: Readonly<Record<Action, Binding>>;
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
