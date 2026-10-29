import { assertEquals } from "@std/assert";
import {
  actionsCollide,
  actionsForKey,
  rebind,
  unboundActions,
} from "../src/input/bindings.ts";
import {
  applyDeadZone,
  INITIAL_HELD,
  resolveHeld,
} from "../src/input/heldActions.ts";
import { buttonLabel, keyLabel, padFamilyFromId } from "../src/input/labels.ts";
import { DEFAULT_BINDINGS } from "../src/settings/defaults.ts";

Deno.test("menu and gameplay actions may share keys; same-context ones may not", () => {
  assertEquals(actionsCollide("fire", "confirm"), false);
  assertEquals(actionsCollide("pause", "back"), false);
  assertEquals(actionsCollide("fire", "focus"), true);
  assertEquals(actionsCollide("confirm", "back"), true);
  assertEquals(actionsCollide("moveUp", "confirm"), true);
});

Deno.test("Space triggers both fire and confirm by default", () => {
  assertEquals(actionsForKey(DEFAULT_BINDINGS, "Space"), ["fire", "confirm"]);
});

Deno.test("rebinding a taken key swaps it with the displaced action", () => {
  // Put X (focus's alternate) onto fire's primary slot, which held Space.
  const { bindings, moves } = rebind(DEFAULT_BINDINGS, "fire", {
    device: "key",
    index: 0,
  }, "KeyX");
  assertEquals(bindings.fire.keys, ["KeyX", "KeyZ"]);
  assertEquals(bindings.focus.keys, ["ShiftLeft", "Space"]);
  assertEquals(moves, [{ input: "KeyX", from: "focus", swappedIn: "Space" }]);
  // Confirm still has Space: menus are a different context.
  assertEquals(bindings.confirm.keys, ["Enter", "Space"]);
});

Deno.test("rebinding into an empty slot removes the input elsewhere", () => {
  const start = {
    ...DEFAULT_BINDINGS,
    fire: { keys: ["KeyZ"], buttons: [0] },
  };
  const { bindings, moves } = rebind(start, "fire", {
    device: "key",
    index: 1,
  }, "ShiftLeft");
  assertEquals(bindings.fire.keys, ["KeyZ", "ShiftLeft"]);
  assertEquals(bindings.focus.keys, ["KeyX"]);
  assertEquals(moves[0].swappedIn, null);
});

Deno.test("gamepad rebinds resolve conflicts within the button list", () => {
  const { bindings } = rebind(DEFAULT_BINDINGS, "back", {
    device: "button",
    index: 0,
  }, 0);
  assertEquals(bindings.back.buttons, [0]);
  assertEquals(bindings.confirm.buttons, [1]);
  assertEquals(bindings.fire.buttons, [0, 7]);
  assertEquals(unboundActions(bindings), []);
});

Deno.test("hold and toggle resolve fire and focus", () => {
  const hold = resolveHeld(INITIAL_HELD, {
    fireDown: true,
    focusDown: false,
    firePresses: 1,
    focusPresses: 0,
  }, { autoFire: false, holdToggle: "hold" });
  assertEquals([hold.fire, hold.focus], [true, false]);

  const toggled = resolveHeld(INITIAL_HELD, {
    fireDown: false,
    focusDown: false,
    firePresses: 1,
    focusPresses: 0,
  }, { autoFire: false, holdToggle: "toggle" });
  assertEquals(toggled.fire, true);
  const stillOn = resolveHeld(toggled.state, {
    fireDown: false,
    focusDown: false,
    firePresses: 0,
    focusPresses: 0,
  }, { autoFire: false, holdToggle: "toggle" });
  assertEquals(stillOn.fire, true);

  const auto = resolveHeld(INITIAL_HELD, {
    fireDown: false,
    focusDown: false,
    firePresses: 0,
    focusPresses: 0,
  }, { autoFire: true, holdToggle: "hold" });
  assertEquals(auto.fire, true);
});

Deno.test("radial dead zone zeroes small input and keeps direction", () => {
  assertEquals(applyDeadZone(0.1, 0.1, 0.2), { x: 0, y: 0 });
  const full = applyDeadZone(1, 0, 0.2);
  assertEquals(full, { x: 1, y: 0 });
});

Deno.test("labels follow device family", () => {
  assertEquals(keyLabel("KeyZ"), "Z");
  assertEquals(keyLabel("Escape"), "Esc");
  assertEquals(
    padFamilyFromId(
      "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)",
    ),
    "playstation",
  );
  assertEquals(
    padFamilyFromId("Xbox 360 Controller (XInput STANDARD GAMEPAD)"),
    "xbox",
  );
  assertEquals(buttonLabel(0, "xbox"), "A");
  assertEquals(buttonLabel(0, "nintendo"), "B");
});
