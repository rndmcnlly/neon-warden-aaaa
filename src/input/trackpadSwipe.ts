/**
 * Recognizes a trackpad two-finger horizontal "history" swipe from wheel
 * events. Chrome on ChromeOS and macOS turns that gesture into Back, which
 * would throw away a run; `overscroll-behavior: none` (platform CSS) stops
 * the navigation, and this detector turns the same gesture into Pause, so
 * the familiar "go back" motion still does something sensible.
 *
 * Pure and clock-injected: feed it wheel samples, it answers "swipe!" once
 * per gesture. A mouse wheel is vertical and discrete, so it never matches.
 */

export interface WheelSample {
  readonly deltaX: number;
  readonly deltaY: number;
  /** `ctrlKey` wheel events are pinch-zoom on trackpads, never a swipe. */
  readonly ctrlKey: boolean;
  /** Milliseconds, any monotonic clock (`event.timeStamp` works). */
  readonly time: number;
}

/**
 * Starting numbers, not yet measured on hardware: a deliberate swipe sends
 * a few hundred px of deltaX within a few frames, a sideways nudge far less.
 * Tune on a real Chromebook trackpad.
 */
export const SWIPE = Object.freeze({
  /** Accumulated horizontal travel, CSS px, to count as a swipe. */
  distance: 120,
  /** Horizontal must dominate vertical by this ratio (not a diagonal scroll). */
  dominance: 2,
  /** Samples further apart than this start a new gesture. */
  gapMs: 180,
});

export interface SwipeDetector {
  /** True exactly once, on the sample that completes a swipe. */
  feed(sample: WheelSample): boolean;
}

export function createSwipeDetector(): SwipeDetector {
  let sumX = 0;
  let sumY = 0;
  let last = -Infinity;
  let fired = false;
  return {
    feed(sample) {
      if (sample.ctrlKey) return false;
      if (sample.time - last > SWIPE.gapMs) {
        sumX = 0;
        sumY = 0;
        fired = false;
      }
      last = sample.time;
      sumX += sample.deltaX;
      sumY += sample.deltaY;
      if (fired) return false;
      const isSwipe = Math.abs(sumX) >= SWIPE.distance &&
        Math.abs(sumX) >= SWIPE.dominance * Math.abs(sumY);
      if (isSwipe) fired = true;
      return isSwipe;
    },
  };
}
