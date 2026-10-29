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

VO audit follow-ups (for the implementation step): Captain takes have about
0.64 s leading silence (original 0.24 s); apply a NON-destructive per-take
start offset at playback and in subtitle timing (no re-encode). Tutorial
autopilot triggers the lockout correction about every 2 s: autopilot input
must not trigger wrong-input barks, and the bank cooldown must hold.
