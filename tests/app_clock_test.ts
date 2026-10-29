import { assertEquals } from "@std/assert";
import { PausableClock } from "../src/app/clock.ts";

Deno.test("clock stops while paused and scales with its rate", () => {
  let wall = 1000;
  const clock = new PausableClock(() => wall);
  wall += 100;
  assertEquals(clock.now(), 100);
  clock.setPaused(true);
  wall += 500;
  assertEquals(clock.now(), 100, "paused time does not count");
  clock.setPaused(false);
  clock.setRate(4);
  wall += 50;
  assertEquals(clock.now(), 300);
});
