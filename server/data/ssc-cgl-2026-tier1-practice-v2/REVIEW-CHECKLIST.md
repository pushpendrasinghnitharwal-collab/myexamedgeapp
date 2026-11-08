# Human review checklist — SSC CGL Tier-I practice pack v2 (Batch 2)

**Current state: NOT REVIEWED. Do not publish as human-reviewed until a named reviewer completes this form.**

Automated checks cover structure, quotas, duplicate text (including against Batch 1), option shape, sources and independent recomputation of all 25 quantitative answers. They do **not** cover pedagogy, ambiguity, language quality or factual framing.

## Before starting

- Batch 2 is a second, independent 100-question pool. It is not a revision of Batch 1.
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
- [ ] Difficulty label is defensible.
- [ ] Topic and sub-topic match the Tier-I syllabus.
- [ ] Every factual claim has a working `https` source supporting the exact fact.
- [ ] Current-affairs dates are acceptable for the intended cycle.

## Section-specific checks

### Quantitative Aptitude (25)

- [ ] Re-derive every answer independently; do not rely only on `practice:validate`.
- [ ] Check units, rounding and exact forms (`₹`, `cm²`, `π`, `15√3 m`).
- [ ] The synthetic production table sums correctly and both DI answers follow from it.
- [ ] The pie-chart item is solvable from the stated total and angle.

### Reasoning (25)

- [ ] Each series/coding rule is unique and yields one answer.
- [ ] Verbal figure/spatial items are unambiguous without an image.
- [ ] Blood-relation, seating and syllogism conclusions are forced, not merely possible.
- [ ] Word-building answers use only the available letters, counting repeats.

### English (25)

- [ ] Grammar keys follow standard usage; record the reference for contested usage.
- [ ] Vocabulary keys and antonym/synonym pairs are accurate.
- [ ] Para-jumbles have one coherent order.
- [ ] All five cloze blanks are solvable from the digital-payments passage; no internal contradiction.
- [ ] Hindi study translation does not alter the tested English grammar point. (Official English Comprehension is English-only.)

### General Awareness (25)

- [ ] Each static fact is verified against the cited source, not memory alone.
- [ ] Current-affairs items are re-checked on the review date; the pack's as-of date is 2026-11-08.
- [ ] No unverified appointment, award, host city or event is presented as current.
- [ ] The G20 item is worded as an upcoming December 2026 summit, not as a completed event.

## Sign-off

| Field | Value |
| --- | --- |
| Reviewer name | |
| Review date (YYYY-MM-DD) | |
| Questions checked | / 100 |
| Corrections required | |
| Pack version reviewed | `ssc-cgl-2026-tier1-practice-v2` |
| Content hash reviewed | `e44743742f5c36a4921e6bc2a557ce29c3410a45c7e953a0913bc7b66ce52201` |
| Decision | Approve / Approve with corrections / Reject |

Publication command (only after a real review):

```bash
cd server
npm run practice:import -- --pack ssc-cgl-2026-tier1-practice-v2 --mode publish \
  --reviewer "Reviewer name" --reviewed-on YYYY-MM-DD --confirm-human-review
```

If corrections are needed, change the questions, re-run `npm run practice:validate -- --all`, bump `pack_version` / `pack_key`, and review the new hash.
