# Warden defeat: using the whole frame after health zero

**Framing question.** Adam's playtest note (October 29, 2026): after the
Warden's health reaches zero the sequence feels under-animated and parts of
the screen go unused. Where exactly, and what staged defeat (kill) and
withdrawal (pacifist) fix it, without new hazards, inside the low-tier
budget, skippable and localized?

Disciplines in play: cinematography (composition, shot length), game feel
(hitstop, impact frames, causal chains), sound design (ducking, silence as a
beat), environmental storytelling (the arena reacting), accessibility, and
the narrative's moral turn (the Authority's tollgates arriving in the quiet).

**Viewer:** [index.html](index.html) (serve the folder, for example
`python3 -m http.server`, so the judge JSON loads). One clip at a time,
evidence revealed after watching.

## Revisions and captures

| What | Revision | Report |
| --- | --- | --- |
| Before (game code) | `77a7ce0` plus the QA-only speed hook (no render change) | `qa/reports/20261029-072423` |
| After, first pass | `c6340d7` | `qa/reports/20261029-075237` (kill, pacifist, low) |
| After, second pass (clips in viewer) | `4601072` (captured from the identical working tree before commit; the commit adds a lint rename) | `qa/reports/20261029-080620` |

Capture: Playwright 1280x720, real audio tap (mix, VO, music, sfx stems),
seed 121. New reels `warden-defeat-kill`, `warden-defeat-pacifist`,
`warden-defeat-low` fast-forward the fight with the autopilot and call the
QA-only `__nwqa.setSpeed(1)` before the decisive tick, so everything from
health zero to the ending text runs at 1x with hitstop on. Clips in
`clips/` are cut from those reels (854 px, health zero minus 0.6 s to the
tally plus 1.5 s). Pacifist "before" slowed down early (the parley holds the
Warden's age); the reel now keys on phase 3, which does not change the
clip's content.

## Diagnosis (before)

Annotated stills are in the viewer. Seconds from health zero.

Kill: 0–1.2 eight chained blasts and a flash; 0–6.4 the dying line over a
centred close-up of an **intact, shielded Warden with all pods on**; 7.1
WARDEN DOWN; 11–44 a wide shot in which **the sector world is switched off**
(`rig.currentShot === "gameplay"` gated it), about 80% black starfield;
18.4 `ending.tollgates` fires and **nothing draws it** (no renderer
consumer existed); 44.4 tally. Roughly 37 s of one unchanging frame.

Pacifist: 0 the sim withdraws the Warden off the top edge; 0–25.9 the
close-up keeps aiming where it went: **black frame under five lines**;
25.9–35.1 a ship close-up blown out by engine bloom; 35.1 LANES KEPT and the
same empty wide; 49.7 tally.

## What changed

`src/render/wardenFinale.ts` (new, one module, render-only) takes the
Warden's model at the outcome and stages the picture of the sim's decision.
Beat timelines (measured, `4601072`):

**Kill.** 0.0 hard cut to a composed low three-quarter (`wardenFall`) on a
white impact frame, 9-tick hitstop, music out with an 18 dB duck. 0.3–1.3
pods tear off in sequence and fly out along their sockets (debris field).
0.5–2.4 seams overload, groan at 0.9. 1.7 and 2.2 the heart crest cracks.
2.35–2.75 core surge, then collapse. 2.75–4.4 a shockwave ring crosses the
lane and leaves into Last Approach; buttress and nursery lights fail one by
one as it passes (per-copy `setCopyGlow`), scouts lose power and drop, relay
clicks. 4.4 settled wreck, quiet. 4.8–11.2 dying line on a slow push-in,
halo rings dark at about 5.9 and 8.6. 11.9 WARDEN DOWN, music, wide over the
dark world. 23.2–27.6 silence, then tollgates rise along both lane edges,
across the sky and in the side regions, a clank as each locks. 27.6–50.3
service line, epilogue, payroll on a slow dolly. 51.8 tally.

**Pacifist.** 0–1.6 no impact: composed wide, shield lowered, pods folded,
intact; a red recall tether to a beacon pinging upper right. 1–7 scouts
gather on the open side to listen. 2.2–19.2 the Warden's lines on a slow
push-in. 19.2 leash cut: tether whips apart, beacon dies, Last Approach's
lights swell outward. 20.0–37.3 the offer and the reply, over the ship's
shoulder toward the Warden. 37.3 LANES KEPT, scouts form an escort, the
Warden climbs home up the open lane. 52.0 tally.

Also: the sector world stays up behind story shots; `bossCloseup`,
`shipCloseup`, `endingWide` recomposed; nine synth-only sound roles timed by
the renderer through a `sound` port (no samples, no new assets); the HUD's
skip chip appears during endings (`ui.common.skip`, already in EN, ES and
ZH) and lands the finale on its aftermath silently. No new text strings.

Low tier and accessibility: three scouts, five gates, no trails or rings;
reduced motion removes flinging, swinging, tumbling and camera pushes (parts
drift, gates stand and light in sequence); reduced flashing caps flashes at
0.35 and removes flicker. Measured on low (`warden-defeat-low`): 59 draw
calls in the fight, 51 after the collapse, 128 with tollgates up (33k
triangles); the reel bounds it at 140. Only about 14 of the extra calls are
the gates; I did not attribute the rest (likely the wide shot framing more
of the arena). Chromebook speed is not measured here.

## Blind check (Gemini 4 Argon, OpenRouter, ZDR, no fallbacks)

Neutral ids, no mechanics or intent in the prompt (`tools/blind.ts`), key in
`blind-key.json`, answers in `judge/`. Six calls, US $0.151 total, logged in
`research/SPEND.md`. Seconds the judge called empty / dead:

| Clip | Empty | Dead |
| --- | ---: | ---: |
| before-kill (clip-2) | 70 | 41 |
| after-kill v1 (clip-3) | 18 | 42 |
| after-kill v2 (clip-6) | 46 | 40 |
| before-pacifist (clip-4) | 41 | 50 |
| after-pacifist v1 (clip-1) | 37 | 47 |
| after-pacifist v2 (clip-5) | 46 | 47 |

Reading: one model, single passes. The two after-kill clips are nearly
identical, yet scored 18 and 46: the span counts are noisy and do **not**
show that the second pass improved anything. Corroborated across passes:
the after-kill clips are reconstructed as "boss flashes, goes dark, tollgates
deploy as the consequence of the victory" (the causal turn now reads); the
judge does not itemize pods or the shockwave (1-fps-ish sampling may miss
2-second staging); and **both after paths still read as static** in long
voice stretches: after the tollgates lock (about 25 s of payroll lines) and
during the pacifist speeches. Craft anchors for the concerns asked: the
Kill Sequence and Victory beats in "Boss Battle Design and Structure"
(Game Developer, gamedeveloper.com/design/boss-battle-design-and-structure),
and arena tailoring in Itay Keren's GDC 2018 "Boss Up".

## Checks

`deno task ci` passed at `c6340d7` (fmt, lint, check, 261 tests including
`tests/warden_finale_test.ts`, build). Reels at `c6340d7`/`4601072`:
`warden-defeat-kill`, `warden-defeat-pacifist`, `warden-defeat-low` pass;
`boss` passes (`qa/reports/20261029-075541`). **`ending-kill` fails** "VO not
dropped" (`kill_ai_004` silent in the VO stem, `end_epi_002` partly): bisected
to the timeline's 4.7 s opening pause alone (old timeline plus only that
pause also fails); it happens only in the `skipto=ending-kill` path, where no
Warden exists; the real path from health zero hears every line. Cause not
found. **`ending-pacifist` fails** its zero-kills assertion, as it already
did in `20261029-050318` and `vo-audit-8fcd5ab` (existing debt).

**Credits music (Adam's flag, measured):** in a skip-to kill ending with
the music stem kept, music plays through the ending (about -15 dB RMS at
55 s) and is silent from the moment `credits` starts (62.2 s) to the end of
the capture. The old timeline (`77a7ce0`) shows the same silence (music
gone from about 52 s; credits at 54.9 s), so it predates this work. The
credits call `music("ending")`, which resolves to the `endingKill` track
(`MUSIC_FALLBACK`); why it does not sound is not diagnosed here (music
owner).

## Next steps (proposed, not implemented)

- Credits music: capture with `QA_KEEP_AV=1` and log `MusicPlayer` start
  and fade calls around `scene:credits`.
- Find the skip-to VO drop (test: same reel with `QA_KEEP_AV=1` and the
  engine's `status(line)` logged per say).
- Give the long voice stretches motion that means something: the Authority
  crews working the new gates during the payroll lines; the Warden's scouts
  answering its lines in the pacifist close-up. Re-judge with a picture-only
  ablation and two passes per clip.
- Hide the HUD during story shots (score and lives sit on every ending frame).
- Hands-on: Adam plays both endings; check the skip chip on touch and on a
  school Chromebook.
