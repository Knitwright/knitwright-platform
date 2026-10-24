-- Ops console, part 1: orders in production, weekly batches and factory status (plans/platform-v4.md, V5).
--
-- The platform has no payment concept. An order reaches ops through one function,
-- public.submit_order_for_production, that the owner's separate Store will call with the server's
-- own key (docs/decisions/0043-ops-console-batches.md holds the contract). Everything else here is
-- written by ops (platform admins) through the functions below, run by the server's key, which check
-- that the actor is a platform admin themselves.
--
-- Nothing here refers to another workstream's tables by key: an order names its release by id and
-- keeps a small snapshot of it, and names its factory by a text id, so migrations merge in any order.
-- An order holds sizes and counts only. Player names stay in team_order_rows and are read when a
-- factory sheet is made, so erasing a team list still erases the names.
--
-- Status history is append-only: ops_order_events can never be changed or removed.

create table public.ops_settings (
  id boolean primary key default true check (id),
  -- 0 is Sunday, as extract(dow ...). Times are UTC for now (owner question O1).
  cutoff_weekday integer not null check (cutoff_weekday between 0 and 6),
  cutoff_time time not null,
  -- Days from the cut-off to the promised date. Null is "not set": no factory has agreed one.
  lead_time_days integer check (lead_time_days is null or lead_time_days between 0 and 365),
  label text not null check (length(btrim(label)) between 1 and 120),
  updated_at timestamptz not null default now()
);

comment on table public.ops_settings is
  'The weekly batch cut-off and the lead time. One row. The seeded row is a labelled default, not agreed with a factory.';

insert into public.ops_settings (id, cutoff_weekday, cutoff_time, lead_time_days, label)
values (true, 5, '17:00', null, 'Knitwright default, not agreed with a factory');

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  factory_profile_id text not null check (length(btrim(factory_profile_id)) between 1 and 120),
  fabric_key text not null check (length(btrim(fabric_key)) between 1 and 120),
  article_id text not null check (length(btrim(article_id)) between 1 and 120),
  cutoff_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (factory_profile_id, fabric_key, article_id, cutoff_at)
);

comment on table public.batches is
  'One weekly batch for one factory, fabric and article. Made by ops_cut_batches. Read by platform admins only.';

create table public.ops_orders (
  id uuid primary key default gen_random_uuid(),
  -- The frozen release, by id. Not a key: a release stays, and this refers to it by value.
  release_id uuid not null,
  brand_id uuid not null,
  project_id uuid not null,
  -- The Store's own reference. The key a retry is matched on.
  external_ref text not null unique check (length(btrim(external_ref)) between 1 and 120),
  factory_profile_id text not null check (length(btrim(factory_profile_id)) between 1 and 120),
  fabric_key text not null check (length(btrim(fabric_key)) between 1 and 120),
  article_id text not null check (length(btrim(article_id)) between 1 and 120),
  -- {size label: pieces}. No player names.
  sizes jsonb not null check (jsonb_typeof(sizes) = 'object' and pg_column_size(sizes) < 8192),
  pieces integer not null check (pieces >= 1),
  -- The Store's price, when it gives one. The platform never sets one.
  value_minor bigint check (value_minor >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  -- {label, number, rosterHash, files} of the release at submission. Immutable.
  release_snapshot jsonb not null check (jsonb_typeof(release_snapshot) = 'object'),
  status text not null default 'submitted'
    check (status in ('submitted', 'batched', 'held', 'received', 'in_production', 'ready')),
  batch_id uuid references public.batches (id) on delete restrict,
  cutoff_at timestamptz not null,
  lead_time_days integer,
  promised_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_orders_value_with_currency check ((value_minor is null) = (currency is null)),
  constraint ops_orders_batch_matches_status check ((status in ('submitted', 'held')) = (batch_id is null))
);

comment on table public.ops_orders is
  'An order in production. Written by submit_order_for_production (the Store) and by ops functions. No player names.';

create index ops_orders_waiting_idx on public.ops_orders (cutoff_at) where status = 'submitted';
create index ops_orders_batch_idx on public.ops_orders (batch_id);
create index ops_orders_brand_idx on public.ops_orders (brand_id, created_at desc);

create table public.ops_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null,
  kind text not null
    check (kind in ('submitted', 'batched', 'moved', 'held', 'hold_released', 'received', 'in_production', 'ready', 'delayed')),
  from_status text,
  to_status text not null,
  batch_id uuid,
  -- The promised date after this event, when it set or changed one.
  promised_on date,
  note text not null default '' check (length(note) <= 300),
  -- Null when the Store submitted the order.
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

comment on table public.ops_order_events is
  'Status history of an order. Append-only. Written by the ops functions only.';

create index ops_order_events_order_idx on public.ops_order_events (order_id, at, id);

create function private.ops_refuse_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Ops history can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger ops_order_events_are_append_only
  before update or delete on public.ops_order_events
  for each row execute function private.ops_refuse_change();

create trigger ops_order_events_are_not_truncated
  before truncate on public.ops_order_events
  for each statement execute function private.ops_refuse_change();

-- Reads: platform admins read everything; a member reads their brand's orders and history (never
-- batches or settings). No browser role may write.
revoke all on public.ops_settings, public.batches, public.ops_orders, public.ops_order_events
  from public, anon, authenticated, service_role;
grant select on public.ops_settings, public.batches, public.ops_orders, public.ops_order_events to authenticated, service_role;

alter table public.ops_settings enable row level security;
alter table public.batches enable row level security;
alter table public.ops_orders enable row level security;
alter table public.ops_order_events enable row level security;

create policy "platform admins read ops settings"
  on public.ops_settings for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read batches"
  on public.batches for select to authenticated
  using (private.is_platform_admin());
create policy "admins and members read ops orders"
  on public.ops_orders for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));
create policy "admins and members read ops order history"
  on public.ops_order_events for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));

-- The next weekly cut-off at or after p_at, in UTC. An order made exactly at the cut-off is in that
-- batch. lib/ops/cutoff.ts does the same sum, and the integration test holds the two to each other.
create function private.next_cutoff(p_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.ops_settings;
  v_local timestamp;
  v_candidate timestamp;
begin
  select * into s from public.ops_settings where id;
  v_local := p_at at time zone 'UTC';
  v_candidate := date_trunc('day', v_local) + s.cutoff_time;
  v_candidate := v_candidate
    + (((s.cutoff_weekday - extract(dow from v_local)::integer + 7) % 7) * interval '1 day');
  if v_candidate < v_local then
    v_candidate := v_candidate + interval '7 days';
  end if;
  return v_candidate at time zone 'UTC';
end;
$$;

-- Refuses anyone who is not a platform admin.
create function private.require_ops_actor(p_actor uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- THE CONTRACT with the Store. See docs/decisions/0043-ops-console-batches.md.
-- Idempotent on p_external_ref: the same reference with the same release answers with the order already
-- there (created = false); with another release it is refused (hint external_ref_conflict).
create function public.submit_order_for_production(
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

  return query select v_new.id, v_new.status, v_new.cutoff_at, v_new.promised_on, v_new.lead_time_days, true;
end;
$$;

-- Puts every waiting order whose cut-off has come into its batch, making the batch when needed.
-- Returns how many orders were batched.
create function public.ops_cut_batches(p_actor uuid, p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
  v_batch uuid;
  v_count integer := 0;
  v_moved integer;
begin
  perform private.require_ops_actor(p_actor);
  for v_group in
    select o.factory_profile_id, o.fabric_key, o.article_id, o.cutoff_at
    from public.ops_orders o
    where o.status = 'submitted' and o.cutoff_at <= p_now
    group by o.factory_profile_id, o.fabric_key, o.article_id, o.cutoff_at
    order by o.cutoff_at, o.factory_profile_id, o.fabric_key, o.article_id
  loop
    insert into public.batches (factory_profile_id, fabric_key, article_id, cutoff_at)
    values (v_group.factory_profile_id, v_group.fabric_key, v_group.article_id, v_group.cutoff_at)
    on conflict (factory_profile_id, fabric_key, article_id, cutoff_at) do update set factory_profile_id = excluded.factory_profile_id
    returning id into v_batch;

    with moved as (
      update public.ops_orders o
      set status = 'batched', batch_id = v_batch, updated_at = now()
      where o.status = 'submitted' and o.cutoff_at = v_group.cutoff_at
        and o.factory_profile_id = v_group.factory_profile_id
        and o.fabric_key = v_group.fabric_key and o.article_id = v_group.article_id
      returning o.id, o.brand_id, o.promised_on
    )
    insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, batch_id, promised_on, actor)
    select m.id, m.brand_id, 'batched', 'submitted', 'batched', v_batch, m.promised_on, p_actor from moved m;
    get diagnostics v_moved = row_count;
    v_count := v_count + v_moved;
  end loop;
  return v_count;
end;
$$;

-- Moves an order that has not reached the factory into another batch of the same factory, fabric and article.
create function public.ops_move_order(p_actor uuid, p_order_id uuid, p_batch_id uuid, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  b public.batches;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  select * into b from public.batches where id = p_batch_id;
  if o.id is null or b.id is null then
    raise exception 'That order or batch does not exist.' using errcode = 'P0002';
  end if;
  if o.status not in ('submitted', 'batched', 'held') then
    raise exception 'The factory already has this order, so it cannot be moved.' using errcode = 'P0001', hint = 'not_movable';
  end if;
  if (o.factory_profile_id, o.fabric_key, o.article_id) is distinct from (b.factory_profile_id, b.fabric_key, b.article_id) then
    raise exception 'A batch holds one factory, one fabric and one article.' using errcode = 'P0001', hint = 'batch_mismatch';
  end if;
  update public.ops_orders set status = 'batched', batch_id = p_batch_id, updated_at = now() where id = p_order_id;
  insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, batch_id, promised_on, note, actor)
  values (o.id, o.brand_id, 'moved', o.status, 'batched', p_batch_id, o.promised_on, coalesce(p_note, ''), p_actor);
end;
$$;

-- Holds an order (out of any batch) or lets it go back to waiting for the next cut.
create function public.ops_set_hold(p_actor uuid, p_order_id uuid, p_hold boolean, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if p_hold then
    if o.status not in ('submitted', 'batched') then
      raise exception 'Only an order the factory does not have yet can be held.' using errcode = 'P0001', hint = 'not_holdable';
    end if;
    update public.ops_orders set status = 'held', batch_id = null, updated_at = now() where id = p_order_id;
    insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, promised_on, note, actor)
    values (o.id, o.brand_id, 'held', o.status, 'held', o.promised_on, coalesce(p_note, ''), p_actor);
  else
    if o.status <> 'held' then
      raise exception 'That order is not on hold.' using errcode = 'P0001', hint = 'not_held';
    end if;
    update public.ops_orders set status = 'submitted', updated_at = now() where id = p_order_id;
    insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, promised_on, note, actor)
    values (o.id, o.brand_id, 'hold_released', 'held', 'submitted', o.promised_on, coalesce(p_note, ''), p_actor);
  end if;
end;
$$;

-- Marks the next step: batched -> received -> in_production -> ready. One step at a time, never back.
create function public.ops_set_order_status(p_actor uuid, p_order_id uuid, p_to text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if not ((o.status = 'batched' and p_to = 'received')
       or (o.status = 'received' and p_to = 'in_production')
       or (o.status = 'in_production' and p_to = 'ready')) then
    raise exception 'An order moves one step at a time: batched, received, in production, ready.'
      using errcode = 'P0001', hint = 'illegal_transition';
  end if;
  update public.ops_orders set status = p_to, updated_at = now() where id = p_order_id;
  insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, batch_id, promised_on, note, actor)
  values (o.id, o.brand_id, p_to, o.status, p_to, o.batch_id, o.promised_on, coalesce(p_note, ''), p_actor);
end;
$$;

-- Pushes the promised date later and records why.
create function public.ops_delay_order(p_actor uuid, p_order_id uuid, p_new_date date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 300 then
    raise exception 'Give the reason for the delay, up to 300 characters.' using errcode = '22023', hint = 'reason_needed';
  end if;
  if o.status not in ('batched', 'received', 'in_production') then
    raise exception 'Only an order in a batch or at the factory can be delayed.' using errcode = 'P0001', hint = 'not_delayable';
  end if;
  if o.promised_on is not null and p_new_date <= o.promised_on then
    raise exception 'The new promised date must be later than the current one.' using errcode = 'P0001', hint = 'not_later';
  end if;
  update public.ops_orders set promised_on = p_new_date, updated_at = now() where id = p_order_id;
  insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, batch_id, promised_on, note, actor)
  values (o.id, o.brand_id, 'delayed', o.status, o.status, o.batch_id, p_new_date, btrim(p_reason), p_actor);
end;
$$;

-- Sets the cut-off and the lead time. A null lead time means "not set".
create function public.ops_update_settings(p_actor uuid, p_weekday integer, p_minutes integer, p_lead_time_days integer, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  if p_minutes not between 0 and 1439 then
    raise exception 'The cut-off time is minutes after midnight, 0 to 1439.' using errcode = '22023';
  end if;
  update public.ops_settings
  set cutoff_weekday = p_weekday,
      cutoff_time = make_time(p_minutes / 60, p_minutes % 60, 0),
      lead_time_days = p_lead_time_days,
      label = p_label,
      updated_at = now()
  where id;
end;
$$;

revoke all on function private.ops_refuse_change() from public, anon, authenticated;
revoke all on function private.next_cutoff(timestamptz) from public, anon, authenticated;
revoke all on function private.require_ops_actor(uuid) from public, anon, authenticated;
grant execute on function private.next_cutoff(timestamptz) to service_role;

revoke all on function public.submit_order_for_production(uuid, text, text, text, text, jsonb, bigint, text) from public, anon, authenticated;
revoke all on function public.ops_cut_batches(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.ops_move_order(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.ops_set_hold(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.ops_set_order_status(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.ops_delay_order(uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function public.ops_update_settings(uuid, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.submit_order_for_production(uuid, text, text, text, text, jsonb, bigint, text) to service_role;
grant execute on function public.ops_cut_batches(uuid, timestamptz) to service_role;
grant execute on function public.ops_move_order(uuid, uuid, uuid, text) to service_role;
grant execute on function public.ops_set_hold(uuid, uuid, boolean, text) to service_role;
grant execute on function public.ops_set_order_status(uuid, uuid, text, text) to service_role;
grant execute on function public.ops_delay_order(uuid, uuid, date, text) to service_role;
grant execute on function public.ops_update_settings(uuid, integer, integer, integer, text) to service_role;
