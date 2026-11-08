# SSC CGL Tier-I practice content (2026 pattern, Batches 1–4)

Status: **original practice content, automatically checked, independent human review pending.**
Nothing in these packs is an SSC previous-year paper (PYQ), an official paper, an official shift or an official answer key.

**Batch 4 update (2026-11-08):** a fourth full-mock pack (`ssc-cgl-2026-tier1-practice-v4`) and a **60-question topic-drill pool** (`ssc-cgl-2026-tier1-practice-drills-v1`) were added. Total verified practice content is now **460 questions**: four independent 100-question full mocks, sixteen sectional papers and a drill pool that powers 15–30 question single-topic drills. No pack is human-reviewed.

**Batch 3 update (2026-11-08):** a third independent 100-question pack (`ssc-cgl-2026-tier1-practice-v3`) was added, taking the total to 300 questions in three pools.

**Batch 2 update (2026-11-08):** a second independent 100-question pack (`ssc-cgl-2026-tier1-practice-v2`) was added, taking the total to 200 questions in two pools.

## Scope

| Item | Value |
| --- | --- |
| Exam | SSC Combined Graduate Level (CGL) |
| Stage | Tier-I only |
| Target cycle | 2027 preparation |
| Pattern baseline | Latest verifiable official notice: CGL **2026** (notice dated 21-05-2026) |
| Pack keys | `…-practice-v1`, `…-practice-v2`, `…-practice-v3`, `…-practice-v4` (full mocks) and `…-practice-drills-v1` (60-question drill pool) |
| Content | 460 original questions: four 100-question full-mock packs (2 linked sets each) and one 60-question drill pack (15 per subject, no sets) |
| Provenance | `original_practice`, `is_pyq: false` |
| Review state | `automated_verified_pending_human_review` |
| Translation | ExamEdge Hindi/English text, **not** an official SSC translation |

The 2027 CGL notice was not available on 2026-11-08. The 2026 notice is the latest official scheme that could be verified, so these packs are labelled a **2026-pattern baseline for 2027 preparation**. When the 2027 notice is published, re-check the scheme, syllabus, timings and marking before reusing or extending them. No 2027 date, vacancy, cut-off or pattern is invented here.

## Batch 4 addendum

- **Fourth full mock:** `ssc-cgl-2026-tier1-practice-v4`, 100 new questions with the same official Tier-I quotas and 30/50/20 difficulty split. Content hash `75d2fcfab8a04ec310d86516c5371b3510fa1fa1dc14b820acd186ba990fe505`.
- **Drill pool:** `ssc-cgl-2026-tier1-practice-drills-v1`, `pack_kind: topic_drills`, 60 standalone questions — Quant 15, Reasoning 15, English 15, General Awareness 15. Content hash `6902d899ce2f488bc68c5cacd1bcb5504ce14ea2fc98892db5fb42b36805c847`.
- **Why a separate kind:** full-mock quotas are fixed at 4 × 25 with DI and cloze sets. A drill pool declares its own `drill_profile` (`by_subject` and `by_topic`) instead, contains no passage sets, and is validated by the same script. It is **not** counted as a full mock.
- **Connected to the learner flow:** the existing Subject & Topic Practice screen (`/practice`) already prepares `Micro` mocks with a 15–30 question count. With the pool imported, those drills draw from all 460 published items. Verified end-to-end on 2026-11-08: a 15-question "Fundamental Arithmetical Operations" drill returned 15 Quant questions, all on that topic, with no answer key in the launch payload.
- **Four full mocks verified:** 5 packs, 460 published practice questions, 8 linked sets; four consecutive 100-question mocks delivered 25 distinct questions each with **0 overlap** and `max_score` 200.
- **Batch 4 facts:** Nobel Peace 2026 (Navi Pillay), International Booker 2026 translator (Lin King, *Taiwan Travelogue*), G20 Miami (14–15 Dec 2026), Asian Games Aichi-Nagoya, FIFA final 19 July 2026, COP31 Antalya (9–20 Nov 2026). Each carries a source and `checked_on: 2026-11-08`.
- **Status:** all five packs are `automated_verified_pending_human_review`; none is approved or human-reviewed.

## Batch 3 addendum

- **Third pool:** 100 new questions (`quant3-*`, `reasoning3-*`, `english3-*`, `ga3-*`), zero duplicate question text across all three packs, same official Tier-I quota profile and the 30 Easy / 50 Medium / 20 Hard split.
- **Content hash:** `fba8f91de5ab36f5dc18aed733abed73c9ff0b5ef6bcc82fd4b47ce2014838f5` (see `server/data/ssc-cgl-2026-tier1-practice-v3/REVIEW-CHECKLIST.md`).
- **Linked sets:** a new data-interpretation table (`di-2026-t1-03`, two stores × four years) and a new five-blank cloze on sleep and health (`cloze-2026-t1-03`).
- **Three full mocks:** verified end-to-end against the disposable preview database — 3 packs, 300 published practice questions, 6 linked sets, three consecutive 100-question mocks with **0 repeated delivered questions** and no answer key in the launch payload (run 2026-11-08).
- **Reuse disclosure:** after a learner has consumed the whole pool, the assembler may still prepare a mock, but it reports `reused_questions` and a `repeat_reason` (intact DI/cloze sets cannot be split). The test asserts this disclosure instead of promising an infinite unseen pool.
- **Batch 3 facts:** BRICS 2026 chairship theme and 18th Summit (New Delhi, 12–13 Sep 2026), Asian Games Aichi-Nagoya motto, G20 2026 US presidency and Miami summit (14–15 Dec 2026, upcoming), COP31 Türkiye presidency with Australia leading negotiations (Antalya, 9–20 Nov 2026), T20 World Cup 2026 co-hosts (India, Sri Lanka), FIFA 2026 final venue (MetLife Stadium). Each item carries a source and `checked_on: 2026-11-08`.
- **Status:** all three packs are `automated_verified_pending_human_review`; none is approved, published as reviewed, or claimed to be an official paper.

## Batch 2 addendum

- **Second pool:** 100 new questions, no cross-pack duplicate question text, same official Tier-I quotas and 30/50/20 difficulty split.
- **Two full mocks:** each 100-question pack can assemble one complete full mock. A second attempt for the same learner avoids questions already delivered in the first attempt (verified in `server/tests/practice-content-v2.test.js`).
- **Eight sectionals:** four 25-question sectional papers per pack, subject to existing reservations; a learner with an active full mock may need to cancel/submit it before a sectional can draw from the same pool.
- **Batch 2 facts:** General Awareness adds 2026 Nobel Peace (Navi Pillay), Aichi-Nagoya Asian Games, G20 Miami (upcoming December 2026), BRICS New Delhi, COP31 Türkiye and the International Booker 2026. Each item carries a source and `checked_on: 2026-11-08`.
- **Status:** both packs are `automated_verified_pending_human_review`; neither is approved, published as reviewed, or claimed to be an official paper.

## Official pattern verified

Source: [Combined Graduate Level Examination, 2026 notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf), checked 2026-11-08.

| Tier-I subject | Questions | Maximum marks | Time |
| --- | --- | --- | --- |
| A. General Intelligence and Reasoning | 25 | 50 | 1 hour total, with a 15-minute sectional timer for each subject |
| B. General Awareness | 25 | 50 | 15 minutes |
| C. Quantitative Aptitude | 25 | 50 | 15 minutes |
| D. English Comprehension | 25 | 50 | 15 minutes |

- Paragraph 13.8 gives 25 questions and 50 marks per subject, a one-hour paper with a 15-minute sectional timer per subject, and 1 hour 20 minutes for candidates eligible for a scribe.
- Paragraph 13.8.1 states the questions are objective multiple-choice, set in English and Hindi **except English Comprehension**.
- Paragraph 13.8.2 specifies a **0.50-mark negative deduction per wrong answer**.
- Correct-answer value is therefore 2 marks (50 marks ÷ 25 questions). The app's official-blueprint record uses +2 / −0.5, 200 screening marks and four 15-minute subject locks.
- The notice's tentative schedule (page 1): applications 21-05-2026 to 22-06-2026; Tier-I August–September 2026; Tier-II December 2026. These dates belong to the 2026 cycle and are not 2027 dates.
- Compensatory time/scribe provisions are not modelled in the standard timers. No cut-off, normalisation or selection claim is made.

The app also keeps a separate **`exam_hall_v1`** practice timing profile (one 60-minute timer with free navigation) which is explicitly **not** the official 2026 lock structure. Use `official_2026` to practise the notice's 15-minute subject locks.

## PYQ research: what was and was not available

No authentic previous-year paper or final answer key was reproduced, imported or used to train this pack.

- SSC's **final answer keys, response sheets and marks memos are released through the candidate login portal**, not as a public bulk download. For CGL 2025 Tier-I, the final key and individual marks were released on 9 January 2026 and were available to candidates through the login until 8 February 2026. Public reporting of the release: [Times of India](https://timesofindia.indiatimes.com/education/news/ssc-releases-final-answer-keys-and-marks-for-cgl-tier-i-2025-check-details-here/articleshow/126453736.cms), [Indian Express](https://indianexpress.com/article/education/ssc-cgl-2025-tier-1-final-answer-keys-response-sheets-marks-memo-download-link-tier-2-city-slips-ssc-gov-in-10466164/), accessed 2026-11-08.
- Without a candidate login there was **no verifiable final key** to compare against. Third-party "memory-based" papers and coaching answer keys are not a final key and were not treated as authentic.
- **Redistribution rights were not verified.** Even where papers are publicly viewable, that does not grant permission to copy them into this repository or app. Therefore no PYQ text, scan, response sheet or personal candidate data was copied.
- Consequently the honest coverage of analysed authentic PYQ papers with final keys is **0 papers, 0 shifts, 0 years**. No sample-based subject/topic trend or "repeated concept" claim is made.
- The topic quotas and 30 Easy / 50 Medium / 20 Hard distribution in this pack are the app's **editorial practice profile** (`tier1-editorial-practice-v1`), not official SSC/TCS frequency data. Do not read them as official weightage.

If authentic, rights-cleared papers with final keys are later supplied, they must go through the existing PYQ vault workflow (`pyq:import`, `pyq:inspect`, `pyq:publish`) rather than this original-practice pack.

## What was added

Each pack contains 100 bilingual (English + Hindi) questions with four options, a correct option, a step-by-step solution, a short exam trick/common-mistake note, an ideal time and a source citation.

| Subject | Topic split in each full mock (identical quotas in both packs) |
| --- | --- |
| Quant (25) | Number Systems 2; Fundamental Arithmetical Operations 10; Algebra 2; Geometry 3; Mensuration 2; Trigonometry 3; Statistical Charts 3 (a 2-question DI set + 1 standalone pie-chart item) |
| Reasoning (25) | Analogy 3; Classification 2; Series 3; Operations and Coding 3; Spatial and Figural Reasoning 3; Logical Reasoning 3; Intelligence 1; General Intelligence 4; Matching and Indexing 3 |
| English (25) | Vocabulary 7; Grammar and Usage 9; Sentence Structure 4; Comprehension 5 (a single 5-question cloze set) |
| General Awareness (25) | Current Events 6; India and Neighbouring Countries 12; Everyday Science 5; Environment and Society 2 |

Difficulty (whole 100-question paper): Easy 30, Medium 50, Hard 20 — the existing assembler's editorial quota. Sets are indivisible: the DI set has 2 questions and the cloze set has 5.

Language note: since the official notice makes English Comprehension English-only, the Hindi text for that section is a **study translation for app parity**, not an official bilingual paper. The pack and API must not describe it as an official translation.

General Awareness current-affairs items are dated and sourced (`checked_on: 2026-11-08`). They will age; re-verify before a later exam cycle. No future event or unverified fact is asserted.

## Provenance and review workflow

The pack is **not** labelled approved or reviewed. The database's published-content rule still requires a source, citation, reviewer and review timestamp; this pack satisfies the source/citation fields, but it deliberately does **not** claim a human reviewer.

Three import modes exist:

1. **Draft (default)** — questions and sets remain `Draft`; the mock engine cannot select them. Use this to stage the pack.

   ```bash
   cd server
   npm run practice:validate -- --all
   npm run practice:import -- --all   # or: --mode draft
   ```

2. **Preview (local/demo only)** — content is technically served but labelled `preview_not_human_reviewed`, with the reviewer marker `PREVIEW BUILD — automated checks only; NOT human reviewed`. The mock hub shows a visible pending-review notice. Do not use this mode on a production learner service.

   ```bash
   npm run practice:import -- --all --preview
   ```

3. **Human-reviewed publication** — only after a named person has actually reviewed all 100 questions in that pack, translations, solutions and factual sources. The CLI refuses to publish without both flags:

   ```bash
   npm run practice:import -- --pack ssc-cgl-2026-tier1-practice-v3 --mode publish \
     --reviewer "Reviewer name" --reviewed-on 2026-11-20 --confirm-human-review
   ```

   This records `review_status = human_reviewed`, the reviewer name and the review date. It is an attestation by the operator, not an automated proof of review.

Other safeguards:

- Migration `007_ssc_cgl_practice_packs.sql` is additive and seeds no content. It does not alter existing questions, sets, mock definitions, users, accounts, attempts, published content or applied migrations. It is checksum-guarded, transactional and idempotent.
- Import is idempotent by pack key and content hash. Re-importing the same pack creates no duplicates. Changing content under an existing pack key is refused (`PRACTICE_PACK_CHANGED`); create a new pack version instead.
- Exact duplicate question text already present in the database is refused (`PRACTICE_DUPLICATE_CONTENT`) before writing.
- No answer keys, solutions or review data are exposed in an active mock payload. Keys and solutions appear only after submission through the existing owner-only review endpoints.
- Existing learner history and browser data are untouched by validation, migration or import.

## Verification

Run from `server/` unless stated otherwise:

```bash
npm run practice:validate          # structure, quotas, duplicates, sources, recomputed quant answers
npm test                           # full backend suite, including PGlite integration
cd .. && npm test                  # frontend/unit suite
cd .. && npm run build
```

`server/tests/practice-content.test.js` additionally proves, in a disposable PGlite database:

- Each 100-question pack assembles into an exact Tier-I full mock (4 × 25, every topic quota, 30/50/20 difficulty, intact 2-question DI and 5-question cloze sets), with 900-second module locks and 3600 seconds total.
- With both packs imported, a learner's second full mock avoids the questions delivered in the first attempt, and a second learner can still receive a complete 100-question mock.
- Active payloads leak no `correct_option_index`, solution, answer status or review fields.
- Review is unavailable before submission.
- A sectional submission scores +2 / −0.5 correctly (3 correct + 2 wrong = 5/50, 20 skipped), and keys/solutions appear afterwards.
- Draft imports stay unavailable; preview imports are labelled; re-import is idempotent; duplicate content and changed-pack rewrites are refused.

## Local preview

The disposable preview API uses in-memory PGlite and the real CGL router:

```bash
cd server && npm run preview:server     # http://0.0.0.0:4000
cd .. && npm run dev                    # Vite proxies /api to :4000
```

The preview imports both packs. It registers its own local accounts. Data disappears when the process stops. It reads no production database, sends no learner data anywhere, and labels the content as preview / not human reviewed.

## Deployment and backend status (2026-11-08)

- `https://myexamedgeapp.vercel.app/`, `/api/health` and `/api/cgl/health` all returned **HTTP 500 `FUNCTION_INVOCATION_FAILED`** when checked on 2026-11-08. The live deployment is **not working** and was not treated as healthy.
- No Vercel deployment/environment record is visible through the connected GitHub API, and no Vercel logs or tokens are available in this workspace. The cause of the 500 could not be diagnosed.
- No production database was available. **No production database was migrated, reset, seeded or published to.** No applied migration was rewritten.
- The content is therefore **not live** on the Vercel site. It is staged in the repository and verified against a disposable database. Production publication still requires a backup, an operator-run `migrate:practice`, and a named human review.

## Known limitations

- No independent subject-expert or language review has been completed. Automated checks prove structure, quotas, duplicate absence and recomputed quantitative answers; they do not prove pedagogy, ambiguity-freedom or translation quality.
- The 2027 notification, syllabus and final keys are not available. The 2026 pattern may change.
- General Awareness current-affairs items are only current as of 2026-11-08.
- No PYQ or official paper was analysed or reproduced, so this pack makes no evidence-based claim about historical SSC topic frequency, shift difficulty or repeated questions.
- The drill pool improves single-topic coverage, but the minimum drill is 15 questions: narrow topics with fewer than 15 published items still return the honest "cannot fill" message instead of inventing questions. Deeper drills need a bigger reviewed pool.
- The current 460-question bank supports four full mocks and sixteen sectionals. Human review is still pending, and the 2027 notice is not available.
- Figures are avoided: spatial/figural items are expressed verbally (direction, folding, shadow) rather than with unverified images. The DI set uses a data table rendered by the existing chart component.

## Sources

- [SSC CGL 2026 official notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf) — scheme, subject counts, timers, marking, language rule.
- [SSC examination calendar](https://ssc.gov.in/for-candidates/examination-calendar) — check the current cycle.
- [SSC normalisation procedure notice (June 2025)](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Normalization_procedure_for_SSC_exams_from_June_2025.pdf) — referenced by the app's optional simulation; not used for this pack.
- Current-affairs checks for Batch 1 (as of 2026-11-08): [Nobel Peace Prize 2025](https://www.nobelprize.org/prizes/peace/2025/press-release/), [Milano Cortina 2026](https://www.olympics.com/en/milano-cortina-2026/olympic-games), [FIFA World Cup 2026](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026), [Glasgow 2026 Commonwealth Games](https://www.commonwealthsport.com/commonwealth-games/glasgow-2026), [ISRO](https://www.isro.gov.in/), [RBI](https://www.rbi.org.in/).
- Current-affairs checks for Batch 3 (as of 2026-11-08): [T20 World Cup 2026 — Britannica](https://www.britannica.com/event/2026-T20-World-Cup), [ICC T20 World Cup](https://www.icc-cricket.com/tournaments/t20cricketworldcup), [FIFA World Cup 2026](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026), [BRICS India 2026](https://www.brics2026.gov.in/), [Asian Games 2026 — OCA/Olympics.com](https://www.olympics.com/en/news/asian-games-2026-sports-schedule-la28-watch-live), [G20 2026](https://www.g20.org/), [COP31 Antalya](https://climate-diplomacy.org/events/2026-un-climate-change-conference-unfccc-cop-31).
- Current-affairs checks for Batch 2 (as of 2026-11-08): [Nobel Peace Prize 2026](https://www.nobelprize.org/prizes/peace/2026/press-release/), [UN News on Navi Pillay](https://news.un.org/en/story/2026/10/1168558), [Asian Games 2026 — Olympics.com](https://www.olympics.com/en/news/asian-games-2026-sports-schedule-la28-watch-live), [G20 US presidency 2026](https://www.g20.org/), [BRICS India 2026](https://www.brics2026.gov.in/), [COP31 Antalya](https://climate-diplomacy.org/events/2026-un-climate-change-conference-unfccc-cop-31), [International Booker Prize 2026](https://thebookerprizes.com/the-booker-library/prize-years/international/2026).
- Static-GK and science references are listed per question in the pack's `source.url` and `source.citation`.
