# Landing page wireframe (draft for the judge panel, October 29, 2026)

Static GitHub Pages site for _Neon Warden_, a free browser vertical slice
(a vertical shoot-'em-up in three.js and TypeScript). Two audiences:
(a) players, many of them children on low-end school Chromebooks or phones,
who just want to play; (b) students and teachers who want to know how it was
made. The game itself lives on its own page, `play/`, which is also the scope
of the installable offline web app. The landing page at the site root is never
controlled by the service worker.

## Order, top to bottom (portrait phone first)

1. **Top bar.** Small studio wordmark `adamsmith.systems` and `CM121 f26`
   (fictional studio and fictional incubator, credited in the footer as
   fiction). Language switch: EN / ES / ZH buttons (default from the browser
   language, remembered locally, no cookie).
2. **Hero.** Flat, screen-locked logo treatment from the game's boot sequence:
   the studio mark (inline SVG), a halftone dot field, one slow glint sweep,
   one short restrained glitch on the title "NEON WARDEN" at load. No
   parallax, no 3D, no WebGL. Under reduced motion: completely still.
   One-line pitch: "A contractor flies the lanes for pay. The Warden stands in
   the way. Was it ever in the way?" (placeholder copy).
   **Big Play button** ("Play in your browser"), visible without scrolling on
   a 360x640 phone and a 1366x768 Chromebook. Under it, one line of facts:
   "Free. No account, no ads, no tracking. Keyboard, mouse or touch. English,
   Spanish, Chinese." Secondary text link: "How it was made".
3. **Teaser.** A 30-second captured-from-the-game teaser. Poster image only
   until the visitor presses play (no autoplay, no preload), then sound and
   controls; English captions track. Labelled honestly as a draft cut if the
   final master is not ready. Download size shown next to it (about 2 MB).
4. **What it is.** Three short facts: a vertical slice (one complete
   playthrough of a larger imaginary game; parts outside the slice say
   "not included in this vertical slice" instead of being hidden); a
   pacifist route exists; plays offline after an explicit download.
   Content note: depicts violence and a morally gray ending; no content is
   softened for school devices (an explicit design decision).
5. **How it was made: 8 cards**, each a title, two-line summary and an anchor
   link to a deeper section further down the same page:
   1. A slice is an argument (built vs honestly stubbed).
   2. Assets are programs (Blender scripted headlessly, voice script as data,
      music and sound promoted from auditions).
   3. Engine and platform (three.js, TypeScript, Deno, Vite, static site, PWA,
      phones and Chromebooks).
   4. Two kinds of AI: frontier models as production orchestration and coding
      agents, versus mostly local models for asset generation (speech
      synthesis and recognition, music), a few cloud sound effects, and
      auxiliary judge and small-model passes. Diagram.
   5. QA at many levels (unit tests, deterministic sim, autopilots at 16x,
      URL skip-to, reels with real audio, human playtests). Pyramid diagram.
   6. Reels as dailies and blind judges (judges are told nothing, their
      claims are checked against event logs; a table of rejected claims;
      "the judge preferred the BEFORE build in 7 of 10 pairs").
   7. A/B in context, non-destructive judging, quick reviews.
   8. Read the source (links into the repository; what can and cannot be
      regenerated without local models).
6. **Deeper sections** (one per card, about 120 to 200 words each, English
   only in the first version, with a note in ES/ZH saying so), three inline SVG
   diagrams: asset pipelines living outside the runtime; agent orchestration
   versus local asset inference; the QA pyramid.
7. **Footer.** Credits ("Adam Smith, and his coupled agents"; models named
   with dates and roles), licences, "This site sets no cookies, loads nothing
   from third parties and collects no data", build revision and date.

## Technical constraints

- No third-party requests, no analytics, system fonts only, no framework.
- Landing JS under 10 KB; total first load (HTML, CSS, JS, inline SVG,
  poster) under 150 KB; the teaser video only on demand.
- Tap targets at least 44 px; contrast at least 4.5:1; full keyboard path;
  skip link; `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Play goes to `play/`; the game has its own language setting in its own
  front-end screens, so the landing page does not try to set it.
