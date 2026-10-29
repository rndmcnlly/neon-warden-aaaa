/**
 * Voice ducks music: while anyone speaks, the music bus dips, and it
 * recovers slowly once the last voice ends. Ducking (lowering) instead of
 * cutting keeps the scene's energy under the dialogue.
 *
 * Written against a two-method slice of `AudioParam` so a test can hand it a
 * fake and read back the scheduled ramps.
 */

export interface RampTarget {
  setTargetAtTime(
    target: number,
    startTime: number,
    timeConstant: number,
  ): unknown;
  cancelScheduledValues(startTime: number): unknown;
}

export const DUCK_TUNING = {
  /** Music gain while a voice plays (about -9 dB). */
  duckedGain: 0.35,
  /** Time constants in seconds: fast attack, slow release. */
  attack: 0.08,
  release: 0.45,
};

export class Ducker {
  private voices = 0;

  constructor(
    private readonly param: RampTarget,
    /** Audio-clock seconds (`AudioContext.currentTime`). */
    private readonly now: () => number,
  ) {}

  get active(): boolean {
    return this.voices > 0;
  }

  voiceStarted(): void {
    if (this.voices++ === 0) this.ramp(DUCK_TUNING.duckedGain, "attack");
  }

  voiceEnded(): void {
    if (this.voices === 0) return;
    if (--this.voices === 0) this.ramp(1, "release");
  }

  private ramp(target: number, kind: "attack" | "release"): void {
    const t = this.now();
    this.param.cancelScheduledValues(t);
    this.param.setTargetAtTime(target, t, DUCK_TUNING[kind]);
  }
}
