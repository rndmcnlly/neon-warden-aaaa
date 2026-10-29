# Proposed profiles, presentation contract, and prototype test

These are small experiments, not implementation instructions already approved by Adam. All tuning is original 480 × 640 playfield px per simulation second. Existing shipped behavior remains untouched/default while testing; proposed “classic” fixes diagonal speed and is therefore **not bit-identical legacy**.

## Three candidate profiles

| | A: Classic precision | B: Ramp-to-cruise | C: Hybrid (recommended experiment) |
| --- | --- | --- | --- |
| Normal start/top | Immediate 252 px/s | 126 → 252 px/s | 126 → 252 px/s |
| Driven acceleration | None | Scalar +504 px/s² | Scalar +504 px/s² outside focus |
| Ramp duration | 0 | 0.25 s from initial speed | 0.25 s from initial speed |
| Focus | Immediate 120 px/s | Same envelope ×120/252: 60 →120; +240 px/s² | Immediate 120 px/s, cancels normal envelope |
| Focus entry | Immediate speed selection | Immediately scale driven speed to focused envelope; cap coast to ≤120 | Immediate velocity cap/reassignment; neutral immediately stops |
| Focus exit | Immediate normal speed | Return to remembered normal envelope, possibly immediate 252 | Restart normal at126, ramp again; no stored high-speed surprise |
| Neutral normal release | Immediate stop | Linear brake over .05 s (3 ticks) | Same .05 s brake |
| Neutral focused release | Immediate stop | Linear brake over .05 s | Immediate stop |
| 90° / 180° | Immediate direction change | Immediate direction change, preserve envelope | Same; focus always immediate precision |

All profiles clamp vector magnitude to one, retain analogue magnitude below one, and use immediate direction reassignment rather than rotating a momentum vector gradually. Zero-input direction is undefined: use last valid direction only during normal-mode coast. There is no acceleration cooldown, boost cooldown, or loss of top speed merely because a valid direction reverses.

**Discrete convention:** run at fixed 60 Hz. First driven tick uses start speed126; subsequent held ticks add8.4 px/s up to252. The envelope spans15 intervals (.25 s) after its initial sample, so first full-speed integrated tick is16 (end timestamp .2667 s in the CSV). Focus B gets half-ish equivalent scaling (4 px/s per tick), not a second independent timer. Profile A's acceleration is an instantaneous assignment, not an arbitrarily huge numeric acceleration.

**Release brake:** capture `b = current_speed / .05` at release, then each neutral tick `s=max(0,s-b/60)` before integration. From252, b=5040 px/s², velocities168,84,0 over the next three ticks: postrelease travel **4.2 px**. From120, b=2400, postrelease2 px. This explicit fixed-tick sum differs from the continuous triangle's6.3/3 px; do not mix the models when tuning. At corners/reversals with a valid direction there is no release-brake penalty. Hybrid's focus neutral brake is immediate, not finite b.

### “Hold through the corner” without a chord

The ramp tracks **movement activity, not which key**. Right→down within consecutive samples preserves scalar speed and assigns all velocity down on the new sample. Simultaneous right+down is merely a normalized diagonal, never a boost requirement.

Allow up to6 neutral ticks (.10 s) to retain the scalar cruise envelope while velocity still brakes normally. A release-then-press corner can therefore resume at its previous speed even with a small keyboard event gap. After more than6 neutral ticks restart at126. This is not six ticks of unbraked drift: coast ends after3 ticks. It is a forgiving envelope-memory window. The one-neutral-tick case is plotted separately. Same/opposing keys still cancel if they produce zero vector; once a new valid opposite vector exists, it takes effect on that tick, with no wrong-way travel. An input adapter could optionally resolve most-recent opposing key, but that would be a separate policy change and needs event ordering absent from current InputFrame.

**Avoid:** lerping `velocity` toward `input*speed` for .25 s. That rounds corners, brakes to zero before reversing, and can force continued travel into a bullet after the player has corrected. The request is for sustained speed with retained authority, not Newtonian spacecraft physics.

## Input parity, effort and determinism

- **Keyboard/D-pad:** full magnitude. Read held state each simulation tick. Key-repeat is irrelevant. Preserve focus toggle and remaps. Offer classic to players who cannot tolerate history-dependent stopping distances. Do not require double taps, repeated taps, boost chords or prolonged focus holding.
- **Analogue:** preserve the current .18 radial dead zone and proportional magnitude. Apply magnitude **after** cruise envelope, so half-tilt tops at126 normal/60 focused; hybrid half-tilt focus is60 immediately. Small intent should stay small even after a long hold. Decreasing magnitude should immediately scale down speed rather than slowly decelerate toward a lower target. Do not advance cruise faster because stick samples arrive more frequently. Re-test dead-zone noise and keyboard+stick arbitration; choose an active source or normalize the final combined vector.
- **Touch:** current implementation needs a gameplay adapter. Recommended baseline for direct/relative drag is **direct precision**, not automatically feeding finger displacement into the keyboard cruise timer. A stationary finger is zero displacement, not “holding direction”; long touch duration must not accelerate the ship. Preserve regrip offset, avoid ship jumps, and stop on pointer cancellation. For a virtual stick, the same normalized profiles can apply directly. Relative drag can map target error into desired velocity capped by the selected profile, but adding lag/coast is an explicit optional mode, not touch parity by name alone. Make focus visibly togglable and keep fire rest/hold/press separately expressible. Do not steal long-press for focus when it already holds the movement finger. Recommended hybrid on drag: use focus to lower capped target-follow speed, but no post-pointer-up coast by default. This is an intentional device-specific release safety policy; record it in replay configuration.
- **Autopilot:** planners must simulate position **and controller envelope, neutral counter, coast velocity/brake, previous focus** for each candidate. Current instantaneous formula and burst-stop assumption are invalid. Shared pure stepping code must serve actual player and candidate predictor. Pacifist no-fire autonomy must not unexpectedly stream when focus toggles. Fighting/disarming aim also depends on the resulting ship position.
- **Replay:** store controller profile/version/tuning and device-policy version alongside seed/loadout/input frames. Existing inputs with the new law will produce different positions, collisions, Writ opportunities and endings. Keep old replays on legacy semantics; a seed alone is insufficient. Snapshot/checkpoint controller state, clear it deliberately on respawn/run transition, and keep player.vel as measured world displacement for near-miss audio. At walls remove outward coast, never accumulate pressure/boost for a launch on reversal.
- **Timing:** fixed-tick simulation, never multiply acceleration by render delta or browser key repeat. Interpolate position/bank visually, not the authority of focus. Lower accessibility game speed stretches wall-clock ramp/coast duration along with gameplay, which is appropriate but must be disclosed during comparisons.

## Focus audiovisual language

Focus means **precision**, not protection. Keep the actual 6 px collision boundary accurate and distinguish any larger graze boundary. Do not add a shield bubble, projectile cancellation effect, health tint or invincibility sound.

| Phase | Proposed visual | Proposed audio |
| --- | --- | --- |
| Entry | In 80–120 ms, settle the ship's pose and shorten/narrow its engine plume; show a thin luminous collision marker and a sparse, distinct focus bracket. Geometry appears on the state tick even if the decorative easing continues. | Immediate 60–100 ms inward/settling transient, unlike menu ticks, charge pips and scan lock. Do not quantize this safety feedback to music beats. |
| Sustain | Steady high-contrast core outline with dark underlay, subdued focus bracket. Optional faint **dashed** graze ring at actual graze radius, visually separate from collision line. No breathing/flashing requirement. | Usually none. If testing finds it necessary, very quiet stable motor/filter bed, clearly different from scan sweep; adjustable/disableable. It must not hide bullet/graze cues or VO. |
| Exit | Remove bracket with brief 80–120 ms ease, return engine silhouette. The collision marker may remain under an always-show option. No expanding bomb ring. | Different short outward/release transient, not merely stopping a loop. |

**Lane/scan consistency:** precision may sharpen local navigation brackets without altering actual scanner cone angle/range/dwell. Scanner remains a forward wedge and target reticles in its own accent; focus remains compact around the ship. Charge remains a distinct progression. Resting fire may activate scan whether focused or not. Firing while focused retains precision cues but removes scan as today. Do not call both states “focus” or show one shared ambiguous ring. No new on-screen instruction paragraphs during combat.

**Accessible equivalents:** shape plus luminance, not color alone; collision outline dark backing and configurable thickness, without enlarging the actual vulnerable area. Mobile focus button has persistent pressed-state geometry away from the finger. Optional supported haptics can mirror entry/exit, but never become the sole signal. Deaf players receive the same state from persistent visuals; low-vision players receive distinct audio transients and an optional steady cue. Existing reduced-motion/flashing modes use immediate static geometry, no flare/strobe, no camera zoom/shake; slow decorative fades are optional, never required to infer state.

## Precise state/events required for a prototype

Names below are proposed contracts, not existing events.

1. `player.focused: boolean` in SimState, set from **resolved** input, not keyboard events or inferred speed. `movementProfile/version` and response state available to replay/planner.
2. `focusChanged {tick, active, pos}` exactly once per resolved transition. Feed renderer/audio together; no repeat event every render frame. Both hold and toggle paths use it. Events stay immediate, outside beat quantization.
3. `movementPhaseChanged {tick, phase: idle|ramp|cruise|coast|precision}` only if a presentation consumer actually needs it. Otherwise derive engine pose from snapshot speed/profile. Do not spam sounds on every speed increment.
4. Explicit lifecycle presentation reset/synchronize on pause, resume, blur, scene skip, death, respawn, ending and audio-unlock. Reconstruct sustained state from snapshot; suppress fake entry sounds merely because a renderer remounted. Stop all loops while paused/hidden. Audio unavailable before iOS unlock must not block visuals or queue obsolete transition sounds.
5. Keep `scan.active/shape/target`, `scanLock`, `chargeLevel`, and `playerFired` separate. A future scan-active event must name **scan**, not focus. Existing event semantics should not silently change.

## Numerical evidence

The standalone simulator includes actual legacy behavior plus proposed A/B/C. Nine isolated scenarios:100 ms tap, one-second hold/release,90° turn,180° reversal, one-neutral-tick corner, focus entry/exit while moving, focus entry while releasing, diagonal, half analogue magnitude. No world bounds or threat geometry, hence no death-rate or gameplay-quality inference.

- 100 ms cardinal tap: legacy/classic25.2 px; B/C14.7 driven +2.8 coast=17.5 px. Short taps become **smaller but less cleanly stopped**, not categorically more precise.
- One-second hold: B/C235.2 driven +4.2 coast=239.4 px versus252 classic. Cruise speed matches but accumulated route timing does not.
- Legacy diagonal one-second distance356.38 px; normalized classic252 px. This is a substantial balance correction, not cosmetic cleanup.
- B/C preserve252 px/s through both turn types after reaching cruise; no old-axis velocity at90° and no wrong-way component after180°. Hybrid entry while releasing stops on its first focus tick. Exit returns126, not252.
- Simulator checks cover deterministic repeats,30/60/144 Hz render scheduling of the same ticks, diagonal and analogue magnitude, turn authority, focus transition semantics and release deadline. [Machine checks](simulator-checks.json). No player preference or perceived responsiveness was measured.

## Required QA scenarios before promoting a prototype

Use short focused clips per topic, coordinated with the separate intelligibility agent. The present research did **not** record these:

1. Held keyboard cardinal/diagonal equal distance in candidate profiles; legacy replay still reproduces old distance. Simulate30/60/144 Hz rendering and fixed60 Hz updates.
2. One-, two-, and six-tick taps; full cruise release; repeated micrododges across a narrow safe gap. Compare actual postrelease position to expected trajectory, including game-speed settings.
3. 90°/180° transitions, overlapped keys, zero/one/six/seven-tick neutral gaps, simultaneous opposing keys, boundary slide/reversal. No wrong-way motion once opposite intent is valid; no stored wall launch.
4. Focus press/release at rest, during ramp/cruise/coast, at a wall, and at half analogue input. Toggle must match hold semantics. Check exact event counts with repeated keydown, no audible double entry.
5. Four-state matrix: focus on/off × fire held/resting. Confirm hitbox/focus versus scan wedge visually and by sound; Writ charge thresholds and next-press consumption unchanged. Scan sensor packages keep their actual shape/dwell. Test focused firing without scan and unfocused resting with scan explicitly.
6. Hit/graze while focused: same collision radius, no false invulnerability implication. Always-show marker, low contrast environment, reduced motion/flashing, SFX muted, mono audio, VO-heavy mix. Deaf/low-vision equivalent state must remain available.
7. Phone portrait/landscape, safe areas, finger occlusion, regrip, pointer-cancel, multi-touch fire/focus, iOS audio unlock; Chromebook keyboard+touch hybrid. No accidental fire on focus and no pointer-up cruise surprise.
8. Pause/resume/blur, controller disconnect, death/respawn, flashback/ending, scene skip and new run. No stuck focus, stale sound loop, envelope carried into respawn, or burst of queued entry cues.
9. Autopilot predicted versus actual positions tick-by-tick, seeded fighting/disarming/pacifist routes, focus alternation, and replay version migration. Existing clear-rate tests need rerunning; passing toy assertions does not validate them.

**Acceptance question for Adam:** A) exact stop matters most; B) brief cruise/coast is worth learning; C) hybrid is good only because focus is a hard precision escape. Use the same bullet pattern and identical feedback, then ask about overshoot, reversal trust, hand effort and enjoyment separately. Start with a brief practice block; do not interpret unfamiliarity alone as evidence against either profile.
