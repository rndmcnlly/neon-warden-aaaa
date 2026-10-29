/**
 * Where speech starts in a rendered take: the measured onset that lets the
 * game skip a take's leading silence without re-encoding it.
 *
 * The recast tutorial voice (Captain) opens with a median 0.64 s of silence
 * before the first word, against 0.24 s for the original voice
 * (research/2026-10-29-vo-audit/). Trimming every file would touch 669
 * takes and lose the measurement; instead `scripts/sync_vo.ts` stores the
 * onset per take in `public/vo/cues.json` (and the variants index), and the
 * player starts playback, subtitles and word timing a little before it
 * (`voStartS` in `src/audio/manifests.ts`). Change the policy there, not here:
 * this file only measures.
 */

/** Analysis rate: speech energy needs no more, and decoding is faster. */
export const ONSET_RATE = 16000;
/** Window length, seconds. */
const WINDOW_S = 0.01;
/**
 * A window this loud (RMS, dBFS) counts as sound. Takes are normalized to
 * -18 LUFS, so voiced speech sits around -30 to -15 dBFS while the TTS
 * noise floor sits near -60; breaths land between and count as sound,
 * which is what we want to keep.
 */
const THRESHOLD_DBFS = -42;
/** Consecutive loud windows needed, so a click cannot pass for speech. */
const SUSTAIN_WINDOWS = 3;

/**
 * Seconds from the start of `samples` (mono, `rate` Hz) to the first
 * sustained sound, rounded to 10 ms. A take with no sound returns 0, so a
 * broken measurement never skips audio.
 */
export function onsetFromSamples(samples: Float32Array, rate: number): number {
  const n = Math.max(1, Math.round(rate * WINDOW_S));
  const threshold = Math.pow(10, THRESHOLD_DBFS / 20);
  let run = 0;
  for (let w = 0; (w + 1) * n <= samples.length; w++) {
    let sum = 0;
    for (let i = w * n; i < (w + 1) * n; i++) sum += samples[i] * samples[i];
    if (Math.sqrt(sum / n) >= threshold) {
      if (++run === SUSTAIN_WINDOWS) {
        return Math.round((w - SUSTAIN_WINDOWS + 1) * n / rate * 100) / 100;
      }
    } else run = 0;
  }
  return 0;
}

/** Decodes `file` with ffmpeg (mono, `ONSET_RATE`) and measures its onset. */
export async function measureOnset(file: string): Promise<number> {
  const out = await new Deno.Command("ffmpeg", {
    args: [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-ac",
      "1",
      "-ar",
      String(ONSET_RATE),
      "-f",
      "f32le",
      "-",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!out.success) {
    throw new Error(
      `ffmpeg failed on ${file}:\n` +
        new TextDecoder().decode(out.stderr).slice(-400),
    );
  }
  // Copy so the float view starts on an aligned, owned buffer.
  const bytes = out.stdout.slice();
  const samples = new Float32Array(
    bytes.buffer,
    0,
    Math.floor(bytes.byteLength / 4),
  );
  return onsetFromSamples(samples, ONSET_RATE);
}
