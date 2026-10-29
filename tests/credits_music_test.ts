/**
 * Credits music (Adam's playtest, October 29, 2026: "credits music feels
 * missing"). Two causes, one test each: the crawl paused the run, and the
 * pause suspended the AudioContext; and the credits asked for `ending`, a
 * 45 s one-shot that would run out under a crawl of minutes.
 */

import { assert, assertEquals } from "@std/assert";
import { pauseScope } from "../src/app/clock.ts";
import { type MusicManifestFile, musicTracks } from "../src/audio/manifests.ts";
import { STAGE_CONTENTS } from "../src/audio/engine.ts";
import { credits } from "../src/scenes/credits.timeline.ts";
import { FLAGS } from "../src/scenes/flags.ts";

const manifest = JSON.parse(
  await Deno.readTextFile(
    new URL("../public/music/manifest.json", import.meta.url),
  ),
) as MusicManifestFile;

Deno.test("the credits crawl pauses the sim and clock, not the sound", () => {
  const crawl = pauseScope({
    inRun: true,
    simRunning: false,
    creditsRolling: true,
  });
  assertEquals(crawl, { clock: true, audio: false });
  // A pause menu over play still silences everything.
  assertEquals(
    pauseScope({ inRun: true, simRunning: false, creditsRolling: false }),
    { clock: true, audio: true },
  );
  // Play, and the front end outside a run (main menu credits included).
  for (const inRun of [true, false]) {
    assertEquals(
      pauseScope({ inRun, simRunning: inRun, creditsRolling: false }),
      { clock: false, audio: false },
    );
  }
});

Deno.test("the credits play a looping cue, faded in, before the crawl", () => {
  const firstMusic = credits.cues.findIndex((c) => c.type === "music");
  const roll = credits.cues.findIndex((c) =>
    c.type === "setFlag" && c.flag === FLAGS.creditsRoll
  );
  const cue = credits.cues[firstMusic];
  assert(cue?.type === "music" && cue.cue === "credits", "credits cue");
  assert((cue.fadeMs ?? 0) >= 1000, "fades in rather than cutting in");
  assert(firstMusic < roll, "music starts before the crawl rolls");

  const track = musicTracks(manifest).get("credits");
  assert(track, "the shipped manifest resolves `credits` to a file");
  assert(track.loop, "a looping track: the crawl outlasts any one-shot");
  assertEquals(track.src, musicTracks(manifest).get("menu")?.src);
  assert(
    STAGE_CONTENTS.ending.music.includes("credits"),
    "the ending stage preloads the credits file",
  );
});

Deno.test("a credits pick in the manifest replaces the borrowed menu bed", () => {
  const own = { src: "music/credits/cand1.ogg", loop: true };
  const tracks = musicTracks({ cues: { ...manifest.cues, credits: own } });
  assertEquals(tracks.get("credits"), own);
});
