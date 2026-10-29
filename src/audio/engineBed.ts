/**
 * The ship's engine bed: one continuous synthesized voice whose loudness,
 * pitch and brightness follow how fast the ship moves and how hard it is
 * changing speed. MOVE was the one core verb with no sound at all
 * (research/2026-10-29-av-core-loop/, idea 1).
 *
 * Two layers, both synthesized (no files to load, nothing to audition):
 *
 * - hum: two detuned sawtooths through a low-pass; speed opens the filter
 *   and lifts the pitch up to 3 semitones, like a turbine spooling up;
 * - thrust: band-passed noise; acceleration (a start, a turn, a stop) is what
 *   makes it hiss, so a held direction settles back toward the hum.
 *
 *   hum oscillators -> low-pass -> hum gain --\
 *                                              +-> bed gain -> pan -> sfx bus
 *   noise -> band-pass -> thrust gain --------/
 *
 * Response: about 30 ms to rise (three time constants of 10 ms, "only mildly
 * interpolated", or it reads as lag) and about 150 ms to fall. Focus is
 * quieter, darker and narrower: a tight band of noise and a centered image,
 * the sound of holding back. The bed sits on the sfx bus, so the player's
 * SFX and master faders and the mono switch apply to it.
 *
 * The listener rides the ship (`spatial.ts`), so the world pans around it;
 * the ship's own engine instead pans a little by where the ship is on
 * screen, which is where your eyes are.
 *
 * It is one persistent voice outside the per-cue voice caps, and it cannot
 * outlive its feed: every update re-arms a fade to silence a quarter second
 * ahead, so a frozen sim (a flashback, a scene, a lost tab) goes quiet on
 * its own instead of droning.
 */

import type { Vec2 } from "../contracts/index.ts";

export const ENGINE_BED_TUNING = {
  /** Full normal speed, sim units per tick (`PLAYER.speed`). */
  fullSpeed: 4.2,
  /** Playfield width, sim units; the pan centers on its middle. */
  fieldWidth: 480,
  /** Pan at the playfield's edges, before focus narrows it. */
  edgePan: 0.3,
  /** Hum gain at rest and at full speed (linear, before the bed gain). */
  humIdle: 0.010,
  humFull: 0.022,
  /** Thrust gain from speed and from acceleration (linear). */
  thrustSpeed: 0.035,
  thrustAccel: 0.11,
  /** Hum fundamental at rest, Hz; speed raises it by up to `pitchCents`. */
  humHz: 66,
  pitchCents: 300,
  /** Hum low-pass, Hz, at rest and at full speed. */
  humCutoffIdle: 260,
  humCutoffFull: 1300,
  /** Thrust band center, Hz: rest, plus speed, plus acceleration. */
  thrustHz: 650,
  thrustHzSpeed: 1500,
  thrustHzAccel: 900,
  /** Band-pass Q: broad normally, a narrow whistle in focus. */
  thrustQ: 0.8,
  thrustQFocus: 4,
  /** Focus: this much quieter, this much darker, this much narrower. */
  focusDb: -5,
  focusCutoff: 0.6,
  focusPan: 0.35,
  /** Seconds: rising and falling time constants (3 tc = settle). */
  riseTc: 0.01,
  fallTc: 0.05,
  /** Silence this long after the last update (seconds). */
  deadManS: 0.25,
};

/** What the bed should sound like this tick. */
export interface EngineTarget {
  readonly humGain: number;
  readonly thrustGain: number;
  /** Cents above `humHz`. */
  readonly detune: number;
  readonly humCutoff: number;
  readonly thrustHz: number;
  readonly thrustQ: number;
  /** Linear gain of the whole bed (focus trims it). */
  readonly bedGain: number;
  readonly pan: number;
}

/**
 * Pure: the bed's targets from the ship's movement over the last tick
 * (`vel`) and the tick before (`prevVel`), sim units per tick. Works the
 * same for the classic and hybrid controllers because it only reads the
 * movement that actually happened.
 */
export function engineTarget(
  vel: Vec2,
  prevVel: Vec2,
  focused: boolean,
  x: number,
  mono: boolean,
): EngineTarget {
  const t = ENGINE_BED_TUNING;
  // Keyboard diagonals reach about 1.4x full speed in classic: let them.
  const speed = Math.min(1.4, Math.hypot(vel.x, vel.y) / t.fullSpeed);
  const accel = Math.min(
    1,
    Math.hypot(vel.x - prevVel.x, vel.y - prevVel.y) / t.fullSpeed,
  );
  const s = Math.min(1, speed);
  const pan = mono ? 0 : Math.max(-1, Math.min(1, x / (t.fieldWidth / 2) - 1)) *
    t.edgePan * (focused ? t.focusPan : 1);
  return {
    humGain: t.humIdle + (t.humFull - t.humIdle) * s,
    thrustGain: t.thrustSpeed * speed + t.thrustAccel * accel,
    detune: t.pitchCents * s,
    humCutoff: (t.humCutoffIdle + (t.humCutoffFull - t.humCutoffIdle) * s) *
      (focused ? t.focusCutoff : 1),
    thrustHz: (t.thrustHz + t.thrustHzSpeed * s + t.thrustHzAccel * accel) *
      (focused ? t.focusCutoff : 1),
    thrustQ: focused ? t.thrustQFocus : t.thrustQ,
    bedGain: focused ? Math.pow(10, t.focusDb / 20) : 1,
    pan,
  };
}

/** Moves `param` toward `value` from where it is now, not from its last event. */
function glide(param: AudioParam, value: number, tc: number, now: number) {
  const p = param as AudioParam & { cancelAndHoldAtTime?(t: number): void };
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now);
  else {
    // Firefox has no cancel-and-hold: pin the current value by hand.
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
  param.setTargetAtTime(value, now, tc);
}

/** The Web Audio half: built on first use, torn down by `stop`. */
export class EngineBed {
  private nodes: {
    readonly sources: AudioScheduledSourceNode[];
    readonly hum: OscillatorNode[];
    readonly humLp: BiquadFilterNode;
    readonly humGain: GainNode;
    readonly band: BiquadFilterNode;
    readonly thrustGain: GainNode;
    readonly bed: GainNode;
    readonly pan: StereoPannerNode;
  } | null = null;
  private last: EngineTarget | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
    private readonly noise: () => AudioBuffer,
  ) {}

  /** Follows `target`; null fades the bed out (the run is not in play). */
  update(target: EngineTarget | null): void {
    const now = this.ctx.currentTime;
    if (!target) {
      if (this.nodes) {
        glide(this.nodes.bed.gain, 0, ENGINE_BED_TUNING.fallTc, now);
      }
      this.last = null;
      return;
    }
    const n = this.nodes ?? this.build();
    const t = ENGINE_BED_TUNING;
    const prev = this.last;
    // Rising values answer fast, falling ones ease off.
    const tc = (next: number, was: number | undefined) =>
      was === undefined || next > was ? t.riseTc : t.fallTc;
    glide(
      n.humGain.gain,
      target.humGain,
      tc(target.humGain, prev?.humGain),
      now,
    );
    glide(
      n.thrustGain.gain,
      target.thrustGain,
      tc(target.thrustGain, prev?.thrustGain),
      now,
    );
    for (const o of n.hum) {
      glide(o.detune, target.detune, tc(target.detune, prev?.detune), now);
    }
    glide(n.humLp.frequency, target.humCutoff, t.riseTc, now);
    glide(n.band.frequency, target.thrustHz, t.riseTc, now);
    glide(n.band.Q, target.thrustQ, t.fallTc, now);
    glide(n.pan.pan, target.pan, t.fallTc, now);
    // The dead man's switch: unless the next update comes, fade out.
    glide(n.bed.gain, target.bedGain, t.riseTc, now);
    n.bed.gain.setTargetAtTime(0, now + t.deadManS, t.fallTc);
    this.last = target;
  }

  /** Stops and disconnects everything (a new run, quit to title). */
  stop(): void {
    if (!this.nodes) return;
    const at = this.ctx.currentTime;
    this.nodes.bed.gain.cancelScheduledValues(at);
    this.nodes.bed.gain.setTargetAtTime(0, at, 0.01);
    for (const s of this.nodes.sources) s.stop(at + 0.05);
    const bed = this.nodes.bed;
    setTimeout(() => bed.disconnect(), 100);
    this.nodes = null;
    this.last = null;
  }

  private build() {
    const ctx = this.ctx;
    const t = ENGINE_BED_TUNING;
    const bed = ctx.createGain();
    bed.gain.value = 0;
    const pan = ctx.createStereoPanner();
    bed.connect(pan).connect(this.out);

    const humGain = ctx.createGain();
    humGain.gain.value = 0;
    const humLp = ctx.createBiquadFilter();
    humLp.type = "lowpass";
    humLp.frequency.value = t.humCutoffIdle;
    humLp.Q.value = 0.7;
    humLp.connect(humGain).connect(bed);
    // A slow beat between the two saws keeps the hum from sounding static.
    const hum = [1, 2.006].map((ratio, i) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = t.humHz * ratio;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0.45;
      o.connect(g).connect(humLp);
      return o;
    });

    const thrustGain = ctx.createGain();
    thrustGain.gain.value = 0;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = t.thrustHz;
    band.Q.value = t.thrustQ;
    band.connect(thrustGain).connect(bed);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise();
    noise.loop = true;
    noise.connect(band);

    const sources: AudioScheduledSourceNode[] = [...hum, noise];
    for (const s of sources) s.start();
    this.nodes = { sources, hum, humLp, humGain, band, thrustGain, bed, pan };
    return this.nodes;
  }
}
