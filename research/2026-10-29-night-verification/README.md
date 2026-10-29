# Night verification: did steps 4a and 4b fix the core loop? (night plan step 5)

## Framing question

Step 2 (`research/2026-10-29-argon-core-ideation/`) verified five perceptual
failures at `8ad8598`: disarms read as kills, Warden pod breaks do not read,
Writ hit and miss sound alike and tiers blur, Writs into a deflecting Warden
sit about 1.5 dB above the mix, and a life lost on a kill tick goes
unnoticed. Steps 4a (`research/2026-10-29-core-feedback/`) and 4b
(`research/2026-10-29-movement-lane/`) changed render, audio and hitstop. Does
a fresh blind observer, scored against the event log, recognize those events
better at HEAD, and did the work cost readability?

Disciplines in play: perceptual evaluation (blind reconstruction, scoring
against ground truth), game feel and mixing (local loudness contrast), and
experimental design (matched arms, order balancing, the limits of one model).

## Short answer

Partly, and less than the step 4 notes suggest. The blind judge's recognition
of disarms, Writ tier and Writ outcome **did not measurably improve**; pod
breaks and "ordinary" life losses read better on very small samples; Writ
loudness rose a lot in sectors but **fell slightly on the armored Warden**,
the exact case weakness 4 named. In the paired comparison the judge preferred
the BEFORE build overall in 7 of 10 pairs, each time citing the new busier
lane floor. Treat this as one model's perception, at about one frame per second
(see Limitations), not a human verdict.

## Method

- **Frozen builds.** `git archive` of BEFORE `8ad8598` and AFTER HEAD
  `78eebec` (`out/REVS.txt`) into `/tmp/nw-verify/{before,after}`,
  `node_modules` symlinked, `vite build` without `vo:sync` (committed
  `public/vo` as is). Both served by `qa/capture.ts` `serve` on free ports
  (never 8123 or 4321) and driven with the AFTER tree's `qa/capture.ts` and
  `qa/av.ts`, so the harness is identical for both arms.
- **Capture.** `capture.ts` (adapted from step 4a's): 1280x720 Playwright
  Chromium, normal speed, `seed=121&qa=1`, real audio tap. Settings preseeded:
  voice 0, subtitles off (as in step 2). Five recordings per arm, identical
  scripts: `move` (direction changes, then focus with strafes, no fire),
  `tap` (60 ms presses every 400 ms while sweeping), `writ` (alternating 0.9
  s and 2.4 s rests), `ram` (stream while pushing up-lane), `boss-fight`
  (fight autopilot, `speed=1`, 80 s). All ten recordings: zero page errors,
  audio captured, true peak at or under -1 dBTP; voice bus -70 LUFS (muted);
  integrated loudness warned (below -20 LUFS) on 8 of 10, equally in both
  arms. Scripted input is real-time, and hitstop shifts AFTER timing, so the
  arms are matched in script and seed, not frame-identical.
- **Windows** (`pick.py`), chosen from the event log, never by eye: 6.5 s
  around an anchor (move: 11 s). Topics: move, tap disarm (no Writ in the 0.8
  s before), Writ 1 hit, Writ 1 miss, Writ 3 hit, Writ 3 miss, Writ into the
  deflecting Warden, first pod break, a dense moment (the AFTER arm's
  densest second of hit sounds, matched to the same sim tick in BEFORE), and
  a life lost on a kill tick. 10 pairs, 20 clips, neutral ids (`vNNN`). The
  BEFORE probe kept no per-shot events, so Writ release time and tier come
  from the `writ_release_<tier>` sample start, and a Writ is a hit when a
  kill, disarm or part break follows within 0.8 s: one rule for both arms.
  In AFTER sector recordings the rule agreed with the new `writMissed` event
  for 14 of 15 Writs.
  The AFTER Writ 1 miss had to come from the `ram` recording (every AFTER
  `writ` Writ 1 hit). Separate `deflect` (stream) windows were dropped: the
  fight autopilot always has a Writ within 1 s of a deflect.
- **Judge** (`judge.ts`): OpenRouter `google/gemini-4-argon`, `provider: {zdr:
  true, data_collection: "deny", allow_fallbacks: false}`, returned provider
  Google for all 30 calls. The same short glossary for every call (tap,
  stream, charged shot strengths 1–3, destroy versus disarm, boss parts,
  armor, lives); no topic, build, revision or design goal. **Pass A**: one
  call per clip, identical prompt: events in a fixed vocabulary with
  timestamp, strength, channel (seen, heard, both) and confidence, plus
  readability issues and speech. **Pass B**: one call per pair, X then Y, the
  AFTER arm as X in exactly 5 of 10 pairs (seeded shuffle), identical
  9-item checklist: which clip communicates each better, clutter, overall.
  Pass B never saw Pass A.
- **Scoring** (`score.py`): a truth event is recognized when the judge
  reports the matching type within 1.0 s (step 2 measured 0.3–0.8 s drift).
  All discrete events in every window are scored, not only the anchor.
  `contrast.py` measures every Writ release in four recordings per arm: the
  50 ms peak from 50 ms before to 600 ms after the release, minus the median
  of the 0.9 s before it (local, because a clip-wide median is skewed by the
  Warden intro's silence).

## Scorecard

Recognition by the blind judge (Pass A), all scored events in the 10 clips
per arm. Sample sizes are small; differences of one or two events are noise.

| Weakness (step 2) | Measure | BEFORE `8ad8598` | AFTER `78eebec` | Verdict |
| --- | --- | ---: | ---: | --- |
| 1 Disarm reads as kill | disarm reported as disarm | 6/9 (67%) | 6/15 (40%) | not improved |
| | disarm reported as a kill | 1/9 | 1/15 | both low |
| | disarm not reported at all | 2/9 | 8/15 | worse: silent misses |
| | kills reported | 4/14 | 2/16 | not improved |
| 2 Pod break unreadable | boss part break reported | 0/2 | 1/1 | better, n = 3 |
| 3 Writ hit vs miss, tier | Writ noticed | 16/21 (76%) | 19/23 (83%) | slightly better |
| | outcome right (hit or miss) | 11/21 (52%) | 13/23 (57%) | chance level both |
| | Writ 1 strength right | 2/5 | 2/7 | not improved |
| | Writ 3 strength right | 2/16 | 2/16 | not improved |
| 4 Writ above the mix | sector Writ 3 hit, local rise | 6.2 dB (n=3) | 14.6 dB (n=2) | fixed in sectors |
| | sector Writ 3 miss | 4.9 dB (n=4) | 10.4 dB (n=5) | louder (fizzle) |
| | sector Writ 1 hit / miss | 4.5 / 4.1 dB | 5.3 / 7.6 dB | miss now louder than hit |
| | **Warden Writ 3, no break** (deflect or hull) | 3.2 dB (n=29) | 2.5 dB (n=27) | **not fixed** |
| | Warden Writ 3 with a break or kill | 3.3 dB (n=9) | 2.6 dB (n=9) | not fixed |
| 5 Life lost on kill tick | reported | 4/5 | 4/5 | no change (step 2's misses did not recur in BEFORE either) |
| | other life losses | 0/1 | 3/3 | better, n = 4 |

Pass B, per checklist item, which arm communicated it better (counts over 10
pairs; "same" and "not present" omitted): movement 2 before, 2 after; disarm
versus destroy 4 before, 0 after; Writ strength 1 before; Writ hit versus miss
2 before, 1 after; life lost 1 before, 4 after (the red edge frame is
credited by name); many hits at once 2 before. Tap hit, deflect and pod break
were "not present" or "same" in every pair. Overall: **before 7, after 3**
(AFTER won Writ 1 hit, writ-deflect and dense).

## Regressions and readability

1. **The lane floor competes with combat (judge-reported, both passes).** Pass
   B named AFTER's scrolling dashed lane lines and orange, yellow or blue dots
   as clutter behind pink bullets in 9 of 10 pairs (3 medium, 6 low), and it
   was a stated reason in all 7 BEFORE wins. Countervailing: it
   credited the dashes for a sense of speed (2 pairs), and preferred AFTER's
   darker boss floor over BEFORE's orange one (writ-deflect, dense). Verify
   by luminance and saturation measurement before acting: this is a
   picture-quality claim at 854x480, not a bullet-visibility measurement.
2. **Disarms more often go unreported** (8/15 versus 2/9). The new
   power-down and fling are not perceived as a state change at the judge's
   sampling rate; and the judge leans on on-screen text for disarms in both
   arms ("RETIRED", "NEUTRAL", "PETAL" tags, the radio line "disarmed, not
   dead", which is on-screen text: the voice bus was -70 LUFS).
3. **Writs on the Warden got quieter relative to the mix** (about -0.7 dB),
   where weakness 4 asked for more. In sectors the opposite happened, and a
   Writ 1 miss (fizzle) now rises more than a Writ 1 hit: loudness alone
   cannot carry hit versus miss, consistent with outcome recognition staying
   at chance.
4. Minor, one mention each: the life-lost red rectangle "harsh" (AFTER,
   low); disarmed grey hulls drifting downward compete with targets (AFTER,
   low); a "massive" white charged-release flash obscures bullets (AFTER,
   high, once; the same flash was flagged medium in BEFORE).
5. Not a regression: the dense moment's anchor rises 0.4 dB over the clip
   median versus 1.7 dB before, consistent with step 4a's per-tick voice
   merging. No observer reported a buzz or a masked threat cue in either arm.

## Rejected claims

| Claim | Arm | Truth |
| --- | --- | --- |
| Charged shots released, hit or missed in clips with no Writ at all (`move`, tap-disarm, life-kill windows) | 25 before, 24 after | Only tap rounds (`playerFired` `aimed`, level 0) or no fire at all (move); the scan cone and tap rounds were read as "wide cyan arcs" and a "3-bar gauge emptying" |
| Pass A `move`: "fires several charged shots" | both | No fire key was pressed in `move` |
| Enemy disarmed at score or "RETIRED" popups with no disarm within 1 s | 6 before, 1 after | Kills or score ticks; text-driven guesses |
| Writ-deflect pair: "shots at 0:02, 0:04, 0:06 hit the boss" | Pass B | No kill, disarm or break follows any of those Writs; the Warden is in its intro (deflecting) |
| Pod break pair: "another part breaks off at the bottom at 5.0 s" | Pass B, both | One pod break per window, at 2.5 s; 5.2–5.3 s is a Writ kill of a small enemy |
| "Identical audio cues" for charge and impact in both builds | Pass B, several | AFTER adds synthesized `writ_impact` tiers, `ricochet_tink` and `writ_miss`; a perceptual "same", not code identity |
| "Disarmed, not dead radio callout" (as if heard) | Pass B | Voice bus muted (-70 LUFS); that line is radio text on screen |

No speech was claimed in any Pass A clip.

## Limitations

- **One frame per second.** Prompt usage (about 1,800 tokens per 6.5 s clip)
  matches Gemini's default 1 fps video sampling plus audio. Hitstops of 2–7
  ticks, 30 ms flashes and sub-second debris can fall between samples, so
  this judge is biased against brief visual cues and toward on-screen text
  and audio. A human, or a higher-fps judge configuration, is needed before
  concluding the fling and power-down are invisible.
- One model, two passes: not a panel and not players. Small n per weakness.
  The arms are separate real-time runs: moments match by script, seed and
  topic, not frame for frame. Mac viewport; nothing here speaks to
  Chromebook performance or hands-on feel.
- Life lost on a kill tick read well in both arms (4/5), unlike step 2; the
  BEFORE baseline is therefore not reproducing that weakness here, and this
  test cannot credit the fix.

## Three most valuable next fixes (each with its test)

1. **Shot identity in shape, not only sound.** The judge read tap rounds and
   the scan cone as charged Writs about 25 times per arm and named Writ 3's
   strength 2 times in 16 in both builds. Make tap rounds, Writ 1 and Writ 3
   differ in silhouette, length and wake (step 2 Argon idea 1), and keep the
   scan cone from resembling a shot. Test: rerun this Pass A on `writ` and
   `tap` windows; target strength right at least 50% and charged claims in
   Writ-free clips near zero.
2. **Writs on the armored Warden.** Local rise 2.5 dB (n=27). Give a blocked
   Writ its own tier-scaled glancing impact that is not merged into the
   stream's deflect voices, and duck music on it as on sector hits. Test:
   `contrast.py` on `boss-fight`, target at least 6 dB (the BEFORE sector Writ
   3 level), with no rise in clip loudness warnings.
3. **Calm the lane floor's high-contrast marks.** Lower the value and
   saturation of the dashes and dots (keep slow, low-contrast motion for
   speed), keeping pink bullets the brightest small objects. Test: a
   picture-only Pass B on the same pairs plus a measured luminance ratio of
   bullets to floor features.

Close behind: a disarmed state that persists for at least half a second
(lasting dark silhouette, a visibly separate tumbling part) so a 1 fps
observer, and a glancing player, can catch it.

## Files

- `index.html`: the viewer, one clip at a time in the judge's pair order;
  reveal (build, topic, scored truth, blind account, event log, the pair's
  overall verdict) unlocks after the clip ends.
- `capture.ts`, `pick.py`, `judge.ts`, `score.py`, `contrast.py`,
  `viewer.py`: the pipeline, in order.
- `out/REVS.txt` (frozen revisions), `out/rec/<arm>/<clip>/` (recordings
  and truth), `out/clips/` (20 clips), `out/key.json` (the arm and topic key,
  never shown to the judge), `out/judge/` (raw responses and parsed JSON,
  `pass-a-meta.json`, `pass-b-meta.json`), `out/score.json`,
  `out/contrast.json`. `out/` is about 72 MB, mostly the full recordings.

## Spend

30 calls, US $0.455888 (Pass A $0.302704 for 20, Pass B $0.153184 for 10),
logged in `research/SPEND.md`. Budget US $1.00.
