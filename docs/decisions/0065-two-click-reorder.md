# 0065: Two-click reorder with sizes pre-filled

Status: Proposed
Date: 2026-10-25
Plan step: plans/platform-v4.md, workstream W4-F

## Context

The spec wants a reorder from any past order in two clicks, with sizes pre-filled from the roster, and saved sizes per
player that pre-fill next season. Decision 0032 built the release reorder (rebuild every file from the frozen
settings and compare hashes). Decision 0042 gave a club seasons with saved sizes per player. Nothing joined them.

## Decision

1. **Where.** A "Reorder" button on each line of the club's order history (`/club`), for roles that may manage the
   kit (the database already refuses anyone else on the write). Press Reorder, look at the review, press Confirm.
2. **Where the roster comes from.** By default the club's newest season that has players (its saved sizes are the
   point of the feature). A select on the review switches to another season or to "the earlier order's list" (the team
   order the release was made from). If that list was erased, a season is required and the screen says so.
3. **Nothing is dropped.** `lib/clubs/reorder/plan.ts` turns players into lines. A line that no longer fits keeps its place
   with a reason: `size-removed` (the saved size is not in the design's size run today), `player-left` (on the earlier order,
   not on the chosen roster; matched by name, or by number when the design prints no names), `no-number`. Each such line
   needs an answer before Confirm works: a size from the run, a number, keep, or leave out. "Leave out" is a visible
   choice and the confirmation says how many were left out. When nothing needs an answer and nothing changed, Confirm
   is the only step. Changed sizes and new players are listed as information.
4. **Confirm recomputes.** The browser sends the fingerprint of the plan it looked at and its answers by line index.
   The server rebuilds the plan from what is saved now and refuses with "start again" if it differs, so a roster edited
   in another tab cannot be confirmed blind. It then saves ONE new team order ("Reorder of <label>") on the same design
   through the existing `save_team_order`. No migration and no new table.
5. **Report.** The review shows the release reorder's own differences (`inputDifferences`, decision 0032) for the design
   version and the team list, and the design's validation (decision 0039): blockers and warnings against the profile,
   with the first blockers. Blockers do not stop a team list being made (a list is not an order to the factory); the screen
   says to fix them before the factory.
6. **Personal data.** Names appear only in the member's own response and are never logged, never put in the report, the
   fingerprint input leaves the server only as a hash, and nothing is stored beyond the team order the member asked for,
   which is erased by the existing paths. The report carries no name.

## Not done, and why

- **The print files are not rebuilt in this screen.** The release reorder needs today's pattern, fabric tests and print
  profile, which the app does not yet supply to any screen (`ReleasePanel` is given `inputs={null}`). The review says so in
  plain words (`NOT_COMPARED`) instead of presenting the design-version and team-list differences as the whole report.
- **Pre-filling a different season's sizes onto the earlier order's list** (rows from the order with sizes from a season)
  is not offered; choosing a season uses that season's players and sizes.
- **No release is made.** Freezing a release stays with the release flow.

## Evidence

| Claim | Test |
|---|---|
| Players map to lines, removed sizes, left players and missing numbers are flagged, not dropped | `lib/clubs/reorder/plan.test.ts` |
| Every line needing a fix must be answered; leave-out and keep work | `resolve.test.ts`, `components/club/reorder/model.test.ts` |
| The report names design version and team list changes without names | `report.test.ts` |
| Preview and confirm, stale plan refused, nothing saved without answers | `use-cases.test.ts` |
| Two clicks when nothing changed; a removed size and a player who left need answers | `e2e/club-reorder.spec.ts` |

## Not verified

The end-to-end spec was written without a browser or Supabase available in the cloud sandbox; CI is its first run.

## Owner questions

1. Should a reorder of a design whose version moved on use the old version or the current one? It uses the current one
   today and the report says the version differs.
2. Should blockers from validation stop the reorder, or only the order to the factory (today only the latter)?
3. Which season should be the default when several have players: the newest (today), or the one named in the release?
