import { assert, assertEquals } from "@std/assert";
import {
  createHistoryBridge,
  type HistoryHost,
} from "../src/ui/historyBack.ts";
import { createSwipeDetector, SWIPE } from "../src/input/trackpadSwipe.ts";

/** A browser history stand-in: a stack, a cursor, and async-free popstate. */
function fakeHost(initialState: unknown = null) {
  const entries: unknown[] = [initialState];
  let index = 0;
  let listener: (() => void) | null = null;
  let leftSite = false;
  const host: HistoryHost = {
    history: {
      get state() {
        return entries[index];
      },
      pushState(state: unknown) {
        entries.length = index + 1;
        entries.push(state);
        index++;
      },
      back() {
        if (index === 0) {
          leftSite = true;
          return;
        }
        index--;
        listener?.();
      },
    } as unknown as HistoryHost["history"],
    addEventListener: (_type, l) => (listener = l),
    removeEventListener: () => (listener = null),
  };
  return {
    host,
    /** The player presses system Back. */
    systemBack: () => host.history.back(),
    get length() {
      return index + 1;
    },
    get leftSite() {
      return leftSite;
    },
  };
}

Deno.test("history bridge: system Back in a menu goes Back, never leaves", () => {
  const h = fakeHost();
  let backs = 0;
  const bridge = createHistoryBridge({
    wanted: () => true,
    onBack: () => backs++,
    host: h.host,
  });
  bridge.sync();
  assert(bridge.armed);
  h.systemBack();
  assertEquals(backs, 1);
  assert(!h.leftSite);
  // Still wanted (deeper menu): re-armed straight away.
  assert(bridge.armed);
  h.systemBack();
  assertEquals(backs, 2);
  assert(!h.leftSite);
});

Deno.test("history bridge: at the title it unwinds so Back leaves the site", () => {
  const h = fakeHost();
  let wanted = true;
  let backs = 0;
  const bridge = createHistoryBridge({
    wanted: () => wanted,
    onBack: () => backs++,
    host: h.host,
  });
  bridge.sync();
  assertEquals(h.length, 2);
  wanted = false;
  bridge.sync();
  assert(!bridge.armed);
  assertEquals(h.length, 1, "guard entry unwound");
  assertEquals(backs, 0, "our own unwind is not a player Back");
  h.systemBack();
  assert(h.leftSite, "never trap the player");
});

Deno.test("history bridge: a reload adopts the restored guard entry", () => {
  const h = fakeHost({ nwBackGuard: true });
  const bridge = createHistoryBridge({
    wanted: () => true,
    onBack: () => {},
    host: h.host,
  });
  bridge.sync();
  assertEquals(h.length, 1, "no second guard stacked");
  assert(bridge.armed);
});

Deno.test("history bridge: Back that pops the menu to the title disarms", () => {
  const h = fakeHost();
  let depthMeaningful = true;
  const bridge = createHistoryBridge({
    wanted: () => depthMeaningful,
    // Going Back from the main menu reaches the title: Back means nothing now.
    onBack: () => (depthMeaningful = false),
    host: h.host,
  });
  bridge.sync();
  h.systemBack();
  assert(!bridge.armed);
  h.systemBack();
  assert(h.leftSite);
});

Deno.test("trackpad swipe: a fast horizontal two-finger swipe fires once", () => {
  const d = createSwipeDetector();
  let fired = 0;
  for (let i = 0; i < 10; i++) {
    if (d.feed({ deltaX: -40, deltaY: 3, ctrlKey: false, time: i * 16 })) {
      fired++;
    }
  }
  assertEquals(fired, 1);
  // A new gesture after a pause can fire again.
  let again = false;
  for (let i = 0; i < 5; i++) {
    again ||= d.feed({
      deltaX: -60,
      deltaY: 0,
      ctrlKey: false,
      time: 1000 + i * 16,
    });
  }
  assert(again);
});

Deno.test("trackpad swipe: scrolling, pinch and slow drift never fire", () => {
  const d = createSwipeDetector();
  for (let i = 0; i < 20; i++) {
    assert(!d.feed({ deltaX: 0, deltaY: 100, ctrlKey: false, time: i * 16 }));
  }
  const pinch = createSwipeDetector();
  for (let i = 0; i < 20; i++) {
    assert(!pinch.feed({ deltaX: -80, deltaY: 0, ctrlKey: true, time: i }));
  }
  const drift = createSwipeDetector();
  for (let i = 0; i < 20; i++) {
    // Each sample far apart: a new gesture every time, never accumulating.
    assert(
      !drift.feed({
        deltaX: -(SWIPE.distance / 2),
        deltaY: 0,
        ctrlKey: false,
        time: i * (SWIPE.gapMs + 1),
      }),
    );
  }
});
