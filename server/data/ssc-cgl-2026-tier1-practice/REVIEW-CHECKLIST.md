# Human review checklist — SSC CGL Tier-I practice pack v1

**Current state: NOT REVIEWED. Do not publish as human-reviewed until this form is completed by a named reviewer who actually checked the content.**

Automated checks already cover structure, quotas, duplicate text, option shape, source presence, and independent recomputation of all 25 quantitative answers. They do **not** cover pedagogy, ambiguity, language quality or factual framing.

## Before starting

- Work from a copy or a pull request; do not edit the pack in place after it has been imported to a database. Any content change produces a new hash, and the import command will refuse to rewrite the existing pack key. Create a new pack version instead.
- Do not add PYQ text, official papers, candidate response sheets or personal data. This pack must remain original practice.
- Keep Hindi text labelled as an ExamEdge translation, not official SSC text.

## Per-question checks (all 100)

For every question, confirm:

- [ ] Exactly one option is correct and the stored `correct` index points to it.
- [ ] Distractors are plausible but clearly wrong; no second defensible answer.
- [ ] The English question is complete, unambiguous and exam-appropriate.
- [ ] The Hindi question and all four Hindi options accurately convey the same meaning.
- [ ] The step-by-step solution reaches the keyed answer without skipping a necessary step.
- [ ] The "trick/common mistake" note is genuinely useful and not misleading.
- [ ] The difficulty label (Easy / Medium / Hard) is defensible for CGL Tier-I.
- [ ] The topic and sub-topic match the Tier-I syllabus mapping used by the app.
- [ ] Any factual claim has a working `https` source and the citation supports the exact fact.
- [ ] Any current-affairs date is still acceptable for the intended exam cycle.

## Section-specific checks

### Quantitative Aptitude (25)

- [ ] Every calculation is re-derived independently (do not rely only on `practice:validate`).
- [ ] Units, rounding and exact forms (for example `60(√3 − 1) m`) are used consistently.
- [ ] The DI table values add up and both DI answers follow from the displayed table.
- [ ] The standalone pie-chart item does not imply a chart that is not shown.

### Reasoning (25)

- [ ] Each series/coding rule is the only reasonable rule and yields a unique answer.
- [ ] Verbal substitutes for figure-based items are unambiguous without an image.
- [ ] Blood-relation, seating and syllogism conclusions are logically forced, not merely possible.
- [ ] The situation-judgement item has one clearly best answer.

### English (25)

- [ ] Grammar keys follow standard usage; record the reference used for contested usage.
- [ ] Vocabulary keys and antonym/synonym pairs are accurate.
- [ ] Para-jumbles have one coherent order; connectors and pronouns are checked.
- [ ] All five cloze blanks are solvable from the passage and grammar, and the passage has no internal contradiction.
- [ ] The Hindi study translation does not alter the tested English grammar point. (The official English Comprehension section is English-only.)

### General Awareness (25)

- [ ] Every static fact is verified against the cited source, not memory alone.
- [ ] Current-affairs items are re-checked on the review date; the pack's as-of date is 2026-11-08.
- [ ] No unverified appointment, award, scheme, date or event is presented as current.
- [ ] Wording does not imply that a coaching claim or a single news report is an official fact.

## Sign-off

Fill only after the whole pack has been checked. The import command records these details.

| Field | Value |
| --- | --- |
| Reviewer name | |
| Review date (YYYY-MM-DD) | |
| Questions checked | / 100 |
| Corrections required | |
| Pack version reviewed | `ssc-cgl-2026-tier1-practice-v1` |
| Content hash reviewed | `429b705ffd314c92118415ad56e0bb5e617b0a4996292b82520e37c4dd5b6349` |
| Decision | Approve / Approve with corrections / Reject |

Publication command (only after a real review):

```bash
cd server
npm run practice:import -- --mode publish --reviewer "Reviewer name" \
  --reviewed-on YYYY-MM-DD --confirm-human-review
```

If corrections are needed, change the questions, re-run `npm run practice:validate`, bump `pack_version` / `pack_key`, and review the new hash. Do not overwrite a previously imported pack.
