-- Store pages, seller payouts and the seller dashboard (plans/platform-v6.md, workstream C5; decision 0156;
-- spec F-L5 "Seller economics", F-L7, F-G4 "Every payout is reconciled against delivered orders").
--
-- Owner decision 0131: the Store is built in this platform. Knitwright is merchant of record: the buyer pays
-- Knitwright (C1's checkout), Knitwright keeps the base price plus shipping and duty, and the seller's margin is
-- paid out weekly after delivery through Stripe Connect Express ("separate charges and transfers"). This
-- migration holds the records; the app's adapter talks to Stripe (lib/store-pages/connect*.ts).
--
--   * seller_payout_settings  one labelled row: the Knitwright fee, the delivery grace days, the smallest payout.
--   * seller_channel_fees     what each sales channel costs per sale, per currency. Labelled placeholders.
--   * store_branding_options  packing inserts, neck labels, hang tags, gift messages, with placeholder costs.
--   * store_settings          a brand's GPSR and EPR details and its branding choices.
--   * seller_accounts         a brand's Stripe Connect Express account and what Stripe last said about it.
--   * seller_sales            every sale a seller makes, with its parts: retail, base, shipping, duty, fees,
--                             margin. Written by the storefront, drop and team-store checkouts (C2, C3) through
--                             record_seller_sale; refunds and the production order are added later.
--   * seller_payouts          one weekly transfer to a seller, per currency.
--   * seller_payout_lines     what each payout paid for each sale. A refund after a payout nets off next time.
--
-- THE RECONCILIATION. A sale is payable only once delivered. What it pays is its margin less what was refunded,
-- never below nothing. What is due on a sale is that, less every line of every payout that has not failed. A
-- refund after a payout makes the sale's due negative, and the next payout takes it off. So a payout is always
-- the sum of delivered, non-refunded margin not yet paid, and nothing else.
--
-- DELIVERED. No courier reports a delivery scan yet (decision 0143). A sale counts as delivered when ops
-- confirms it, or when its production order's parcels cover every piece and the grace days (setting, default
-- 14, a placeholder) have passed since the last parcel was sent.
--
-- Money is integer minor units. Currency is GBP or AUD.

-- ---------------------------------------------------------------------------------------------
-- Settings and reference rows. Labelled; nothing here is an owner answer.

create table public.seller_payout_settings (
  id boolean primary key default true check (id),
  -- What Knitwright takes of each sale on top of the base price, shipping and duty. F-L5 names none: 0.
  knitwright_fee_bps integer not null default 0 check (knitwright_fee_bps between 0 and 5000),
  -- Days after the last parcel of an order is sent before its sales count as delivered without a scan.
  delivery_grace_days integer not null default 14 check (delivery_grace_days between 1 and 90),
  -- The smallest payout made; anything less waits for the next week.
  min_payout_gbp_minor bigint not null default 100 check (min_payout_gbp_minor > 0),
  min_payout_aud_minor bigint not null default 200 check (min_payout_aud_minor > 0),
  is_placeholder boolean not null default true,
  label text not null check (length(btrim(label)) between 1 and 300),
  updated_at timestamptz not null default now()
);

insert into public.seller_payout_settings (id, label) values (
  true,
  'Placeholders, not owner answers: no Knitwright fee on top of base, shipping and duty (F-L5); sales count as delivered 14 days after the last parcel; smallest payout £1 / A$2'
);

create table public.seller_channel_fees (
  channel text not null check (channel in ('storefront', 'team_store', 'shopify', 'api')),
  currency text not null check (currency in ('GBP', 'AUD')),
  percent_bps integer not null check (percent_bps between 0 and 5000),
  fixed_minor bigint not null check (fixed_minor between 0 and 100000),
  label text not null check (length(btrim(label)) between 1 and 300),
  is_placeholder boolean not null default true,
  primary key (channel, currency)
);

insert into public.seller_channel_fees (channel, currency, percent_bps, fixed_minor, label) values
  ('storefront', 'GBP', 150, 20, 'Card processing on a Knitwright storefront: a placeholder, not a quoted Stripe rate'),
  ('storefront', 'AUD', 175, 30, 'Card processing on a Knitwright storefront: a placeholder, not a quoted Stripe rate'),
  ('team_store', 'GBP', 150, 20, 'Card processing on a team store: a placeholder, not a quoted Stripe rate'),
  ('team_store', 'AUD', 175, 30, 'Card processing on a team store: a placeholder, not a quoted Stripe rate'),
  ('shopify', 'GBP', 0, 0, 'Shopify charges its own fees to you directly; Knitwright adds none'),
  ('shopify', 'AUD', 0, 0, 'Shopify charges its own fees to you directly; Knitwright adds none'),
  ('api', 'GBP', 0, 0, 'Orders sent by API or CSV: no channel fee'),
  ('api', 'AUD', 0, 0, 'Orders sent by API or CSV: no channel fee');

create table public.store_branding_options (
  id text primary key check (id ~ '^[a-z_]{1,40}$'),
  name text not null check (length(btrim(name)) between 1 and 80),
  description text not null check (length(btrim(description)) between 1 and 300),
  -- Null: free.
  cost_from_minor bigint check (cost_from_minor is null or cost_from_minor >= 0),
  currency text not null default 'GBP' check (currency in ('GBP', 'AUD')),
  per text check (per is null or per in ('order', 'item')),
  details text not null check (length(btrim(details)) between 1 and 200),
  sort integer not null,
  is_placeholder boolean not null default true
);

insert into public.store_branding_options (id, name, description, cost_from_minor, per, details, sort) values
  ('packing_inserts', 'Packing inserts', 'A6 card in every parcel: thank-you note, crest, QR to your store.', 30, 'order', 'Insert size: A6 · Print: both sides', 1),
  ('neck_labels', 'Neck labels', 'Your crest and size printed inside the neck, instead of a scratchy tag.', 40, 'item', 'Print: inside neck · 1 colour', 2),
  ('hang_tags', 'Hang tags', 'Card tag on a string with your crest, price and care info.', 35, 'item', 'Size: 50 × 90 mm', 3),
  ('gift_messages', 'Gift messages', 'Let buyers add a printed note for a player, parent or coach.', null, null, 'Up to 200 characters', 4);

-- ---------------------------------------------------------------------------------------------
-- A brand's store settings: GPSR (EU responsible person, brand contact), EPR (Germany LUCID), branding.

create table public.store_settings (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  eu_rp_name text not null default '' check (length(eu_rp_name) <= 120),
  eu_rp_address text not null default '' check (length(eu_rp_address) <= 400),
  eu_rp_email text not null default '' check (length(eu_rp_email) <= 254),
  brand_contact text not null default '' check (length(brand_contact) <= 254),
  lucid_number text not null default '' check (lucid_number = '' or lucid_number ~ '^DE[0-9]{10,16}$'),
  -- {option id: {"on": boolean, "note": text}}
  branding jsonb not null default '{}'::jsonb check (jsonb_typeof(branding) = 'object' and pg_column_size(branding) < 8192),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------------------------
-- Stripe Connect Express accounts. One per brand.

create table public.seller_accounts (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'test')),
  provider_account_id text not null unique check (length(provider_account_id) between 1 and 255),
  country text not null check (country ~ '^[A-Z]{2}$'),
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  -- How many things Stripe still asks the seller for.
  requirements_due integer not null default 0 check (requirements_due >= 0),
  disabled_reason text check (disabled_reason is null or length(disabled_reason) <= 200),
  -- Set when Stripe could not pay the seller's bank; cleared by the next paid payout.
  payout_failure text check (payout_failure is null or length(payout_failure) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Sales. Money records outlive the brand.

create table public.seller_sales (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id) on delete set null,
  channel text not null check (channel in ('storefront', 'team_store', 'shopify', 'api')),
  -- The selling checkout's own reference. A retry with the same reference records nothing new.
  source_ref text not null unique check (length(btrim(source_ref)) between 1 and 120),
  product_id uuid,
  product_name text not null check (length(btrim(product_name)) between 1 and 200),
  quantity integer not null check (quantity between 1 and 100000),
  currency text not null check (currency in ('GBP', 'AUD')),
  retail_minor bigint not null check (retail_minor >= 0),
  base_minor bigint not null check (base_minor >= 0),
  shipping_minor bigint not null check (shipping_minor >= 0),
  duty_minor bigint not null check (duty_minor >= 0),
  channel_fee_minor bigint not null check (channel_fee_minor >= 0),
  knitwright_fee_minor bigint not null check (knitwright_fee_minor >= 0),
  margin_minor bigint not null check (margin_minor >= 0),
  refunded_minor bigint not null default 0 check (refunded_minor >= 0),
  -- The production order the sale is made in. Set at the sale or when a drop closes into an order.
  order_id uuid references public.ops_orders (id) on delete set null,
  delivered_at timestamptz,
  delivered_by text check (delivered_by is null or delivered_by in ('ops', 'parcels')),
  sold_at timestamptz not null default now(),
  constraint seller_sales_margin_adds_up check (
    margin_minor = retail_minor - base_minor - shipping_minor - duty_minor - channel_fee_minor - knitwright_fee_minor
  ),
  constraint seller_sales_refund_within_retail check (refunded_minor <= retail_minor),
  constraint seller_sales_delivery_says_how check ((delivered_at is null) = (delivered_by is null))
);

create index seller_sales_brand on public.seller_sales (brand_id, sold_at desc);
create index seller_sales_order on public.seller_sales (order_id) where order_id is not null;
create index seller_sales_undelivered on public.seller_sales (sold_at) where delivered_at is null;

create table public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id) on delete set null,
  currency text not null check (currency in ('GBP', 'AUD')),
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'pending' check (status in ('pending', 'sent', 'paid', 'failed')),
  provider text not null check (provider in ('stripe', 'test')),
  provider_account_id text not null check (length(provider_account_id) between 1 and 255),
  provider_transfer_id text unique check (provider_transfer_id is null or length(provider_transfer_id) between 1 and 255),
  provider_payout_id text check (provider_payout_id is null or length(provider_payout_id) between 1 and 255),
  failure text check (failure is null or length(failure) <= 300),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  constraint seller_payouts_sent_has_a_transfer check ((status in ('sent', 'paid')) <= (provider_transfer_id is not null and sent_at is not null)),
  constraint seller_payouts_paid_says_when check ((status = 'paid') = (paid_at is not null)),
  constraint seller_payouts_failed_says_why check ((status = 'failed') = (failure is not null))
);

create index seller_payouts_brand on public.seller_payouts (brand_id, created_at desc);
create unique index seller_payouts_one_pending on public.seller_payouts (brand_id, currency) where status = 'pending';

create table public.seller_payout_lines (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.seller_payouts (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  sale_id uuid not null references public.seller_sales (id) on delete cascade,
  -- Negative when a refund after an earlier payout is taken off.
  amount_minor bigint not null check (amount_minor <> 0),
  unique (payout_id, sale_id)
);

create index seller_payout_lines_sale on public.seller_payout_lines (sale_id);

-- Who reads what: every signed-in person the reference rows; members their own brand's records; platform
-- admins everything. Browsers write nothing.
revoke all on public.seller_payout_settings, public.seller_channel_fees, public.store_branding_options,
  public.store_settings, public.seller_accounts, public.seller_sales, public.seller_payouts, public.seller_payout_lines
  from public, anon, authenticated, service_role;
grant select on public.seller_payout_settings, public.seller_channel_fees, public.store_branding_options,
  public.store_settings, public.seller_accounts, public.seller_sales, public.seller_payouts, public.seller_payout_lines
  to authenticated, service_role;

alter table public.seller_payout_settings enable row level security;
alter table public.seller_channel_fees enable row level security;
alter table public.store_branding_options enable row level security;
alter table public.store_settings enable row level security;
alter table public.seller_accounts enable row level security;
alter table public.seller_sales enable row level security;
alter table public.seller_payouts enable row level security;
alter table public.seller_payout_lines enable row level security;

create policy "signed-in people read payout settings" on public.seller_payout_settings for select to authenticated using (true);
create policy "signed-in people read channel fees" on public.seller_channel_fees for select to authenticated using (true);
create policy "signed-in people read branding options" on public.store_branding_options for select to authenticated using (true);
create policy "members and admins read store settings" on public.store_settings for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));
create policy "members and admins read seller accounts" on public.seller_accounts for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));
create policy "members and admins read seller sales" on public.seller_sales for select to authenticated
  using (private.is_platform_admin() or (brand_id is not null and private.is_member(brand_id)));
create policy "members and admins read seller payouts" on public.seller_payouts for select to authenticated
  using (private.is_platform_admin() or (brand_id is not null and private.is_member(brand_id)));
create policy "members and admins read payout lines" on public.seller_payout_lines for select to authenticated
  using (private.is_platform_admin() or (brand_id is not null and private.is_member(brand_id)));

-- ---------------------------------------------------------------------------------------------
-- Store settings, by owners and admins.

create function public.set_store_settings(
  p_actor uuid, p_brand_id uuid, p_eu_rp_name text, p_eu_rp_address text, p_eu_rp_email text, p_brand_contact text, p_lucid_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_members(p_actor, p_brand_id) then
    raise exception 'Only owners and admins change the store settings.' using errcode = '42501';
  end if;
  if coalesce(p_lucid_number, '') <> '' and upper(btrim(p_lucid_number)) !~ '^DE[0-9]{10,16}$' then
    raise exception 'A LUCID number is DE followed by its digits.' using errcode = '22023', hint = 'invalid_lucid';
  end if;
  insert into public.store_settings as s (brand_id, eu_rp_name, eu_rp_address, eu_rp_email, brand_contact, lucid_number, updated_by)
  values (p_brand_id, btrim(coalesce(p_eu_rp_name, '')), btrim(coalesce(p_eu_rp_address, '')), btrim(coalesce(p_eu_rp_email, '')),
          btrim(coalesce(p_brand_contact, '')), upper(btrim(coalesce(p_lucid_number, ''))), p_actor)
  on conflict (brand_id) do update set
    eu_rp_name = excluded.eu_rp_name, eu_rp_address = excluded.eu_rp_address, eu_rp_email = excluded.eu_rp_email,
    brand_contact = excluded.brand_contact, lucid_number = excluded.lucid_number, updated_at = now(), updated_by = p_actor;
end;
$$;

create function public.set_store_branding(p_actor uuid, p_brand_id uuid, p_option_id text, p_on boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_members(p_actor, p_brand_id) then
    raise exception 'Only owners and admins change the store settings.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.store_branding_options o where o.id = p_option_id) or p_on is null
     or length(coalesce(p_note, '')) > 200 then
    raise exception 'That branding choice is not understood.' using errcode = '22023', hint = 'invalid_input';
  end if;
  insert into public.store_settings as s (brand_id, branding, updated_by)
  values (p_brand_id, jsonb_build_object(p_option_id, jsonb_build_object('on', p_on, 'note', btrim(coalesce(p_note, '')))), p_actor)
  on conflict (brand_id) do update set
    branding = s.branding || jsonb_build_object(p_option_id, jsonb_build_object('on', p_on, 'note', btrim(coalesce(p_note, '')))),
    updated_at = now(), updated_by = p_actor;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Connect accounts.

-- The brand's account, made at Stripe by the app just before. A second call keeps the first account: the app
-- then sends the person to finish that one.
create function public.open_seller_account(p_actor uuid, p_brand_id uuid, p_provider text, p_account_id text, p_country text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
begin
  if not private.can_manage_members(p_actor, p_brand_id) then
    raise exception 'Only owners and admins set up payouts.' using errcode = '42501';
  end if;
  select a.provider_account_id into v_existing from public.seller_accounts a where a.brand_id = p_brand_id;
  if found then
    return v_existing;
  end if;
  insert into public.seller_accounts (brand_id, provider, provider_account_id, country, created_by)
  values (p_brand_id, p_provider, p_account_id, upper(p_country), p_actor);
  return p_account_id;
end;
$$;

-- What Stripe said about an account (`account.updated`). Answers the brand, or nothing for an account not ours.
create function public.update_seller_account(
  p_account_id text, p_details_submitted boolean, p_charges_enabled boolean, p_payouts_enabled boolean,
  p_requirements_due integer, p_disabled_reason text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  update public.seller_accounts a set
    details_submitted = coalesce(p_details_submitted, false), charges_enabled = coalesce(p_charges_enabled, false),
    payouts_enabled = coalesce(p_payouts_enabled, false), requirements_due = greatest(coalesce(p_requirements_due, 0), 0),
    disabled_reason = nullif(left(btrim(coalesce(p_disabled_reason, '')), 200), ''), updated_at = now()
  where a.provider_account_id = p_account_id
  returning a.brand_id;
$$;

-- ---------------------------------------------------------------------------------------------
-- Sales, written by the selling checkouts (C2, C3) once the buyer has paid.

create function public.record_seller_sale(
  p_brand_id uuid, p_channel text, p_source_ref text, p_product_id uuid, p_product_name text, p_quantity integer,
  p_currency text, p_retail_minor bigint, p_base_minor bigint, p_shipping_minor bigint, p_duty_minor bigint,
  p_channel_fee_minor bigint, p_knitwright_fee_minor bigint, p_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.seller_sales;
  v_margin bigint := p_retail_minor - p_base_minor - p_shipping_minor - p_duty_minor - p_channel_fee_minor - p_knitwright_fee_minor;
  v_id uuid;
begin
  select * into v_existing from public.seller_sales s where s.source_ref = btrim(p_source_ref);
  if found then
    if v_existing.brand_id is distinct from p_brand_id then
      raise exception 'That sale reference belongs to another brand.' using errcode = 'P0001', hint = 'sale_conflict';
    end if;
    return v_existing.id;
  end if;
  if not exists (select 1 from public.brands b where b.id = p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  if v_margin < 0 then
    raise exception 'The retail price is less than what the sale costs.' using errcode = '22023', hint = 'margin_negative';
  end if;
  insert into public.seller_sales (
    brand_id, channel, source_ref, product_id, product_name, quantity, currency, retail_minor, base_minor, shipping_minor,
    duty_minor, channel_fee_minor, knitwright_fee_minor, margin_minor, order_id
  ) values (
    p_brand_id, p_channel, btrim(p_source_ref), p_product_id, btrim(p_product_name), p_quantity, p_currency, p_retail_minor,
    p_base_minor, p_shipping_minor, p_duty_minor, p_channel_fee_minor, p_knitwright_fee_minor, v_margin, p_order_id
  ) returning id into v_id;
  return v_id;
end;
$$;

-- The production order a sale is made in (a drop closes into one order after its sales were taken).
create function public.attach_seller_sale_order(p_source_ref text, p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.seller_sales s set order_id = p_order_id
  where s.source_ref = btrim(p_source_ref)
    and exists (select 1 from public.ops_orders o where o.id = p_order_id and o.brand_id = s.brand_id);
  if not found then
    raise exception 'No sale of that brand has that reference, or the order is another brand''s.' using errcode = 'P0002';
  end if;
end;
$$;

-- What has been refunded on a sale so far, in total (as Stripe's charge.refunded reports it). Safe to repeat:
-- a total smaller than the one recorded changes nothing.
create function public.record_seller_sale_refund(p_source_ref text, p_refunded_total_minor bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_refunded_total_minor is null or p_refunded_total_minor < 0 then
    raise exception 'A refund total is nothing or more.' using errcode = '22023', hint = 'invalid_input';
  end if;
  update public.seller_sales s set refunded_minor = greatest(s.refunded_minor, least(p_refunded_total_minor, s.retail_minor))
  where s.source_ref = btrim(p_source_ref);
  if not found then
    raise exception 'No sale has that reference.' using errcode = 'P0002';
  end if;
end;
$$;

-- Ops confirms a sale was delivered (a courier scan, the buyer's word).
create function public.confirm_seller_sale_delivered(p_actor uuid, p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  update public.seller_sales s set delivered_at = now(), delivered_by = 'ops'
  where s.id = p_sale_id and s.delivered_at is null;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The reconciliation.

-- What a sale may pay out at most: its margin less what was refunded, never below nothing.
create function private.sale_payable(p_margin bigint, p_refunded bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select greatest(p_margin - p_refunded, 0);
$$;

-- What has been paid (or is being paid) on each sale: every line of a payout that has not failed.
create function private.sale_paid(p_sale_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.amount_minor), 0)::bigint
  from public.seller_payout_lines l join public.seller_payouts p on p.id = l.payout_id
  where l.sale_id = p_sale_id and p.status <> 'failed';
$$;

-- Marks as delivered the sales whose production order's parcels cover every piece, the grace days after the
-- last one was sent.
create function private.stamp_parcel_deliveries(p_as_of timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  with s as (select delivery_grace_days from public.seller_payout_settings where id),
  done as (
    select o.id as order_id, max(sh.shipped_on) as last_sent
    from public.ops_orders o join public.ops_shipments sh on sh.order_id = o.id
    group by o.id, o.pieces
    having sum(sh.pieces) >= o.pieces
  )
  update public.seller_sales x set delivered_at = (done.last_sent + s.delivery_grace_days)::timestamptz, delivered_by = 'parcels'
  from done cross join s
  where x.order_id = done.order_id and x.delivered_at is null
    and (done.last_sent + s.delivery_grace_days)::timestamptz <= p_as_of;
$$;

-- THE WEEKLY PAYOUT. For each brand and currency whose Connect account can be paid: every delivered sale's
-- payable less what was already paid, summed; a payout of that sum when it reaches the smallest payout, with one
-- line per sale. A brand with a payout still pending gets no second one. Answers every pending payout, new or
-- left from an earlier run, for the app to send.
create function public.prepare_seller_payouts(p_as_of timestamptz)
returns setof public.seller_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('seller_payouts', 0));
  perform private.stamp_parcel_deliveries(coalesce(p_as_of, now()));

  for v_group in
    with due as (
      select x.brand_id, x.currency, x.id as sale_id,
             private.sale_payable(x.margin_minor, x.refunded_minor) - private.sale_paid(x.id) as due_minor
      from public.seller_sales x
      where x.brand_id is not null and x.delivered_at is not null and x.delivered_at <= coalesce(p_as_of, now())
    )
    select d.brand_id, d.currency, sum(d.due_minor)::bigint as total, a.provider, a.provider_account_id
    from due d
    join public.seller_accounts a on a.brand_id = d.brand_id and a.payouts_enabled
    cross join public.seller_payout_settings s
    where d.due_minor <> 0
      and not exists (select 1 from public.seller_payouts p where p.brand_id = d.brand_id and p.currency = d.currency and p.status = 'pending')
    group by d.brand_id, d.currency, a.provider, a.provider_account_id, s.min_payout_gbp_minor, s.min_payout_aud_minor
    having sum(d.due_minor) >= case d.currency when 'GBP' then s.min_payout_gbp_minor else s.min_payout_aud_minor end
  loop
    insert into public.seller_payouts (brand_id, currency, amount_minor, provider, provider_account_id)
    values (v_group.brand_id, v_group.currency, v_group.total, v_group.provider, v_group.provider_account_id)
    returning id into v_id;
    insert into public.seller_payout_lines (payout_id, brand_id, sale_id, amount_minor)
    select v_id, x.brand_id, x.id, private.sale_payable(x.margin_minor, x.refunded_minor) - private.sale_paid(x.id)
    from public.seller_sales x
    where x.brand_id = v_group.brand_id and x.currency = v_group.currency
      and x.delivered_at is not null and x.delivered_at <= coalesce(p_as_of, now())
      and private.sale_payable(x.margin_minor, x.refunded_minor) - private.sale_paid(x.id) <> 0;
  end loop;

  return query select * from public.seller_payouts p where p.status = 'pending' order by p.created_at, p.id;
end;
$$;

-- The transfer Stripe made for a payout.
create function public.mark_seller_payout_sent(p_payout_id uuid, p_transfer_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.seller_payouts p set status = 'sent', provider_transfer_id = p_transfer_id, sent_at = now()
  where p.id = p_payout_id and p.status = 'pending';
  if not found and not exists (select 1 from public.seller_payouts p where p.id = p_payout_id and p.provider_transfer_id = p_transfer_id) then
    raise exception 'That payout is not waiting to be sent.' using errcode = 'P0001', hint = 'payout_not_pending';
  end if;
end;
$$;

-- A payout that could not be made, or a transfer reversed. Its lines stop counting, so the next run pays the
-- same sales again.
create function public.mark_seller_payout_failed(p_payout_id uuid, p_transfer_id text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.seller_payouts p set status = 'failed', failure = left(btrim(coalesce(nullif(p_reason, ''), 'Failed')), 300), paid_at = null
  where p.status in ('pending', 'sent', 'paid')
    and ((p_payout_id is not null and p.id = p_payout_id) or (p_transfer_id is not null and p.provider_transfer_id = p_transfer_id));
end;
$$;

-- Stripe paid (or could not pay) a connected account's bank (`payout.paid`, `payout.failed`). Every payout sent
-- to that account before the bank payout was made is then paid. A failure is noted on the account; the money
-- stays in the seller's Stripe balance until their bank details are fixed.
create function public.record_connected_payout(p_account_id text, p_provider_payout_id text, p_status text, p_created timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if p_status = 'paid' then
    update public.seller_payouts p set status = 'paid', paid_at = now(), provider_payout_id = p_provider_payout_id
    where p.provider_account_id = p_account_id and p.status = 'sent' and p.sent_at <= coalesce(p_created, now());
    get diagnostics v_count = row_count;
    update public.seller_accounts a set payout_failure = null, updated_at = now() where a.provider_account_id = p_account_id;
  elsif p_status = 'failed' then
    update public.seller_accounts a
    set payout_failure = 'Stripe could not pay your bank. Check your bank details in Stripe.', updated_at = now()
    where a.provider_account_id = p_account_id;
  end if;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- F-G4: what Knitwright holds that is the sellers'. Shown on /ops/finance beside C1's figures.
--
--   held     the payable margin of sales not delivered yet;
--   owed     delivered and not yet paid, including payouts prepared and not yet sent;
--   in_flight sent to Stripe, not yet in the seller's bank.

create function private.seller_liability()
returns table (currency text, held_minor bigint, owed_minor bigint, in_flight_minor bigint, undelivered_sales integer)
language sql
stable
security definer
set search_path = ''
as $$
  with c(currency) as (values ('GBP'), ('AUD')),
  per_sale as (
    select x.currency, x.delivered_at is not null as delivered,
           private.sale_payable(x.margin_minor, x.refunded_minor) as payable,
           private.sale_paid(x.id) as paid
    from public.seller_sales x
  )
  select c.currency,
    coalesce((select sum(p.payable) from per_sale p where p.currency = c.currency and not p.delivered), 0)::bigint,
    (coalesce((select sum(p.payable - p.paid) from per_sale p where p.currency = c.currency and p.delivered), 0)
      + coalesce((select sum(s.amount_minor) from public.seller_payouts s where s.currency = c.currency and s.status = 'pending'), 0))::bigint,
    coalesce((select sum(s.amount_minor) from public.seller_payouts s where s.currency = c.currency and s.status = 'sent'), 0)::bigint,
    (select count(*) from per_sale p where p.currency = c.currency and not p.delivered)::integer
  from c
  order by case c.currency when 'GBP' then 0 else 1 end;
$$;

create function public.ops_seller_liability(p_actor uuid)
returns table (currency text, held_minor bigint, owed_minor bigint, in_flight_minor bigint, undelivered_sales integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  return query select * from private.seller_liability();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants: every function is the server's. None is for a browser.

revoke all on function private.sale_payable(bigint, bigint) from public, anon, authenticated, service_role;
revoke all on function private.sale_paid(uuid) from public, anon, authenticated, service_role;
revoke all on function private.stamp_parcel_deliveries(timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.seller_liability() from public, anon, authenticated, service_role;

revoke all on function public.set_store_settings(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_store_branding(uuid, uuid, text, boolean, text) from public, anon, authenticated;
revoke all on function public.open_seller_account(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_seller_account(text, boolean, boolean, boolean, integer, text) from public, anon, authenticated;
revoke all on function public.record_seller_sale(uuid, text, text, uuid, text, integer, text, bigint, bigint, bigint, bigint, bigint, bigint, uuid) from public, anon, authenticated;
revoke all on function public.attach_seller_sale_order(text, uuid) from public, anon, authenticated;
revoke all on function public.record_seller_sale_refund(text, bigint) from public, anon, authenticated;
revoke all on function public.confirm_seller_sale_delivered(uuid, uuid) from public, anon, authenticated;
revoke all on function public.prepare_seller_payouts(timestamptz) from public, anon, authenticated;
revoke all on function public.mark_seller_payout_sent(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_seller_payout_failed(uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_connected_payout(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.ops_seller_liability(uuid) from public, anon, authenticated;

grant execute on function public.set_store_settings(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.set_store_branding(uuid, uuid, text, boolean, text) to service_role;
grant execute on function public.open_seller_account(uuid, uuid, text, text, text) to service_role;
grant execute on function public.update_seller_account(text, boolean, boolean, boolean, integer, text) to service_role;
grant execute on function public.record_seller_sale(uuid, text, text, uuid, text, integer, text, bigint, bigint, bigint, bigint, bigint, bigint, uuid) to service_role;
grant execute on function public.attach_seller_sale_order(text, uuid) to service_role;
grant execute on function public.record_seller_sale_refund(text, bigint) to service_role;
grant execute on function public.confirm_seller_sale_delivered(uuid, uuid) to service_role;
grant execute on function public.prepare_seller_payouts(timestamptz) to service_role;
grant execute on function public.mark_seller_payout_sent(uuid, text) to service_role;
grant execute on function public.mark_seller_payout_failed(uuid, text, text) to service_role;
grant execute on function public.record_connected_payout(text, text, text, timestamptz) to service_role;
grant execute on function public.ops_seller_liability(uuid) to service_role;
