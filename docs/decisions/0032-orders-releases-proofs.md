# 0032: Team orders, frozen releases and strike-offs

Status: Proposed
Date: 2026-10-15
Plan step: `plans/production-outputs.md`, workstream W4

## Context

The fashionINSTA benchmark has no team list, no way to print the same files again and an empty
sign-off table. A club order is 15 to 30 shirts with a name and number each; a reorder a season
later must print the same as the first, or say why not; and a factory wants to know who looked at
the test print and said yes. Player names are personal data, so they must be easy to erase and must
not leak into records that are kept for good.

## Decision

1. **Team orders** (`team_orders`, `team_order_rows`): a roster per design, written only through
   `save_team_order`, which replaces the name and every row in one step. Names are cleaned (hidden
   and direction characters dropped, letters, digits, spaces and `' - . & ` only) when they come in,
   and escaped again for each file they reach: a spreadsheet cell that starts with `= + - @` gets
   a leading apostrophe, PDF text goes through the font's character check, and `escapeXml` is
   provided for SVG. A list with problems (a size outside the run, a repeated number, a missing
   name where the design prints one) saves, and the problems come back; a release refuses it.
2. **Releases** (`production_releases`): append-only, with the trigger that protects `spec_versions`.
   A release holds the contract's `ReleaseSnapshot` (design version, pattern block version, fabric
   test ids, print profile, **a hash of the roster**, SHA-256 per file) and the settings of every
   file (`PrintFileSpec`), never the files and never a name. Erasing a team list therefore leaves
   releases intact and the personal data gone.
3. **Reorder** rebuilds each file from the frozen settings through `PrintFileBuilder` and compares
   hashes. The report names the cause when it can (design version, pattern, fabric tests, each
   print-profile field, team list) and says "the print software may have changed" when nothing
   explains a difference. Nothing is sent; a person chooses.
4. **Strike-offs and sign-offs** (`strike_offs`, `sign_offs`): a strike-off moves requested,
   received, then accepted or rejected by a named person with a role and a date, and is locked after
   that. A sign-off is a role, a typed name and a date against a release, appended for good. The
   "proofs" line of the factory checklist is met when the newest decided strike-off was accepted;
   a rejected one blocks it. Measured shrink is offered in the contract's `FabricValue` shape so the
   fabric part can save it as a fabric test; W4 does not import it.
5. **Design deletion** removes team lists, releases, strike-offs and sign-offs by key, and
   `files_of_project_alone` is extended so the proof photos go with the design.

## Evidence

Unit tests: `lib/orders`, `lib/releases`, `lib/proofs` (90 % thresholds). The 22-player fixture
imports from its own CSV export unchanged, flags a repeated number 10 and a size outside the run,
and its manifest totals equal its rows. A release's reorder reproduces identical hashes; changing
the fabric test ids makes the report name the change. Database tests (`tests/integration`) cover RLS
and the append-only triggers; the migrations were also applied to a local Postgres 16 and exercised
by hand because Docker was not available when they were written.

## Alternatives

- Keep names in the release so it can rebuild player files alone: rejected, a release would hold
  personal data for good and could not be erased.
- Foreign keys from a release to W1 to W3 tables: rejected by the plan, so migrations merge in any
  order. The team order id on a release is a plain column for the same reason (the order may be
  erased).
- Letting a decided strike-off be corrected: rejected. A wrong decision is answered by a new
  strike-off, so the record stays what was said and when.

## Consequences

Freezing a release needs a real `PrintFileBuilder`. Until the print workstream is joined (change
`printFileBuilder` in `lib/releases/builder.ts`), the route answers "Print files cannot be made yet".
`lib/legal/privacy.ts` and the design deletion page text (`app/(app)/studio/[projectId]/delete`)
are outside this workstream and should list team lists and strike-off photos; this is flagged on the
PR. Revisit if clubs ask for a name to be kept with a release.
