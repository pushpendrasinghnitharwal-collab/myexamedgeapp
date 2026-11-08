# SSC CGL current-affairs and static-linked mock engine

## Scope and availability

The engine covers calendar years **2025 and 2026**. It exposes 24 monthly slots, each with a 50-question monthly mock and 20-question within-month weekly windows, plus 100-question annual mocks and 20-question category drills. It starts with **no events, questions or mocks**, as selected. Empty slots explicitly report `Awaiting_Content`, `In_Progress`, or `Upcoming` instead of inventing news or silently borrowing questions from another period.

All dates are calendar dates in `Asia/Kolkata`. A monthly, weekly or annual mock cannot be published until the period has ended. As of **7 November 2026**, December 2026 is in the future and the 2026 full-year mock cannot honestly be completed; it becomes eligible after 31 December 2026, once reviewed source coverage is sufficient. Category drills may be generated as labelled **to-date snapshots** through the current day. Weekly windows are **within the month**, not ISO weeks: 1–7, 8–14, 15–21, 22–28, and 29–month end when applicable. The last window may be shorter.

The eight categories are Government Schemes (`Schemes`), Sports (`Sports`), Padma/National/International Awards (`Awards`, with `Padma`, `National`, `International`, `Other` subgroups), Appointments (`Appointments`), Military Exercises (`Military_Exercises`), Rankings and Indexes (`Rankings_Indexes`), Budget and Economic Survey (`Budget_Economy`), and Science/Space (`Science_Space`).

Annual and mixed mocks use fixed **editorial heuristics** (version `ca-editorial-v1`) and a human-assigned per-event priority, favouring the requested themes while balancing available categories. These are **not measured TCS frequencies or official SSC topic weights**; no PYQ-frequency dataset has been supplied. Actual weights and selected category/month counts are included in the mock metadata. Annual assembly requires at least one distinct reviewed event from **every month**, and each mock uses at most one question per event. If there are fewer than the exact 50, 20 or 100 eligible questions, or a required annual month is missing, assembly reports the gap rather than inventing or repeating items. Annual coverage of each month is a minimum, not a guarantee that the mock covers every important event.

The short/bumper CA tests are practice products, not official SSC papers. They apply the chosen stage's 2026 per-question raw marking (+2/−0.5 for Tier I, +3/−1 for Tier II); the actual practice maximum is returned. They do not invent an official timer, cutoff, normalization or selection result for 20-, 50- or 100-question CA-only tests.

## Apply the empty migration

Back up and verify `DATABASE_URL`, and apply existing migration 001 first. From `server/`:

```bash
npm run ca:seed       # same as npm run migrate:current-affairs
```

Migration 004 is additive, checksum-checked, advisory-locked and repeatable; it inserts zero CA content and does not alter users, existing questions, mocks, attempts, the PYQ vault, or migrations 001–003. Startup never applies it automatically. `GET /api/cgl/health` reports a separate `current_affairs` readiness object. When 004 is missing or its checksum differs, only CA routes return 503; existing CGL/PYQ routes remain available if their own schema is healthy.

## Source, generate, review, assemble

All write operations below are **trusted-operator CLI commands**, not public HTTP endpoints. Restrict shell and database write privileges. There is no feed scraper, scheduled job or public content submission: an editor supplies and checks source material; the generator and assembler automate the subsequent draft creation. No live AI provider is configured or tested in the sandbox.

1. Prepare authoritative primary sources and separate evidence for the **event fact** and the **static fact**, with rights covering publication. A public page or a digest alone does not prove accuracy or permission. For example, the [PIB copyright policy](https://www.pib.gov.in/content/102_2_Copyright-Policy.aspx?reg=3&lang=1) allows reproduction subject to accuracy and attribution but excludes third-party material; policies differ by source. Check the exact source and its terms. Do not use credentials, signed links, candidate data or personal information. Public HTTPS URLs can use non-secret query parameters such as `PRID`; common token/password/signature parameters, credentials and private IP hosts are rejected, but this is **not** an automatic PII detector or a check of public reachability or ownership.
2. Keep source evidence and rights documents outside the repository. Use `npm run ca:hash -- /secure/source-evidence /secure/rights-evidence` for each source. `node ca-template.mjs > /secure/ca-manifest.json` produces an intentionally incomplete data-entry skeleton. Populate it with genuine, redacted source material; no template facts are seeded.
3. Create a separate local evidence-path index, with one entry for each manifest source ref:

   ```json
   {"sources":{"SOURCE_REF":{"evidence":"/secure/source-file","rights":"/secure/rights-file"}}}
   ```

   Replace `SOURCE_REF` and paths; this is not actual evidence. Run:

   ```bash
   npm run ca:import -- /secure/ca-manifest.json --evidence-index /secure/evidence-paths.json
   npm run ca:inspect -- event EVENT_ID
   npm run ca:review -- --kind event --id EVENT_ID --reviewer 'Editor name' --notes 'Checked both facts, dates, link and source rights'
   ```

   Imports are atomic and idempotent by normalized-manifest hash. The database stores normalized facts, source links, evidence digests and attestations, **not** evidence file bytes or local paths. Stable `event_key` values prevent two active versions of the same identified event; editors must also detect duplicates with different keys. Facts dated in the future are rejected. If a draft needs correction, use `npm run ca:reject -- --kind event --id EVENT_ID --reviewer 'Editor name' --notes 'Reason for rejection'`, then import a corrected manifest with the same stable event key. The rejected draft remains as an immutable audit record. Question and mock drafts can likewise be rejected with `--kind question` or `--kind mock` before regenerating or reassembling; no silent overwrite is performed.
4. Configure `AI_BASE_URL`, `AI_API_KEY`, `AI_GENERATOR_MODEL`, `AI_SOLVER_MODEL` and `AI_AUDITOR_MODEL` on the server, with a different solver model name. `AI_TIMEOUT_MS` is optional (1000–300000, default 120000). Both the event and static sources must explicitly permit republishing, derivatives **and external processing** before they are sent to a model. Never put credentials in browser variables, manifests, URLs or the repository.

   ```bash
   npm run ca:generate -- --event EVENT_ID
   # Or generate from up to 25 reviewed eligible events in one operator run:
   npm run ca:generate -- --all --limit 25 --year 2025
   npm run ca:inspect -- question QUESTION_ID
   npm run ca:review -- --kind question --id QUESTION_ID --reviewer 'Editor name' --notes 'Checked source, answer, translations, explanation and static link'
   ```

   `--all` incurs provider usage and processes at most the explicitly supplied limit, without retries. The source-grounded solver receives the event fact and new question/options, but not the proposed answer or explanation. A separate audit checks grounding, unique answer, explanation, translation, temporal context and booster relevance. These automated checks examine the supplied summary, not the underlying evidence or its rights. Generated questions stay private drafts until a human reviews them. Separate model names, model agreement and human review do **not** guarantee correctness.
5. Once sufficient questions are approved, assemble drafts:

   ```bash
   npm run ca:assemble -- --all --stage Tier_1
   # Or assemble a specific scope:
   npm run ca:assemble -- --kind Monthly --stage Tier_1 --year 2025 --month 1
   npm run ca:assemble -- --kind Weekly --stage Tier_2 --year 2025 --month 1 --week 1
   npm run ca:assemble -- --kind Annual --stage Tier_1 --year 2025
   npm run ca:assemble -- --kind Category --stage Tier_1 --year 2025 --month 1 --category Awards --award-group Padma
   npm run ca:inspect -- mock MOCK_ID
   npm run ca:review -- --kind mock --id MOCK_ID --reviewer 'Editor name' --notes 'Checked period coverage, composition and sources'
   ```

   `--all` covers 24 monthly slots, their weekly windows, monthly and annual category drills, and both annual mocks for the chosen stage; run it separately for each stage. It reports unavailable, in-progress and insufficient scopes, creates only complete **drafts**, and is safe to repeat. It does not generate facts or publish mocks. Award subgroups are included automatically and are also available through individual category assembly. A scheduler may run the trusted commands after editorial review, but no scheduler is installed or enabled by this change.

### Manifest shape

The template uses `schema_version: 1`, an optional `revision` label, a nonempty `sources` array, and a nonempty `events` array. Unknown fields are rejected. The revision label can distinguish an intentional new editorial import after a draft was rejected, even if its facts are unchanged; it does not bypass active event-key uniqueness or human review.

* Each source has a lowercase stable `ref`, `title`, public HTTPS `url`, `evidence_sha256`, `rights_sha256`, `rights_reference`, and explicit booleans `allow_republication`, `allow_derivatives`, `allow_external_processing`.
* Each event has `event_key` (lowercase stable identifier), `event_date` (actual event/announcement date in `YYYY-MM-DD`, within 2025–2026 and not in the future), `category`, `award_group` (required only for `Awards`), `editorial_priority` (1–5, an editorial judgment), `title_en`, a factual source-grounded `fact_en`, and `event_source_ref`.
* `static_booster` requires `source_ref`, `title_en`, `title_hi`, `fact_en`, `fact_hi`, `link_en`, `link_hi`, `translation_note`, and `as_of`. The bilingual link must genuinely explain why the static fact relates to the event. The `as_of` date records when the static fact was verified; it does not imply it is timeless. A reviewer must check the fact, relationship and Hindi translation against the static source. The engine attaches this already-sourced box automatically to every explanation rather than guessing a capital, currency, dance, park or constitutional article.

For a mistake, changed fact, or rights concern, use `npm run ca:withdraw -- --kind event|question|mock --id ID --reviewer 'Editor name' --notes 'Reason for withdrawal'`. Withdrawing an event or question hides every dependent mock from public reads. Withdraw the affected published mock before assembling a corrected replacement with the same scope. Learners keep score history; explanations and boosters for withdrawn content are hidden in history responses. Withdrawal is **not erasure** of normalized database records, backups or previously downloaded copies; follow the applicable rights and retention policy.

## HTTP API

| Method and path | Purpose |
| --- | --- |
| `GET /api/cgl/current-affairs/capsule` | Latest published, source-backed reviewed event, with its actual event date; returns `capsule: null` when none exists. |
| `GET /api/cgl/current-affairs/categories` | Categories, award subgroups and labelled editorial weights. |
| `GET /api/cgl/current-affairs/coverage?stage=Tier_1` | All 24 month slots, weekly windows, monthly/yearly category and award-subgroup readiness, and both annual slots, with India-local as-of date. Existing category snapshots include their as-of date and a stale flag. |
| `GET /api/cgl/current-affairs/mocks?year=2025&month=1&kind=Monthly&stage=Tier_1` | Published, currently usable mocks; optional `week`, `category`, `award_group`, `limit` and `offset`. |
| `GET /api/cgl/current-affairs/mocks/:id` | Published questions without answer keys, explanations or boosters. |
| `POST /api/cgl/current-affairs/mocks/:id/attempts` | Backend-JWT required. Body: `{"answers":[{"question_id":"ID","selected_option_index":0}]}`. Selections are 0–3 or null; omitted questions are skipped. Returns scores, source citations and a Static GK Booster Box in every explanation after submission. |
| `GET /api/cgl/current-affairs/attempts`, `/api/cgl/current-affairs/attempts/:id` | Authenticated own practice history; never another account's attempts. |

The Express backend JWT is separate from Firebase/Google sign-in. The Command Center uses the coverage, capsule and published-mock endpoints; practice attempts use the master assembler lifecycle and player rather than this module's standalone attempt routes. No production database, external provider, or deployment is modified merely by adding this code.
