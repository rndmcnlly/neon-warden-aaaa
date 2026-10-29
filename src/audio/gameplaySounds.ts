/**
 * Every gameplay sound, as data: which layer it is on, where its audio
 * comes from, how loud, how many may overlap, and what it does to the mix.
 * Tune the game's sound here; `sfxPlayer.ts` only follows this table.
 *
 * Two layers (research/2026-10-28-critique-audio/, "direction statement"):
 *
 * - `feel`: plays the instant it happens, because a shmup input must never
 *   wait. Rendered samples (ElevenLabs SFX v2 via `sfx/render.py`, promoted
 *   into `public/sfx/gameplay.json`), with a synth stand-in until a sample
 *   is picked, so the game is never silent.
 * - `musical`: synthesized notes in the current cue's key, snapped to its
 *   grid (`beatGrid.ts`). Competent play sounds like the score answering.
 *   Enemy fire is the exception: synthesized, immediate, and off-key.
 *
 * Gains follow the critique's priority ladder (player hit 0 dB down to the
 * player's stream at -14 dB). `priority` decides who is stolen when the
 * voice budget is full: higher wins.
 */

import type { Division } from "./beatGrid.ts";
import {
  chord,
  confirm2,
  crackle,
  glide,
  heavyThump,
  pluck,
  precisionEnter,
  precisionExit,
  scanSweep,
  shotTick,
  type SynthRecipe,
  tick,
  tock,
  whoosh,
} from "./synth.ts";

/** A pitch: a scale degree of the current key, or deliberately off it. */
export type Pitch = number | "offKey";

export interface MusicDuck {
  /** Music dip in dB (negative), plus an optional low-pass on music. */
  readonly db: number;
  readonly attackS: number;
  readonly releaseS: number;
  readonly lowpassHz?: number;
}

export interface SoundRole {
  readonly layer: "feel" | "musical";
  /**
   * `sample`: rendered audio from the gameplay manifest (round robin over
   * its variants), with `synth` as the stand-in until one is picked.
   * Otherwise `synth` is the sound.
   */
  readonly sample: boolean;
  readonly synth: SynthRecipe;
  /** Default pitch for synth voices (degree 0 is the tonic). */
  readonly pitch: Pitch;
  /** Octave offset from the key's root octave. */
  readonly octave?: number;
  readonly gainDb: number;
  /** Random pitch spread, ± semitones (feel layer only; music stays in tune). */
  readonly jitter: number;
  /** Concurrent voices of this role; the oldest is cut when exceeded. */
  readonly cap: number;
  readonly priority: number;
  /** Musical layer: the grid line it waits for. */
  readonly quantize?: Division;
  /**
   * Feel layer: snap to the grid only if a line is this close (seconds),
   * so the stream sits in the groove without ever lagging the trigger.
   */
  readonly nudgeS?: number;
  /** Ignore repeats closer together than this. */
  readonly minGapMs?: number;
  readonly duck?: MusicDuck;
  /** Placed in space (pan, distance, doppler) when a position is known. */
  readonly spatial?: boolean;
  readonly bus?: "sfx" | "ui";
}

const feel = (
  synth: SynthRecipe,
  gainDb: number,
  rest: Partial<SoundRole> = {},
): SoundRole => ({
  layer: "feel",
  sample: true,
  synth,
  pitch: 0,
  gainDb,
  jitter: 1,
  cap: 3,
  priority: 5,
  spatial: true,
  ...rest,
});

const musical = (
  synth: SynthRecipe,
  gainDb: number,
  quantize: Division,
  rest: Partial<SoundRole> = {},
): SoundRole => ({
  layer: "musical",
  sample: false,
  synth,
  pitch: 0,
  gainDb,
  jitter: 0,
  cap: 4,
  priority: 4,
  quantize,
  ...rest,
});

export const GAMEPLAY_SOUNDS = {
  focus_enter: feel(precisionEnter, -10, {
    sample: false,
    jitter: 0,
    cap: 1,
    priority: 8,
    spatial: false,
  }),
  focus_exit: feel(precisionExit, -12, {
    sample: false,
    jitter: 0,
    cap: 1,
    priority: 8,
    spatial: false,
  }),
  // ----------------------------------------------------- player weapon
  shot_stream: feel(shotTick, -14, {
    sample: false,
    pitch: 4,
    octave: 2,
    jitter: 0.5,
    cap: 3,
    priority: 2,
    nudgeS: 0.02,
    spatial: false,
  }),
  shot_aimed: feel(shotTick, -9, { pitch: 7, octave: 2, spatial: false }),
  writ_release_1: feel(heavyThump, -6, { priority: 7, spatial: false }),
  writ_release_2: feel(heavyThump, -5, { priority: 7, spatial: false }),
  writ_release_3: feel(heavyThump, -4, {
    priority: 8,
    spatial: false,
    duck: { db: -3, attackS: 0.01, releaseS: 0.4 },
  }),
  writ_chord: musical(chord, -10, "16th", { octave: -1, cap: 2 }),
  charge_pip: musical(tick, -13, "8th", { octave: 1, cap: 2 }),

  // ----------------------------------------------------- scan beam
  scan_sweep: musical(scanSweep, -24, "16th", {
    quantize: undefined,
    octave: 1,
    cap: 1,
    priority: 1,
  }),
  lock_tick: feel(tick, -16, {
    sample: false,
    pitch: 9,
    octave: 2,
    jitter: 0,
    cap: 2,
    priority: 3,
    minGapMs: 70,
    spatial: false,
  }),
  lock_confirm: musical(confirm2, -11, "16th", { pitch: 4, octave: 1 }),
  intel_ping: musical(tick, -12, "8th", { pitch: 9, octave: 2, cap: 2 }),

  // ----------------------------------------------------- grazing, pay
  graze: musical(crackle, -14, "16th", {
    cap: 2,
    priority: 3,
    minGapMs: 100,
  }),
  pay_tick: musical(pluck, -17, "16th", {
    octave: 1,
    cap: 2,
    priority: 2,
    minGapMs: 110,
  }),

  // ----------------------------------------------------- enemies
  enemy_fire: feel(tock, -8, {
    sample: false,
    pitch: "offKey",
    octave: -1,
    jitter: 1,
    cap: 4,
    priority: 6,
    minGapMs: 1000 / 6,
  }),
  enemy_fire_heavy: feel(heavyThump, -7, {
    pitch: "offKey",
    cap: 2,
    priority: 7,
  }),
  near_miss: feel(whoosh, -9, { cap: 3, priority: 6, jitter: 1.5 }),
  flyby: feel(whoosh, -13, { cap: 2, priority: 3, jitter: 1 }),
  spawn: feel(whoosh, -15, { cap: 2, priority: 2 }),
  retreat: feel(whoosh, -13, { cap: 2, priority: 3, jitter: 0.5 }),

  // ----------------------------------------------------- hits and kills
  hit_enemy: feel(tick, -14, { pitch: 2, octave: 2, cap: 3, priority: 3 }),
  hit_boss: feel(tick, -10, { pitch: 0, octave: 1, cap: 3, priority: 4 }),
  hit_deflect: feel(tick, -12, { pitch: 11, octave: 2, cap: 2, priority: 3 }),
  hit_player: feel(heavyThump, 0, {
    pitch: "offKey",
    cap: 1,
    priority: 10,
    spatial: false,
  }),
  shield_bloom: feel(chord, -6, { cap: 1, priority: 9, spatial: false }),
  life_lost: feel(heavyThump, 0, {
    pitch: "offKey",
    octave: -1,
    cap: 1,
    priority: 10,
    spatial: false,
    duck: { db: -10, attackS: 0.01, releaseS: 1.2, lowpassHz: 800 },
  }),
  kill_small: feel(heavyThump, -8, { cap: 4, priority: 5 }),
  kill_large: feel(heavyThump, -4, {
    cap: 3,
    priority: 6,
    duck: { db: -2, attackS: 0.005, releaseS: 0.15 },
  }),
  kill_ram: feel(heavyThump, -6, { cap: 2, priority: 6 }),
  kill_note: musical(pluck, -11, "16th", { cap: 4 }),
  part_break: feel(heavyThump, -4, {
    cap: 3,
    priority: 7,
    duck: { db: -2, attackS: 0.005, releaseS: 0.15 },
  }),
  part_stab: musical(pluck, -9, "16th", { pitch: 4, cap: 2 }),
  disarm: feel(glide, -6, { pitch: 7, octave: 1, cap: 2, priority: 7 }),
  disarm_glide: musical(glide, -10, "8th", { pitch: 7, octave: 1, cap: 2 }),
  core_exposed: feel(chord, -5, { pitch: 0, octave: -1, cap: 1, priority: 8 }),

  // ----------------------------------------------------- run beats
  pickup: musical(pluck, -8, "16th", { pitch: 0, octave: 1, cap: 3 }),
  sector_clear: musical(chord, -8, "bar", { cap: 1, priority: 6 }),
  boss_roar: feel(heavyThump, -2, {
    pitch: "offKey",
    octave: 1,
    cap: 1,
    priority: 9,
    spatial: false,
    duck: { db: -4, attackS: 0.02, releaseS: 0.6 },
  }),
  boss_collapse: feel(heavyThump, -2, {
    octave: -1,
    cap: 1,
    priority: 9,
    spatial: false,
  }),
  game_over: feel(glide, -4, { cap: 1, priority: 10, spatial: false }),

  // ----------------------------------------------------- hangar UI
  hangar_equip: feel(confirm2, -10, {
    pitch: 0,
    octave: 1,
    spatial: false,
    bus: "ui",
  }),
  hangar_cosmetic: feel(tick, -12, {
    pitch: 4,
    octave: 2,
    spatial: false,
    bus: "ui",
  }),
  hangar_locked: feel(tick, -12, {
    pitch: "offKey",
    octave: 1,
    spatial: false,
    bus: "ui",
  }),

  // ----------------------------------------------------- menu stand-ins
  // Synth stand-ins for UI roles with no promoted pick yet (`playUi`
  // falls back to `ui_<role>`). The critique found SA3 bad at tiny clicks,
  // so focus, slider and toggle ticks may well stay synthesized.
  ui_focus: ui(tick, -10, 7, 2),
  ui_confirm: ui(confirm2, -4, 0, 1),
  ui_back: ui(tick, -6, 4, 1),
  ui_tab_switch: ui(tick, -7, 2, 2),
  ui_toggle_on: ui(tick, -6, 4, 2),
  ui_toggle_off: ui(tick, -6, 0, 2),
  ui_slider_tick: ui(tick, -12, 9, 2),
  ui_slider_end: ui(tick, -7, 0, 1),
  ui_error: ui(tick, -4, "offKey", 0),
  ui_locked: ui(tick, -5, "offKey", 1),
  ui_menu_open: ui(pluck, -6, 0, 1),
  ui_menu_close: ui(pluck, -7, -3, 1),
  ui_pause_in: ui(pluck, -6, 4, 0),
  ui_pause_out: ui(pluck, -6, 0, 0),
  ui_save: ui(confirm2, -6, 2, 1),
  ui_notify: ui(confirm2, -4, 4, 1),
} satisfies Record<string, SoundRole>;

function ui(
  synth: SynthRecipe,
  gainDb: number,
  pitch: Pitch,
  octave: number,
): SoundRole {
  return feel(synth, gainDb, {
    sample: false,
    pitch,
    octave,
    jitter: 0,
    cap: 2,
    spatial: false,
    bus: "ui",
  });
}

export type GameplaySoundId = keyof typeof GAMEPLAY_SOUNDS;

export function isGameplaySound(id: string): id is GameplaySoundId {
  return id in GAMEPLAY_SOUNDS;
}
