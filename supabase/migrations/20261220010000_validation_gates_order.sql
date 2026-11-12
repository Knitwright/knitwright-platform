-- Validation gates ordering (plans/platform-v6.md, workstream D1; decision 0132; spec F-0, F-T7).
--
-- Spec F-0: validate() "runs on every save and blocks ordering or export on any error", and "status
-- moves draft -> validated -> approved -> ordered. Editing an ordered version creates a new draft."
-- Spec F-T7: "100% of placed orders validate against a factory profile before ops sees them."
--
-- Until now public.submit_order_for_production -- the one door every order goes through, the
-- brand run, the make flow's sample and run, and the Store -- checked sizes and the release and
-- nothing else. A design whose own validation had blockers reached ops, and no version was ever
-- marked `ordered`: nothing called set_design_status with it (lib/credits-gate/server.ts said so).
--
-- Two changes, both inside that one function so no path can go round them:
--
--   1. The release names the design version it froze (`snapshot.specVersion`). The newest stored
--      validation result of that version against the order's factory profile must not have failed:
--      a result with `passed = false` (a blocker among its checks) refuses the order with hint
--      `validation_blockers`. The newest, not any: the app runs the checks again immediately before
--      every order it sends and stores them (lib/make/order-checks.ts), so the newest row is what the
--      person was just told, and an older row the rulebook has since moved on from does not decide.
--
--      A version with no stored result at all is let through, unchanged from before. Every save
--      stores one and every app order path stores a fresh one first, so this only reaches a caller
--      that bypasses the app with the server's key (the database tests, and the Store's contract of
--      decision 0043). Whether that must also be refused is owner question D1-1 of decision 0132.
--
--   2. Once the order is written, that version is marked `ordered` (private.mark_version_ordered).
--      A version with no status row gets one; a validated or approved one moves on; a version that
--      had been put back to draft is recorded as validated against this profile first, because it has
--      just passed the gate, and then ordered. The trigger refuse_illegal_status_move is untouched and
--      still refuses every move out of `ordered`. Editing never changes a version: a save writes a new
--      one, which has no status row and so is a draft -- which is the spec's "creates a new draft".
--
-- Nothing else about the function changes: the same arguments, checks, errors, idempotency on the
-- external reference and grants.

-- Marks one design version ordered against a profile. Run only from submit_order_for_production.
create function private.mark_version_ordered(p_project_id uuid, p_brand_id uuid, p_version integer, p_profile_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  insert into public.design_statuses (project_id, brand_id, version, status, profile_id, findings_hash, changed_by)
  values (p_project_id, p_brand_id, p_version, 'ordered', p_profile_id, null, null)
  on conflict (project_id, version) do nothing;
  if found then
    return;
  end if;

  select d.status into v_status
  from public.design_statuses d
  where d.project_id = p_project_id and d.version = p_version and d.brand_id = p_brand_id
  for update;
  if not found or v_status = 'ordered' then
    return;
  end if;

  if v_status = 'draft' then
    update public.design_statuses d
    set status = 'validated', profile_id = p_profile_id, changed_at = now(), changed_by = null
    where d.project_id = p_project_id and d.version = p_version;
  end if;

  update public.design_statuses d
  set status = 'ordered', profile_id = coalesce(d.profile_id, p_profile_id), changed_at = now(), changed_by = null
  where d.project_id = p_project_id and d.version = p_version;
end;
$$;

revoke all on function private.mark_version_ordered(uuid, uuid, integer, text) from public, anon, authenticated, service_role;

-- THE CONTRACT with the Store. See docs/decisions/0043-ops-console-batches.md and 0132.
-- Idempotent on p_external_ref: the same reference with the same release answers with the order already
-- there (created = false); with another release it is refused (hint external_ref_conflict).
create or replace function public.submit_order_for_production(
  p_release_id uuid,
  p_external_ref text,
  p_factory_profile_id text,
  p_fabric_key text,
  p_article_id text,
  p_sizes jsonb,
  p_value_minor bigint default null,
  p_currency text default null
)
returns table (
  order_id uuid,
  status text,
  cutoff_at timestamptz,
  promised_on date,
  lead_time_days integer,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release public.production_releases;
  v_existing public.ops_orders;
  v_new public.ops_orders;
  v_pieces integer := 0;
  v_cutoff timestamptz;
  v_lead integer;
  v_size record;
  v_bad boolean;
  v_version integer;
  v_passed boolean;
begin
  if p_external_ref is null or length(btrim(p_external_ref)) not between 1 and 120
     or p_factory_profile_id is null or length(btrim(p_factory_profile_id)) not between 1 and 120
     or p_fabric_key is null or length(btrim(p_fabric_key)) not between 1 and 120
     or p_article_id is null or length(btrim(p_article_id)) not between 1 and 120 then
    raise exception 'The order needs a reference, a factory, a fabric and an article of up to 120 characters each.'
      using errcode = '22023', hint = 'invalid_input';
  end if;

  if p_sizes is null or jsonb_typeof(p_sizes) <> 'object' then
    raise exception 'Sizes must be an object of 1 to 40 size labels.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  if (select count(*) from jsonb_object_keys(p_sizes)) not between 1 and 40 then
    raise exception 'Sizes must be an object of 1 to 40 size labels.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  for v_size in select key, value from jsonb_each(p_sizes) loop
    v_bad := length(v_size.key) not between 1 and 16 or v_size.key <> btrim(v_size.key)
      or case
           when jsonb_typeof(v_size.value) <> 'number' then true
           when (v_size.value #>> '{}') !~ '^[0-9]+$' then true
           else (v_size.value #>> '{}')::numeric not between 1 and 99999
         end;
    if v_bad then
      raise exception 'Each size needs a label of up to 16 characters and a whole number of pieces from 1 to 99999.'
        using errcode = '22023', hint = 'invalid_sizes';
    end if;
    v_pieces := v_pieces + (v_size.value #>> '{}')::integer;
  end loop;

  if (p_value_minor is null) <> (p_currency is null) or p_value_minor < 0
     or (p_currency is not null and p_currency !~ '^[A-Z]{3}$') then
    raise exception 'A value is a non-negative amount in minor units with its three-letter currency, or neither.'
      using errcode = '22023', hint = 'invalid_value';
  end if;

  select * into v_release from public.production_releases r where r.id = p_release_id;
  if not found then
    raise exception 'That release does not exist.' using errcode = 'P0002', hint = 'release_not_found';
  end if;

  select * into v_existing from public.ops_orders o where o.external_ref = btrim(p_external_ref);
  if found then
    if v_existing.release_id <> p_release_id then
      raise exception 'That reference already belongs to another release.' using errcode = 'P0001', hint = 'external_ref_conflict';
    end if;
    return query select v_existing.id, v_existing.status, v_existing.cutoff_at, v_existing.promised_on, v_existing.lead_time_days, false;
    return;
  end if;

  -- The design version the release froze, when its snapshot names one that was saved.
  if (v_release.snapshot ->> 'specVersion') ~ '^[0-9]{1,9}$' then
    v_version := (v_release.snapshot ->> 'specVersion')::integer;
    if not exists (
      select 1 from public.spec_versions sv where sv.project_id = v_release.project_id and sv.version = v_version
    ) then
      v_version := null;
    end if;
  end if;

  -- Spec F-0: no order of a version whose newest check against this factory found a blocker.
  if v_version is not null then
    select vr.passed into v_passed
    from public.validation_results vr
    where vr.project_id = v_release.project_id and vr.version = v_version and vr.profile_id = btrim(p_factory_profile_id)
    order by vr.checked_at desc, vr.scope asc
    limit 1;
    if found and not v_passed then
      raise exception 'This design has blockers against the factory profile. Clear them in the Factory file before it is ordered.'
        using errcode = 'P0001', hint = 'validation_blockers';
    end if;
  end if;

  v_cutoff := private.next_cutoff(now());
  select s.lead_time_days into v_lead from public.ops_settings s where s.id;

  insert into public.ops_orders as o (
    release_id, brand_id, project_id, external_ref, factory_profile_id, fabric_key, article_id,
    sizes, pieces, value_minor, currency, release_snapshot, cutoff_at, lead_time_days, promised_on
  ) values (
    p_release_id, v_release.brand_id, v_release.project_id, btrim(p_external_ref), btrim(p_factory_profile_id),
    btrim(p_fabric_key), btrim(p_article_id), p_sizes, v_pieces, p_value_minor, p_currency,
    jsonb_build_object(
      'label', v_release.label,
      'number', v_release.number,
      'rosterHash', v_release.snapshot -> 'rosterHash',
      'files', jsonb_array_length(coalesce(v_release.snapshot -> 'files', '[]'::jsonb))
    ),
    v_cutoff, v_lead,
    case when v_lead is null then null else ((v_cutoff at time zone 'UTC')::date + v_lead) end
  ) returning o.* into v_new;

  insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, promised_on, note)
  values (v_new.id, v_new.brand_id, 'submitted', null, 'submitted', v_new.promised_on, '');

  -- Spec F-0: the version is now ordered. A later edit saves a new version, which starts as a draft.
  if v_version is not null then
    perform private.mark_version_ordered(v_release.project_id, v_release.brand_id, v_version, btrim(p_factory_profile_id));
  end if;

  return query select v_new.id, v_new.status, v_new.cutoff_at, v_new.promised_on, v_new.lead_time_days, true;
end;
$$;

revoke all on function public.submit_order_for_production(uuid, text, text, text, text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.submit_order_for_production(uuid, text, text, text, text, jsonb, bigint, text) to service_role;
