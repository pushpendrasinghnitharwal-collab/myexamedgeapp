# SSC CGL database: scope, operation and API

## Scope and sources

`server/data/ssc-cgl-syllabus.json` maps the five requested subjects to an application taxonomy derived from the [SSC CGL 2026 notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf), especially paragraphs 13.8–13.11. SSC describes its syllabus as indicative; topic grouping and some subtopic labels are editorial mappings, **not a claim that SSC has approved these labels**. The Tier-I English notice is broad, so its subtopic labels are practical subdivisions. Check the notice for the relevant examination year before importing older questions.

The official rule snapshots cover Tier I and the common Tier-II **Paper I**, not the post-specific Statistics/Finance papers. The qualifying Data Entry Speed Test (DEST) is represented as session metadata, not as a multiple-choice mock. There are no imported questions or papers. Source/review fields and SQL checks support an editorial workflow but cannot prove a citation, translation, answer, or solution is correct; an expert must independently verify each item. English questions in the official exam are not necessarily bilingual, even though this product requires both language fields.

## Data model

* `cgl_syllabus` contains 311 allowed `(subject, topic, sub_topic, exam_stage)` combinations. Stage is `Tier_1`, `Tier_2`, or `Both` (only where a mapping exists in both); computer is Tier II only. Question and passage-set subject/stage relationships are checked.
* Additive migration `002_ssc_cgl_official_catalog` adds `cgl_official_blueprints`, `cgl_catalog_subjects`, `cgl_catalog_topics`, `cgl_catalog_subtopics`, `cgl_catalog_subtopic_stages`, and `cgl_catalog_seed_versions`. The initial seed has five subjects, 80 topic groups, 281 subtopics and 496 stage-specific mappings. `notice_mapped` labels are application mappings to the notice; `editorial_detail` labels (for example, frustum, installments, OSI, and specific current-affairs years) are **study subdivisions**, not individually prescribed official chapters. IDs are deterministic. Each stage mapping is a foreign key to an existing `cgl_syllabus` key; API consumers should use the supplied canonical key, not an editorial label, when creating future questions. A `both_stage_key` is returned only when both tiers share the same canonical parent. Editorial parent links can be broad and do not prove the subdivision appeared in an SSC paper.
* The official snapshot links to the existing mock blueprints only after validating their exact subject order, question counts, marking and subject timers. It then protects those templates and rules from mutation, including when existing draft mocks use them; separate custom blueprints remain editable. No published or draft mock, question, learner or attempt is changed by the additive seed. Existing incompatible templates cause a transaction rollback instead of being silently rewritten.
* `cgl_questions` stores the syllabus key, difficulty, one of five requested question types, bilingual text, optional SVG/image URL, exactly four `{en,hi}` options, correct zero-based option index, PYQ/current-affairs metadata, basic and shortcut solutions, ideal seconds, source and editorial review. `Published` questions require a URL, citation, reviewer and timestamp. The database checks nonempty content and structure, not factual or translation accuracy. PYQ years are examination-cycle years 2021–2025; the actual shift date may occur in the next calendar year. Current affairs is General Awareness only and limited to 2025/2026. Allowed CA categories are `Appointments`, `Awards`, `Sports`, `Schemes`, `Defence`, `Index_Reports`, `Budget_Economy`, `Books_Authors`, `Important_Days`, and `National_International`.
* `cgl_question_sets` stores bilingual cloze/reading passages or a DI chart/media with 4–5 related questions when published. Additive migration 005 later permits DI sets of 2–5, while cloze/reading sets remain 4–5. A published mock must include the complete set. Inline SVG is **untrusted**: the storage check is not a sanitizer. Any future renderer must sanitize SVG and use a suitable content-security policy; do not inject it directly into the DOM. Treat image URLs as untrusted too.
* `cgl_mock_blueprints` and `cgl_blueprint_sections` support full, sectional, subject-wise, chapter-drill, PYQ-shift and the four requested CA year/month categories. Target subject/topic, CA year/month, and PYQ shift metadata are checked at publication. `cgl_mock_tests` and `cgl_mock_test_questions` hold actual test definitions. A mock cannot be published until every section has its exact count of reviewed, stage/subject-matched questions; published mocks and their underlying definitions/questions are immutable.
* `cgl_user_attempts`, `cgl_attempt_sections` and `cgl_attempt_answers` record backend-account ownership, raw section scores, chosen option, state and elapsed seconds. Historical `attempts` are intentionally retained separately. Old scores were generated by an unverified bank and are not recalculated or presented as official SSC results.

The 001 migration creates only two empty full-paper mock templates and the canonical syllabus. The separate catalog seeder adds official rule snapshots and the subject tree, without creating any questions or mock tests. There is no authoring/admin UI for the core bank; separate PYQ and current-affairs CLI import workflows require a controlled editorial process and appropriate database permissions. Do not mutate the migration after deployment: add a new versioned migration.

## Scoring

The seeded 2026 Tier-I blueprint has 100 questions, +2/−0.5, 200 raw marks and four 15-minute subject locks (standard time; eligible candidates may receive compensatory time). It is a screening score, not final merit. Common Tier-II Paper I has 30 Quant, 30 Reasoning, 45 English and 25 General Awareness questions worth +3/−1: 390 raw merit marks. Computer Knowledge has 20 questions (+3/−1, 60 raw marks) and is tracked separately as qualifying. The actual maximum for a shorter mock is returned separately; no scaling to 200/390 is invented. Paper I's standard subject timers are 30/30/40/20/15 minutes in Session I; DEST is a separate 15-minute Session II (subject to the notice's exemptions and higher post-specific standards). The 2026 notice's general minimum percentages are UR 30%, OBC/EWS 25% and others 20% for Tier I and each Paper I Section I–III, but these are not selection cutoffs; post-specific CKT standards can be higher. Computer qualification remains `Pending` when present because the applicable final standard has not been supplied. The API does not calculate normalization, DEST, post-specific papers, final merit or official selection.

## Endpoints

On the Express service (not necessarily the Vercel frontend):

| Method/path | Purpose |
| --- | --- |
| `GET /api/health`, `GET /api/cgl/health` | Schema readiness, checksum, legacy table presence, and clean-state counts; 503 if unavailable/migration required. |
| `GET /api/cgl/syllabus?stage=Tier_2&subject=Computer_Knowledge` | Allowed syllabus mappings; filters optional. |
| `GET /api/cgl/blueprints?stage=Tier_1` | Official 2026 rule snapshots, optionally filtered by `stage` (`Tier_1` or `Tier_2`) and `subject`. |
| `GET /api/cgl/blueprints/:key` | One snapshot; keys are `ssc-cgl-2026-tier-1` and `ssc-cgl-2026-tier-2-paper-1`. |
| `GET /api/cgl/subjects?stage=Tier_2&subject=Quant` | Subject/topic/subtopic trees. Both filters are optional; omitting them returns all five subjects. |
| `GET /api/cgl/subjects/:subject?stage=Tier_1` | One subject tree; valid subject codes are `Quant`, `Reasoning`, `English`, `General_Awareness`, and `Computer_Knowledge`. A valid subject not used in the selected stage returns `available_in_stage: false`. |
| `GET /api/cgl/weightages?stage=Tier_2&subject=Quant` | Official subject allocations and **null** topic/subtopic weights. `stage` is required; `subject` is optional. |
| `GET /api/cgl/mock-tests` | Published mock list, initially empty. |
| `GET /api/cgl/mock-tests/:id` | Published questions and passage content, **without answer keys or solutions**. |
| `POST /api/cgl/attempts` | Backend-JWT-authenticated submission. JSON has `mock_test_id` and `answers`, each answer containing `question_id`, zero-based `selected_option_index` (or null), `option_state`, and non-negative `time_spent_seconds`. Unmentioned questions are `Not_Visited`. The server validates and scores against the published mock in one transaction. |
| `GET /api/cgl/attempts`, `GET /api/cgl/attempts/:id` | Backend-JWT-authenticated own attempt summaries and details; correct answers and solutions appear only after submission. |
| `GET /api/attempts` | Existing backend-account historical attempt summaries, retained. |

The notice specifies subject/part-level counts and marks, but **does not prescribe numerical topic-level weights**. The weightages API therefore reports `topic_weightage_status: "not_prescribed"` and `question_count`, `maximum_marks`, and `weightage_percentage` as `null` for every topic/subtopic. It never presents estimates or historical frequency as official. Subject-level allocations are official; Tier I's module `counts_for_merit: false` refers to **final selection merit**, even though the existing scoring schema counts those marks in the Tier I screening score. All these read-only catalog endpoints are public and return HTTP 400 for invalid filters. No new test runner is implied by the blueprint metadata.

The main health result still describes 001 readiness. Its nested `catalog` object separately reports the 002 migration and seed checksums and expected row counts. An absent, incomplete or mismatched catalog returns HTTP 503 from the new catalog routes while existing CGL routes remain usable if 001 is healthy. Count checks detect missing/additional catalog rows, not every possible manual data edit. Re-run the same seed to repair missing seed mappings; investigate checksum or blueprint conflicts instead of changing history.

## Run the additive seed

After 001 has been applied to the **intended, backed-up** database and `DATABASE_URL` is configured:

```bash
cd server
npm run seed:ssc-cgl-catalog    # `npm run seed` is an alias
```

The seed checks the 001 checksum, runs 002 DDL and its data in one transaction under a PostgreSQL advisory lock, and is safe to repeat. It can restore a missing canonical syllabus key, never drops content, and inserts no questions, sets, mocks, attempts, or accounts. It refuses modified 001/002 checksums, altered official template sections, and a different dataset under the same seed version. It verifies existing source metadata rather than overwriting conflicting mappings. After deployment, add new migration/seed versions rather than editing applied 001/002 or the 2026 seed snapshot. Nothing is migrated or seeded automatically when the server starts.

The old `GET /api/paper` and `POST /api/attempts` return 410; the latter requires the existing backend auth. Backend JWT accounts are separate from Firebase/Google sign-in. Local browser history is not automatically synchronized or isolated per Google account. The React command center uses the newer master mock lifecycle, rather than the legacy mock endpoints documented above.

See [deployment/reset instructions](../DEPLOY.md). An isolated test database is not a production migration; run the guarded migration only after confirming and backing up the intended database.

For the additive empty PYQ vault, source ingestion, historical grading and AI review workflow, see [PYQ & AI engine](ssc-cgl-pyq-ai.md).

For the additive 2025–2026 current-affairs engine, sourced static boosters and practice mock workflow, see [Current Affairs & Static GK](ssc-cgl-current-affairs.md).

The optional personalised [Master Mock Assembler](ssc-cgl-master-assembler.md) adds its own empty migration, exact editorial Tier-I practice profile, source-aware reuse and timed sessions; it does not make topic frequencies official or populate a bank.
