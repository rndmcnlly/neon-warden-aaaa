/**
 * The front end's only door to audio. Menus call `uiSound("confirm")`; the
 * audio workstream later installs a sink that plays the promoted file for
 * that role on the UI bus. Until then the sink is silent, so menus never
 * depend on audio being ready (or unlocked by the browser yet).
 */

import { sfxRole, type SfxRoleId } from "../contracts/index.ts";

/** Roles from `public/sfx/manifest.json`, mirrored so call sites are typed. */
export const UI_SOUND_ROLES = [
  "focus",
  "confirm",
  "back",
  "tab_switch",
  "toggle_on",
  "toggle_off",
  "slider_tick",
  "slider_end",
  "error",
  "locked",
  "menu_open",
  "menu_close",
  "pause_in",
  "pause_out",
  "save",
  "notify",
] as const;

export type UiSoundRole = typeof UI_SOUND_ROLES[number];

export type UiSoundSink = (role: SfxRoleId) => void;

let sink: UiSoundSink = () => {};

/** Audio calls this once its UI bus exists. */
export function setUiSoundSink(next: UiSoundSink): void {
  sink = next;
}

export function uiSound(role: UiSoundRole): void {
  sink(sfxRole(role));
}
