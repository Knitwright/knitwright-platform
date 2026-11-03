# 0130: The rulebook's first sign-off names a role, because no person was given

Status: Accepted, with a correction of the same day in "What the line says". The owner signed off the 29 rules
that rest on Knitwright's own words or a published standard, as **the pattern master, with no person named**.
The line reads *"Reviewed by The pattern master on 2026-11-03"*: the owner asked for the title alone, so the
first recording's "person not named" was taken out and `statusLabel` no longer repeats a name and a role that
say the same thing. The 16 rules whose own Source column still defers to a factory, a supplier or a lawyer stay
drafts, and so does `R-GAP-000`. Owner question F3 stays open for the name.
Index: Accepted; the 29 rules Knitwright owns are signed off as "The pattern master" with no person named, and the 16 that defer stay drafts
Index title: The rulebook's first sign-off names a title, because no person was given
Date: 2026-11-03
Plan step: platform v5, review and hardening (`plans/platform-v5.md`). Carries out owner decision 14 and
answers the acting half of owner question F3, on the session built by decision 0129.
Migration: `20261215030000_rulebook_first_sign_off.sql`, corrected by
`20261215040000_rulebook_sign_off_title.sql`.

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

### 1. What the line says

**The correction, made the same day.** The sign-off was first recorded as
`confirmed_name = 'The factory''s pattern master'` with `confirmed_role = 'person not named'`, which read
*"Reviewed by The factory's pattern master, person not named, on 2026-11-03"*. Asked to look at it, the owner
said the title alone and nothing else. So:

| | `confirmed_name` | `confirmed_role` | What a reader sees |
|---|---|---|---|
| First recorded | `The factory's pattern master` | `person not named` | Reviewed by The factory's pattern master, person not named, on 2026-11-03 |
| **In force** | `The pattern master` | `pattern master` | **Reviewed by The pattern master on 2026-11-03** |

**The absence of a person is now said by the absence of a name**, which is the plainer way to say it and the
one the owner asked for. `statusLabel` gained one rule to make it read properly: where the name and the role
mean the same thing, allowing for the article in front of it, the line says it once — otherwise the record
would have read "The pattern master, pattern master", one word twice with nothing learned from the second. A
name and a role that differ are both still shown, so a person is never lost.

**Why an update and not a new version.** A confirmed version is append-only and the proper way to change what
a rule *says* is a new version — but no rule's words changed here. Twenty-nine new versions carrying identical
text, to correct a label, would make the version history lie about what happened. These two strings are the
migrations' own data, written hours earlier the same day and never read outside one machine, because the
hosted database does not exist yet; decision 0067's own follow-up migration corrected its seed the same way
and for the same reason. The guard is switched off for the one statement and straight back on, and the
statement can only match the exact pair of strings the first migration set.

### 2. What is written

The sign-off, in `20261215030000_rulebook_first_sign_off.sql`:

```sql
update public.rulebook_entries e
   set status = 'confirmed',
       confirmed_at = '2026-11-03T00:00:00Z'::timestamptz,
       confirmed_name = …, confirmed_role = …          -- the words of item 1
 where e.version = 1 and e.status = 'draft' and e.rule_id <> 'R-GAP-000'
   and e.source_note !~* '\mfactor(y|ies)\M|\msupplier\M|\mpartner\M|legal consult|\mlawyer\M|after a sample';
```

**Which rules, on what date, and by what role is the whole of the record**, and the correction of item 1 moved
none of it: the second migration's `WHERE` names the exact two strings the first one set, so it can reach
nothing but those rows and reaches them once.

`confirmed_by` stays null, because no account did this: a migration did, and the admin page shows "recorded
by" only when it knows who. Owner decision 14 wanted a confirmation to be auditable, and this one is: a role
signed these words off on a named day, and the line does not pretend a person did.

### 3. Which rules, and why not all 45

29 of them. The 16 the rulebook's own Source column still defers for stay drafts — "Factory to confirm their
RIP settings", "Knitwright draft; replace with factory block values", "Regulation trend; supplier
declaration", "Confirm with legal consult", "range approved only after a sample at each end" — as do
`R-GAP-000`, which stands in for a check with no rule and whose best practice is empty on purpose.

The predicate above is the same reading as `lib/rulebook/sign-off.ts`'s `waitsFor`, which is what the screen
offers ticked, and `lib/rulebook/first-sign-off.test.ts` reads both and fails if they ever select different
rules. Two readings in two languages that cannot import each other is exactly where a silent disagreement
would live.

### 4. Why a migration rather than the screen

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
