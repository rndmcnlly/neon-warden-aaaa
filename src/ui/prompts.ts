/**
 * Device-following button prompts. A prompt is just
 * `<kbd class="nw-glyph" data-action="confirm">` in the markup; `refreshPrompts`
 * fills every one in the document from the current bindings and last-used
 * device. Because prompts read bindings, a remap updates every hint at once.
 */

import type { Action, Settings } from "../contracts/index.ts";
import type { Device } from "../input/inputLayer.ts";
import { buttonLabel, keyLabel, type PadFamily } from "../input/labels.ts";

/** Defaults to show when an action has no binding on the active device. */
const MENU_FALLBACK_KEY: Partial<Record<Action, string>> = {
  confirm: "Enter",
  back: "Escape",
  moveUp: "ArrowUp",
  moveDown: "ArrowDown",
  moveLeft: "ArrowLeft",
  moveRight: "ArrowRight",
};
const MENU_FALLBACK_BUTTON: Partial<Record<Action, number>> = {
  confirm: 0,
  back: 1,
  pause: 9,
};

export function glyphFor(
  action: Action,
  settings: Settings,
  device: Device,
  family: PadFamily,
): string {
  const binding = settings.controls.bindings[action];
  if (device === "gamepad") {
    const button = binding.buttons[0] ?? MENU_FALLBACK_BUTTON[action];
    return button === undefined ? "?" : buttonLabel(button, family);
  }
  const key = binding.keys[0] ?? MENU_FALLBACK_KEY[action];
  return key === undefined ? "?" : keyLabel(key);
}

/** Pseudo-actions for prompts that are not bindable actions. */
const SPECIAL_GLYPHS: Readonly<
  Record<string, { key: string; pad: (family: PadFamily) => string }>
> = {
  adjust: { key: "← →", pad: () => "D← →" },
  tabs: {
    key: "Q E",
    pad: (family) => `${buttonLabel(4, family)} ${buttonLabel(5, family)}`,
  },
};

export function refreshPrompts(
  root: ParentNode,
  settings: Settings,
  device: Device,
  family: PadFamily,
): void {
  for (
    const el of root.querySelectorAll<HTMLElement>(".nw-glyph[data-action]")
  ) {
    const action = el.dataset.action!;
    if (action === "backOnly") {
      el.textContent = backOnlyGlyph(settings, device, family);
      continue;
    }
    const special = SPECIAL_GLYPHS[action];
    el.textContent = special
      ? (device === "gamepad" ? special.pad(family) : special.key)
      : glyphFor(action as Action, settings, device, family);
  }
}

/**
 * A Back input that does not also mean Pause (Esc does both, so during
 * play it pauses). The tutorial's skip chip names this one.
 */
export function backOnlyGlyph(
  settings: Settings,
  device: Device,
  family: PadFamily,
): string {
  const { back, pause } = settings.controls.bindings;
  if (device === "gamepad") {
    const button = back.buttons.find((b) => !pause.buttons.includes(b)) ??
      MENU_FALLBACK_BUTTON.back!;
    return buttonLabel(button, family);
  }
  const key = back.keys.find((k) => !pause.keys.includes(k)) ?? "Backspace";
  return keyLabel(key);
}
