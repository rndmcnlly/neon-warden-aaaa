# Landing page for the GitHub Pages build (October 29, 2026)

## Framing question

The static GitHub Pages site needs a front door for two audiences: (a) players,
many on school Chromebooks or phones, who just want Play; (b) students and
teachers who want to know how the slice was made. What should that page be,
and how does the build change so the game keeps a correct PWA scope?

Disciplines in play: game marketing craft (store pages, press kits), web
performance and accessibility, information design for teaching, and the
ethics of claims (honest AI attribution, no tracking of children).

## Research (web, fetched October 29, 2026)

- presskit() by Rami Ismail, <https://dopresskit.com/>: a press page is a
  resource with easy-to-access facts, not decoration; factsheet, short
  description, trailer, team. presskit.gg's 2026 guide repeats the anatomy
  (<https://presskit.gg/blog/indie-game-press-kit-guide>).
- Steam page practice: the first screenshot, short description and trailer
  decide whether visitors scroll; trailers that take 20+ seconds to show play
  lose people (<https://www.steampageanalyzer.com/blog/why-steam-game-not-selling>,
  <https://www.codecks.io/blog/2023/how-to-design-your-steam-store-page/>).
- itch.io creator docs and community advice: make the browser-play option
  obvious and easy to find (<https://itch.io/docs/creators/design>).
- Postmortems: name specifics, show what went wrong
  (<https://blog.codinghorror.com/game-development-postmortems/>).
- WCAG 2.2: 2.2.2 Pause, Stop, Hide; 2.5.8 Target Size (24 px minimum)
  (<https://www.w3.org/TR/WCAG22/>).
- Alex Russell, "The Performance Inequality Gap, 2026": low-end devices are
  many times slower, and Chromebooks are below even the measured low end
  (<https://infrequently.org/2025/11/performance-inequality-gap-2026/>).
- GitHub Pages limits: 1 GB site, soft 100 GB/month bandwidth
  (<https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>).

### Concerns derived

1. One obvious Play action above the fold at every size, one tap away.
2. Show the game early (footage), say what it is in one line.
3. Tell people what happens after Play (download, sound, logos).
4. Honest claims: dated, specific, linked to source; failures shown.
5. No tracking, cookies, third-party requests or webfonts.
6. Small first load; video only on demand; motion runs once and respects
   reduced motion; no flashes.

## Judge panel

`judge.ts` sent `OUTLINE.md` to three isolated passes of Gemini 4 Argon
(OpenRouter, mandatory ZDR, no fallbacks), each primed with one persona's
concerns: player, teacher, auditor. Same model three times: independent
passes, not a diverse-model consensus and not human reviewers. Cost logged in
`research/SPEND.md`. Raw answers: `out/judge-*.json`.

### Adopted

- Genre in the first line of the pitch (player).
- Under Play: what happens next, sound, approximate download; a content note
  next to Play, not below the fold (player, auditor).
- Gameplay above the fold: the teaser poster (a real game frame) sits beside
  the hero on desktop and directly after it on phones (player, partly).
- Every deep section ends with evidence links into the repository and a
  "What went wrong" paragraph; "Human decisions" paragraphs say what Adam
  decided (teacher).
- A presskit-style factsheet ("What it is") and named model roles in the AI
  section (teacher).
- Glint and glitch run once, under 2 s total, offsets only, no luminance
  flash; halftone is one CSS gradient, not nodes (auditor).
- SVG diagrams carry `<title>`/`<desc>`; English-only sections carry
  `lang="en"` and ES/ZH visitors see a notice (auditor).
- `sessionStorage` for the language choice, so shared school devices reset
  (auditor).
- Whole cards are single links (auditor).

### Declined, and why

- Replace the logo hero with a gameplay screenshot: the brief asks for the
  flat logo treatment; the poster beside it covers the need.
- Pass the landing language into the game: it would couple the landing page
  to the game's versioned settings schema; the game has its own language
  screens.
- A playtime estimate: no measured slice runtime exists (see the making-of
  index); inventing one would be the overclaiming the page argues against.
- Replace "Adam Smith, and his coupled agents": that wording is Adam's dated
  credits decision; the page adds the model-role detail instead.
- Named-device frame-time evidence for Chromebooks: none exists; the page says
  "designed for" and carries a TODO for the audit.
- ES and ZH captions on the teaser: the draft has burned-in English subtitles
  and localized cuts belong to the trailer workstream.

## What was built

- `index.html` (landing, site root), `src/landing/` (`strings.ts` EN/ES/ZH,
  `main.ts` language switch only, `landing.css`), `public/media/` (draft
  teaser, 1.8 MB, `preload="none"`; poster 8.8 KB WebP).
- Game at `play/index.html` (the rename landed in `87d4896`, swept into
  another session's commit from a staged `git mv`; the rest is `e172ccb`).
- PWA decision: scope `play/`. `sw.js` stays at the root beside the assets,
  registered with scope `play/`; manifest id, start URL and scope `./play/`;
  the landing page is never controlled and is excluded from offline packs.
- Root URLs with game flags forward to `play/`, so `qa/` and `trailer/`
  capture tools keep working unchanged.
- Fixed on the way: the flat logos used an absolute `/branding/` path that
  broke under any `REPO_NAME` subpath.

## Verification (at `e172ccb` plus docs; dirty checkout from other workers)

- `verify.ts` (own port 4329, subpath build `REPO_NAME=neon-warden-aaaa`, a
  GitHub-Pages-like server): 58 of 58 checks passed, `out/verify.json`,
  2026-10-29T18:52Z. Desktop 1440x900, Chromebook-sized 1366x768 and
  1280x720 (touch), phone 360x640 and 640x360: Play above the fold, one tap
  or click to `play/`, no horizontal overflow or clipped elements, no
  external requests, teaser not fetched before play, game loads with no asset
  404s or errors; language switch, reduced motion, SW scope `play/`, landing
  uncontrolled, offline pack contents, redirect shim.
- Payload: first load about 27 KB gzipped (HTML 9.4, JS 5.6, CSS 2.8,
  poster 8.8); 61 KB transferred uncompressed in the throttled run (4x CPU,
  1.6 Mbps, 150 ms RTT), LCP 564 ms, 310 DOM nodes. A Mac proxy, not a
  Chromebook measurement.
- `tests/platform_browser.ts` (PWA download, offline restart, quota, update):
  passed, `qa/reports/platform-2026-10-29T18-53-19.427Z/result.json`.
- QA probe through the redirect (`?skipto=boss&autoplay=fight&speed=4&qa=1`)
  reached `play/` with a live probe and no page errors.
- `deno task ci`: lint, typecheck, 303 tests and build pass; `fmt --check`
  fails only on three in-progress `trailer/` files owned by the trailer agent.
- Screenshots: `shots/` (desktop, Chromebook-sized, phone EN/ES/ZH, phone
  landscape, the game page on a phone, desktop full page).

## Awaiting the public-repo audit (TODO comments in the source)

- Repository URL for evidence links (`vite.config.ts`, `REPO_URL`).
- Licence lines in the footer.
- Exact model list and roles (`index.html`, section 04).
- Whether phone and Chromebook testing justify "tested on" (section "Where it
  runs" and section 03).
- Night-verification folder committed and cleared before it is linked.

## Next step

Refresh `public/media/teaser30-en-draft.mp4` and the poster when the trailer
agent's master exists (`trailer/out/teaser30/en/`), rename to drop "draft",
and update the caption strings; then the audit clears the TODOs before deploy.
