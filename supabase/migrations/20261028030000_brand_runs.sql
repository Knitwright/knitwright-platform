-- Brand workspace: product list and brand runs (plans/platform-v4.md, workstream W4-C; decision 0062).
--
-- A small brand is a brand (decision 0042), so this adds no account concept. It adds:
--   * brand_products: designs a brand marks as products, with a stage (idea, sample, run);
--   * brand_runs: a sample or a run of a product, linked to a frozen release and to the order it
--     became in production. A run holds a size breakdown instead of a roster;
--   * brand_product_events: the history of a product.
--
-- A run reaches ops through public.submit_order_for_production (decision 0043), used exactly as
-- documented and not changed. Nothing here sets a price, a minimum order or a tier: those are checked
-- by the app against the factory profile, where "not set" stays "not set".
--
-- Every table is brand-scoped with row level security on. Members read their brand's rows; nobody
-- writes directly. Each write is a function only the server's own key may run, and each checks the
-- caller's role itself (owner, admin or kit manager, as for the club kit). Runs and events are
-- append-only; a product changes stage only forward, one step at a time, through its function.
-- A product goes with its design or its brand; its runs and events go with it. The orders they
-- became stay in ops, which does not refer back.

create table public.brand_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80 and name = btrim(name)),
  stage text not null default 'idea' check (stage in ('idea', 'sample', 'run')),
  -- The saved version of the design in use: the one the newest order was frozen from, or the
  -- current one when the product was listed.
  design_version integer not null check (design_version >= 1),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (brand_id, project_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.brand_products is
  'A design a brand lists as a product, with its stage. Written by the server only.';

create index brand_products_brand_idx on public.brand_products (brand_id, created_at desc);

create table public.brand_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  product_id uuid not null,
  kind text not null check (kind in ('sample', 'run')),
  -- The frozen release the order was made from. Not a key: releases are append-only and checked inside the function.
  release_id uuid not null,
  article_id text not null check (length(article_id) between 1 and 64),
  factory_profile_id text not null check (length(factory_profile_id) between 1 and 120),
  fabric_key text not null check (length(fabric_key) between 1 and 120),
  -- {"M": 10, "L": 5}. A sample is one piece of each size chosen.
  sizes jsonb not null check (jsonb_typeof(sizes) = 'object' and pg_column_size(sizes) < 8192),
  pieces integer not null check (pieces between 1 and 999999),
  -- What the app flagged and the brand went ahead with: [{ "code": text, "text": text }].
  flags jsonb not null default '[]'::jsonb check (jsonb_typeof(flags) = 'array' and pg_column_size(flags) < 8192),
  -- The order in production this became. Not a key: ops history is separate.
  order_id uuid not null,
  -- Makes a double press one order: the same key in the same brand is one run.
  request_key text not null check (length(request_key) between 8 and 64),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (brand_id, request_key),
  foreign key (product_id, brand_id) references public.brand_products (id, brand_id) on delete cascade
);

comment on table public.brand_runs is
  'A sample or a run of a product: a size breakdown, the release it was frozen from and the ops order it became. Append-only. Written by the server only.';

create index brand_runs_product_idx on public.brand_runs (brand_id, product_id, created_at desc);

create table public.brand_product_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  product_id uuid not null,
  kind text not null check (kind in ('listed', 'sample_ordered', 'sample_confirmed', 'run_confirmed', 'run_ordered')),
  from_stage text check (from_stage in ('idea', 'sample', 'run')),
  to_stage text not null check (to_stage in ('idea', 'sample', 'run')),
  run_id uuid,
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  foreign key (product_id, brand_id) references public.brand_products (id, brand_id) on delete cascade
);

comment on table public.brand_product_events is
  'The history of a product. Append-only. Written by the brand run functions only.';

create index brand_product_events_product_idx on public.brand_product_events (brand_id, product_id, at, id);

-- Runs and events can never be changed or removed. The delete is let through only when the product
-- itself is gone (its design or its brand was deleted).
create function private.refuse_brand_run_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.brand_products p where p.id = old.product_id) then
    return old;
  end if;
  raise exception 'A brand run and its history can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_brand_run_change() from public, anon, authenticated;

create trigger brand_runs_are_append_only
  before update or delete on public.brand_runs
  for each row execute function private.refuse_brand_run_change();
create trigger brand_runs_are_not_truncated
  before truncate on public.brand_runs
  for each statement execute function private.refuse_brand_run_change();
create trigger brand_product_events_are_append_only
  before update or delete on public.brand_product_events
  for each row execute function private.refuse_brand_run_change();
create trigger brand_product_events_are_not_truncated
  before truncate on public.brand_product_events
  for each statement execute function private.refuse_brand_run_change();

revoke all on public.brand_products, public.brand_runs, public.brand_product_events
  from public, anon, authenticated, service_role;
grant select on public.brand_products, public.brand_runs, public.brand_product_events to authenticated, service_role;

alter table public.brand_products enable row level security;
alter table public.brand_runs enable row level security;
alter table public.brand_product_events enable row level security;

create policy "members read their brand's products"
  on public.brand_products for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's runs"
  on public.brand_runs for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's product history"
  on public.brand_product_events for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on any of these, on purpose.

create function private.brand_products_limit()
returns integer language sql immutable set search_path = '' as $$ select 200 $$;
revoke all on function private.brand_products_limit() from public, anon, authenticated;

-- Lists a design as a product. Returns the product id.
create function public.create_brand_product(p_brand_id uuid, p_user_id uuid, p_project_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this product list.' using errcode = '42501';
  end if;
  select p.current_version into v_version
  from public.projects p where p.id = p_project_id and p.brand_id = p_brand_id;
  if not found then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('brand_products:' || p_brand_id::text, 0));
  if (select count(*) from public.brand_products x where x.brand_id = p_brand_id) >= private.brand_products_limit() then
    raise exception 'A brand can list 200 products.' using errcode = 'P0001', hint = 'too_many_products';
  end if;
  insert into public.brand_products (brand_id, project_id, name, design_version, created_by)
  values (p_brand_id, p_project_id, btrim(p_name), v_version, p_user_id)
  returning id into v_id;
  insert into public.brand_product_events (brand_id, product_id, kind, from_stage, to_stage, actor)
  values (p_brand_id, v_id, 'listed', null, 'idea', p_user_id);
  return v_id;
end;
$$;

-- Sends a sample or a run to ops through the documented contract and records it. A sample is one
-- piece of each size chosen and is allowed until the product reaches the run stage; a run is allowed
-- only at the run stage. The article comes from the design, the version from the release.
-- Retrying with the same p_request_key answers with the run already made (created = false).
create function public.submit_brand_run(
  p_brand_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_kind text,
  p_release_id uuid,
  p_factory_profile_id text,
  p_fabric_key text,
  p_sizes jsonb,
  p_flags jsonb,
  p_request_key text
)
returns table (run_id uuid, order_id uuid, status text, cutoff_at timestamptz, promised_on date, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.brand_products;
  v_existing public.brand_runs;
  v_article text;
  v_version integer;
  v_pieces integer := 0;
  v_size record;
  v_run uuid := gen_random_uuid();
  v_order record;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not order for this brand.' using errcode = '42501';
  end if;
  if p_kind not in ('sample', 'run') or p_request_key is null or length(p_request_key) not between 8 and 64
     or p_flags is null or jsonb_typeof(p_flags) <> 'array' then
    raise exception 'The order is not understood.' using errcode = '22023', hint = 'invalid_input';
  end if;

  select * into v_product from public.brand_products x
  where x.id = p_product_id and x.brand_id = p_brand_id for update;
  if not found then
    raise exception 'That product does not exist.' using errcode = 'P0002';
  end if;

  select r.* into v_existing from public.brand_runs r where r.brand_id = p_brand_id and r.request_key = p_request_key;
  if found then
    if v_existing.product_id <> p_product_id then
      raise exception 'That request key belongs to another product.' using errcode = 'P0001', hint = 'request_key_conflict';
    end if;
    return query
      select v_existing.id, o.id, o.status, o.cutoff_at, o.promised_on, false
      from public.ops_orders o where o.id = v_existing.order_id;
    return;
  end if;

  if (p_kind = 'sample' and v_product.stage = 'run') or (p_kind = 'run' and v_product.stage <> 'run') then
    raise exception 'This product is not at the right stage for that order.' using errcode = 'P0001', hint = 'stage_blocks';
  end if;

  if p_sizes is null or jsonb_typeof(p_sizes) <> 'object' then
    raise exception 'Sizes must be an object of size labels.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  for v_size in select key, value from jsonb_each(p_sizes) loop
    if jsonb_typeof(v_size.value) <> 'number' or (v_size.value #>> '{}') !~ '^[0-9]+$'
       or (v_size.value #>> '{}')::numeric not between 1 and 99999
       or (p_kind = 'sample' and (v_size.value #>> '{}')::numeric <> 1) then
      raise exception 'Each size needs a whole number of pieces; a sample is one piece of each size.'
        using errcode = '22023', hint = 'invalid_sizes';
    end if;
    v_pieces := v_pieces + (v_size.value #>> '{}')::integer;
  end loop;

  -- The release must be this product's own design's, in this brand.
  select (r.snapshot ->> 'specVersion')::integer, p.garment_type into v_version, v_article
  from public.production_releases r
  join public.projects p on p.id = r.project_id and p.brand_id = r.brand_id
  where r.id = p_release_id and r.brand_id = p_brand_id and r.project_id = v_product.project_id;
  if not found then
    raise exception 'That release does not exist.' using errcode = 'P0002', hint = 'release_not_found';
  end if;

  select o.* into v_order from public.submit_order_for_production(
    p_release_id, 'brand-run:' || p_brand_id::text || ':' || p_request_key,
    p_factory_profile_id, p_fabric_key, v_article, p_sizes
  ) o;

  insert into public.brand_runs (
    id, brand_id, product_id, kind, release_id, article_id, factory_profile_id, fabric_key,
    sizes, pieces, flags, order_id, request_key, created_by
  ) values (
    v_run, p_brand_id, p_product_id, p_kind, p_release_id, v_article, btrim(p_factory_profile_id), btrim(p_fabric_key),
    p_sizes, v_pieces, p_flags, v_order.order_id, p_request_key, p_user_id
  );

  update public.brand_products set design_version = coalesce(v_version, design_version), updated_at = now()
  where id = p_product_id;
  insert into public.brand_product_events (brand_id, product_id, kind, from_stage, to_stage, run_id, actor)
  values (p_brand_id, p_product_id, case when p_kind = 'sample' then 'sample_ordered' else 'run_ordered' end,
          v_product.stage, v_product.stage, v_run, p_user_id);

  return query select v_run, v_order.order_id, v_order.status, v_order.cutoff_at, v_order.promised_on, true;
end;
$$;

-- The brand confirms a stage: idea to sample needs a sample order already sent; sample to run is the
-- brand's own confirmation that it is happy to go on. Forward only, one step.
create function public.confirm_brand_product_stage(p_brand_id uuid, p_user_id uuid, p_product_id uuid, p_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.brand_products;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this product.' using errcode = '42501';
  end if;
  select * into v_product from public.brand_products x
  where x.id = p_product_id and x.brand_id = p_brand_id for update;
  if not found then
    raise exception 'That product does not exist.' using errcode = 'P0002';
  end if;
  if not ((v_product.stage = 'idea' and p_to = 'sample') or (v_product.stage = 'sample' and p_to = 'run')) then
    raise exception 'A product moves forward one stage at a time.' using errcode = 'P0001', hint = 'stage_move';
  end if;
  if p_to = 'sample' and not exists (
    select 1 from public.brand_runs r where r.product_id = p_product_id and r.brand_id = p_brand_id and r.kind = 'sample'
  ) then
    raise exception 'Order a sample before moving to the sample stage.' using errcode = 'P0001', hint = 'need_sample_order';
  end if;
  update public.brand_products set stage = p_to, updated_at = now() where id = p_product_id;
  insert into public.brand_product_events (brand_id, product_id, kind, from_stage, to_stage, actor)
  values (p_brand_id, p_product_id, case when p_to = 'sample' then 'sample_confirmed' else 'run_confirmed' end,
          v_product.stage, p_to, p_user_id);
  return p_to;
end;
$$;

revoke all on function public.create_brand_product(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.submit_brand_run(uuid, uuid, uuid, text, uuid, text, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.confirm_brand_product_stage(uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.create_brand_product(uuid, uuid, uuid, text) to service_role;
grant execute on function public.submit_brand_run(uuid, uuid, uuid, text, uuid, text, text, jsonb, jsonb, text) to service_role;
grant execute on function public.confirm_brand_product_stage(uuid, uuid, uuid, text) to service_role;
