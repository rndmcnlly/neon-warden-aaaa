# Presentation integration request (October 29, phase 1)

Owner: memory/briefings worker. **Prototype only, not wired to live gameplay.**
Renderer/world owner retains stage/backdrop/models/world. No changes requested
until its current sector-world integration is complete.

Proposed port: a presentation owns a `THREE.Scene`, `PerspectiveCamera`,
`resize(width,height)`, `update(...)`, `dispose()`. Stage's existing frame loop
renders this scene/camera **instead of** its world while a presentation is
active, through its existing renderer/compositor. No second WebGL context or RAF.
The model registry is borrowed; presentation releases its slots, never disposes
the registry's shared geometry/materials. Flat logos are unchanged.

Memory input is the Director's active line id and seconds into that exact take,
not a new fixed wall-clock script. Bind `flash_rec_001..006`; return to world
on `flashbackRecording=false`. Keep existing freeze/resume cues and snapshot:
the presentation never reads or writes the sim. On skip, the orchestrator must
finish/cancel the timeline using its existing scene cleanup before releasing
the scene; it must not independently resume an already user-paused sim.

Briefing request is `{sector, safeTransition, encountered, suppressed}`. A
safe boundary is before `beginSector`/new schedule stepping, not a sector-change
event received after the first new tick. Reject unsafe requests. One unseen
kind per six-second card, inferred from `SECTORS`; mark seen on show or skip.
Persist suppression through the settings owner's UI later. Never shift spawn
times or pause mid-dodge. A restored sector-5 run gets no falsely-new introduction.

## Exact patch request, after renderer-world owner finishes

1. **`src/render/stage.ts`, Stage interface and factory closure:** add the
   following methods, using the existing `ModelRegistry` type and the exported
   `InspectionScene` base (no new duplicate compatibility shapes):

   ```ts
   present<T extends InspectionScene>(make: (models: ModelRegistry) => T): T;
   clearPresentation(): void;
   ```

   `present` disposes any previous presentation, stores `make(models)` against
   the existing registry, and returns that instance. `clearPresentation` disposes
   and nulls it. In the existing `render(dtMs, alpha)` body, **before** world
   interpolation/FX updates, if present: resize from renderer canvas CSS size,
   `renderer.setRenderTarget(null)`, render its scene/camera and return. The
   existing post chain is bound to the world scene/camera, so do **not** invoke
   it as if it automatically renders this scene. Direct rendering without bloom
   is intentional for this first port. Preserve renderer-info/timing accounting,
   quality-tier pixel ratio and later world resumption. Dispose active
   presentation during stage disposal. No extra RAF or WebGLRenderer.

2. **`src/director/director.ts`, DirectorPorts and `start(...)`:** request a
   callback `onLineStart?(event: {line: LineId; layer: VoiceLayer;
   startedAtMs: number; durationMs: number; withAudio: boolean}): void`.
   Invoke once in `start`, after `voice.play`/`this.lines[layer]` assignment,
   using the existing `now` and `durationMs`. Do not invoke when the line is
   merely pending download. This is necessary: current public SubtitleView
   exposes identity/text but **no start clock**; caption-chunk changes are not
   audio starts. `withAudio=false` should be an honest muted/fallback state.

3. **`src/main.ts`, existing `onFlag` and frame callback:** on the recording
   flag's true edge, create memory through `stage.present(models => new
   MemoryScene(models))`. In `onLineStart`, latch only scripted
   `flash_rec_001..006` plus its clock/duration. Each existing frame calls
   `memory.update(line, (clock.now()-startedAtMs)/1000, durationMs/1000,
   accessibilityOptions)`. Latch the last recording line through authored
   pauses, not `subtitles=null`. At recording false: clear presentation and
   latch; keep original camera, serial-reveal, muffle and music logic. Bind
   recorder overlay/readouts to `settings.textLang`; animation clock uses
   `settings.voiceLang` take duration. Existing production subtitle view keeps
   its exact words/timings. Standalone prototype subtitles are not a replacement.

4. **Skip/leave/restart:** visible localized Skip calls **existing
   `director.skipScene()`**, not `sim.resume()` directly. Its implementation
   already walks the remaining lasting flag/music/camera/freeze/resume cues.
   Recording false disposes the presentation; scene replacement, restart and
   app disposal must also clear it. Keep any separate front-end pause gate;
   there is no presentation-owned freeze/resume call.

5. **Safe enemy boundary, orchestrator/sim owner:** create one `BriefingGate`
   per run (seed it from restored encountered types and saved preference).
   Add actual `spawn` event `kind` to `gate.seen`, except `warden`, including
   tutorial encounters. Before `beginSector(nextSector)` or a genuinely gated
   transition that has not advanced its first tick, call `gate.open(sector,
   true)`. If null, continue normally. Otherwise show `EnemyBriefing`, request
   a boundary hold from the owner, and release **the same captured snapshot**
   after six real seconds or Skip. Bind Don't show again to production settings
   through the settings owner. Do not route an already-stepped `sectorStart`
   event into an immediate pause: that could interrupt bullets or a dodge.
   Phase 1 makes no automatic progression-hook or schedule changes.

Acceptance: production EN/ES/ZH overlay and mixed text/voice languages; existing
flashback and recorder-first triggers; post-skip `story.flashbackSeen`, recording
false and HUD #0122; unchanged snapshot hash while held; no simultaneous world
render; phone safe-area/overflow; normal/reduced motion; real audio/word-pulse
capture with canonical subtitle selectors. See README for current prototype QA
and the **partially failed v1 blind comprehension test**, not a promotion claim.
