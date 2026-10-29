/**
 * The one input layer for keyboard, gamepad and mouse. It serves two
 * consumers that want different shapes:
 *
 * - Menus get discrete intents (up, confirm, back...) as events, with key
 *   repeat and stick repeat, so navigation feels the same on every device.
 * - Gameplay calls `readFrame()` once per tick for an `InputFrame`: held
 *   state now, plus press edges latched since the previous read, so a quick
 *   tap between two ticks is never lost.
 *
 * It also tracks the last-used device so prompts can follow it, and offers a
 * capture mode for remapping.
 */

import {
  type Action,
  type InputFrame,
  type SettingsStore,
} from "../contracts/index.ts";
import { actionsForButton, actionsForKey } from "./bindings.ts";
import {
  applyDeadZone,
  type HeldState,
  INITIAL_HELD,
  resolveHeld,
} from "./heldActions.ts";
import { type PadFamily, padFamilyFromId } from "./labels.ts";

export type Device = "keyboard" | "mouse" | "gamepad";

export type MenuIntent =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "back"
  | "pause"
  | "tabPrev"
  | "tabNext";

export interface IntentEvent {
  /** Everything this press could mean; the front end picks by context. */
  readonly intents: ReadonlySet<MenuIntent>;
  readonly device: Device;
  readonly repeat: boolean;
}

export type CapturedInput =
  | { readonly kind: "key"; readonly code: string }
  | { readonly kind: "button"; readonly index: number };

export interface InputLayer {
  /** Pause/blur discard held and toggled gameplay actions, never accessibility policy. */
  reset(): void;
  readFrame(): InputFrame;
  onIntent(listener: (event: IntentEvent) => void): () => void;
  /** Any key, click or button: used by the press-any-key gate. */
  onAnyPress(listener: (device: Device) => void): () => void;
  onDeviceChange(listener: (device: Device) => void): () => void;
  onGamepadConnection(listener: (connected: boolean) => void): () => void;
  device(): Device;
  padFamily(): PadFamily;
  /**
   * Routes the next key or button to `callback` instead of the game, then
   * returns to normal. Calls back with `null` on timeout or `cancel()`.
   */
  capture(
    kind: "key" | "button",
    callback: (input: CapturedInput | null) => void,
    timeoutMs: number,
  ): { cancel(): void };
  dispose(): void;
}

const ACTION_INTENT: Partial<Record<Action, MenuIntent>> = {
  moveUp: "up",
  moveDown: "down",
  moveLeft: "left",
  moveRight: "right",
  confirm: "confirm",
  back: "back",
  pause: "pause",
};

/**
 * Menu fallbacks that work regardless of remapping, so no binding can lock a
 * player out of the menus (and out of the screen that fixes the binding).
 */
const FALLBACK_KEYS: Readonly<Record<string, MenuIntent>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "confirm",
  NumpadEnter: "confirm",
  Escape: "back",
  // Tab switching in Settings, the keyboard twin of the shoulder buttons.
  KeyQ: "tabPrev",
  KeyE: "tabNext",
};
const FALLBACK_BUTTONS: Readonly<Record<number, MenuIntent>> = {
  0: "confirm",
  1: "back",
  4: "tabPrev",
  5: "tabNext",
  9: "pause",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

const MENU_STICK_THRESHOLD = 0.55;
const GAME_STICK_DEAD_ZONE = 0.18;
const REPEAT_DELAY_MS = 380;
const REPEAT_INTERVAL_MS = 110;
const REPEATABLE: ReadonlySet<MenuIntent> = new Set([
  "up",
  "down",
  "left",
  "right",
]);

type Listener<T> = (value: T) => void;

function emitter<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    on(listener: Listener<T>): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(value: T): void {
      for (const listener of [...listeners]) listener(value);
    },
  };
}

export function createInputLayer(settings: SettingsStore): InputLayer {
  const intentEvents = emitter<IntentEvent>();
  const anyPress = emitter<Device>();
  const deviceEvents = emitter<Device>();
  const padEvents = emitter<boolean>();

  let currentDevice: Device = "keyboard";
  let family: PadFamily = "generic";
  const heldKeys = new Set<string>();
  let padButtons: boolean[] = [];
  let padStick = { x: 0, y: 0 };
  const blockedPadButtons = new Set<number>();
  let blockStick = false;
  let heldState: HeldState = INITIAL_HELD;
  const edges = { pause: 0, confirm: 0, back: 0, fire: 0, focus: 0 };

  let captureState: {
    kind: "key" | "button";
    callback: (input: CapturedInput | null) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  // Per-intent repeat clocks for held d-pad and stick directions.
  const padRepeat = new Map<MenuIntent, number>();

  function setDevice(device: Device): void {
    if (device === currentDevice) return;
    currentDevice = device;
    deviceEvents.emit(device);
  }

  function bindings() {
    return settings.get().controls.bindings;
  }

  function countEdges(actions: readonly Action[]): void {
    for (const action of actions) {
      if (action in edges) edges[action as keyof typeof edges] += 1;
    }
  }

  function intentsFrom(
    actions: readonly Action[],
    fallback: MenuIntent | undefined,
  ): Set<MenuIntent> {
    const intents = new Set<MenuIntent>();
    for (const action of actions) {
      const intent = ACTION_INTENT[action];
      if (intent) intents.add(intent);
    }
    if (fallback) intents.add(fallback);
    return intents;
  }

  function finishCapture(input: CapturedInput | null): void {
    if (!captureState) return;
    const { callback, timer } = captureState;
    clearTimeout(timer);
    captureState = null;
    callback(input);
  }

  function onKeyDown(event: KeyboardEvent): void {
    setDevice("keyboard");
    if (captureState) {
      event.preventDefault();
      if (captureState.kind === "key" && !event.repeat) {
        finishCapture({ kind: "key", code: event.code });
      }
      return;
    }
    if (!event.repeat) anyPress.emit("keyboard");
    const actions = actionsForKey(bindings(), event.code);
    const intents = intentsFrom(actions, FALLBACK_KEYS[event.code]);
    if (actions.length > 0 || intents.size > 0) event.preventDefault();
    if (!event.repeat) {
      heldKeys.add(event.code);
      countEdges(actions);
    }
    const repeatable = [...intents].filter((i) =>
      !event.repeat || REPEATABLE.has(i)
    );
    if (repeatable.length > 0) {
      intentEvents.emit({
        intents: new Set(repeatable),
        device: "keyboard",
        repeat: event.repeat,
      });
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    heldKeys.delete(event.code);
  }

  function onPointer(event: PointerEvent): void {
    if (event.pointerType === "mouse") setDevice("mouse");
    if (event.type === "pointerdown") anyPress.emit("mouse");
  }

  // Losing focus never sends keyup, so clear held keys or they stick.
  function onBlur(): void {
    const pad = firstPad();
    pad?.buttons.forEach((button, i) => {
      if (button.pressed) blockedPadButtons.add(i);
    });
    blockStick = !!pad &&
      Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > GAME_STICK_DEAD_ZONE;
    heldKeys.clear();
    heldState = INITIAL_HELD;
    padButtons = [];
    padStick = { x: 0, y: 0 };
    padRepeat.clear();
    for (const key of Object.keys(edges) as (keyof typeof edges)[]) {
      edges[key] = 0;
    }
  }

  function onPadConnected(event: GamepadEvent): void {
    family = padFamilyFromId(event.gamepad.id);
    padEvents.emit(true);
  }

  function onPadDisconnected(): void {
    onBlur();
    padEvents.emit(false);
  }

  function firstPad(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) if (pad && pad.connected) return pad;
    return null;
  }

  function stickIntents(x: number, y: number): MenuIntent[] {
    const out: MenuIntent[] = [];
    if (y < -MENU_STICK_THRESHOLD) out.push("up");
    if (y > MENU_STICK_THRESHOLD) out.push("down");
    if (x < -MENU_STICK_THRESHOLD) out.push("left");
    if (x > MENU_STICK_THRESHOLD) out.push("right");
    return out;
  }

  let rafId = 0;
  function pollPad(now: number): void {
    rafId = requestAnimationFrame(pollPad);
    const pad = firstPad();
    if (!pad) return;
    family = padFamilyFromId(pad.id);
    const pressed = pad.buttons.map((b, i) => {
      if (!b.pressed) blockedPadButtons.delete(i);
      return b.pressed && !blockedPadButtons.has(i);
    });
    const rawStick = { x: pad.axes[0] ?? 0, y: pad.axes[1] ?? 0 };
    if (Math.hypot(rawStick.x, rawStick.y) <= GAME_STICK_DEAD_ZONE) {
      blockStick = false;
    }
    const stick = blockStick ? { x: 0, y: 0 } : rawStick;
    const map = bindings();

    const newlyPressed: number[] = [];
    pressed.forEach((down, i) => {
      if (down && !padButtons[i]) newlyPressed.push(i);
    });
    const stickActive = Math.hypot(stick.x, stick.y) > MENU_STICK_THRESHOLD;
    if (newlyPressed.length > 0 || stickActive) setDevice("gamepad");

    if (captureState) {
      if (captureState.kind === "button" && newlyPressed.length > 0) {
        finishCapture({ kind: "button", index: newlyPressed[0] });
      }
      padButtons = pressed;
      padStick = stick;
      return;
    }

    for (const index of newlyPressed) {
      anyPress.emit("gamepad");
      const actions = actionsForButton(map, index);
      countEdges(actions);
      const intents = intentsFrom(actions, FALLBACK_BUTTONS[index]);
      if (intents.size > 0) {
        intentEvents.emit({ intents, device: "gamepad", repeat: false });
        for (const intent of intents) {
          if (REPEATABLE.has(intent)) {
            padRepeat.set(intent, now + REPEAT_DELAY_MS);
          }
        }
      }
    }

    // Held directions (d-pad or stick) repeat like a held arrow key.
    const heldDirections = new Set<MenuIntent>(stickIntents(stick.x, stick.y));
    pressed.forEach((down, i) => {
      const intent = FALLBACK_BUTTONS[i];
      if (down && intent && REPEATABLE.has(intent)) heldDirections.add(intent);
    });
    const previousStick = new Set(stickIntents(padStick.x, padStick.y));
    for (const intent of heldDirections) {
      const due = padRepeat.get(intent);
      if (due === undefined) {
        if (!previousStick.has(intent)) {
          intentEvents.emit({
            intents: new Set([intent]),
            device: "gamepad",
            repeat: false,
          });
        }
        padRepeat.set(intent, now + REPEAT_DELAY_MS);
      } else if (now >= due) {
        intentEvents.emit({
          intents: new Set([intent]),
          device: "gamepad",
          repeat: true,
        });
        padRepeat.set(intent, now + REPEAT_INTERVAL_MS);
      }
    }
    for (const intent of [...padRepeat.keys()]) {
      if (!heldDirections.has(intent)) padRepeat.delete(intent);
    }

    padButtons = pressed;
    padStick = stick;
  }

  function isHeld(action: Action): boolean {
    const binding = bindings()[action];
    return binding.keys.some((code) => heldKeys.has(code)) ||
      binding.buttons.some((index) => padButtons[index] === true);
  }

  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
  addEventListener("pointermove", onPointer);
  addEventListener("pointerdown", onPointer);
  addEventListener("blur", onBlur);
  addEventListener("gamepadconnected", onPadConnected);
  addEventListener("gamepaddisconnected", onPadDisconnected);
  rafId = requestAnimationFrame(pollPad);

  return {
    reset: onBlur,
    readFrame(): InputFrame {
      const a = settings.get().accessibility;
      const keyX = (isHeld("moveRight") ? 1 : 0) - (isHeld("moveLeft") ? 1 : 0);
      const keyY = (isHeld("moveDown") ? 1 : 0) - (isHeld("moveUp") ? 1 : 0);
      const stick = applyDeadZone(padStick.x, padStick.y, GAME_STICK_DEAD_ZONE);
      const x = Math.max(-1, Math.min(1, keyX + stick.x));
      const y = Math.max(-1, Math.min(1, keyY + stick.y));
      const held = resolveHeld(heldState, {
        fireDown: isHeld("fire"),
        focusDown: isHeld("focus"),
        firePresses: edges.fire,
        focusPresses: edges.focus,
      }, a);
      heldState = held.state;
      const frame: InputFrame = {
        move: { x, y },
        fire: held.fire,
        focus: held.focus,
        pause: edges.pause > 0,
        confirm: edges.confirm > 0,
        back: edges.back > 0,
      };
      edges.pause =
        edges.confirm =
        edges.back =
        edges.fire =
        edges.focus =
          0;
      return frame;
    },
    onIntent: intentEvents.on,
    onAnyPress: anyPress.on,
    onDeviceChange: deviceEvents.on,
    onGamepadConnection: padEvents.on,
    device: () => currentDevice,
    padFamily: () => family,
    capture(kind, callback, timeoutMs) {
      finishCapture(null);
      const timer = setTimeout(() => finishCapture(null), timeoutMs);
      captureState = { kind, callback, timer };
      return { cancel: () => finishCapture(null) };
    },
    dispose() {
      cancelAnimationFrame(rafId);
      removeEventListener("keydown", onKeyDown);
      removeEventListener("keyup", onKeyUp);
      removeEventListener("pointermove", onPointer);
      removeEventListener("pointerdown", onPointer);
      removeEventListener("blur", onBlur);
      removeEventListener("gamepadconnected", onPadConnected);
      removeEventListener("gamepaddisconnected", onPadDisconnected);
    },
  };
}
