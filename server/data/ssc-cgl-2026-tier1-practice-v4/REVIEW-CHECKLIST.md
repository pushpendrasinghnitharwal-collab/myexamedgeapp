# Human review checklist — SSC CGL Tier-I practice pack v4 (Batch 4, full mock #4)

**Current state: NOT REVIEWED. Do not publish as human-reviewed until a named reviewer completes this form.**

Automated checks cover structure, quotas, cross-pack duplicates, option shape, sources and independent recomputation of all 25 quantitative answers. They do **not** cover pedagogy, ambiguity or translation quality.

- Batch 4 is a fourth independent 100-question pool, not a revision of Batches 1–3.
- The 2027 notice does not exist; this pack follows the official **2026** Tier-I scheme and says so.
- Do not edit an imported pack in place — the content hash changes and the import refuses to rewrite a pack key. Create a new pack version.
- Hindi is an ExamEdge translation, not official SSC text.

## Per-question checks (all 100)

- [ ] Exactly one option is correct and the stored `correct` index matches it.
- [ ] No second defensible answer; distractors are clearly wrong.
- [ ] Hindi question and all four options carry the same meaning as English.
- [ ] Solution and trick note are complete and correct.
- [ ] Topic/sub-topic map to the Tier-I syllabus; difficulty is defensible (30 Easy / 50 Medium / 20 Hard).
- [ ] Every factual claim has a working `https` source; current-affairs wording matches the review date.
- [ ] Quant answers are re-derived independently, including the DI table (A total 660, B total 670, 2024 total 410) and the pie chart (5,400 × 120/360 = 1,800).

## Section checks

### English (25)

- [ ] Cloze passage visibly marks blanks 1–5 and the five keys (provide / absorb / improve / direct / essential) are unambiguous.
- [ ] Grammar keys (each … has, senior to, discuss, has been working, passive and reported speech) follow standard usage.
- [ ] Both sentence-part items and both passage-order items have one coherent order.

### General Awareness (25)

- [ ] Nobel Peace 2026 (Navi Pillay), International Booker 2026 translator (Lin King), G20 Miami (14–15 Dec 2026), Asian Games host (Aichi-Nagoya), FIFA final date (19 Jul 2026) and COP31 (Antalya, 9–20 Nov 2026) are re-checked.
- [ ] Static items (Nanda Devi, Godavari, Assam tea, Chilika, Article 51A, Eighth Schedule, Goa, Radcliffe Line, Zoji La, Mumbai harbour, Bhupen Hazarika Setu, 75 UP districts) are verified against the cited source.
- [ ] No unverified appointment, award, host city or event is presented as current.

## Sign-off

| Field | Value |
| --- | --- |
| Reviewer name | |
| Review date (YYYY-MM-DD) | |
| Questions checked | / 100 |
| Pack version reviewed | `ssc-cgl-2026-tier1-practice-v4` |
| Content hash reviewed | `75d2fcfab8a04ec310d86516c5371b3510fa1fa1dc14b820acd186ba990fe505` |
| Decision | Approve / Approve with corrections / Reject |

```bash
cd server
npm run practice:import -- --pack ssc-cgl-2026-tier1-practice-v4 --mode publish \
  --reviewer "Reviewer name" --reviewed-on YYYY-MM-DD --confirm-human-review
```
