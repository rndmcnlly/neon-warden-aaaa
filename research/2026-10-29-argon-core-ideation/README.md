# Argon core-loop ideation: MOVE, SHOOT, DAMAGE (night plan step 2)

## Framing question

What does an isolated, blind observer (Gemini 4 Argon) actually perceive of
our core loop at HEAD, moment by moment, and once told the design goals, what
concrete audio-visual changes does it propose? Which of its perceptions hold
up against the event log and the captured audio, and how do its ideas line up
with step 1's 12 ranked ideas (`research/2026-10-29-av-core-loop/`, which the
judge never saw)?

## Method

- **Frozen build.** `git archive` of HEAD `8ad8598` (see `out/HEAD.txt`) into
  `/tmp/nw-argon-core/tree`, `node_modules` symlinked, Vite build without
  `vo:sync` (the archive's committed `public/vo` was used as is). Served by
  `qa/capture.ts` `serve` on a free port, never 8123 or 4321.
- **Capture.** `capture.ts` (this folder) reuses `qa/av.ts` (the real
  speaker tap, `installAv`/`finishAv`) and Playwright 1.58.2 Chromium at
  1280x720, normal speed (`speed=1` for autopilot runs, real time for
  scripted runs), `seed=121&qa=1`. The reel `Step` DSL can only tap keys, so
  the driver holds keys itself. A page-side poller logs probe events (by
  object identity) and the shot counter; `qa/av.ts` logs every buffer start
  with its URL. Truth per recording: `out/recordings/*.truth.json`; per clip,
  windowed: `out/truth/clip-*.txt`. `timeline.py` prints either.
- **Lore suppression.** No URL flag exists. Settings were preseeded: voice
  volume 0, subtitles disabled. VO buffers still start (they are timeline
  clocks) but the voice bus measured -70 LUFS. **The radio text channel
  (top left) still shows** ("SCOUT CHANNEL: Drift Two is dark", "LENS
  CONTROL: ..."), and Codex toasts and the sector banner remain.
- **Flashback.** The first pickup in a sector run starts the flashback, which
  freezes play for about 57 s and cannot be skipped or disabled by flag.
  The first sector 1 autopilot recording (`writ-auto`) was lost to it at
  2.9 s; the sector 4 run was recorded for 150 s and cut after play resumed.
  Boss runs skip it (`flashbackPlayed` is preset for `boss`).
- **Difficulty.** Scripted (manual) clips used `story` difficulty so an
  unarmed or sweeping ship survives; it still lost lives to rams.
- **Judge.** `argon.ts`, OpenRouter `google/gemini-4-argon`, `provider: {zdr:
  true, data_collection: "deny", allow_fallbacks: false}`, returned provider
  Google. All eight clips in one call per pass, labeled A–H in a shuffled
  order with no topic names. **Pass A** (blind): describe actions, hits,
  feedback, weaknesses, speech and on-screen text, with timestamps, channel
  (seen/heard/both) and confidence; no mechanics or goals. **Pass B**
  (separate call, same clips): a short mechanics glossary plus Adam's night
  goals; asked for specific MOVE, SHOOT, DAMAGE and LANE ideas and what not to
  do. Neither call saw step 1's ideas, and Pass B did not see Pass A.
- **Verification.** `verify.py` probes each suspicious Pass A claim: sound
  starts within 0.6 s and the mix's 50 ms peak versus the clip median.
  Verdicts per clip: `verdicts.json`.

Open `index.html` (this folder) for the one-clip-at-a-time viewer: watch,
then the verdicts, the blind account and the truth unlock.

## Snippets

| Clip | Topic                | Source recording, window | How driven                                  |
| ---- | -------------------- | ------------------------ | ------------------------------------------- |
| A    | dense                | `dense` 69.0–82.0 s      | sector 4→5, fight autopilot                 |
| B    | move + focus         | `move` 3.3–15.5 s        | scripted keys, no fire, focus 7.3–10.0 s    |
| C    | Writ 1 and Writ 3    | `writ` 7.2–19.2 s        | scripted rests of 0.9 s and 2.4 s           |
| D    | boss pod breaks      | `boss-disarm` 47–59 s    | pacifist autopilot on the Warden            |
| E    | tap                  | `tap` 4.4–16.4 s         | scripted 60 ms presses every 400 ms         |
| F    | sector parts, disarm | `dense` 61.0–69.3 s      | fight autopilot: emitter break, 2 turrets   |
| G    | stream               | `stream` 4.4–16.4 s      | scripted 3 s holds, 0.45 s releases         |
| H    | deflects vs pod hits | `boss-parts` 35–49.5 s   | fight autopilot, deflects then two pods     |

Every clip has audio with no silence over 0.5 s at -50 dB; recordings had
zero page errors; every recording passed true peak at or under -1 dBTP.
Coverage notes: clips are 8.3–14.5 s; drones die or disarm to one hit, so a
true "armor versus weak point on one hull" contrast exists only on the boss
(deflect versus pod hit, clip H). The autopilots toggle focus many times per
second, which is a pilot artifact a human would not produce (and its focus
sounds may chatter in A, D, F, H). Capture pacing was not measured; the Mac
viewport says nothing about Chromebook speed.

## Verified observations (Pass A against truth)

Confirmed and useful, in order of weight:

1. **Disarm reads as kill.** Clip E had six gun-part breaks that disarmed
   drones (0.35, 3.27, 7.11, 9.69, 10.44, 11.89 s); the judge described every
   one as an enemy vanishing. In F, two turret barrel breaks with disarm
   (5.36 s, 11 bullets cancelled; 6.94 s) were reported as "crisp explosions",
   and the lancer emitter break at 1.60 s was not mentioned. Not once did it
   see a part come off.
2. **Boss pod breaks are unreadable.** D: the left fan pod broke at 3.33 s,
   the loudest moment of the clip (mix peak -15 dB, 10 dB over median), and
   the judge wrote "core scanned, not shot; only background music". H: the
   cannon pod (7.64 s) and spiral pod (12.72 s) were heard only as "a harsh
   screech" (the boss roar for the phase change), never as a part lost.
3. **Writ hit and miss sound alike; levels blur.** The release layer plays at
   the press; impact layers (hit, part break, disarm) follow 0.2–0.33 s later
   and only on a hit. The judge flagged this independently in C and F. It
   never separated Writ 1 from Writ 3 (C had four level-3 and three level-1 Writs).
4. **Writs into a deflecting boss feel silent.** H 0.43 and 2.43 s: a Writ 3
   release and six to eleven deflect voices start, but the mix rises only 1.5
   dB over median; the judge heard nothing. Deflection is not legible.
5. **Life losses that coincide with a kill vanish.** Missed: E 8.34 s, G 8.25
   s (both ram kills on the same tick), C 6.17 s; C 9.86 s was misread as a
   Writ hit. Caught: B 9.63, E 2.51, G 2.49 s.
6. **Stream's own sound is quiet** (8–10 voices per second, about +3.5 dB):
   consistent with Adam's "stream plainer", so a feature, not a defect, as
   long as precision payoffs rise above it.
7. **Focus and scan cues are subtle:** both exist (synth voices) but sit 4–5
   dB over the mix; the judge heard neither.
8. **Seen and corroborated by frames:** the sector banner ("Last Approach")
   sits over the lane at A 4.5 s; the lane floor is a nearly flat blue or
   red-orange slab.

No speech was claimed in any clip, and radio text was reported as on-screen
text, not as speech: no subtitle leakage this time (voice was muted, so this
is a weak test of hearing). Judge timestamps drift 0.3–0.8 s.

### Rejected or downgraded claims

| Claim (Pass A unless noted)                                     | Truth                                                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| H 0.2, 2.0 s: huge rings with "zero audible sound"              | Writ 3 release plus 6–11 deflect voices start; quiet (+1.5 dB), not silent                     |
| B 6.1 s: scan completion has "no audible chime"                 | Lock-confirm and intel synth voices start at the 6.23 s lock (+4.8 dB)                         |
| D 3.0 s: "core scanned, not shot; only background music"        | Writ 3 hits at 2.81 s, Writ 1 at 3.08 s, fan pod breaks at 3.33 s, loudest moment of the clip  |
| C 9.6 s: "large shot hits an enemy, loud blast"                 | `hit_player` and `life_lost` at 9.86 s; the Writ came at 10.58 s                               |
| E: every target "vanishes" or is "picked off"                   | Six of ten were disarms, not kills                                                             |
| B: focus switch has "no sound change"                           | A focus synth voice starts; subtle (+3.7 dB), not absent                                       |
| Pass B: "harsh, clipping noise bursts" at D 6 s, 11 s and H 8 s | True peak at or under -1 dBTP in every recording; the sound is the boss roar (harsh, unclipped) |
| Pass B: "switching focus happens silently"                      | As above: present, quiet                                                                       |
| Pass B: parts trigger floating "DISARMED / PARTIAL" text        | Not in Pass A's on-screen text; "Partial deliverable" is a radio line. Unverified, likely conflated |

## Argon's ideas (Pass B, as ranked by Argon)

Raw: `out/pass-b.json`. Specifics are Argon's; none is tested.

1. **SHOOT: three-tier shot hierarchy.** Tap: 40 ms muzzle diamond (1.5x
   ship width), 120 ms tapered ribbon; sound 8 ms 2.5 kHz click + 70 ms 350 Hz
   body + 90 ms air tail, ±30 cents, and a subtle harmonic rise when presses
   are spaced over 180 ms (rewarding rhythm over spam). Writ 1/2/3: length
   1.5x/2.2x/3.0x, one to three wake rings over 180 ms, a charge ring on the
   ship that locks at each tier with chimes at 500/750/1125 Hz (-12 dB);
   release a 15 ms 110→55 Hz sub drop + 180 ms brassy chord body + 350 ms
   shimmer tail at level 3. Stream: thin 65% opacity dashes, no muzzle flash,
   600–1200 Hz band-passed pulse 8 dB under taps, two voices maximum.
2. **DAMAGE: physics-driven part severing.** Freeze the severed piece 25 ms
   with a seam slash normal to the shot; linear velocity 80% along the shot +
   20% outward (12–18 units/s); angular velocity from `cross(hitOffset,
   shotDir)`, 360–900 deg/s; desaturate to 35% saturation, 45% value, 70%
   opacity and sink 1.5 units toward the floor over 650 ms so it passes under
   bullets; 6–10 sparks in a 35° cone (220 ms); a cool-blue fizzle on the
   disarmed hull as it banks away. Sound: 12 ms 3.2 kHz shear + 110 ms 450 Hz
   clank + 250 ms 900→220 Hz servo power-down, panned, three voices maximum.
3. **DAMAGE: density-scaled readability and deflection.** 30 ms rim flash on
   the struck part only plus a 4-particle chevron (90 ms) instead of additive
   hit spheres; amber fracture lines on parts at 50% and 25% hp; deflections
   as a flat hexagonal ripple plus the shot ricocheting off at 45–70° in muted
   slate blue (140 ms), with a 15 ms 1.8 kHz "tink" and an 80 ms 1.4→0.6 kHz
   fall. Cap hit voices at 4 per 50 ms; over 3 hits per 100 ms duck by 4 dB
   and step pitch up 40 cents per consecutive hit on one target (clamped,
   about +300 cents).
4. **MOVE: RCS puffs, bank, focus tightening.** On acceleration or reversal,
   5–8 stretched triangles from the opposite nozzle, pale cyan at 60%, 110 ms,
   within 0.8 ship widths; 12–18° roll into motion with a 90 ms spring-back;
   focus pulls the guide lines in 25%, a 2 px perimeter ring and four micro
   vents. Sound: 35 ms 1.5–4 kHz air burst at -14 dB panned to ship x; a
   160–320 Hz hum whose cutoff follows speed; focus a 60 ms filter sweep with
   a soft click.
5. **LANE: sub-surface conduit traffic.** Value at most 32%, saturation at
   most 40% (navy to muted teal; maroon to burnt umber at the boss). One
   multi-UV shader: etched conduit grid at 1.0x scroll, 4–6 traffic lanes of
   6–12 data-packet quads at 15% opacity at 1.6x both ways, and soft
   projected reflections under ship, Writs and boss core at 20%. A dim
   sub-surface pulse down the nearest conduit on a Writ or disarm (15%
   additive, 300 ms); a 65–120 Hz conduit swell on sector changes and the
   boss descent. A reduced background motion toggle.

What Argon says **not** to do: full-screen red damage vignettes or
unclamped white blooms; rich bass, shake or bright muzzle flash on stream;
full-brightness debris on the bullet plane; small circular or pink, magenta
or orange particles anywhere outside enemy fire; physics debris with
collisions, dynamic lights or over 50 alpha particles per hit (use kinematic
`pos += vel*dt`, `rot += angVel*dt`, instanced meshes); unlimited voices or
unattenuated high-frequency hit bursts.

## Comparison with step 1's 12 ideas

| Step 1 idea                                   | Argon                                                          | Relation                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Velocity-driven engine bed                  | 4: 160–320 Hz hum, cutoff by speed                             | Agree; Argon's band sits an octave above step 1's 80–160 Hz idle                                                                              |
| 2 Acceleration RCS puffs + chuffs             | 4: opposite-nozzle puffs, 35 ms air burst                      | Strong agreement; Argon: 5–8 triangles, 110 ms, -14 dB versus step 1's 2–4 puffs, 120–200 ms, -18 dB                                           |
| 3 Hit-confirmation ladder as data             | 1 (shot tiers) and 3 (hit/deflect)                             | Partial: Argon ladders the shots, step 1 the hits; neither covers both. Verified finding 1–3 says the hit side is where we fail               |
| 4 Impact voice manager                        | 3: 4 voices per 50 ms, -4 dB duck; don't: unlimited voices     | Agree; Argon novel: rising +40 cent contour per consecutive hit on one target (step 1 scales one cluster voice)                               |
| 5 Progressive damage states                   | 3: amber fracture lines at 50% and 25%                         | Agree on states; **disagree on look**: Argon glowing amber cracks, step 1 dark scorch, spark spits, smoke (matte, below bullets)               |
| 6 Shards on part break                        | 2: severed part with impulse and torque                        | Agree and Argon goes further on Adam's fling and spin (cross-product torque, sink under the bullet plane, 25 ms seam freeze)                  |
| 7 Ricochet for blocked hits                   | 3: hexagonal ripple, 45–70° ricochet, tink                     | Strong agreement; verified finding 4 (silent deflects) supports it                                                                            |
| 8 Stream loop/tail, tap one-shot, Writ sub    | 1: tap click/body/tail, Writ sub drop, stream -8 dB, 2 voices  | Strong agreement; Argon novel: harmonic rise for spaced taps and per-tier charge chimes (we already have `charge_pip` and `writ_chord` voices) |
| 9 Hitstop ladder with crowd rule              | none (only a 25 ms freeze of severed parts)                    | Gap in Argon                                                                                                                                   |
| 10 Localized flash, not full-body white       | 3: 30 ms rim flash; don't: unclamped blooms                    | Agree                                                                                                                                          |
| 11 Banking, trail and focus tied to motion    | 4: 12–18° roll, 90 ms settle, focus tightening                 | Agree                                                                                                                                          |
| 12 Permanence on the Warden                   | none                                                           | Gap in Argon                                                                                                                                   |
| (none)                                        | 5: lane conduit traffic, reflections, event pulses             | Novel (Adam's lane request postdates step 1)                                                                                                  |
| (none)                                        | 2: cool-blue fizzle on the disarmed hull leaving               | Novel: a persistent "this one is harmless now" state, aimed at verified finding 1                                                             |
| (none)                                        | don't: no pink, magenta, orange or circular VFX particles      | Novel as a palette rule; step 1 has the narrower "shards never cyan or pink"                                                                  |
| 6 "shards never cyan or pink"                 | 2: cyan-white seam slash at the break                          | Mild disagreement: a 25 ms flash, not a lingering shard, but it is the bolt colour family                                                     |

## Status

- Done: frozen capture of 8 audio-verified clips, both Argon passes,
  verification against event and sound-start truth, viewer, comparison.
- Not done: no audio-only or picture-only ablation (speech was muted, so
  subtitle leakage was not a live risk; the hearing claims were checked
  against sound starts and mix level instead). No stems were retained, so
  "quiet" is measured on the full mix around each moment, not per bus.
- Spend: Pass A US $0.085360, Pass B US $0.055052, total **US $0.140412**
  of the US $1.00 budget (`research/SPEND.md`). Raw responses in `out/`.

## Next step

Step 3 synthesis. The verified failures point at DAMAGE first: make a part
break and a disarm visibly different from a kill (Argon 2 with step 1's 6 and
the hull fizzle), give deflects a ricochet (step 1 7, Argon 3), and separate
Writ hit from miss and level from level with a delayed impact layer louder
than the release. Then a fresh blind pass on before/after clips (step 5),
which should also re-ask the disarm-versus-kill question explicitly.
