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

| 2026-10-28 | Q intelligibility novice | OpenRouter google/gemini-4-argon, ZDR/data_collection deny, native-resolution blind pass | $0.146654 | research/2026-10-28-intelligibility/out/judgments/novice.json |

| 2026-10-28 | Q intelligibility novice | OpenRouter google/gemini-4-argon, ZDR/data_collection deny, native-resolution blind pass | $0.096098 | research/2026-10-28-intelligibility/out/judgments/novice.json |

| 2026-10-28 | Q intelligibility information | OpenRouter google/gemini-4-argon, ZDR/data_collection deny, native-resolution blind pass | $0.101634 | research/2026-10-28-intelligibility/out/judgments/information.json |

| 2026-10-28 | Q intelligibility causality | OpenRouter google/gemini-4-argon, ZDR/data_collection deny, native-resolution blind pass | $0.127058 | research/2026-10-28-intelligibility/out/judgments/causality.json |

| 2026-10-28 | Q intelligibility picture | OpenRouter google/gemini-4-argon, ZDR/data_collection deny, native-resolution blind pass | $0.034314 | research/2026-10-28-intelligibility/out/judgments/picture.json |

| 2026-10-28 | Q intelligibility audio | OpenRouter google/gemini-4-argon, ZDR/data_collection deny, native-resolution blind pass | $0.042958 | research/2026-10-28-intelligibility/out/judgments/audio.json |

Intelligibility reconciliation: six calls total **US $0.548716**, including the $0.146654 truncated novice response, now retained at `research/2026-10-28-intelligibility/out/judgments/novice-truncated.json`. The second novice row is its fresh complete replacement, not a duplicate charge. All calls required ZDR and denied data collection; no fallback relaxed either policy.

| 2026-10-28 | Argon creative review: 7 isolated-build AV clips, single open-ended session | OpenRouter | google/gemini-4-argon (mandatory ZDR, data_collection deny; returned Google) | 1 | 0.117510 | See reconciliation below |

Creative-review reconciliation: **US $0.117510**, one call, no syntax-repair retry. Using the previous displayed OpenRouter subtotal ($0.425286) plus intelligibility's reconciled $0.548716 and this call gives **approximately $1.091512** for the displayed ledger to this point (earlier rows include rounded estimates). Raw usage: `research/2026-10-28-argon-creative-review/response.json`. The task cap was $1.50; no provider-policy fallback or model substitution occurred.

| 2026-10-29 | Memory/briefing blind action reconstruction, 2 clips | OpenRouter | google/gemini-4-argon (mandatory ZDR/data_collection deny; returned Google) | 1 | 0.022402 | Previous displayed total + 0.022402; see judge-meta.json |

| 2026-10-29 | Sector worlds v2 blind place-specificity test, 11 picture-only clips | OpenRouter | google/gemini-4-argon (mandatory ZDR/data_collection deny, no fallbacks; returned Google) | 11 | 0.114942 | Previous displayed total + 0.114942; see research/2026-10-29-sector-worlds-v2/out/judge/ |

| 2026-10-29 | Argon core-loop ideation (night step 2): Pass A blind reconstruction + Pass B ideation, 8 clips each | OpenRouter | google/gemini-4-argon (mandatory ZDR/data_collection deny, no fallbacks; returned Google) | 2 | 0.140412 | Previous displayed total + 0.140412 (A 0.085360, B 0.055052); see research/2026-10-29-argon-core-ideation/out/ |

| 2026-10-29 | Core feedback (night step 4a): 5 new gameplay sfx roles x 4-5 deliberately different briefs (`sfx/gameplay.yaml`, call log `sfx/candidates/gameplay/.cache/fal_calls.jsonl`) | fal | fal-ai/elevenlabs/sound-effects/v2 (23.3 s billed at $0.002/s) | 23 | 0.0466 | 0.2466 |
| 2026-10-29 | warden-defeat blind clip-1 | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.0251 | previous OpenRouter total + this row; see research/2026-10-29-warden-defeat/judge/ |
| 2026-10-29 | warden-defeat blind clip-2 | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.0232 | previous OpenRouter total + this row; see research/2026-10-29-warden-defeat/judge/ |
| 2026-10-29 | warden-defeat blind clip-3 | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.0263 | previous OpenRouter total + this row; see research/2026-10-29-warden-defeat/judge/ |
| 2026-10-29 | warden-defeat blind clip-4 | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.0244 | previous OpenRouter total + this row; see research/2026-10-29-warden-defeat/judge/ |
| 2026-10-29 | warden-defeat blind clip-5 | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.0263 | previous OpenRouter total + this row; see research/2026-10-29-warden-defeat/judge/ |
| 2026-10-29 | warden-defeat blind clip-6 | OpenRouter | google/gemini-4-argon (ZDR) | 1 | 0.0258 | previous OpenRouter total + this row; see research/2026-10-29-warden-defeat/judge/ |
