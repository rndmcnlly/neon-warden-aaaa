import { assert, assertEquals } from "@std/assert";
import { lineId } from "../src/contracts/index.ts";
import { RadioDesk, type RadioShow } from "../src/director/radioDesk.ts";
import { FakeClock } from "../src/director/fakes.ts";
import type { VoiceStatus } from "../src/director/ports.ts";

function rig(status: VoiceStatus) {
  const clock = new FakeClock();
  const shown: RadioShow[] = [];
  const played: string[] = [];
  let s = status;
  const desk = new RadioDesk({
    clock,
    text: (line) => `text:${line}`,
    langs: () => ({ textLang: "en", voiceLang: "es" }),
    status: () => s,
    play: (line, lang, pan) => played.push(`${line} ${lang} ${pan}`) > 0,
    durationMs: () => 2000,
    show: (l) => shown.push(l),
  });
  return { desk, clock, shown, played, set: (n: VoiceStatus) => (s = n) };
}

Deno.test("radio holds a voiced line until its audio arrives", () => {
  const r = rig("loading");
  r.desk.say(lineId("rad_drone_patrol_001"), "scout", -0.5);
  r.desk.update();
  assertEquals(r.shown.length, 0);
  r.set("ready");
  r.clock.t = 300;
  r.desk.update();
  assertEquals(r.played, ["rad_drone_patrol_001 es -0.5"]);
  assertEquals(r.shown[0].pan, -0.5);
  assertEquals(r.shown[0].source, "text:radio.callsign.scout");
  assert(!r.desk.free, "busy while the line plays");
  r.clock.t = 300 + 2000 + 2500;
  assert(r.desk.free);
});

Deno.test("text-only radio ids never touch the voice", () => {
  const r = rig("ready");
  r.desk.say(lineId("radio.drone.patrol.1"), "scout");
  assertEquals(r.played, []);
  assertEquals(r.shown[0].text, "text:radio.drone.patrol.1");
});
