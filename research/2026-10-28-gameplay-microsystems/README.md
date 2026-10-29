# Gameplay micro-systems: making the core loop reward expert play

Research note, October 28, 2026. Read-only research: no code was changed.

Disciplines in play: game design (verbs, risk–reward, mastery curves),
interaction design and accessibility (hold vs toggle, motor load), sound
design (cue vocabulary, mix priority), narrative design (mechanics as
argument, ludonarrative consonance), and political economy, lightly (what the
pay metric measures, and who it is for).

## Framing question

The current slice is a faithful port of the E4 starter: one held fire button
that streams 1, 2 or 3 shots every 7 ticks (`PLAYER.fireInterval`,
`PLAYER.spreads`), spread and shield pickups, four enemy kinds (drone 2 HP,
dart 1, turret 12, lancer 4), a 900 HP Warden in three HP-gated phases, and a
pacifist route that stays open while `pacifistIntact` (no kills, no damage to
the Warden; `src/sim/sim.ts:701`, `:733`) and ends on the survival clock
(`SURVIVAL_PHASE_TICKS = [600, 600, 600]`). Fire is a boolean per tick after
auto-fire and hold/toggle are applied (`src/contracts/input.ts:20`).

That loop is legible but flat: holding fire and dodging is the whole verb set,
and score is a sum of kill values. Adam's brief: make it actually interesting
and expert-rewarding, ideally woven into the Enclosure spine (Pilot #0122, a
Lane Authority toll contractor, versus the Warden, guardian of free lanes whose
scouts "fire only on ships that fire first"). His seeds: single-shot default,
hold for burst or charge, part damage that disables weapons, kill-shots in
special zones, excellent SFX on every action.

So: which small, interlocking systems give a deterministic 60 Hz TypeScript
sim the most mastery per line of code, while making the kill/pacifist choice
mechanically rich rather than a binary switch?

## Findings: what the genre already knows

Each entry: the mechanism in one or two lines, and the lesson for us. Sources
were fetched and trimmed in a script; entries marked (memory) rely on prior
knowledge and were not verified in this session.

- **Ikaruga** (polarity, absorb, chaining). Ship switches black/white; same
  color bullets are absorbed into energy, released as homing lasers; a single
  tap shot and a held double stream differ, and tap shots are used to pick off
  specific enemies "often needed for chaining." Chains reward killing three of
  one color in a row (memory). Lesson: a tap/hold split on one button is a
  proven precision verb; absorbing threats as fuel turns defense into offense.
  <https://shmups.wiki/library/Ikaruga>
- **DoDonPachi / DaiOuJou** (combo, hyper). "Causing an enemy to explode fills
  a meter, and every enemy destroyed before the meter depletes adds to the
  current chain"; holding the laser on a big enemy "will hold the meter
  steady." Hypers boost firepower at the cost of rank. Lesson: a decaying
  chain timer is the simplest strong mastery system; let sustained contact on
  a big target keep it alive so bosses do not break chains unfairly.
  <https://shmups.wiki/library/DoDonPachi_DaiOuJou>
- **Espgaluda** (kakusei, bullet cancel, barrier charge). Gems fuel Kakusei
  mode, which slows bullets and cancels an enemy's bullets when it dies; a
  barrier can be tapped or "held to charge up a larger barrier attack," and
  getting hit in Kakusei triggers an automatic barrier. Lesson: cancelling a
  killed (or disarmed) enemy's bullets into score is huge juice for little
  code; auto-protective fallbacks soften punishing meters.
  <https://shmups.wiki/library/Espgaluda>
- **Mushihimesama** (amber, counter). Amber value scales with a counter built
  by hitting enemies with your shot; dying forfeits the stage's amber bonus.
  Lesson: pay that is "vested" until you survive is a ready-made metaphor for
  contract work. <https://shmups.wiki/library/Mushihimesama>
- **Radiant Silvergun** (color chains, weapon leveling, sword absorb). Chains
  of three same-color kills multiply; shooting the wrong color breaks the
  chain; weapons level from score, not pickups; the sword absorbs pink bullets
  into a gauge. Lesson: target discrimination (shoot this, not that) is the
  core of expert scoring; "do not shoot" is already a genre skill.
  <https://shmups.wiki/library/Radiant_Silvergun>
- **Jamestown** (vaunt). Gold from kills fills Vaunt: a timed shield, more
  firepower and a multiplier, "prolonged and increased by collecting more
  gold." Lesson: one meter that is both defensive and score-relevant creates a
  constant spend-or-save decision.
  <https://en.wikipedia.org/wiki/Jamestown:_Legend_of_the_Lost_Colony>
- **Crimzon Clover** (lock-on, break). Enemies inside a border get locked "a
  number of times [that] depends on the amount of health remaining"; releasing
  many lasers at once grants a temporary multiplier. Lesson: lock-on scaled to
  remaining HP is a readable way to reward precision without twitch aim.
  <https://en.wikipedia.org/wiki/Crimzon_Clover>
- **Psyvariar** (buzzing). "Each time an enemy unit or bullet gets very close
  to player's fighter without destroying player's fighter, a 'buzz' occurs,"
  granting experience; leveling grants brief invulnerability; the hitbox is
  one pixel. Lesson: grazing can be the main progression currency, which
  makes it the obvious backbone for a pacifist route.
  <https://en.wikipedia.org/wiki/Psyvariar>
- **Touhou** (graze, focus). Focus shows the hitbox and the graze radius;
  grazing pays points and raises item value; grazes are marked with "a sharp
  pop/crackle" and white particles off the hitbox. Lesson: graze needs a
  visible ring under focus and a tiny, rate-limited sound.
  <https://touhou.fandom.com/wiki/Graze>,
  <https://en.touhouwiki.net/wiki/Hitbox>
- **Dariusburst** (burst beam, counter-burst; memory). A deployable beam that
  can be set in place; meeting an enemy burst beam with your own amplifies it.
  Lesson: answering an enemy's signature move with your own is the most
  memorable boss interaction in the genre. <https://en.wikipedia.org/wiki/Dariusburst>
- **Sky Force Reloaded** (stage objectives). Stars from kills buy upgrades;
  stages carry medal goals (destroy a share of enemies, rescue people, take no
  damage; memory). Lesson: per-sector contract objectives are a cheap way to
  express two value systems on one HUD.
  <https://en.wikipedia.org/wiki/Sky_Force_Reloaded>
- **Rez** (lock-on, musical impacts). Lock up to eight targets and release;
  "the impact automatically syncs with the background track." Lesson:
  quantizing payout SFX to the music beat makes scoring feel like
  performance. <https://en.wikipedia.org/wiki/Rez_(video_game)>
- **Tyrian** (Dragonwing idle charge). Weapon power rises "by not firing them
  for short time, letting them accumulate extra charges," five charge levels.
  Lesson: charge-by-restraint needs no held button at all, which solves the
  accessibility problem and, for us, the theme.
  <https://en.wikipedia.org/wiki/Tyrian_(video_game)>
- **R-Type** (wave cannon, Force). A weak rapid gun plus a wave cannon charged
  by holding fire; the Force pod is an indestructible shield and weapon.
  Lesson: the canonical hold-to-charge, and the canonical motor-load complaint.
  <https://en.wikipedia.org/wiki/R-Type>
- **Ex-Zodiac, Cygni** (memory). Ex-Zodiac is a Star Fox-style rail shooter
  with ranked stage scoring; Cygni splits air and ground weapons and an energy
  pool between shields and guns. Lesson for us: resource allocation between
  defense and offense reads well in 3D. Store and wiki pages fetched gave
  nothing usable; treat these as unverified.
- **Monster Hunter** (part breaks). "Dealing enough damage to a part will
  cause it to break," often "weakening the monster and sometimes limiting its
  mobility," with extra rewards. Lesson: sustained damage on one location,
  visible break, a real change in the enemy's moveset.
  <https://game8.co/games/Monster-Hunter-Rise/archives/381635>
- **Armored Core VI** (ACS stagger). Impact damage builds an overload meter;
  a staggered target takes heavy bonus damage. Lesson: a two-step "open, then
  punish" rhythm, which is exactly "break pods, then kill-zone shot."
  <https://armoredcore.fandom.com/wiki/Stability>,
  <https://www.ign.com/wikis/armored-core-6-fires-of-rubicon/How_to_Stagger_Enemies>
- **Gradius cores, Zone of the Enders** (memory). Gradius bosses hide a core
  behind barrier plates you shoot away; ZOE lets you grab and throw enemies
  and favors disabling over killing in its later story. Lesson: layered
  armor is the most readable weak-point grammar in shmups.
  <https://en.wikipedia.org/wiki/Gradius>
- **Undertale** (mercy). Players "opt to appease monsters in order to spare
  them," via the right actions or by lowering HP without killing; "enemy
  attacks change based on how players interact with them," and endings
  branch on kill vs spare. Lesson: mercy must be an action with its own
  skill, not mere absence. <https://en.wikipedia.org/wiki/Undertale>
- **Accessibility of hold vs toggle.** Game Accessibility Guidelines: "Holding
  requires much greater motor ability than pressing ... ideally offer a
  setting for players to choose." Xbox Accessibility Guideline 107 flags holds
  of 2–3 s or more as exclusionary.
  <https://gameaccessibilityguidelines.com/avoid-provide-alternatives-to-requiring-buttons-to-be-held-down/>,
  <https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107>

## Catalog of candidate micro-systems

Fields per system: **How**, **Skill**, **Readability**, **SFX/VFX**,
**Narrative hook**, **Pacifist**, **Cost** (in our sim; S < 100 lines, M
100–300, L > 300, excluding render and audio), **Autopilot**.

### A. Trigger discipline: tap, stream, and restraint charge (recommended)

- **How.** The press edge of Fire fires one *aimed round* (3 damage, faster,
  the only shot that can break armored parts). Keep holding past 8 ticks and
  it becomes the current *stream* (1 damage per shot, spread by cannon level).
  While the trigger is released, a capacitor fills (Tyrian-style): levels 1–3
  at 40/80/120 idle ticks. The next press spends the charge as a *Writ round*:
  piercing, 6/12/24 damage, breaks any part it touches.
- **Skill.** Rhythm management: streaming is safe DPS; resting the trigger
  earns burst. Experts feather the trigger to open parts, then stream. The
  ideal pattern shifts per enemy (darts: one aimed round; turrets: rest, Writ
  the barrel, stream the hull).
- **Readability.** A three-pip capacitor ring around the ship (also in the
  HUD), filling with a rising tone; the ship's muzzle glows per level.
  Shape-coded pips for `colorIndependentCues`.
- **SFX/VFX.** Tap crack, stream loop, charge pip ticks, full-charge hum,
  three release tiers.
- **Narrative hook.** The gun gets stronger when you stop firing: the
  mechanical shape of #0121's choice. The Warden can hear it ("Your gun is
  FULL. I can HEAR it.") and the assistant markets it ("Trigger Rest: a
  premium efficiency feature").
- **Pacifist.** A pacifist carries a fully charged gun for the whole run: a
  standing temptation, visible and audible. Spending it in the boss fight is
  the one-shot betrayal.
- **Cost.** S–M: a `fireHeldTicks` and `idleTicks` counter, a `ShotKind`
  union (`aimed`, `stream`, `writ`), pierce flag, new `fire` event fields.
- **Autopilot.** The no-fire autopilot sits at full charge; render must not
  nag it. A future fire-capable autopilot needs a simple policy (tap parts,
  stream hulls).
- **Accessibility.** No hold is ever required to charge. Auto-fire mode
  streams forever and so never charges: offer "Auto-fire: pulse" (auto
  releases every 120 ticks to spend a full Writ) as the assisted variant.

### B. Part targeting and disarm (recommended)

- **How.** Each enemy has a weapon part with its own small collider and HP,
  armored against stream shots (stream deals 0 to parts). Aimed or Writ
  rounds break it. A disarmed enemy stops firing, its live bullets cancel
  into graze motes (Espgaluda), and it sets `retreating` (already in
  `enemies.ts`) and leaves: spared, not killed. The Warden carries four ring
  pods, one per pattern: left and right fan emitters, the heavy cannon, the
  spiral ring (plus a summon bay in phase 2). Breaking a pod deletes that
  part of its pattern. Its core is a **kill zone**: once two pods are broken,
  core hits deal double and the killing blow, if a Writ, is a *clean kill*.
- **Skill.** Target discrimination under pressure (Radiant Silvergun), and the
  AC6 "open, then punish" rhythm on the boss. Experts route which pods to
  break first to simplify later phases.
- **Readability.** Parts wear the enemy's accent color plus a notched bracket
  glyph; damaged parts spark and flicker; the kill zone shows a diamond
  reticle only when open. One rule, said once in the tutorial: "Stream for
  hulls, tap for parts."
- **SFX/VFX.** Part ping (armored deflect for stream), part crack, break pop
  with debris, disarm power-down sigh, bullet-cancel shimmer.
- **Narrative hook.** Disarming is the middle path the premise invites: the
  Warden's rings throttle *armed* traffic; you un-arm its scouts instead of
  killing them. The ending tally already shows "Scouts lost: N" and disarming
  lowers N directly. The assistant reads disarms as underperformance.
- **Pacifist.** Under the current rule (`pacifistIntact` breaks only on a kill
  or Warden damage), disarming scouts keeps "Lanes Kept" open. Decision for
  Adam below.
- **Cost.** M for enemies (parts on four kinds, collision order part-before-
  hull, cancel), M for the Warden (four pods gating `attack()` branches).
  Determinism is unaffected: no new random draws.
- **Autopilot.** No-fire autopilot never disarms. A disarm-capable autopilot
  is optional and later.

### C. Graze: "Clearance" (recommended)

- **How.** An enemy bullet whose center passes within 26 units of the ship
  (hit distance is 11 for a standard bullet) without hitting counts one
  graze, once per bullet. Heavy bullets count double. Focus mode widens
  nothing but shows the graze ring.
- **Skill.** Deliberate close dodging; reading bullet speed. Classic and
  well understood by experts, invisible to novices until taught.
- **Readability.** Focus reveals the hitbox and a faint graze ring (Touhou);
  each graze throws two white sparks off the ring.
- **SFX/VFX.** A tiny, rate-limited crackle, pitched up within a streak.
- **Narrative hook.** "Near misses are billable." The Authority pays hazard
  pay for risk, not for results, which is how it gets contractors to fly
  closer to the guns.
- **Pacifist.** The main skill currency of the no-kill route (Psyvariar): it
  sustains the multiplier, so a pacifist run is chased for score, not just
  survived.
- **Cost.** S: one pass in the existing bullet–player collision loop, a
  `grazed` flag per bullet, a `graze` event.
- **Autopilot.** A safe autopilot grazes incidentally; a "show-off" mode can
  bias toward graze distance. Deterministic sim means its lookahead can be
  tested headlessly.

### D. Contract Rate: the pay multiplier (recommended)

- **How.** A rate from x1.0 to x8.0 multiplies all pay. It rises on events
  (kill +0.10, part break +0.20, disarm +0.20, clean kill +0.50, graze +0.02),
  each event refreshing a 150-tick chain timer (DoDonPachi). Sustained Writ or
  stream contact on the Warden refreshes the timer too. On expiry it decays
  0.5 per 30 ticks rather than resetting (softer than DDP). A hit halves it
  (the *rate break*). Pay per kill = base value x rate; disarm bounty is 40%
  of the kill value; graze pays 5 x rate.
- **Skill.** Maintaining tempo across waves; choosing to risk grazes in gaps
  to keep the timer alive.
- **Readability.** A large numeral by the score, a draining bar under it, and
  a two-line ledger in the HUD: **PAY** (credits) and **SCOUTS SPARED**.
- **SFX/VFX.** Rate tick quantized to the music beat (Rez), stepping a scale;
  a descending fail chord on rate break; a cash-register chirp per kill.
- **Narrative hook.** The irony Adam named: killing pays best, disarming
  pays 40% but spares a scout, grazing pays almost nothing. The HUD measures
  what the Authority wants; the second line measures what the Warden wants.
  The assistant comments on rate ("Ninety percent vested!") and never on
  scouts spared.
- **Pacifist.** Graze-only rate building keeps a pacifist's PAY alive, small,
  and theirs.
- **Cost.** S: two numbers and a timer, events for tick and break.
- **Autopilot.** Neutral.

### E. Vested pay (optional, pairs with D)

- **How.** Pay earned in a sector is "unvested" until the sector clears; a
  life lost forfeits 25% of the unvested sum (Mushihimesama's amber bonus).
- **Hook.** The contract is literally the boss of you. **Cost.** S.
- **Risk.** Adds HUD complexity; fold into the sector-clear tally screen if
  built.

### F. Counter-writ parry (optional)

- **How.** A Writ round fired into a Warden heavy bullet within 6 ticks of
  its spawn reflects it into the pod that fired it (Dariusburst
  counter-burst).
- **Skill.** Very high; a spectacle for experts. **Cost.** M.
- **Pacifist.** Breaks the route (it damages the Warden). Kill-route garnish.

### G. Fire-first provocation (considered, not recommended for the slice)

- **How.** Scouts hold fire until you fire, as the premise states.
- **Hook.** Perfect consonance with the bible's premise.
- **Problem.** It makes the pacifist route trivial and changes every wave's
  feel. Better as a single scripted moment (one sector 3 scout that never
  fires unless provoked, flagged by the assistant as "a bug in the scout").

### H. Overdrive or hyper (considered, not recommended)

A DDP-style hyper or Jamestown vaunt duplicates what the Writ already does
and adds a second meter. Skip.

## Recommended set: four interlocking systems

1. **Trigger discipline (A).** One button, three expressions: tap (aimed
   round), hold (stream), rest (charge, spent as a Writ).
2. **Parts and disarm (B).** Aimed and Writ rounds break weapon parts;
   disarmed scouts cancel their bullets and leave; the Warden's pods strip its
   patterns and open a kill zone.
3. **Clearance graze (C).** Near misses are counted, sparkle, and feed rate.
4. **Contract Rate (D).** A decaying multiplier on PAY, fed by kills, breaks,
   disarms and grazes; broken by hits.

How they interlock: restraint (A) produces the round that disarms (B); disarm
cancels bullets into motes and graze opportunities (C); everything feeds rate
(D), but the economy pays killing best. The expert's optimal-pay line and the
optimal-lanes line diverge visibly on the HUD, so every target is a small
moral choice made at 60 Hz rather than one binary at the end.

The kill route ladder: stream hulls, tap parts, rest, Writ the pods, clean
kill in the zone. The spare route ladder: rest, tap guns off, graze the
cancelled bullets. The pure pacifist ladder: never fire, graze for rate, carry
the full charge to the Warden and keep it.

### Decision for Adam (one, before build)

Does disarming count as pacifist? Options:

- **(a) Yes, for scouts; no, for the Warden** (recommended). Matches the
  current code (`pacifistIntact` breaks on kill or Warden damage) and gives the
  no-kill route an active skill (Undertale's lesson). Any shot that hits the
  Warden still ends survival. Add a cheap `neverFired` flag so the Warden and
  the epilogue can tell a disarmer from someone who, like #0121, simply
  stopped ("You took their GUNS? ... Fine. They grow BACK.").
- **(b) No: pacifism means never firing.** Purer theme, simpler rule, but the
  no-kill route stays pure dodging plus graze.
- **(c) Three endings.** Out of slice scope.

## Tuning table (starting values)

| Parameter | Value | Note |
| --- | --- | --- |
| Tap-to-stream threshold | 8 ticks held | Press edge always fires one aimed round |
| Aimed round | 3 dmg, speed 14, radius 5 | Only aimed and Writ damage parts |
| Aimed round cooldown | 14 ticks | Stops tap-mashing beating the stream |
| Stream | 1 dmg per shot, every 7 ticks, spreads as now | Deals 0 to armored parts |
| Charge levels | 40 / 80 / 120 idle ticks | Idle = Fire released |
| Writ damage | 6 / 12 / 24, pierces | L3 radius 14 |
| Part HP | drone 2, dart 1 (nose), turret 6 (barrel), lancer 3 per emitter (2) | Turret hull stays 12 |
| Warden pods | 4 x 60 HP | Each deletes its pattern element |
| Kill zone | core x2 damage once 2 pods broken | Clean kill: final blow is a Writ |
| Graze distance | 26 units center to center | Hit at 11 (6 + 5); heavy 14 |
| Graze value | 5 pay x rate, +0.02 rate; heavy counts 2 | Once per bullet |
| Rate range | x1.0–x8.0 | |
| Rate gains | kill +0.10, part +0.20, disarm +0.20, clean kill +0.50 | |
| Chain timer | 150 ticks, refreshed by any gain or Warden contact | |
| Decay | -0.5 per 30 ticks after expiry | Not a full reset |
| Rate break | halve on player hit | Shield absorb: -0.5 only |
| Disarm bounty | 40% of kill value | The irony, in one number |
| Story difficulty | graze 34, chain timer 240, parts armor off | |

Sanity check: level 3 stream is 3 shots per 7 ticks, about 26 dmg/s, so the
900 HP Warden takes about 35 s of pure stream; pods (240 HP) and the kill
zone bring an expert kill to about 25–30 s, close to the 30 s pacifist clock.

## Tutorial teachability (the tutorial AI teaches each)

The tutorial is "knowingly overlong," so each system gets one step, gated by
the existing `nudge` mechanism, and one assistant line. New `vo/script.yaml`
lines are a request to the narrative workstream; drafts:

- **Tap and stream.** Step: destroy a practice drone with three single taps,
  then with a stream. Line: "A tap is a precision deliverable. Holding is a
  volume deliverable. Both are deliverables!"
- **Restraint charge.** Step: release the trigger until three pips light,
  then fire. Line: "Resting your trigger builds charge. We call it Trigger
  Rest, and it is not free forever." (The small wink candidate.)
- **Parts and disarm.** Step: a practice turret with a glowing barrel; tap it
  off and watch it leave. Line: "Disarmed assets retreat. You are paid
  forty percent for partial deliverables." Then the rule: "Stream for hulls,
  tap for parts."
- **Graze.** Step: focus, see the ring, let five slow practice bullets pass
  close. Line: "Near misses are billable. Please fly closer to danger."
- **Rate.** Step: chain three practice kills inside the timer. Line: "Your
  Contract Rate is going up. So is my opinion of you!" and on the scripted
  hit: "Rate break. Don't worry, the Authority is not upset. Yet."

Teaching order matches dependency: tap before parts, rest before Writ, focus
before graze, all before rate.

## Gameplay SFX cue list

Production notes: each cue is three layers (transient, body, tail) unless
noted; the sim emits events and the audio engine maps them, so every cue
below needs a matching `SimEvent` field. Voice limits matter: graze and
stream ticks are rate-limited and steal their own oldest voice; Warden and
player-hit cues have top priority and duck everything else in the SFX bus.
Payout cues quantize to the music's eighth note (Rez) when the music clock is
available, else play immediately.

| Cue id | Trigger | Sonic brief |
| --- | --- | --- |
| `fire_tap` | Aimed round | Tight, bright crack with a short metallic ring, like a staple gun in a hangar |
| `fire_stream_l1`–`l3` | Stream shot, by cannon level | Soft, fast plasma ticks; more voices and a wider stereo spread per level, never harsh |
| `fire_stream_tail` | Stream released | Short exhale and fan spin-down |
| `charge_pip_1`–`3` | Capacitor level gained | Rising glass tick, a fifth higher each pip |
| `charge_full_loop` | Charge at level 3 | Quiet, pulsing capacitor hum with a slight menace; ducks under VO |
| `writ_release_l1`–`l3` | Writ fired | L1 heavy thump; L2 thump plus tearing zip; L3 sub-boom, zip and a stamped-document clack |
| `shot_deflect` | Stream hits armored part | Dull ping, a thumb flicking a steel plate: says "wrong tool" |
| `part_hit` | Aimed or Writ damages part | Crisp ceramic crack, pitched by remaining part HP |
| `part_break` | Part destroyed | Snap, spray of small debris, electrical fizz |
| `disarm` | Enemy disarmed | Descending power-down sigh, then a small, relieved engine rev as it turns away |
| `bullet_cancel` | Disarm or kill cancels bullets | Shimmering glass-wind sweep, one per cancel event, not per bullet |
| `graze` | One graze | Tiny dry crackle near the ship; pitch climbs within a 30-tick streak |
| `graze_streak` | 10 grazes in a streak | Airy whoosh with a faint chime |
| `rate_tick` | Rate rises a step | Single marimba or mallet note on a rising scale, beat-quantized |
| `rate_milestone` | x2, x4, x8 | Cash-register chirp layered with a synth stab |
| `rate_decay` | Decay begins | Soft ticking clock fading in |
| `rate_break` | Rate halved by a hit | Descending minor chord, a receipt being torn |
| `pay_kill` | Kill pay credited | Small coin-like blip, panned to the kill |
| `pickup_spread` | Spread pickup | Upward synth arpeggio with a mechanical latch |
| `pickup_shield` | Shield pickup | Warm swelling chord, a bubble closing |
| `pickup_cache` | Sector 3 salvage cache | Crate creak and a hollow, lonely ping (leads into the flashback) |
| `shield_absorb` | Shield takes a hit | Heavy glassy thunk, shield shattering in a wash |
| `player_hit` | Life lost | Hull crunch, alarm blip, short muffled ring (tinnitus) |
| `near_death_loop` | Last life | Low heartbeat pulse under a filtered cockpit alarm, sidechained to music |
| `respawn` | Return to play | Clean ascending sweep, invulnerability shimmer loop while grace lasts |
| `game_over` | Run lost | Engine dies, one long flatline tone under "The lanes stay closed" |
| `drone_die` | Drone killed | Light pop and spinning-rotor wobble |
| `dart_die` | Dart killed | Sharp whip-crack and doppler fall |
| `turret_die` | Turret killed | Heavy metallic crunch, secondary ammo cook-off pops |
| `lancer_die` | Lancer killed | Electric zap-split, two halves fizzing apart |
| `enemy_fire_drone` | Drone shot | Small, bright, slightly comic peep |
| `enemy_fire_turret` | Turret burst | Muffled rhythmic thuds |
| `enemy_fire_lancer` | Lancer spread | Three-note buzz |
| `enemy_fire_heavy` | Heavy bullet | Deep woomph with a wobble |
| `warden_pod_hit` | Pod damaged | Ringing bell-metal clang, Warden-key tuned |
| `warden_pod_break` | Pod destroyed | Bell cracking, glass rain, a pained electronic yelp |
| `warden_pattern_lost` | Pattern element removed | The pattern's own fire sound plays once, choked off |
| `warden_zone_open` | Kill zone exposed | Rising tone and a soft lock-on beep loop |
| `warden_core_hit` | Core hit in zone | Fleshy, resonant thump under metal, uncomfortably organic |
| `warden_clean_kill` | Writ kill blow | All sound drops out for 6 ticks, then a single clean bell strike |
| `warden_hull_hit` | Core hit outside zone | Dull armored tap |
| `warden_phase` | Phase change | Ring hum shifting a semitone up, a furious inhale |
| `warden_survive_tick` | Pacifist clock, each 10 s | Ring chime, warmer each time |
| `boss_warning` | Siren | Kept from the original, layered with a sub rumble |

## Implementation cost estimate

- **Sim** (`src/sim/`, `src/contracts/`): about 500–650 lines plus about 300
  of tests. Trigger states S, graze S, rate S, enemy parts M, Warden pods and
  kill zone M. No new RNG draws, so seeds and replays stay valid; tuning lives
  in `tuning.ts` beside the rest.
- **Render and HUD:** part glyphs and sparks, capacitor ring, graze ring and
  sparks, rate numeral and ledger, kill-zone reticle: M–L.
- **Audio:** about 45 cues above, plus engine mapping from events: M.
- **Narrative and VO:** 5–8 new tutorial lines and 2–4 Warden barks in
  three languages through the existing pipeline: S.
- **QA:** a focused gameplay reel per system and a determinism test.

Roughly two to three focused subagent days for sim plus tests, and as much
again across render, audio and VO, in parallel.

## Status and next step

Tried: web research (sources linked above), a read of `tuning.ts`, the sim
head, `boss.ts`, `enemies.ts`, the bible's premise, cast and beat sheet. Not
tried: any prototype. Next step: Adam picks the disarm rule (a or b); then a
quick proof of concept of systems A and C only (the cheapest pair) in the
sim with a headless test, to feel the tap/rest rhythm before building parts.
