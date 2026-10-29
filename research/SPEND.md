# Paid API spend ledger

Budgets authorized by Adam on October 28, 2026: US $20 on fal, US $20 on
OpenRouter, for research, critique, and asset generation on this project.
Every agent that spends appends a row before reporting done. Stop and ask
before any single job estimated over US $3, or when a provider's running
total would pass US $15.

| Date | Agent / task | Provider | Model or endpoint | Calls | Est. US$ | Running total (provider) |
| --- | --- | --- | --- | ---: | ---: | ---: |
| 2026-10-28 | audio critique: 4 briefs x 2 takes (`research/2026-10-28-critique-audio/`) | fal | fal-ai/elevenlabs/sound-effects/v2 (11.2 s billed at $0.002/s) | 8 | 0.02 | 0.02 |
| 2026-10-28 | audio critique: 4 briefs x 2 takes (`research/2026-10-28-critique-audio/`) | fal | fal-ai/mmaudio-v2/text-to-audio (13.0 s billed at $0.001/s) | 8 | 0.01 | 0.04 |
| 2026-10-28 | omni-judges researcher: AV judge trial, boss reel 45 s | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.03 | 0.03 |
| 2026-10-28 | omni-judges researcher: AV judge trial, boss reel 45 s | OpenRouter | google/gemini-3.8-flash (ZDR, Vertex) | 1 | 0.01 | 0.05 |
| 2026-10-28 | omni-judges researcher: rejected calls (ZDR block, wrong endpoint) | OpenRouter | qwen/qwen3.8-omni-flash, cloudflare/clef-omni | 2 | 0.00 | 0.05 |
| 2026-10-28 | wave 3 A: gameplay sfx candidates, 27 roles x 3 (`sfx/gameplay.yaml`, call log `sfx/candidates/gameplay/.cache/fal_calls.jsonl`) | fal | fal-ai/elevenlabs/sound-effects/v2 (78.0 s billed at $0.002/s) | 81 | 0.16 | 0.20 |
| 2026-10-28 | Q qa:judge boss (12 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.020 | 0.07 |
| 2026-10-28 | Q qa:judge gameplay-fight (28 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.033 | 0.10 |
| 2026-10-28 | Q qa:judge menus-en (26 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.023 | 0.12 |
| 2026-10-28 | Q qa:judge boss (13 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.028 | 0.15 |
| 2026-10-28 | Q qa:judge gameplay-fight (26 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.034 | 0.18 |
| 2026-10-28 | Q qa:judge menus-en (24 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.022 | 0.20 |
| 2026-10-28 | Q qa:judge boss (12 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.020 | 0.22 |
| 2026-10-28 | Q qa:judge gameplay-fight (22 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.033 | 0.25 |
| 2026-10-28 | Q qa:judge menus-en (24 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.026 | 0.28 |
| 2026-10-28 | Q qa:judge boss (13 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.025 | 0.30 |
| 2026-10-28 | Q qa:judge gameplay-fight (27 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.029 | 0.33 |
| 2026-10-28 | Q qa:judge menus-en (24 s reel) | OpenRouter | google/gemini-4-argon (ZDR, Vertex) | 1 | 0.026 | 0.36 |
| 2026-10-28 | L level design: judge scores on 3 side-by-sides (`research/2026-10-28-level-design/judge.json`) | OpenRouter | liquid/d1.1 (ZDR) via inference.decide | 4 | 0.0001 | 0.36 |
| 2026-10-28 | L level design: judge prose on 3 side-by-sides (OpenRouter generate not image-capable here) | Tinfoil | gemma4-31b via inference.generate (attested enclave; usage not reported) | 3 | 0.01 (est., upper bound) | 0.01 |
| 2026-10-28 | B wave 4 A/B voice.tutorial_ai | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.016234 | 0.376234 |
| 2026-10-28 | B wave 4 A/B music.gameplay | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.016124 | 0.392358 |
| 2026-10-28 | B wave 4 A/B voice.tutorial_ai | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.016504 | 0.408862 |
| 2026-10-28 | B wave 4 A/B music.gameplay | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.016424 | 0.425286 |

| 2026-10-29 | Sector worlds v2 blind place-specificity test, 11 picture-only clips | OpenRouter | google/gemini-4-argon (mandatory ZDR/data_collection deny, no fallbacks; returned Google) | 11 | 0.114942 | Previous displayed total + 0.114942; see research/2026-10-29-sector-worlds-v2/out/judge/ |

| 2026-10-29 | Core feedback (night step 4a): 5 new gameplay sfx roles x 4-5 deliberately different briefs (`sfx/gameplay.yaml`, call log `sfx/candidates/gameplay/.cache/fal_calls.jsonl`) | fal | fal-ai/elevenlabs/sound-effects/v2 (23.3 s billed at $0.002/s) | 23 | 0.0466 | 0.2466 |
