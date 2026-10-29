# trailer/: cut sheets to localized masters

Research, concerns, judge panel, dry run and render estimates:
`research/2026-10-29-trailer-prep/README.md`.

```
deno task trailer teaser30 --lang en          # capture takes, assemble master
deno task trailer trailer90 --lang all        # every language
deno task trailer teaser30 --draft            # 640x360 animatic, placeholders allowed
deno task trailer compendium120 --plan        # timing and warnings only
deno task trailer teaser30 --draft --shots hook-writ,warden-stop
deno task trailer teaser30 --draft --no-capture --lang zh
deno task trailer estimate                    # take inventory, capture bound
```

Outputs go to `trailer/out/<cut>/<lang>/` (gitignored): the MP4, an SRT, a
`report.json` (shot resolutions, warnings, measured loudness) and, for the
compendium, `.chapters.txt` (YouTube) and `.chapters.vtt`. Takes are cached
in `trailer/.cache/takes/` by a hash of the recipe and the frozen build in
`trailer/.cache/build/` (`--rebuild` refreezes it and invalidates every take).
A public master refuses an unresolved `{{PLAY_URL}}`; set
`TRAILER_PLAY_URL`. Never deploy or publish without Adam's go-ahead.

## Cut sheet fields

- `takes.<id>`: a capture recipe. `query` (game URL flags; `seed=121&qa=1` are
  appended), `settings` (seeded into the settings store before load; trailers
  mute the music and voice buses and turn subtitles off so post adds them per
  language), `steps` (the interactive subset of `qa/reels.ts` steps), and
  `maxSeconds`. `fromReel: "menus-{lang}"` borrows a QA reel's recipe.
  `langSensitive: true` captures once per language (readable UI text).
- `shots[]`: `beats` (of the music cue playing at the shot's start) or
  `seconds`; `take` plus `anchor` (`{ event, where?, nth? }`, `{ line }`,
  `{ log }`, `{ dom: screen, match }` or `{ at }`), `align` (where the anchor
  lands inside the shot, in beats or seconds), `offset` (seconds added to the
  anchor), `game` (game-audio gain, dB); or `card`. `label` overlays a lower
  third; `chapter` starts a compendium chapter.
- `music.edit[]`: `{ cue?, from, beats, fadeOut? }` or `{ silence: beats }`,
  in order; cue beats count from the manifest's `beatOffset` and wrap at the
  loop point.
- `vo[]`: `{ line, shot, offset }`; audio, duration, text and word timings
  come from `public/vo/cues.json`, speaker names from `src/i18n/ui.ts`. The
  planner checks every language for overlaps and stopdown overruns.
- `cards.<id>`: `style` (`title`, `tell`, `slate`, `chapter`, `lower`) and
  localized `text` and `small`.
