# 0023: Launch hardening: deletion, monitoring, legal pages

Status: Accepted, with owner actions open (A9 legal review; the Sentry DSN). Amended 2026-09-30: the owner chose Sentry in its EU region, and the storage quota (500 MB a brand) is built.
Date: 2026-09-30
Plan step: 26

## Context

Step 26 prepares the public beta: security review, rate limits, legal pages, error monitoring,
deletion of designs and accounts, and the evidence table. Sign-up stays closed (A9). Several other
branches are being merged at the same time, so the changes had to be additive and self-contained.
Docker was down, so no database test could be run.

## Decision

1. **Deletion removes storage objects before rows.** Four server-only SQL functions
   (`supabase/migrations/20260930010000_deletion.sql`): `project_deletion_files` and
   `account_deletion_brands` say what will go; `delete_project` and `delete_account_data` delete
   and return what they removed. `lib/deletion/service.ts` removes the objects first, runs the
   delete, then removes anything the delete returned that was added in between. A failure part way
   leaves rows that point at missing files, which the app already treats as missing, and running
   the deletion again finishes it. It never leaves files that nothing points at.
2. **A design's deletion takes only the pictures it alone uses**: artwork files of its brand that
   no other design of the brand names in any version. Pictures no design uses stay: they are the
   brand's library, deleted with the brand.
3. **An account's deletion empties each brand folder in every bucket** by listing it, so objects
   without a row (a failed upload) go too, then deletes the brands (designs, versions, downloads,
   file rows and memberships follow by their keys), removes the address from the sign-up allow
   list, and finally deletes the user from Supabase Auth. It refuses while a brand has another
   member, which cannot happen until teams arrive (layer E).
4. **Monitoring without a vendor SDK.** `lib/monitoring/monitor.ts` sends nothing unless
   `MONITORING_DSN` is set. A Sentry-style DSN gets a Sentry envelope over HTTPS (Sentry,
   GlitchTip); any other https address gets JSON (a webhook). Everything is scrubbed of keys,
   tokens and email addresses, sends time out after 3 s, and a failure to send is logged, never
   thrown. It is wired in `productionDeps.log`, which the request wrappers call for every
   unexpected failure, and reports through Next.js `after()` so the response is not delayed.
   `MONITORING_DSN` is read in `lib/monitoring/server.ts`, not in `lib/config/env.ts`, so a bad
   value turns monitoring off with a warning instead of stopping the app.
   **Chosen provider (owner, 2026-09-30): Sentry, EU data region** (Frankfurt). The DSN of an EU
   project names an ingest host under `de.sentry.io` (`.env.example` shows the form); a sentry.io
   DSN outside that region is still used but warned about at start (`regionWarning`), because
   the privacy notice names the EU region. Sentry is listed as a processor in the legal drafts.
5. **Spend-ceiling hook.** `alertSpendCeiling` in `lib/monitoring/server.ts` logs at error level
   and reports. The usage meter (`feat/usage`, `lib/usage/alert.ts`) should call it when the
   ceiling is reached; that wiring is done at integration. Where the alert goes after that is set
   up in the monitoring service by the owner.
6. **Legal text is data.** `lib/legal/*.ts` holds the three documents; the pages at
   `/legal/terms`, `/legal/privacy` and `/legal/data-processing` render it, and
   `scripts/write-legal-docs.mts` writes `docs/legal/*.md` for review. A test fails when the files
   differ from the pages. The processor list is one table used by both the privacy notice and the
   data-processing terms. Every document is `status: "draft"` and shows the draft notice until the
   owner and a lawyer approve it.
7. **Rate limits are proven by an architecture test**: every `defineRoute`/`defineAction` call
   writes `rateLimit: LIMITS.<name>` with a name that exists
   (`tests/architecture/rate-limits.test.ts`).

## Evidence

- Unit tests: `lib/deletion/*.test.ts`, `lib/monitoring/*.test.ts`, `lib/legal/*.test.ts`,
  `lib/server/log.test.ts`, `lib/auth/notices.test.ts`, `tests/architecture/rate-limits.test.ts`.
- Database tests `tests/integration/deletion.test.ts`: written, **not run** (Docker down on
  2026-09-30). The migration has not been applied to any database either. Run at integration:
  `psql ... -f supabase/migrations/20260930010000_deletion.sql` then
  `npx vitest run --project db tests/integration/deletion.test.ts tests/integration/isolation.test.ts`.
- The Sentry envelope format was written from memory of the documented protocol
  (`/api/<project>/envelope/`, `X-Sentry-Auth` with `sentry_version=7`); it has not been sent to
  a real Sentry project. Check it with one test error when the DSN is set.
- Licences and advisories: `docs/launch/licences.md`. Security review:
  `docs/launch/security-review.md`. Evidence table: `docs/launch/evidence.md`.

## Alternatives

- **Rows first, then storage.** Simpler, but a storage failure would leave files readable by the
  brand's members (the storage policy is by folder) after the user was told they were deleted.
- **A database trigger or queue to remove storage objects.** Supabase does not let SQL remove
  storage objects, and the plan keeps code portable (no host-only queue).
- **Deleting every file a design ever named.** Would break other designs that share a logo.
- **The Sentry SDK.** Adds a large dependency and instrumentation hooks for one POST. Can replace
  the transport later without changing callers.
- **Markdown files read at run time for the legal pages.** Fragile on Vercel (files outside the
  app folder are not traced) and needs a Markdown renderer.

## Consequences

- Other branches add tables that reference brands or users (`usage`, image jobs, brand size
  charts). At integration, check each: a table keyed to `brands` with `on delete cascade` is
  covered; a column referencing `auth.users` with `on delete restrict` (for example a usage ledger
  row's `user_id`) will make the final `deleteUser` fail. Such rows need deleting (or the user id
  cleared) in `delete_account_data`, and image-job files need to be in a bucket
  `emptyBrandFolders` lists (`uploads`, `images`, `exports`).
- The spend-ceiling hook is not yet called by anything on this branch.
- `MONITORING_DSN` should be added to `apps/web/.env.example` and the hosted runbook at
  integration (left out here because both files are being changed on other branches).
- The decision records index (`docs/decisions/README.md`) does not list 0011 to 0023 yet; add them
  at integration.
- Revisit when teams arrive (layer E): account deletion must then hand brands over or remove only
  the member.
