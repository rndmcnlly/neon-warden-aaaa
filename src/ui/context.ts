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
import type { InputLayer } from "../input/inputLayer.ts";
import type { SaveStore } from "../settings/saveGame.ts";
import type { Router } from "./router.ts";
import type { TextParams, UiKey } from "../i18n/index.ts";

export interface StartRequest {
  readonly at: SkipTo;
  readonly difficulty: Difficulty;
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
}

export interface UiContext {
  readonly settings: SettingsStore;
  readonly saves: SaveStore;
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
}
