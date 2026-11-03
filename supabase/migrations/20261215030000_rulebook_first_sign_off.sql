-- The rulebook's first sign-off (plan v5; owner decision 14; owner question F3; decision 0130).
--
-- Every one of the 45 seeded rules has been a draft since the first migration, and owner decision 11 shows a
-- member only the words somebody has CONFIRMED -- so every "Why?" popover and every best-practice card in the
-- Studio said "Knitwright's rulebook has no best practice written for this yet" for all of them.
--
-- The owner signed off the rules Knitwright owns, and asked for the sign-off to be recorded as the factory's
-- pattern master with no individual named. Both are written as given:
--
--   confirmed_name = 'The factory''s pattern master'
--   confirmed_role = 'person not named'
--
-- which a member reads as "Reviewed by The factory's pattern master, person not named, on 2026-11-03". That
-- sentence says exactly as much as was given and no more: a role stands behind these words, and no person is
-- named. Owner decision 14 asked that a confirmation record the person; inventing one would have been worse
-- than saying plainly that none was given, and owner question F3 stays open for the name.
--
-- WHICH RULES. Not all 45. The rulebook's own Source column still defers for sixteen of them -- "Factory to
-- confirm their RIP settings", "Knitwright draft; replace with factory block values", "Regulation trend;
-- supplier declaration", "Confirm with legal consult", "range approved only after a sample at each end" -- and
-- owner decision 13 already took exactly this mistake out of the `source` column: a request is not a statement,
-- and recording one as a sign-off credits a review nobody did. Those sixteen stay drafts. `R-GAP-000` stays a
-- draft too: it stands in for a check with no rule behind it, and a sign-off on "No rule written yet" would be
-- a sign-off on nothing.
--
-- The predicate below is the same reading as `apps/web/lib/rulebook/sign-off.ts`'s `waitsFor`, which is what the
-- sign-off screen offers ticked. `lib/rulebook/first-sign-off.test.ts` reads this file and that module and fails
-- if the two ever select different rules; `tests/integration/rulebook.test.ts` checks the rows this leaves.
--
-- No schema changes. The append-only guard of 20261101020000 is left ON: a draft becoming confirmed is the one
-- update it allows, so this goes through it exactly as the screen's own confirmation does, and no row's words,
-- scope or source is touched. `confirmed_by` stays null on purpose -- no account recorded this, a migration did,
-- and the admin page shows "recorded by" only when it knows.

update public.rulebook_entries e
   set status = 'confirmed',
       confirmed_at = '2026-11-03T00:00:00Z'::timestamptz,
       confirmed_name = 'The factory''s pattern master',
       confirmed_role = 'person not named'
 where e.version = 1
   and e.status = 'draft'
   and e.rule_id <> 'R-GAP-000'
   -- Waits for somebody who has not spoken. `\m` and `\M` are Postgres's word boundaries, and `!~*` is a
   -- case-insensitive "does not match".
   and e.source_note !~* '\mfactor(y|ies)\M|\msupplier\M|\mpartner\M|legal consult|\mlawyer\M|after a sample';
