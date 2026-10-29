# Critique: front-end UI/UX and motion (October 28, 2026)

**Framing question.** Does the Neon Warden front end read as an authentic,
high-polish vertical slice next to front ends famous for polish, and what are
the cheapest changes with the most effect?

**Disciplines in play.** Game UI/UX (information architecture, focus models),
typography and localization (CJK typesetting), motion design (timing,
easing, choreography), accessibility standards (XAG, Game Accessibility
Guidelines), audio-visual pairing.

**Evidence used** (all in this folder):

- `ours/`: downscaled QA contact sheets from
  `qa/reports/20261028-185534/reels/{menus-en,menus-es,menus-zh,accessibility}`
  (the `latest` symlink pointed at a run with no reels) and the four
  `research/2026-10-28-frontend-shots/` frames.
- `frames/`: single frames pulled from the menus-en/zh/es reels;
  `frames/ours-a11y-zh.jpg` crops the Accessibility tab and the ZH licenses
  panel.
- `comparators/`: official or first-party-sourced menu screenshots
  (untrusted data, images only): Forza Horizon 5 (Can I Play That? deep
  dive), Ghost of Tsushima (gameaccess.info), The Last of Us Part II
  (PlayStation Blog Flickr set).
- `compare/01-04`: side-by-sides (ImageMagick): subtitles vs FH5,
  accessibility vs Ghost of Tsushima, controls vs TLOU2, main menu vs FH5.
- CSS tokens grepped from `src/ui/frontend.css` (not read whole).
  `scripts/imgs.py` is the trimmed page-image extractor.

Not sourced this pass, to save tokens: Destiny 2, Persona 5, Hades, Cyberpunk
2.0, Apex, Tetris Effect. Where these are cited below, it is from general
knowledge of their design, not from images in this folder. No paid inference
was used (no SPEND.md entry).

**Overall verdict.** The *systems* are ahead of most indie slices and level
with the comparators in places: subtitles before first sound, a live subtitle
preview, honest stub badges, Q/E tab prompts, a remap table with alternate
column, reduced motion as the CSS base case (excellent idea, see
`frontend.css:5`). The *presentation* lags: one type size does most of the
work, the glass panels let the 3D lanes cut through text, descriptions exist
for three rows only, and the motion is generic (one 260 ms rise for
everything). It reads as a tasteful web app, not as a game front end yet.

## 1. Typography hierarchy

- Base unit `--nw-unit: clamp(14px, 1.65vh, 22px)`: about 17.8 px at 1080p.
  Menu rows, values and hints sit within 0.75–1.05em of that, so the main
  menu has roughly two visible sizes: logotype and everything else. Compare
  Destiny 2 or FH5, which run at least four steps (screen title, section,
  row, description) with weight changes as well as size.
- Main menu: "New Game" (the primary action) is the same size and weight as
  "Quit". The `.is-primary` class exists but only shows when focused.
- Subheads (`.nw-title`, 0.8em, 0.42em tracking, uppercase) are the smallest
  text on screen and carry the screen name ("SETTINGS"). Hierarchy is
  inverted: the label that tells you where you are is the hardest to read.
- Two families (Avenir Next plus a mono for values) is right. The mono
  values ("150%", "On") on the right edge are a nice instrument-panel touch;
  keep them.
- Logotype: `font-style: italic` at weight 800 on Avenir is fine in Latin,
  but in ZH ("霓虹守望者", menus-zh sheet) PingFang has no italic, so
  the browser synthesizes an oblique. Faux-italic Hanzi reads as a bug to
  Chinese readers.

## 2. Spacing and grid

- Panels are a single centered column of `min(34em, 92vw)`. Settings widens,
  but the lower 40% of each settings tab is empty while the description
  space is missing (see 5). FH5 and Ghost of Tsushima both use a two-column
  grid: list left, description and preview right, filled at all times.
- Main menu panel sits left with a large empty right two-thirds; the ship
  centered in the backdrop competes with nothing. Good composition, but the
  panel is vertically centered against a 3D lane that passes through it
  (lane lines visible across the menu at x of about 200 px).
- Row padding (0.45em 1em) and row gap are consistent: good rhythm. The
  controls table is denser than the rest and its cells are a different
  height from setting rows, which makes Controls feel like a different app.

## 3. Focus states

- Focus = gradient wash, 3px inset cyan bar, 1px ring, glow, plus a 3 px
  label nudge. On the notice and main menu it reads well. On the settings
  tabs at 720p capture size it is subtle: in the contact sheets the focused
  row is hard to find in two of six frames.
- Focus and selection are not distinguished on tabs: the selected tab is a
  pink underline pill, the focused element elsewhere is cyan. Pick one rule
  (cyan = focus, pink = selected/current) and document it.
- Disabled "Continue" is only slightly dimmer than live rows. Good that it
  explains itself (checklist row), but give it a lock glyph or 50% opacity
  on the label so the eye skips it.
- `.nw-button:focus` (not only `:focus-visible`) is styled, so mouse clicks
  also leave a focus wash. Fine for a game (one focus model), and matches
  the checklist "one focus model for all three inputs".

## 4. Motion language and timing

Current: panel `nw-rise` 260 ms `cubic-bezier(0.2,0.8,0.2,1)`, focus
140 ms ease, switch knob 160 ms, banner 420 ms, toast 200 ms, logo 2.4 s.

- Durations are in the right bands (focus 100–150 ms, panels 200–300 ms),
  and reduced motion is the base case: best-practice and teachable.
- Missing: *direction*. Every screen rises from 10 px below regardless of
  whether you went deeper or back. Persona 5 and Destiny 2 encode depth in
  motion: forward slides in from the right, back reverses. Tabs (Q/E) should
  slide content horizontally in the direction of the tab change.
- Missing: *stagger*. Rows appear as one block. A 20–30 ms per-row stagger
  (cap at 8 rows, 200 ms total) is the single cheapest "AAA" signal.
- Missing: *exit*. Screens vanish then the next rises; there is no outgoing
  animation, so transitions read as cuts with a fade-in.
- The focus nudge (3 px) is good; consider a 1-frame "selection flash" on
  confirm (80 ms brighten) so activation feels different from focus.
- The cyberpunk fiction invites one signature move (a scanline wipe or a
  chromatic split on panel enter, 120 ms) gated behind Reduce motion and
  Reduce flashing. Cyberpunk 2.0 and Apex both have one recognizable UI
  "stinger"; Neon Warden has none yet.

## 5. Information density

- Settings rows are sparse and mostly undescribed. Only Auto-fire, Language
  and Reduce motion carry a hint (`settings.ts:207,313,348`). Ghost of
  Tsushima and FH5 show a description for *every* row in a fixed side
  panel (compare/01, compare/02). "Shape cues alongside color", "Fire and
  focus buttons: Hold" and "Game speed" particularly need one.
- The aside (`.nw-settings-aside`) exists but only hosts the subtitle
  preview; it collapses when empty (`:empty`). Make it the description panel
  for every tab, with the preview as a special case.
- Extras tiles: pink "not included in this vertical slice" badges are tiny
  (0.62em, tracked caps) and pink-on-violet; they are the funniest copy in
  the UI and the least legible. Surface the stub copy in the aside on focus.

## 6. Settings UX (previews, descriptions, defaults, reset)

- Subtitle preview: genuinely at comparator level, and better than FH5 in
  one respect (always visible, FH5 needs a button). Keep it. Add the speaker
  color, and show the 200% case wrapping (it already clamps to N lines).
- Defaults: nothing shows which value is the default. FH5 and TLOU2 show a
  "Reset to Default" prompt per row; Destiny 2 marks the default value with a
  small tick. Add a dot or "(default)" marker on the value, and per-row
  reset on a button (Backspace / gamepad Y).
- Reset: only "Reset all settings" (pink, bottom right, a destructive action
  sitting where the eye lands last) plus "Reset controls to defaults". Add
  "Reset this tab"; keep reset-all behind a confirm (it may already be).
- Graphics: preset row plus toggles, but no live preview or effective
  resolution readout beside the render scale (checklist asks for one).
- No presets for accessibility. TLOU2's Vision / Hearing / Motor presets are
  the model; even one "Recommended for low vision" bundle would help.
- Controls (compare/03): our table shows all three columns at once, which
  is more legible than TLOU2's one-binding-per-row. Missing: conflict
  reporting ("Unbound from ...", TLOU2 in red) and a per-action description.

## 7. Localization robustness (ES, ZH)

- QA overflow is warn only (2–4 px), so layout survives ES length. Good.
- ZH: tracked uppercase styles apply `letter-spacing: 0.3–0.5em` to Hanzi
  ("第 三 方 许 可 证" in frames/ours-a11y-zh.jpg). Tracking is a Latin
  small-caps device; on CJK it reads as broken spacing. Use `:lang(zh)`
  overrides: `letter-spacing: 0.08em; text-transform: none`.
- Faux italic on the ZH logotype (see 1).
- Line breaking: no `line-break`, `word-break` or `text-wrap: pretty` rules
  for CJK except two `text-wrap: balance` uses. Add `:lang(zh) { line-break:
  strict; }` so closing punctuation (，。) never starts a line, and
  `text-wrap: pretty` on body copy for ES widows.
- Font fallback: `--nw-font` lists PingFang SC, Noto Sans SC, Microsoft
  YaHei: good, but Avenir comes first, so Latin glyphs inside ZH strings
  (three.js, MIT) render in Avenir while Hanzi render in PingFang, at
  different x-heights. For `:lang(zh)` put PingFang SC first. The subtitle
  stack (`system-ui, PingFang SC`) differs from the UI stack; unify.
- The mono value font has no CJK; "中文" values in mono fall back to a
  proportional font and lose alignment with the Latin "On"/"Off". Check
  that ZH toggles say 开/关 in the UI font, not the mono.
- `<html lang>` already switches to `zh-Hans` (`frontEnd.ts:231`), and the
  subtitle box sets its own `lang`, so every `:lang(zh)` fix below works
  without TS changes.

## 8. Gamepad and keyboard prompt quality

- Bottom-right prompt bar (Enter Select, ← → Adjust, Q E Tab, Esc Back) is
  clear and context-sensitive per screen. Good.
- Prompts are text chips (`<kbd class="nw-glyph">`) in mono. On gamepad the
  remap table shows "D↑", "L2", "Start", which are text approximations.
  Comparators all use drawn glyphs per controller family. `prompts.ts`
  already knows the family (`glyphFor(..., family)`); add an inline SVG set
  (Xbox ABXY, PlayStation shapes, generic) for face buttons and d-pad.
- Main menu shows "Esc Back" where there is nowhere to go back to. Drop it
  or relabel to the title screen.
- Prompt bar sits 4% from the bottom edge, at the TV safe-area limit; fine
  for web, but use `env(safe-area-inset-bottom)` for phones.

## 9. Sound-to-motion pairing

`sound.ts` already declares a rich role set (focus, confirm, back,
tab_switch, toggle_on/off, slider_tick, slider_end, error, locked,
menu_open/close, pause_in/out, save, notify): the vocabulary is there, the
question is choreography. Pairing gaps observed by reading timings,
not by listening:

- Focus motion is 140 ms ease; the move sound should have its transient at
  0 ms and a tail under 140 ms, or the next press's sound overlaps the tail.
  Rate-limit `focus` sounds to one per 50 ms for held d-pad repeat.
- `menu_open`/`menu_close` exist, but only the open has motion (the 260 ms
  rise); close has no reverse motion to land on. Pair them: open = rise + upward sweep, back = drop + downward
  sweep (Hades and Persona 5 both do this).
- `slider_tick`: pitch the tick by value (Tetris Effect and FH5 do this), so
  volume sliders are audible as they move.
- Toggle on/off sounds exist; make sure the knob's 160 ms travel lands on
  the sound's accent rather than starting with it.

## Top 10, prioritized

| # | Change | Impact | Effort | Notes |
| --- | --- | --- | --- | --- |
| 1 | Description aside for every settings row (and stub copy on focus) | High | S–M | `settings.ts`: give each row a `hint` key; on focus, `aside.replaceChildren(descEl, preview?)`. Drop `.nw-settings-aside:empty`. Add i18n keys in `ui.ts` (EN/ES/ZH). |
| 2 | Raise panel opacity behind text | High | XS | `--nw-glass: rgba(14,10,34,0.78)`; or keep 0.58 and add `.nw-panel::after` darkening the inner 90%. Lane lines must not cross text. |
| 3 | CJK typesetting pass | High (for ZH) | S | `:lang(zh) .nw-title, :lang(zh) .nw-subhead, :lang(zh) .nw-logotype-sub { letter-spacing: .08em; text-transform: none }`; `:lang(zh) .nw-logotype-name { font-style: normal; transform: skewX(-8deg) }` (a real skew is a design choice, faux italic is a bug); `:lang(zh) { line-break: strict; --nw-font: "PingFang SC", "Noto Sans SC", system-ui, sans-serif }`. |
| 4 | Type scale with four real steps | High | S | Tokens: `--nw-fs-title: 1.6em; --nw-fs-row: 1.1em; --nw-fs-desc: .85em; --nw-fs-label: .72em`. Screen titles at title size, not 0.8em tracked caps. Primary menu item one step larger. |
| 5 | Directional and staggered motion | Med–High | S | `data-nav="forward|back"` on `.nw-frontend` set by the router; keyframes `nw-in-right` / `nw-in-left` (translateX 24px, 220 ms); rows: `animation-delay: calc(var(--i) * 25ms)` with `--i` set in `widgets.ts`. Tabs slide by Q/E direction. Keep reduced-motion base. |
| 6 | Default markers and per-row reset | Med | S | Value gets `.is-default` dot; prompt bar shows "Backspace / Y: Reset" when focused row differs from default. "Reset this tab" above "Reset all". |
| 7 | Drawn gamepad glyphs | Med | M | Inline SVG sprite keyed by family in `prompts.ts`; fall back to text chips. Also used in the controls table. |
| 8 | Paired UI sound and motion | Med | S | Fire `menu_close` at the start of a new exit animation; pitch `slider_tick` by value; throttle `focus` to 50 ms. |
| 9 | Main menu emphasis and disabled clarity | Med | XS | `.nw-button.is-primary .nw-button-label { font-size: 1.15em; font-weight: 600 }` always, not only on focus; disabled label opacity .45 plus a lock glyph. Hide "Esc Back" on main. |
| 10 | One accessibility preset and a signature transition | Low–Med | M | "Recommended: low vision" (subtitle 200%, bg 90%, reduce shake, shape cues). Signature 120 ms scanline wipe on screen enter, off under Reduce motion or Reduce flashing. |

## Status and next step

Tried: static review of QA sheets and frames, CSS token grep, three
comparator side-by-sides. Not tried: listening to UI sounds, gamepad
hardware, an image-model second opinion, or a runtime check of
`:lang()` matching. Next step: a one-hour pass on items 1–4 (all CSS plus one
`settings.ts` change), then re-run `qa topic menus` and view the ZH and
accessibility sheets against this README.
