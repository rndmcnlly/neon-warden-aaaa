# Making-of: top-level story (Adam, October 29, 2026)

The spine for the landing page's "How it was made" section and any later
making-of page.

Adam had just written the starter code for a refactoring exercise sequence
in a software engineering course: a deliberately messy little web shmup,
public at https://github.com/ucsc-cmpm-121-f26/e4-starter (copied read-only
here as `reference/e4-starter/`). The question was: what would a AAAA
adaptation of this silly example shmup look like? Neon Warden AAAA is where
that led after about a day of cooking and transagentic skill
cultivation (the human and agents forming one acting entity, each
round leaving behind reusable practice: repo-local skills, QA tooling,
judge workflows).

Honest timeline for any published claim: the first commit is
2026-10-28 18:17 and about 150 commits follow through 2026-10-29 midday
(roughly 17 hours of wall-clock time, including an overnight unattended
run). Earlier exploration happened in a separate course workspace on
October 28. Adam approved "about a day" as the public phrasing.

## Where "AAAA" fits (Adam, October 29)

Stepico's explainer ("What Are AAAA Games?", April 10, 2026,
https://stepico.com/blog/what-are-aaaa-games/) calls AAAA an unofficial,
often self-assigned marketing label and compares AAA vs AAAA on five
dimensions. Neon Warden AAAA inverts nearly all of them; only one axis
(not in their table, but in their "AI-assisted content generation" bullet)
is pushed to the extreme:

| Dimension                       | AAAA per Stepico                     | Neon Warden AAAA                                                                               |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Budget                          | $150M–$300M+                         | almost nothing (tens of dollars of API calls, ledgered)                                        |
| Development cycle               | 5–8+ years                           | about a day                                                                                    |
| Post-launch model               | continuous live service              | static archival (parked)                                                                       |
| Platform scope                  | cross-platform ecosystem             | broad: desktop, mobile, Chromebook, offline PWA (affordable because other dimensions were cut) |
| Success metric                  | long-term retention and monetization | one teachable moment in class                                                                  |
| AI-assisted production pipeline | a bullet point                       | the whole point: orchestrated agents, local asset inference, judge panels                      |

Adam's framing: a meta vertical slice of next-gen AI-assisted game
production. A vertical slice communicates a future game to funders; this
one communicates a future way of making games to students, while showing
how a label like AAAA measures capital rather than craft.

Beats the story should hit, in order:

1. The seed: a refactoring exercise starter, small and intentionally smelly.
2. The question: what would AAAA look like, honestly, as a vertical slice
   for publishers and funders rather than consumers?
3. The method: orchestrating agents with file-scoped ownership; local
   models for assets; web-anchored judge panels; QA reels as dailies;
   blind checks that sometimes said we made it worse.
4. The cultivation: lessons crystallized into repo-local skills and rules
   (atomic shared writes, blind-before-truth review, vary briefs not seeds).
5. The result: a parked, pedagogical artifact students can read, play, and
   question.
