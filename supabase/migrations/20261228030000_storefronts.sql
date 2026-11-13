-- Storefronts, listings, drops and made-to-order batches (plans/platform-v6.md, workstream C3; decision 0154;
-- spec F-L5, 09 screen 23).
--
--   * storefronts               a brand's shop at <slug>.knitwright.com: its name, whether it is live, its
--                               returns policy and the EU responsible person for GPSR.
--   * listings                  one product as it is sold: words, pictures, personalisation, a retail price per
--                               size, the release and fabric it is made from, and where it is published. C4
--                               (sales channels) reads this table to push a listing to Shopify.
--   * storefront_drops          a pre-order window (opens, closes, an optional target), made from a collection plan.
--   * storefront_drop_listings  the listings a drop opens and closes.
--   * shop_orders               one shopper's purchase. Its money is an ordinary C1 card payment
--                               (order_payments, purpose 'order', no lines), so Stripe Checkout, the webhook, the
--                               refunds and the F-G4 figures are C1's own.
--   * storefront_batches        the paid shop orders of one listing at a cut-off (made-to-order, weekly) or at a
--                               drop's close, sent to production as ONE order through submit_brand_run, so the
--                               payment gate (0152) and the D1 validation gate (0132) apply to it.
--
-- Money is integer minor units, GBP or AUD. Members read their brand's rows; browsers write nothing. The listing,
-- storefront and drop tables are written by the server after its own permission checks; the money tables only
-- through the functions below.

create table public.storefronts (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null check (length(btrim(name)) between 1 and 80),
  status text not null default 'draft' check (status in ('draft', 'live')),
  returns_policy text not null check (length(btrim(returns_policy)) between 1 and 4000),
  eu_responsible_person text check (eu_responsible_person is null or length(btrim(eu_responsible_person)) between 1 and 300),
  -- The person whose name the storefront's batches are ordered under: whoever last put the storefront live.
  batch_owner uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  product_id uuid not null unique,
  title text not null default '' check (length(title) <= 140),
  description text not null default '' check (length(description) <= 5000),
  tags text[] not null default '{}' check (cardinality(tags) <= 13),
  show_size_table boolean not null default true,
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
  personalisation boolean not null default false,
  name_max integer not null default 12 check (name_max between 1 and 20),
  number_min integer not null default 0 check (number_min between 0 and 999),
  number_max integer not null default 99 check (number_max between 0 and 999),
  personalisation_minor integer not null default 0 check (personalisation_minor between 0 and 100000),
  currency text not null default 'GBP' check (currency in ('GBP', 'AUD')),
  -- Retail price per size label, in minor units: {"M": 4500}.
  prices jsonb not null default '{}'::jsonb check (jsonb_typeof(prices) = 'object'),
  mode text not null default 'made_to_order' check (mode in ('made_to_order', 'drop')),
  channel text not null default 'storefront' check (channel in ('storefront', 'shopify', 'team_store')),
  hide_until_ready boolean not null default true,
  sync_mockups boolean not null default true,
  release_id uuid references public.production_releases (id) on delete set null,
  fabric_key text check (fabric_key is null or length(btrim(fabric_key)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  foreign key (product_id, brand_id) references public.brand_products (id, brand_id) on delete cascade,
  constraint listings_numbers_in_order check (number_max >= number_min),
  constraint listings_published_names_what_is_made check (
    status <> 'published' or (release_id is not null and fabric_key is not null and published_at is not null)
  )
);

create index listings_brand on public.listings (brand_id, updated_at desc);

create table public.storefront_drops (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 80),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  target_units integer check (target_units is null or target_units between 1 and 100000),
  status text not null default 'scheduled' check (status in ('scheduled', 'closed', 'cancelled')),
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  constraint storefront_drops_close_after_open check (closes_at > opens_at)
);

create index storefront_drops_brand on public.storefront_drops (brand_id, opens_at desc);

create table public.storefront_drop_listings (
  drop_id uuid not null,
  listing_id uuid not null,
  brand_id uuid not null,
  target_units integer check (target_units is null or target_units between 1 and 100000),
  primary key (drop_id, listing_id),
  foreign key (drop_id, brand_id) references public.storefront_drops (id, brand_id) on delete cascade,
  foreign key (listing_id, brand_id) references public.listings (id, brand_id) on delete cascade
);

-- A brand's money records outlive the brand and the listing (brand_id and listing_id set null), as C1's do.
create table public.storefront_batches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  drop_id uuid references public.storefront_drops (id) on delete set null,
  kind text not null check (kind in ('weekly', 'drop')),
  cutoff_at timestamptz not null,
  sizes jsonb not null check (jsonb_typeof(sizes) = 'object'),
  pieces integer not null check (pieces between 1 and 1000000),
  status text not null default 'open' check (status in ('open', 'sent', 'refused')),
  payment_id uuid references public.order_payments (id) on delete set null,
  order_id uuid references public.ops_orders (id) on delete set null,
  message text check (message is null or length(message) <= 500),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint storefront_batches_settled_says_when check ((status = 'open') = (settled_at is null))
);

create unique index storefront_batches_weekly on public.storefront_batches (listing_id, cutoff_at) where kind = 'weekly';
create unique index storefront_batches_drop on public.storefront_batches (listing_id, drop_id) where kind = 'drop';
create index storefront_batches_brand on public.storefront_batches (brand_id, created_at desc);

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  drop_id uuid references public.storefront_drops (id) on delete set null,
  payment_id uuid not null unique references public.order_payments (id),
  size text not null check (length(btrim(size)) between 1 and 16),
  qty integer not null check (qty between 1 and 20),
  unit_minor bigint not null check (unit_minor > 0),
  personalisation_minor bigint not null default 0 check (personalisation_minor >= 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('GBP', 'AUD')),
  personal_name text check (personal_name is null or length(btrim(personal_name)) between 1 and 20),
  personal_number integer check (personal_number is null or personal_number between 0 and 999),
  buyer_email text not null check (length(buyer_email) between 3 and 254 and position('@' in buyer_email) > 1),
  -- F-L5: made-to-order sells to UK and Australia buyers only; drops ship to the same two markets for now.
  buyer_country text not null check (buyer_country in ('GB', 'AU')),
  -- F-L5: "the policy and a size-confirmation tick are shown before payment".
  size_confirmed boolean not null check (size_confirmed),
  returns_accepted boolean not null check (returns_accepted),
  -- The sha-256 of the token in the shopper's return link, which is the only key to this order's page.
  access_hash text not null check (access_hash ~ '^[0-9a-f]{64}$'),
  batch_id uuid references public.storefront_batches (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint shop_orders_amount_adds_up check (amount_minor = (unit_minor + personalisation_minor) * qty)
);

create index shop_orders_brand on public.shop_orders (brand_id, created_at desc);
create index shop_orders_waiting on public.shop_orders (listing_id, created_at) where batch_id is null;

-- ---------------------------------------------------------------------------------------------
-- Who reads what. Members their own brand's rows; platform admins everything; browsers write nothing.

revoke all on public.storefronts, public.listings, public.storefront_drops, public.storefront_drop_listings,
  public.storefront_batches, public.shop_orders from public, anon, authenticated;
grant select on public.storefronts, public.listings, public.storefront_drops, public.storefront_drop_listings,
  public.storefront_batches, public.shop_orders to authenticated;
-- The money tables are written only through the functions below.
revoke insert, update, delete, truncate on public.storefront_batches, public.shop_orders from service_role;

alter table public.storefronts enable row level security;
alter table public.listings enable row level security;
alter table public.storefront_drops enable row level security;
alter table public.storefront_drop_listings enable row level security;
alter table public.storefront_batches enable row level security;
alter table public.shop_orders enable row level security;

create policy "members and admins read storefronts" on public.storefronts for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));
create policy "members and admins read listings" on public.listings for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));
create policy "members and admins read drops" on public.storefront_drops for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));
create policy "members and admins read drop listings" on public.storefront_drop_listings for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));
create policy "members and admins read storefront batches" on public.storefront_batches for select to authenticated
  using (private.is_platform_admin() or (brand_id is not null and private.is_member(brand_id)));
create policy "members and admins read shop orders" on public.shop_orders for select to authenticated
  using (private.is_platform_admin() or (brand_id is not null and private.is_member(brand_id)));

-- ---------------------------------------------------------------------------------------------
-- A shopper's purchase. The price is read from the listing here, never from the browser: the card is charged
-- (retail of the size + personalisation) x quantity. The listing must be published on a live storefront; a drop
-- listing sells only while one of its drops is open. Opens a C1 card payment with no lines; the app then asks the
-- processor for a checkout and attaches it with attach_payment_session.

create function public.open_shop_order(
  p_listing_id uuid,
  p_size text,
  p_qty integer,
  p_name text,
  p_number integer,
  p_email text,
  p_country text,
  p_size_confirmed boolean,
  p_returns_accepted boolean,
  p_access_hash text
)
returns table (shop_order_id uuid, payment_id uuid, amount_minor bigint, currency text, brand_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_listing public.listings;
  v_unit bigint;
  v_extra bigint := 0;
  v_drop uuid;
  v_amount bigint;
  v_payment uuid;
  v_order uuid;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  select * into v_listing from public.listings l where l.id = p_listing_id;
  if not found or v_listing.status <> 'published'
     or not exists (select 1 from public.storefronts s where s.brand_id = v_listing.brand_id and s.status = 'live') then
    raise exception 'That product is not on sale.' using errcode = 'P0002', hint = 'not_on_sale';
  end if;
  if p_qty is null or p_qty not between 1 and 20 then
    raise exception 'Choose between 1 and 20.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if p_size is null or coalesce(jsonb_typeof(v_listing.prices -> p_size), '') <> 'number' then
    raise exception 'That size is not sold.' using errcode = '22023', hint = 'size_not_sold';
  end if;
  v_unit := (v_listing.prices ->> p_size)::bigint;
  if v_unit <= 0 then
    raise exception 'That size is not sold.' using errcode = '22023', hint = 'size_not_sold';
  end if;

  if v_name is not null or p_number is not null then
    if not v_listing.personalisation then
      raise exception 'This product is not personalised.' using errcode = '22023', hint = 'invalid_input';
    end if;
    if v_name is not null and length(v_name) > v_listing.name_max then
      raise exception 'The name is too long.' using errcode = '22023', hint = 'invalid_input';
    end if;
    if p_number is not null and p_number not between v_listing.number_min and v_listing.number_max then
      raise exception 'That number is not allowed.' using errcode = '22023', hint = 'invalid_input';
    end if;
    v_extra := v_listing.personalisation_minor;
  end if;

  if v_listing.mode = 'drop' then
    select d.id into v_drop
    from public.storefront_drops d
    join public.storefront_drop_listings dl on dl.drop_id = d.id
    where dl.listing_id = v_listing.id and d.status = 'scheduled' and d.opens_at <= now() and d.closes_at > now()
    order by d.closes_at
    limit 1;
    if v_drop is null then
      raise exception 'This drop is not open.' using errcode = 'P0001', hint = 'drop_closed';
    end if;
  end if;

  v_amount := (v_unit + v_extra) * p_qty;
  insert into public.order_payments (
    brand_id, purpose, method, status, currency, order_value_minor, amount_minor, schedule, balance_due_minor, description
  ) values (
    v_listing.brand_id, 'order', 'card', 'open', v_listing.currency, v_amount, v_amount, 'full', 0,
    left('Storefront order: ' || coalesce(nullif(btrim(v_listing.title), ''), 'product'), 300)
  ) returning id into v_payment;

  insert into public.shop_orders (
    brand_id, listing_id, drop_id, payment_id, size, qty, unit_minor, personalisation_minor, amount_minor, currency,
    personal_name, personal_number, buyer_email, buyer_country, size_confirmed, returns_accepted, access_hash
  ) values (
    v_listing.brand_id, v_listing.id, v_drop, v_payment, p_size, p_qty, v_unit, v_extra, v_amount, v_listing.currency,
    v_name, p_number, lower(btrim(p_email)), p_country, coalesce(p_size_confirmed, false), coalesce(p_returns_accepted, false),
    p_access_hash
  ) returning id into v_order;

  return query select v_order, v_payment, v_amount, v_listing.currency, v_listing.brand_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- A batch: the paid, not yet batched shop orders of one listing, at a weekly cut-off (made-to-order: orders made
-- before it, outside any drop) or at a drop's close (that drop's orders). Answers the batch's id, or null when
-- there is nothing to batch. Idempotent per (listing, cut-off) and per (listing, drop).

create function public.cut_storefront_batch(p_listing_id uuid, p_drop_id uuid, p_cutoff timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings;
  v_batch uuid;
  v_sizes jsonb;
  v_pieces integer;
begin
  select * into v_listing from public.listings l where l.id = p_listing_id for update;
  if not found then
    raise exception 'That listing does not exist.' using errcode = 'P0002';
  end if;
  select b.id into v_batch from public.storefront_batches b
  where b.listing_id = p_listing_id
    and ((p_drop_id is null and b.kind = 'weekly' and b.cutoff_at = p_cutoff) or (b.kind = 'drop' and b.drop_id = p_drop_id));
  if found then
    return v_batch;
  end if;

  with waiting as (
    select o.size, o.qty from public.shop_orders o
    join public.order_payments p on p.id = o.payment_id
    where o.listing_id = p_listing_id and o.batch_id is null and p.status in ('paid', 'fulfilled')
      and ((p_drop_id is null and o.drop_id is null and o.created_at < p_cutoff) or o.drop_id = p_drop_id)
  ), per_size as (
    select w.size, sum(w.qty)::integer as qty from waiting w group by w.size
  )
  select jsonb_object_agg(s.size, s.qty), sum(s.qty)::integer into v_sizes, v_pieces from per_size s;
  if v_pieces is null or v_pieces = 0 then
    return null;
  end if;

  insert into public.storefront_batches (brand_id, listing_id, drop_id, kind, cutoff_at, sizes, pieces)
  values (v_listing.brand_id, p_listing_id, p_drop_id, case when p_drop_id is null then 'weekly' else 'drop' end, p_cutoff, v_sizes, v_pieces)
  returning id into v_batch;

  update public.shop_orders o set batch_id = v_batch
  from public.order_payments p
  where p.id = o.payment_id and o.listing_id = p_listing_id and o.batch_id is null and p.status in ('paid', 'fulfilled')
    and ((p_drop_id is null and o.drop_id is null and o.created_at < p_cutoff) or o.drop_id = p_drop_id);
  return v_batch;
end;
$$;

-- The payment line a batch's order is sent under. The shoppers' card payments hold the money (and are what
-- F-G4 counts as GMV and cash); this record names the one production order those payments pay for, so
-- submit_brand_run's payment gate finds it. It is an invoice-method payment with no charge of its own, so nothing
-- is counted twice. Refused unless every shop order in the batch is paid, the sizes are the batch's, and the
-- person may order for the brand. A second call answers the payment already opened.
create function public.open_storefront_batch_payment(p_batch_id uuid, p_user_id uuid, p_line jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.storefront_batches;
  v_payment uuid;
  v_orders integer;
begin
  select * into v_batch from public.storefront_batches b where b.id = p_batch_id for update;
  if not found or v_batch.brand_id is null then
    raise exception 'That batch does not exist.' using errcode = 'P0002';
  end if;
  if v_batch.payment_id is not null then
    return v_batch.payment_id;
  end if;
  if v_batch.status <> 'open' then
    raise exception 'That batch is settled.' using errcode = 'P0001', hint = 'batch_settled';
  end if;
  if not private.can_manage_kit(p_user_id, v_batch.brand_id) then
    raise exception 'You may not order for this brand.' using errcode = '42501';
  end if;
  if (p_line ->> 'sizes') is null or (p_line -> 'sizes') <> v_batch.sizes then
    raise exception 'The order is not the batch.' using errcode = '22023', hint = 'payment_mismatch';
  end if;
  if exists (
    select 1 from public.shop_orders o join public.order_payments p on p.id = o.payment_id
    where o.batch_id = p_batch_id and p.status not in ('paid', 'fulfilled')
  ) then
    raise exception 'A shop order in this batch is not paid.' using errcode = 'P0001', hint = 'payment_required';
  end if;
  select count(*) into v_orders from public.shop_orders o where o.batch_id = p_batch_id;

  insert into public.order_payments (brand_id, purpose, method, status, currency, amount_minor, schedule, description, created_by)
  select v_batch.brand_id, 'order', 'invoice', 'invoice', l.currency, 0, 'full',
         'Storefront batch: ' || v_orders || ' shop ' || case when v_orders = 1 then 'order' else 'orders' end || ', paid by card',
         p_user_id
  from public.listings l where l.id = v_batch.listing_id
  returning id into v_payment;
  if v_payment is null then
    raise exception 'That listing does not exist.' using errcode = 'P0002';
  end if;

  insert into public.order_payment_lines (
    payment_id, brand_id, request_key, door, product_id, project_id, kind, release_id, factory_profile_id,
    fabric_key, sizes, flags, pieces, value_minor, price_label
  ) values (
    v_payment, v_batch.brand_id, p_line ->> 'request_key', 'brand_run', (p_line ->> 'product_id')::uuid,
    (p_line ->> 'project_id')::uuid, 'run', (p_line ->> 'release_id')::uuid, btrim(p_line ->> 'factory_profile_id'),
    btrim(p_line ->> 'fabric_key'), v_batch.sizes, coalesce(p_line -> 'flags', '[]'::jsonb), v_batch.pieces, null,
    'Paid by ' || v_orders || ' storefront ' || case when v_orders = 1 then 'order' else 'orders' end
  );

  update public.storefront_batches b set payment_id = v_payment where b.id = p_batch_id;
  return v_payment;
end;
$$;

-- A batch reached production, or was refused on the way. A settled batch never moves again.
create function public.settle_storefront_batch(p_batch_id uuid, p_status text, p_order_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'refused') then
    raise exception 'A batch is sent or refused.' using errcode = '22023', hint = 'invalid_input';
  end if;
  update public.storefront_batches b
  set status = p_status, order_id = p_order_id, message = left(p_message, 500), settled_at = now()
  where b.id = p_batch_id and b.status = 'open';
end;
$$;

revoke all on function public.open_shop_order(uuid, text, integer, text, integer, text, text, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.cut_storefront_batch(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.open_storefront_batch_payment(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.settle_storefront_batch(uuid, text, uuid, text) from public, anon, authenticated;

grant execute on function public.open_shop_order(uuid, text, integer, text, integer, text, text, boolean, boolean, text) to service_role;
grant execute on function public.cut_storefront_batch(uuid, uuid, timestamptz) to service_role;
grant execute on function public.open_storefront_batch_payment(uuid, uuid, jsonb) to service_role;
grant execute on function public.settle_storefront_batch(uuid, text, uuid, text) to service_role;
