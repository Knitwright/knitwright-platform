# 0130: The rulebook's first sign-off names a role, because no person was given

Status: Accepted. The owner signed off the 29 rules that rest on Knitwright's own words or a published
standard, and asked for the sign-off to be recorded as the factory's pattern master with **no individual
named**. It is recorded exactly as given — `confirmed_name = 'The factory's pattern master'`,
`confirmed_role = 'person not named'` — so a member reads *"Reviewed by The factory's pattern master, person
not named, on 2026-11-03"*. The 16 rules whose own Source column still defers to a factory, a supplier or a
lawyer stay drafts, and so does `R-GAP-000`. Owner question F3 stays open for the name.
Index: Accepted; the 29 rules Knitwright owns are signed off as the factory's pattern master with no person named, and the 16 that defer stay drafts
Index title: The rulebook's first sign-off names a role, because no person was given
Date: 2026-11-03
Plan step: platform v5, review and hardening (`plans/platform-v5.md`). Carries out owner decision 14 and
answers the acting half of owner question F3, on the session built by decision 0129.
Migration: `20261215030000_rulebook_first_sign_off.sql`.

## Context

Decision 0129 built the sign-off session and confirmed nothing, because a confirmation records that a named
person read the words and no name had been given. Asked for one, the owner answered: **the pattern master,
and no name**.

That is a smaller answer than owner decision 14 asked for, and it is the owner's to give. What it leaves is
a choice about how to write it down, and only one of the options is honest.

- **Invent or borrow a name.** Never. The whole of owner decision 13 was that filing a request as the
  factory's word "implies a sign-off nobody gave"; a made-up person is that mistake with a face on it.
- **Put the role in the name field and leave the role field to match**, so it reads "Reviewed by the pattern
  master, pattern master". The database would take it. A reader would learn nothing from the second half and
  could not tell whether a person had been named or not.
- **Say both things: the role stood behind it, and no person was named.** This is what is recorded.

## Decision

### 1. What is written

```sql
update public.rulebook_entries e
   set status = 'confirmed',
       confirmed_at = '2026-11-03T00:00:00Z'::timestamptz,
       confirmed_name = 'The factory''s pattern master',
       confirmed_role = 'person not named'
 where e.version = 1 and e.status = 'draft' and e.rule_id <> 'R-GAP-000'
   and e.source_note !~* '\mfactor(y|ies)\M|\msupplier\M|\mpartner\M|legal consult|\mlawyer\M|after a sample';
```

`statusLabel` renders that, unchanged, as

> Reviewed by The factory's pattern master, person not named, on 2026-11-03

**The second half is the point.** Owner decision 14 wanted a confirmation to be auditable. This one says what
it is: a sign-off by a role, with the person left for later. A member can see that at a glance, and nothing
about it reads as more settled than it is.

`confirmed_by` stays null, because no account did this: a migration did, and the admin page shows "recorded
by" only when it knows who.

### 2. Which rules, and why not all 45

29 of them. The 16 the rulebook's own Source column still defers for stay drafts — "Factory to confirm their
RIP settings", "Knitwright draft; replace with factory block values", "Regulation trend; supplier
declaration", "Confirm with legal consult", "range approved only after a sample at each end" — as do
`R-GAP-000`, which stands in for a check with no rule and whose best practice is empty on purpose.

The predicate above is the same reading as `lib/rulebook/sign-off.ts`'s `waitsFor`, which is what the screen
offers ticked, and `lib/rulebook/first-sign-off.test.ts` reads both and fails if they ever select different
rules. Two readings in two languages that cannot import each other is exactly where a silent disagreement
would live.

### 3. Why a migration rather than the screen

The screen is the way this is done from now on, and it is where the other 16 will be signed off. But the
local database is reset routinely and the hosted one does not exist yet, so a sign-off made through the
screen today would be gone by tomorrow and would never reach production. A migration is the only form in
which a pre-launch fact survives — and it has the better audit trail besides: the pull request shows which 29
rules, in whose name, in one diff.

The append-only guard is left **on**. A draft becoming confirmed is the one update it allows, so this passes
through it exactly as the screen's own confirmation does, and no row's words, scope or source is touched.

## What changes for a person

Every "Why?" popover and best-practice card in the Studio showed "Knitwright's rulebook has no best practice
written for this yet" for all 45 rules. For 29 of them it now shows the rulebook's own words, with where they
came from and who stood behind them. For the other 16 it still says nothing is confirmed, which is true.

## Consequences

- `tests/integration/rulebook.test.ts` reads the expected status off each rule's own Source column rather
  than asserting one status for all 45, so it still says which rules should be signed off.
- `e2e/rulebook.spec.ts` covers the draft path on **R-SUB-003** (one of the sixteen) instead of R-SUB-004,
  which is now signed off, and asserts the signed-off line on R-SUB-004 as well. `e2e/editor-shell.spec.ts`
  already used R-CON-004, which waits for the factory, so it was unaffected.
- **Owner question F3 is not closed.** When the pattern master's name is known, the right move is a new
  version of each rule confirmed in that name — which is what the append-only table is for.
