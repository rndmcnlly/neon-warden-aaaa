/**
 * Synthesized sounds: the musical layer and the tiny ticks. Generated audio
 * is good at texture (debris, metal, roars) and bad at a clean 30 ms tick or
 * a note in a given key; a few oscillators and a burst of filtered noise are
 * the opposite. Every recipe here is a short function a student can read
 * top to bottom: build nodes, shape an envelope, start, stop.
 *
 * Each recipe plays into `out` at audio-clock time `when` and returns the
 * time it ends (so the player can count voices). Pitches are MIDI notes, so
 * callers pick them from the music's key (`beatGrid.ts`).
 */

import { midiToHz } from "./beatGrid.ts";

export interface SynthArgs {
  readonly ctx: BaseAudioContext;
  readonly out: AudioNode;
  readonly when: number;
  /** MIDI note; recipes that are unpitched ignore it. */
  readonly midi: number;
  /** Linear gain for this hit. */
  readonly gain: number;
  /** Playback-rate style multiplier (doppler); 1 is unchanged. */
  readonly rate: number;
}

/** A playing synth voice: when it ends, and how to cut it early. */
export interface SynthVoice {
  readonly endsAt: number;
  stop(at: number): void;
}

export type SynthRecipe = (a: SynthArgs) => SynthVoice;

let noiseCache: WeakMap<BaseAudioContext, AudioBuffer> | null = null;

/** One second of white noise per context, shared by every noisy recipe. */
function noise(ctx: BaseAudioContext): AudioBuffer {
  noiseCache ??= new WeakMap();
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

/** Attack-decay envelope on a fresh gain node. */
function env(
  a: SynthArgs,
  attack: number,
  decay: number,
  peak = 1,
): GainNode {
  const g = a.ctx.createGain();
  const t = a.when;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak * a.gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(a.out);
  return g;
}

function osc(
  a: SynthArgs,
  type: OscillatorType,
  hz: number,
  into: AudioNode,
): OscillatorNode {
  const o = a.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz * a.rate, a.when);
  o.connect(into);
  return o;
}

function noiseSource(a: SynthArgs, into: AudioNode): AudioBufferSourceNode {
  const n = a.ctx.createBufferSource();
  n.buffer = noise(a.ctx);
  n.loop = true;
  n.playbackRate.value = a.rate;
  n.connect(into);
  return n;
}

function bandpass(a: SynthArgs, hz: number, q: number): BiquadFilterNode {
  const f = a.ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(hz, a.when);
  f.Q.value = q;
  return f;
}

/** Starts sources at `when` and stops them at `end`; returns the voice. */
function run(
  a: SynthArgs,
  sources: AudioScheduledSourceNode[],
  end: number,
): SynthVoice {
  for (const s of sources) {
    // Noise starts at a random offset so repeats never share a waveform.
    if (s instanceof AudioBufferSourceNode) s.start(a.when, Math.random());
    else s.start(a.when);
    s.stop(end);
  }
  return {
    endsAt: end,
    stop(at) {
      for (const s of sources) s.stop(Math.max(at, a.when));
    },
  };
}

// ---------------------------------------------------------------- recipes

/** Fixed-frequency precision gestures, deliberately not tied to music or scan. */
function precisionGesture(enter: boolean): SynthRecipe {
  return (a) => {
    const g = env(a, 0.008, enter ? 0.072 : 0.055, 0.65);
    const o = osc(a, "sine", enter ? 760 : 390, g);
    o.frequency.exponentialRampToValueAtTime(
      (enter ? 390 : 660) * a.rate,
      a.when + 0.06,
    );
    return run(a, [o], a.when + 0.085);
  };
}
export const precisionEnter = precisionGesture(true);
export const precisionExit = precisionGesture(false);

/** A glassy click: a sine blip with a breath of noise. UI and lock ticks. */
export const tick: SynthRecipe = (a) => {
  const g = env(a, 0.002, 0.045);
  const n = env(a, 0.001, 0.012, 0.25);
  const hp = bandpass(a, 6000, 1.5);
  hp.connect(n);
  return run(
    a,
    [osc(a, "sine", midiToHz(a.midi), g), noiseSource(a, hp)],
    a.when + 0.06,
  );
};

/** The player's stream: under 40 ms, bright, reads as a hi-hat. */
export const shotTick: SynthRecipe = (a) => {
  const n = env(a, 0.001, 0.025);
  const bp = bandpass(a, 7500, 2);
  bp.connect(n);
  const g = env(a, 0.001, 0.02, 0.35);
  const o = osc(a, "triangle", midiToHz(a.midi), g);
  o.frequency.exponentialRampToValueAtTime(
    midiToHz(a.midi - 12) * a.rate,
    a.when + 0.02,
  );
  return run(a, [noiseSource(a, bp), o], a.when + 0.04);
};

/** A plucked note with a fifth above it: kill tails, pickups, pay. */
export const pluck: SynthRecipe = (a) => {
  const g = env(a, 0.003, 0.32);
  const g5 = env(a, 0.003, 0.18, 0.3);
  const lp = a.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(6000, a.when);
  lp.frequency.exponentialRampToValueAtTime(900, a.when + 0.3);
  lp.connect(g);
  return run(a, [
    osc(a, "sawtooth", midiToHz(a.midi), lp),
    osc(a, "sine", midiToHz(a.midi + 7), g5),
  ], a.when + 0.36);
};

/** A stacked chord (root, fifth, octave): Writ release, sector clear. */
export const chord: SynthRecipe = (a) => {
  const g = env(a, 0.006, 0.9);
  const lp = a.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(5000, a.when);
  lp.frequency.exponentialRampToValueAtTime(700, a.when + 0.8);
  lp.connect(g);
  const notes = [0, 7, 12, 19].map((n) =>
    osc(a, "sawtooth", midiToHz(a.midi + n), lp)
  );
  for (const [i, o] of notes.entries()) o.detune.value = (i - 1.5) * 6;
  return run(a, notes, a.when + 0.95);
};

/** A falling glide: a weapon powering down, spared (disarm). */
export const glide: SynthRecipe = (a) => {
  const g = env(a, 0.01, 0.7);
  const o = osc(a, "square", midiToHz(a.midi), g);
  o.frequency.exponentialRampToValueAtTime(
    midiToHz(a.midi - 19) * a.rate,
    a.when + 0.65,
  );
  const lp = a.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  o.disconnect();
  o.connect(lp).connect(g);
  return run(a, [o], a.when + 0.72);
};

/** A tiny crackle that climbs with the note: grazing. */
export const crackle: SynthRecipe = (a) => {
  const n = env(a, 0.001, 0.03, 0.6);
  const bp = bandpass(a, midiToHz(a.midi + 36), 8);
  bp.connect(n);
  const g = env(a, 0.001, 0.08, 0.4);
  return run(
    a,
    [noiseSource(a, bp), osc(a, "sine", midiToHz(a.midi + 24), g)],
    a.when + 0.1,
  );
};

/** A soft, low "tock": ordinary enemy fire, deliberately off-key. */
export const tock: SynthRecipe = (a) => {
  const g = env(a, 0.002, 0.11);
  const o = osc(a, "sine", midiToHz(a.midi), g);
  o.frequency.exponentialRampToValueAtTime(
    midiToHz(a.midi - 7) * a.rate,
    a.when + 0.1,
  );
  const n = env(a, 0.001, 0.02, 0.3);
  const bp = bandpass(a, 1800, 3);
  bp.connect(n);
  return run(a, [o, noiseSource(a, bp)], a.when + 0.13);
};

/** Sub thump plus a rising whine: heavy enemy fire. Also off-key. */
export const heavyThump: SynthRecipe = (a) => {
  const g = env(a, 0.003, 0.25);
  const sub = osc(a, "sine", 70, g);
  sub.frequency.exponentialRampToValueAtTime(38, a.when + 0.22);
  const w = env(a, 0.04, 0.2, 0.25);
  const whine = osc(a, "sawtooth", midiToHz(a.midi + 12), w);
  whine.frequency.exponentialRampToValueAtTime(
    midiToHz(a.midi + 17) * a.rate,
    a.when + 0.22,
  );
  return run(a, [sub, whine], a.when + 0.27);
};

/**
 * Filtered noise that swells and falls: a near miss or a fly-by. Peaks
 * 60% of the way through, so callers schedule it to peak at the pass.
 */
export const whoosh: SynthRecipe = (a) => {
  const dur = 0.32;
  const g = a.ctx.createGain();
  const t = a.when;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(a.gain, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(a.out);
  const bp = bandpass(a, 1200, 1.4);
  bp.frequency.exponentialRampToValueAtTime(4200 * a.rate, t + dur * 0.6);
  bp.frequency.exponentialRampToValueAtTime(900, t + dur);
  bp.connect(g);
  return run(a, [noiseSource(a, bp)], t + dur);
};

/**
 * The scan beam: a quiet, slowly sweeping filtered-noise bed with a soft
 * sine under it. Lasts until stopped (looping layers return a far `endsAt`).
 */
export const scanSweep: SynthRecipe = (a) => {
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, a.when);
  g.gain.linearRampToValueAtTime(a.gain * 0.5, a.when + 0.25);
  g.connect(a.out);
  const bp = bandpass(a, 2500, 6);
  const lfo = a.ctx.createOscillator();
  lfo.frequency.value = 0.9;
  const depth = a.ctx.createGain();
  depth.gain.value = 1400;
  lfo.connect(depth).connect(bp.frequency);
  bp.connect(g);
  const hum = osc(a, "sine", midiToHz(a.midi), g);
  hum.detune.value = -4;
  const sources = [noiseSource(a, bp), lfo, hum];
  for (const s of sources) s.start(a.when);
  return {
    endsAt: Number.POSITIVE_INFINITY,
    stop(at) {
      const t = Math.max(at, a.when);
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0, t, 0.06);
      for (const s of sources) s.stop(t + 0.3);
    },
  };
};

/** Two quick ascending notes: lock confirmed, intel received. */
export const confirm2: SynthRecipe = (a) => {
  const first = tick(a);
  const second = tick({ ...a, when: a.when + 0.07, midi: a.midi + 7 });
  return {
    endsAt: second.endsAt,
    stop(at) {
      first.stop(at);
      second.stop(at);
    },
  };
};

// ---------------------------------------------------- core feedback ladder
// Night plan step 4a: hits, Writ tiers, deflects and stand-ins for the
// sampled disarm, pod and life-lost layers. Crisp and tonal sounds stay
// synthesized: a model renders texture well and a 15 ms ping badly.

/** Lowpass helper for the recipes below. */
function lowpass(a: SynthArgs, hz: number): BiquadFilterNode {
  const f = a.ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(hz, a.when);
  return f;
}

/**
 * A tap's impact: an 8 ms bright click, a 70 ms body and a breath of air.
 * Short and dry, so rhythm tapping stays crisp instead of smearing.
 */
export const crack: SynthRecipe = (a) => {
  const click = env(a, 0.0005, 0.008);
  const hp = bandpass(a, 3200, 1.2);
  hp.connect(click);
  const body = env(a, 0.002, 0.07, 0.7);
  const o = osc(a, "triangle", 360, body);
  o.frequency.exponentialRampToValueAtTime(220 * a.rate, a.when + 0.07);
  const air = env(a, 0.002, 0.09, 0.18);
  const bp = bandpass(a, 6500, 0.8);
  bp.connect(air);
  return run(a, [noiseSource(a, hp), o, noiseSource(a, bp)], a.when + 0.1);
};

/**
 * A Writ landing, one recipe per tier so each sounds different, not just
 * louder: tier 1 a hard crack, tier 2 adds a metallic ring a fifth up,
 * tier 3 adds a sub drop (110 to 45 Hz) and a long shimmer tail.
 */
export function writImpact(tier: 1 | 2 | 3): SynthRecipe {
  return (a) => {
    const voices: SynthVoice[] = [crack(a)];
    const sources: AudioScheduledSourceNode[] = [];
    // Every tier: a noise slap through a falling filter.
    const slap = env(a, 0.001, 0.12 + tier * 0.05, 0.9);
    const lp = lowpass(a, 7000);
    lp.frequency.exponentialRampToValueAtTime(900, a.when + 0.15);
    lp.connect(slap);
    sources.push(noiseSource(a, lp));
    let end = a.when + 0.25;
    if (tier >= 2) {
      const ring = env(a, 0.002, 0.45, 0.35);
      for (const n of [0, 7, 19]) {
        const o = osc(a, "sine", midiToHz(a.midi + n), ring);
        o.detune.value = n === 19 ? 9 : 0;
        sources.push(o);
      }
      end = a.when + 0.5;
    }
    if (tier === 3) {
      const sub = env(a, 0.002, 0.4, 1.2);
      const o = osc(a, "sine", 110, sub);
      o.frequency.exponentialRampToValueAtTime(45, a.when + 0.35);
      const shimmer = env(a, 0.03, 0.8, 0.12);
      const hp = bandpass(a, 9000, 0.7);
      hp.connect(shimmer);
      sources.push(o, noiseSource(a, hp));
      end = a.when + 0.85;
    }
    const voice = run(a, sources, end);
    return {
      endsAt: end,
      stop(at) {
        voice.stop(at);
        for (const v of voices) v.stop(at);
      },
    };
  };
}

/** Armor deflect: a 15 ms ping with a fast fall, the "tink" of no damage. */
export const tink: SynthRecipe = (a) => {
  const g = env(a, 0.0005, 0.08, 0.8);
  const o = osc(a, "sine", 2400, g);
  o.frequency.exponentialRampToValueAtTime(1300 * a.rate, a.when + 0.08);
  const g2 = env(a, 0.0005, 0.03, 0.4);
  const o2 = osc(a, "square", 5200, g2);
  return run(a, [o, o2], a.when + 0.1);
};

/** Stand-in for the Writ miss: a dry fizzle that thins out into distance. */
export const fizzle: SynthRecipe = (a) => {
  const g = env(a, 0.005, 0.45, 0.6);
  const bp = bandpass(a, 3000, 3);
  bp.frequency.exponentialRampToValueAtTime(500, a.when + 0.45);
  bp.connect(g);
  return run(a, [noiseSource(a, bp)], a.when + 0.5);
};

/** Stand-in for the disarm: a latch's two quick clacks and a low clunk. */
export const unlatch: SynthRecipe = (a) => {
  const sources: AudioScheduledSourceNode[] = [];
  for (const [dt, hz] of [[0, 2200], [0.045, 1400]] as const) {
    const g = env({ ...a, when: a.when + dt }, 0.0005, 0.03, 0.9);
    const bp = bandpass({ ...a, when: a.when + dt }, hz, 4);
    bp.connect(g);
    const n = noiseSource(a, bp);
    sources.push(n);
  }
  const thunk = env({ ...a, when: a.when + 0.05 }, 0.002, 0.12, 0.8);
  sources.push(osc({ ...a, when: a.when + 0.05 }, "sine", 140, thunk));
  return run(a, sources, a.when + 0.2);
};

/** Stand-in for the power-down: a servo winding down with a sputter. */
export const spinDown: SynthRecipe = (a) => {
  const g = env(a, 0.01, 0.7, 0.6);
  const lp = lowpass(a, 1800);
  lp.connect(g);
  const o = osc(a, "sawtooth", 900, lp);
  o.frequency.exponentialRampToValueAtTime(110 * a.rate, a.when + 0.7);
  // Sputter: a square LFO chops the gain, slowing as it dies.
  const lfo = a.ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.setValueAtTime(22, a.when);
  lfo.frequency.linearRampToValueAtTime(6, a.when + 0.7);
  const depth = a.ctx.createGain();
  depth.gain.value = 0.4;
  lfo.connect(depth).connect(g.gain);
  return run(a, [o, lfo], a.when + 0.75);
};

/** Stand-in for a Warden pod tearing off: a sub boom under a metal shriek. */
export const podTear: SynthRecipe = (a) => {
  const boom = env(a, 0.003, 0.6, 1.2);
  const sub = osc(a, "sine", 80, boom);
  sub.frequency.exponentialRampToValueAtTime(32, a.when + 0.5);
  const tear = env(a, 0.01, 0.4, 0.5);
  const bp = bandpass(a, 1800, 6);
  bp.frequency.exponentialRampToValueAtTime(700, a.when + 0.4);
  bp.connect(tear);
  return run(a, [sub, noiseSource(a, bp)], a.when + 0.65);
};

/** Stand-in for the life-lost alarm: a falling minor second, then a thud. */
export const alarm: SynthRecipe = (a) => {
  const sources: AudioScheduledSourceNode[] = [];
  for (const [dt, semis] of [[0, 0], [0.16, -1]] as const) {
    const at = { ...a, when: a.when + dt };
    const g = env(at, 0.004, 0.22, 0.7);
    sources.push(osc(at, "square", midiToHz(a.midi + 24 + semis), g));
  }
  const thud = env(a, 0.002, 0.35, 1.2);
  const o = osc(a, "sine", 60, thud);
  o.frequency.exponentialRampToValueAtTime(30, a.when + 0.3);
  sources.push(o);
  return run(a, sources, a.when + 0.5);
};
