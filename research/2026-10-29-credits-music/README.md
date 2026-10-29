# Credits music: silent under the end crawl

**Framing question.** Adam's playthrough (October 29, 2026): the credits
music feels missing. `research/2026-10-29-warden-defeat/` measured the
music stem going silent the moment `credits` starts, on the old and the new
endings alike, and left the cause open. Why, and what plays there instead?

Disciplines: audio engineering (Web Audio context lifecycle, bus ducking),
front-end state (what a "pause" means), and QA instrumentation (proving
silence from stems, not from the picture).

## Root cause

Not the manifest or a cue id. The credits crawl is a router screen, so
`frontEnd.isSimRunning()` turns false while it rolls. The frame loop in
`src/main.ts` treated that like the pause menu: it stopped the Director's
clock **and suspended the AudioContext**. `music("ending")` had just
started, then the whole context froze for the crawl's duration (minutes);
sound came back only when the crawl ended and the timeline faded to silence
for the sting line. Every route that reaches the crawl was affected.

A second, latent problem: `ending` resolves (`MUSIC_FALLBACK`) to the kill
ending's take, a 45 s one-shot with no loop region, which would run out
under the crawl even with the context running, and it is the kill take on
the pacifist route too.

## Fix

- `pauseScope` (`src/app/clock.ts`): the crawl pauses the sim and the clock
  but not the audio. The front end reports `credits.rolling()` while the
  crawl screen exists (cleared on dispose, so a quit mid-crawl cannot leave
  a later pause menu audible).
- New `credits` music cue (`MusicCueId`), played with a 2.5 s crossfade
  before the crawl. No credits track exists, so `MUSIC_FALLBACK.credits` is
  `menu`: the looping title theme, which the crawl hands back to. Audition
  it through the existing `music.menu` axis (`?v.music.menu=cand2`); a
  `credits` entry promoted into `public/music/manifest.json` would win
  without code changes. The ending stage preloads it.
- Ducking is unchanged: no VO speaks during the crawl, and the sting line
  after it plays once the timeline has faded music to silence.
- Main menu credits: no run, so nothing was ever suspended; the menu theme
  plays on (now asserted).

## Evidence

- `tests/credits_music_test.ts` (pause scope, looping credits cue before
  the roll, manifest override), `tests/qa_audio_test.ts` (`visibleWindows`).
- QA `av.musicDuring`: the music **bus stem** must be audible for 90% of the
  time a selector is visible (after a fade-in, before the capture's 1.5 s
  silent tail that every stem, the mix included, ends with).
- Control (crawl exemption disabled, otherwise identical):
  `qa/reports/20261029-133544`, ending-kill: 0 of 8.54 s audible.
- After: `qa/reports/20261029-133710`: ending-kill 8.54 of 8.54 s,
  ending-pacifist 8.53 of 8.53 s, menus-en/es/zh about 4.7 of 4.7 s.
  Remaining failures there are earlier debt, unchanged: ending-kill
  `kill_ai_004` VO drop on the skip-to path and ending-pacifist's zero-kills
  assertion (both in the warden-defeat README).

## Next step

Listen: the menu theme under the crawl is a placeholder choice by fallback,
not by ear. If it jars after the kill ending, brief and promote a dedicated
`credits` cue (`music/cues.yaml`, `music/promote.py`).
