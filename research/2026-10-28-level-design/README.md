# Level design: anticipation, landmarks and pacing (October 28, 2026)

Agent L, wave 4. Research only: no code was changed.

## Framing question

Adam, after his first playtest: "visually there needs to be a little more
going on with the level design so I can anticipate where things are going."
What do great shmups and lane games do so the player reads where threats come
from, and what is the cheapest set of changes that gives our five sectors
that readability plus a sense of place, without breaking the low-tier
Chromebook and portrait-mobile targets (AGENTS.md, Platforms)?

Disciplines in play: level design (spatial grammar, pacing), visual
communication (semiotics of warning signs: shape, color, motion), game audio
(spatial and beat-quantized cues), real-time rendering cost, and pedagogy
(students will read `waves.ts`).

## Sources and method

- Ours: frames from `research/2026-10-28-moments/captures/fight-s1` and
  `fight-s3` (`ours/`, contact sheet `ours/contact.jpg`), the latest QA sheet
  (`ours/sheet-gameplay-fight.jpg`, from `qa/reports/latest/reels/`), and code
  reads of `src/sim/waves.ts`, `src/sim/enemies.ts`, `src/render/backdrop.ts`,
  `src/render/stage.ts` (`chooseLook`).
- Comparators: 61 official Steam store screenshots (DoDonPachi Resurrection,
  Radiant Silvergun, Ikaruga, Sky Force Reloaded, Thumper, Rez Infinite,
  Ex-Zodiac, CYGNI, Returnal) in `comparators/`, index `side/comparator-index.jpg`.
  Fetched by `scripts/fetch_comparators.py` (storesearch plus appdetails, JPEG
  header checked, never executed). Tetris Effect frames already live in
  `research/2026-10-28-critique-visual/comparators/`.
- Side-by-sides (ours left): `side/01`–`08`, built by `scripts/compose.sh`.
- Pacing measured from the live data: `scripts/pacing.ts`, output `pacing.txt`.
- Independent judge on pairs 01, 02, 04: `judge.json` (scores from
  `liquid/d1.1` on OpenRouter via `decide`; prose from `tinfoil/gemma4-31b`,
  since no OpenRouter `generate` model accepts images in this harness).
  Logged in `research/SPEND.md`: about US $0.0001 OpenRouter, under US $0.01
  Tinfoil.
- Game facts: Wikipedia extracts trimmed in a script and summarized by a
  sub-model (raw pages never entered this context). The extracts were thin on
  craft detail, so claims below marked **(craft knowledge)** come from
  general genre knowledge, not a source fetched this session. Verify before
  quoting them to students.

## Diagnosis

1. **All five sectors are the same place.** `chooseLook` in
   `src/render/stage.ts` picks among `sector | boss | flashback | ending |
   hangar`; it never keys on the sector number, and the backdrop (nebula,
   three star layers, two edge rails, distant pylons) is one kit. Outer
   Drift and Last Approach are visually interchangeable. Judge "sense of
   place": ours 1.05–1.19 against comparators 2.29–2.53 (1–5 scale; the model
   compresses toward the middle, so read the gap, not the absolute).
2. **Threats have zero lead time.** Every spawn appears at `ENTRY_Y = -30`
   (just above the top edge) or a side wall, on the tick it is scheduled.
   Only the Warden gets a warning (`BOSS.warningTicks = 200`). The data to
   warn already exists: `sectorSchedule(plan)` is pure and deterministic, so
   the renderer could know every arrival a full sector in advance. This is the
   single biggest gap and also the cheapest to fix.
3. **Set dressing never touches play.** Rails sit at the edges and pylons
   far below; nothing on screen previews a lane, a wall, an emplacement or a
   hatch. Lancers burst from bare side walls; turrets descend out of nothing.
   Judge "set dressing previews the action": ours 1.26–1.65 against
   2.77–2.97, the widest gap measured. Compare `side/02` (Radiant Silvergun:
   the architecture is the lane) and `side/01` (Sky Force: the facility core
   and plating tell you where fire comes from).
4. **Pacing is a uniform sawtooth.** From `pacing.txt` (weighted spawn
   density per 2 s bin):

   ```
   S1 |+  * *  % @.   |   S2 |* *  %% #%  @    |   S3 |- = +  +.@  %     |
   S4 |*  # @*  *@  @    |   S5 |#+: ++ ++  @ #     |
   ```

   Every sector is five to eight evenly spaced pulses with 3.5–6 s rests and
   an 8–10 s empty tail while the sim waits for `minTicks`. There is no
   intro, no set piece, no breath before a climax, and Last Approach does not
   have a different shape from Outer Drift, only more ships. Tension and
   release exist at the scale of one wave, not of a sector.
5. **Micro-telegraphs are good; macro-telegraphs are missing.** The enemy
   state machines already have readable wind-ups: drone `aim` before `fire`,
   dart `drift → aim → dive` with the thruster flare at the commit tick,
   turret `descend → aim`, lancer `strafe → aim`. The ladder is: (macro)
   where will they come from? (missing) → (meso) which lane will they occupy?
   (missing) → (micro) when will this one shoot? (present). Fix the top two
   rungs.
6. **Stills underrate the problem.** The judge scored "can you anticipate
   where threats come from" nearly even (ours 2.02–2.30, comparators
   2.28–2.48). Origin readability is temporal: lead time, motion and sound.
   Comparators win it in motion (Thumper's track shows notes seconds ahead,
   Sky Force's ground turrets scroll in before they wake). So the fix must
   be temporal, not only decorative, and our QA should test it in reels.

Architecture note (for students): `waves.ts` is a good example of
**table-driven design** with a tiny **interpreter** (`expandWave` turns four
formation rules into spawns). It replaced the starter's copy-pasted `for`
loops, a classic **duplicated code** smell. That design is exactly what
makes telegraphs cheap: lookahead is a pure function over the table. The
remaining smell is **primitive obsession** on placement (`x?: number`, entry
implied by formation): adding an entry source is the natural next field.

## What the comparators teach

| Game | Pattern | Applies to us as |
| --- | --- | --- |
| Ikaruga | Five chapters, each built around one idea, opened by a title card; huge structures you fly over give scale (`side/06`). Formations enter from fixed, repeated points so learning is possible (craft knowledge). | One idea per sector; a chapter card; repeated entry points per sector. |
| Radiant Silvergun | Stage architecture forms the lanes and funnels enemy entry (`side/02`); scenarios are tightly scripted and support several weapon approaches. | Walls and hatches that are the spawn points, not decoration near them. |
| DoDonPachi | Stage, midboss, stage, boss; a full-screen WARNING before bosses; ground emplacements scroll in as terrain before they activate (craft knowledge). | Turrets arrive as platforms visible on the floor seconds before they wake. |
| Sky Force Reloaded | Ground roads, bunkers and a facility core (`side/01`) make the stage a location; mid-stage set pieces; recurring bosses as characters. | A landmark per sector that also hosts or launches a wave. |
| Rez Infinite | On-rails areas; destroying nodes raises the "layer", changing music, layout and enemies; tunnels and gates as landmarks (`side/07`). | Clearing waves advances the sector's visual and musical layer. |
| Tetris Effect | Thirty stages, each a theme and a track; play tied to the beat. | Per-sector music stems and looks; telegraphs land on the beat. |
| Thumper | Threats are lit notes on a track visible far ahead; turns preview on the horizon; segments end in a rating and checkpoint (`side/03`). | A lane light that reaches toward the ship before the wave; a sector ends with a short rating beat. |
| Returnal | Enemies emit geometric arrangements (spirals, arrays, hoops) in a lit arena (`side/05`); wind-ups glow; directional audio for off-screen attackers (craft knowledge). | Boss arena lit by the bullet wall; panned audio for wall entries. |
| Ex-Zodiac | Repeated vertical markers (wind turbines) build a corridor and a sense of distance (`side/04`). | Lane Authority buoys or toll gates ticking past as distance markers. |
| CYGNI | Megastructures as foreground and background layers; air and ground threats on two planes (`side/08`). | Parallax megastructures that a wave launches from. |

## Telegraph grammar (visual and audio)

One grammar for every sector, so the player learns it once (the tutorial can
teach it, which gives the Onboarding Assistant a natural, overlong segment).
Four stages, triple-coded by shape, color and sound so it survives color
blindness, reduced flash and a muted Chromebook speaker:

| Stage | Lead | Visual | Audio |
| --- | --- | --- | --- |
| Forecast | 3 s (S1–S2), 2 s (S3–S4), 1.5 s (S5) | A **lane light**: a faint stripe on the floor from the top edge toward the ship at the spawn x (or a wall glow for side entries). For set-dressed entries, the source itself wakes: a hatch lights, a platform scrolls into view. | Soft, kind-specific tick on the music's next beat, panned to `x / 480` (left wall hard left, right wall hard right). Pairs with B's beat-quantized musical layer. |
| Warning | 1 s | An **entry glyph** at the exact spawn point, its shape encoding the formation: bar = `line`, chevron = `vee`, stacked dots = `column`, wall brackets = `pincer`. Color encodes kind using the existing role palette. | A pitched sting per kind (drone high, dart falling, turret low, lancer stereo sweep) quantized to the beat. Spatial: positioned at the glyph. |
| Commit | existing | The current state-machine wind-ups (aim glow, dart thruster flare), plus a faint dive line for darts at the commit tick and a lane line for lancers. | Existing feel-layer aim sounds. |
| Release | on clear | Lane light goes out; the sector's landmark pulses; a short "lane clear" accent. | One clean musical resolution (a cadence, not a sound effect). |

Rules:

- **Honesty.** A forecast always resolves into the wave it forecasts. The
  one permitted lie is the tutorial's wink (for example, a forecast that
  resolves into a single confused drone).
- **Constant lead per stage, per sector.** One second always means one
  second; lead shrinks only between sectors, and the chapter card says so
  ("Forecast window: shorter").
- **Scan beam integration.** While resting (scan), the beam reaches past the
  top edge: forecasts inside the cone resolve early into ghost silhouettes of
  the formation and kind. This rewards rest-to-charge and the pacifist route
  (plan your weave instead of shooting) without changing combat.
- **Portrait and safe areas.** Glyphs sit inside the playfield below the HUD
  band, never in a notch area; wall brackets sit inside the side safe area.
- **Low tier.** Lane lights are one instanced quad per wave with an additive
  material; glyphs are a small sprite atlas. No new post-processing. The
  whole grammar should cost under 1 ms on the low tier.
- **Young players.** Telegraphs reduce surprise deaths, which matters most for
  the elementary-school audience. Keep sounds gentle in Forecast; reserve
  harsh timbres for Warning.

## Per-sector redesign

Template for every sector's pacing (seconds, roughly 30–36 s total):
**card** (0–3, chapter card, forecasts only), **build** (3–12, two pulses
that teach the sector's idea), **set piece** (12–20, the landmark hosts or
launches a wave), **breath** (20–23, nothing spawns, music thins), **climax**
(23–30, the sector's idea at full density), **release** (30+, landmark
passes overhead, rating beat). The release replaces today's empty 8–10 s
tail: the sim still waits for a clear screen, but the camera now has
something to show.

### 1. Outer Drift: "Scouts ahead"

- Idea: learn the grammar. Longest leads, drones only.
- Set dressing: Lane Authority marker buoys along both rails, one every
  4 s, like kilometer posts (Ex-Zodiac turbines). Sparse ice debris.
- Landmark: a **toll beacon**, a tall Authority mast the player passes at the
  set piece; drones launch from its ring as a `vee`.
- Telegraph emphasis: Forecast and Warning at full length; the Onboarding
  Assistant names each glyph once.
- Entrances: top only, at three fixed x positions the buoys mark (left,
  center, right), so the player learns "buoy lights, wave comes".
- Pacing: gentle ramp; the existing final double `column` becomes the climax;
  release under the beacon.

### 2. Shatter Belt: "Divers incoming"

- Idea: darts emerge from cover.
- Set dressing: parallax rock field with a few large foreground rocks that
  drift through the top third.
- Landmark: a **broken ring station** shard, half-occluding the lane.
- Telegraph emphasis: Forecast is a rock that glows on its underside; darts
  launch from behind it. Commit adds the dive line.
- Entrances: `behind` a named rock (new entry type), plus top.
- Pacing: two clusters separated by a calm "belt gap" (the breath), then a
  climax of three rocks firing darts in sequence, left to right, on the beat.

### 3. Gun Lanes: "Turrets online"

- Idea: emplacements are terrain (DoDonPachi, Sky Force).
- Set dressing: the floor becomes plated, with **gun platforms** that scroll
  into view 3 s before the turret wakes; turret `descend` reads as the
  platform arriving under it.
- Landmark: **#0121's derelict flight recorder** wreck, visible in the
  background 5 s before the salvage pickup, so the flashback trigger is
  anticipated and the narrative beat feels placed, not random.
- Telegraph emphasis: Warning on platforms (status lights cycle red, then
  the turret's existing aim).
- Entrances: platforms on fixed rails (left lane, right lane, center).
- Pacing: the turret triple at 25 s is a gauntlet climax; the flashback sits
  in the breath, not mid-climax.

### 4. Lancer Gate: "Crossfire"

- Idea: walls fire.
- Set dressing: the edge rails thicken into **bay walls** with hangar slits
  at the six `pincer` heights (`PINCER_TOP + n * PINCER_STEP`).
- Landmark: the **Gate**, a ring the player flies through at the release. It
  is the Enclosure made literal: the first time the lanes visibly close.
- Telegraph emphasis: wall brackets; slits light in pair order, panned hard
  left and right, 1 s before each lancer pair.
- Entrances: `left` and `right` walls (already what `pincer` does), plus top.
- Pacing: three pincer pulses escalate (4, 6, 6 lancers), each answered by a
  release; climax is the final pincer under drone cover.

### 5. Last Approach: "Everything they have"

- Idea: everything, with shorter leads, toward a visible destination.
- Set dressing: rails converge; Authority fencing appears between pylons.
- Landmark: the **Warden's enclosure** on the horizon from second 0, growing
  across the sector (Rez and Ikaruga arena reveal). The player sees where
  they are going for 35 s before the boss.
- Telegraph emphasis: all stages, Forecast at 1.5 s, and the chapter card
  says so.
- Entrances: every source from sectors 1–4 reappears once (a quick recap of
  the slice's vocabulary).
- Pacing: crescendo, then a deliberate 6–8 s breath (music stripped to a
  pulse, nothing spawns) before `bossWarning`; the enclosure doors open during
  the 200-tick warning and the floor unfolds into the arena. The reveal ends
  on the Warden being smaller and angrier than its building, which lands the
  "deflation" beat of the Warden's three moves.

Narrative fit: the lanes are the Enclosure. Each sector shows a little more
of the infrastructure (buoys, platforms, walls, gate, fencing), so the
player's growing ability to anticipate threats is also a growing awareness of
the cage. That serves the morally gray ending and the pacifist run without a
line of dialogue.

## Proposed data changes (for agent P, via the integration queue)

Keep the starter-faithful table as `STARTER_SECTORS` (students can diff it
against the original) and add a `SLICE_SECTORS` table behind a flag:

```ts
interface Wave {
  // ...existing fields
  /** Where the wave enters; defaults from formation. */
  readonly entry?: "top" | "left" | "right" | "behind" | "platform" | "hatch";
  /** Set-dressing anchor the wave launches from, for example "beacon". */
  readonly from?: string;
}
interface SectorPlan {
  // ...existing fields
  readonly look: SectorLookId;          // palette, floor, kit
  readonly forecastTicks: Tick;         // 180 / 120 / 90
  readonly landmarks: readonly { at: Tick; id: string }[];
  readonly breaths: readonly { at: Tick; ticks: Tick }[];
}
/** Pure: spawns arriving in [tick, tick + horizon), for telegraphs. */
export function upcoming(plan: SectorPlan, tick: Tick, horizon: Tick): Spawn[];
```

Telegraphs are render-only reads of `upcoming`, so they add no sim state and
no determinism risk. Spawn times never move because of a telegraph.

## Cost estimates

Hours are agent-hours including QA reels; "low tier" is the Chromebook risk.

| Item | Sim (`waves.ts` data) | Render | Art (Blender `bpy`) | Audio | Low-tier risk |
| --- | --- | --- | --- | --- | --- |
| `upcoming()` plus tests | 1 h | – | – | – | none |
| Forecast lane lights and entry glyphs | – | 4–6 h | glyph atlas 1 h | – | low (instanced quads) |
| Spatial, beat-quantized telegraph stings | – | – | – | 3–4 h (B), fal SFX under US $0.10 | none |
| Per-sector looks (palette, floor pattern, pylon variant) | 0.5 h (`look` field) | 3 h | – | – | none |
| Pacing re-sculpt in `SLICE_SECTORS` plus flag | 4–6 h | – | – | music stems per sector, B | none |
| Five landmarks (beacon, ring shard, recorder wreck, Gate, enclosure) | 1 h (`landmarks`) | 3 h | 10–14 h (2–3 h each) | – | medium: cap triangles, LOD on low |
| Entry sources (buoys, rocks, platforms, bay walls) | 2 h (`entry`, `from`) | 5–6 h | 4–6 h | – | medium: instancing |
| Chapter cards, EN/ES/ZH | – | 2 h (C, UI) | – | VO optional (W) | none |
| Enclosure reveal and arena unfold | 1 h | 5–6 h | 4 h | – | medium |
| Scan-beam forecast ghosts | 2–3 h (scan candidates include upcoming spawns) | 2 h | – | – | low |
| Dart dive lines, lancer lane lines | – | 2 h | – | – | none |
| QA: "every spawn forecast at least N ticks" check, per-sector readability reels | 2 h (Q/B) | – | – | – | – |

Total for everything: roughly 70–85 agent-hours. Items 1–4 below are about
20 hours and deliver most of what Adam asked for.

## Top 10, ranked by anticipation gained per hour

1. **Forecast and Warning telegraphs from `upcoming()`** (lane light plus
   formation-shaped glyph). Render-only, 6–8 h. Directly answers the note.
2. **Spatial, beat-quantized telegraph audio**, panned by spawn x, hard
   panned for walls. 3–4 h, pairs with B's musical layer and the spatial mix.
3. **Per-sector looks**, keyed in `chooseLook` by sector. 3–4 h; ends "all
   five sectors are the same place".
4. **Pacing re-sculpt** (card, build, set piece, breath, climax, release) in a
   flagged `SLICE_SECTORS` table, keeping `STARTER_SECTORS` for students.
   4–6 h.
5. **Entry sources as set dressing**: bay walls for Lancer Gate, gun
   platforms for Gun Lanes first (they fix the two most surprising entries),
   then rocks and buoys. 11–14 h.
6. **Last Approach enclosure on the horizon plus arena unfold.** 10–11 h; the
   boss reveal Adam has not had yet, and it carries the narrative.
7. **One landmark per sector** (beacon, ring shard, recorder wreck, Gate).
   12–16 h; the recorder wreck also anticipates the flashback.
8. **Scan-beam forecast ghosts.** 4–5 h; makes rest-to-charge and the
   pacifist run a reading skill.
9. **Chapter cards** with the sector name and forecast window, localized.
   2 h plus i18n.
10. **Dive and lane lines** for darts and lancers at the commit tick. 2 h;
    polishes the micro layer that already works.

## Status and next steps

- Done: diagnosis, comparators and side-by-sides, judge pass (3 pairs),
  pacing measurement, per-sector proposal, grammar, costs.
- Not done: no prototype. No code was edited, so `deno task ci` and reels
  were not run by this agent; `pacing.ts` only imports `waves.ts` read-only.
- Next: Adam picks from the top 10. Suggested smallest proof of concept:
  items 1 and 2 in sector 1 only, then a 20 s readability reel judged
  against `side/03` (Thumper) by the AV judge.
- Cross-agent asks (for the orchestrator to queue, since L writes only here):
  P owns `upcoming()`, `entry`, `SLICE_SECTORS`; C owns lane lights,
  glyphs, looks and cards; B owns telegraph stings and per-sector stems;
  W owns the tutorial segment that teaches the grammar and the chapter-card
  text.
