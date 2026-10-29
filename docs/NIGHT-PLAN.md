# Night plan, October 29, 2026 (Adam away until 7:00 AM)

Adam's direction: we got distracted by lore. The core verbs are MOVE and
SHOOT to cause DAMAGE. Needed: movement sound and directional thruster puffs;
impact sounds; better audio-visual feedback for incremental damage (sparks,
ricochets, shards falling off). Fresh ideas, isolated judges, wise
integration. Run steps SERIALLY in background agents to pace inference use.

Added by Adam (later the same night):

- Writs and other discrete shots (tap) must feel amazing, rewarding players
  for NOT playing it like an arcade game (stream spam). Discrete precision
  gets the richest payoff; stream stays serviceable but plainer.
- Physical disarming: broken parts fling off along a direction and spin
  derived from the angle and point of impact (render-side physics: torque from
  the hit offset, impulse along the shot, tumbling debris that leaves the
  playfield). Must not create new hazards or clutter the bullet field.
- The blue lane floor we fly over can carry much more activity (texture,
  traffic, signals, data flow, reflections) as long as it still reads as
  background relative to core gameplay (value and saturation below combat).

Steps (one at a time; start the next when the previous reports):

1. Web research: high-end shmup audio-visual design for movement, shooting,
   impacts and incremental damage. Output `research/2026-10-29-av-core-loop/`.
2. Argon ideation: isolated judge sees short snippets of our current build
   (movement, tap/stream/Writ, hits on hulls and parts, part breaks) blind,
   then ideates fixes. Output `research/2026-10-29-argon-core-ideation/`.
   Budget about US $1.
3. Synthesis (main session): pick a small, coherent set from 1 and 2.
4. Implementation: movement audio and thruster puffs; impact audio layers;
   incremental damage visuals (sparks, ricochets, shards, damage states).
   Render, audio and asset paths only; sim untouched unless a damage-state
   event is truly missing.
5. Isolated verification: a fresh Argon pass, blind, on before/after clips;
   plus hands-on build ready for Adam at 7:00.

Pending credits: GLM-5.3-Flash (narrative research, TWWDS raid) and
DeepSeek V4.1 Flash (skill compression) once its pass reports.
Running at plan time: VO completeness audit, DeepSeek grug pass.

## Step 3 synthesis (main session)

Verified weaknesses (step 2): disarms read as kills; boss pod breaks do not
read; Writ hit vs miss sound alike and tiers are indistinguishable; Writ hits
on a deflecting boss sit only 1.5 dB above the mix; a life lost on the same
tick as a kill goes unnoticed.

Adopted, in priority order:

1. Feedback ladder (step 1 idea 3, Argon 3): graze < hull hit < armor
   deflect < weak-point hit < part break < disarm < kill < pod break < life
   lost. Each rung differs from its neighbors in at least two of sound,
   shape and motion, never color alone. Flash only the struck part, at most
   once per 100 ms per target; reduced flashing uses an outline pulse.
2. Disarm is not a kill (both sources): the weapon part detaches and flings
   along the shot with spin from the hit offset (render-side physics), then
   darkens and sinks below the bullet layer; the hull survives and visibly
   powers down (lights dim, engine sputters, weapon ports go dark) and
   leaves; a distinct mechanical unlatch plus power-down sound. Kills keep
   explosions. Debris never resembles a bullet (shape, value, motion).
3. Writ payoff: tier-specific sound layers (1, 2, 3 audibly distinct), a
   distinct hit vs miss (miss: a dry fizzle that fades into the distance);
   Writ impacts duck music and sit clearly above the mix; deflection gets a
   ricochet spark and tink. Discrete taps get a crisp, satisfying impact;
   stream impacts are lighter and voice-capped.
4. Pod break as an event: physical separation and fling, a unique loud
   sound, and a short hitstop. Hitstop is allowed tonight as a tick-domain
   freeze (the sim does not advance and consumes no input during the
   freeze), keeping replays deterministic; tests required. Also on life lost.
5. Life lost dominates: hitstop, an edge pulse, a unique sound that ducks
   everything; same-tick kill feedback is deferred until after it.
6. Damage states: matte scorch as the base, with crack seams that glow amber
   briefly when struck and then cool (a compromise between step 1 and Argon).
7. Impact voice management: merge simultaneous hits, cap voices, never cut
   threat cues.
8. Movement: engine hum following speed and acceleration (about 30 ms
   response), thruster puffs opposite acceleration drawn beneath bullets, a
   short reverse/stop transient, banking, narrower and quieter in focus.
9. Lane floor: busier (traffic, signals, data flow) but dim and desaturated,
   below combat in value.

Implementation order (serial agents): 4a items 1–7 (damage, disarm, Writ,
pod, life loss); 4b items 8–9 plus the VO follow-ups below; then step 5.

VO audit follow-ups (for the implementation step): Captain takes have about
0.64 s leading silence (original 0.24 s); apply a NON-destructive per-take
start offset at playback and in subtitle timing (no re-encode). Tutorial
autopilot triggers the lockout correction about every 2 s: autopilot input
must not trigger wrong-input barks, and the bank cooldown must hold.
