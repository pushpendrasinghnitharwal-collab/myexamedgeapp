# SSC CGL 2021–2025 PYQ vault and isomorphic practice engine

## What is and is not seeded

The initial seed is deliberately **empty**: there are no fabricated or unreviewed 2021–2025 PYQs, answer keys, papers, or AI questions. SSC's [2025 Tier-I notice](https://cdn.testbook.com/1760632158510-SSC%20CGL%20Answer%20Key%202025.pdf/1760632158.pdf) says saved question papers from its challenge portal are for personal use and self-analysis; the [2025 Tier-II final-key notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Final_writeup_17062026.pdf) describes a time-limited candidate-login window. A candidate response sheet or an unrelated web page is not automatically permission to redistribute a paper. Do not upload raw candidate response sheets, names, roll numbers, credentials, signed URLs, or other personal information. Have an authorized editor verify authenticity, the **final** answer key, the exact cycle/date/shift/paper identity, redaction, and redistribution and derivative rights before publication. Hashes and attestations do not prove any of these facts.

The migration is additive and does not modify existing users, questions, tests, attempts, 001 or 002. The app does not currently have a PYQ/AI authoring UI. Ingestion, generation and publication are **operator-only CLI operations**; there is no public write endpoint. Restrict shell access and PostgreSQL write permissions to trusted editors. The database role can bypass application review, so protect it. Nothing is applied to a live database or seeded at server startup.

## Apply the empty seed

After confirming the intended `DATABASE_URL`, backup, and the existing 001 migration:

```bash
cd server
npm run pyq:seed     # applies checksummed 003; same as npm run migrate:pyq-ai
```

The seed uses a dedicated PostgreSQL transaction and advisory lock, checks the 001 checksum, is safe to repeat, and inserts **zero** content records. `GET /api/cgl/health` reports the separate `pyq_vault` readiness object. Existing CGL routes remain available if 003 has not yet been applied; the new vault routes return 503.

## Import a rights-cleared, reviewed-source paper

The importer reads a normalized JSON manifest, not PDFs or OCR automatically. Prepare the transcription and the source/final-key/rights evidence separately in a secure location **outside the repository**. The evidence may not be redistributed merely because you possess it. Remove candidate data before storage and use only material you are authorized to process. The importer stores the normalized question text and reference URLs in PostgreSQL, plus SHA-256 evidence digests, not the evidence file bytes or their local paths. HTTPS source links are public metadata; they must not contain credentials, query parameters or fragments.

1. Create an intentionally incomplete template with `node pyq-template.mjs > /secure/pyq-manifest.json`. Fill it in with genuine source data; blank templates are rejected, not seeded as questions.
2. Get digests with `npm run pyq:hash -- /secure/paper-evidence /secure/final-key-evidence /secure/rights-evidence`. Copy the three resulting hashes into `source`.
3. Import the draft:

   ```bash
   npm run pyq:import -- /secure/pyq-manifest.json \
     --paper-evidence /secure/paper-evidence \
     --key-evidence /secure/final-key-evidence \
     --rights-evidence /secure/rights-evidence
   ```

   The importer checks evidence digests, exact metadata and source-order indices, structural rules and applicable canonical keys in one transaction. Re-running the same manifest is idempotent. A partial paper remains a **private draft**; append to it by importing a manifest containing every previous unchanged entry plus additional entries. The importer refuses changed/removed existing entries or conflicting source/section rules, rather than silently overwriting them. If a draft needs correction before publication, explicitly repeat the import with `--replace-draft`; it replaces only the matching unpublished, unreferenced draft in one transaction and retains the prior normalized manifest snapshots. Changing the paper's identifying cycle, stage, date, shift or paper code requires a separate new draft rather than this flag. Chapters become public only after their complete source papers are reviewed and published.
4. Inspect with `npm run pyq:inspect -- PAPER_ID`. A separate qualified editor must compare every statement, diagram, source question reference, option order, final-key entry, translation, section rule, date, cycle and shift against the licensed source. Check the right to distribute, and separately the right to make derivatives and send them to an external AI service. Only then run:

   ```bash
   npm run pyq:publish -- --id PAPER_ID --reviewer 'Editor name' --notes 'Source, final key, shifts and redistribution rights checked'
   ```

The publication guard requires every declared question and section count to be present; it freezes the paper, sections, passages and questions so saved attempt answers cannot change later. The completeness check compares against the manifest, not an independently fetched SSC paper: the reviewer must validate the declared total and all source claims. A wrong answer or rights attestation requires editorial intervention, not an automatic rewrite of a published record. Use `npm run pyq:withdraw -- --id PAPER_ID --reviewer 'Editor name' --notes 'Reason for withdrawal'` to take it and its derivative batches out of public reads. Then import and review a corrected new version. Withdrawal preserves learner score history but hides keys and explanations for withdrawn content on history reads. It does **not** erase retained normalized records, earlier manifest snapshots, database backups, or copies previously downloaded by users; follow the applicable rights and retention policy separately.

### Manifest fields

`schema_version` is `1`. The blank template includes the main objects. Each entry uses only the keys listed below; unknown keys are rejected to reduce accidental metadata leakage.

* `paper`: `cycle_year` (2021–2025), `exam_stage` (`Tier_1`/`Tier_2`), `paper_code`, ISO `exam_date`, exact documented `shift_label`, `title`, `duration_seconds`, and `expected_questions`. Cycle year is **not** necessarily the exam-date year: for example, some 2021-cycle exams were held in 2022 and 2025-cycle Tier II in 2026. Never infer a shift or turn a date into `Shift 1` without evidence.
* `source`: `paper_url`, `final_key_url`, `final_key_type: "Final"`, `paper_sha256`, `final_key_sha256`, `rights_sha256`, `rights_reference`, `source_description`, `redacted: true`, and explicit boolean `allow_derivatives` / `allow_external_processing`. Only set those booleans when the permission actually covers the intended activity. Both must be true for the external AI generator.
* `sections`: entries with `code`, `label`, `position`, `expected_questions`, `correct_marks`, `wrong_deduction`. Counts must sum to the paper total. Supply the **historic paper's** rules from its source; 2026 blueprint timers/marks are not imposed. The 2021-cycle Tier II used separate papers and a different scheme, so its Quant and English papers must not be labelled as the modern common Paper I.
* `passages`: optional entries `ref`, `text_en`, optional `text_hi`, optional `translation_note`. A Hindi passage requires a note saying whether it is official text or an editorial translation.
* `questions`: entries with `source_question_ref`, `section_code`, `position`, `subject`, `chapter`, optional `sub_chapter`, optional `canonical` key (`subject`, `topic`, `sub_topic`, `exam_stage`), optional `passage_ref`, `question_text_en`, optional `question_text_hi`, optional `translation_note`, optional HTTPS `media_url`, and four ordered `options` (`{ "en": "...", "hi": null }`). English-only source text is allowed without inventing a Hindi version. The SSC challenge portal may present question or option order differently from the exam; preserve the verified question-to-final-key association rather than aligning different versions by position alone. If Hindi text/options are supplied, `translation_note` must state whether original or editorial. Store image references only when permitted; URLs and SVGs remain untrusted to renderers.
* The source key is `answer_status: "Single"` with `correct_option_indices: [0]`, `"Multiple"` with 2–4 unique indices, or `"Void"` with `[]` and a documented `void_policy` of `"Excluded"` or `"All_Awarded"`. These examples describe the shape, not actual answers. Optional `solution_basic` and `solution_trick` are editorial explanations, not official SSC solution claims.

`canonical` is optional for historical topics outside the current five-subject taxonomy. It is checked against `cgl_syllabus` and the paper stage when present; a mapped key for the requested target stage is required for AI generation. Chapter labels are editorial classifications, not official numerical weightages.

## AI generation and review

Configure an OpenAI-compatible **server-side** chat-completions endpoint and key via `AI_BASE_URL`, `AI_API_KEY`, `AI_GENERATOR_MODEL`, `AI_SOLVER_MODEL`, and `AI_AUDITOR_MODEL`. Optional `AI_TIMEOUT_MS` is 1000–300000 (default 120000). Use a different solver model name from the generator; distinct names or requests alone do not establish truly independent model weights. Keep credentials in the deployment secret store, not the repository, URLs, browser, or chat. The sandbox has no access to an external model provider, so real-provider behaviour, costs and model quality must be validated in the deployed environment.

```bash
npm run ai:generate -- --source QUESTION_ID --stage Tier_1 --format single_concept
npm run ai:inspect -- BATCH_ID
npm run ai:publish -- --id BATCH_ID --reviewer 'Independent reviewer' --notes 'Checked source structure, answer, translations and both solutions'
```

Tier I supports `single_concept`. Tier II supports `mains_multi_step`, `multi_statement`, `match_column`, `reasoning_puzzle`, `statistics_probability`, and `reading_triple`. The last requires an English passage-based source and produces exactly three new passages with 4–5 questions each. Numeric Quant single/multi-step and statistics/probability questions require a constrained arithmetic expression and plain numeric options. Unsupported image-based sources are refused. User-facing generated questions are labelled **AI-generated practice, not official PYQs**.

The generator gives a separate solver only the new question, options and relevant passage—no proposed answer, solutions, expression or generator reasoning. It rejects non-unique/ambiguous solutions or a different answer index. A separate audit checks concept similarity, originality, both solutions, translations and the expression-to-wording relationship. Supported arithmetic expressions are evaluated as exact rationals by a bounded interpreter; model-produced code is never executed. Any failed check rejects the **whole batch**, with no question saved. Passing output remains a `Verified_Draft` and can be released only after a human inspects it and records review notes. If an AI batch later proves wrong or unsuitable, `npm run ai:withdraw -- --id BATCH_ID --reviewer 'Editor name' --notes 'Reason for withdrawal'` hides it while preserving learner scores. Withdrawing its source paper also hides dependent batches.

**None of this establishes 100% correctness.** Model agreement, the expression check, and human review can still miss ambiguity or errors. The expression check only verifies the declared calculation against options; it cannot prove the calculation matches the prose. Do not advertise these checks as a guarantee or as official SSC verification. `solution_trick` is a checked concise strategy, not a promise that every learner can solve it in 20 seconds.

## HTTP API

The public read endpoints return only published material and never disclose answer keys or solutions before submission. Invalid filters return 400; missing 003 returns 503.

| Method/path | Purpose |
| --- | --- |
| `GET /api/cgl/pyq/papers?cycle_year=2024&stage=Tier_1` | Reviewed, complete shift papers with exact metadata and historical scheme. |
| `GET /api/cgl/pyq/papers/:id` | Paper sections, questions and passages without keys. |
| `GET /api/cgl/pyq/chapters?stage=Tier_2` | Chapter groups derived from published complete papers. |
| `GET /api/cgl/pyq/chapters/questions?subject=Quant&chapter=Percentages&limit=100&offset=0` | Paginated chapter deck, optional stage/cycle filters. |
| `POST /api/cgl/pyq/grade` | Backend-JWT required. `{"mode":"Paper","paper_id":"...","answers":[{"question_id":"...","selected_option_index":0}]}`; `Chapter` uses answer IDs without `paper_id`. Null is skipped; omitted paper questions are skipped. Returns final keys and editorial solutions after submission. |
| `GET /api/cgl/pyq/attempts`, `/api/cgl/pyq/attempts/:id` | Backend-JWT-authenticated own history. |
| `GET /api/cgl/generated`, `/api/cgl/generated/:id` | Human-reviewed AI practice batches without keys; optional stage/subject filters on the list. |
| `POST /api/cgl/generated/:id/grade` | Backend-JWT required; answers have `question_number` (1-based) and `selected_option_index` (0-based or null). Returns checked answers and both solutions after submission. |
| `GET /api/cgl/generated-attempts`, `/api/cgl/generated-attempts/:id` | Backend-JWT-authenticated own AI practice history. |

PYQ grades use the source sections' historical raw marks/deductions, including explicitly reviewed multiple-answer and void policies. Mixed-year chapter totals are practice sums, not SSC normalized scores or official results. AI grades report correct counts and do not invent historical exam marks. Backend JWT accounts remain separate from Firebase/Google login. The React PYQ vault uses published listings and runs drills through the master mock lifecycle; the standalone grading endpoints remain available to API clients.

Public paper listings and question payloads omit the final-key URL, answer keys and solutions. Trusted import records retain the final-key source, and the master submitted review can provide its source reference after submission.
