# 0060: Pattern service request

Status: Proposed
Date: 2026-10-28
Plan step: plans/platform-v4.md, workstream W4-A. Spec stage 6: for garments outside the catalogue, a request sends the design and tech pack to the Sialkot team, who draft in CLO and return files.

## Context

Decisions 0029 and 0037 leave "No pattern yet" slots in the pattern library for products no automatic drafter covers. The spec's answer is a
paid service run by people. The platform needs the request, its status, the files that come back and a queue for ops. It does not sell
anything: the Store is out of scope, and the price and turnaround are owner decisions that are not made.

## Decision

1. **Two tables** (`20261028010000_pattern_service.sql`): `pattern_requests` (one per saved design version, status `requested`,
   `accepted`, `in_progress`, `delivered` or `declined`) and `pattern_request_events` (append-only; update, delete and truncate are refused,
   and the delete is let through only when the brand itself is deleted, as for the credit ledger). A request names its design by project id and
   version with no foreign key, and keeps an immutable JSON snapshot of the design and its sha256 (`lib/pattern-service/snapshot.ts`: sorted
   keys, no date, no random id). RLS: a member reads their brand's rows, a platform admin reads all, nobody holds an insert, update or delete
   policy, and the server's key holds SELECT only. Writes go through four security definer functions the server's key alone may run; the three ops
   ones call `private.require_ops_actor`, which answers "not found" to anyone who is not a platform admin.
2. **The quote is copied, never invented.** Two settings, registered through `lib/settings/extensions.ts`: `pattern_service.price_credits` and
   `pattern_service.turnaround_working_days`. Both default to "not set". The request stores what the settings said when it was made
   (`quoted_price_credits`, `quoted_turnaround_days`, null when not set). With nothing set the screen says "Knitwright will confirm the price"
   and "Knitwright will confirm the turnaround". The spec's "five working days" is not used as a default.
3. **Credits.** `pattern_request_create` takes the quoted price from the brand's ledger in the same step that inserts the request, only when
   the caller says to charge. The server says so only when a price above 0 is set and `CREDITS_ENFORCED` is on (decision 0051); with the flag off
   it logs what the request would have cost, as the gate does. The existing gate spends a fixed price per output kind from `credit_prices`,
   which cannot carry a per-request amount, so this function writes the ledger line itself (kind `spend`, output kind `pattern_file`, the same
   table and rules). The line is named by the request's own snapshot hash rather than the design version's hash, so ordering the design later
   does not give the credits back (see owner question 2). A decline gives the credits back once, as a `refund` line.
4. **Who can ask.** A design whose article has no pattern block of kind `pieces` in the brand's library (`eligibleForPatternService`, built on
   the library's slots). Socks (a knitting programme) and unknown garments cannot. The request is for the design's current version; asking
   again for that version changes nothing and charges nothing. The design page links to the screen only for garments the library marks as
   needing a draft.
5. **What is sent**, shown before the button: the design as saved in that version and the factory file made from it. The snapshot holds the design
   itself; the tech pack is produced from the same design, so the hash names both. No roster, no player names, no other design.
6. **Ops** (`/ops/pattern-requests`, platform admins only, listed in the ops navigation): accept, mark in progress, attach DXF files, deliver, or
   decline with a reason. Files are stored as `pattern-source` files of the request's brand (decision 0028) after the bytes are checked to be a
   DXF; delivery needs at least one file. A brand downloads a delivered file only through a route that checks the file is listed on a request of
   its own brand and design.
7. **Labels.** Delivered files show "Pattern from the Sialkot team, not reviewed by a technician" until ops records a technician's name; then
   "reviewed by <name> on <date>". The library's own reviewer flow works on library blocks, not on loose files, so a small "Record the review"
   control stands in for it here (see "Honest limits").
8. **No email.** The brand sees status in the app. Nothing is sent.

## Honest limits

- Not run against Supabase in the cloud sandbox (no Docker). The migration was applied after every earlier migration to a bare Postgres 16 with
  stub Supabase roles and tables, and the transition, charge, refund, append-only and grant behaviour was exercised there by hand. The
  Supabase-backed integration test, the isolation test and the end-to-end spec are written but their first real run is in CI.
- The snapshot holds the design as saved, not a rendered tech pack file. The tech pack is rebuilt from the design on demand, so a later change to
  tech pack code could render the same snapshot differently; the hash proves which design was sent, not which PDF.
- "Reviewed" is a name and a date typed by ops. It is not linked to the pattern library's review of a block.
- Deleting a design does not remove its requests (no foreign key, by rule). Deleting a brand does.
- A priced request charged while the flag is on is final for the brand unless ops declines it.
- No SLA is stored or enforced: the turnaround is a quoted number.

## Owner questions

1. What does a pattern request cost, in credits (or is it quoted per request outside the app)? Until set, nothing is charged.
2. Should the credits for a pattern request come back when the design is ordered, as other credit spends do (decision 0044)? Built: they do not,
   because they pay for the team's work.
3. How many working days does the Sialkot team promise, counted from acceptance or from the request?
4. Should a declined request always refund (built) and may a brand ask again for the same version after a decline (built: no, save a new version)?
5. Who is the technician who reviews returned patterns (questionnaire 36), and should that review be recorded in the library instead?
6. Is an email to the Sialkot team on a new request wanted once a mailer is chosen?
