# Human review checklist — SSC CGL Tier-I topic-drill pool v1 (Batch 4)

**Current state: NOT REVIEWED. Do not publish as human-reviewed until a named reviewer completes this form.**

This is a 60-question **drill pool**, not a full mock. It is split 15 Quant / 15 Reasoning / 15 English / 15 General Awareness and carries no DI or cloze sets, so a drill can stay topic-focused and intact.

- [ ] Exactly one option is correct and the stored `correct` index matches it.
- [ ] Distractors are plausible but clearly wrong.
- [ ] English question is complete and unambiguous; Hindi carries the same meaning.
- [ ] The solution reaches the keyed answer without skipping a step; the trick note is accurate.
- [ ] Topic and sub-topic match the Tier-I syllabus row exactly.
- [ ] Each factual item is supported by its `https` source; current-affairs items are re-checked.
- [ ] Quant answers are re-derived independently; units and rounding are stated.
- [ ] Difficulty labels (24 Easy / 28 Medium / 8 Hard) are defensible.
- [ ] Drill counts match `pack.json` `drill_profile` (by subject and by topic).
- [ ] No question duplicates Batches 1–4 full mocks.

| Field | Value |
| --- | --- |
| Reviewer name | |
| Review date (YYYY-MM-DD) | |
| Questions checked | / 60 |
| Pack version reviewed | `ssc-cgl-2026-tier1-practice-drills-v1` |
| Content hash reviewed | `6902d899ce2f488bc68c5cacd1bcb5504ce14ea2fc98892db5fb42b36805c847` |
| Decision | Approve / Approve with corrections / Reject |

```bash
cd server
npm run practice:import -- --pack ssc-cgl-2026-tier1-practice-drills-v1 --mode publish \
  --reviewer "Reviewer name" --reviewed-on YYYY-MM-DD --confirm-human-review
```
