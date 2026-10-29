# Audio-visual design for the core loop: MOVE, SHOOT, DAMAGE

Night plan step 1 (`docs/NIGHT-PLAN.md`), October 29, 2026. Web research
only; no code was changed.

## Framing question

Adam's note: we drifted into lore, and the core verbs are MOVE and SHOOT to
cause DAMAGE. What do high-end shmups and action games do, in sound and
picture, so that (1) the ship's movement is felt (engine bed, start and stop
transients, focus mode, thruster puffs, trails, banking) without cluttering the
bullet field; (2) firing stays non-fatiguing at high rates across tap, stream
and Writ; and (3) damage reads incrementally (graze, hit, crit, part break,
kill; sparks, ricochets, shards, damage states), accessibly, and stays
readable when many things are hit at once?

Not repeated here (already covered): beat grid, two-layer SFX player, ducking
table and loudness targets (`research/2026-10-28-critique-audio/`); bolt
speed, recoil envelopes, shot trails (`research/2026-10-28-shot-feel/`); tap,
stream and Writ bolt looks and Writ knock
(`research/2026-10-29-bolt-identity/`).

### What the build already has (checked in source, so ideas below build on it)

- Hits: `stage.ts` spawns 3 cream sparks per hit (capped by
  `MAX_BURSTS_PER_FRAME`), a `hitPunch`, and a two-frame white flash on the
  instance's own materials (0.4 strength under reduced flashing).
- `gameplayAudio.ts` plays `hit_enemy`, `hit_boss`, `hit_deflect` (blocked),
  `kill_small`/`kill_large`/`kill_ram` plus a pitched `kill_note`, and
  `focus_enter`/`focus_exit`. Doppler and flybys exist in `spatial.ts`.
- `hitstop.ts`: 3 ticks (about 50 ms) on `kill` and `partBreak`.
- `flashGuard.ts`: WCAG 2.3.1 limiter for full-screen flashes.
- Movement: engine plume scale, banking (`-bank * 1.6`), and trail sparks
  drifting down-screen. **No engine bed sound, no acceleration-direction
  thrusters, no damage states keyed to hp, no debris on part break beyond the
  burst.**

## Findings: MOVE

**The player finds the ship through its own effects, not by looking at it.**
Boghog's CAVE-style design doc: "players won't have the time to look at their
ships"; they "estimate the ship's position based on the stream of bullets they
shoot out, the general silhouette of the ship and additional visual elements
near the ship" ([Boghog 101](https://shmups.wiki/library/Boghog%27s_bullet_hell_shmup_101)).
So anything attached to the ship (puffs, trail, plume) is a *position cue*
first and decoration second: it must hug the ship, be short-lived, and never
read as a bullet.

**Concrete movement polish from the same doc:** "beef up your shot/rate, add
an afterimage, match your ship's banking animation speed to movement speed,
have the ship leave trails (see Danmaku Unlimited 3), give your ship's options
some inertia." Focus speed of about **2/3 of normal** is "a good middle
ground", and the normal-to-focus transition is "usually (but not always, see
Touhou) interpolated".

**Engine sound as a state machine with continuous parameters.** A Sound
Effect's spaceship guide splits an engine into start, idle, loaded/thrust, an
optional "stutter" layer for moving parts, and a rumble/LFE layer; its
functional rule is that the sound "should convey the engine state: is it
loaded or idle? ... reflect the levels of thrust and speed. It can also
indicate any quick manoeuvre." For real-time control it suggests "3–4 levels
of engine thrust roar and 3–4 states of turbine sound plus a pitch shifter on
each layer", or, cheaper, "dynamic pitch shifting and low-pass filtering on
static sounds" ([A Sound Effect](https://www.asoundeffect.com/stellar-spaceship-sound-effects)).

**Map speed to 0–1 and barely smooth it.** Disasterpeace's wind system for
Epic's Lyra maps speed to 0–1 (run = 0, dash = 1) and the value "is only
mildly interpolated so that you still get a quick reaction time ... less like
wind and more like air moving quickly past your head"; panning comes from a
left/right ratio ([Disasterpeace](https://disasterpeace.com/blog/tag.sound+design.implementation)).
Lesson: the engine bed's attack must be fast (tens of ms) or it reads as lag;
release can be slower.

**Responsiveness budget.** Swink: real-time response means the computer's
half of the correction cycle fits under about **100 ms**
([Liz England's review of Game Feel](https://lizengland.com/blog/review-game-feel-by-steve-swink)).
Polish is "the interactive impression of physicality created by the harmony
of animation, sounds, and effects with input-driven motion"; list the cues and
"sort them in order of importance to the physical impression"
([Swink, Game Feel: The Secret Ingredient](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient)).

**Motion particles carry physicality.** Swink's polish tables praise "gentle
puffs of dust at each footfall" and a trail that "follows Soma's every
movement, enhancing the impression of speed"
([Game Feel ch. 9 excerpt](https://gamifique.files.wordpress.com/2011/11/2-game-feel.pdf));
Juice It or Lose It and GMTK both name dust/particles at contact and on
movement as core juice
([Jonasson and Purho](https://www.youtube.com/watch?v=Fy0aCDmgnxg);
[GMTK](https://www.youtube.com/watch?v=216_5nu4aVQ)).

**Returnal: let gameplay events push the effects around.** Housemarque's
fluid module lets "any gameplay event ... add forces to the fluid simulation
causing nearby vfx elements to react", e.g. a radial impulse when an enemy
lands ([Returnal VFX breakdown](https://housemarque.com/news/2021/9/15/returnal-vfx-breakdown)).
A cheap analogue for us: the ship's acceleration nudges nearby smoke and
spark particles.

Anti-patterns (MOVE): movement effects that share hue, value or shape with
enemy bullets; long-lived exhaust that clutters the lane behind the ship (in a
vertical shmup that is exactly where the player looks); an engine loop that
is constant regardless of input (it becomes noise, see the nuisance score
below).

## Findings: SHOOT

**Numbers from Nuclear Throne's pistol** (Nijman to
[Rock Paper Shotgun](https://www.rockpapershotgun.com/interview-jan-willem-nijman-on-nuclear-thrones-feel)):
sound first; a shell ejected at **2–4 px/frame** (30 fps, 320x240) at
**100–150°** off the aim; bullet at **16 px/frame** with **0–4°** spread;
camera kicked back **6 px**; "add 4 to the screenshake", which "degenerates
quickly"; weapon sprite kicked back **2** px then slides back. Projectiles
"look huge (about the same size as the players)" and "communicate clearly
(with some animated effects) when hitting something". The most important
factor: "probably sound ... A good, punchy, bassy gunshot does wonders."

**Gun sound anatomy.** Chuck Russom: three layers, Mech, Body, Punch (bass),
plus sweeteners; "the player's guns need to be the coolest sounding guns in the
game"; AI guns "should not overtake the player's" but being shot at "should
not be a relaxing experience"; neglect the tail and "they will all sound very
similar" ([Designing Sound](https://designingsound.org/2010/04/29/chuck-russom-special-gun-sound-design)).
Mark Kilborn (Call of Duty) uses five: transient, body, sub, mech, tail
([video](https://www.youtube.com/watch?v=e7U3NDRBeO8)). Joonas Turner
(Nuclear Throne) layers an extra click into the attack of *every* gun
([Game Jolt summary of his GameCity talk](https://gamejolt.com/p/the-sound-of-nuclear-throne-think-the-sound-effects-in-nuclear-thr-wydmhauv)).

**High rate of fire: start, loop, tail, and a stable clock.** For automatic
fire, consider "a short voice cap, rate control, or a looped firing layer
while preserving distinct start, stop and impact cues"
([SfxMaker on voice limiting](https://sfxmaker.org/blog/how-to-implement-sound-prioritization-and-voice-limiting-in-games.html)).
Epic's GameSoundCon 2022 Lyra talk shows the trap of frame-locked fire: at 37
fps a weapon fired at 135 ms "but every ninth shot will be 162 with the
hiccup", fixed by scheduling on an audio-rate clock (Quartz)
([GameSoundCon](https://www.youtube.com/watch?v=LRlWd_m7q6U)). This matters
for Chromebooks: schedule stream shots on `AudioContext` time from sim tick
time, not from whenever the render frame sees the event.

**Fatigue is a measurable bug.** A Sound Effect's "nuisance score" turns
repetition and unexpected drop-outs into tracked bugs, fixed by layering and
randomization, but warns some sounds "need repetition, to provide that safety
of recognition" ([A Sound Effect](https://www.asoundeffect.com/game-audio-immersion/)).
For shmups: player shots are quiet and constant, and enemy fire is sparse and
distinct (already in the critique-audio note).

**DOOM's opposite policy, and why we should not copy it.** id's audio
director decided "the weapons were really the main character ... Weapon sounds
never get ducked by anything, not even VO"
([ADSR Q&A](https://www.adsrsounds.com/news/the-sound-design-of-doom-exclusive-qa)).
That fits a power fantasy without dense enemy fire; in a shmup the player's
stream is the most frequent sound and must sit under threat cues. Keep the
DOOM rule only for the Writ release.

**Muzzle language.** Nijman's talk adds a muzzle flash, bigger and faster
bullets, and impact effects so "bullets stop disappearing"
([Art of Screenshake](https://www.youtube.com/watch?v=AJdEqssNZ-U)). Boghog:
"a fast bullet is a powerful bullet, especially if you combine it with an
appropriate bullet splash effect"; elongate fast projectiles; make streams
dense and a bit messy.

## Findings: DAMAGE

**Every contact must show.** "All bullets should have a ricochet/splash
effect when hitting something" or it "feel[s] like ... they're passing under
the enemy"; "If an enemy doesn't flicker or shake or shoot sparks when being
shot, I can only assume that it is invulnerable"; and "the whole thing doesn't
need to flash white (it really hurts the eyes with bosses)". If an enemy is
truly invulnerable, "don't change a thing about it"
([The Anatomy of a Shmup](https://www.gamedeveloper.com/design/the-anatomy-of-a-shmup)).
Boghog adds "subtle hit sound effects" and explosions "significantly bigger
than the enemy sprite", with extra debris. The Shmup Workshop video adds:
explosions need "very few startup frames", "quick shock waves" for the first
impact, lingering flames after, an explosion large enough to cover the
vanishing enemy, and screen shake and pauses kept for elite deaths because
they "disorient the player" ([Shmup Workshop 04](https://www.youtube.com/watch?v=999tBKu8hNE)).

**Readability beats spectacle, with a cautionary tale.** In Battle Garegga,
"exploding enemies and objects also create flying debris, further camouflaging
incoming fire"; the Type 2 revision replaced standard bullets with yellow dots
([Wikipedia](https://en.wikipedia.org/wiki/Battle_Garegga)), and a Rev.2016
reviewer still found "a ton of onscreen shrapnel" that bullets resemble
([VideoChums](https://videochums.com/review/battle-garegga-rev2016)). The fix
is draw order and value: "Enemy bullets should always be drawn on top of other
game objects such as player sprites, projectiles, items and explosions";
bullets pair bright cores with dark rims; reds, pinks and purples are used
because yellow and orange "overlap with explosions and golden items" (Boghog).
Returnal codes reaction by colour (orange slow space-fillers, blue direct
threats) ([PlayStation Blog, Hyperion](https://blog.playstation.com/2021/05/28/returnal-the-making-of-that-unforgettable-hyperion-fight));
Resogun kept "a clear contrast between bright gameplay and dark background
elements" ([Resogun postmortem](https://www.gamedeveloper.com/business/the-game-is-the-boss-a-i-resogun-i-postmortem)).
Rule for debris: dark, matte, non-emissive, and never in a bullet hue.

**Visible incremental damage changes feel even when purely cosmetic.** Hugo
Martin on DOOM Eternal's destructible demons (armor peeled away, limbs lost):
"It is cosmetic ... but it also has ... tremendous impact on the feel of the
game"; in DOOM 2016 "you just can shoot him to high heaven and nothing
happens" ([PC Gamer](https://www.pcgamer.com/hugo-martin-doom-eternals-destructible-demon-system-makes-such-an-impact-2016s-doom-is-now-hard-to-play)).
id's GDC talk on DOOM 2016 reorganized hit reactions "according to their
impact on gameplay instead of some visual thing"
([Embracing Push Forward Combat](https://www.youtube.com/watch?v=2KQNpQD8Ayo)).
Resogun's detached voxels "are not just particle effects ... they are actual
individual cubes" with physics
([GamingBolt](https://gamingbolt.com/resogun-interview-physics-destruction-gameplay-features-and-ps4-development));
Nijman's list includes *permanence*: leave marks in the world.

**Hitstop: scale with damage, cap it, skip it for crowds.** Sakurai: both
parties freeze "for the exact same amount of time"; "the more damage an attack
inflicts, the longer the hitstop"; he caps the maximum freeze; Dynasty
Warriors uses little hitstop "because you attack large groups of enemies at
once"; the victim vibrates *visually* while hurtboxes stay put; vibration
amplitude scales with camera distance
([Source Gaming translation](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1)).
In the video version he blends out of the freeze over about 4 frames and
suggests shmups use hitstop at the moment the player is hit, citing Fantasy
Zone ([Eight Hit Stop Techniques](https://www.youtube.com/watch?v=tycbMSjDDLg);
[Stop for Big Moments](https://www.youtube.com/watch?v=OdVkEOzdCPw)).
Typical figures: "40 to 80 milliseconds"
([Egmatic](https://egmatic.com/blog/how-to-make-your-game-feel-good)); a
student write-up of Nijman's demo reports a sleep near 0.2 s on hits
([Weidar](https://victorweidar.wordpress.com/2016/10/06/the-art-of-screenshake)),
far too long for a bullet field.

**Hit spark timing.** A RealtimeVFX critique praises "the white flash, into
the black flash, into the ramp down timing of the rest of the elements", and
advises separating primary and secondary elements by narrowing one element's
value range ([RealtimeVFX](https://realtimevfx.com/t/stylised-explosive-and-fiery-hit-spark-looking-for-feedback/11286)).
Small hit-spark sprite sets run **6–8 frames** at 80 ms per frame
([itch.io pack](https://pimen.itch.io/battle-vfx-hit-spark)), i.e. about
0.5 s; at 60 fps gameplay a tighter 0.1–0.25 s is common (inference).

**Hit confirmation as a sound family.** Overwatch's "hit-pip" sizzle on every
connect, with a distinct crit sound, is so legible players cite it as the most
satisfying cue ([Random Nerds](https://randomnerds.com/the-cinematic-life-saving-sounds-of-overwatch)).
Helldivers 2 aims for players to identify equipment "without visual
reference", builds explosions as attack, body and tail, and runs "a
hierarchical system of slow-moving integrated loudness control, volume
ducking, and dynamic EQ which enabled explosions to always feel punchy"
([A Sound Effect](https://www.asoundeffect.com/helldivers-2-game-sound-design)).
Sakurai's "Audio as Fiction and Non-Fiction": realistic impact sounds often
make hits feel weightless; exaggerate
([TV Tropes summary](https://tvtropes.org/pmwiki/pmwiki.php/WebVideo/MasahiroSakuraiOnCreatingGames)).
The armored "tink" is a named convention ("Sound of No Damage")
([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/SoundOfNoDamage)).

**Many hits at once.** DICE HDR: "every sound is important, but not at the
same time"; loudness tags act "as a measure of priority"
([Designing Sound](https://designingsound.org/2013/06/21/finding-your-way-with-high-dynamic-range-audio-in-wwise/)).
SfxMaker's policy: protect information the player needs; cap per event, per
category, then globally; for short transients use "a brief cooldown or a small
overlap cap" and prefer rejecting the new instance to cutting the playing one;
represent crowds of impacts by "a few selected impacts, a shared debris layer,
or a quieter cluster sound"; steal "the quietest or least audible". Darren
Korb on Hades: less important sounds "can just go away when there is a ton of
stuff happening", while "an enemy targeting you with a reticle on you should
be super loud no matter where they are"
([TSAP interview](https://www.youtube.com/watch?v=WpXnFH1lMmQ)).

**Flash conventions and their accessibility limits.** Game Accessibility
Guidelines: avoid flicker and repetitive patterns, cite area thresholds of
25%/40% of a typical display, never call anything "epilepsy safe", and name
the setting by what it does ("screen flash effects", "effects intensity")
([GAG](https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/)).
Microsoft recommends a flashing toggle and even defaulting it off
([Microsoft Learn](https://learn.microsoft.com/en-us/windows/uwp/gaming/accessibility-for-games)).
Can I Play That documents how pervasive bright white intercut flashes have
become and that photosensitivity is wider than epilepsy
([CIPT](https://caniplaythat.com/2020/12/09/its-next-gen-and-flashing-effects-are-still-hurting-players)).
Practical alternative cues that survive grayscale and muted play: silhouette
squash, outline pulse, knock, hit shape, a short pause
([AI Game Builders](https://aigamebuilders.com/blog/ai-game-damage-feedback-prototype)).

### Anti-patterns (DAMAGE)

- Full-body white flash on a large boss at stream rate (painful, and with our
  12+ hits per second it becomes strobing).
- Debris or smoke in bullet hues, emissive, or drawn above enemy bullets
  (Garegga).
- One identical hit sound per bullet with no cap (machine-gun buzz, masks
  threats).
- Hitstop on every hit (Dynasty Warriors rule) or long sleeps (0.2 s).
- Armor that looks identical when hit as flesh does (the player cannot learn
  where to aim), or the reverse: invulnerable states that still sparkle.
- Damage communicated only by hue (red tint) without shape or motion.

## Ranked ideas for Neon Warden (12)

Costs: S under half a day, M about a day, L more. All are render, audio or
asset work; none needs sim changes (views already expose `hp`, `maxHp` and
player `vel`; events carry `blocked`, `partBreak`, `focusChanged`).

1. **Velocity-driven engine bed (Web Audio synth).** What: two continuous
   layers in `synth.ts`: an idle hum (filtered saw or noise around 80–160 Hz)
   and a thrust layer (band-passed noise) whose gain, pitch (±3 semitones) and
   low-pass cutoff follow normalized speed and acceleration magnitude; pan by
   ship x; focus mode narrows the band and drops it 4–6 dB. Attack smoothing
   about 30 ms, release about 150 ms (Disasterpeace: "only mildly
   interpolated"). Why: we have no movement sound at all; it is the cheapest
   way to make MOVE felt. Cost: M. Readability risk: low if it sits at about
   -26 dB under stream fire and ducks under VO and threat cues. Accessibility:
   own slider in the audio mix (or under SFX); it is also a non-visual
   position and speed cue for low-vision players.
2. **Acceleration-direction RCS puffs plus start/stop chuffs.** What: from
   interpolated player velocity, compute acceleration each frame; when its
   magnitude crosses a threshold, emit 2–4 tiny puffs from the hull edge
   *opposite* the acceleration, life 0.12–0.2 s, low-alpha desaturated
   cyan-white, drawn under every bullet; reversal and full stop trigger a
   short noise "chuff" (under 60 ms, -18 dB) panned to the puff side. Why:
   shows thrust direction at the ship, where the eye already estimates
   position (Boghog). Cost: S–M. Risk: medium; mitigate by additive-off,
   value well below bullet cores, and a per-second puff cap. Accessibility:
   reduced motion keeps puffs but halves count and life; no luminance flash.
3. **A hit-confirmation ladder as data.** What: one table mapping graze < hit
   < deflect < weak-point or Writ crit < part break < kill (small, large) <
   boss phase to a sound family, a visual verb, a priority, a voice cap and a
   hitstop value. Each rung must differ in at least two channels (sound plus
   shape or motion), never only in hue. Why: legible hierarchy is the core of
   Overwatch's hit-pip and Helldivers' identify-by-ear goal, and it is
   teachable for students. Cost: S (table) plus tuning. Risk: low.
   Accessibility: ladder documented in the controls/accessibility screen text
   later; every rung survives muted and grayscale play.
4. **Impact voice manager (cluster, cap, steal quietest).** What: per-role
   caps (`hit_enemy` 3, `hit_boss` 2, `hit_deflect` 2), a 35–50 ms per-target
   cooldown, and when several hits land in one tick, one "cluster" voice whose
   gain and brightness scale with hit count instead of N voices; steal the
   quietest; never steal `hit_player`, enemy-fire tells or the Warden's
   telegraphs (Korb's rule). Pool visual bursts the same way (merge
   same-target bursts within a frame). Why: stream fire at full power makes
   the machine-gun buzz SfxMaker and HDR warn about. Cost: M. Risk: reduces
   clutter. Accessibility: fewer, clearer sounds help auditory processing; no
   setting needed.
5. **Progressive damage states from hp fraction.** What: render-only states
   per enemy and per boss part: below 66% a scorch (emissive trim dims, hull
   darkens), below 40% intermittent spark spits (1 every 0.4–0.8 s, 2–3
   sparks), below 20% a thin smoke wisp trailing down-screen; boss parts also
   gain a crack decal. Why: DOOM Eternal shows cosmetic degradation changes
   feel; it tells the player a target is nearly done without a health bar.
   Cost: M. Risk: medium; smoke must be dark, low alpha, under bullets,
   capped (e.g. 24 wisps on screen). Accessibility: states differ by shape and
   motion, not colour; reduced flashing turns spark spits into steady glints.
6. **Shards on part break.** What: 6–12 instanced shards in the part's own
   dark hull colour, initial velocity outward plus the scroll direction, slow
   spin, gravity-like drift down-screen, life 0.6–1.0 s, fade by size not
   brightness; a heavier metallic "clank" one-shot. Global cap about 64
   shards; low tier 4 per break. Why: Adam's "shards falling off"; Resogun and
   DOOM Eternal sell destruction with real fragments. Cost: M (Blender shard
   meshes or procedural). Risk: Garegga camouflage, so: matte, non-emissive,
   never cyan or pink, drawn under bullets. Accessibility: reduced motion
   shortens life and drift.
7. **Ricochet for blocked hits.** What: on `hit` with `blocked`, a glancing
   spark streak reflected about the surface normal (2 streaks, 80–120 ms) plus
   a bright short "tink" (random pitch ±2 semitones), visually distinct from
   the cream damage splash; no flash, no hitPunch. Why: makes armor legible
   so the player learns to aim at parts ("Sound of No Damage" convention;
   Anatomy of a Shmup: show contact, but do not fake damage). Cost: S. Risk:
   low. Accessibility: shape plus sound, not colour.
8. **Stream as start, loop, tail; tap as one-shot with a click; Writ owns the
   sub.** What: stream fire becomes a start transient, a looped or
   granular-retriggered body scheduled on `AudioContext` time from sim ticks,
   and a release tail on stop; tap is a single bright one-shot with Turner's
   attack click; only the Writ release gets the sub/punch layer and is never
   ducked (DOOM's rule, scoped to one sound). Round robin ±1 semitone and ±1.5
   dB. Why: fatigue and frame-jitter at high rate (Lyra's 135 vs 162 ms
   hiccup) on low-end Chromebooks. Cost: M. Risk: low. Accessibility: the
   tail confirms release for players who cannot see the bolt.
9. **Hitstop ladder with a cap and a crowd rule.** What: extend
   `hitstopFor`: 0 for hits, 2 ticks for part break, 3 for small kills only
   when nothing else froze in the last 250 ms, 4–5 for Writ-level-3 kills and
   boss phase changes, and a ceiling of about 8 frozen ticks per second; during
   the freeze, vibrate the victim's mesh only (Sakurai), and ease out over
   about 4 frames of render time. Why: weight without stutter in dense waves.
   Cost: S. Risk: low; must not freeze during enemy-bullet-dense moments the
   player is threading (consider skipping when a bullet is within the graze
   radius). Accessibility: reduce motion keeps the freeze but drops the
   vibration; a "hit pause" toggle would be honest.
10. **Localized flash instead of full-body white.** What: replace the
    whole-material white flash with a rim or fresnel emissive pulse limited
    to the hit part (boss) or the hull edge (scouts), 2 frames at most, and
    rate-limit per target to once per 100 ms so stream fire does not strobe;
    under reduced flashing, swap luminance for a scale punch plus an outline
    thickening. Why: Anatomy of a Shmup's "it really hurts the eyes with
    bosses"; GAG area thresholds. Cost: S–M (shader tweak). Risk: low.
    Accessibility: setting named "Hit flash effects", consistent with GAG.
11. **Banking, trail and focus tied to motion.** What: bank rate matched to
    lateral speed (Boghog), trail spark count and length proportional to
    speed (none at rest), and on focus: trail shortens, engine bed narrows,
    the hitbox reveal eases in over about 100 ms. Why: makes slow precise
    movement feel deliberate and fast movement feel fast, using cues the
    build already has. Cost: S. Risk: low. Accessibility: reduce motion caps
    bank angle.
12. **Permanence on the Warden.** What: scorch and crack decals accumulate
    where hits land on boss parts and persist for the fight; broken parts
    leave a smoking stub. Why: Nijman's permanence; the over-acted boss shows
    the fight's history, which also feeds the morally gray ending (the
    Warden visibly wounded). Cost: M. Risk: low if decals are dark and
    matte. Accessibility: no motion or flash involved.

Suggested first slice for step 4 (inferred): 1, 2, 4, 7 and 10 are the
smallest set that covers MOVE, SHOOT feedback and DAMAGE readability; 5 and 6
are the "incremental damage" headline and need the voice and particle caps
from 4 first.

## Status

### Read (fetched and trimmed in a script, quoted above)

Rock Paper Shotgun (Nijman), Anatomy of a Shmup, Boghog 101 (three
sections), A Sound Effect (spaceships; immersion and fatigue; Helldivers 2),
Designing Sound (Russom; HDR), SfxMaker voice limiting, Source Gaming
(Sakurai hitstop column), Resogun postmortem, Returnal VFX breakdown,
PlayStation Blog (Hyperion), Disasterpeace (Lyra wind), Can I Play That, Game
Accessibility Guidelines, ADSR (DOOM), RealtimeVFX hit-spark thread, Swink's
Game Feel article, Egmatic, Battle Garegga (Wikipedia), PC Gamer (DOOM
Eternal), Valdemird (web game feel; little used). 22 pages.

### From search-result excerpts and transcript snippets only

Art of Screenshake transcript, Juice It or Lose It, GMTK, Sakurai's two
hitstop videos, GameSoundCon Lyra weapons talk, Kilborn gun layers, Joonas
Turner click layer (Game Jolt), Shmup Workshop 04, Korb on Hades (TSAP), id's
DOOM GDC talk, Overwatch hit-pip (Random Nerds), Microsoft Learn,
AI Game Builders, VideoChums Garegga review, GamingBolt Resogun, Weidar,
itch.io hit-spark pack, TV Tropes (two pages), Liz England's Swink review,
Swink ch. 9 excerpt. 21 items, lighter weight: treat as pointers.

Not read (blocked or empty): shmuplations Ikaruga interview (403),
sound.stackexchange Cave gunfire and fast-gun threads (403), DoomWiki
destructible demons (empty extract). No GDC Vault talk was watched in full;
Nex Machina and Cuphead yielded nothing specific beyond reviews.

### Inferred, not sourced

Every specific number in the 12 ideas (frequencies, caps, cooldowns, decay
times, shard counts, hp thresholds, hitstop ladder values) is my proposal,
calibrated to the sourced ranges above and to our 60 Hz sim, not quoted. The
claim that frame-locked stream audio will jitter on Chromebooks is inferred
from the Lyra talk, not measured on our build. The DOOM "never duck weapons"
rule is judged unsuitable for shmup streams by inference from the genre's
quiet-player-shot convention.

### Next step

Step 2 (Argon blind ideation) should be shown clips without this list, so its
ideas are independent; step 3 then intersects both. Before implementing 5 and
6, add a QA check that renders a dense wave and measures how much screen area
debris and smoke cover near enemy bullets (a Garegga regression test).
