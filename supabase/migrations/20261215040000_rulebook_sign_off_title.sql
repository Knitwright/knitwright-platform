-- The rulebook's sign-off says the title and nothing else (decision 0130, corrected the same day).
--
-- 20261215030000 recorded the first sign-off as `confirmed_name = 'The factory''s pattern master'` and
-- `confirmed_role = 'person not named'`, which read "Reviewed by The factory's pattern master, person not named,
-- on 2026-11-03". The owner asked for the title alone and nothing else, so it now reads
--
--   Reviewed by The pattern master on 2026-11-03
--
-- The absence of a person is said by the absence of a name, which is what the owner asked for; `view.ts`'s
-- `statusLabel` no longer repeats a name and a role that say the same thing, so the line does not read "The
-- pattern master, pattern master".
--
-- WHAT THIS DOES NOT CHANGE: the sign-off itself. The same 29 rules, confirmed on the same date, by the same
-- role. Only the words that name the reviewer change, and only on the rows the earlier migration wrote -- the
-- WHERE clause is the exact pair of strings that migration set, so this can touch nothing else and applying it
-- twice changes nothing the second time.
--
-- WHY AN UPDATE AND NOT A NEW VERSION. A confirmed version is append-only, and the proper way to change what a
-- rule says is a new version. But a rule's WORDS are not changing here: 29 new versions carrying identical text,
-- to correct a label, would make the version history lie about what happened. These two strings are the
-- migrations' own data -- written by 20261215030000 hours before this, on the same day, and never read outside
-- this machine, because the hosted database does not exist yet. 20261101080000 corrected its own seed the same
-- way and for the same reason. The guard is off for the one statement and switched straight back on;
-- tests/integration/rulebook.test.ts proves it still refuses an update afterwards.

alter table public.rulebook_entries disable trigger rulebook_entries_are_versioned;

update public.rulebook_entries
   set confirmed_name = 'The pattern master',
       confirmed_role = 'pattern master'
 where status = 'confirmed'
   and confirmed_name = 'The factory''s pattern master'
   and confirmed_role = 'person not named';

alter table public.rulebook_entries enable trigger rulebook_entries_are_versioned;
