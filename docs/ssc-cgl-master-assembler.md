# SSC CGL master mock assembler

The Express/PostgreSQL backend can prepare, list, launch, save and score owner-specific practice mocks. The rule snapshot is based on the [SSC CGL 2026 notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf). Subject counts, the optional notice-timing profile and marking follow that snapshot; the default requested exam-hall timing is a separately labelled, non-official practice profile; **the Tier-I topic quotas and difficulty split below are an editorial practice profile, not official SSC/TCS topic frequencies**. Tests and scores are practice, not official papers, official normalized results or selection outcomes. Tier II here is the common Paper I MCQ session; DEST is a separate qualifying session and is not part of that MCQ score. The [browser-based DEST simulator](ssc-cgl-dest-mentor.md) offers a separate, unofficial practice estimate.

**Content is not included.** No real questions, PYQ papers, current-affairs facts or mocks are seeded. A sufficiently large, independently verified and appropriately licensed published pool is required. Missing or infeasible content is reported rather than fabricated or used to relax constraints. The React player connects with the backend's own JWT account. Firebase/Google sign-in is separate from that backend account. Do not assume Firebase users, browser-only attempts or anonymous reads can be matched to backend accounts.

## Install and prepare content

1. Verify `DATABASE_URL`, take a restorable backup and follow [database operations](ssc-cgl-database.md). Migration 001 requires an explicit legacy-bank reset only on first installation; it preserves users and legacy attempts. **Do not repeat or force a reset on an existing installation.** The 002 catalog seed is separately optional for browsing the subject tree.
2. After 001 is in place, from `server/` run `npm ci` and `npm run migrate:master` (also available as `npm run master:seed`). Migrations 005 and 006 are additive, checksum-checked, transactional and idempotent; 006 adds player progress and early section advances without changing existing attempts. They do not seed content or run at server startup. Check `master_assembler.ok` in `/api/cgl/health` or `assembler.ok` in `/api/cgl/master/formats`.
3. Import and review the actual question bank using trusted database/editorial operations. Published bank questions require source, reviewer and reviewed difficulty. Additive migration 005 permits a published **DI** set of 2–5 questions; published cloze/reading sets remain 4–5. A full Tier-I profile needs a complete two-question DI set and a complete five-question cloze set. Sets are indivisible, including when a topic or difficulty filter is applied. Source fields and structural checks do not establish rights, correctness or translation quality. Editors must also ensure question text, options, charts and linked/media assets do not themselves reveal answers; arbitrary text or external assets cannot be reliably sanitized for answer content.
4. For PYQ/AI sources, apply `npm run migrate:pyq-ai`, then follow the rights, final-answer-key, import and review workflow in [PYQ & AI](ssc-cgl-pyq-ai.md). Only published 2021–2025 papers are used; topic-wise extraction additionally requires derivative rights. AI content must be published with its underlying PYQ source still available. `/api/cgl/pyq/papers` and `/api/cgl/pyq/chapters` list published inputs.
5. For CA sources, apply `npm run migrate:current-affairs` and follow the source-evidence, generation and editorial-review workflow in [Current Affairs](ssc-cgl-current-affairs.md). Monthly tests use published 50-question reviewed mocks; annual tests use published 100-question reviewed mocks with all 12 months. `/api/cgl/current-affairs/coverage` shows the 2025/2026 slots. Future, incomplete and unreviewed periods remain pending. Reviewed CA questions can also supply the dynamic General Awareness pool.
6. For full Tier I or difficulty-filtered micro-mocks, bank questions use their reviewed native difficulty; AI/CA questions need an explicit trusted editorial difficulty label (below). Unlabelled AI/CA questions can contribute to dynamic tests without a difficulty quota or filter, but cannot satisfy Tier-I's exact difficulty quota.

All operators should restrict database and CLI permissions. No public question-authoring or label endpoint is provided. Never put credentials, private source files or production data in the repository.

## Formats and scoring

The table below describes the preserved `official_2026` profile. New requests default to `exam_hall_v1`, the user-requested **non-official** practice profile. It uses one 60-minute Tier-I full timer with free subject navigation; Tier-II full mocks use 60/60/15-minute Section I/II/III locks, allowing navigation between each section's subjects and an explicit early advance of Section I or II; final submission unlocks in Section III. Tier-II sectional subjects share their section timer. PYQ shifts retain the reviewed paper's duration; chapter PYQs use one minute/question. CA monthly/annual/category tests use 30/60/15 minutes. Micro drills remain untimed. Supply `"timing_profile":"official_2026"` when preparing a new mock to retain the table's notice-based locks and the historical untimed practice formats. Existing prepared or active sessions without a profile retain their original immutable timings.

| Category | Composition and timing | Marking |
| --- | --- | --- |
| `Full_Tier1` | 100: Reasoning, GA, Quant, English, 25 each; four locked 15-minute modules, 60 minutes total. | +2 / −0.5, 200 screening marks. Exact editorial topic/set quotas and 30 Easy / 50 Medium / 20 Hard. |
| `Full_Tier2` | 150: Quant 30/30 min, Reasoning 30/30 min, English 45/40 min, GA 25/20 min, Computer 20/15 min; 135 minutes total. | +3 / −1; 390 merit marks plus 60 Computer qualifying marks. |
| `Sectional_Tier1` | Any one of Quant, Reasoning, English or GA: 25 questions, 15 minutes. | +2 / −0.5. |
| `Sectional_Tier2` | Section I = Quant + Reasoning, 60 questions/60 minutes; Section II = English + GA, 70/60; Section III = Computer, 20/15. The same individual module locks apply. | +3 / −1. |
| `Micro` | 15–30 questions by stage and subject, optionally canonical topic/sub-topic and difficulty. Untimed, but the session expires after 24 hours. | Tier-I +2/−0.5 or Tier-II +3/−1; raw practice marks. |
| `PYQ_Shift` | Exact reviewed source paper and order; source duration, one aggregate timed module. | The source section's historical rules; single, multiple-accepted and void questions are handled. |
| `PYQ_Topic` | 1–100 eligible historical questions from a chapter; optional year/stage/sub-chapter; intact passages. Untimed, 24-hour session. | Each question retains its source section's historical marking. Mixed-paper totals are practice only. |
| `CA_Monthly`, `CA_Annual` | Exact published reviewed CA paper for 2025 or 2026, 50 or 100 questions; optional `ca_category` selects the published 20-question category snapshot for the period. Untimed, 24-hour session. | The reviewed CA paper's stage marking. |

The engine uses standard times; compensatory time/accommodations are not implemented. For compatibility, the immutable stored scoring summary still records Computer qualification as `Pending`: full Tier-II `max_score` includes Computer (450), while `actual_merit_max_score` excludes it (390). The new owner-only **derived analytics** separately shows Section I /180, Section II /210 and their /390 sum, plus Computer /60 and a minimum-standard practice assessment. UR is 18/60; OBC/EWS is 15/60; other categories are 12/60. These are the 2026 notice's basic percentage minimums, not competitive cutoffs or guarantees of qualification for a particular post; higher Computer standards may apply, and DEST, additional papers and final selection are not assessed. An incompletely delivered or withdrawn section is `Not_Assessed`. A shortened test's actual maximum is never scaled up.

Tier I reports raw screening /200 and subject scores. SSC does not specify Tier-I subject cutoffs in the notice; the frontend lets learners set **unofficial personal targets** on their device instead. Percentile and normalized score remain unavailable unless the learner opts into the histogram simulation below. No official normalization, rank, selection prediction or final merit is computed.

### Exact Tier-I editorial profile `tier1-editorial-practice-v1`

Each subject has exactly 25 questions. These numbers are product decisions, not official topic weights:

| Subject | Topic counts |
| --- | --- |
| Quant | Number Systems 2; Fundamental Arithmetical Operations 10; Algebra 2; Geometry 3; Mensuration 2; Trigonometry 3; Statistical Charts 3, of which exactly 2 are DI. |
| Reasoning | Analogy 3; Classification 2; Series 3; Operations and Coding 3; Spatial and Figural Reasoning 3; Logical Reasoning 3; Intelligence 1; General Intelligence 4; Matching and Indexing 3. |
| English | Vocabulary 7; Grammar and Usage 9; Sentence Structure 4; Comprehension 5, all 5 from a cloze set. |
| General Awareness | Current Events 6; India and Neighbouring Countries 12; Everyday Science 5; Environment and Society 2. |

The 30/50/20 difficulty counts apply across the whole full Tier-I test, not separately to each subject. Other full/sectional formats preserve RC, cloze and DI groups but do not invent topic or difficulty quotas. `/api/cgl/weightages` continues to show official topic weights as unspecified.

### Editorial difficulty labels

The trusted `master:label` CLI annotates already published Bank, AI or CA items. It requires a reviewer and meaningful notes, records an audit history, and snapshots the label used in each prepared mock. It does not publish content or prove accuracy. Bank labels cannot override their native difficulty. AI parts are 1-based within a batch; Bank and CA use part 0. Example with fictional placeholders:

```bash
npm run master:label -- --kind AI --id BATCH_ID --part 1 --difficulty Medium --mains-level true --reviewer 'Editor name' --notes 'Reviewed difficulty and suitability against the source'
npm run master:label -- --kind CA --id QUESTION_ID --difficulty Easy --mains-level false --reviewer 'Editor name' --notes 'Reviewed difficulty against the question and evidence'
```

Replace IDs with real, published records. Tier-I-only bank/AI items cannot be labelled Mains Level. `Mains_Level` is a **Tier-II suitability filter**, not a fourth native difficulty grade: Tier-II-only Bank/AI items qualify by stage; `Both`-stage bank questions or CA questions require an affirmative editorial label. Easy/Medium/Hard remain separate filters. Applying a filter may exclude an entire set if any child does not match.

## HTTP API

All paths below are on the Express backend origin. Except `formats`, use `Authorization: Bearer <backend JWT>` obtained via the existing `/api/auth/register` or `/api/auth/login`. Mock IDs and histories are owner-scoped; another account receives 404. JSON examples below use placeholders, not actual content.

| Method/path | Behavior |
| --- | --- |
| `GET /api/cgl/master/formats` | Public format, editorial profile and 005/PYQ/CA schema readiness. A ready schema does not mean content exists. |
| `POST /api/cgl/master/mocks` | Validate a category request and prepare an exact composition; returns 201 and metadata, **not questions or keys**. |
| `GET /api/cgl/master/mocks?limit=50&offset=0` | List this account's mock metadata; limit 1–100, nonnegative offset. |
| `GET /api/cgl/master/mocks/:id` | Own mock metadata. |
| `POST /api/cgl/master/mocks/:id/launch` | Start the server clock and return only the current unlocked period's questions. Repeated launch of an already active mock acts like an active refresh. |
| `GET /api/cgl/master/mocks/:id/active` | Refresh the current unlocked period, server timer, own saved answers, palette flags, timing and repeat flags. After expiry it returns no questions. |
| `PUT /api/cgl/master/mocks/:id/responses` | Save current unlocked-period answers: `{"answers":[{"position":1,"selected_option_index":0}]}`. Positions are 1-based; options are 0–3, or null to clear. |
| `POST /api/cgl/master/mocks/:id/advance` | In the requested Tier-II full practice profile only, submit the current Section I/II early with `{"section":"Section_I"}`. Retried requests cannot skip another section. |
| `GET /api/cgl/attempts/master` | Owner-scoped submitted assembler attempts; optional `stage`, `limit`, `offset`. |
| `POST /api/cgl/attempts/master/:id/submit`, `GET /api/cgl/attempts/master/:id` | Submit or review the owner's assembled attempt, with derived `analytics`. These use the master attempt storage, not the separate published-paper `cgl_user_attempts` table. |
| `POST /api/cgl/attempts/master/:id/simulate` | Owner-only, non-persistent Tier-I histogram simulation on a submitted, fully delivered and still-available full mock; see below. |
| `POST /api/cgl/master/mocks/:id/submit` | Submit early or after time ends. Optional body `{"answers":[...]}` saves final **current-period** choices if still in time; `{}` grades previously saved choices. Returns score and review for delivered questions. |
| `GET /api/cgl/master/mocks/:id/review` | Own submitted review; keys and solutions only after submission and only for delivered, still-available content. |
| `POST /api/cgl/master/mocks/:id/cancel` | Cancel a prepared or active mock; released undelivered items are eligible again. |

Create bodies (unknown fields are rejected):

```json
{"category":"Full_Tier1"}
{"category":"Full_Tier2"}
{"category":"Sectional_Tier1","subject":"Quant"}
{"category":"Sectional_Tier2","section":"Section_II"}
{"category":"Micro","stage":"Tier_1","subject":"Quant","topic":"Number Systems","sub_topic":"Decimals","count":15,"difficulty":"Medium"}
{"category":"PYQ_Shift","paper_id":"PAPER_ID"}
{"category":"PYQ_Topic","stage":"Tier_1","subject":"Quant","chapter":"CHAPTER_FROM_VAULT","cycle_year":2024,"count":20}
{"category":"CA_Monthly","stage":"Tier_1","year":2025,"month":1}
{"category":"CA_Monthly","stage":"Tier_1","year":2025,"month":1,"ca_category":"Schemes"}
{"category":"CA_Annual","stage":"Tier_2","year":2025}
```

For `Micro`, `topic`, `sub_topic` and `difficulty` are optional, but `sub_topic` requires `topic`. Valid subjects are `Quant`, `Reasoning`, `English`, `General_Awareness`, and, only for Tier II, `Computer_Knowledge`. Use canonical names from `/api/cgl/syllabus` or the `canonical_key` in `/api/cgl/subjects`; editorial tree labels are not necessarily canonical keys. Difficulty is `Easy`, `Medium`, `Hard` or `Mains_Level`. PYQ topic requests instead use the vault's exact subject/chapter labels and may omit `stage`, `cycle_year` or `sub_chapter`; omitting stage can mix historical stages.

Typical errors: HTTP 400 for invalid input; 401 for missing/invalid backend JWT; 404 for another user's or nonexistent mock; 409 `INSUFFICIENT_REVIEWED_CONTENT`, `CONTENT_PENDING`, `PREPARATION_EXPIRED`, `POOL_CHANGED`, `CONTENT_WITHDRAWN`, `MODULE_LOCKED`, `TIMER_EXPIRED` or `INVALID_STATE`; and 503 for a required schema/checksum mismatch or a busy, oversized, timed-out or failed solver. Exact constraints are never silently relaxed. Read `code` and optional `details`; generate a new mock after `POOL_CHANGED` or an expired preparation. A withdrawal invalidates a prepared/active test rather than serving or grading withdrawn content.

## Post-mock analytics and optional shift simulation

Submission and subsequent owner review derive `analytics` from the existing score snapshot and delivered question projections; they do not rewrite historical summaries or require another migration. `subject_scores` and Tier-I `screening` are raw practice marks. `merit` describes the two Tier-II Paper-I sections and their /390 sum; `computer` is separately assessed against the basic category minimums only when all 20 questions were delivered and their reviewed content remains available. A withdrawn or undelivered section is `Not_Assessed`, not automatically failed. The original summary's `computer_qualifying_status` remains `Pending` for backward compatibility. A qualification badge is a **minimum comparison in practice**, not a final/post-specific eligibility decision.

`timing.by_outcome` contains correct, wrong and skipped totals and averages only for questions with positive recorded focused time; counts show how much was actually tracked. Zero/unrecorded time is unknown, not proof of an instantaneous answer. Void, withdrawn and undelivered questions are excluded. A `time_traps` entry requires recorded time strictly greater than twice an available reviewed `ideal_time_seconds`. These times are approximate client reports, not official evidence. The UI fills a missing server duration from older timing on the same device and account if available, labels it device-only, and never adds it to an existing synced duration.

For an optional simulation, `POST /api/cgl/attempts/master/:id/simulate` accepts 2–8 supplied histograms, each a list of `{"score": number, "count": integer}` pairs. Scores must be −50 to 200 in 0.5-mark increments; counts are positive, with at most 501 rows and 10 million participants **including the learner** per shift. Extra keys such as names are rejected. Shift 1 must contain **other** candidates only; the owner's actual mock raw score is added once. For example, the following is synthetic input, not an SSC data set:

```json
{"shifts":[[{"score":80,"count":25},{"score":100,"count":40}],[{"score":75,"count":30},{"score":105,"count":35}]]}
```

The implementation applies the mechanics of SSC's [2025 normalization notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Normalization_procedure_for_SSC_exams_from_June_2025.pdf) to the supplied data: shift percentile uses the fraction at or below the score, including ties; the same percentile is mapped to each shift by linear interpolation; matched scores are averaged without weighting the shifts. If any shift does not bracket the percentile, `status` is `insufficient_range` and `normalized_score` is null; no extrapolation is made. Returned sample sizes include the learner in Shift 1. Input and results are not saved; the user must re-enter data for another calculation. This is **not** an official SSC percentile, normalized score, cutoff or prediction. Small or unrepresentative samples can be misleading.

The review UI provides Wrong, Skipped, Correct, Slowest, Time traps and Subject filters. The Basic Concept and 20-Sec Exam Trick tabs show only supplied reviewed explanations, shortcuts and applicable sourced CA Static GK Boosters; unavailable material is explicitly marked rather than generated. Device/account-scoped personal targets are local, not backend official cutoffs, and are removed by device-data reset.

## Session, privacy and reuse behavior

* `GET /api/cgl/master/mocks?stage=Tier_1` (or `Tier_2`) filters paginated history by stage; omit it for all stages. The optional `status` filter accepts `Prepared`, `Active`, `Submitted`, `Cancelled` or `Invalidated`.
* `GET /api/cgl/master/summary` returns per-stage submitted counts and the current cross-stage streak, calculated over all submitted sessions with at least one selected answer in Asia/Kolkata days.
* Preparing reserves its selected questions for 30 minutes but does not mark them seen or start the test. Prepared items and undelivered future active modules are temporarily unavailable to another dynamic mock for the same account; cancelling, expiry or submission releases them. Delivered items become eligible for repeat selection if needed. Fixed-source mocks preserve their paper even if they overlap a reservation.
* At launch, a dynamic preparation is re-solved against current exposure and other reservations. If an improved unseen/older selection is now possible, or the chosen pool changed, the immutable preparation is invalidated with `POOL_CHANGED`; create a fresh mock. The solver minimizes seen questions first, then prefers the least recently seen, subject to exact counts and indivisible sets. If unseen eligible content cannot fill the test, seen items are automatically reused and counted in `selection.reused_questions`/`repeat_reason`. `previously_seen` flags individual delivered items. Fixed PYQ/CA papers are never substituted and explicitly flag repeats.
* Questions become seen when a module is delivered, not merely prepared or reserved. Retries of an active module do not add another exposure. Attributable submitted Bank, PYQ, AI and CA attempts from the older backend APIs also contribute to seen history, and their submissions share a per-account transaction lock with assembly. Generic legacy attempts, offline/local tests and anonymous public question reads cannot reliably be mapped to these identities. Identity is source-kind/ID/part, not semantic text; duplicate or paraphrased questions from different sources are not deduplicated. Thus no-repeat is guaranteed only within attributable, eligible source identities and the fixed-source exception above.
* The server clock, not the browser clock, controls section or module access. The player sends visited/review flags and cumulative per-device `elapsed_ms` with a per-mock `device_id` and monotonic `client_revision`; exact retries are idempotent and older same-device writes are rejected and retained with the owner's master attempt. Time is client-reported foreground activity, not scoring evidence. Local backup includes selected indices and flags, not question content or keys. A disconnected device cannot guarantee a late response will be accepted after the server locks its section. There is no pause or automatic submission; once time expires, submit saved answers with `{}`. Questions from future or skipped modules and their solutions are never exposed in active responses or post-submission review; they appear as `not_delivered` score placeholders. Client payloads should not be treated as an anti-cheating or secure-exam environment.
* Public active projections omit answer keys, accepted-answer lists, solutions, AI verification and CA boosters, including sensitive fields nested in chart metadata. The user's selected option is returned for resumption; it is not an answer key. After submission, review includes keys/solutions and the CA Static GK Booster Box where applicable. Withdrawing a source redacts its content and explanations from future review while retaining recorded scores; withdrawal cannot erase information already downloaded or backed up.

The integer optimizer preserves complete groups and exact constraints; it runs in a worker with a 10-second limit and up to four workers per backend process. Oversized pools/models and solver timeout/busy states fail closed. Increase or partition the reviewed pool and retry rather than weakening quotas; capacity tuning and production load testing remain an operator responsibility.
