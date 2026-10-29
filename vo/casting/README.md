# VO casting auditions

Candidate voices for a speaker, rendered beside the production pipeline without
touching `vo/voices/` or `vo/out/`. Nothing here ships until a pick is promoted.

## tutorial_ai recast (October 28, 2026)

Adam's note: the current anchor is "too girlish" (median f0 about 428 Hz).
The Lane Authority onboarding system should sound adult: corporate, helpful,
banal, never sinister, with sincere institutional warmth rather than cuteness.

| key | brief | median f0 | ASR en / es / zh |
|---|---|---|---|
| a_captain | adult female alto, airline-captain calm, 40s | 185 Hz | 1.000 / 0.922 / 0.991 |
| b_keynote | adult female, crisp corporate keynote presenter | 239 Hz | 1.000 / 0.905 / 0.991 |
| c_service | male, calm mid-Atlantic customer-service baritone | 103 Hz | 1.000 / 0.878 / 0.949 |
| d_synthetic | androgynous synthetic, smooth, slightly processed | 179 Hz | 1.000 / 0.888 / 0.991 |
| e_narrator | older male, kindly orientation-video narrator | 114 Hz | 1.000 / 0.966 / 0.991 |

Full numbers (per clip f0, ASR transcript, seed) are in
`tutorial_ai/index.json`. Pitch is a listen-free proxy: it says "not girlish",
not "good". The first designs for b and e measured 290 Hz and 178 Hz, too high
for their briefs, so their descriptions were tightened (see the comments in
`cast_candidates.py`). Spanish ASR runs about 0.88–0.92 for every candidate,
so that is the scorer and the Spanish ASR, not a casting signal.

Audition lines: `tut_wink_001` (the wink), `tut_warden_001` (the Warden
hype), `tut_move_001` (instructional), each in en, es, zh, plus each
candidate's anchor. All candidates share one anchor line and seed 11.

### Listen

```sh
python3 -m http.server -d vo 8122
# open http://localhost:8122/casting/tutorial_ai/audition.html
```

Serve `vo/`, not `vo/casting/`, so the current anchor (`vo/voices/`) plays as
a reference row. Keys: Up/Down candidate, Left/Right clip, Space play/stop,
0–9 play clip n, Enter pick, A autoplay. "Copy pick JSON" copies the pick with
its design and anchor text.

### Re-run or add candidates

```sh
uv run vo/casting/cast_candidates.py                       # cached; only new or changed work
uv run vo/casting/cast_candidates.py --only b_keynote --force
```

Candidates, the anchor line and the audition lines live at the top of
`cast_candidates.py`. It imports `vo/render.py`, so models, ASR and scoring
match production. Layout: `tutorial_ai/<key>/anchor.{wav,json}` and
`tutorial_ai/<key>/<lang>/<line>.{wav,json}`.

## Promoting a pick

Copy the auditioned anchor rather than recasting, so the voice that ships is
exactly the one Adam heard (VoiceDesign is not guaranteed bit-reproducible).

1. **Replace the anchor.** With `PICK` set to the chosen key:

   ```sh
   cp vo/casting/tutorial_ai/$PICK/anchor.wav vo/voices/tutorial_ai.wav
   python3 - "$PICK" <<'EOF'
   import json, sys
   src = json.load(open(f"vo/casting/tutorial_ai/{sys.argv[1]}/anchor.json"))
   src["request"]["id"] = "tutorial_ai"
   json.dump(src, open("vo/voices/tutorial_ai.json", "w"), ensure_ascii=False, indent=2)
   EOF
   ```

   The sidecar's `hash` and `request.text` become the speaker identity and
   the clone reference text, so every `tutorial_ai` line goes stale and
   nothing else does.

2. **Update the casting record** in `vo/script.yaml` under
   `speakers.tutorial_ai`: set `design` to the candidate's `design`, `anchor`
   to the shared anchor line (in `index.json`), keep `seed: 11`, and rewrite
   `description` (drop "perky, bright, theme-park"; fix pronouns if the pick is
   male or androgynous, including the flashback note). If these match the
   copied anchor exactly, `render.py` prints no "casting fields differ" notice.
   Also drop the per-line `seed:` overrides on `tutorial_ai` lines (for
   example `tut_route_001`, `tut_warden_001`, `tut_warden_002`): they were
   picked by `--retry-low` for the old voice.

3. **Re-render tutorial_ai lines only.** Confirm the scope, then render:

   ```sh
   uv run vo/render.py --dry-run          # should list only tutorial_ai lines as stale
   uv run vo/render.py --asr --retry-low  # renders the stale lines, ASR, reseeds low takes
   ```

   If other speakers show as stale for unrelated reasons, restrict with
   `--only <id>` per tutorial_ai line instead. Then read `vo/out/REPORT.md`
   and run the `qa/` translation and asset checks before calling it done.

4. Optionally move `vo/casting/tutorial_ai/` out of the repo or delete the
   losing candidates (about 22 MB of WAV in total).
