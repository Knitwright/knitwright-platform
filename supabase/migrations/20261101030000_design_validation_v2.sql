-- Design object v2 and validation (plans/platform-v5.md, workstream X4; decision 0069; spec F-0).
--
-- Two changes, both on top of 20261025010000_design_validation.sql:
--
--   1. A design version can now be 'approved': a member of the brand accepted that version for
--      ordering. The states are draft -> validated -> approved -> ordered (spec F-0). An approved
--      version can only go on to be ordered; a draft still cannot be ordered, and now cannot be
--      approved either. The app (lib/validation/status.ts) and this file both refuse the rest.
--
--   2. validation_results holds what validate() found for one design version against one factory
--      profile: every check with its code, severity, message, target and rulebook rule id, and
--      whether the check passed (spec 03-data-model, validation_result; spec decision 11). Two
--      scopes: 'save' is written on every save and leaves out the tech pack's readiness list, which
--      needs the whole tech pack; 'full' is written when a person records a status and includes it.
--      One row per version, profile and scope: a later run of the same scope replaces it, because a
--      version never changes but the profile and the rulebook do.
--
-- Members read their brand's rows. No browser writes anything: record_validation_result is the only
-- way in, and only the server's own key may run it.

alter table public.design_statuses drop constraint design_statuses_status_check;

alter table public.design_statuses add constraint design_statuses_status_check
  check (status in ('draft', 'validated', 'approved', 'ordered'));

comment on column public.design_statuses.status is
  'draft, validated (no blockers against one profile on one date), approved (the brand accepted it for ordering) or ordered.';

-- Refuses a move the app would refuse. An ordered version never moves; an approved one only goes on
-- to ordered; a draft is neither ordered nor approved before it has been checked against a profile.
create or replace function private.refuse_illegal_status_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'ordered' then
    raise exception 'An ordered version can never change its status.' using errcode = 'P0001', hint = 'status_ordered';
  end if;
  if old.status = 'approved' and new.status <> 'ordered' then
    raise exception 'A version accepted for ordering can only be ordered.' using errcode = 'P0001', hint = 'status_approved';
  end if;
  if old.status = 'draft' and new.status in ('ordered', 'approved') then
    raise exception 'A draft cannot be ordered or accepted for ordering.' using errcode = 'P0001', hint = 'status_move';
  end if;
  return new;
end;
$$;

-- Sets the status of one version of a design. Only the server's own key may run it; it has already
-- run the validation. A draft clears the profile and the hash. Ordering or accepting a version that
-- has no status row yet is refused: it has not been checked against a profile.
create or replace function public.set_design_status(
  p_project_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_version integer,
  p_status text,
  p_profile_id text,
  p_findings_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if p_status in ('ordered', 'approved') and not exists (
    select 1 from public.design_statuses d
    where d.project_id = p_project_id and d.version = p_version and d.brand_id = p_brand_id
  ) then
    raise exception 'A draft cannot be ordered or accepted for ordering.' using errcode = 'P0001', hint = 'status_move';
  end if;
  if p_status = 'draft' then
    p_profile_id := null;
    p_findings_hash := null;
  end if;
  insert into public.design_statuses (project_id, brand_id, version, status, profile_id, findings_hash, changed_by)
  values (p_project_id, p_brand_id, p_version, p_status, p_profile_id, p_findings_hash, p_user_id)
  on conflict (project_id, version) do update
    set status = excluded.status,
        profile_id = excluded.profile_id,
        findings_hash = excluded.findings_hash,
        changed_at = now(),
        changed_by = excluded.changed_by
    where public.design_statuses.brand_id = p_brand_id;
end;
$$;

create table public.validation_results (
  project_id uuid not null,
  brand_id uuid not null,
  version integer not null check (version >= 1),
  -- The factory profile the design was judged against. Plain text, not a foreign key, as in design_statuses.
  profile_id text not null check (length(profile_id) between 1 and 64),
  scope text not null check (scope in ('save', 'full')),
  -- [{ code, severity: blocker|warning|null, message, target: {article, panel}, ruleId, passed }].
  -- Checked by the app: validationCheckSchema in lib/validation/check.ts.
  checks jsonb not null check (jsonb_typeof(checks) = 'array' and pg_column_size(checks) < 65536),
  -- True when no check of severity blocker failed. Nothing is said about warnings.
  passed boolean not null,
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users (id) on delete set null,
  primary key (project_id, version, profile_id, scope),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  foreign key (project_id, version) references public.spec_versions (project_id, version) on delete cascade
);

comment on table public.validation_results is
  'What validate() found for one design version against one factory profile. Written by record_validation_result only.';

create index validation_results_brand_idx on public.validation_results (brand_id, project_id, version);

revoke all on public.validation_results from public, anon, authenticated, service_role;
grant select on public.validation_results to authenticated, service_role;

alter table public.validation_results enable row level security;

create policy "members read their brand's validation results"
  on public.validation_results for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on purpose.

-- Stores what the app found. Only the server's own key may run it. A second run of the same scope
-- for the same version and profile replaces the row: the version never changes, the rulebook does.
create function public.record_validation_result(
  p_project_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_version integer,
  p_profile_id text,
  p_scope text,
  p_checks jsonb,
  p_passed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  insert into public.validation_results (project_id, brand_id, version, profile_id, scope, checks, passed, checked_by)
  values (p_project_id, p_brand_id, p_version, p_profile_id, p_scope, p_checks, p_passed, p_user_id)
  on conflict (project_id, version, profile_id, scope) do update
    set checks = excluded.checks,
        passed = excluded.passed,
        checked_at = now(),
        checked_by = excluded.checked_by
    where public.validation_results.brand_id = p_brand_id;
end;
$$;

revoke all on function public.record_validation_result(uuid, uuid, uuid, integer, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.record_validation_result(uuid, uuid, uuid, integer, text, text, jsonb, boolean) to service_role;
