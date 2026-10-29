-- Rulebook follow-up (plan v5, workstream X2b; owner decisions 11 to 14; decision 0067, revision of 2026-10-30).
--
-- Timestamp: the plan's assigned wave-1 slots run to ...070000. This takes the next free hour, ...080000, as the
-- plan's X2b section allows, and says so in the pull request.
--
-- What changes, and why:
--  * Decision 13, a source says who actually said it. A `supplier` source kind is added, "Supplier price lists,
--    May 2026" (R-COST-003) is refiled under it, and the nine rules whose source note only ASKS the factory for
--    something ("Factory to confirm...", "Factory to measure") stop being filed as `factory`: a request is not a
--    statement, and filing it as the factory's word implies a sign-off nobody gave. They become `knitwright`,
--    which is what the rulebook itself says it is (version 0.1, "draft for factory review"). `pattern_master`
--    stays unused while owner decision 10 holds: it means a real master pattern artifact, and none exists.
--  * Decision 12, shared rules are scoped to what their source covers. R-SUB, R-LAB, R-QC and R-COST came out of
--    one sublimated jersey's rulebook, so they carry the sublimation METHOD as their scope, not "every article",
--    with the scope field labelled "scope not reviewed by a factory". Two columns hold that: scope_methods and
--    scope_note. A factory widens a rule by confirming it with a wider scope in a new version.
--  * Decision 14, a confirmation records the person. confirmed_name and confirmed_role hold the factory person's
--    name and role; rulebook_entry_confirm now takes them and refuses a confirmation by nobody in particular.
--    The three-argument function is dropped, so no caller can confirm a rule anonymously.
--
-- Nothing in the earlier migration is edited. The seed rows the earlier migration wrote are corrected here, with
-- the append-only trigger switched off for those two statements only and switched straight back on: the seed is
-- the migrations' own data, not something a person wrote, and correcting it is what owner decisions 12 and 13
-- ask for. Every other write still goes through the SECURITY DEFINER functions, and the service role still holds
-- SELECT only. tests/integration/rulebook.test.ts asserts the guard is back on and still refuses an update.

-- ---------------------------------------------------------------------------------------------
-- Columns and constraints.

alter table public.rulebook_entries
  add column scope_methods text[] not null default '{}',
  add column scope_note text not null default '',
  add column confirmed_name text,
  add column confirmed_role text;

comment on column public.rulebook_entries.scope_methods is
  'Owner decision 12: the production methods a rule covers, e.g. {sublimation}. Empty with empty article_codes means the rule claims no scope (R-GAP-000).';
comment on column public.rulebook_entries.scope_note is
  'How far the scope has been checked, in plain words, e.g. "scope not reviewed by a factory".';
comment on column public.rulebook_entries.confirmed_name is
  'Owner decision 14: the name of the factory person who reviewed this version. Shown as "Reviewed by NAME, ROLE, on DATE".';

alter table public.rulebook_entries
  -- A handful of methods at most, none of them blank. The shape of a method name (a lowercase id) is checked
  -- where it is typed, in lib/rulebook/input.ts: a check constraint may only call immutable functions.
  add constraint rulebook_entries_scope_methods_are_ids
    check (coalesce(array_length(scope_methods, 1), 0) <= 8 and not ('' = any (scope_methods))),
  add constraint rulebook_entries_scope_note_length
    check (length(scope_note) <= 300);

-- A confirmed version names the person who reviewed it. NOT VALID so that a database which already holds a
-- version confirmed before this migration (only the R-TEST rows of the database tests; all 45 seeded rules are
-- drafts) is left as it is; every insert and every later update is checked.
alter table public.rulebook_entries
  add constraint rulebook_entries_confirmation_names_the_person
    check (
      (status = 'draft' and confirmed_name is null and confirmed_role is null)
      or (status = 'confirmed'
          and length(btrim(confirmed_name)) between 1 and 120
          and length(btrim(confirmed_role)) between 1 and 120)
    )
    not valid;

-- Decision 13: the fifth source kind. A supplier's price list is the supplier's word, not the factory's.
alter table public.rulebook_entries drop constraint rulebook_entries_source_check;
alter table public.rulebook_entries add constraint rulebook_entries_source_check
  check (source in ('factory', 'supplier', 'pattern_master', 'standard', 'knitwright'));

-- The new columns a signed-in member reads. Who RECORDED a confirmation (confirmed_by, an account) stays the
-- server's business; the factory person's name and role are the point of decision 14, so members read them.
grant select (scope_methods, scope_note, confirmed_name, confirmed_role) on public.rulebook_entries to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The append-only guard, with the new columns. A version's words, scope and source never change; the one change
-- allowed is a draft becoming confirmed (which is where the name and role are written), and the clearing of
-- created_by or confirmed_by when that account is erased.

create or replace function private.guard_rulebook_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nested, so NEW and OLD are read only for a row update (they are not set for a truncate).
  if tg_op = 'UPDATE' then
    if (new.id, new.rule_id, new.version, new.topic, new.article_codes, new.scope_methods, new.scope_note,
        new.title, new.rule, new.body, new.best_practice, new.source, new.source_note, new.created_at)
       is not distinct from
       (old.id, old.rule_id, old.version, old.topic, old.article_codes, old.scope_methods, old.scope_note,
        old.title, old.rule, old.body, old.best_practice, old.source, old.source_note, old.created_at) then
      if old.status = 'draft' and new.status = 'confirmed' and new.created_by is not distinct from old.created_by then
        return new;
      end if;
      if new.status = old.status and new.confirmed_at is not distinct from old.confirmed_at
         and new.confirmed_name is not distinct from old.confirmed_name
         and new.confirmed_role is not distinct from old.confirmed_role
         and (new.created_by is null or new.created_by = old.created_by)
         and (new.confirmed_by is null or new.confirmed_by = old.confirmed_by) then
        return new;
      end if;
    end if;
  end if;
  raise exception 'A rulebook version can never be changed or removed; save a new version instead.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.guard_rulebook_entry() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Saving a version now carries the scope (decision 12). The earlier signature is dropped, so a save cannot
-- leave the scope unsaid by calling the old one.

drop function public.rulebook_entry_save(uuid, text, text, text[], text, text, text, text, text, text);

create function public.rulebook_entry_save(
  p_actor uuid, p_rule_id text, p_topic text, p_article_codes text[], p_scope_methods text[], p_scope_note text,
  p_title text, p_rule text, p_body text, p_best_practice text, p_source text, p_source_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if p_actor is null or not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  -- Two saves of the same rule at once take turns, so each gets its own version number.
  perform pg_advisory_xact_lock(hashtext('rulebook:' || p_rule_id));
  select coalesce(max(e.version), 0) + 1 into v_version from public.rulebook_entries e where e.rule_id = p_rule_id;
  insert into public.rulebook_entries
    (rule_id, version, topic, article_codes, scope_methods, scope_note, title, rule, body, best_practice,
     source, source_note, created_by)
  values
    (p_rule_id, v_version, p_topic, coalesce(p_article_codes, '{}'), coalesce(p_scope_methods, '{}'),
     coalesce(p_scope_note, ''), p_title, p_rule, p_body, p_best_practice, p_source, coalesce(p_source_note, ''),
     p_actor);
  return v_version;
end;
$$;

revoke all on function public.rulebook_entry_save(uuid, text, text, text[], text[], text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.rulebook_entry_save(uuid, text, text, text[], text[], text, text, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------------------------
-- Confirming names the factory person (decision 14). A confirmation by nobody in particular is refused, and the
-- anonymous three-argument function is gone.

drop function public.rulebook_entry_confirm(uuid, text, integer);

create function public.rulebook_entry_confirm(
  p_actor uuid, p_rule_id text, p_version integer, p_name text, p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_role), '') = '' then
    raise exception 'Write the name and role of the factory person who reviewed the rule.'
      using errcode = 'P0001', hint = 'confirmation_names_the_person';
  end if;
  if not exists (select 1 from public.rulebook_entries e where e.rule_id = p_rule_id and e.version = p_version) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  update public.rulebook_entries
     set status = 'confirmed', confirmed_by = p_actor, confirmed_at = now(),
         confirmed_name = btrim(p_name), confirmed_role = btrim(p_role)
   where rule_id = p_rule_id and version = p_version and status = 'draft';
end;
$$;

revoke all on function public.rulebook_entry_confirm(uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.rulebook_entry_confirm(uuid, text, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- The seed, corrected. The guard is off for these two statements only (see the head of this file).

alter table public.rulebook_entries disable trigger rulebook_entries_are_versioned;

-- Decision 12. The four families the rulebook calls "shared by every sublimated article" are scoped to the
-- sublimation method, and the scope says it has not been reviewed. lib/rulebook/scope.ts holds the same words.
update public.rulebook_entries e
   set scope_methods = array['sublimation'], scope_note = 'scope not reviewed by a factory'
 where e.version = 1
   and split_part(e.rule_id, '-', 2) in ('SUB', 'LAB', 'QC', 'COST');

-- Decision 13. The source note of each rule is unchanged, word for word; only the kind it is filed under moves.
-- lib/rulebook/sources.ts reads the same notes the same way, and lib/rulebook/reseed.test.ts compares the two.
update public.rulebook_entries e
   set source = v.source
  from (values
    ('R-CON-004', 'knitwright'),  -- "Factory to confirm rib source"
    ('R-CON-005', 'knitwright'),  -- "Factory to confirm"
    ('R-CON-006', 'knitwright'),  -- "Factory to confirm"
    ('R-CON-008', 'knitwright'),  -- "Factory to confirm"
    ('R-SUB-003', 'knitwright'),  -- "Factory to confirm their RIP settings"
    ('R-SUB-005', 'knitwright'),  -- "Factory to confirm the tolerance they can hold"
    ('R-SUB-006', 'knitwright'),  -- "Factory to measure"
    ('R-SUB-008', 'knitwright'),  -- "Factory to confirm"
    ('R-COST-003', 'supplier')    -- "Supplier price lists, May 2026; replace with partner quote"
  ) as v(rule_id, source)
 where e.rule_id = v.rule_id and e.version = 1 and e.source <> v.source;

alter table public.rulebook_entries enable trigger rulebook_entries_are_versioned;
