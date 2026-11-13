-- Plan v6 C4, decision 0155: sales channels (spec 02 F-L6, screen 24).
--
-- Three tables, written only by the functions below:
--
-- * private.channel_connections: a brand's connected shop (Shopify today). The shop's access token is held
--   ONLY as AES-256-GCM ciphertext and nonce, encrypted by the app with CHANNEL_TOKEN_KEY; the database never
--   sees the token itself. It lives in the private schema so no browser and no API read can reach it; members
--   learn a connection's state through channel_connections_of, which never returns the token.
-- * public.channel_listings: which of the brand's products is listed on which shop, size by size, with the
--   release, fabric and factory profile its orders are made from (fixed when the brand pushed it, after the
--   order gates ran with the person present).
-- * public.channel_orders: each line of an order a channel sent us (a Shopify order, or a row of an uploaded
--   CSV), what became of it, and where its tracking went. The buyer's ship-to address is the only personal data;
--   the shop's redaction webhooks clear it.
--
-- An order from a channel goes to production through submit_brand_run, with an INVOICE payment line (the buyer
-- paid the brand on its own shop; Knitwright invoices the brand), so C1's payment gate and D1's validation gate
-- both run on it. Nothing here changes C1's tables or functions.

create table private.channel_connections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  channel text not null check (channel in ('shopify')),
  shop_domain text not null check (shop_domain ~ '^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$'),
  -- base64 of the AES-256-GCM ciphertext with its tag, and of the 12-byte nonce. Null once uninstalled.
  token_ciphertext text check (token_ciphertext is null or (token_ciphertext ~ '^[A-Za-z0-9+/=]+$' and length(token_ciphertext) between 16 and 2048)),
  token_nonce text check (token_nonce is null or token_nonce ~ '^[A-Za-z0-9+/=]{16,32}$'),
  scopes text not null default '' check (length(scopes) <= 1000),
  -- The location Shopify made for Knitwright as a fulfilment service. Null until registered.
  location_id text check (location_id is null or length(location_id) between 1 and 200),
  -- The member who connected the shop: the person the shop's orders are placed as.
  connected_by uuid references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'uninstalled')),
  connected_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint channel_connections_token_whole check ((token_ciphertext is null) = (token_nonce is null)),
  constraint channel_connections_active_has_token check ((status = 'active') = (token_ciphertext is not null)),
  constraint channel_connections_uninstalled_says_when check ((status = 'uninstalled') = (uninstalled_at is not null))
);

comment on table private.channel_connections is
  'A brand''s connected shop. The access token is app-encrypted ciphertext only. Written by the channel_* functions.';

-- A shop is connected to one brand at a time, and a brand to one shop per channel.
create unique index channel_connections_shop on private.channel_connections (channel, shop_domain) where status = 'active';
create unique index channel_connections_brand on private.channel_connections (brand_id, channel) where status = 'active';

revoke all on private.channel_connections from public, anon, authenticated, service_role;
alter table private.channel_connections enable row level security;

create table public.channel_listings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  connection_id uuid not null references private.channel_connections (id) on delete cascade,
  product_id uuid not null,
  size_label text not null check (length(btrim(size_label)) between 1 and 20),
  external_product_id text not null check (length(external_product_id) between 1 and 200),
  external_variant_id text not null check (length(external_variant_id) between 1 and 200),
  sku text not null check (sku ~ '^[A-Za-z0-9_-]{1,64}$'),
  price_minor bigint not null check (price_minor between 1 and 100000000),
  currency text not null check (currency in ('GBP', 'AUD')),
  release_id uuid not null,
  factory_profile_id text not null check (length(btrim(factory_profile_id)) between 1 and 120),
  fabric_key text not null check (length(btrim(fabric_key)) between 1 and 120),
  flags jsonb not null default '[]'::jsonb check (jsonb_typeof(flags) = 'array' and pg_column_size(flags) < 16384),
  pushed_by uuid references auth.users (id) on delete set null,
  pushed_at timestamptz not null default now(),
  foreign key (product_id, brand_id) references public.brand_products (id, brand_id) on delete cascade,
  unique (connection_id, product_id, size_label),
  unique (connection_id, external_variant_id)
);

create index channel_listings_brand on public.channel_listings (brand_id, pushed_at desc);

create table public.channel_orders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  channel text not null check (channel in ('shopify', 'csv')),
  connection_id uuid references private.channel_connections (id) on delete set null,
  external_order_id text not null check (external_order_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  external_line_id text not null check (external_line_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- What the shop calls the order, such as "#1001".
  order_name text not null check (length(btrim(order_name)) between 1 and 80),
  product_id uuid not null,
  size_label text not null check (length(btrim(size_label)) between 1 and 20),
  pieces integer not null check (pieces between 1 and 99999),
  state text not null default 'received' check (state in ('received', 'submitted', 'refused')),
  message text check (message is null or length(message) <= 500),
  payment_id uuid references public.order_payments (id) on delete set null,
  order_id uuid references public.ops_orders (id) on delete set null,
  run_id uuid,
  -- The buyer's address for the parcel: name, address lines, city, region, postcode, country, phone. Personal
  -- data: cleared by channel_redact_customer and channel_redact_shop.
  ship_to jsonb check (ship_to is null or (jsonb_typeof(ship_to) = 'object' and pg_column_size(ship_to) < 4096)),
  received_at timestamptz not null default now(),
  settled_at timestamptz,
  tracking_synced_at timestamptz,
  constraint channel_orders_settled_says_when check ((state = 'received') = (settled_at is null)),
  constraint channel_orders_submitted_has_an_order check (state <> 'submitted' or order_id is not null),
  foreign key (product_id, brand_id) references public.brand_products (id, brand_id) on delete cascade,
  unique (brand_id, channel, external_order_id, external_line_id)
);

create index channel_orders_brand on public.channel_orders (brand_id, received_at desc);
create index channel_orders_tracking on public.channel_orders (state, tracking_synced_at) where state = 'submitted' and tracking_synced_at is null;

revoke all on public.channel_listings, public.channel_orders from public, anon, authenticated, service_role;
grant select on public.channel_listings, public.channel_orders to authenticated, service_role;

alter table public.channel_listings enable row level security;
alter table public.channel_orders enable row level security;

create policy channel_listings_read on public.channel_listings for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));
create policy channel_orders_read on public.channel_orders for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));

-- ---------------------------------------------------------------------------------------------
-- Connections.

-- Connects a shop, or refreshes the token of the brand's own shop on a reinstall. Owners and admins only: the
-- connecting person is who the shop's orders are placed as, so they must also be able to order.
create function public.channel_connect(
  p_brand_id uuid, p_user_id uuid, p_channel text, p_shop text, p_ciphertext text, p_nonce text, p_scopes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing private.channel_connections;
  v_id uuid;
begin
  if not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'Only owners and admins connect a sales channel.' using errcode = '42501';
  end if;
  if p_ciphertext is null or p_nonce is null then
    raise exception 'The shop gave no access.' using errcode = '22023', hint = 'invalid_input';
  end if;

  select * into v_existing from private.channel_connections c
  where c.channel = p_channel and c.shop_domain = p_shop and c.status = 'active' for update;
  if found and v_existing.brand_id <> p_brand_id then
    raise exception 'That shop is connected to another Knitwright account. Disconnect it there first.'
      using errcode = 'P0001', hint = 'shop_taken';
  end if;
  if found then
    update private.channel_connections
    set token_ciphertext = p_ciphertext, token_nonce = p_nonce, scopes = coalesce(p_scopes, ''),
        connected_by = p_user_id, updated_at = now()
    where id = v_existing.id;
    return v_existing.id;
  end if;

  if exists (select 1 from private.channel_connections c where c.brand_id = p_brand_id and c.channel = p_channel and c.status = 'active') then
    raise exception 'This brand already has a shop connected on that channel. Disconnect it first.'
      using errcode = 'P0001', hint = 'channel_connected';
  end if;

  insert into private.channel_connections (brand_id, channel, shop_domain, token_ciphertext, token_nonce, scopes, connected_by)
  values (p_brand_id, p_channel, p_shop, p_ciphertext, p_nonce, coalesce(p_scopes, ''), p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.channel_set_location(p_connection_id uuid, p_location_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.channel_connections set location_id = p_location_id, updated_at = now()
  where id = p_connection_id and status = 'active';
$$;

-- A member's own disconnect. Drops the token at once.
create function public.channel_disconnect(p_brand_id uuid, p_user_id uuid, p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'Only owners and admins disconnect a sales channel.' using errcode = '42501';
  end if;
  update private.channel_connections
  set status = 'uninstalled', token_ciphertext = null, token_nonce = null, uninstalled_at = now(), updated_at = now()
  where id = p_connection_id and brand_id = p_brand_id and status = 'active';
  if not found then
    raise exception 'That connection does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- The shop uninstalled the app (its app/uninstalled webhook): the connection ends and the token is dropped.
create function public.channel_uninstalled(p_channel text, p_shop text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.channel_connections
  set status = 'uninstalled', token_ciphertext = null, token_nonce = null, uninstalled_at = now(), updated_at = now()
  where channel = p_channel and shop_domain = p_shop and status = 'active';
  return found;
end;
$$;

-- What a member may know about the brand's connections. Never the token.
create function public.channel_connections_of(p_brand_id uuid, p_user_id uuid)
returns table (id uuid, channel text, shop_domain text, scopes text, has_location boolean, connected_by uuid, connected_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.club_role(p_user_id, p_brand_id) is null then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  return query
    select c.id, c.channel, c.shop_domain, c.scopes, c.location_id is not null, c.connected_by, c.connected_at
    from private.channel_connections c
    where c.brand_id = p_brand_id and c.status = 'active'
    order by c.connected_at;
end;
$$;

-- The server's own read of one active connection, ciphertext included, by id or by shop.
create function public.channel_connection_secret(p_connection_id uuid, p_channel text, p_shop text)
returns table (
  id uuid, brand_id uuid, channel text, shop_domain text, token_ciphertext text, token_nonce text,
  location_id text, connected_by uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.brand_id, c.channel, c.shop_domain, c.token_ciphertext, c.token_nonce, c.location_id, c.connected_by
  from private.channel_connections c
  where c.status = 'active'
    and ((p_connection_id is not null and c.id = p_connection_id)
      or (p_connection_id is null and c.channel = p_channel and c.shop_domain = p_shop));
$$;

-- ---------------------------------------------------------------------------------------------
-- Listings.

create function public.channel_record_listing(
  p_brand_id uuid, p_user_id uuid, p_connection_id uuid, p_product_id uuid, p_size_label text,
  p_external_product_id text, p_external_variant_id text, p_sku text, p_price_minor bigint, p_currency text,
  p_release_id uuid, p_factory_profile_id text, p_fabric_key text, p_flags jsonb
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
    raise exception 'You may not list products for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from private.channel_connections c where c.id = p_connection_id and c.brand_id = p_brand_id and c.status = 'active') then
    raise exception 'That shop is not connected.' using errcode = 'P0002', hint = 'not_connected';
  end if;
  if not exists (
    select 1 from public.production_releases r join public.brand_products p on p.project_id = r.project_id and p.brand_id = r.brand_id
    where r.id = p_release_id and p.id = p_product_id and p.brand_id = p_brand_id
  ) then
    raise exception 'That release does not exist.' using errcode = 'P0002', hint = 'release_not_found';
  end if;
  insert into public.channel_listings (
    brand_id, connection_id, product_id, size_label, external_product_id, external_variant_id, sku, price_minor,
    currency, release_id, factory_profile_id, fabric_key, flags, pushed_by
  ) values (
    p_brand_id, p_connection_id, p_product_id, btrim(p_size_label), p_external_product_id, p_external_variant_id, p_sku,
    p_price_minor, p_currency, p_release_id, btrim(p_factory_profile_id), btrim(p_fabric_key), coalesce(p_flags, '[]'::jsonb), p_user_id
  )
  on conflict (connection_id, product_id, size_label) do update
    set external_product_id = excluded.external_product_id, external_variant_id = excluded.external_variant_id,
        sku = excluded.sku, price_minor = excluded.price_minor, currency = excluded.currency,
        release_id = excluded.release_id, factory_profile_id = excluded.factory_profile_id,
        fabric_key = excluded.fabric_key, flags = excluded.flags, pushed_by = excluded.pushed_by, pushed_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Orders.

-- Records one line of a channel's order once. A second delivery of the same line answers with the first.
create function public.channel_receive_order_line(
  p_brand_id uuid, p_channel text, p_connection_id uuid, p_external_order_id text, p_external_line_id text,
  p_order_name text, p_product_id uuid, p_size_label text, p_pieces integer, p_ship_to jsonb
)
returns table (id uuid, state text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_connection_id is not null and not exists (
    select 1 from private.channel_connections c where c.id = p_connection_id and c.brand_id = p_brand_id
  ) then
    raise exception 'That shop is not connected.' using errcode = 'P0002', hint = 'not_connected';
  end if;
  insert into public.channel_orders (
    brand_id, channel, connection_id, external_order_id, external_line_id, order_name, product_id, size_label, pieces, ship_to
  ) values (
    p_brand_id, p_channel, p_connection_id, p_external_order_id, p_external_line_id, btrim(p_order_name), p_product_id,
    btrim(p_size_label), p_pieces, p_ship_to
  )
  on conflict (brand_id, channel, external_order_id, external_line_id) do nothing
  returning channel_orders.id into v_id;
  if v_id is not null then
    return query select v_id, 'received'::text, true;
    return;
  end if;
  return query
    select o.id, o.state, false from public.channel_orders o
    where o.brand_id = p_brand_id and o.channel = p_channel and o.external_order_id = p_external_order_id
      and o.external_line_id = p_external_line_id;
end;
$$;

create function public.channel_settle_order_line(
  p_id uuid, p_state text, p_message text, p_payment_id uuid, p_order_id uuid, p_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_state not in ('submitted', 'refused') then
    raise exception 'A line is settled as submitted or refused.' using errcode = '22023', hint = 'invalid_input';
  end if;
  update public.channel_orders
  set state = p_state, message = left(p_message, 500), payment_id = p_payment_id, order_id = p_order_id,
      run_id = p_run_id, settled_at = now()
  where id = p_id and state = 'received';
end;
$$;

-- Lines made, shipped by ops and not yet told to their shop: the first parcel of each order.
create function public.channel_tracking_due(p_limit integer)
returns table (id uuid, connection_id uuid, external_order_id text, courier text, tracking_number text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.connection_id, o.external_order_id, s.courier, s.tracking_number
  from public.channel_orders o
  join lateral (
    select x.courier, x.tracking_number from public.ops_shipments x where x.order_id = o.order_id order by x.at limit 1
  ) s on true
  join private.channel_connections c on c.id = o.connection_id and c.status = 'active'
  where o.channel = 'shopify' and o.state = 'submitted' and o.tracking_synced_at is null
  order by o.received_at
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create function public.channel_mark_tracking_synced(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.channel_orders set tracking_synced_at = now() where id = p_id and tracking_synced_at is null;
$$;

-- ---------------------------------------------------------------------------------------------
-- Shopify's mandatory privacy webhooks.

-- customers/redact: the ship-to of the named orders of that shop is removed.
create function public.channel_redact_customer(p_channel text, p_shop text, p_order_ids text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.channel_orders o set ship_to = null
  where o.channel = p_channel and o.ship_to is not null and o.external_order_id = any (coalesce(p_order_ids, '{}'))
    and o.connection_id in (select c.id from private.channel_connections c where c.channel = p_channel and c.shop_domain = p_shop);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- shop/redact (48 hours after an uninstall): every ship-to from that shop goes, and any token left.
create function public.channel_redact_shop(p_channel text, p_shop text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.channel_orders o set ship_to = null
  where o.channel = p_channel and o.ship_to is not null
    and o.connection_id in (select c.id from private.channel_connections c where c.channel = p_channel and c.shop_domain = p_shop);
  get diagnostics v_count = row_count;
  update private.channel_connections
  set status = 'uninstalled', token_ciphertext = null, token_nonce = null, uninstalled_at = now(), updated_at = now()
  where channel = p_channel and shop_domain = p_shop and status = 'active';
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants: every function is the server's. None is for a browser.

revoke all on function public.channel_connect(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.channel_set_location(uuid, text) from public, anon, authenticated;
revoke all on function public.channel_disconnect(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.channel_uninstalled(text, text) from public, anon, authenticated;
revoke all on function public.channel_connections_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public.channel_connection_secret(uuid, text, text) from public, anon, authenticated;
revoke all on function public.channel_record_listing(uuid, uuid, uuid, uuid, text, text, text, text, bigint, text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.channel_receive_order_line(uuid, text, uuid, text, text, text, uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.channel_settle_order_line(uuid, text, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.channel_tracking_due(integer) from public, anon, authenticated;
revoke all on function public.channel_mark_tracking_synced(uuid) from public, anon, authenticated;
revoke all on function public.channel_redact_customer(text, text, text[]) from public, anon, authenticated;
revoke all on function public.channel_redact_shop(text, text) from public, anon, authenticated;

grant execute on function public.channel_connect(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.channel_set_location(uuid, text) to service_role;
grant execute on function public.channel_disconnect(uuid, uuid, uuid) to service_role;
grant execute on function public.channel_uninstalled(text, text) to service_role;
grant execute on function public.channel_connections_of(uuid, uuid) to service_role;
grant execute on function public.channel_connection_secret(uuid, text, text) to service_role;
grant execute on function public.channel_record_listing(uuid, uuid, uuid, uuid, text, text, text, text, bigint, text, uuid, text, text, jsonb) to service_role;
grant execute on function public.channel_receive_order_line(uuid, text, uuid, text, text, text, uuid, text, integer, jsonb) to service_role;
grant execute on function public.channel_settle_order_line(uuid, text, text, uuid, uuid, uuid) to service_role;
grant execute on function public.channel_tracking_due(integer) to service_role;
grant execute on function public.channel_mark_tracking_synced(uuid) to service_role;
grant execute on function public.channel_redact_customer(text, text, text[]) to service_role;
grant execute on function public.channel_redact_shop(text, text) to service_role;
