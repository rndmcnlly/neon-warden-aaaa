# Raid: _The Writer Will Do Something_ (TWWDS)

October 29, 2026. A source raid, not a working session: what story lives in
Matthew Seiji Burns and Tom Bissell's TWWDS (2015), and ten ideas it could
kick into Neon Warden. Frame for this raid, per the Enclosure spine:
TWWDS is the best-known fiction *about* the machinery Neon Warden satirizes
from inside (disposable labor, meetings, the industry that makes the games
young players love). If the Warden's tragedy is enclosure of a commons, TWWDS
is enclosure of authorship: a room of people who all hate the same game but
cannot stop it. What follows asks what a shmup can steal from a 10-minute
Twine meeting, and at what cost to the "authentic vertical slice, not
parody" framing.

Disciplines in play: dramatic writing (constraint, dramatic irony), game
narrative (choice semantics, endings), interactive fiction theory
("uninteractivity" as a deliberate device), and industrial sociology
(process-as-monster).

## What TWWDS is (sourced)

- A Twine interactive fiction, co-written by Matthew S. Burns and Tom
  Bissell, first released around March 29, 2015 (Kotaku metadata;
  [IFDB](https://ifdb.org/viewgame?id=qle7qs6w25vqb5dg) credits both authors,
  2015, estimated play time about 10 minutes). It now lives at
  [matthewseiji.itch.io/twwds](https://matthewseiji.itch.io/twwds), rated 4.6
  of 5 across 465 ratings, tagged Story Rich / Text based. (Read.)
- Burns is himself an ex-AAA producer (Treyarch, Bungie, 343 Industries
  before his Zachtronics writing career: [Origin Story
  interview](https://www.originstory.show/episodes/matthew-seiji-burns),
  2021). Bissell wrote on Uncharted 4, Battlefield Hardline, The Witness
  ([Wikipedia, Tom Bissell](https://en.wikipedia.org/wiki/Tom_Bissell)).
  Reviewers read it as a Take That aimed partly at Bungie and *Destiny*
  ([TVTropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/TheWriterWillDoSomething),
  citing a Game Rant piece). (Read; the Destiny reading is the reviewers',
  not the authors', stated intent.)
- Burns discussed TWWDS in a September 2026 My Perfect Console episode with
  Simon Parkin (episode 184), alongside his novel *Process*. (Read only as
  listing/summary; not the full transcript.)

## Its story (as far as I could reconstruct from reviews and pages; I did not run the game)

- **Premise:** The year is 2012. You are the lead writer of *ShatterGate:
  Future Perfect*, the third game in a wildly popular sci-fi shooter
  franchise. Playtests say it is terrible "in every way." Six months before
  ship, an emergency meeting is called (itch.io description; IFDB). (Read.)
- **The meeting is the game.** The whole piece is one morning: managers
  (Shawn, Mike, Troy, Josh, Erika, Drew) circling endlessly through proposals
  for the opening, "visual quilts", Dark Souls comparisons, Star Wars opening
  scrolls, a Gunsword, alien girlfriends, and "absolutely no real progress"
  ([SPAG, Morayati, May 2015](http://www.spagmag.org/issue-62/the-writer-will-do-something-matthew-burns-review);
  TVTropes). (Read.)
- **You are an impostor among impostors.** The player-character has never
  played the earlier games, and was hired to clean up after the previous
  lead writer, who was hired under identical terms (TVTropes, "High Turnover
  Rate"; SPAG). (Read.)
- **Choices do nothing, on purpose.** Keep your head down or stand up:
  nothing changes. Three endings arrive with a horror-movie sting, seemingly
  uncorrelated with anything you said; the reviewer "cannot win"
  (SPAG). Ends are bittersweet at best: continue in the profession, or be
  promoted onto the next franchise entry you hate (TVTropes). (Read; the
  "seemingly random" bit is the reviewer's read.)
- **The setpiece:** near the middle, after an attempted grand statement, the
  screen fills with the PC's inner argument, over 500 words scrolling
  faster than anyone can read, and then: "'I vote cold open,' says Shawn,
  before you can speak" (SPAG quoting the game; also TVTropes'
  "UnreadablyFastText" entry). (Read.)
- **The pressure from outside the room:** the audio department (which was
  not invited) reality-checks every plan: the celebrity voice actor is off
  shooting a Wes Anderson film, so dialogue cannot be re-recorded; the
  audio producer Mallory is the only person in the room with real
  constraints (SPAG; TVTropes). (Read.)
- **Tone:** funny, polished, "an exercise in calculated frustration." The
  title is the tell: *the writer will do something* (SPAG). The meeting
  itself argues about player satisfaction, tutorials ("Shawn thinks
  tutorials are 'a betrayal of the language games are supposed to
  speak'" per TVTropes), cutscenes nobody watches, and the gap between
  "gritty" aspirations and a world with Gunswords and alien dating. (Read.)
- One comment thread notes the PC's gender is never stated but one line
  implies "for herself", and that the way everyone talks over the PC reads
  as a workplace-gender subtext (SPAG reader comment). (Read.)

**Where I am inferring:** I did not play the HTML file (per raid rules). The
ending specifics beyond TVTropes' summary, the exact branching map, the
content of all three endings' prose, and the commentary audio are inference
from these sources. I quote only short phrases above and link the source.

## Ideas for Neon Warden (10)

House rules for the ideas: no mocking the game or the player (tone rule 1),
the Warden's facts always true (rule 4), endings show numbers, never scold
(rule 5), and the tutorial keeps exactly one wink (rule 2).

### 1. The parley where the room won't stop talking over you

**From TWWDS:** the UnreadablyFastText setpiece: your inner monologue builds
to a grand statement while the meeting moves on without you ("I vote cold
open . . . Next issue?").
**In Neon Warden:** a *reverse* of the SPAG scene: the Player is invited to
choose during the Warden's descent parley (the invulnerable, weapons-hold
phase on `boss.parley`) and the choice widget genuinely waits, but the
Onboarding Assistant keeps advancing the Authority agenda over the silence:
ship-scan updates, payment vesting percentages, "please hold." The player can
violate the parley (e.g., scan the Warden's core) and if they act, the
assistant talks *over the Warden* mid-line, which reads like the room that
never listened to the writer. On the pacifist route the player's refusal to
grab the choice bar becomes the loudest statement in the game.
**Cost:** low, systems-cheap: it reuses `waitFlag` and the assistant's bank;
needs sim support for choice input during parley. **Pacifist interaction:**
strengthens it; the whole game is about acts, not declarations (the Pilot is
silent on purpose), so a widget everyone expects to matter being the place
the player proves they don't need it is the right joke. **Verdict: strong
pick, top 1.**

### 2. Endings that reclassify your run in language the Authority chooses

**From TWWDS:** three endings that feel uncorrelated with what you chose,
which is the parody's point: the process, not your agency, writes the
epilogue.
**In Neon Warden:** the ending tally already shows stats ("Scouts lost: N,
Pilots spent: 122"). Add a second ending layer the Authority files for ITS
purposes: the same run gets stamped with an internal document title, e.g. a
mostly-victorious kill run capped by a huge scout-loss count files as
"COST PROFILE UNFAVORABLE, PILOT NON-CITED"; the ghost run with zero shots
files as "ASSET ELIGIBLE FOR RETENTION". The *world's* epilogue (tollgates or
free sky) never changes; only the paperwork's framing of the same facts
swerves. This keeps the Warden-reading folk (rule 5: shown not scolded) and
adds a second gaze, the institution's gaze, which was always the real
subject.
**Cost:** only writing plus one flag-gated pass over the ending scenes.
**Pacifist interaction:** the pacifist wall of text becomes the Authority's
bookkeeping problem, mirroring `rec_ai_002`'s "not relevant" filing. Strong
pick, top 2.

### 3. The uninvited department reality-checking the fantasy

**From TWWDS:** Mallory, the audio producer nobody invited, who keeps
pointing out real constraints (the voice actor is filming with Wes
Anderson so the plan is impossible) while the room dreams of visual quilts.
**In Neon Warden:** one comms voice outside the Authority hierarchy whose
lines exist to contradict the fantasy: the Warden's own radio, the scouts,
already does this (grown, not built; no-first-fire). But there's an
unclaimed slot: the *contract-terms ticker*. Have Lane Control's paperwork
occasionally collide with the Assistant's script in one line: e.g., during
the briefing reel a delayed `radio.*` line arrives out of order with the
actual pay schedule, so the "hero" of the threat-briefing is revealed to
also be a program whose funding is being voted on. Small, weird, honest.
**Cost:** low, writing-only. **Pacifist interaction:** neutral-to-positive;
it reinforces the institution-not-individual reading. Worth doing but more
subtle than #1/#2: weaker pick.

### 4. The meeting nobody attends twice

**From TWWDS:** the game is one meeting, replayed until you "win" (you
cannot). The interactivity is the sensation of being able to speak and the
discovery that the meeting cannot hear you.
**In Neon Warden:** the warden-descent parley currently runs once. Consider
a restart affordance inside the parley (a "log back in" UI option; identical
shock, the assistant's voice-slide: "Resuming. You have one (1) conversation
remaining.") on the kill route only. The Pacifist has no replay affordance:
the ghost run does not ask twice. This makes the *inability* to redo the
conversation thematically loaded (the Pacifist survived but cannot
backpedal) and the kill-route reload feel like the meeting in TWWDS,
re-entered, still wrong.
**Cost:** low; reuses restart flow and banked line. **Pacifist
interaction:** careful: the last thing this game wants is "you chose wrong,
retry" signage. Marking **tempting but wrong** specifically because the
UI affordance reads as "wrong ending, do over", which violates rule 5
(shown, not scolded) and the "authentic slice" frame: a real shmup doesn't
gate your reflexes behind a lore-consistent restart. Defer.

### 5. Numbers that end as evidence, not score

**From TWWDS:** the "3 endings, feel uncorrelated to your choices" quality
routes through one mechanism: the institution's definition of success
overwrites the player's. The ending authority is a third party.
**In Neon Warden:** the ends tally currently reads like a shmup terminal.
Recast the same numbers verbatim as a filed record the Lane Authority reads
out over the credits, in exactly the tone Lane Control already uses ("Pilot
zero one two three is ready in onboarding"): same digits, opposite gazing.
The pacifist ending's "Pilots kept: 1" is the Authority's first use of the
word "kept" in 300 years of "spent". Relationships between the two endings
become visible in the language, not the stat.
**Cost:** writing-only. **Pacifist interaction:** very strong: it's the
one place the Assistant or the ending TTS is allowed to sound *almost*
moved, without breaking rule 3 (banal, never sinister). Strong pick, top 3.

### 6. The voice actor who is unavailable

**From TWWDS:** the celebrity voice actor of ShatterGate is off doing a Wes
Anderson movie, so dialogue cannot be re-recorded; the plan collapses. A
system constraint blocks a narrative ambition.
**In Neon Warden:** the Pilot is famously silent ("at most one line, spent
once"). Lean in: the pilot doesn't speak because, per contract clause, VO
budget for Pilot is not approved. Give this a beat, not a joke: during the
pacifist descent, the voiceless Pilot tries to speak and the Assistant
apologizes: "Reminder: contract does not cover freelance emotional support."
It costs one `ui.string` and one banked line. **Pacifist interaction:**
strong; it recontextualizes the silent protagonist as contracted silence,
which is the Authority's real crime. Is it too winky? The wink is at the
contract, not at the player, so it respects rule 1, but don't spend it near
the serious beat: park it in the tutorial or radio only.

### 7. Grief translated into metrics

**From TWWDS:** emotions grieve in meeting language ("Your mind is a bright,
glittery cascade of thoughts . . . you're not able to isolate any single
one"). SPAG quotes that style of rapid interior cascade, enforced
unreadability, as the piece's most maddening trick.
**In Neon Warden:** the pilot's stats terminal displays its feelings as
metrics that *never explain themselves*: "FLEET INTEGRITY: 111", "STRIKES:
0", "LANES: open (subscription required)". When the player's performance
really dips in the pacifist route (they stopped firing and the game cannot
explain why), the metrics stay stocked and the *subtitle text* cracks
slightly: a normal stat row where one word is the Warden's name. This
translates the TWWDS inner-monologue device into a shmup's worst fluency:
the HUD. It's a very piercing beat, and tiny. Cost: text-only.
**Pacifist interaction:** ideal for the pacifist descent and fits
`bark_shield_001` ("You're fine. The ship isn't, but you're fine.").

### 8. The firearm that is also furniture

**From TWWDS:** the Gunsword, a weapon everyone defends because "that's just
what the series is".
**In Neon Warden:** give the original-lore's deadly tool a second, boring
life: the Writ of Enclosure is *both* the Authority's gun and the
contract's official document: a legal instrument served on the Warden, a
piece of paper that is also a shot. Formally: the same button (spend charged
Writ charge) marks the Warden as "served" and, on the pacifist route,
recharacterizes each non-fired Writ as *undelivered paperwork*: a mechanic
that never went off. The TWWDS element here is not the sword; it is the
institution treating its violence as mundane equipment, defended because
"that's just what the series is". **Cost:** medium; it deepens the existing
Writ system rather than adding a new one. **Pacifist interaction:** strong:
the ghost run's line "You carried a Writ the whole way and you never spent
it" gains a second meaning, undelivered mail.

### 9. The deadline that resets

**From TWWDS:** the whole piece lives inside "two months before E3, six
months before ship": a countdown that only produces meetings.
**In Neon Warden:** the Sector 5 line already says "the Warden is out of
reserves; 'a winning quarter'". Add one deeper reading: the tutorial's
threat-briefing mention of E3-style seasonality: the Authority's nav screen
shows a fiscal quarter the entire run is squeezed into (two weeks? five
sectors?), and the final Sector 5 readout says this quarter ended 4 days
ago, so the entire battle happened off the books. The enemy is not the
Warden; it is the fiscal calendar that never saw the player's pain.
**Cost:** trivially cheap, one string in the sector-5 banner or a couple of
radio lines. **Pacifist interaction:** neutral; thematically consonant.

### 10. "The language the game speaks" as a whole scene's meaning

**From TWWDS:** Shawn's line, "tutorials are a betrayal of the language
games are supposed to speak" (TVTropes).
**In Neon Warden:** the existing tutorial is overlong on purpose and reviews
itself (`tut_review_001`). Use the TWWDS idea to make the *subtext* visible
one layer down: after the pilot completes reviews, have the Assistant mail
the pilot a note written in shooter-language (bullets-as-syntax,
graze-as-metaphor), which is then stamped by the Authority's translation
desk into corporate language. One banked line. This costs nothing but a
couple of text-only lines and reveals an uncomfortable fact: the Authority
teaches the Pilot the "language of guns" and nothing else. It is a defense
of the Warden's dumb sincerity in code form: one language, one contract,
one ending each. **Pacifist interaction:** supportive; a way the Authority's
own map fails the player can seed the "you can drop the gun" insight
without a word from the Warden.

## Picks and warnings

**Strongest picks:** #1 (the parley where the room talks over the choice
widget), #6 (grief in metrics, pilot-VO-approval silence),
#2 (the Authority files an epilogue for itself over the same digits). They
each cost little, deepen the Enclosure spine at an exact beat, and
strengthen the pacifist route without adding a second wink.

**Tempting but wrong for this project:** #4 (in-parley restart affordance)
and any literal import of the parody itself ("funny AAA self-satire" aimed
at the player). #4 reads as
"you chose wrong, retry", breaks rule 5 (shown, not scolded), and a shmup
would rarely signal a route decision that way; save route identity for
behavior, not checkpoints. Also avoid anything that makes the Assistant
self-aware of her own wickedness (rule 3): TWWDS-style meetings run on the
writer *knowing*; Neon Warden runs on the Authority *not knowing*.

## Status

**Read:** itch.io landing page (`matthewseiji.itch.io/twwds`); Kotaku
games-db entry (release date, genre label); IFDB (authors, year, ~10 min,
comments); SPAG review by Katherine Morayati (May 4, 2015, Issue 62), the
fullest story source, including quotes; TVTropes page (trope list, character
names, Gunsword, endings summary); Origin Story interview episode page
(Burns's background); My Perfect Console episode 184 listing (2026); a
GamesLike / related-games itch listing (adjacent titles).

**Inferred (not read):** the exact branching text and all three endings'
full prose; any playthrough audio/video (none fetched; no game files run);
Burns's specific reflections on TWWDS in episode 184 beyond the episode
summary; whether any formal jam/press kit exists (none seen). The
comment-thread line about the PC's gender comes from a SPAG reader comment,
cited.

**Not investigated:** community let's plays or Reddit threads; Tom
Bissell's own published commentary on TWWDS (nothing turned up in a general
web search); any Steam or console version (none found).

## Sources

1. https://matthewseiji.itch.io/twwds (official page; premise, tags, rating)
2. http://www.spagmag.org/issue-62/the-writer-will-do-something-matthew-burns-review (Morayati review + reader comment)
3. https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/TheWriterWillDoSomething (trope page; characters, endings summary, Gunsword, tutorials line)
4. https://ifdb.org/viewgame?id=qle7qs6w25vqb5dg (IFDB: authorship, year, comments)
5. https://kotaku.com/games/the-writer-will-do-something (metadata: March 29, 2015)
6. https://www.originstory.show/episodes/matthew-seiji-burns (Origins Story, 2021: Burns's AAA producer past)
7. https://shows.acast.com/my-perfect-console/episodes/matthew-seiji-burns-writer-designer-musician-call-of-duty-ha (My Perfect Console 184, September 2026: recent-listing surface only)
8. https://en.wikipedia.org/wiki/Tom_Bissell (Bissell credits; via search snippet)
