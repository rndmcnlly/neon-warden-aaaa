# Argon creative review: directed craft, not feature count

**Framing question:** What should a creative director protect, remove, and concentrate to make this authentic slice feel deliberately expensive?

**Result:** Argon finds a distinctive game about bureaucratic enclosure and biological loss, not merely a neon shooter. Its strongest unexpected opportunity is **Authority telemetry as the world's visual language**: instrumentation, scoring, lane boundaries, sound and Writ impacts communicating the same institutional logic. This is an observer's interpretation, not a new canonical story decision.

[One-clip-at-a-time AV viewer](index.html) · [Full director memo, unedited model prose](DIRECTOR.md) · [Transcript-first inventory and memo](review.json) · [Raw API response](response.json) · [Validation](validation.json)

Research only. No game changes. Capture began October 28, 2026; validation crossed into October 29. The model's own memo header incorrectly calls `cand1` a build: it is the chosen gameplay music variant, not a code revision. The authoritative revision is below.

## Strengths to protect (observer claims, max five)

1. **Three contrasting institutional voices.** Cheerful billing, the furious Warden, and solemn briefing produce authentic stakes through contrast, not constant solemnity. F 0:01–0:12 and G 0:08–0:24. High observer confidence; full Warden introduction and later ending not supplied.
2. **Scanning/disarming gives the shmup its own verb.** The cone makes looking and positioning active. D around 0:01–0:03; E 0:02–0:04; F 0:16–0:19. High observer confidence; no claim about hands-on feel or a completed pacifist run.
3. **A clear play lane and perimeter information hierarchy.** A 0:09–0:20, B 0:00–0:12, F throughout. High observer confidence, but desktop-only and not proof every small HUD label is readable.
4. **Musical contrast between front end and moral aftermath.** A around 0:08–0:10 and G 0:08–0:24. Argon hears a filtering transition; source/mix analysis here establishes audio presence, not that exact causal implementation.
5. **Respectful initial gate and honest mechanical descriptions.** A 0:00–0:01, B throughout. Protect the principle, not an unsupported claim of universal accessibility compliance.

## Five illusion breakers, with corroboration separated

| Priority | Observer claim and evidence | Independent corroboration / qualification | Selective response and approximate effort |
| --- | --- | --- | --- |
| 1 | Speech loses its comedic cadence when event lines cut one another. D 0:02–0:04, E 0:02–0:05, F 0:16–0:21. | Logged D sources start at 1.875, 3.290 and 3.953 s. D's existing QA check fails VO coverage for `disarm_ai_001`. E's graze/lock start 19 ms apart. `src/scenes/beats.ts` implements first-time events as timelines; a commentary cooldown already exists elsewhere. This is **not** evidence that every new voice always cuts every old voice. | **Adopt:** audit arbitration between first-time timelines and story scenes before rewriting the scheduler. Preserve Warden/story priority; defer or omit stale reward barks. Prototype 0.5–1 day, harden 2–4 days. |
| 2 | Subtitle words appear joined during emphasis, damaging the institutional typographic finish. C 0:00, C 0:08, G 0:22. | Cropped frames corroborate visual crowding. `segmentChunk` preserves gap text; `.nw-word.is-spoken` scales inline-block words 1.09x without allocating new layout width. **Missing parser whitespace is not established.** | **Adopt the perceptual defect, reject the premature diagnosis.** Compare static color emphasis against scaling; preserve literal spaces. 1–3 hours prototype, about 0.5–1 day multilingual/reduced-motion QA. |
| 3 | Shots and Writ communicate brightness more than weight; pod loss is vocally larger than its visual/sonic impact. F around 0:09 and 0:20. | Logged Writ pod breaks are F 8.935 s (`cannonPod`) and 20.371 s (`spiralPod`), approximately ±0.22 s sampling uncertainty. Source already has a `heavyThump` and level-3 Writ music duck (-3 dB, 0.4 s release). Therefore **absence of ducking is false as an implementation claim**. AV checks confirm non-silent audio and sensible overall loudness, not adequate perceptual hierarchy. | **Prototype:** one localized pod rupture with a short mix aperture, then A/B against this exact baseline. Don't add blanket shake or bass to every shot. 0.5–1 day prototype, 2–5 days integrated tuning. |
| 4 | The ship is often an emissive blob, obscuring the customization the menu sells. A 0:10, C throughout, F throughout. | Representative frames independently show a blown-out center. This study does not isolate emissive material, exposure, bloom or compression as the cause. | **Prototype:** readable hull silhouette under current exposure; protect bullet contrast. 2–4 hours look test, 1–2 days across quality tiers. |
| 5 | Hangar choices are numerical but not visibly embodied; the corridor has weak velocity/staging cues. B throughout; C 0:00–0:24. | B's captured pad has no readable ship, and the selected sensor changes statistics without a visible cone preview. Redesign is already pending. Sparse framing is visible; the claim that absolutely nothing moves in the background is too categorical. | **Adopt within pending redesign:** actual ship plus current sensor preview, no new loadout system. Prototype 0.5–1 day, 2–4 days layout/input QA. Test edge-only velocity marks separately. |

These effort ranges are this agent's scoped production estimates, not measured implementation time. Argon's original, larger estimates remain in the unedited memo.

## Three signature polish bets

1. **A corporate surveying instrument, not a generic neon corridor.** Prototype low-contrast lane-edge distance ticks and sector identifiers, outside the threat lane. Let the same graphic vocabulary mark scan completion and the Writ. Evidence: C's nearly empty movement field versus F's readable threats. Estimated first test: half a day; production pass: 2–4 days. **Prototype**, preserving low-tier performance, reduced motion and the flat, screen-locked opening logos.
2. **One pod break that everyone can explain.** Make local rupture, boss reaction, changed bullet source and audio transient tell the same causal story. Evidence: F 8.9/20.3 s plus Warden's pod complaint. Estimated first test: one day; production pass: 3–5 days. **Prototype**, not a new destruction simulation.
3. **Billable near-miss instrumentation.** A compact pay-counter response and one transponder-like sound should bind the joke to the mechanic. Evidence: F's billing line and logged graze/pay changes. Estimated first test: 2–4 hours; production pass: 1–2 days. **Prototype sparingly**: reject a tether on every bullet if it harms threat reading or adds constant sound.

## Three things not worth building

1. **Pilot models, helmets or talking heads.** Keep the confirmed off-screen scope cut. No character asset project to justify a ship game.
2. **Dense scenery inside the firing lane, or more generic bloom.** Stage depth at the edges or below the play plane. More objects are not more direction.
3. **More hangar slots or upgrade systems.** Make existing packages perceptible. Argon suggests hiding the entire unavailable-feature grid; **reject hiding scope to imply completeness**. A compact, explicit “not included in this vertical slice” disclosure is consistent with the project's audience-facing honesty.

## Claims we do not adopt

- **Recorder repetition across sectors:** D and E are independent fresh browser profiles with `skipto` entry, not the same run. `src/scenes/flashback.timeline.ts:27–34` already guards the scene with `story.flashbackSeen`. Reject the claimed repeated-story defect and proposed repeat-drop VO variants.
- **“Rebuild the VO scheduler” / “add ducking”:** existing commentary priorities, cooldowns and duck nodes make these greenfield diagnoses inaccurate. Audit the actual event-timeline collision and retune what listeners can perceive.
- **“Nothing moves” / “no shrapnel” / “no variation”:** supplied footage supports perceived weakness, not global implementation absence. Re-test the selected beat before deleting existing work.
- **Voice gender and absolute confidence:** these are the model's subjective auditory labels, not casting facts. Most of its confidence labels are uniformly high; source-backed event timing is stronger evidence than that rhetorical confidence.
- **Full narrative success:** the tollgate turn is compelling within G, but no verdict on the unseen final resolution or pacifist ending is warranted. The model's “indigenous/living airspace” phrasing is interpretation, not verified lore.

## Package, provenance and limitations

**Code:** `ad320434d09a05f7c347311cae8aad385fbf9c82`, extracted with `git archive` into ignored `snapshot/`. This includes flat logos `3f785ff`, Pilot scope cut `c598544`, shot/recoil/trails `5a23867`, and explicit offline tools `ad32043`. The extraction has no `.git`; no branch/checkout operations or active movement/audio/render edits were used. Built with direct Vite, deliberately **without** `vo:sync`, which could otherwise regenerate assets from incomplete archive-only inputs.

**Audio overlay:** copied exactly `music/picks.json`, `public/music/manifest.json`, and `public/vo/variants/index.json` from the working checkout. No game source overlay. Captain is already the committed base tutorial audio (asset commit `eeac985`); the dirty index changes its default from `original` to `a_captain`. Captain need not have a separate `a_captain/` folder: its files are `/vo/en/tut_*.ogg`, confirmed by the capture's audio-source log. Gameplay is explicitly `cand1`. [Provenance](provenance.json) hashes all 932 public assets and all three overlay files; this is the exact input record, not a claim that today's evolving checkout still matches it.

| Clip | Continuous excerpt | Coverage |
| --- | ---: | --- |
| A | 20 s | Notice, naturally playing flat logos, title, main menu. Gates/title confirmed by keys, no marketing edit. |
| B | 12 s | Hangar; sensor row selected/adjusted. Redesign pending. |
| C | 24 s | Tutorial movement: actual left/right/up presses, all three movement flags become true. Prior explanation omitted, explicitly disclosed. |
| D | 8 s | Quiet sector 1, real Writ disarm; first pickup legitimately interrupts with flashback. |
| E | 10 s | Denser sector 4, scan/graze; same first-pickup interruption in an independent run. |
| F | 27 s | Uninterrupted boss excerpt including two Writ pod breaks and phase/core reveal. Descent omitted. |
| G | 24 s | **Spoilers:** lethal ending excerpt, QA scene entry, later resolution omitted. |

D/E are deliberately short because the real flashback interrupts action. They do not establish a continuous quiet-to-dense sector progression; F supplies the requested 20–30 s action beat with pod breaks. No stale clips are reused. No footage was speed-ramped. Human tutorial progression measured about 59.2 simulation ticks/wall-second; automated combat about 52.3–52.6, versus nominal 60. That roughly 12–13% host/capture slowdown limits claims about intended combat tempo. The rAF pacing shim prevents the known uncapped autopilot acceleration; it is a capture-side shim, not a game-source change.

All clips are desktop 1280×720 with the game's actual stereo mix via `qa/av.ts`, not Playwright's silent track. Loudness ranges -19.5 to -16.8 LUFS; true peaks remain below -5 dBFS after excerpt encoding. Per-clip checks, source starts, subtitle windows, input logs, errors and media probes are retained. Seven captures have **zero page exceptions**. D has the meaningful existing VO-no-drop failure described above; do not summarize this package as “all QA passed.” The initial C take pressed too early for the movement gate, so it was replaced by a fresh interaction-confirmed take; its raw video was not used in the review.

Existing static QA was run inside the archive: **28 pass, 8 warn, 2 fail** ([log](out/static-qa.txt)). The failures concern missing raw VO paths in `vo/out/cues.json` (raw WAVs are intentionally untracked) and 65 script lines absent from that raw-cue index. They are not evidence of absent audio in these verified public-Opus captures, nor should they be silently waived as full-production completeness. Focused word-pulse/commentary tests pass ([log](out/focused-tests.txt)). No full desktop/mobile traversal, full campaign, all accessibility options, offline startup or hands-on feel claim is made.

**Comparator policy:** no official comparator clips were downloaded or supplied. This compact pass uses four **named conceptual references only**, not watched evidence: Returnal (threat/impact hierarchy), Control (institutional graphic identity), Dead Space (motivated instrumentation), Wipeout (interface/industrial-brand coherence). No piracy, embedded remote media, or claims of side-by-side measured comparison.

## Model, spend and evidence trust

Live catalog and endpoint records are saved in [catalog.json](catalog.json) and [endpoints.json](endpoints.json). Requested **and returned** model: `google/gemini-4-argon`; returned provider: `Google`. Request policy: `zdr: true`, `data_collection: deny`, using the existing OpenRouter AV transport. No weaker-policy fallback and no model substitution.

**One paid call, US $0.117510 of the $1.50 task cap.** 14,260 prompt tokens, 8,899 completion tokens; response ended normally with `stop`. Raw usage reports video tokens but zero separate audio tokens: this is provider accounting, not independently conclusive proof of audio ingestion. Stronger evidence is the transcript inventory: G quotes “Count what they put where the rings were” beyond the on-screen subtitle excerpt Argon separately lists, matching `vo/script.yaml:1565–1567`; D reports only “A disarm” where the caption promises a longer unheard sentence. This is credible AV evidence, not a perfect audio-only blinded canary. Transcript timings remain approximate, sometimes offset by 1–2 seconds relative to source starts.

The API accepted JSON-object mode but emitted unescaped quotes in its final memo string. **No retry was paid for.** `recover_response.py` escapes only those delimiters, retains the untouched prefix/inventory, and decodes the original prose into `review.json`/`DIRECTOR.md`. Raw response and transcript remain authoritative. The memo retains the model's punctuation and erroneous build label intentionally; this report supplies corrections instead of rewriting the observer's account.

**Next step:** a narrowly scoped, user-approved A/B prototype of VO arbitration and one pod-break cue, then re-review the same beats. This research does not authorize implementation.
