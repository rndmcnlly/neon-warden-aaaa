/**
 * Picks a graphics preset for this device on first launch, so a school
 * Chromebook or a phone never starts on High and stutters through the
 * tutorial. Two stages, after research/2026-10-28-chromebook-kids
 * ("Auto-detection and fallback") and research/2026-10-28-mobile-touch
 * ("Performance tiers"):
 *
 * 1. Hints, instant: a software GL renderer, a phone-sized touchscreen,
 *    `navigator.deviceMemory`, `hardwareConcurrency`, ChromeOS. Hints only
 *    nudge: an N100 reports the same 4 GB as an N4020.
 * 2. A frame-time probe, about two seconds of `requestAnimationFrame` while
 *    the flat logos play (a required beat that is also a cheap benchmark
 *    scene). A slow p90 steps the preset down.
 *
 * The decision functions are pure so tests can pin them; only `probeFrames`
 * and `readHints` touch the browser. Nothing is sent anywhere: the result
 * lives in settings (localStorage), like every other preference.
 *
 * Declined for now: the dynamic resolution governor and a 30 fps cap. Both
 * want real-device numbers first (risk: oscillation, and a cap that feels
 * worse than an honest 45 fps); the probe plus School tier is the floor.
 */

import type { DisplayPreset, SettingsStore } from "../contracts/index.ts";
import { PRESET_RENDER_SCALE } from "../settings/validate.ts";

export type AutoPreset = Exclude<DisplayPreset, "custom" | "ultra">;

export interface DeviceHints {
  /** `navigator.deviceMemory` in GB (Chromium only), coarse powers of two. */
  readonly memoryGb: number | null;
  readonly cores: number | null;
  /** Primary pointer is coarse (a finger). */
  readonly coarse: boolean;
  /** Shorter screen side under 600 CSS px: a phone, not a tablet. */
  readonly phone: boolean;
  /** `CrOS` in the user agent. */
  readonly chromeOs: boolean;
  /** SwiftShader, llvmpipe or similar: null when the renderer is hidden. */
  readonly softwareGl: boolean | null;
}

const ORDER: readonly AutoPreset[] = ["school", "low", "medium", "high"];

/** Stage 1: the preset the hints suggest, before any frame is timed. */
export function hintedPreset(h: DeviceHints): AutoPreset {
  if (h.softwareGl) return "school";
  // Phones render at 3x DPR natively: the School tier's DPR cap matters most.
  if (h.coarse && h.phone) return "school";
  const weak = (h.memoryGb !== null && h.memoryGb <= 4) ||
    (h.cores !== null && h.cores <= 4);
  if (h.chromeOs && weak) return "school";
  if (weak) return "low";
  // Tablets: capable GPUs, but never High on a battery by default.
  if (h.coarse) return "medium";
  return "high";
}

/** The 90th percentile of frame intervals, ms (0 for no samples). */
export function p90(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
}

/**
 * Stage 2: the probe's verdict. Above 20 ms p90 (under 50 fps most frames)
 * steps one preset down; above 34 ms (under 30 fps) goes straight to School.
 * A fast probe never steps up past the hint: hints carry the battery and
 * heat knowledge a two-second probe cannot see.
 */
export function probedPreset(hint: AutoPreset, p90Ms: number): AutoPreset {
  if (p90Ms > 34) return "school";
  if (p90Ms > 20) return ORDER[Math.max(0, ORDER.indexOf(hint) - 1)];
  return hint;
}

/** Reads the hints from this browser. */
export function readHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const shortSide = Math.min(screen.width, screen.height);
  return {
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    cores: nav.hardwareConcurrency || null,
    coarse: matchMedia("(pointer: coarse)").matches,
    phone: shortSide > 0 && shortSide < 600,
    chromeOs: /\bCrOS\b/.test(nav.userAgent),
    softwareGl: softwareRenderer(),
  };
}

/** Asks a throwaway WebGL context who renders it, then releases it. */
function softwareRenderer(): boolean | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    // Absent under fingerprinting resistance: unknown, never "fast".
    const name = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (!name) return null;
    return /SwiftShader|llvmpipe|Software|Basic Render/i.test(name);
  } catch {
    return null;
  }
}

/** Frame intervals for about `durationMs`, skipping the first two (warm-up). */
export function probeFrames(durationMs = 2000): Promise<number[]> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    let last = 0;
    let start = 0;
    let frames = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      if (last && ++frames > 2) samples.push(now - last);
      last = now;
      // A hidden tab stops rAF; the timeout below still resolves.
      if (now - start < durationMs) requestAnimationFrame(tick);
      else resolve(samples);
    };
    requestAnimationFrame(tick);
    setTimeout(() => resolve(samples), durationMs + 1500);
  });
}

export interface AutoTierResult {
  readonly preset: AutoPreset;
  readonly hint: AutoPreset;
  readonly p90Ms: number;
  readonly changed: boolean;
}

/**
 * Runs both stages and writes the preset, keeping `autoTier` on. Does
 * nothing (returns null) once the player has chosen a preset, unless
 * `force` (Settings' "Detect again").
 */
export async function runAutoTier(
  settings: SettingsStore,
  options: { force?: boolean; hints?: DeviceHints } = {},
): Promise<AutoTierResult | null> {
  if (!options.force && !settings.get().display.autoTier) return null;
  const before = settings.get().display.preset;
  const hint = hintedPreset(options.hints ?? readHints());
  apply(settings, hint);
  const p90Ms = p90(await probeFrames());
  // The player may have picked a preset during the probe: theirs wins.
  if (!settings.get().display.autoTier) return null;
  const preset = probedPreset(hint, p90Ms);
  apply(settings, preset);
  return { preset, hint, p90Ms, changed: preset !== before };
}

function apply(settings: SettingsStore, preset: AutoPreset): void {
  settings.update((c) => ({
    ...c,
    display: {
      ...c.display,
      preset,
      renderScale: PRESET_RENDER_SCALE[preset],
      autoTier: true,
    },
  }));
}
