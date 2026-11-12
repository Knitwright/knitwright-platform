# 0136: Names are swept into the erasure register, old rosters are purged daily, and the library seeds in one command

Status: Accepted (plan v6 D5, 2026-11-12)
Index: Accepted; the erasure sweep reads name columns, rosters older than two seasons are purged by a daily cron, and `pnpm --filter web seed:templates` seeds the whole library
Index title: Privacy and deploy housekeeping
Date: 2026-11-12
Plan step: v6 wave 0, workstream D5. Migration `20261220020000_roster_retention.sql`.

## Context

The v6 gap audit listed three defects: the erasure register missed five tables, nothing purged rosters, and template
seeding was not in the deploy path.

## Decisions

### 1. The erasure register's sweep reads names, not only addresses

The five Z7 tables (`committee_pins`, `committee_votes`, `committee_approvals`, `roster_signup_requests`,
`roster_signup_entries`) had already been registered by the v5 security review (H1). The gap that remained was the
sweep: it failed only for an unregistered **email or phone** column, so a table holding a person's **name** could
merge unnoticed. It now treats any `name` or `*_name` text column, in a `create table` or an `add column`, as a
person's name until `lib/deletion/team-data.ts` says otherwise. Every such table is registered, exempt with a reason
(`PERSONAL_DATA_OUTSIDE_THE_REGISTER`), or listed as naming only things (`NAMES_OF_THINGS`).

It found two unregistered tables, both already removed with their design or brand through their keys:
`share_responses` (the name a share-link visitor typed) and `pattern_reviews` (the technician's name). Both are now
registered. Two more are exempt with reasons: `designer_profiles` (goes with the person's account) and
`rulebook_entries` (the platform's rulebook names its reviewer; it belongs to no brand).

### 2. Rosters older than two seasons are purged by a daily cron

Spec `05` security and `03`: "rosters older than 2 seasons are purged unless the club opts in". A season's roster
is past keeping when its club has **two newer seasons** (by start date, else the day it was made), or when it
**ended more than two years ago** (end date, else start date, else the day it was made). The second rule stops a
club that never makes another season from keeping its last roster for ever. Both numbers are
`private.roster_seasons_kept()` and `private.roster_years_kept()`, in the idiom of `private.club_seasons_limit()`.

`purge_old_rosters(p_now, p_brand_id)` removes that season's players, sign-up requests, sign-up answers and sign-up
links, and stamps `club_seasons.roster_purged_at`. The season itself stays: it names nobody. It is idempotent and
callable by the server's key only. `app/api/cron/roster-purge` runs it daily (03:30 UTC, `vercel.json`) behind the
deploy's `CRON_SECRET`, the door decision 0100 built: 503 without a secret, 404 for a wrong one. No new setting.

**The opt-in** is `club_roster_retention.keep_old_rosters`, set by `set_roster_retention` (owner or admin only).
**It has no screen yet.** The toggle belongs on the club's team settings, which v6 P6 (Team, Brand, Settings)
rebuilds; until then no club has opted in, which is the spec's default.

### 3. One idempotent command seeds the whole library

`pnpm --filter web seed:templates` runs `lib/templates/seed/run.mts`, which runs `seedLibrary`: the starter
designs, then the kit bundles that name them, then the tech pack templates, then the marketing templates. Every
step upserts by slug and leaves reviewed rows alone. `lib/marketing/templates/run.mts` is removed. The command reads
`apps/web/.env.local` when it exists (`--env-file-if-exists`), and the hosted environment otherwise. It is named in
`docs/runbooks/supabase-hosted.md`, after `db push`. `tests/integration/seed-library.test.ts` runs it twice and
checks the rows are the same, ids included.

## Consequences

- **Owner question:** confirm the reading of "older than two seasons" above (two newer seasons, or ended more than
  two years ago), and whether a purge should tell the club first.
- P6 adds the opt-in toggle on the team settings screen; it calls `set_roster_retention`.
- No new dependency.
