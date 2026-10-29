import { assert, assertEquals } from "@std/assert";
import {
  autoFullscreenAction,
  type AutoState,
  type DeviceSignals,
  isTouchPrimary,
} from "../src/platform/autoFullscreen.ts";

const phone: DeviceSignals = {
  coarse: true,
  anyFine: false,
  touchActive: true,
  mobileUa: true,
  chromeOs: false,
};

Deno.test("touch-primary: phones and tablets yes, laptops and clamshell Chromebooks no", () => {
  assert(isTouchPrimary(phone));
  // iPad with a trackpad case: fine pointer attached, but driven by touch.
  assert(isTouchPrimary({ ...phone, coarse: false, anyFine: true }));
  // A desktop or laptop with a mouse, even a touchscreen laptop in use.
  assert(
    !isTouchPrimary({
      coarse: false,
      anyFine: true,
      touchActive: true,
      mobileUa: false,
      chromeOs: false,
    }),
  );
  // Chromebook with keyboard and trackpad, touched: still a laptop.
  const clamshell = {
    coarse: false,
    anyFine: true,
    touchActive: true,
    mobileUa: false,
    chromeOs: true,
  };
  assert(!isTouchPrimary(clamshell));
  // Chromebook folded into tablet mode: no fine pointer left.
  assert(isTouchPrimary({ ...clamshell, coarse: true, anyFine: false }));
});

const base: AutoState = {
  enabled: true,
  touchPrimary: true,
  standalone: false,
  fullscreen: false,
  inPlay: false,
  optedOut: false,
  denied: false,
  supported: true,
  hintShown: false,
};

Deno.test("auto fullscreen requests on a qualifying menu tap", () => {
  assertEquals(autoFullscreenAction(base), "request");
});

Deno.test("auto fullscreen never interrupts gameplay or overrides the player", () => {
  const none: Partial<AutoState>[] = [
    { enabled: false },
    { touchPrimary: false },
    { standalone: true },
    { fullscreen: true },
    { inPlay: true },
    { optedOut: true },
    { denied: true },
  ];
  for (const patch of none) {
    assertEquals(
      autoFullscreenAction({ ...base, ...patch }),
      "none",
      JSON.stringify(patch),
    );
  }
});

Deno.test("unsupported fullscreen shows the honest hint once, never mid-run", () => {
  const ios = { ...base, supported: false };
  assertEquals(autoFullscreenAction(ios), "hint");
  assertEquals(autoFullscreenAction({ ...ios, hintShown: true }), "none");
  assertEquals(autoFullscreenAction({ ...ios, inPlay: true }), "none");
  assertEquals(autoFullscreenAction({ ...ios, standalone: true }), "none");
  assertEquals(autoFullscreenAction({ ...ios, enabled: false }), "none");
});

Deno.test("a system exit leaves auto armed; only our toggle opts out", () => {
  // After Android Back leaves fullscreen the state is simply not fullscreen.
  assertEquals(autoFullscreenAction({ ...base, fullscreen: false }), "request");
  assertEquals(autoFullscreenAction({ ...base, optedOut: true }), "none");
});
