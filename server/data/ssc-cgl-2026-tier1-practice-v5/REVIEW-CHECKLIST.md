# Human review checklist — SSC CGL Tier-I practice pack v5 (Batch 5, full mock #5)

**Current state: NOT REVIEWED. Do not publish as human-reviewed until a named reviewer completes this form.**

Automated checks cover structure, quotas, cross-pack duplicates, option shape, sources and independent recomputation of all 25 quantitative answers. They do **not** cover pedagogy, ambiguity or translation quality.

- Batch 5 is a fifth independent 100-question pool, not a revision of Batches 1–4.
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
- [ ] Quant answers are re-derived independently, including the DI table (2023 total 580; A 2020→2023 growth 60%) and the pie chart (3,600 × 90/360 = 900).

## Section checks

### English (25)

- [ ] Cloze passage visibly marks blanks 1–5 and the keys (wastes / reduces / prevents / evaporation / make) are unambiguous, including subject–verb agreement in blank 5.
- [ ] Grammar keys (news is, prefer to, married to, neither … is, had started, return, passive, reported request) follow standard usage.
- [ ] Both sentence-part items and both passage-order items have one coherent order.

### General Awareness (25)

- [ ] BRICS dates (12–13 Sep 2026), Asian Games motto, G20 presidency (US, Miami), FIFA opener (Estadio Azteca), Nobel Peace announcement date (9 Oct 2026) and COP31 presidency (Türkiye) are re-checked.
- [ ] Static items (MP forest area, Ganga, Kerala spices, Thar, Kunchikal Falls, Part IV, SBI, McMahon Line, Ladakh, Tamil Nadu, Yamuna, UP 80 seats) are verified against the cited source.
- [ ] No unverified appointment, award, host city or event is presented as current.

## Sign-off

| Field | Value |
| --- | --- |
| Reviewer name | |
| Review date (YYYY-MM-DD) | |
| Questions checked | / 100 |
| Pack version reviewed | `ssc-cgl-2026-tier1-practice-v5` |
| Content hash reviewed | `f3cbf6bb4e23a6daf78fcec037e7f75e719f2c62a50330afbf47e7e638ebb6b7` |
| Decision | Approve / Approve with corrections / Reject |

```bash
cd server
npm run practice:import -- --pack ssc-cgl-2026-tier1-practice-v5 --mode publish \
  --reviewer "Reviewer name" --reviewed-on YYYY-MM-DD --confirm-human-review
```
