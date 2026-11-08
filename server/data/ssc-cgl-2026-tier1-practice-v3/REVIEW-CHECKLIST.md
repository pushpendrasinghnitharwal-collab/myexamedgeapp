# Human review checklist — SSC CGL Tier-I practice pack v3 (Batch 3)

**Current state: NOT REVIEWED. Do not publish as human-reviewed until a named reviewer completes this form.**

Automated checks cover structure, quotas, duplicate text (including against Batches 1 and 2), option shape, sources and independent recomputation of all 25 quantitative answers. They do **not** cover pedagogy, ambiguity, language quality or factual framing.

## Before starting

- Batch 3 is a third, independent 100-question pool. It is not a revision of Batch 1 or Batch 2.
- The 2027 CGL notice does not exist yet. This pack follows the official **2026** Tier-I scheme (100 questions, 200 marks, 60 minutes, four 15-minute sections, +2 / −0.5) and says so in `pack.json`.
- Do not edit an imported pack in place. Any change alters the content hash and the import command will refuse to rewrite the same pack key. Create a new pack version.
- Keep the provenance label: original practice, not PYQ. Do not add SSC papers, scans, candidate response sheets or personal data.
- Hindi is an ExamEdge translation, not official SSC text.

## Per-question checks (all 100)

- [ ] Exactly one option is correct and the stored `correct` index matches it.
- [ ] Distractors are plausible but clearly wrong; no second defensible answer.
- [ ] English question is complete, unambiguous and CGL-appropriate.
- [ ] Hindi question and all four Hindi options carry the same meaning.
- [ ] The solution reaches the keyed answer without skipping a necessary step.
- [ ] The trick/common-mistake note is useful and not misleading.
- [ ] Difficulty label is defensible against the 30 Easy / 50 Medium / 20 Hard split.
- [ ] Topic and sub-topic match the Tier-I syllabus.
- [ ] Every factual claim has a working `https` source supporting the exact fact.
- [ ] Current-affairs wording matches the review date (some 2026 events are now past, COP31 and the G20 summit are still ahead).

## Section-specific checks

### Quantitative Aptitude (25)

- [ ] Re-derive every answer independently; do not rely only on `practice:validate`.
- [ ] Check units, rounding and exact forms (`₹`, `cm²`, `cm³`, `°`, `m`, `seconds`, `days`).
- [ ] The synthetic production table sums correctly and both DI answers (total 450, ratio 15 : 16) follow from it.
- [ ] The pie-chart item (7,200 students, 90°) gives exactly 1,800.
- [ ] Approximation items state their rounding rule (`π = 22/7`, integer seconds for the train).

### Reasoning (25)

- [ ] Each series/coding rule is unique and yields one answer.
- [ ] Verbal figure/spatial items are unambiguous without an image.
- [ ] Blood-relation, seating and syllogism conclusions are forced, not merely possible.
- [ ] The 5 × 5 × 5 cube counts (54 one-face, 27 two-face, 8 three-face, 27 none) are internally consistent.
- [ ] The calendar item uses the correct 2024 leap-year shift.

### English (25)

- [ ] Grammar keys follow standard usage; record the reference for contested usage.
- [ ] Vocabulary keys and antonym/synonym pairs are accurate.
- [ ] Both sentence-part items (Q19, Q20) have exactly one coherent order.
- [ ] All five cloze blanks are solvable from the sleep-and-health passage; no internal contradiction.
- [ ] The cloze passage visibly marks blanks 1–5 and the answer options match those blanks.
- [ ] Hindi study translation does not alter the tested English grammar point. (Official English Comprehension is English-only.)

### General Awareness (25)

- [ ] Each static fact is verified against the cited source, not memory alone.
- [ ] Current-affairs items are re-checked on the review date; the pack's as-of date is 2026-11-08.
- [ ] BRICS (18th Summit, New Delhi, 12–13 Sep 2026) and the Asian Games (Aichi-Nagoya, 19 Sep–4 Oct 2026) are written as completed events.
- [ ] The G20 item is worded as an upcoming December 2026 summit in Miami, not as a completed event.
- [ ] COP31 is worded as scheduled (Antalya, 9–20 Nov 2026, Türkiye presidency, Australia leading negotiations).
- [ ] T20 World Cup 2026 (India–Sri Lanka) and FIFA World Cup 2026 (MetLife final) are written in the past tense.
- [ ] No unverified appointment, award, host city or event is presented as current.

## Sign-off

| Field | Value |
| --- | --- |
| Reviewer name | |
| Review date (YYYY-MM-DD) | |
| Questions checked | / 100 |
| Corrections required | |
| Pack version reviewed | `ssc-cgl-2026-tier1-practice-v3` |
| Content hash reviewed | `fba8f91de5ab36f5dc18aed733abed73c9ff0b5ef6bcc82fd4b47ce2014838f5` |
| Decision | Approve / Approve with corrections / Reject |

Publication command (only after a real review):

```bash
cd server
npm run practice:import -- --pack ssc-cgl-2026-tier1-practice-v3 --mode publish \
  --reviewer "Reviewer name" --reviewed-on YYYY-MM-DD --confirm-human-review
```

If corrections are needed, change the questions, re-run `npm run practice:validate -- --all`, bump `pack_version` / `pack_key`, and review the new hash.
