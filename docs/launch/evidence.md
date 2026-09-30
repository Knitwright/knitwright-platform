# Evidence table: MVP acceptance criteria M1 to M7

Plan step 26, task 6. One row for each acceptance criterion in
`plans/knitwright-mvp-blueprint.md`, with the test or record that proves it and where it lives.
Written 2026-09-30 on `release/public-beta` (from `feat/exports` 5be3505). Several proofs live on
branches that are merged on `integration`, not here; the "Where" column says so. Paths are from
`apps/web/` unless they start with `docs/` or `supabase/`.

**Updated 2026-09-30 on `integration`** after images, 3D, chart import, the family branches, the
exports fix pass, step 15 (guided flow) and this step were joined. Rows M1, M4, M5 and M6 name
the proof that now exists there. Docker was down: no db or browser test was run on `integration`.

**Status key.** Proven: a test or record exists and passed when last run. Partly: some of the
criterion is proven, the rest is owed. Owed: nothing proves it yet.

**The owner must read this table before sign-up opens** (step 26 acceptance criterion).
Owner read on: [owner: date and initials].

| ID | Criterion | Proof | Where | Status |
|---|---|---|---|---|
| M1 | A user with no technical knowledge goes from one sentence, or one uploaded sketch, to a downloadable tech pack (PDF, Excel, SVG) and photoreal images in under 5 minutes. | On `integration`: `e2e/guided-flow.spec.ts` goes from one sentence (one garment of each family) and from one sketch to all four downloads, with the assistant's model replaced by a stand-in (`lib/providers/stand-in.ts`), and checks each step with axe; **written, not run** (Docker down). The PDF now carries the photoreal illustrations (`lib/techpack/exports/pdf/pictures.test.ts`, `lib/projects/export-download.test.ts`). Timed runs template: `docs/reviews/guided-flow-timed-runs.md`. Pieces: `e2e/exports.spec.ts` (a member downloads PDF, Excel and both SVG drawings); `lib/intent/text-flow.test.ts` and `lib/intent/image-input.test.ts` (sentence and sketch become a design); `lib/images/run-job.test.ts` (images made as a background job); the guided flow of step 15. **The timed end-to-end run is owed**: it needs live AI keys (A3), a deployment, and a person who is not technical, timed with a stopwatch, recorded in this file. | exports: this branch. Intent: `feat/intent-text`, `feat/intent-image`. Images: `feat/images`. All on `integration`. Guided flow: `feat/guided-flow` (step 15), on `integration`. | Owed (timed runs by the owner; browser specs to run) |
| M2 | Every text instruction and every image reading becomes a validated spec change, a clarifying question, or an explained rejection. Model output is parsed, never trusted. | `lib/intent/gates.test.ts`, `lib/intent/outcome.test.ts`, `lib/intent/reply-tool.test.ts`, `lib/intent/proposal-token.test.ts` (signed proposals); golden set replay `lib/intent/golden/replay.test.ts` (207 cases, never silent) and `lib/intent/golden/image-replay.test.ts`. **Owed**: the owner approves the expected outcomes (A7, all cases are `approved: false`), test images (A8), and a live evaluation with real keys (`lib/intent/golden/live-eval.ts`, A3). | `feat/intent-core`, `feat/intent-text`, `feat/intent-image`; on `integration` | Partly |
| M3 | Changing a measurement updates the flat, the table and every export together. | `lib/techpack/three-way.test.ts` (flat, table and document from one new version); `lib/techpack/exports/formats.test.ts` ("a measurement changes the PDF, the Excel file and the SVG together, to the same value"); `e2e/tech-pack.spec.ts`. | This branch | Proven |
| M4 | Every value shows where it came from. Suggested and AI-proposed values are never shown as verified. | Invariant I5 tests: `lib/techpack/cell.test.ts`, `lib/techpack/exports/tables.test.ts`, `lib/techpack/exports/guard.test.ts` (no value exported without provenance), `lib/techpack/exports/excel/workbook.test.ts`, `lib/techpack/exports/svg.test.ts`, `lib/techpack/exports/pdf/parts.test.ts`; `components/studio/ProvenanceBadge.tsx` with `lib/projects/provenance-tone.ts`. A `reviewed` record exists only with a named person (layer R, not built), so nothing is shown as checked. Chart import adds `chartProvenance` (`lib/charts/*.test.ts`, `feat/chart-import`); on `integration` the exports are made from the same brand charts as the page (`lib/projects/export-download.test.ts`, "a brand's own chart included"). Illustrations in the PDF and Excel are labelled "not a specification" (`lib/techpack/exports/illustrations.test.ts`). | This branch; chart import and illustrations on `integration` | Proven |
| M5 | One brand can never read another brand's designs, files or images. | `tests/integration/isolation.test.ts` (every table, bucket and callable function enumerated; a member sees nothing of another brand and can write nothing directly); `tests/integration/storage-service.test.ts`; `tests/integration/export-downloads.test.ts`; `tests/integration/deletion.test.ts` (deleting never touches another brand's files, new in this step). Images and chart tables are in the suite on `integration` (`jobs`, `brand_size_charts`, `usage_events`, `usage_limits` in `TABLES`). On `integration`, `deletion.test.ts` also covers generated pictures and imported charts (`supabase/migrations/20260930020000_deletion_integration.sql`: a person's jobs and charts never block deleting their account; a design's generated pictures go with it). Code review: `docs/launch/security-review.md`. | This branch, plus `integration` | Proven on this branch (db suite last run green at step 9). On `integration` the isolation and deletion db tests are written but **not run** (Docker down on 2026-09-30). |
| M6 | AI spend per user, per brand and in total is capped, and the cap holds under parallel requests. | `tests/integration/usage.test.ts` ("succeeds exactly 10 times when 100 reservations race for an allowance of 10"; user, brand and daily total ceilings; half and full alerts); `lib/usage/meter.test.ts`, `lib/usage/cost.test.ts`, `lib/usage/alert.test.ts`. Alert hook: `lib/monitoring/wire.test.ts` (`createSpendAlert` logs at error level and reports); on `integration` the usage meter calls it when the day's ceiling is reached (`lib/usage/alert.test.ts`, `withCeilingHook`, wired in `lib/server/deps.ts`). **Owed**: a load run against a deployment (see below), real allowance amounts and the alert destination (owner). | `feat/usage` and the alert hook, joined on `integration` | Partly |
| M7 | 80% or higher test coverage, with measurement and tech pack maths tested first. | `vitest.config.mts` thresholds: 80% overall, 90% on `lib/garment`, `lib/sizing`, `lib/flat`, `lib/techpack`; CI runs `pnpm --filter web test:cov`. Last full gate recorded at step 8: 99.01% statements, 94.27% branches (`.superpowers/sdd/knitwright-mvp-blueprint/progress.md`, 14:08 to 14:13 on 2026-09-29). Test-first is recorded per step in the same progress file, with the exceptions named there. **Owed**: one coverage run on `integration` after every branch is merged. | This branch and `integration` | Partly |

## Rate limits and ceilings under load (step 26, task 2)

What is proven without a deployment:

- Every route and action is wrapper output: `tests/architecture/repo.test.ts`.
- Every wrapper names a rule from `lib/server/limits.ts`, and the wrappers refuse a request over
  its limit before the handler runs, for member, user and public entry points:
  `tests/architecture/rate-limits.test.ts` (new in this step). On `integration` it also pins the
  rule of each paid or costly route: assistant, read-image, start-images, poll-job, export and
  import-chart, and the proposal, guided start and deletion actions.
- The counter is atomic under concurrency: `tests/integration/rate-limit.test.ts`.
- Usage reservations hold under 100 parallel requests: `tests/integration/usage.test.ts`
  (`feat/usage`).

**Owed (needs a deployment):** a load run against the deployed app, for example 50 concurrent
clients for 60 seconds against sign-in, upload, export and one AI route, checking that the 429
answers start at each limit, that no request passes uncounted, that the daily spend ceiling
refuses once reached, and that the database stays within the free tier's connection limit.
Record the tool, the numbers and the date here.

## Records owed to the owner

| Record | Blocks | Owner action |
|---|---|---|
| Legal review of `docs/legal/*.md` | Opening sign-up | A9 |
| Real AI keys with spend limits in each console | M1, M2 live evaluation | A3 |
| Approved golden-set outcomes and test images | M2 | A7, A8 |
| Allowance amounts and spend alert destination | M6 | (step 10 questions) |
| Vercel Pro, Node 22 or 24 | Launch | A2 |
