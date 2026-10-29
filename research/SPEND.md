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
