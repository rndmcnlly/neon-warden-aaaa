import { assertEquals } from "@std/assert";
import { createInputLayer } from "../src/input/inputLayer.ts";
import { createSettingsStore } from "../src/settings/store.ts";

Deno.test("input blur/pause reset clears held keys, toggle latches and queued press edges", () => {
  const raf = Object.getOwnPropertyDescriptor(
    globalThis,
    "requestAnimationFrame",
  );
  const caf = Object.getOwnPropertyDescriptor(
    globalThis,
    "cancelAnimationFrame",
  );
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: () => 1,
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    configurable: true,
    value: () => {},
  });
  const settings = createSettingsStore(null);
  const input = createInputLayer(settings);
  function key(type: string, code: string, repeat = false) {
    const event = new Event(type);
    Object.defineProperties(event, {
      code: { value: code },
      repeat: { value: repeat },
    });
    dispatchEvent(event);
  }
  try {
    for (const mode of ["hold", "toggle"] as const) {
      settings.update((s) => ({
        ...s,
        accessibility: { ...s.accessibility, holdToggle: mode },
      }));
      key("keydown", "ArrowRight");
      key("keydown", "ShiftLeft");
      key("keydown", "Space");
      assertEquals(input.readFrame().focus, true);
      dispatchEvent(new Event("blur"));
      const frame = input.readFrame();
      assertEquals(frame.move, { x: 0, y: 0 });
      assertEquals(frame.focus, false);
      assertEquals(frame.fire, false);
      key("keydown", "ShiftLeft");
      // Reset before consuming an edge must discard it too.
      input.reset();
      key("keydown", "ShiftLeft", true);
      assertEquals(input.readFrame().focus, false);
    }
    settings.update((s) => ({
      ...s,
      accessibility: { ...s.accessibility, autoFire: true },
    }));
    input.reset();
    assertEquals(input.readFrame().fire, true);
  } finally {
    input.dispose();
    if (raf) Object.defineProperty(globalThis, "requestAnimationFrame", raf);
    else Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    if (caf) Object.defineProperty(globalThis, "cancelAnimationFrame", caf);
    else Reflect.deleteProperty(globalThis, "cancelAnimationFrame");
  }
});
