# Wave 4 brief (October 28, 2026, after Adam's first playtest)

Read with `AGENTS.md`, `docs/WAVE3.md`, `docs/INTEGRATION-QUEUE.md`.

## Adam's playtest notes

- The original tutorial AI voice (the "girlish" one) actually works in
  context: KEEP it. The captain recast stays as an alternative. Decide by
  A/B testing in context, with music, not by auditioning in isolation.
- A/B testing for "best voice in context" and similar choices; he wants to
  hear everything with music.
- Bug: in onboarding, when he first had to destroy an enemy, a trick shot
  sent it flying off screen and the tutorial did not register the kill.
- The "your ship is not fine, but you are" style of line is hilarious. Lines
  like it should almost never repeat verbatim: many variations, so players
  wonder how much VO the game has.
- The tutorial AI (and others) should comment on the player's stats over
  time: accuracy, streaks, wasted shots fired into empty space ("into the
  mist"), energy use, grazes, disarm ratio, deaths.
- Level design needs more visual anticipation: the player should be able to
  read where things are coming from.
- Keep using the panel of judges for comparisons with high-polish games.

## Ownership (commit only your paths; never `git add -A`; never push)

| Agent                         | Owns                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P Gameplay and tutorial logic | `src/sim/`, `src/pilots/`, `src/scenes/*.timeline.ts` logic and triggers, `src/director/` commentary scheduler, `src/contracts/sim.ts`, `src/contracts/timeline.ts`, tests for these |
| W Writing                     | `vo/script.yaml` text fields, `src/scenes/banks/` (new: variant and commentary banks as data), `docs/narrative/`, `src/i18n/` except `ui.ts`                                         |
| B A/B, music and mix          | `src/audio/`, `music/`, `public/music/`, `public/vo/variants/`, `qa/` A/B reels and judge, `src/contracts/flags.ts`, `deno.json`                                                     |
| C Closing fixes               | `src/ui/`, `src/render/`, `src/i18n/ui.ts`, `src/settings/`                                                                                                                          |
| L Level design research       | `research/2026-10-28-level-design/` only (no code)                                                                                                                                   |
| T VO tech (running)           | `vo/render.py`, `vo/voices/`, `vo/casting/`, `vo/out/`, `public/vo/` base files                                                                                                      |

Cross-agent needs: append to `docs/INTEGRATION-QUEUE.md` under "Wave 4".
Before reporting: `deno task ci` and the relevant reels in the foreground,
report path cited. Long jobs in the foreground; never end a turn while your
own job runs.
