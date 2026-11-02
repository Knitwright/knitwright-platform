# 0109: Security review of plan v5 (R1), and the four guards it repaired

Status: Proposed. The review is written (`docs/reviews/security-v5.md`): no CRITICAL, four HIGH, fourteen MEDIUM, twenty-one
LOW. Five findings are fixed here with failing-first tests; the four HIGH findings are deferred with owner questions,
because each changes another workstream's design.
Index: Proposed; v5 reviewed — the garment lock is enforced on topology but not on provenance, two moderation hook points were never wired, five guard gaps fixed, owner questions listed
Index title: Security review of plan v5
Date: 2026-11-02
Plan step: `plans/platform-v5.md`, wave 5, R1. Builds on decision 0023 (launch hardening) and the previous review
`docs/reviews/security-v4.md`.
Migration: none.

## Context

All thirty v5 workstreams are merged. R1 reviews the finished platform against the plan's own rules: row level security
and grants table by table, every new Postgres function's `revoke`, the public unauthenticated surface, erasure, secrets
and the client boundary, plus the garment lock, the credit ledger and moderation.

The v5 database work came out well, and that is worth recording because it is the part a review is most likely to find
fault with. Of 91 new tables, every one has row level security on; every one is in the isolation suite's lists; **not one
brand-scoped table was filed in a list whose test lets another member read it**; all 153 new functions are revoked from
`public, anon, authenticated` with a fixed `search_path`; and **the browser-callable surface did not grow at all** —
`CALLABLE` in `isolation.test.ts` is unchanged from v4. The fault L3 lost a CI round to (a new function being executable
by `PUBLIC` until revoked) did not recur anywhere. Only one production dependency question arose, and the answer was
none: v5 added a single devDependency, `ajv` 8.17.1 (MIT).

## Decision

**The findings are concentrated in the guards, not in the new code.** Three of the four invariants this review leaned on
had a blind spot that had already let a real fault through, and a fourth asserts nothing at all about the server's own
key. That is the shape of the review, and it is why four fixes here change tests rather than product code:

1. **`LIBRARY_TABLES` in `isolation.test.ts` was a list with nothing behind it.** Naming a table there satisfied "has a
   test below for every table" and the privilege check, and ran no test. The privilege check is no substitute: it asks
   `anon` and `authenticated` together and merges the answers, so `grant select … to anon` on one of those twelve tables
   would read exactly like `to authenticated`. Anon is now asked directly.
2. **The client-boundary test covered 175 of 279 client components** and did not look for `sharp`, `server-only` or a Node
   builtin — it names six heavy libraries, reads only `components/` and never `app/`, and excludes nine directories
   outright. A second rule now covers every `"use client"` file in both trees with no exclusion list, follows
   `import("…")`, and reads the bare `import "server-only"` form the old `from "…"` anchor could never see. Nothing in
   the tree breaks it, which was established by walking the full transitive graph of all 279 files: the `sharp` chain the
   launch-panels workstream hunted by hand is **not reproducible at this commit**, so it is recorded as fixed-before-this
   rather than as a live finding.
3. **The erasure register's test read a fixed list of six migrations**, so a personal-data table added by a migration
   nobody listed was invisible. Ten were: Z7's nine committee and roster sign-up tables and Y8's `share_invites`, three
   of them holding an email address or a phone number belonging to someone with no account. The cascades always worked
   and a database test proves it, so this was a register fault and not data surviving an erasure — but the register is
   what an erasure request is answered from. The test now sweeps **every** migration for a column holding an address and
   requires each table to be registered or exempted with a reason.
4. **`/join/:token` was the one token page with no header rule and no log scrubbing.** It was in the public list but in
   neither of the two places that protect a token page, so a roster sign-up token left the server in clear text in any
   log line or monitoring payload carrying an address — unlike `/s/` and `/job/`, which have both. Both added; the header
   test now runs over every token page.

**The garment lock is enforced on topology, not on provenance, and that is the review's headline.** The lock asks three
questions. Two are answered server-side and are airtight: the board's kind is immutable after insert, and the upstream
walk over `board_edges` handles multi-hop chains — six enforcement points in all, and all four write orderings were tried
on paper without getting through. The third question, *did this file come out of a model?*, is answered by
`asset.provenance`, a string in the request body, and `public.files` holds no column that could answer it instead: a
deterministic mockup and an AI lifestyle image are both stored as `kind: "render"`. So a member with `manageKit` can hand
the platform a generated file, call it deterministic, and all six checks agree. **No factory print file is reachable this
way today** — the print builder reads artwork only from `user_artworks` — and no tenant boundary is crossed. What it
defeats is the platform's own promise: the mandatory "AI-generated" label on the Store hand-off is computed from graph
topology, so it comes out `null`, and the record the lock keeps is falsified for any future consumer.

That root cause is left for the owner rather than patched here, because the fix — `provenance` on `public.files`, set at
every store site and read by `set_launch_board_output` — touches every workstream that stores a file. Three downstream
instances share it and are listed in the review: `add_golden_sample_photo` accepting any of the brand's files as a
photograph, the marketing lock running only in the browser, and `savePanelLayersAction` skipping
`refuseUnreadableArtwork`.

**Moderation was built and largely not wired.** `screenGeneration`, `screenBeforeOrder` and `assertHumanReviewed` have
zero production callers: one upload path of about eight is covered, no generation path and no order path. This is plan
task 4's deliberate minimum with wave 2's wiring never done, so it is reported as owed work rather than as a defect in
X8, whose machinery is sound. The sharpest instance is that the spec's one explicitly named block rule — "dupe",
"inspired by <brand>" — is fully implemented in `lib/moderation/text.ts` and never called.

**The credit ledger is sound; the risk is in the keys.** Refunds are once-only by constraint and nothing in the tree
refunds twice. But a shoot's idempotency key is truncated to 200 characters, so padding a prompt makes paid shoots free;
a retried flow run mints a new run id and charges a whole pack again; and the charge multiplier is a client-written
`settings.count`. All latent while `CREDITS_ENFORCED` is off, which is the argument for fixing them now.

**One invariant is recommended and deliberately not landed here.** `public.security_report` reports privileges for `anon`
and `authenticated` only, so nothing asserts what the server's own key may do to any table — the one check in R1's brief
the codebase cannot make for itself. It was done by hand instead, simulating every grant and revoke in migration order:
the server's key holds more than `select` on 54 of 162 tables, **none of them a brand-scoped v5 table**, and no v5 table
is missing its `revoke` (which matters, because Supabase's default privileges grant `service_role` everything on a new
public table). Landing the invariant means a migration plus 54 entries in the repository's most conflict-prone shared
file, written without being able to run it locally, so it is an owner/orchestrator decision. The 54-name list is in the
review as the evidence to start from.

## Consequences

- `docs/reviews/security-v5.md` is the record. Five fixes land here; everything else is listed with a severity, a file and
  line, what an attacker could actually do, and either an owner question or the orchestrator.
- Three guards are stricter than they were, and one of them earned its keep immediately: the obvious one-line fix to the
  shoots idempotency key (hash instead of slice) would have put `node:crypto` in a module three client components import
  through a barrel, which the widened rule now refuses.
- No migration was added, so no timestamp was claimed and nothing else in flight can conflict on one.
- Every v4 finding was re-checked. All sixteen fixes are still in place. v4's L3 is **partly reopened**: eight
  environment variables, three of them real third-party credentials, bypass `lib/config/env.ts` and `.env.example` again.
  v4's M2, L5 and L16 remain the owner's, and H4 now makes M2 answerable.

## Owner questions

1. **H1.** Add a `provenance` column to `public.files` now, or derive provenance server-side from the board kind as an
   interim? Until one lands, "AI never draws the garment" is enforced on topology only.
2. **H3.** Is the wave-2 moderation wiring now wave-6 work with a date, or is the single delivered upload path the
   accepted scope for launch? And should an unscreened target block "Ready for the factory", or only warn?
3. **H4.** Confirm that a viewer may not spend credits — `20261201030000_flow_runs.sql:692-695` already assumes so — and
   `credit_spend` can be brought into line. This is v4's M2.
4. **M5.** Land the `server_privileges` invariant now, or in wave 6?
5. **M6.** Is "every club on the platform" the intended answer for `/api/store/team-stores`, or should it be gated on a
   hand-off like the other four endpoints?
6. **M8.** How long is a takedown notice kept, and who may read the reporter's name and address?
7. **M13.** Is flows charging regardless of `CREDITS_ENFORCED` deliberate?
8. **L2.** Revoke the unused `delete` grant on `share_invites`, `share_links` and `share_responses`?
9. **L16.** With no vision provider configured, is an image upload clear, or flagged for a person to look at?
10. **L18.** The Store contract promises that a name the Store takes "is screened again by Knitwright before it reaches a
    print file". Implement the screen, or correct the sentence?

## Rule ids

None. This review adds no validation finding, parameter range, option or tech-pack field, so it claims no `R-` id and
leaves no `R-GAP-000` entry.
