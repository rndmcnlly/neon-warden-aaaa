/**
 * What every screen receives: the stores, the input layer, the router, text
 * lookup, and the front end's outward actions. Passing one context object
 * (rather than importing singletons) keeps screens testable and makes their
 * dependencies visible at a glance.
 */

import type {
  Difficulty,
  Lang,
  SettingsStore,
  SkipTo,
} from "../contracts/index.ts";
import type { Loadout } from "../contracts/index.ts";
import type { ProgressStore } from "./progress.ts";
import type { InputLayer } from "../input/inputLayer.ts";
import type { SaveStore } from "../settings/saveGame.ts";
import type { Router } from "./router.ts";
import type { TextParams, UiKey } from "../i18n/index.ts";

export interface StartRequest {
  readonly at: SkipTo;
  readonly difficulty: Difficulty;
  /** The hangar loadout (filled in by the front end on every start). */
  readonly loadout?: Loadout;
}

/** Structural twin of V's `ShipLook`, so UI does not import the renderer. */
export interface ShipLookLike {
  readonly weapon: string;
  readonly sensor: string;
  readonly paint: string;
  readonly trim: string;
  readonly decal: string;
  readonly trail: string;
}

/**
 * Integration points other workstreams fill in. All optional, so the front
 * end runs on its own (with placeholder logos and no sound) during
 * development.
 */
export interface FrontEndHooks {
  /** First user gesture happened: resume the AudioContext here. */
  onAudioUnlock?(): void;
  /**
   * Plays the studio and publisher logos into `slot`. Resolve when done; the
   * front end aborts `signal` if the player skips.
   */
  playBootLogos?(slot: HTMLElement, signal: AbortSignal): Promise<void>;
  onStartGame?(request: StartRequest): void;
  onPause?(): void;
  onResume?(): void;
  onRestartCheckpoint?(): void;
  onQuitToTitle?(): void;
  /** The HUD's skip chip during a story ending: jump to its aftermath. */
  onSkipScene?(): void;
  /**
   * From the stage (V): an entity's position on screen in CSS pixels, or
   * null when off screen. Pins intel tags to enemies.
   */
  screenPositionOf?(entityId: string): { x: number; y: number } | null;
  /**
   * Hangar preview (V's `stage.applyLoadout`): the loadout, and the same
   * thing as a `ShipLook` (ids plus display colors) ready for the stage.
   */
  applyLoadout?(loadout: Loadout, look: ShipLookLike): void;
  /** Hangar camera (V's `stage.showHangar`); null returns to the game. */
  showHangar?(shot: "hero" | "turntable" | null): void;
  /**
   * From the stage (V): CSS px per playfield unit near the ship's row, or
   * null before the first layout. Scales touch drags (src/input/touchPilot.ts).
   */
  playfieldScale?(): number | null;
  /** A codex entry was unlocked for the first time (A may play a sting). */
  onCodexUnlocked?(id: string): void;
}

export interface UiContext {
  readonly settings: SettingsStore;
  readonly saves: SaveStore;
  /** Loadout, codex unlocks, career pay: outlives runs and settings resets. */
  readonly progress: ProgressStore;
  readonly input: InputLayer;
  readonly router: Router;
  readonly hooks: FrontEndHooks;
  lang(): Lang;
  t(key: UiKey, vars?: TextParams): string;
  /** A run is in the Lane Authority tutorial (the skip is offered). */
  inTutorial(): boolean;
  /** Opens the "Skip onboarding?" confirmation. */
  requestTutorialSkip(): void;
  /** Leaves the menus and hands control to gameplay. */
  startGame(request: StartRequest): void;
  resume(): void;
  quitToTitle(): void;
  restartCheckpoint(): void;
  /** Shows a short message at the bottom of the screen. */
  toast(message: string): void;
  /** Settings' "Detect graphics again": re-run the device probe now. */
  redetectTier(): void;
}
