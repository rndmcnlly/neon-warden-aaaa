/**
 * The two-layer gameplay sound player (the `SoundSink` for
 * `gameplayAudio.ts`). For each cue it:
 *
 * 1. looks the role up in `GAMEPLAY_SOUNDS` (the tuning table);
 * 2. picks *when*: now for the feel layer (or the next sixteenth if one is a
 *    hair away), the next grid line of the playing cue for the musical layer;
 * 3. picks *what*: the next rendered variant (round robin) with a little
 *    random pitch, or the synth recipe on a pitch from the cue's key;
 * 4. places it: pan, distance gain and dullness from the ship's point of
 *    view, and doppler from the source's radial velocity;
 * 5. enforces voice caps: per role (the oldest is cut) and overall (the
 *    lowest-priority voice is stolen, or the new one is dropped).
 *
 *   source -> gain -> low-pass -> panner -> sfx or ui bus
 */

import type { Vec2 } from "../contracts/index.ts";
import {
  type BeatGrid,
  degreeToMidi,
  nextGridTime,
  offKeyMidi,
  semitonesToRate,
} from "./beatGrid.ts";
import type { SoundCue, SoundSink } from "./gameplayAudio.ts";
import {
  GAMEPLAY_SOUNDS,
  type GameplaySoundId,
  type SoundRole,
} from "./gameplaySounds.ts";
import { dopplerRate, place } from "./spatial.ts";

export interface SfxPlayerDeps {
  readonly ctx: BaseAudioContext;
  readonly buses: { readonly sfx: AudioNode; readonly ui: AudioNode };
  /** Decoded variants of a sampled role, or none yet. */
  readonly samples: (role: GameplaySoundId) => readonly AudioBuffer[];
  /** The playing cue's grid and the audio time its file started. */
  readonly grid: () => { readonly grid: BeatGrid; readonly cueStart: number };
  /** The listener: the player's ship, and its velocity per tick. */
  readonly ear: () => { readonly pos: Vec2; readonly vel: Vec2 };
  readonly mono: () => boolean;
  /** Called for roles with a music duck (see `GAMEPLAY_SOUNDS`). */
  readonly duck: (role: SoundRole) => void;
}

/** Most simultaneous gameplay voices; past this, priority decides. */
export const MAX_VOICES = 32;

interface Voice {
  readonly role: GameplaySoundId;
  readonly priority: number;
  readonly endsAt: number;
  stop(at: number): void;
}

export class SfxPlayer implements SoundSink {
  private voices: Voice[] = [];
  private readonly loops = new Map<GameplaySoundId, Voice>();
  private readonly roundRobin = new Map<GameplaySoundId, number>();
  private readonly lastAt = new Map<GameplaySoundId, number>();

  constructor(private readonly d: SfxPlayerDeps) {}

  play(cue: SoundCue): void {
    const role: SoundRole = GAMEPLAY_SOUNDS[cue.role];
    const now = this.d.ctx.currentTime;
    if (role.minGapMs) {
      const last = this.lastAt.get(cue.role) ?? -Infinity;
      if ((now - last) * 1000 < role.minGapMs) return;
      this.lastAt.set(cue.role, now);
    }
    this.prune(now);
    if (!this.makeRoom(cue.role, role, now)) return;
    const when = this.when(role, now);
    const voice = this.start(cue, role, when);
    this.voices.push(voice);
    if (role.duck) this.d.duck(role);
  }

  loop(
    roleId: GameplaySoundId,
    on: boolean,
    cue: Omit<SoundCue, "role"> = {},
  ): void {
    const now = this.d.ctx.currentTime;
    this.loops.get(roleId)?.stop(now);
    this.loops.delete(roleId);
    if (on) {
      const role = GAMEPLAY_SOUNDS[roleId];
      this.loops.set(roleId, this.start({ role: roleId, ...cue }, role, now));
    }
  }

  /** Cuts everything (quit to title, new run). */
  stopAll(): void {
    const now = this.d.ctx.currentTime;
    for (const v of [...this.voices, ...this.loops.values()]) v.stop(now);
    this.voices = [];
    this.loops.clear();
  }

  // ------------------------------------------------------------ choosing

  private when(role: SoundRole, now: number): number {
    const { grid, cueStart } = this.d.grid();
    if (role.layer === "musical" && role.quantize) {
      return nextGridTime(now, cueStart, grid, role.quantize);
    }
    if (role.nudgeS) {
      const line = nextGridTime(now, cueStart, grid, "16th", 0);
      if (line - now <= role.nudgeS) return line;
    }
    return now;
  }

  private midi(cue: SoundCue, role: SoundRole): number {
    const { grid } = this.d.grid();
    const pitch = cue.pitch ?? role.pitch;
    const octave = 12 * (cue.octave ?? role.octave ?? 0);
    const base = pitch === "offKey"
      ? offKeyMidi(grid.key)
      : degreeToMidi(grid.key, pitch);
    return base + octave;
  }

  // ------------------------------------------------------------- playing

  private start(cue: SoundCue, role: SoundRole, when: number): Voice {
    const ctx = this.d.ctx;
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, role.gainDb / 20);
    let rate = 1;
    let tail: AudioNode = this.d.buses[role.bus ?? "sfx"];
    if (role.spatial && cue.pos) {
      const ear = this.d.ear();
      const p = place(cue.pos, ear.pos, this.d.mono());
      const panner = ctx.createStereoPanner();
      panner.pan.value = p.pan;
      panner.connect(tail);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = p.cutoffHz;
      lp.connect(panner);
      tail = lp;
      gain.gain.value *= p.gain;
      if (cue.vel) rate = dopplerRate(cue.pos, cue.vel, ear.pos, ear.vel);
    }
    gain.connect(tail);
    const jitter = role.jitter ? (Math.random() * 2 - 1) * role.jitter : 0;

    const variants = role.sample ? this.d.samples(cue.role) : [];
    if (variants.length > 0) {
      const i = this.roundRobin.get(cue.role) ?? 0;
      this.roundRobin.set(cue.role, i + 1);
      const src = ctx.createBufferSource();
      src.buffer = variants[i % variants.length];
      src.playbackRate.value = rate * semitonesToRate(jitter);
      src.connect(gain);
      src.start(when);
      const endsAt = when + src.buffer.duration / src.playbackRate.value;
      return {
        role: cue.role,
        priority: role.priority,
        endsAt,
        stop: (at) => {
          gain.gain.setTargetAtTime(0, at, 0.01);
          src.stop(at + 0.05);
        },
      };
    }
    const synth = role.synth({
      ctx,
      out: gain,
      when,
      midi: this.midi(cue, role) + jitter,
      gain: 1,
      rate,
    });
    return {
      role: cue.role,
      priority: role.priority,
      endsAt: synth.endsAt,
      stop: (at) => synth.stop(at),
    };
  }

  // --------------------------------------------------------- voice caps

  private prune(now: number): void {
    this.voices = this.voices.filter((v) => v.endsAt > now);
  }

  /** Frees a slot for a new voice, or returns false to drop it. */
  private makeRoom(id: GameplaySoundId, role: SoundRole, now: number): boolean {
    const same = this.voices.filter((v) => v.role === id);
    if (same.length >= role.cap) this.cut(same[0], now);
    if (this.voices.length < MAX_VOICES) return true;
    let victim: Voice | undefined;
    for (const v of this.voices) {
      if (v.priority > role.priority) continue;
      if (!victim || v.priority < victim.priority) victim = v;
    }
    if (!victim) return false;
    this.cut(victim, now);
    return true;
  }

  private cut(voice: Voice, now: number): void {
    voice.stop(now);
    this.voices = this.voices.filter((v) => v !== voice);
  }
}
