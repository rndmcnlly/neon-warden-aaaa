/**
 * Keeps settings inside their documented ranges. Saved data can be stale,
 * hand-edited, or written by an older build, so every load and every update
 * passes through `sanitizeSettings`: a bad value falls back to its default
 * instead of reaching the renderer or the audio graph.
 */

import {
  type Action,
  type Binding,
  type DisplayPreset,
  type Lang,
  LANGS,
  type Settings,
} from "../contracts/index.ts";
import { DEFAULT_SETTINGS } from "./defaults.ts";

export const RENDER_SCALE_RANGE = { min: 0.5, max: 2 } as const;
export const SUBTITLE_SCALE_RANGE = { min: 1, max: 2 } as const;
export const GAME_SPEED_RANGE = { min: 0.5, max: 1 } as const;

/** Render scale each preset implies; picking a preset applies it. */
export const PRESET_RENDER_SCALE: Readonly<
  Record<Exclude<DisplayPreset, "custom">, number>
> = { low: 0.5, medium: 0.75, high: 1, ultra: 1.5 };

export function applyPreset(
  settings: Settings,
  preset: DisplayPreset,
): Settings {
  const renderScale = preset === "custom"
    ? settings.display.renderScale
    : PRESET_RENDER_SCALE[preset];
  return { ...settings, display: { ...settings.display, preset, renderScale } };
}

/**
 * Changing an individual option moves the preset to "custom", unless the new
 * value happens to be exactly what a preset would pick. Presets only set the
 * render scale today; when the renderer adds more options, compare those too.
 */
export function setRenderScale(settings: Settings, scale: number): Settings {
  const renderScale = clamp(
    Math.round(scale * 100) / 100,
    RENDER_SCALE_RANGE.min,
    RENDER_SCALE_RANGE.max,
  );
  const entries = Object.entries(PRESET_RENDER_SCALE) as [
    DisplayPreset,
    number,
  ][];
  const preset = entries.find(([, value]) => value === renderScale)?.[0] ??
    "custom";
  return { ...settings, display: { ...settings.display, renderScale, preset } };
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function oneOf<T extends string | number>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return options.includes(value as T) ? value as T : fallback;
}

function unit(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, 0, 1)
    : fallback;
}

function ranged(
  value: unknown,
  range: { min: number; max: number },
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, range.min, range.max)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeBinding(value: Binding, fallback: Binding): Binding {
  const keys = Array.isArray(value?.keys)
    ? value.keys.filter((k): k is string => typeof k === "string")
    : fallback.keys;
  const buttons = Array.isArray(value?.buttons)
    ? value.buttons.filter((b): b is number =>
      Number.isInteger(b) && b >= 0 && b < 32
    )
    : fallback.buttons;
  return { keys, buttons };
}

export function sanitizeSettings(s: Settings): Settings {
  const d = DEFAULT_SETTINGS;
  const bindings = {} as Record<Action, Binding>;
  for (const action of Object.keys(d.controls.bindings) as Action[]) {
    bindings[action] = sanitizeBinding(
      s.controls?.bindings?.[action],
      d.controls.bindings[action],
    );
  }
  return {
    display: {
      preset: oneOf<DisplayPreset>(
        s.display?.preset,
        ["low", "medium", "high", "ultra", "custom"],
        d.display.preset,
      ),
      renderScale: ranged(
        s.display?.renderScale,
        RENDER_SCALE_RANGE,
        d.display.renderScale,
      ),
      fullscreen: bool(s.display?.fullscreen, d.display.fullscreen),
    },
    audio: {
      master: unit(s.audio?.master, d.audio.master),
      music: unit(s.audio?.music, d.audio.music),
      sfx: unit(s.audio?.sfx, d.audio.sfx),
      voice: unit(s.audio?.voice, d.audio.voice),
      ui: unit(s.audio?.ui, d.audio.ui),
    },
    textLang: oneOf<Lang>(s.textLang, LANGS, d.textLang),
    voiceLang: oneOf<Lang>(s.voiceLang, LANGS, d.voiceLang),
    subtitles: {
      enabled: bool(s.subtitles?.enabled, d.subtitles.enabled),
      scale: ranged(
        s.subtitles?.scale,
        SUBTITLE_SCALE_RANGE,
        d.subtitles.scale,
      ),
      bgOpacity: unit(s.subtitles?.bgOpacity, d.subtitles.bgOpacity),
      speakerNames: bool(s.subtitles?.speakerNames, d.subtitles.speakerNames),
      maxLines: oneOf<1 | 2>(
        s.subtitles?.maxLines,
        [1, 2],
        d.subtitles.maxLines,
      ),
    },
    accessibility: {
      autoFire: bool(s.accessibility?.autoFire, d.accessibility.autoFire),
      holdToggle: oneOf(
        s.accessibility?.holdToggle,
        ["hold", "toggle"] as const,
        d.accessibility.holdToggle,
      ),
      shake: unit(s.accessibility?.shake, d.accessibility.shake),
      reducedFlashing: bool(
        s.accessibility?.reducedFlashing,
        d.accessibility.reducedFlashing,
      ),
      reduceMotion: bool(
        s.accessibility?.reduceMotion,
        d.accessibility.reduceMotion,
      ),
      gameSpeed: ranged(
        s.accessibility?.gameSpeed,
        GAME_SPEED_RANGE,
        d.accessibility.gameSpeed,
      ),
      difficulty: oneOf(
        s.accessibility?.difficulty,
        ["story", "normal", "hard"] as const,
        d.accessibility.difficulty,
      ),
      colorIndependentCues: bool(
        s.accessibility?.colorIndependentCues,
        d.accessibility.colorIndependentCues,
      ),
    },
    controls: { bindings },
  };
}
