# Public repository audit (October 29, 2026)

Framing question: what stands between this repository and a public GitHub
repository, ideally without Git LFS, given the new Lifecycle rule (AGENTS.md:
a few more days of work, then parked as a pedagogical artifact; static Pages
build, pinned deps, committed small generated assets, honest regeneration docs,
no services)?

Scope: read-only audit of `main` at `1addc83` plus the working tree as it
stood on the morning of October 29 (trailer/ was being edited by another agent
and was only read). Disciplines: software
distribution engineering (git object model, CI), information security
(secret and PII hygiene), copyright and licensing (fair use, model output
terms, font licenses), and teaching (what a legible history is worth).

## Verdict

- **LFS is not needed.** The largest blob in all history is 3.66 MB. Nothing
  comes near GitHub's 50 MB warning or 100 MB hard limit.
- **No secrets found.** gitleaks 8.28.0 (one-off binary in /tmp, not
  installed) reports no leaks in all 149 commits and none in the working tree
  (7.6 GB scanned, including ignored files). Pattern searches for OpenRouter,
  fal, ElevenLabs, GitHub and bearer tokens found nothing.
- **A fresh clone builds and passes CI as-is.** `git clone` then
  `deno task ci` in /tmp exited 0 (fmt, lint, check, test, build). No local
  models, no `vo/out` WAVs, no ffmpeg needed. `scripts/sync_vo.ts` keeps
  committed `.ogg` files when the WAV is missing. That's good design: generated
  artifacts are committed at the boundary where regeneration needs special
  hardware (the "checked-in build output at a trust boundary" pattern).
- **The real blocker is copyright, not size:** about 38 MB (compressed, all
  history) of third-party game
  screenshots and a scanned manual page are committed in `research/` and in
  history. Removing them from history means a rewrite (or a fresh history).

## 1. Size

| Measure                                          | Value                         |
| ------------------------------------------------ | ----------------------------- |
| Commits                                          | 149                           |
| `.git` on disk                                   | 1.0 GB (3 packs, 568 MB size-pack, plus unreachable objects and 2 temp files) |
| Reachable blobs, all history                     | 5,291 blobs, 416 MB raw, about 360 MB compressed |
| Largest blob ever                                | 3.66 MB (`research/2026-10-29-argon-core-ideation/clips/clip-H.mp4`) |
| Blobs over 1 MB / 10 MB / 50 MB                  | 100 / 0 / 0                   |
| Tracked tree now                                 | 4,041 files, 398 MB raw       |
| `dist/` (Pages payload)                          | 60 MB                         |

A push uploads only reachable objects, so expect about 350–400 MB. GitHub
recommends repositories under 1 GB and strongly under 5 GB: this is within
range but heavy for a student `git clone` on a school network.

Where the bytes are (tracked now, raw MB, files):

| Path                                        | MB    | Files | Kind                         |
| ------------------------------------------- | ----- | ----- | ---------------------------- |
| `public/vo`                                 | 39.7  | 916   | Opus VO, shipped             |
| `research/*` (all folders)                  | ~300  | ~1,300 | QA reels (mp4/webm), frames, comparators |
| `public/music`                              | 9.8   | 17    | Opus cues, 2 candidates each |
| `vo/voices`                                 | 6.2   | 28    | Voice anchor WAVs + JSON     |
| `vo/out`                                    | 5.4   | 1,340 | Per-take JSON metadata       |
| `public/models`                             | 3.6   | 36    | glTF from Blender scripts    |
| `public/sfx`                                | ~0.3  | 51    | Opus SFX                     |

Top research folders: sector-worlds-v2 35.8, control-feel 31.7,
level-design 27.5, moments 26.8, argon-core-ideation 25.3,
warden-defeat 21.9, critique-visual 21.2, intelligibility 19.1,
bolt-identity 17.3, shot-feel 17.1. Research is about 75% of the repo.

Untracked but large (ignored, not needed to build or run): `trailer/.cache`
4.4 GB, `qa/reports` 2.0 GB, `qa/.build` 0.4 GB, research snapshot/capture
dirs about 1.8 GB, `vo/out` WAVs 198 MB, `music/candidates` 121 MB,
`sfx/candidates` 64 MB, `vo/casting` 104 MB (untracked audition takes; the
chosen Captain anchor is already committed as `vo/voices/tutorial_ai.wav`,
md5 identical to `vo/casting/tutorial_ai/a_captain/anchor.wav`).

Regeneration status of each shipped asset family:

| Asset                | Generator                                   | Deterministic?                                    | Needs                                         | Recommendation |
| -------------------- | ------------------------------------------- | ------------------------------------------------- | --------------------------------------------- | -------------- |
| `public/models`      | `art/blender/*.py` (`build_all.py`)         | Likely yes (scripted geometry); not byte-verified | Blender (headless)                            | Keep committed (3.6 MB) |
| `public/vo`          | `vo/render.py` then `scripts/sync_vo.ts`    | Seeded per line, but GGUF TTS on Metal is not guaranteed bit-exact; retries pick best-of-N seeds by ASR | Qwen3-TTS/ASR/aligner GGUFs at `VO_MODELS_DIR` (defaults to `~/Code/bbb-artifact-tour/audio.cpp/models`), audio.cpp, Apple Silicon, ffmpeg | Keep committed (40 MB); it is the hand-curated cast |
| `public/music`       | `music/render.py` (Stable Audio 3 MLX)      | Seeded; picks are by objective score plus Adam's A/B | SA3 MLX at `SA3_DIR` (`~/Code/sa3/...`), Apple Silicon | Keep committed (10 MB) |
| `public/sfx`         | `sfx/render.py`: `sa3` (seeded) and `elevenlabs` via fal (`sfx/gameplay.yaml`, no seed, paid) | Gameplay set is not reproducible | FAL_KEY, money          | Keep committed; document as non-regenerable |
| Branding             | Hand-authored SVG, CC0 (`public/branding/LICENSE.txt`) | n/a                                     | none                                          | Keep           |
| Research reels       | `qa/` capture via Playwright                | Approximately                                     | Chromium, ffmpeg                              | Prune or move to a Release asset (see strategy) |

Conclusion for item 1: nothing shipped should move to CI regeneration (the
Lifecycle rule agrees: CI regeneration would need local models and paid
APIs). Adam's belief is half right. Shipped assets are small and mostly come
from seeded processes, but they are not reproducible on a student machine and
some are hand picks. The weight is QA evidence video in `research/`, not game
assets.

## 2. Secrets and private data

- gitleaks, history and tree: clean. Commands:
  `gitleaks git --redact .` and `gitleaks dir --redact .`.
- Emails: only `adam@adamsmith.as` (commit author on all 149 commits, and in
  text). Already public on adamsmith.as. Fine.
- `~` absolute paths: 700 tracked files. 666 are `vo/out/**/*.json`
  (`"voice_ref": "vo/voices/..."`), 3
  are `vo/voices/*.es|zh.json`, and the rest are research logs (`ci.log`,
  `capture.log`, intelligibility and creative-review JSON). Not secret, but
  it reveals the username and machine layout. Source code (`src`, `scripts`,
  `qa`, `trailer`, `art`, configs) has none.
- Home-relative defaults that assume this Mac: `vo/render.py:86`
  (`~/Code/bbb-artifact-tour/audio.cpp/models`, another project),
  `music/render.py:35` and `sfx/render.py:54` (`~/Code/sa3/...`),
  `sfx/render.py:18` (`~/.tokens/fal-ai`), `qa/ab.ts:112` and
  `qa/judge.ts:278` (read the OpenRouter key from
  `~/.local/share/opencode/auth.json`). All overridable by environment
  variables except the opencode auth path. Not leaks, but tied to this Mac.
- Tailnet: `vite.config.ts:13-16` allows `.ts.net` hosts and names Adam's
  tailnet generically. No actual tailnet hostname appears anywhere; `[host]`
  does not appear.
- Session ids: two opencode session ids in `docs/SKILLS.md:48,51`. Harmless
  outside Adam's machine; keep or shorten.
- Private course folder: `(private course workspace)/...` is referenced in
  `AGENTS.md:178` and `research/2026-10-29-making-of-index/README.md:86,328,403`.
  Line 403 describes that folder as "private course repo with grading and
  student" data. No Canvas URLs, no student names, no rosters, no grades
  found. Only the path and its description leak.
- Spend ledger `research/SPEND.md`: dollar amounts, models and endpoints,
  no account ids or card data. Pedagogically valuable (honest cost of agentic
  production); keep.
- Dashboard `production/server.py` and `production/status.json`: local only;
  no hostnames. `server.py` already filters credential-like paths.

## 3. Licensing

- **No project license exists** (no `LICENSE` at the root). Proposal: MIT for
  code (matches three.js and is simplest for students to remix) and CC BY 4.0
  for original non-code content (script, narrative bible, docs, research
  prose); keep CC0 for `public/branding` as already declared. Alternative if
  Adam wants remixers to stay open: MPL-2.0 for code (file-level copyleft,
  still easy for students). The `reference/e4-starter/` copy is Adam's own
  course starter; license it the same way.
- Dependencies: three.js (MIT) and Vite (MIT) via npm, pinned in `deno.lock`.
  Add a short `THIRD_PARTY.md`.
- Fonts: `art/blender/fonts/Orbitron.ttf` with `OFL.txt` alongside: compliant
  if both stay together. The web UI uses system fonts only.
- Model outputs (verify current terms before publishing; summaries here are
  from memory, not freshly fetched):
  - Qwen3-TTS, Qwen3-ASR, ForcedAligner: Apache-2.0 weights; no output
    restrictions. Voices are designed from text prompts (`instruct` in
    `vo/voices/*.json`), not cloned from real people, so no likeness
    issue. One prompt asks for a "movie-trailer narrator" archetype; that is
    a genre, not a person.
  - Stable Audio 3 (music, most SFX): Stability AI community-style license
    for the weights; outputs are generally owned by the user, with revenue
    thresholds for commercial use. A free educational repo is fine, but cite
    the license in `THIRD_PARTY.md` and confirm the exact SA3 terms.
  - ElevenLabs SFX v2 via fal (`sfx/gameplay.yaml`): paid generations,
    commercial use allowed under the paid terms; note that the files are not
    reproducible and their provenance in `THIRD_PARTY.md`.
  - OpenRouter judge outputs (JSON in research): fine to publish.
- Text excerpts: TV Tropes and manuals appear as links and short quotations
  (`research/2026-10-28-narrative-tropes/README.md`,
  `research/2026-10-28-control-feel/SOURCES.md`, which quotes one short manual
  sentence). Short cited quotations are defensible fair use; keep.

## 4. Third-party material in research/ that should not be public

Commercial game screenshots and scans, not ours to redistribute (about 38 MB
compressed in history):

- `research/2026-10-28-critique-visual/comparators/` (36 images, plus
  `comparators/thumbs/`): Cygni, Ex-Zodiac, Hi-Fi Rush, Ikaruga, Returnal,
  Rez Infinite, and others.
- `research/2026-10-28-critique-visual/side/` (9 side-by-side composites
  embedding comparator frames).
- `research/2026-10-28-level-design/comparators/` (61 images: Cygni,
  DoDonPachi, Ex-Zodiac, Ikaruga, Radiant Silvergun, Returnal, Rez, Sky
  Force, Thumper) and `research/2026-10-28-level-design/side/`.
- `research/2026-10-28-critique-ui/comparators/` (6: Forza Horizon 5, Ghost of
  Tsushima, The Last of Us Part II).
- `research/2026-10-28-control-feel/manual-controls-page6.png` (CAVE
  DoDonPachi Resurrection manual scan).

Fair use for internal critique is plausible, but bulk publication of full
frames in a public repo weakens that argument and invites takedowns.
Recommendation: remove from the published history and replace each folder
with a `SOURCES.md` listing title, publisher and source URL (the scripts that
fetched them, `research/2026-10-28-critique-visual/scripts/` and
`research/2026-10-28-level-design/scripts/`, can stay so a reader can
re-fetch). Original-game screenshots in `research/2026-10-28-original-reference/`
are Adam's own E4 starter: keep.

## 5. History rewrite: options

| Option | What | For teaching | Cost |
| ------ | ---- | ------------ | ---- |
| A. `git filter-repo` on a fresh mirror | Drop the comparator paths (and optionally all research `*.mp4`/`*.webm`) from every commit, keep 149 commits | Keeps the real, messy, dated history: the most valuable thing for students studying agentic production | Hashes change, so commit references in docs (for example `c598544`, `d351d9d` in skills and `docs/`) go stale unless rewritten with `--replace-text` or a mapping note |
| B. Fresh squashed history | One "initial public release" commit of a curated tree | Clean and small | Destroys the process record that makes this a teaching artifact |
| C. Curated subset repo | Publish `src/`, `public/`, docs only | Simplest to read | Same loss as B, plus split-brain maintenance |

Secrets do not force a rewrite. Copyright does: deleting the images in a new
commit leaves them in history. Recommend **A**.

## 6. Other obstacles

- No `.github/workflows/`. Need a Pages workflow: checkout, setup Deno (pin
  version), `deno task ci` with `REPO_NAME=<repo>` so `vite.config.ts:8` sets
  the base path, then `actions/upload-pages-artifact` on `dist/` and
  `actions/deploy-pages`. Verify the service worker and
  `offline-manifest.json` respect the subpath (test with `REPO_NAME` locally
  and `deno task preview`).
- `deno task qa*` and `trailer` need Playwright Chromium, ffmpeg and
  OpenRouter keys; document as maintainer-only, keep out of CI.
- Python generators run with `uv run --script` (inline deps): good for
  longevity, but they depend on uncommitted model weights. Write a
  `docs/REGENERATION.md` table (what, command, needs, deterministic or not).
- `AGENTS.md` and `.opencode/skills/` are honest process documents and worth
  publishing, but they mention the private course path, the subscription
  exhaustion and model handoff, and the "students on school Chromebooks"
  deployment intent. Review the tone for a public audience; nothing secret.
- `.gitignore` duplicates the `qa/reports/` and `qa/.build/` lines (cosmetic).
- The local repo has 2,843 unreachable objects and 2 temp files; irrelevant
  to a push, but `git gc` will tidy the mirror before filter-repo.
- Uncommitted work in progress (trailer edits, night-verification reels, VO
  casting anchors) should be resolved before the publication snapshot.

## Prioritized checklist

### Blockers

1. Remove third-party images from all history (section 4), replace with
   `SOURCES.md` stubs. On a fresh mirror, never in this working checkout:
   ```
   git clone --mirror . /tmp/nw-public.git
   cd /tmp/nw-public.git
   uvx git-filter-repo --invert-paths \
     --path research/2026-10-28-critique-visual/comparators/ \
     --path research/2026-10-28-critique-visual/side/ \
     --path research/2026-10-28-level-design/comparators/ \
     --path research/2026-10-28-level-design/side/ \
     --path research/2026-10-28-critique-ui/comparators/ \
     --path research/2026-10-28-control-feel/manual-controls-page6.png
   ```
   Check READMEs and HTML viewers that embed those images (for example
   `research/2026-10-28-critique-visual/README.md`) and make them degrade to
   links.
2. Add a root `LICENSE` (MIT proposed) plus `LICENSE-content` (CC BY 4.0) and
   `THIRD_PARTY.md` (three.js, Vite, Orbitron OFL, Qwen3 Apache-2.0, Stable
   Audio 3 terms, ElevenLabs/fal provenance). Adam's decision: license
   choice is his.

### Should fix

3. Rewrite `~/...` to repo-relative paths in history with
   `--replace-text` (one rule: `==>`),
   and make `vo/render.py` write repo-relative `voice_ref` going forward.
4. Make home-path defaults neutral: `vo/render.py:86`, `music/render.py:35`,
   `sfx/render.py:54` should require their env var with a clear error, and
   `qa/ab.ts:112`, `qa/judge.ts:278` should prefer `OPENROUTER_API_KEY`.
5. Decide on the private course path mentions (`AGENTS.md:178`,
   `research/2026-10-29-making-of-index/README.md:86,328,403`): reword to
   "a private course workspace" or keep the name without the grading
   description.
6. Add `.github/workflows/pages.yml` (Deno pinned, `REPO_NAME`, `deno task
   ci`, deploy `dist/`) and verify the PWA under the subpath.
7. Write `docs/REGENERATION.md` (asset family, command, requirements,
   determinism, "do not regenerate unless you have X").
8. Slim history for school networks (optional but cheap during the same
   filter-repo pass): drop research `*.webm` duplicates of `reel.mp4`
   (`--path-glob 'research/**/*.webm' --invert-paths`) or all research
   video, moving a curated set to a GitHub Release asset
   (`research-media-2026-10-29.zip`) linked from each README. Measured
   (compressed, all history): research video is 199 MB (28 MB of it webm),
   comparators 38 MB, total 360 MB; dropping both leaves about 123 MB.

### Nice to have

9. Remove opencode session ids from `docs/SKILLS.md` or label them as local.
10. Keep `research/SPEND.md` and mark it as a teaching exhibit.
11. Dedupe `.gitignore`; `git gc --prune=now` locally.
12. A top-level README for students: how to run (`deno task dev`), what is
    in `research/`, how to read the history.
13. Comment `vite.config.ts` tailnet allowance as "maintainer phone testing"
    (no change needed).

## Recommended publication strategy

Publish a **filter-repo'd mirror of the real history** (option A) to a new
public repository after the final days of work and once the tree is clean,
not a squash. One pass: strip third-party images, normalize `~`
paths, optionally move research video to a Release asset. Keep all shipped
assets committed (no LFS, no CI regeneration), add licenses and
`docs/REGENERATION.md`, and deploy with a Pages workflow running
`deno task ci` with `REPO_NAME`. Keep this local repository as the private
canonical archive; note in the public README that hashes differ from the
local ones. Publishing is outward-facing, so Adam approves each step (repo
creation, push, Pages enablement).

## Status and evidence

- Tried: size census (`git rev-list --objects --all` with
  `cat-file --batch-check`), gitleaks one-off (history and dir), rg patterns
  over `git log --all -p`, fresh clone plus `deno task ci` in
  `/tmp/nwaudit/clone` (exit 0, `dist/` 60 MB).
- Not done: byte-level determinism tests of the generators, live fetch of
  current Stable Audio 3 and ElevenLabs terms, subpath PWA test.
- Next step: Adam picks a license and approves strategy A; then a worker
  runs filter-repo on a mirror and reports size and a link-check.
