# Public mirror: first build (October 29, 2026)

Framing question: can the audit's strategy A (filter-repo on a mirror, real
history kept) produce a publishable repository with Adam's decisions applied
(MIT code, CC BY 4.0 content, research video dropped entirely, no Release
assets)? Nothing was pushed, no GitHub repository was created, nothing was
deployed.

## Result

| Measure | Value |
| --- | --- |
| Mirror | `~/Desktop/neon-warden-public` (non-bare, no remote) |
| Built from | private `main` at `acab95e` (uncommitted work excluded) |
| Commits | 159 (158 rewritten plus one publication commit) |
| `.git` size | 116 MB packed (audit estimate for the unfiltered push: about 360 MB) |
| Largest blob | 2.8 MB (`vo/out/cues.json`) |
| Command | `scripts/publish_mirror.sh` (re-runnable; about 85 s) |

Verification, all from the script's own checks:

- No blob over 10 MB: pass.
- No removed third-party path and no `research/**` video in any commit: pass.
- Private patterns in every blob (home paths, macOS temp paths, tailnet
  hostnames, the private host name, the private course folder name): 0 hits.
- gitleaks 8.28.0 over 159 commits: no leaks.
- Fresh clone of the mirror, `deno task ci`: pass.

## What was removed or rewritten

- The audit's section 4 folders, plus one it missed:
  `research/2026-10-28-critique-ui/compare/` (four composites embedding Forza
  Horizon 5, Ghost of Tsushima and The Last of Us Part II frames). Each
  emptied folder gets a `REMOVED.md` listing the former file names.
- Every `*.mp4`, `*.webm`, `*.mov`, `*.mkv`, `*.m4v`, `*.avi` under
  `research/`. No video exists outside `research/` in any commit.
- `--replace-text`: repository-absolute paths become repo-relative, other home
  paths become `~`, temp paths become `$TMPDIR`, the course folder becomes
  "private course workspace".
- `docs/COMMIT-MAP.tsv` maps private short hashes to public ones, since docs
  cite private hashes (for example the scope cut `c598544`).

## Fixed forward in the working repository (same day)

`LICENSE`, `LICENSE-CONTENT`, `README.md` (licensing table, third-party
notices), `docs/REGENERATION.md`, `.github/workflows/pages.yml`; generator
defaults now point inside the repo with env overrides; `vo/render.py` writes
repo-relative `voice_ref`; 698 tracked metadata and log files stripped of
absolute paths; private course mentions reworded.

## Open items

- The landing page restructure (game moving to `/play/`) was mid-flight: the
  mirror predates it. Rerun the script after it lands and re-check the Pages
  workflow and service worker scope.
- ElevenLabs is credited in `README.md` but not yet in `src/data/thirdParty.ts`
  (needs a UI string in three languages).
- `qa/ab.ts` and `qa/judge.ts` still fall back to the local opencode auth
  file when `OPENROUTER_API_KEY` is unset; left alone because `qa/` belonged
  to the trailer agent today.
- Stable Audio 3 and ElevenLabs terms were summarized, not freshly fetched.
- The trailer agent's research folders still hold absolute paths in the
  working tree; the mirror rewrites them.
