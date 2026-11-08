# ExamEdge deployment and the SSC CGL reset

The existing Vercel deployment serves the React PWA; the Express/PostgreSQL backend is **separate and optional**. Google sign-in is unchanged and does not sync local progress. See [Google sign-in setup](docs/google-sign-in.md) and [the CGL database reference](docs/ssc-cgl-database.md).

## Before using an existing database

**The migration deletes the legacy question and mock-definition tables.** It does not delete `users`, `exams`, or historical `attempts`. Old attempt summaries remain, but deleted question details cannot be reconstructed. The browser's local attempts, bookmarks and notes are not cleared.

1. Verify the database target and take a restorable backup using your provider's tooling (for example, `pg_dump`), storing it securely **outside this repository**. Test the restore. Pause application writes during the reset.
2. Set the existing `DATABASE_URL` in the backend's secure environment; do not commit it or paste it into chat. Use a role with permission to create tables/functions and drop the listed legacy tables.
3. Install backend dependencies, then explicitly opt into the one-time reset:

   ```bash
   cd server
   npm ci
   npm run migrate:ssc-cgl -- --reset-legacy-bank
   npm run seed
   ```

   `seed` applies the **additive** official 2026 catalog and is also available as `npm run seed:ssc-cgl-catalog`. It does not insert questions or mocks and never performs the legacy reset itself. The reset migration and the separate catalog seed are transactional, guarded, checksum-verified, and idempotent; subsequent runs do not erase the new bank. It never uses `CASCADE` to remove unknown dependencies. If an unexpected foreign key blocks a drop, the transaction rolls back; investigate rather than forcing it.
4. Start or redeploy the existing Express service, with the existing `DATABASE_URL` and `JWT_SECRET` unchanged. No migration is run automatically on startup.
5. On the **Express service's** origin, request `/api/health` or `/api/cgl/health`. Immediately after a fresh migration, expect `ok: true`, `clean: true`, zero questions/sets/mock tests/CGL attempts, 311 canonical syllabus mappings and two empty full-paper blueprints. After the seed, `catalog.ok` should also be `true` (five subjects, 80 topic groups and 281 subtopics); before it, only the new catalog endpoints report 503. Historical attempts are not included in the `user_attempts` count. A later legitimate question or attempt makes `clean` false but leaves `ok` true. Missing/outdated schemas report HTTP 503. A static Vercel frontend may have no API route at all: a Vercel 404 does not verify the database.

The two initial blueprints cover the SSC CGL 2026 Tier-I paper and common Tier-II Paper I. Subject timers and category minimums follow the 2026 notice; topic-level question counts are not prescribed and are returned as null. They are definitions, not published mock records. No question, passage set, or mock is seeded or claimed to be an official paper. The frontend includes an interactive practice player, but shows honest empty/pending states until a reviewed bank is published and connected.

## Add the catalog to an existing CGL database

If 001 is already applied and its checksum is valid, **do not repeat a legacy reset**. After confirming `DATABASE_URL` and taking a backup, run `cd server && npm run seed:ssc-cgl-catalog`. This additive command applies 002 and seeds the 2026 blueprints/tree in one transaction. It refuses conflicting existing official templates rather than changing them. Check `catalog.ok` on the Express health endpoint and see the [API reference](docs/ssc-cgl-database.md). No production database is changed until an operator runs this command.

## Frontend deployment

Use the existing Vercel project/settings and `npm run build`. Configure the existing optional `VITE_API_URL` only if a separate API has actually been deployed; the Firebase settings are described in the sign-in guide. Do not clear site storage to update the PWA: saved learner data stays on the device. The new service worker removes old cached main bundles containing the retired question bank, while retaining older lazy assets for already-open tabs where possible. Old open tabs and external caches cannot be remotely erased; after the update is applied, newly loaded app code no longer contains the old bank.

For local development, `npm ci`, `npm run test`, and `npm run build` run from the repository root. To run the optional API, install its dependencies with `cd server && npm ci`; after installing root dependencies, `npm test` in `server` also runs the isolated HTTP API tests. Then set the required backend environment variables securely and start it with `npm start`. Vite's existing `/api` development proxy targets the local backend.

The optional 2021–2025 PYQ/AI vault has a separate additive, empty migration and requires licensed, reviewed source material. See [PYQ & AI engine](docs/ssc-cgl-pyq-ai.md); it is not applied or populated on server startup.

The optional 2025–2026 current-affairs engine has a separate additive, empty migration and requires reviewed source evidence; see [Current Affairs & Static GK](docs/ssc-cgl-current-affairs.md). Future periods are not fabricated.

The [Master Mock Assembler and Exam Player](docs/ssc-cgl-master-assembler.md) use additive migrations 005 and 006 (`npm run migrate:master` after 001), with separate PYQ/CA migrations where those sources are wanted.

Two optional, original Tier-I practice packs (200 questions total on the verified 2026 pattern, each with the DI and cloze sets the editorial profile requires) live in `server/data/ssc-cgl-2026-tier1-practice/` and `server/data/ssc-cgl-2026-tier1-practice-v2/`. They are **not** SSC papers and are **not** seeded by any migration. Additive migration 007 (`cd server && npm run migrate:practice`) only creates its provenance ledger. Validate both with `npm run practice:validate -- --all`; import as Draft with `npm run practice:import -- --all`; preview locally with `npm run practice:import -- --all --preview`. Production publication requires a named human review and both `--mode publish --reviewer ... --confirm-human-review`. See [the Tier-I practice pack guide](docs/ssc-cgl-tier1-practice-2026.md). `/api/cgl/practice/status` reports its review state without exposing questions or keys.
 The React command center and player are wired to these APIs. Backend JWT accounts are separate from Firebase. The migrations create no content and are not run automatically; no production database was changed by adding them.

### Vercel and ongoing attempts

Vercel serves the static frontend only. Deploy the Express service and PostgreSQL separately (or configure a same-origin proxy), apply the required migrations after a backup, and verify the backend health endpoint before setting `VITE_API_URL` to the public HTTPS API origin in Vercel and rebuilding the frontend. `VITE_API_URL` is public configuration, not a secret; keep `DATABASE_URL` and `JWT_SECRET` on the backend. Allow the Vercel origin in the backend's CORS policy. See the [Command Center guide](docs/ssc-cgl-command-center.md) for content and account prerequisites.

Player progress is saved to both the backend and the current origin's local storage. Vercel preview domains and the production domain have separate local storage; only server-synced progress follows the practice account between them. A refresh can restore local pending edits on the same origin, but edits not received before a server-enforced section deadline cannot be accepted retroactively. The player warns about unsynced changes.
