/**
 * The Warden speaks through the arena's public-address system: a cheap horn
 * speaker (band-pass), pushed a little too hard (soft clipping), bouncing
 * once off the arena walls (a short slap delay plus a small room). It makes
 * a high, furious voice sound like it owns the building without making it
 * deeper or scarier, which is the joke (see AGENTS.md, "The Warden in three
 * moves").
 *
 *   in -> highpass -> lowpass -> drive -> makeup --+--------------> out
 *                                                  +-> slap delay -+
 *                                                  +-> room -------+
 *
 * One chain is shared by every Warden line; it costs a few nodes, built
 * once. Tune it here.
 */

export const ARENA_PA = {
  /** Horn speakers lose the chest and the air. */
  lowCutHz: 380,
  highCutHz: 4200,
  /** 0 is clean; 1 is a blown cone. Kept mild so words stay legible. */
  drive: 0.35,
  /** Clean-signal projection after drive compensation, calibrated in reels. */
  makeupGain: 1.07,
  /** First reflection off the far wall. */
  slapMs: 85,
  slapGain: 0.28,
  slapFeedback: 0.22,
  /** A short, synthesized room tail (no impulse file to ship). */
  roomSeconds: 0.7,
  roomGain: 0.18,
};

/** A soft-clip curve: tanh, scaled so `drive` 0 is the identity. */
export function driveCurve(drive: number, n = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(n);
  const k = 1 + drive * 8;
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/** Cancels driveCurve's quiet-signal amplification, without undoing its tone. */
export function driveCompensation(drive: number): number {
  const k = 1 + drive * 8;
  return Math.tanh(k) / k;
}

/** Decaying stereo noise: an impulse response for a small, hard room. */
function roomImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 4);
    }
  }
  return ir;
}

/** Builds the chain into `out`; connect Warden voices to the returned node. */
export function createArenaPa(
  ctx: BaseAudioContext,
  out: AudioNode,
): AudioNode {
  const p = ARENA_PA;
  const input = ctx.createBiquadFilter();
  input.type = "highpass";
  input.frequency.value = p.lowCutHz;
  input.Q.value = 0.9;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = p.highCutHz;
  low.Q.value = 1.2;
  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve(p.drive);
  shaper.oversample = "2x";
  const makeup = ctx.createGain();
  // driveCurve normalizes its endpoints, not its quiet-signal gain. Its
  // derivative at zero is k/tanh(k), about 3.8 (+11.6 dB) at this drive:
  // without compensation, an -18 LUFS take dominates Warden-heavy reels.
  // Cancel that hidden boost while keeping the horn's saturation and room.
  makeup.gain.value = p.makeupGain * driveCompensation(p.drive);
  input.connect(low).connect(shaper).connect(makeup).connect(out);

  const slap = ctx.createDelay(1);
  slap.delayTime.value = p.slapMs / 1000;
  const slapGain = ctx.createGain();
  slapGain.gain.value = p.slapGain;
  const feedback = ctx.createGain();
  feedback.gain.value = p.slapFeedback;
  makeup.connect(slap).connect(slapGain).connect(out);
  slap.connect(feedback).connect(slap);

  const room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx, p.roomSeconds);
  const roomGain = ctx.createGain();
  roomGain.gain.value = p.roomGain;
  makeup.connect(room).connect(roomGain).connect(out);
  return input;
}
