-- The collection plan and the line plan (plans/platform-v5.md Z4, spec F-S10; decision 0085).
--
-- A founder plans a whole drop rather than one product: frames on a board ("Core", "Training",
-- "Matchday"), a style card in each, and a line plan table that prices every line from the factory
-- tiers of decision 0071, with freight and duty to the destination added.
--
-- It is built on what already exists and changes none of it:
--   * brand_products (decision 0062), so a style card can point at a product the brand has listed
--     and the board can show the design's own render;
--   * base_articles (decision 0066), for the article code, the production class and the HS code
--     the duty rate is read by;
--   * price_tiers and country_rules (decision 0071), which hold every price, duty rate and freight
--     day. Nothing here copies a price: the line plan reads the tiers at the quantity planned.
--
-- Money is integer minor units. One collection has one currency, named on the collection row, and
-- every money column in these tables is in the minor units of that currency. Null means "not set",
-- never zero: a style with no retail price on it yet has no margin, and the plan says so.
--
-- There is no Store here (owner decision 1). "Create drop" writes a payload into
-- collection_drops for the Store to collect; there is no cart, no checkout, no payment, no
-- storefront and no payout in this file, and no column that could hold one.
--
-- Every table is brand-scoped with row level security on, except collection_freight_rates, which is
-- platform data every signed-in member may read. Members read their own brand's rows; nobody writes
-- directly, not even the server's own key. Each write is a SECURITY DEFINER function only
-- service_role may run, which checks the caller's role itself (the club rule can_manage_kit, as the
-- brand runs and the golden samples do).

-- ---------------------------------------------------------------------------------------------
-- Freight and duty to the destination (platform data).
--
-- country_rules already holds the duty rate by HS code and the freight days; it holds no freight
-- cost, because nothing before this needed one. The per-piece freight cost and the basis duty is
-- charged on live here, as rows, seeded as labelled placeholders with a question for the owner
-- (decision 0085): neither figure came from a carrier or a customs adviser.

create table public.collection_freight_rates (
  id uuid primary key default gen_random_uuid(),
  -- ISO 3166 alpha-2, matching country_rules.country.
  country text not null unique check (country ~ '^[A-Z]{2}$'),
  -- Freight to this destination, per piece, in the minor units of the currency below. Null: not agreed.
  per_piece_minor integer check (per_piece_minor between 0 and 100000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- What duty is charged on: the goods alone, or the goods plus the freight (a CIF basis).
  duty_basis text not null default 'goods_and_freight' check (duty_basis in ('goods', 'goods_and_freight')),
  -- The rulebook entry that explains this row ('R-GAP-000' while none is written).
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 200),
  updated_at timestamptz not null default now()
);

comment on table public.collection_freight_rates is
  'Platform data: freight per piece to a destination and the basis duty is charged on. Read by signed-in members, written by the server only (decision 0085).';

-- ---------------------------------------------------------------------------------------------
-- The collection plan.

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80 and name = btrim(name)),
  -- Where the goods are landed. Freight and duty are read for this country.
  destination_country text not null check (destination_country ~ '^[A-Z]{2}$'),
  -- The currency the whole plan is in (spec F-S8: UK in GBP, Australia in AUD).
  currency text not null check (currency in ('GBP', 'AUD')),
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (brand_id, name)
);

comment on table public.collections is
  'A range plan of one brand: its name, its destination and its currency (spec F-S10). Written by the server only.';

create index collections_brand_idx on public.collections (brand_id, updated_at desc, id);

-- A frame on the board: a group of styles the founder named.
create table public.collection_frames (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  collection_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 60 and name = btrim(name)),
  -- Where the frame sits on the dotted canvas, in whole pixels from the origin.
  x integer not null default 0 check (x between -100000 and 100000),
  y integer not null default 0 check (y between -100000 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (collection_id, name),
  foreign key (collection_id, brand_id) references public.collections (id, brand_id) on delete cascade
);

comment on table public.collection_frames is
  'A named group on the collection board, with its place on the canvas. Written by the server only.';

create index collection_frames_collection_idx on public.collection_frames (collection_id, name);

create table public.collection_styles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  collection_id uuid not null,
  -- Null while a style sits loose on the canvas, in no frame.
  frame_id uuid,
  -- The product this style plans, when the brand has listed one. Null while it is only a plan.
  product_id uuid,
  name text not null check (length(btrim(name)) between 1 and 80 and name = btrim(name)),
  -- Spec F-S10: Draft, Sampling, Approved, Ordered.
  status text not null default 'draft' check (status in ('draft', 'sampling', 'approved', 'ordered')),
  colourway text not null default '' check (length(colourway) <= 60),
  -- The base article and fabric the line is priced from. Null: not chosen yet, and the line has no price.
  article_code text check (article_code ~ '^[A-Z]{3}-[A-Z]{2}-[0-9]{2}$'),
  fabric_code text check (fabric_code ~ '^F-[A-Z0-9]+(-[A-Z0-9]+)*$'),
  production_class text check (production_class in ('A', 'B')),
  -- The price the brand sells at, in the minor units of the collection's currency. Null: not set.
  wholesale_minor integer check (wholesale_minor between 0 and 100000000),
  rrp_minor integer check (rrp_minor between 0 and 100000000),
  -- The wholesale share of the planned units, in basis points: 6000 is 60% wholesale, 40% D2C.
  wholesale_split_bp integer not null default 0 check (wholesale_split_bp between 0 and 10000),
  x integer not null default 0 check (x between -100000 and 100000),
  y integer not null default 0 check (y between -100000 and 100000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  foreign key (collection_id, brand_id) references public.collections (id, brand_id) on delete cascade,
  foreign key (frame_id, brand_id) references public.collection_frames (id, brand_id) on delete set null,
  foreign key (product_id, brand_id) references public.brand_products (id, brand_id) on delete set null
);

comment on table public.collection_styles is
  'One style card of a collection plan: its status, colourway, prices and wholesale split. Written by the server only.';

create index collection_styles_collection_idx on public.collection_styles (collection_id, created_at, id);
create index collection_styles_frame_idx on public.collection_styles (frame_id) where frame_id is not null;

-- The size rows a line plan row expands into. The planned quantity of a style is the sum of these,
-- so a plan can never show a total its own size rows do not add up to.
create table public.collection_style_sizes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  style_id uuid not null,
  size_label text not null check (length(btrim(size_label)) between 1 and 16),
  qty integer not null check (qty between 0 and 999999),
  unique (style_id, size_label),
  foreign key (style_id, brand_id) references public.collection_styles (id, brand_id) on delete cascade
);

comment on table public.collection_style_sizes is
  'The planned pieces per size of one style. The style''s quantity is their sum. Written by the server only.';

create index collection_style_sizes_style_idx on public.collection_style_sizes (style_id, size_label);

-- ---------------------------------------------------------------------------------------------
-- The drop payload.
--
-- "Create drop" (spec F-S10) exports what the Store would need to open a drop: the styles, their
-- sizes as targets, and the prices the plan carries. It is a payload and nothing else. No row here
-- reaches a storefront, and this platform never collects money for it (owner decision 1).
-- Append-only: an exported payload is a record of what was handed over, so it is never rewritten.

create table public.collection_drops (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  collection_id uuid not null,
  -- 1, then 2 on the next export, and so on.
  version integer not null check (version >= 1),
  -- The payload the Store collects. Checked by the app against its own schema before it is written.
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 262144),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (collection_id, version),
  foreign key (collection_id, brand_id) references public.collections (id, brand_id) on delete cascade
);

comment on table public.collection_drops is
  'An exported drop payload for the Store to collect (spec F-S10). Append-only. Written by export_collection_drop only.';

create index collection_drops_collection_idx on public.collection_drops (collection_id, version desc);

create function private.refuse_collection_drop_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A collection being removed takes its drops with it; nothing else may change one.
  if tg_op = 'DELETE' and not exists (select 1 from public.collections c where c.id = old.collection_id) then
    return old;
  end if;
  raise exception 'An exported drop payload can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger collection_drops_append_only
  before update or delete on public.collection_drops
  for each row execute function private.refuse_collection_drop_change();

create trigger collection_drops_no_truncate
  before truncate on public.collection_drops
  for each statement execute function private.refuse_collection_drop_change();

-- ---------------------------------------------------------------------------------------------
-- Rights and row level security.

revoke all on function private.refuse_collection_drop_change() from public, anon, authenticated;

revoke all on public.collections, public.collection_frames, public.collection_styles,
  public.collection_style_sizes, public.collection_drops from public, anon, authenticated, service_role;
grant select on public.collections, public.collection_frames, public.collection_styles,
  public.collection_style_sizes, public.collection_drops to authenticated;

revoke all on public.collection_freight_rates from public, anon, authenticated, service_role;
grant select on public.collection_freight_rates to authenticated;
grant select, insert, update on public.collection_freight_rates to service_role;

alter table public.collections enable row level security;
alter table public.collection_frames enable row level security;
alter table public.collection_styles enable row level security;
alter table public.collection_style_sizes enable row level security;
alter table public.collection_drops enable row level security;
alter table public.collection_freight_rates enable row level security;

create policy "members read their brand's collections"
  on public.collections for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's collection frames"
  on public.collection_frames for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's collection styles"
  on public.collection_styles for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's planned sizes"
  on public.collection_style_sizes for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's exported drops"
  on public.collection_drops for select to authenticated
  using (private.is_member(brand_id));

create policy "signed-in members read the freight rates"
  on public.collection_freight_rates for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------------------------
-- Writes. Every one checks can_manage_kit itself and is callable by service_role only.

create function public.create_collection(
  p_brand_id uuid, p_user_id uuid, p_name text, p_destination text, p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not plan a collection for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.country_rules r where r.country = p_destination and r.selling_enabled) then
    raise exception 'Knitwright does not deliver to that country yet.'
      using errcode = 'P0001', hint = 'destination_closed';
  end if;
  insert into public.collections (brand_id, name, destination_country, currency, created_by)
  values (p_brand_id, btrim(p_name), p_destination, p_currency, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.save_collection_frame(
  p_brand_id uuid, p_user_id uuid, p_collection_id uuid, p_frame_id uuid, p_name text, p_x integer, p_y integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not plan a collection for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.collections c where c.id = p_collection_id and c.brand_id = p_brand_id) then
    raise exception 'That collection does not exist.' using errcode = 'P0002', hint = 'collection_not_found';
  end if;
  if p_frame_id is null then
    insert into public.collection_frames (brand_id, collection_id, name, x, y)
    values (p_brand_id, p_collection_id, btrim(p_name), coalesce(p_x, 0), coalesce(p_y, 0))
    returning id into v_id;
    return v_id;
  end if;
  update public.collection_frames
     set name = btrim(p_name), x = coalesce(p_x, x), y = coalesce(p_y, y), updated_at = now()
   where id = p_frame_id and brand_id = p_brand_id and collection_id = p_collection_id
  returning id into v_id;
  if v_id is null then
    raise exception 'That group does not exist.' using errcode = 'P0002', hint = 'frame_not_found';
  end if;
  return v_id;
end;
$$;

create function public.save_collection_style(
  p_brand_id uuid, p_user_id uuid, p_collection_id uuid, p_style_id uuid, p_frame_id uuid,
  p_product_id uuid, p_name text, p_status text, p_colourway text, p_article_code text,
  p_fabric_code text, p_production_class text, p_wholesale_minor integer, p_rrp_minor integer,
  p_wholesale_split_bp integer, p_sizes jsonb, p_x integer, p_y integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not plan a collection for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.collections c where c.id = p_collection_id and c.brand_id = p_brand_id) then
    raise exception 'That collection does not exist.' using errcode = 'P0002', hint = 'collection_not_found';
  end if;
  if p_frame_id is not null and not exists (
    select 1 from public.collection_frames f
    where f.id = p_frame_id and f.brand_id = p_brand_id and f.collection_id = p_collection_id
  ) then
    raise exception 'That group does not exist.' using errcode = 'P0002', hint = 'frame_not_found';
  end if;
  if p_product_id is not null and not exists (
    select 1 from public.brand_products p where p.id = p_product_id and p.brand_id = p_brand_id
  ) then
    raise exception 'That product does not exist.' using errcode = 'P0002', hint = 'product_not_found';
  end if;
  if p_sizes is not null and jsonb_typeof(p_sizes) <> 'object' then
    raise exception 'The planned sizes are pieces per size.' using errcode = 'P0001', hint = 'sizes_not_an_object';
  end if;

  if p_style_id is null then
    insert into public.collection_styles (
      brand_id, collection_id, frame_id, product_id, name, status, colourway, article_code, fabric_code,
      production_class, wholesale_minor, rrp_minor, wholesale_split_bp, x, y, created_by
    ) values (
      p_brand_id, p_collection_id, p_frame_id, p_product_id, btrim(p_name), coalesce(p_status, 'draft'),
      coalesce(btrim(p_colourway), ''), p_article_code, p_fabric_code, p_production_class, p_wholesale_minor,
      p_rrp_minor, coalesce(p_wholesale_split_bp, 0), coalesce(p_x, 0), coalesce(p_y, 0), p_user_id
    )
    returning id into v_id;
  else
    update public.collection_styles
       set frame_id = p_frame_id,
           product_id = p_product_id,
           name = btrim(p_name),
           status = coalesce(p_status, status),
           colourway = coalesce(btrim(p_colourway), ''),
           article_code = p_article_code,
           fabric_code = p_fabric_code,
           production_class = p_production_class,
           wholesale_minor = p_wholesale_minor,
           rrp_minor = p_rrp_minor,
           wholesale_split_bp = coalesce(p_wholesale_split_bp, wholesale_split_bp),
           x = coalesce(p_x, x),
           y = coalesce(p_y, y),
           updated_at = now()
     where id = p_style_id and brand_id = p_brand_id and collection_id = p_collection_id
    returning id into v_id;
    if v_id is null then
      raise exception 'That style does not exist.' using errcode = 'P0002', hint = 'style_not_found';
    end if;
  end if;

  if p_sizes is not null then
    delete from public.collection_style_sizes where style_id = v_id;
    insert into public.collection_style_sizes (brand_id, style_id, size_label, qty)
    select p_brand_id, v_id, btrim(size.key), (size.value #>> '{}')::integer
    from jsonb_each(p_sizes) as size
    where btrim(size.key) <> '';
  end if;
  return v_id;
end;
$$;

create function public.remove_collection_style(p_brand_id uuid, p_user_id uuid, p_style_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not plan a collection for this brand.' using errcode = '42501';
  end if;
  delete from public.collection_styles where id = p_style_id and brand_id = p_brand_id;
end;
$$;

/*
 * "Create drop": the payload the Store collects, written as it was handed over. The app builds and
 * checks the payload; this function only records it, with the next version number. It takes no
 * money and reaches no storefront (owner decision 1).
 */
create function public.export_collection_drop(
  p_brand_id uuid, p_user_id uuid, p_collection_id uuid, p_payload jsonb
)
returns table (id uuid, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not create a drop for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.collections c where c.id = p_collection_id and c.brand_id = p_brand_id) then
    raise exception 'That collection does not exist.' using errcode = 'P0002', hint = 'collection_not_found';
  end if;
  if not exists (select 1 from public.collection_styles s where s.collection_id = p_collection_id) then
    raise exception 'A drop needs at least one style in the plan.' using errcode = 'P0001', hint = 'no_styles';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('collection_drops:' || p_collection_id::text, 0));
  select coalesce(max(d.version), 0) + 1 into v_next
  from public.collection_drops d where d.collection_id = p_collection_id;

  insert into public.collection_drops (brand_id, collection_id, version, payload, created_by)
  values (p_brand_id, p_collection_id, v_next, p_payload, p_user_id)
  returning collection_drops.id into v_id;
  return query select v_id, v_next;
end;
$$;

revoke all on function public.create_collection(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.save_collection_frame(uuid, uuid, uuid, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.save_collection_style(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, integer, integer, integer, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.remove_collection_style(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.export_collection_drop(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.create_collection(uuid, uuid, text, text, text) to service_role;
grant execute on function public.save_collection_frame(uuid, uuid, uuid, uuid, text, integer, integer) to service_role;
grant execute on function public.save_collection_style(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, integer, integer, integer, jsonb, integer, integer) to service_role;
grant execute on function public.remove_collection_style(uuid, uuid, uuid) to service_role;
grant execute on function public.export_collection_drop(uuid, uuid, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Seeds.
--
-- Freight per piece and the duty basis for the two open markets. Neither figure came from a carrier
-- or a customs adviser, and both say so: the line plan prints the label beside every landed cost.
-- rule_id is R-GAP-000 because no rulebook entry covers freight or the duty basis (decision 0085).

insert into public.collection_freight_rates (country, per_piece_minor, currency, duty_basis, label) values
  ('GB', 120, 'GBP', 'goods_and_freight', 'Placeholder freight, not a carrier quote'),
  ('AU', 230, 'AUD', 'goods_and_freight', 'Placeholder freight, not a carrier quote');
