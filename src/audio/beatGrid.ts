/**
 * The music's grid and key, so sound effects can play *in* the music: a
 * musical-layer sound waits for the next sixteenth (or eighth, or bar) of
 * the cue now playing and picks its pitch from the cue's scale, the way Rez
 * and Tetris Effect turn play into part of the score. Enemy fire takes the
 * opposite: a pitch outside the scale, so danger never sounds musical.
 *
 * Pure math on audio-clock seconds; no Web Audio, so it is unit-tested.
 * Tempo and key come from `music/manifest.json` (measured at promote time by
 * `music/promote.py`, because generated music does not reliably honor the
 * tempo it was asked for); `DEFAULT_GRIDS` covers cues not promoted yet.
 */

import type { MusicCueId } from "../contracts/index.ts";

export type Mode = "major" | "minor" | "dorian" | "phrygian";

export interface MusicKey {
  /** MIDI note of the tonic (57 is A3). */
  readonly root: number;
  readonly mode: Mode;
}

export interface BeatGrid {
  readonly bpm: number;
  /** Seconds from the start of the file to its first downbeat. */
  readonly beatOffset: number;
  readonly beatsPerBar: number;
  readonly key: MusicKey;
}

/** Grid divisions, in fractions of a bar of 4/4. */
export type Division = "16th" | "8th" | "beat" | "bar";
const PER_BEAT: Record<Division, number> = {
  "16th": 4,
  "8th": 2,
  "beat": 1,
  "bar": 0.25,
};

/** Briefed tempos and keys, used until a cue is promoted and measured. */
export const DEFAULT_GRIDS: Readonly<Partial<Record<MusicCueId, BeatGrid>>> = {
  // 129 BPM is measured on both gameplay takes (critique-audio README);
  // the player's stream (7 ticks at 60 Hz) is a sixteenth at 128.6 BPM.
  gameplay: { bpm: 129, beatOffset: 0, beatsPerBar: 4, key: am() },
  tutorial: { bpm: 110, beatOffset: 0, beatsPerBar: 4, key: maj(60) },
  menu: { bpm: 108, beatOffset: 0, beatsPerBar: 4, key: maj(60) },
  boss: { bpm: 144, beatOffset: 0, beatsPerBar: 4, key: phr(57) },
  flashback: { bpm: 70, beatOffset: 0, beatsPerBar: 4, key: am() },
};

/** Used when nothing is playing (or a cue has no grid at all). */
export const FALLBACK_GRID: BeatGrid = {
  bpm: 129,
  beatOffset: 0,
  beatsPerBar: 4,
  key: am(),
};

function am(): MusicKey {
  return { root: 57, mode: "minor" };
}
function maj(root: number): MusicKey {
  return { root, mode: "major" };
}
function phr(root: number): MusicKey {
  return { root, mode: "phrygian" };
}

/**
 * The first grid line at or after `now`, for a cue whose file started
 * playing at `cueStart` (audio-clock seconds). Times within `toleranceS`
 * after a line snap back to it, so a hit that lands a hair late does not
 * wait a whole sixteenth.
 */
export function nextGridTime(
  now: number,
  cueStart: number,
  grid: BeatGrid,
  division: Division,
  toleranceS = 0.012,
): number {
  const step = 60 / grid.bpm / PER_BEAT[division] *
    (division === "bar" ? grid.beatsPerBar / 4 : 1);
  const origin = cueStart + grid.beatOffset;
  const n = Math.ceil((now - origin - toleranceS) / step);
  return Math.max(now, origin + n * step);
}

const SCALES: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

/**
 * MIDI note of a scale degree (0 is the tonic; 7 is the octave above;
 * negative goes down). Degrees wrap through octaves.
 */
export function degreeToMidi(key: MusicKey, degree: number): number {
  const scale = SCALES[key.mode];
  const octave = Math.floor(degree / scale.length);
  const step = degree - octave * scale.length;
  return key.root + 12 * octave + scale[step];
}

/**
 * A note outside the key: the tritone above the tonic, nudged a quarter
 * tone sharp so it cannot land on any scale step. Danger stays off-key.
 */
export function offKeyMidi(key: MusicKey): number {
  return key.root + 6.5;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Playback-rate multiplier that shifts a sample by `semitones`. */
export function semitonesToRate(semitones: number): number {
  return Math.pow(2, semitones / 12);
}
