/**
 * Where the playfield and the touch controls go on a touchscreen
 * (research/2026-10-28-mobile-touch, "a control deck below the playfield").
 * The playfield is 3:4 and a phone is about 9:19.5, so in portrait the
 * playfield fits the width and the space left below becomes a thumb deck:
 * fingers there never cover the ship or the bullets, and they stay off the
 * left edge where iOS swipe-back lives. Landscape fits the playfield to the
 * height and splits the controls into two side decks (a two-thumb grip).
 * Short screens fall back to an overlay over the bottom of the playfield.
 *
 * Pure: viewport in, rectangles out, so `tests/ui_touch_layout_test.ts`
 * can pin every case. `touchDeck.ts` writes the result to CSS variables.
 */

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type DeckMode = "deck" | "side" | "overlay";

export interface TouchLayout {
  readonly mode: DeckMode;
  /** The stage (canvas and HUD) box, CSS px. */
  readonly stage: Rect;
  /** Where the FIRE cluster lives; the drag zone is everywhere else. */
  readonly controls: Rect;
}

/**
 * Stage height over width that lets the gameplay camera fit the whole 3:4
 * playfield edge to edge. Larger than 4/3 because the camera is tilted and
 * `cameraRig.fitGameplay` keeps a 6% margin; checked by eye in the iPhone 15
 * and Pixel 7 tutorial screenshots (research/2026-10-29-mobile-touch-qa).
 */
export const STAGE_ASPECT = 1.42;
/** Below this, a deck is too short for a 96 px FIRE button plus margins. */
export const MIN_DECK = 150;
/** Beyond this the deck stops growing; the stage takes the rest. */
export const MAX_DECK = 300;
/** Side decks narrower than this cannot hold a thumb comfortably. */
export const MIN_SIDE = 132;
/**
 * A portrait stage may narrow (centered) to make room for a minimum deck,
 * down to this share of the width; below it, overlay mode reads better.
 * iPhone Safari with its toolbars (393 by 659) lands at about 91%.
 */
export const MIN_STAGE_SHARE = 0.8;

export function touchLayout(
  width: number,
  height: number,
  insets: Insets,
): TouchLayout {
  const x0 = insets.left;
  const y0 = insets.top;
  const w = Math.max(1, width - insets.left - insets.right);
  const h = Math.max(1, height - insets.top - insets.bottom);

  if (h >= w) {
    const fit = w * STAGE_ASPECT;
    const deck = Math.max(MIN_DECK, Math.min(MAX_DECK, h - fit));
    const stageH = h - deck;
    const stageW = Math.min(w, stageH / STAGE_ASPECT);
    if (stageW >= w * MIN_STAGE_SHARE) {
      return {
        mode: "deck",
        stage: {
          x: x0 + (w - stageW) / 2,
          y: y0,
          width: stageW,
          height: stageH,
        },
        controls: { x: x0, y: y0 + stageH, width: w, height: deck },
      };
    }
    return overlay(x0, y0, w, h);
  }

  // Landscape: fit to height, side decks share what is left.
  const stageW = Math.min(w, h / STAGE_ASPECT * 1.1);
  const side = (w - stageW) / 2;
  if (side >= MIN_SIDE) {
    return {
      mode: "side",
      stage: { x: x0 + side, y: y0, width: stageW, height: h },
      // The FIRE side; `touchDeck` mirrors it for left-handed players.
      controls: { x: x0 + side + stageW, y: y0, width: side, height: h },
    };
  }
  return overlay(x0, y0, w, h);
}

/** The whole screen plays; controls sit translucent over the bottom. */
function overlay(x: number, y: number, w: number, h: number): TouchLayout {
  const deck = Math.min(MIN_DECK, h * 0.3);
  return {
    mode: "overlay",
    stage: { x, y, width: w, height: h },
    controls: { x, y: y + h - deck, width: w, height: deck },
  };
}
