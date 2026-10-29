# Neon Warden: narrative bible

Workstream 5, October 28, 2026. Spine A, "Enclosure"
([research](../../research/2026-10-28-narrative-tropes/README.md)). The
spoken script is [`vo/script.yaml`](../../vo/script.yaml), UI strings are
[`src/i18n/ui.ts`](../../src/i18n/ui.ts), and scenes are
[`src/scenes/*.timeline.ts`](../../src/scenes/). This document says why
they read the way they do.

Disciplines in play: dramatic writing (beat structure, the reveal), game
narrative (ludonarrative fit, routes), localization (register, grammatical
gender, TTS constraints), and political economy (enclosure of a commons,
disposable contract labor).

## Premise

The lanes are free travel corridors through a nebula. For three hundred years
the Warden has kept them open to anyone who flies without weapons: its rings
throttle armed traffic, and its scouts fire only on ships that fire first.
The **Lane Authority**, a chartered toll consortium, wants the lanes
enclosed: tollgates, licenses, subscriptions. It cannot win a war of
attrition, so it hires Pilots: serialized contractors, onboarded by a cheerful
AI and recalled the moment they stop performing.

You are Pilot #0122. You think you are here to get paid.

## Cast

| Character                              | Voice (`speakers:` key)      | Function                                                                                                                                                                                | Never                                                                |
| -------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Pilot #0122**                        | `pilot` (one line, optional) | Silent contractor, helmet never off. Din Djarin bearing, Material Defender motive: just trying to get paid. Male (el piloto, 他). The player's choice to fire or not is his only voice. | Explain himself. Emote. Speak more than once.                        |
| **Onboarding Assistant** (tutorial AI) | `tutorial_ai`                | Lane Authority onboarding, then comms for the whole run. Helpful, perky, banal. Builds up the Warden. Reacts to everything the player does, never to what the Warden says.              | Sound sinister. She believes every word.                             |
| **Lane Authority Briefing** (narrator) | `narrator`                   | The threat-briefing reel in the tutorial (the scary register lives here) and the epilogue lines.                                                                                        | Appear outside the reel, the Warden's arrival and the epilogues.     |
| **The Warden**                         | `warden`                     | Hero antagonist and guardian of a commons. High, furious, over-acted, a little funny. Says serial numbers like names.                                                                   | Be scary. Be deep-voiced. Be wrong about the Authority.              |
| **Pilot #0121**                        | none (silent)                | Your predecessor. Stopped firing at the Warden and was recalled. Heard only through his flight recorder.                                                                                | Speak.                                                               |
| **The scouts**                         | `scout` (radio)              | The Warden's scouts on their own channel: grown, not built; escort unarmed convoys; fire only on ships that fire first. Lore leaks through their shop talk.                             | Plead, or name the player a villain. They report, they do not judge. |
| **Lane Control**                       | `authority` (radio)          | Authority traffic: tollgate surveys, Pilot stock, petitions filed unanswered. Every death a line item.                                                                                  | Sound sinister. It is bored.                                         |

## The Warden in three moves

1. **Hyped.** The assistant introduces it; the narrator's briefing reel
   inflates it ("Its voice alone has cracked hulls"). At the boss warning the
   narrator says only "The Warden." in the biggest voice in the game.
2. **Deflated.** Its first words are a shrill "STOP! Stop right there! Do you
   have ANY idea how long it takes to grow a scout?!" and the assistant
   mutters "That is not the voice from the briefing." Its anger is real, but
   it is the anger of someone tired, not a monster.
3. **Turned.** In phase 3 (kill route) or the descent (pacifist route) it
   explains what is behind it: "Free sky, for anyone who comes without a
   gun!" and "They don't want the lanes open! They want them OWNED!" The
   gray is uneven on purpose: an institution with every resource spent
   disposable labor to break a guardian of a commons.

## Beat sheet

Each scene lists its timeline file, trigger and lines in order. Route `K` is
kill only, `P` is pacifist only; unmarked lines play on both.

### Boot (`boot.timeline.ts`, front end)

No voice. Logos: `adamsmith.systems presents`, then `A CM121 portfolio
company. Cohort f26.` (UI strings), over the `logos` music cue. Flags
`boot.studioLogo`, `boot.publisherLogo`, `boot.logosDone` drive the UI.

### Tutorial (`tutorial.timeline.ts`, front end: New Game)

Properly built: every module waits for the player to do the thing (`waitFlag`
on `tut.*` flags), with `tut_idle_001` as the nudge after 15 s. Knowingly
overlong: it explains everything, then reviews it. **Exactly one wink:**
`tut_wink_001` ("An independent review rated this onboarding thorough. It also
rated it long."). Everything else in the tutorial is sincere.

1. Welcome and contract: `tut_hello_001`, `tut_contract_001` (payment on
   completion, defined in Appendix F: the Material Defender hook).
2. Movement: `tut_move_000`, `tut_move_001`, `tut_move_002`, `tut_hitbox_001`
   ("The gem is you.").
3. Focus: `tut_focus_001`.
4. Firing: `tut_fire_001`, `tut_fire_002` (Captain Obvious bullet colors),
   `tut_autofire_001` (real accessibility pointer), practice hologram
   `tut_target_001`, `tut_target_002` ("Every eye you close is one less eye on
   you": the scouts are eyes, not guns).
5. Survival and salvage: `tut_lives_001`, `tut_continue_001` ("You will
   hardly notice": the replacement theme, planted), `tut_pickup_001`.
6. The wink, then the review: `tut_wink_001`, `tut_review_001`.
7. Route and build-up: `tut_route_001` (original sector names),
   `tut_warden_001`, then the **threat briefing reel** (`tut.briefingReel`,
   narrator): `brief_warden_001`–`006`. Note `brief_warden_005`: the stakes
   it names are tolls and licenses, said with total gravity.
8. `tut_warden_002` ("Fear is not covered by your contract."), `tut_done_001`
   ("stay in your lane, Pilot": the trigger phrase).

Skip (`tutorialSkip.timeline.ts`): skip button, two UI confirms
(`ui.tut.skipConfirm1`, `ui.tut.skipConfirm2`), then `tut_skip_001`,
`tut_skip_002` ("Logged as: declined onboarding."). Three clicks, no penalty.

### Tutorial, wave 3 modules (October 28, 2026)

The tutorial AI is being recast to a more adult voice; the new lines are
written for sincere institutional warmth (a good trainer who means every
word), not cuteness. Each module waits on the player (`waitFlag`, nudged by
`tut_idle_001`), inserted after the practice target, in dependency order:

4. Trigger discipline: `tut_tap_001` (tap x3), `tut_stream_001` (hold),
   `tut_rule_001` "Stream for hulls, tap for parts."
5. Rest, scan, Writ, on one hologram: `tut_rest_001` (charge to three),
   `tut_scan_001` (beam lock), `tut_intel_001` (the FSM states as intel;
   the codex), `tut_writ_001` (the **Writ of Enclosure**, named "after the
   instrument that founded the Authority", said with pride).
6. Parts: `tut_parts_001` (practice turret barrel), `tut_disarm_001`
   ("forty percent of a kill. A partial deliverable is still a
   deliverable.").
7. Graze: `tut_graze_001`, `tut_graze_002` ("Near misses are billable.").
8. Rate: `tut_rate_001` (to x2), `tut_ratebreak_001` ("It simply pays for
   results.").
9. After pickups: `tut_hangar_001` ("Self expression is a benefit of
   employment."); after `tut_review_001`, `tut_review_002` reviews the
   trigger. Still exactly one wink: none of these lines comments on the
   tutorial's length.

### First-time beats (`beats.ts`, on the event's `first`)

`beat-first-lock` `lock_ai_001` + Lane Control radio; `beat-first-disarm`
`disarm_ai_001` (kindness that is a little too careful) + radio;
`beat-first-graze` `graze_ai_001`; `beat-warden-pod` `boss_pod_001` ("Do you
have ANY idea how long it takes to grow a pod?!", the descent's first line
again, smaller).

### Sector 3 recorder (`recorder.timeline.ts`, on `pickup` kind `recorder`)

The derelict is #0121's ship; the flashback was its last approach (played
here first if no powerup came before). The coda is what it recorded after:
`rec_ai_001` ("It is marked closed. It is still transmitting."), log header
`rec_log_001` (day 312), then the Warden talking to the empty cockpit:
towing it out of the crossfire, yelling at the next Pilot, and `rec_log_004`
"he stopped. Write that down somewhere they can't bill for." `rec_ai_002`
files it as not relevant. No freeze: the player flies through it.

### Radio (`radio.ts`, text in `src/i18n/radio.ts`)

A bank keyed by source (`drone`, `dart`, `turret`, `lancer`, `authority`)
and situation (`patrol`, `locked`, `disarmed`, `retreat`, `lost`): 22 voiced
`rad_*` lines and 34 text-only `radio.*` lines. What leaks: the scouts are
grown in the rings, escort the Saltline Haulers and the Commons Assembly,
and keep a no-first-fire rule (`rad_drone_patrol_002` plays only while the
Pilot has not fired); darts are unarmed by a treaty the Authority never
signed; turrets were planted where tollgates were later surveyed; Lane
Control keeps Pilot stock ("Pilot zero one two three is ready in
onboarding") and files petitions unanswered. `lost` lines are kill-route
only by construction.

### Codex (`codex.ts`, text in `src/i18n/codex.ts`)

Unlocked by the sim's `intel.codexId` (scan locks, the recorder) or from
the start (contract paperwork). Two voices: Authority filing language for
what is issued, scan intel for what the files leave out. It is the window
onto the 80-hour game: Tollmouth Station, the Lantern Reach and the
Ninefold Shoals, forty charted sectors, the Saltline Haulers (209
petitions, none answered), the Commons Assembly, and walled packages
(Injunction, Archivist, Witness) marked "not included in this vertical
slice". The Warden's core is "the heart" (the crest reads as one).

### Warden on the pacifist route, disarm vs ghost run

The descent's pacifist branch splits on `run.hasFired`: a disarmer gets
`desc_disarm_001`–`002` ("You took their GUNS? ... They grow back. That is
not the point. Thank you."); a Pilot who never fired keeps `desc_pac_001`–
`002` and adds `desc_ghost_001` ("You carried a Writ the whole way and you
never spent it.").

### Sectors 1–5 (`sector1`–`sector5.timeline.ts`, on `sectorStarted`)

The banner keeps the original names and subtitles (`ui.sector.N.*`). One
comms line each, after the banner flips:

| Sector          | Banner               | Line             | What it plants                                                                                  |
| --------------- | -------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| 1 Outer Drift   | Scouts ahead         | `sec1_intro_001` | "completely unprovoked" (it is not)                                                             |
| 2 Shatter Belt  | Divers incoming      | `sec2_intro_001` | darts were disarmed by treaty; "We did not sign it." (the dart's dead gun in the original code) |
| 3 Gun Lanes     | Turrets online       | `sec3_intro_001` | lanes built for free passage; "No tollgates anywhere. Very inefficient."                        |
| 4 Lancer Gate   | Crossfire            | `sec4_intro_001` | lancers fire across the lane, never along it: they keep it clear                                |
| 5 Last Approach | Everything they have | `sec5_intro_001` | the Warden is out of reserves; "a winning quarter"                                              |

**Ambient chatter** (`chatter.ts`, shaped like the Director's `ChatterBank`):
if the player has fired, `chatter.fight` (`amb_fight_001`, `003`, `004`, `005`:
performance record, "Your predecessor was also doing great at this point,"
unarmed ships "are not paying customers yet"). If not, `chatter.nofire`
(`amb_nofire_001`–`004`): the assistant grows politely uneasy, and "The
scouts are not firing at you. That is not in my briefing." is the game's only
hint that the pacifist route exists.

**Barks** (`barks.ts`): `bark_lifelost_001`, `bark_shield_001`,
`bark_gameover_001` (keeps the original "The lanes stay closed", with the UI
banner `ui.banner.gameOver` / `ui.banner.lanesClosed`).

### Flashback (`flashback.timeline.ts`, on the first powerup)

The spread crystal is Pilot #0121's flight recorder. `freezeSim` holds the
world, so the scene costs nothing. `flash_ai_001` ("Please don't open it.
You're opening it."), then the recording (`flashback.recording`: desaturate,
subtitles tag speakers "(recording)" via `ui.speaker.recording`):
`flash_rec_001` header, `002` the assistant pleading with #0121 to fire,
`003`–`004` the Warden astonished that someone stopped and showing him the
unarmed ships, `005` the recall ("Thank you for your service."), `006` the
Warden screaming "He STOPPED!" as the signal cuts. Silence. Back to gameplay;
`hud.serialRevealed` shows **Pilot #0122** on the HUD for the first time;
`flash_ai_002` "Welcome back, Pilot zero one two two." is the reveal.
`flash_ai_003` changes the subject.

### Warden descent (`wardenDescent.timeline.ts`, on `bossWarning`)

`warn_ai_001`, then the narrator's `warn_narr_001` "The Warden." Then the
deflation: boss music and the real voice arrive together on `desc_001`;
`desc_ai_001` "That is not the voice from the briefing." K: `desc_002`,
`desc_003`, `desc_004` ("With that gun, the lanes stay closed!"). P:
`desc_pac_001`, `desc_pac_002` ("You're the next number."), `desc_003`.
Both: `desc_ai_002`. The descent is a parley (`boss.parley`): invulnerable
and holding fire while it talks. Phase 1 barks: K `boss_taunt_001`,
`boss_p1_002`; P `boss_pac_001`, `boss_pac_002`.

### Boss phases (`bossPhase2`, `bossPhase3`, on `bossPhase`)

Phase 2, K: `boss_p2_001` (orders its scouts to surround, not attack),
`boss_p2_002`. P: `boss_pac_ai_001` (escalation), `boss_pac_003` ("You fly like
a freighter with opinions!").

Phase 3, K: `boss_p3_001` ("Everything I have!", echoing the sector 5
banner), `boss_p3_002`, then the turn `boss_turn_001`, `boss_turn_002`, with
the assistant's `boss_ai_001` ("Great hit! Your payment is ninety percent
vested!") landing between the turn's lines, and `boss_turn_003` ("Zero one
two one stopped! He listened!"). P: `boss_pac_ai_002` ("Recall authorization
requested. Please hold.").

### Kill ending, "Lanes Open" (`endingKill.timeline.ts`, on `bossDefeated`)

`kill_warden_001` (dying: "Count what they put where the rings were."),
banner WARDEN DOWN / The lanes are open, `kill_ai_001`. The original
epilogue, spoken by the narrator, with tollgates unfolding between its lines:
`end_epi_001` "The Warden's lights go dark, one ring at a time.",
`end_epi_002` "Behind you, five sectors of open sky.", `ending.tollgates`,
`kill_ai_002` (open "to all subscribers"), `end_epi_003` "Ahead, the long way
home." Then `kill_ai_003` (payment in thirty to ninety business days) and
`kill_ai_004` **"Your replacement is already in onboarding."** Tally, shown
not scolded: Scouts lost: N, Pilots spent: 122, Lanes: open (subscription
required). THANK YOU FOR PLAYING.

### Pacifist ending, "Lanes Kept" (`endingPacifist.timeline.ts`, on `bossSurvived`)

`pac_end_001` (the Warden, awed), `pac_end_002` (recall countdown, word for
word the procedure that took #0121), `pac_end_003` (the Warden cuts the
leash), `pac_end_004` (the Authority's last offer: return now and get paid).
Then, if `story.pilotSpeaks`: **`pilot_keep_001` "Keep the money."**,
`pac_end_005` (connection lost, glitching), `pac_end_006` (the Warden laughs).
If not: silence, `pac_end_005`, `pac_end_007` ("He didn't even answer
them!"). Epilogue: `pac_epi_001` "The Warden's lights stay on, every ring of
them.", `pac_epi_002` "Behind you, five sectors of free sky.", `end_epi_003`.
Tally: Scouts lost: 0, Pilots spent: 121, Pilots kept: 1, Lanes: free.

### Credits (`credits.timeline.ts`, front end)

Crawl is UI (stunt pilots `#0001 – #0121`; on the pacifist route
`Pilot #0122 (still flying)`). Sting after the crawl: K `credits_kill_001`,
the welcome line again for **Pilot zero one two three**; P `credits_pac_001`,
"And if anyone with a gun asks, I am EXTREMELY scary!"

## Variant banks and stats commentary (wave 4)

Lines that fire many times a run live as pools in `src/scenes/banks/`
(format in `types.ts`), dealt by shuffle bag so a beloved line like
`bark_lifelost_001` ("You're fine. The ship isn't, but you're fine.")
almost never repeats. The assistant's rhythm is three beats: warmth for the
Pilot, the rule, the money, with the money arriving a little too fast. Stats
commentary (accuracy, shots "into the mist", streaks, perfect sectors, graze
streaks, disarm ratio, repeated deaths, long rests, Writ hoarding) is
sincere institutional warmth that turns faintly passive-aggressive about
efficiency and pay; the joke is always on the paperwork, never on the
player, because young players will hear it. The Warden and the scouts
chime in rarely; the scouts report, they do not judge. Disarms puzzle the
assistant ("there isn't a column for it"): that confusion, never a scolding,
is the pacifist hint. Voiced variants are mirrored into `vo/script.yaml`
(`var_*`, `stat_*`, scene `banks`) by `src/scenes/banks/emit_yaml.ts`; edit
the bank, not the YAML.

## Tone rules

1. **Authentic, not parody.** Comedy comes from character (the assistant's
   relentless helpfulness, the Warden's exhaustion), never from mocking the
   game or the player.
2. **One wink.** The tutorial gets exactly one line that leans on its own
   length (`tut_wink_001`). Do not add a second.
3. **The Authority is banal, never sinister.** It says "terms and conditions
   apply" with full sincerity. If a line makes the assistant sound like she
   knows she is the villain, rewrite it.
4. **The Warden is loud and sincere.** Its comedy is volume and indignation;
   its content is always true. The deflation is in the voice, not the facts.
5. **Shown, not scolded.** Endings present numbers and consequences in the
   world. No "You monster." No accusation of the player.
6. **Pilot is silent.** At most one line in the game, spent once, in the
   pacifist ending. Everyone else talks around him.
7. **Keep the original's words.** "The lanes stay closed", "The lanes are
   open", the three epilogue lines, the sector names and banner subtitles.
8. **House style.** No emdashes, no emoji; en dashes for ranges.

## Localization

### General

- **Text and voice are separate settings.** Every VO line is also a subtitle
  in all three languages. UI strings are text only.
- **Spoken text is TTS-safe:** no parentheses, no symbols the engine might
  read aloud, serials spelled out. Subtitles show the same text, so serials
  read as radio callouts ("Pilot zero one two two"). On-screen UI uses
  digits: `Pilot #{serial}`.
- **Glossary**

| English                                                          | Spanish (LatAm)                                                                                     | Chinese (Simplified)                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| the Warden                                                       | el Guardián                                                                                         | 守望者                                           |
| the lanes                                                        | las rutas                                                                                           | 航道                                             |
| Lane Authority                                                   | la Autoridad de Rutas                                                                               | 航道管理局                                       |
| Pilot (role)                                                     | piloto (el piloto)                                                                                  | 飞行员                                           |
| Pilot #0122 (spoken)                                             | piloto cero uno dos dos                                                                             | 零一二二号飞行员                                 |
| Pilot #0122 (UI)                                                 | Piloto #0122                                                                                        | 0122号飞行员                                     |
| onboarding                                                       | la inducción                                                                                        | 入职培训                                         |
| scouts / drones                                                  | exploradores                                                                                        | 侦察机                                           |
| darts / divers                                                   | dardos / picadores                                                                                  | 飞镖机 / 俯冲机                                  |
| turrets                                                          | torretas                                                                                            | 炮塔                                             |
| lancers                                                          | lanceros                                                                                            | 枪骑机                                           |
| recall                                                           | retiro                                                                                              | 召回                                             |
| the Writ (of Enclosure)                                          | el Mandato (de Cercamiento)                                                                         | 令状（圈地令状）                                 |
| scan, lock                                                       | escaneo, fijar / fijado                                                                             | 扫描、锁定                                       |
| graze                                                            | roce                                                                                                | 擦弹                                             |
| weapon part, disarm                                              | pieza de armamento, desarmar                                                                        | 武器部件、解除武装                               |
| Contract Rate                                                    | Tarifa de Contrato                                                                                  | 合同费率                                         |
| codex, hangar                                                    | códice, hangar                                                                                      | 资料库、机库                                     |
| Lane Control                                                     | Control de Rutas                                                                                    | 航道控制                                         |
| Commons Assembly, Saltline Haulers, Tollmouth                    | Asamblea de los Comunes, Transportistas de la Línea de Sal, Bocapeaje                               | 公地议会、盐线货运行会、收费口站                 |
| non-performance                                                  | no desempeño                                                                                        | 未履约                                           |
| Outer Drift, Shatter Belt, Gun Lanes, Lancer Gate, Last Approach | Deriva Exterior, Cinturón Quebrado, Rutas de Artillería, Puerta de los Lanceros, Aproximación Final | 外缘漂流带、碎裂带、炮火航道、枪骑之门、最终进近 |

### Spanish (Latin American)

- **Tú** for Pilot from everyone (the assistant is corporate-casual, the
  Warden is too angry for usted). **Ustedes** for plurals; never vosotros
  ("¡Protejan la ruta!", "Quédense con el dinero.").
- **Gender:** Pilot is male, so agreement is masculine: _bienvenido_,
  _enfocado_, _quieto_, _el piloto_. Avoid gendering where Spanish allows it
  cheaply ("Tienes talento nato" rather than "Eres un natural"). #0121 is
  also _él_.
- Opening marks always: ¡…! ¿…?, and ¿¡…!? for furious questions.
- "Rutas" for lanes keeps "Las rutas siguen cerradas" natural; "carriles"
  reads as a highway.
- Spell numbers for TTS: _ciento veintiún pilotos_, _cero uno dos dos_.

### Chinese (Simplified)

- **守望者 for the Warden**, replacing the earlier 典狱长 (prison warden).
  典狱长 settles the moral question in the name: it makes the Warden a
  jailer. 守望者 (watcher, guardian) lets the briefing reel make it
  frightening and lets the turn make it kind, which is the arc.
- **Pronouns:** Pilot and #0121 are 他. The Warden is 它 in narration
  (an old machine-entity), and speaks in the first person.
- **Serials:** spoken as Chinese digits with 号, 零一二二号, so the TTS reads
  digit by digit (二, never 两). UI uses Arabic digits: 0122号飞行员.
- Full-width punctuation (，。！？：“”……) throughout; ？！ for furious
  questions.
- Register: the assistant uses 你 and the occasional 哦 or 吧 for perkiness;
  Authority fine print uses formal 将, 已, 予以. The Warden is colloquial and
  loud: 给我站住, 毫无礼貌.

## Casting

- **The Warden's voice description was rewritten without recasting.**
  `render.py` hashes `design`, `anchor` and `seed` into the cast, so editing
  `design` would re-render the anchor and lose the voice we chose to keep.
  The script therefore adds a `description` field (not hashed) that describes
  the anchor as it is: high, furious, over-acted, not gravelly. `design` stays
  byte-identical, with a comment marking it frozen. A small `render.py` change
  would remove this wrinkle (see Requests).
- **Pilot** gets a new speaker record (seed 44): a low, flat voice through a
  helmet. Its anchor is a casting line, never heard in game.
- Clone mode ignores `direction`, so acting comes from each anchor's single
  register. The Warden's tender beats (`kill_warden_001`, `desc_pac_002`) are
  written to work even when delivered loud.

## Pipeline

1. Edit `vo/script.yaml`.
2. `deno run --allow-read --allow-write src/i18n/gen_script.ts` regenerates
   `src/i18n/script.gen.ts`, the typed runtime table. Line ids become literal
   types, so `say("tut_hello_01")` in a timeline is a compile error.
3. `deno test --allow-read tests/i18n_text_test.ts tests/scenes_timelines_test.ts`
   checks that every language is present, the generated file is in sync, every
   line is used, and route-only lines are gated by route.
4. `uv run vo/render.py --asr` re-renders only changed lines (content-hash
   cache) and rebuilds `vo/out/cues.json`. Timelines wait on `lineEnds`, so
   scene timing follows the new audio automatically.

## Requests to other workstreams (open)

- **Contracts:** add `waitFlag` to `Cue` (see `src/scenes/cues.ts`). Then
  `SceneTimeline` collapses to `Timeline`.
- **Sim (WS1):** hold the Warden invulnerable and silent while `boss.parley`
  is set, and spawn the tutorial hologram on `tut.spawnTarget`.
- **Director (WS6):** maintain `run.*` with `runFlagsAfter`, the `tut.*`
  progress flags, and start scenes with `timelineForEvent`. Tag recorder
  subtitles with `ui.speaker.recording`.
- **render.py:** a per-line `seed` override, and a lock so a speaker's
  `design` can be corrected once its anchor exists without recasting.
