-- Ops console, part 2: quality control, packing, shipping and exceptions (plans/platform-v4.md, W2-D).
--
-- Continues 20261025050000_ops_batches.sql and copies its patterns: every table is read by platform admins
-- only (members read none of it), no browser role writes, every write is a function that only the server's
-- key may run and that checks the actor is a platform admin itself, and history is append-only.
--
-- Nothing here invents a number. Weights, dimensions and tolerances are inputs ops types in; a carton with
-- none is "not set". The platform never calls a courier: a shipment is a record of what ops was told.
--
-- Personal data. These tables hold no player names: a bag points at a line of the team list by position, and
-- the name is read from the team list when a label is printed. Free-text notes could still name someone, so
-- every table is tied to its brand and goes with it (account erasure), and the append-only tables allow
-- exactly that delete and no other. lib/deletion/team-data.ts lists them.

-- Orders move through the same statuses as before. "Shipped" is not a status of ops_orders (that table
-- belongs to part 1): an order is shipped when its shipments cover its pieces, derived in lib/ops/shipping.

create table public.ops_exceptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind text not null check (kind in ('remake', 'partial_shipment', 'lost_parcel', 'size_swap')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  -- Who deals with it: a name, not a login (the factory's contact may own a remake).
  owner text not null check (length(btrim(owner)) between 1 and 80),
  due_on date not null,
  -- {size label: pieces} for a remake; {from, to, pieces} for a size swap; {} otherwise.
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) < 4096),
  note text not null default '' check (length(note) <= 300),
  -- The inspection that raised it, when one did. Not a key: inspections are history.
  inspection_id uuid,
  resolution text check (resolution is null or length(btrim(resolution)) between 1 and 300),
  resolved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_exceptions_resolved_together check ((status = 'resolved') = (resolution is not null and resolved_on is not null))
);

comment on table public.ops_exceptions is
  'A remake, partial shipment, lost parcel or size swap, with an owner and a due date. Written by the ops functions only. Read by platform admins only.';

create index ops_exceptions_open_idx on public.ops_exceptions (due_on) where status = 'open';
create index ops_exceptions_order_idx on public.ops_exceptions (order_id);
create index ops_exceptions_brand_idx on public.ops_exceptions (brand_id);

create table public.ops_exception_events (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid not null references public.ops_exceptions (id) on delete cascade,
  order_id uuid not null,
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind text not null check (kind in ('raised', 'changed', 'resolved')),
  owner text not null,
  due_on date not null,
  note text not null default '' check (length(note) <= 300),
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

comment on table public.ops_exception_events is
  'History of an exception. Append-only.';

create index ops_exception_events_idx on public.ops_exception_events (exception_id, at, id);
create index ops_exception_events_brand_idx on public.ops_exception_events (brand_id);

create table public.ops_qc_inspections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- Copied from the order, so the defect rate by factory survives a later change.
  factory_profile_id text not null,
  result text not null check (result in ('pass', 'fail')),
  -- [{key, result: pass | fail | not_inspected, note}] for measurements, colour, artwork, names_numbers.
  checklist jsonb not null check (jsonb_typeof(checklist) = 'array' and pg_column_size(checklist) < 8192),
  -- [{point, specMm, measuredMm, toleranceMm}]: every number typed by the inspector.
  measurements jsonb not null default '[]'::jsonb check (jsonb_typeof(measurements) = 'array' and pg_column_size(measurements) < 8192),
  -- Pieces looked at, and how many of them had a defect.
  sample_size integer not null check (sample_size between 1 and 99999),
  defect_count integer not null check (defect_count >= 0 and defect_count <= sample_size),
  photo_file_ids uuid[] not null default '{}' check (cardinality(photo_file_ids) <= 20),
  note text not null default '' check (length(note) <= 300),
  exception_id uuid,
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

comment on table public.ops_qc_inspections is
  'One quality inspection of an order. A new inspection never replaces an old one; the latest decides. Append-only.';

create index ops_qc_inspections_order_idx on public.ops_qc_inspections (order_id, at desc, id);
create index ops_qc_inspections_brand_idx on public.ops_qc_inspections (brand_id);

create table public.ops_cartons (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  carton_no integer not null check (carton_no between 1 and 999),
  -- Measured and typed by ops. Null is "not set": nothing is assumed.
  weight_g integer check (weight_g is null or weight_g between 1 and 1000000),
  length_mm integer check (length_mm is null or length_mm between 1 and 5000),
  width_mm integer check (width_mm is null or width_mm between 1 and 5000),
  height_mm integer check (height_mm is null or height_mm between 1 and 5000),
  updated_at timestamptz not null default now(),
  unique (order_id, carton_no)
);

comment on table public.ops_cartons is
  'A carton of an order. Weight and size are what ops typed in, or null.';

create index ops_cartons_brand_idx on public.ops_cartons (brand_id);

create table public.ops_pack_bags (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  bag_no integer not null check (bag_no between 1 and 9999),
  -- The team list this bag was made from and the line in it. No name is stored here.
  team_order_id uuid,
  team_row_position integer check (team_row_position is null or team_row_position >= 1),
  size_label text not null check (length(size_label) between 1 and 16),
  pieces integer not null check (pieces between 1 and 999),
  carton_no integer check (carton_no is null or carton_no between 1 and 999),
  packed_at timestamptz,
  packed_by uuid references auth.users (id) on delete set null,
  unique (order_id, bag_no)
);

comment on table public.ops_pack_bags is
  'One bag of an order: a player''s piece, by position in the team list, or a plain bag of one size. No names.';

create index ops_pack_bags_brand_idx on public.ops_pack_bags (brand_id);

create table public.ops_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- Only 'manual' exists: ops types in what the courier gave. No courier is called (owner decision pending).
  provider text not null default 'manual' check (provider in ('manual')),
  courier text not null check (length(btrim(courier)) between 1 and 80),
  tracking_number text not null check (length(btrim(tracking_number)) between 1 and 80),
  shipped_on date not null,
  sizes jsonb not null check (jsonb_typeof(sizes) = 'object'),
  pieces integer not null check (pieces >= 1),
  note text not null default '' check (length(note) <= 300),
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

comment on table public.ops_shipments is
  'A parcel sent for an order, as ops recorded it. Append-only. An order is shipped when its shipments cover its pieces.';

create index ops_shipments_order_idx on public.ops_shipments (order_id, at, id);
create index ops_shipments_brand_idx on public.ops_shipments (brand_id);

-- Append-only, except that a brand's erasure may remove its rows (they are tied to the brand). The brand row
-- is already gone when the cascade reaches them.
create function private.ops_qc_refuse_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.brands b where b.id = old.brand_id) then
    return old;
  end if;
  raise exception 'Ops history can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger ops_qc_inspections_are_append_only
  before update or delete on public.ops_qc_inspections
  for each row execute function private.ops_qc_refuse_change();
create trigger ops_shipments_are_append_only
  before update or delete on public.ops_shipments
  for each row execute function private.ops_qc_refuse_change();
create trigger ops_exception_events_are_append_only
  before update or delete on public.ops_exception_events
  for each row execute function private.ops_qc_refuse_change();

create trigger ops_qc_inspections_are_not_truncated
  before truncate on public.ops_qc_inspections
  for each statement execute function private.ops_refuse_change();
create trigger ops_shipments_are_not_truncated
  before truncate on public.ops_shipments
  for each statement execute function private.ops_refuse_change();
create trigger ops_exception_events_are_not_truncated
  before truncate on public.ops_exception_events
  for each statement execute function private.ops_refuse_change();

revoke all on public.ops_exceptions, public.ops_exception_events, public.ops_qc_inspections,
  public.ops_cartons, public.ops_pack_bags, public.ops_shipments
  from public, anon, authenticated, service_role;
grant select on public.ops_exceptions, public.ops_exception_events, public.ops_qc_inspections,
  public.ops_cartons, public.ops_pack_bags, public.ops_shipments to authenticated, service_role;

alter table public.ops_exceptions enable row level security;
alter table public.ops_exception_events enable row level security;
alter table public.ops_qc_inspections enable row level security;
alter table public.ops_cartons enable row level security;
alter table public.ops_pack_bags enable row level security;
alter table public.ops_shipments enable row level security;

create policy "platform admins read ops exceptions"
  on public.ops_exceptions for select to authenticated using (private.is_platform_admin());
create policy "platform admins read ops exception history"
  on public.ops_exception_events for select to authenticated using (private.is_platform_admin());
create policy "platform admins read qc inspections"
  on public.ops_qc_inspections for select to authenticated using (private.is_platform_admin());
create policy "platform admins read cartons"
  on public.ops_cartons for select to authenticated using (private.is_platform_admin());
create policy "platform admins read pack bags"
  on public.ops_pack_bags for select to authenticated using (private.is_platform_admin());
create policy "platform admins read shipments"
  on public.ops_shipments for select to authenticated using (private.is_platform_admin());

-- Whole, positive piece counts by size label, 1 to 40 sizes. The same rule as an order's sizes.
create function private.ops_valid_sizes(p_sizes jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_size record;
begin
  if p_sizes is null or jsonb_typeof(p_sizes) <> 'object' then
    return false;
  end if;
  if (select count(*) from jsonb_object_keys(p_sizes)) not between 1 and 40 then
    return false;
  end if;
  for v_size in select key, value from jsonb_each(p_sizes) loop
    if length(v_size.key) not between 1 and 16 or v_size.key <> btrim(v_size.key)
       or jsonb_typeof(v_size.value) <> 'number'
       or (v_size.value #>> '{}') !~ '^[0-9]+$'
       or (v_size.value #>> '{}')::numeric not between 1 and 99999 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create function private.ops_sum_sizes(p_sizes jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((value #>> '{}')::integer), 0)::integer from jsonb_each(p_sizes);
$$;

-- Writes an exception and its first history line. Shared by the functions below.
create function private.ops_open_exception(
  p_actor uuid, p_order public.ops_orders, p_kind text, p_owner text, p_due_on date, p_note text, p_detail jsonb, p_inspection uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_owner is null or length(btrim(p_owner)) not between 1 and 80 or p_due_on is null then
    raise exception 'Every exception needs an owner (a name) and a due date.' using errcode = '22023', hint = 'owner_and_due_needed';
  end if;
  insert into public.ops_exceptions (order_id, brand_id, kind, owner, due_on, detail, note, inspection_id)
  values (p_order.id, p_order.brand_id, p_kind, btrim(p_owner), p_due_on, coalesce(p_detail, '{}'::jsonb), coalesce(p_note, ''), p_inspection)
  returning id into v_id;
  insert into public.ops_exception_events (exception_id, order_id, brand_id, kind, owner, due_on, note, actor)
  values (v_id, p_order.id, p_order.brand_id, 'raised', btrim(p_owner), p_due_on, coalesce(p_note, ''), p_actor);
  return v_id;
end;
$$;

-- Raises an exception by hand: remake, partial shipment, lost parcel or size swap.
create function public.ops_raise_exception(
  p_actor uuid, p_order_id uuid, p_kind text, p_owner text, p_due_on date, p_note text default '', p_detail jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if p_kind is null or p_kind not in ('remake', 'partial_shipment', 'lost_parcel', 'size_swap') then
    raise exception 'That is not a kind of exception.' using errcode = '22023', hint = 'invalid_kind';
  end if;
  if p_kind = 'remake' and not private.ops_valid_sizes(p_detail) then
    raise exception 'A remake lists the pieces to make again by size.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  return private.ops_open_exception(p_actor, o, p_kind, p_owner, p_due_on, p_note, p_detail, null);
end;
$$;

-- Changes who owns an open exception, when it is due, or its note. One history line each time.
create function public.ops_update_exception(p_actor uuid, p_id uuid, p_owner text, p_due_on date, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.ops_exceptions;
begin
  perform private.require_ops_actor(p_actor);
  select * into e from public.ops_exceptions where id = p_id for update;
  if e.id is null then
    raise exception 'That exception does not exist.' using errcode = 'P0002';
  end if;
  if e.status <> 'open' then
    raise exception 'That exception is resolved.' using errcode = 'P0001', hint = 'already_resolved';
  end if;
  if p_owner is null or length(btrim(p_owner)) not between 1 and 80 or p_due_on is null then
    raise exception 'Every exception needs an owner (a name) and a due date.' using errcode = '22023', hint = 'owner_and_due_needed';
  end if;
  update public.ops_exceptions
  set owner = btrim(p_owner), due_on = p_due_on, note = coalesce(p_note, ''), updated_at = now()
  where id = p_id;
  insert into public.ops_exception_events (exception_id, order_id, brand_id, kind, owner, due_on, note, actor)
  values (e.id, e.order_id, e.brand_id, 'changed', btrim(p_owner), p_due_on, coalesce(p_note, ''), p_actor);
end;
$$;

create function public.ops_resolve_exception(p_actor uuid, p_id uuid, p_resolution text, p_on date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.ops_exceptions;
  v_on date := coalesce(p_on, (now() at time zone 'UTC')::date);
begin
  perform private.require_ops_actor(p_actor);
  select * into e from public.ops_exceptions where id = p_id for update;
  if e.id is null then
    raise exception 'That exception does not exist.' using errcode = 'P0002';
  end if;
  if e.status <> 'open' then
    raise exception 'That exception is resolved.' using errcode = 'P0001', hint = 'already_resolved';
  end if;
  if p_resolution is null or length(btrim(p_resolution)) not between 1 and 300 then
    raise exception 'Say how it was resolved, up to 300 characters.' using errcode = '22023', hint = 'resolution_needed';
  end if;
  update public.ops_exceptions
  set status = 'resolved', resolution = btrim(p_resolution), resolved_on = v_on, updated_at = now()
  where id = p_id;
  insert into public.ops_exception_events (exception_id, order_id, brand_id, kind, owner, due_on, note, actor)
  values (e.id, e.order_id, e.brand_id, 'resolved', e.owner, e.due_on, btrim(p_resolution), p_actor);
end;
$$;

-- Records an inspection of an order the factory has marked ready. The result is worked out here from what
-- was typed: pass only when measurements, colour, artwork and names and numbers all pass, no piece in the
-- sample has a defect, and every measurement is inside the tolerance the inspector typed. lib/ops/qc does the
-- same sum and the integration test holds the two to each other. A fail needs the pieces to make again, an owner
-- and a due date, and opens a remake exception in the same step.
create function public.ops_record_inspection(
  p_actor uuid, p_order_id uuid, p_checklist jsonb, p_measurements jsonb, p_sample_size integer, p_defect_count integer,
  p_photo_file_ids uuid[] default '{}', p_note text default '',
  p_remake_sizes jsonb default null, p_remake_owner text default null, p_remake_due_on date default null
)
returns table (inspection_id uuid, result text, exception_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  v_item jsonb;
  v_key text;
  v_all_pass boolean := true;
  v_seen text[] := '{}';
  v_in_tolerance boolean := true;
  v_result text;
  v_exception uuid := null;
  v_inspection uuid := gen_random_uuid();
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if o.status <> 'ready' then
    raise exception 'An order is inspected once the factory has marked it ready.' using errcode = 'P0001', hint = 'not_ready_for_qc';
  end if;

  if p_checklist is null or jsonb_typeof(p_checklist) <> 'array' then
    raise exception 'The checklist is a list of items.' using errcode = '22023', hint = 'invalid_checklist';
  end if;
  for v_item in select value from jsonb_array_elements(p_checklist) loop
    v_key := v_item ->> 'key';
    if jsonb_typeof(v_item) <> 'object' or v_key is null or v_key not in ('measurements', 'colour', 'artwork', 'names_numbers')
       or v_key = any (v_seen) or (v_item ->> 'result') is null or (v_item ->> 'result') not in ('pass', 'fail', 'not_inspected')
       or length(coalesce(v_item ->> 'note', '')) > 300 then
      raise exception 'Each checklist item is measurements, colour, artwork or names_numbers, once, with pass, fail or not_inspected.'
        using errcode = '22023', hint = 'invalid_checklist';
    end if;
    v_seen := v_seen || v_key;
    if (v_item ->> 'result') <> 'pass' then
      v_all_pass := false;
    end if;
  end loop;
  if cardinality(v_seen) <> 4 then
    raise exception 'The checklist needs all four items.' using errcode = '22023', hint = 'invalid_checklist';
  end if;

  if p_measurements is null or jsonb_typeof(p_measurements) <> 'array' or jsonb_array_length(p_measurements) > 60 then
    raise exception 'Measurements are a list of up to 60 lines.' using errcode = '22023', hint = 'invalid_measurements';
  end if;
  for v_item in select value from jsonb_array_elements(p_measurements) loop
    if jsonb_typeof(v_item) <> 'object'
       or length(btrim(coalesce(v_item ->> 'point', ''))) not between 1 and 80
       or coalesce(jsonb_typeof(v_item -> 'specMm'), '') <> 'number' or coalesce(jsonb_typeof(v_item -> 'measuredMm'), '') <> 'number'
       or coalesce(jsonb_typeof(v_item -> 'toleranceMm'), '') <> 'number'
       or (v_item ->> 'specMm')::numeric <= 0 or (v_item ->> 'measuredMm')::numeric <= 0
       or (v_item ->> 'toleranceMm')::numeric < 0 then
      raise exception 'Each measurement needs a point, the spec, the measured value and the tolerance, in millimetres.'
        using errcode = '22023', hint = 'invalid_measurements';
    end if;
    if abs((v_item ->> 'measuredMm')::numeric - (v_item ->> 'specMm')::numeric) > (v_item ->> 'toleranceMm')::numeric then
      v_in_tolerance := false;
    end if;
  end loop;

  if p_sample_size is null or p_sample_size not between 1 and 99999
     or p_defect_count is null or p_defect_count < 0 or p_defect_count > p_sample_size
     or cardinality(coalesce(p_photo_file_ids, '{}')) > 20 or length(coalesce(p_note, '')) > 300 then
    raise exception 'The sample is 1 or more pieces, defects cannot exceed it, photos are up to 20.' using errcode = '22023', hint = 'invalid_input';
  end if;

  v_result := case
    when v_all_pass and v_in_tolerance and p_defect_count = 0 and jsonb_array_length(p_measurements) >= 1 then 'pass'
    else 'fail'
  end;

  if v_result = 'fail' then
    if not private.ops_valid_sizes(p_remake_sizes) or p_remake_owner is null or p_remake_due_on is null then
      raise exception 'A failed inspection needs the pieces to make again, an owner and a due date.'
        using errcode = '22023', hint = 'remake_needed';
    end if;
    v_exception := private.ops_open_exception(
      p_actor, o, 'remake', p_remake_owner, p_remake_due_on, coalesce(p_note, ''), p_remake_sizes, v_inspection
    );
  end if;

  insert into public.ops_qc_inspections (
    id, order_id, brand_id, factory_profile_id, result, checklist, measurements, sample_size, defect_count,
    photo_file_ids, note, exception_id, actor
  ) values (
    v_inspection, o.id, o.brand_id, o.factory_profile_id, v_result, p_checklist, p_measurements, p_sample_size, p_defect_count,
    coalesce(p_photo_file_ids, '{}'), coalesce(p_note, ''), v_exception, p_actor
  );
  return query select v_inspection, v_result, v_exception;
end;
$$;

-- Sets or changes a carton. A size left null stays "not set".
create function public.ops_set_carton(
  p_actor uuid, p_order_id uuid, p_carton_no integer, p_weight_g integer, p_length_mm integer, p_width_mm integer, p_height_mm integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if o.status not in ('received', 'in_production', 'ready') then
    raise exception 'Cartons are set once the factory has the order.' using errcode = 'P0001', hint = 'not_packable';
  end if;
  if p_carton_no is null or p_carton_no not between 1 and 999
     or p_weight_g < 1 or p_weight_g > 1000000 or p_length_mm not between 1 and 5000
     or p_width_mm not between 1 and 5000 or p_height_mm not between 1 and 5000 then
    raise exception 'A carton number is 1 to 999. Weight is grams, sizes are millimetres, or left empty.' using errcode = '22023', hint = 'invalid_input';
  end if;
  insert into public.ops_cartons as c (order_id, brand_id, carton_no, weight_g, length_mm, width_mm, height_mm)
  values (o.id, o.brand_id, p_carton_no, p_weight_g, p_length_mm, p_width_mm, p_height_mm)
  on conflict (order_id, carton_no) do update
    set weight_g = excluded.weight_g, length_mm = excluded.length_mm, width_mm = excluded.width_mm,
        height_mm = excluded.height_mm, updated_at = now();
end;
$$;

-- Replaces the bags of an order, as long as none has been packed yet. p_bags is
-- [{teamRowPosition, sizeLabel, pieces}] in bag order; teamRowPosition is null for a plain bag.
create function public.ops_set_bags(p_actor uuid, p_order_id uuid, p_team_order_id uuid, p_bags jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  v_bag jsonb;
  v_n integer := 0;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if o.status not in ('received', 'in_production', 'ready') then
    raise exception 'Bags are made once the factory has the order.' using errcode = 'P0001', hint = 'not_packable';
  end if;
  if p_bags is null or jsonb_typeof(p_bags) <> 'array' or jsonb_array_length(p_bags) not between 1 and 1000 then
    raise exception 'An order has 1 to 1000 bags.' using errcode = '22023', hint = 'invalid_bags';
  end if;
  if exists (select 1 from public.ops_pack_bags b where b.order_id = o.id and b.packed_at is not null) then
    raise exception 'A bag has been packed, so the bags cannot be remade.' using errcode = 'P0001', hint = 'already_packing';
  end if;
  delete from public.ops_pack_bags where order_id = o.id;
  for v_bag in select value from jsonb_array_elements(p_bags) loop
    v_n := v_n + 1;
    if jsonb_typeof(v_bag) <> 'object'
       or length(coalesce(v_bag ->> 'sizeLabel', '')) not between 1 and 16
       or coalesce(v_bag ->> 'pieces', '') !~ '^[1-9][0-9]{0,2}$'
       or (v_bag ->> 'teamRowPosition' is not null and (v_bag ->> 'teamRowPosition') !~ '^[1-9][0-9]{0,8}$') then
      raise exception 'Each bag needs a size label and a number of pieces.' using errcode = '22023', hint = 'invalid_bags';
    end if;
    insert into public.ops_pack_bags (order_id, brand_id, bag_no, team_order_id, team_row_position, size_label, pieces)
    values (o.id, o.brand_id, v_n, case when v_bag ->> 'teamRowPosition' is null then null else p_team_order_id end,
            nullif(v_bag ->> 'teamRowPosition', '')::integer, v_bag ->> 'sizeLabel', (v_bag ->> 'pieces')::integer);
  end loop;
  return v_n;
end;
$$;

-- Marks a bag packed into a carton of the same order.
create function public.ops_mark_bag_packed(p_actor uuid, p_bag_id uuid, p_carton_no integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.ops_pack_bags;
begin
  perform private.require_ops_actor(p_actor);
  select * into b from public.ops_pack_bags where id = p_bag_id for update;
  if b.id is null then
    raise exception 'That bag does not exist.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.ops_cartons c where c.order_id = b.order_id and c.carton_no = p_carton_no) then
    raise exception 'That carton is not set up for this order.' using errcode = 'P0001', hint = 'no_such_carton';
  end if;
  update public.ops_pack_bags set carton_no = p_carton_no, packed_at = now(), packed_by = p_actor where id = p_bag_id;
end;
$$;

-- Records a parcel. Refused unless the factory has marked the order ready and its latest inspection is a pass.
-- Pieces by size cannot go over what the order still owes. A parcel that leaves pieces behind needs an owner and
-- a due date and opens a partial shipment exception.
create function public.ops_record_shipment(
  p_actor uuid, p_order_id uuid, p_courier text, p_tracking_number text, p_shipped_on date, p_sizes jsonb,
  p_note text default '', p_owner text default null, p_due_on date default null
)
returns table (shipment_id uuid, shipped_pieces integer, complete boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  v_result text;
  v_id uuid;
  v_pieces integer;
  v_already integer;
  v_size record;
  v_before integer;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if o.status <> 'ready' then
    raise exception 'Only an order the factory has marked ready can be shipped.' using errcode = 'P0001', hint = 'not_ready_to_ship';
  end if;
  select i.result into v_result from public.ops_qc_inspections i where i.order_id = o.id order by i.at desc, i.id desc limit 1;
  if v_result is distinct from 'pass' then
    raise exception 'The latest inspection of this order is not a pass, so it cannot ship.' using errcode = 'P0001', hint = 'qc_not_passed';
  end if;
  if p_courier is null or length(btrim(p_courier)) not between 1 and 80
     or p_tracking_number is null or length(btrim(p_tracking_number)) not between 1 and 80
     or p_shipped_on is null or length(coalesce(p_note, '')) > 300 then
    raise exception 'A shipment needs a courier, a tracking number and the day it was sent.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if not private.ops_valid_sizes(p_sizes) then
    raise exception 'List the pieces sent, by size.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  for v_size in select key, (value #>> '{}')::integer as n from jsonb_each(p_sizes) loop
    select coalesce(sum((s.sizes ->> v_size.key)::integer), 0) into v_before
    from public.ops_shipments s where s.order_id = o.id;
    if v_size.n + v_before > coalesce((o.sizes ->> v_size.key)::integer, 0) then
      raise exception 'That is more pieces of size % than the order still owes.', v_size.key using errcode = 'P0001', hint = 'over_shipped';
    end if;
  end loop;
  v_pieces := private.ops_sum_sizes(p_sizes);
  select coalesce(sum(s.pieces), 0) into v_already from public.ops_shipments s where s.order_id = o.id;
  if v_pieces + v_already < o.pieces and (p_owner is null or p_due_on is null) then
    raise exception 'This leaves pieces behind: give an owner and a due date for the rest.' using errcode = '22023', hint = 'owner_and_due_needed';
  end if;
  insert into public.ops_shipments (order_id, brand_id, courier, tracking_number, shipped_on, sizes, pieces, note, actor)
  values (o.id, o.brand_id, btrim(p_courier), btrim(p_tracking_number), p_shipped_on, p_sizes, v_pieces, coalesce(p_note, ''), p_actor)
  returning id into v_id;
  if v_pieces + v_already < o.pieces then
    perform private.ops_open_exception(p_actor, o, 'partial_shipment', p_owner, p_due_on, coalesce(p_note, ''), '{}'::jsonb, null);
  end if;
  return query select v_id, v_pieces, v_pieces + v_already = o.pieces;
end;
$$;

revoke all on function private.ops_qc_refuse_change() from public, anon, authenticated;
revoke all on function private.ops_valid_sizes(jsonb) from public, anon, authenticated;
revoke all on function private.ops_sum_sizes(jsonb) from public, anon, authenticated;
revoke all on function private.ops_open_exception(uuid, public.ops_orders, text, text, date, text, jsonb, uuid) from public, anon, authenticated;

revoke all on function public.ops_raise_exception(uuid, uuid, text, text, date, text, jsonb) from public, anon, authenticated;
revoke all on function public.ops_update_exception(uuid, uuid, text, date, text) from public, anon, authenticated;
revoke all on function public.ops_resolve_exception(uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function public.ops_record_inspection(uuid, uuid, jsonb, jsonb, integer, integer, uuid[], text, jsonb, text, date) from public, anon, authenticated;
revoke all on function public.ops_set_carton(uuid, uuid, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.ops_set_bags(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.ops_mark_bag_packed(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.ops_record_shipment(uuid, uuid, text, text, date, jsonb, text, text, date) from public, anon, authenticated;

grant execute on function public.ops_raise_exception(uuid, uuid, text, text, date, text, jsonb) to service_role;
grant execute on function public.ops_update_exception(uuid, uuid, text, date, text) to service_role;
grant execute on function public.ops_resolve_exception(uuid, uuid, text, date) to service_role;
grant execute on function public.ops_record_inspection(uuid, uuid, jsonb, jsonb, integer, integer, uuid[], text, jsonb, text, date) to service_role;
grant execute on function public.ops_set_carton(uuid, uuid, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.ops_set_bags(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.ops_mark_bag_packed(uuid, uuid, integer) to service_role;
grant execute on function public.ops_record_shipment(uuid, uuid, text, text, date, jsonb, text, text, date) to service_role;
