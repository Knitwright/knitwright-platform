-- Team stores and club pages (plans/platform-v6.md, workstream C2; decision 0153; spec F-T6, F-T7).
--
-- A kit manager opens a STORE WINDOW for a design that is ready for a run: open and close dates, the sizes on
-- offer, names and numbers or not, a minimum to proceed (default 10 pieces, F-T6) and an optional club margin
-- (0/5/10/15/20%, F-T6) added on top of the base price. Players and parents buy from a short link or a QR code
-- without an account; each buyer pays at checkout through C1's payments (decision 0152), as a payment of the new
-- purpose `team_store`. At close:
--
--   * the minimum is met: every paid piece becomes ONE run order, sent through the make flow's door
--     (submit_make_order -> submit_brand_run), so C1's payment gate and D1's validation gate both run. The gate
--     below accepts the order because the store's buyers paid for exactly it;
--   * the minimum is not met, the club cancels, or production refuses the order: every buyer is refunded through
--     C1's refund path (the app calls Stripe, then record_payment_refund).
--
-- A CLUB PAGE (`<club>.knitwright.com`) is a row naming the club's address and contact line; the page shows the
-- crest, colours, open stores and size guide the platform already holds.
--
-- Buyers have no account, so the minimum is kept (decision 0136, spec 05): a name and an email address for the
-- receipt and the refund, and per piece a size and, when the store prints them, the shirt name and number. The
-- buyer's name, email and shirt names are erased 180 days after the store closes (purge_team_store_buyers, run by
-- the team-store cron), and everything goes with the club's brand.
--
-- Every table is readable by the club's members and written only by the functions below, which only the server's
-- key may run. Money is integer minor units; currency GBP or AUD.

-- ---------------------------------------------------------------------------------------------
-- A payment may now be a team store purchase.

alter table public.order_payments drop constraint order_payments_purpose_check;
alter table public.order_payments add constraint order_payments_purpose_check
  check (purpose in ('order', 'credits', 'plan', 'team_store'));
alter table public.order_payments add constraint order_payments_team_store_in_full
  check (purpose <> 'team_store' or (method = 'card' and schedule = 'full' and order_value_minor = amount_minor));

-- ---------------------------------------------------------------------------------------------
-- Club pages.

-- Subdomains the platform keeps for itself: no club may take one.
create function private.reserved_subdomain(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug in (
    'www', 'app', 'api', 'admin', 'ops', 'store', 'stores', 'shop', 'mail', 'email', 'help', 'support', 'docs',
    'status', 'static', 'cdn', 'assets', 'auth', 'login', 'dashboard', 'knitwright', 'staging', 'dev', 'test',
    'preview', 'studio', 'team', 'club', 'clubs', 'brand', 'brands', 'checkout', 'pay', 'billing'
  );
$$;

create table public.club_pages (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  -- The club's address: `<slug>.knitwright.com`. Lower case letters, digits and single hyphens.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--'),
  -- What the club chose to publish so people can reach it. It may name a person, so it is personal data.
  contact text not null default '' check (length(contact) <= 300 and contact !~ '[[:cntrl:]]'),
  published boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.club_pages is
  'A club''s public page at <slug>.knitwright.com: its address, contact line and whether it is published. Written by the server only.';

-- ---------------------------------------------------------------------------------------------
-- Store windows.

create table public.team_stores (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- The short link: /t/<code>. Random, made by the server.
  code text not null unique check (code ~ '^[A-Za-z0-9]{10}$'),
  title text not null check (length(title) between 1 and 80 and title = btrim(title) and title !~ '[[:cntrl:]]'),
  project_id uuid not null,
  -- The order the store becomes at close, exactly as it will be sent (C1 payment line shape).
  product_id uuid not null references public.brand_products (id) on delete cascade,
  release_id uuid not null,
  factory_profile_id text not null check (length(btrim(factory_profile_id)) between 1 and 120),
  fabric_key text not null check (length(btrim(fabric_key)) between 1 and 120),
  -- What production's checks found at open, sent to ops with the order (F-G2).
  flags jsonb not null default '[]'::jsonb check (jsonb_typeof(flags) = 'array'),
  currency text not null check (currency in ('GBP', 'AUD')),
  -- The base price per piece, from the ladder's tier at the store's minimum, and where it came from.
  unit_minor bigint not null check (unit_minor > 0),
  price_label text not null check (length(btrim(price_label)) between 1 and 300),
  -- F-T6: the club's margin, added on top of the base price and paid to the club after close.
  margin_bps integer not null default 0 check (margin_bps in (0, 500, 1000, 1500, 2000)),
  margin_minor bigint not null check (margin_minor >= 0),
  sizes jsonb not null check (jsonb_typeof(sizes) = 'array' and jsonb_array_length(sizes) between 1 and 30),
  names_numbers boolean not null default true,
  -- The longest shirt name the design's name zone fits (shirt_zone_limits), and the number range (F-T4 0-99).
  name_max integer not null check (name_max between 1 and 40),
  number_min integer not null default 0 check (number_min between 0 and 999),
  number_max integer not null default 99 check (number_max between 0 and 999),
  -- F-T6: "a minimum to proceed (default 10 pieces)".
  min_pieces integer not null default 10 check (min_pieces between 1 and 10000),
  -- The roster the store collects for, when one is attached.
  season_id uuid references public.club_seasons (id) on delete set null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closing', 'closed', 'refunding', 'refunded')),
  pieces_sold integer check (pieces_sold is null or pieces_sold >= 0),
  close_sizes jsonb check (close_sizes is null or jsonb_typeof(close_sizes) = 'object'),
  close_request_key text unique check (close_request_key is null or length(close_request_key) between 8 and 64),
  order_id uuid references public.ops_orders (id) on delete set null,
  run_id uuid,
  close_message text check (close_message is null or length(close_message) <= 500),
  margin_owed_minor bigint check (margin_owed_minor is null or margin_owed_minor >= 0),
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  constraint team_stores_dates check (closes_at > opens_at),
  constraint team_stores_numbers check (number_max >= number_min),
  constraint team_stores_closing_names_an_order check ((status in ('closing', 'closed')) = (close_request_key is not null)),
  constraint team_stores_closed_has_an_order check (status <> 'closed' or order_id is not null)
);

comment on table public.team_stores is
  'A club''s team store window (F-T6): dates, sizes, minimum, club margin, and the one order it becomes at close. Written by the server only.';

create index team_stores_brand on public.team_stores (brand_id, created_at desc);
create index team_stores_due on public.team_stores (closes_at) where status in ('open', 'closing', 'refunding');

-- One buyer's purchase. The money is the C1 payment it names.
create table public.team_store_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  brand_id uuid not null references public.brands (id) on delete cascade,
  payment_id uuid not null unique references public.order_payments (id) on delete cascade,
  request_key text not null check (length(request_key) between 8 and 64),
  -- Personal data of someone with no account: for the receipt and the refund, nothing else.
  buyer_name text not null check (
    (details_erased_at is not null and buyer_name = '')
    or (length(btrim(buyer_name)) between 1 and 80 and buyer_name !~ '[[:cntrl:]]')
  ),
  buyer_email text not null check (
    (details_erased_at is not null and buyer_email = '')
    or (buyer_email = lower(buyer_email) and length(buyer_email) between 3 and 254 and buyer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ),
  pieces integer not null check (pieces between 1 and 10),
  amount_minor bigint not null check (amount_minor > 0),
  -- True when the store's close counted this purchase into its order (or its refund).
  counted boolean not null default false,
  details_erased_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (store_id, request_key),
  foreign key (store_id, brand_id) references public.team_stores (id, brand_id) on delete cascade
);

comment on table public.team_store_orders is
  'One purchase from a team store by someone with no account: their name and email for the receipt and refund. Erased 180 days after close. Written by the server only.';

create index team_store_orders_store on public.team_store_orders (store_id, created_at);

create table public.team_store_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  store_id uuid not null,
  brand_id uuid not null references public.brands (id) on delete cascade,
  position integer not null check (position between 1 and 10),
  size_label text not null check (length(size_label) between 1 and 16),
  -- Empty when the store prints no names, or after the details are erased. Personal data.
  print_name text not null default '' check (length(print_name) <= 40 and print_name !~ '[[:cntrl:]]'),
  -- Digits as printed, so "07" and "7" stay different. Empty when none.
  print_number text not null default '' check (print_number = '' or print_number ~ '^[0-9]{1,3}$'),
  unique (order_id, position),
  foreign key (order_id, brand_id) references public.team_store_orders (id, brand_id) on delete cascade
);

comment on table public.team_store_order_lines is
  'One piece of a team store purchase: size, and the shirt name and number when the store prints them. Written by the server only.';

create index team_store_order_lines_store on public.team_store_order_lines (store_id);

revoke all on public.club_pages, public.team_stores, public.team_store_orders, public.team_store_order_lines
  from public, anon, authenticated, service_role;
grant select on public.club_pages, public.team_stores, public.team_store_orders, public.team_store_order_lines
  to authenticated, service_role;

alter table public.club_pages enable row level security;
alter table public.team_stores enable row level security;
alter table public.team_store_orders enable row level security;
alter table public.team_store_order_lines enable row level security;

create policy "members read their club page" on public.club_pages for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their team stores" on public.team_stores for select to authenticated
  using (private.is_member(brand_id) or private.is_platform_admin());
create policy "members read their team store orders" on public.team_store_orders for select to authenticated
  using (private.is_member(brand_id) or private.is_platform_admin());
create policy "members read their team store lines" on public.team_store_order_lines for select to authenticated
  using (private.is_member(brand_id) or private.is_platform_admin());

-- ---------------------------------------------------------------------------------------------
-- The club page.

create function public.set_club_page(p_brand_id uuid, p_user_id uuid, p_slug text, p_contact text, p_published boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'Only the club''s owners, admins and kit managers change its page.' using errcode = '42501';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' or v_slug ~ '--' then
    raise exception 'An address is 3 to 40 lower case letters, digits and single hyphens.' using errcode = '22023', hint = 'invalid_slug';
  end if;
  if private.reserved_subdomain(v_slug) then
    raise exception 'That address is kept for Knitwright. Choose another.' using errcode = 'P0001', hint = 'slug_taken';
  end if;
  if exists (select 1 from public.club_pages c where c.slug = v_slug and c.brand_id <> p_brand_id) then
    raise exception 'Another club has that address. Choose another.' using errcode = 'P0001', hint = 'slug_taken';
  end if;
  insert into public.club_pages as c (brand_id, slug, contact, published, updated_by)
  values (p_brand_id, v_slug, btrim(coalesce(p_contact, '')), coalesce(p_published, false), p_user_id)
  on conflict (brand_id) do update set
    slug = excluded.slug, contact = excluded.contact, published = excluded.published,
    updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Opening a store. The app has priced it from the ladder and run the order checks (D1 gate, content screen,
-- golden sample) for the release; the database checks that every part belongs to this club.

create function public.open_team_store(
  p_brand_id uuid, p_user_id uuid, p_code text, p_title text, p_project_id uuid, p_product_id uuid,
  p_release_id uuid, p_factory_profile_id text, p_fabric_key text, p_flags jsonb, p_currency text,
  p_unit_minor bigint, p_price_label text, p_margin_bps integer, p_sizes jsonb, p_names_numbers boolean,
  p_name_max integer, p_min_pieces integer, p_season_id uuid, p_opens_at timestamptz, p_closes_at timestamptz
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
    raise exception 'Only the club''s owners, admins and kit managers open a team store.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.brand_products x where x.id = p_product_id and x.brand_id = p_brand_id and x.project_id = p_project_id) then
    raise exception 'That product does not exist.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.production_releases r where r.id = p_release_id and r.brand_id = p_brand_id and r.project_id = p_project_id) then
    raise exception 'That release does not exist.' using errcode = 'P0002', hint = 'release_not_found';
  end if;
  if p_season_id is not null and not exists (select 1 from public.club_seasons s where s.id = p_season_id and s.brand_id = p_brand_id) then
    raise exception 'That season does not exist.' using errcode = 'P0002';
  end if;
  if p_closes_at is null or p_opens_at is null or p_closes_at <= now() or p_closes_at <= p_opens_at
     or p_closes_at > p_opens_at + interval '90 days' then
    raise exception 'A store closes after it opens, in the future, and within 90 days of opening.' using errcode = '22023', hint = 'invalid_dates';
  end if;
  if p_sizes is null or jsonb_typeof(p_sizes) <> 'array' or jsonb_array_length(p_sizes) not between 1 and 30
     or exists (select 1 from jsonb_array_elements(p_sizes) e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 16) then
    raise exception 'Choose the sizes the store sells.' using errcode = '22023', hint = 'invalid_sizes';
  end if;

  insert into public.team_stores (
    brand_id, code, title, project_id, product_id, release_id, factory_profile_id, fabric_key, flags, currency,
    unit_minor, price_label, margin_bps, margin_minor, sizes, names_numbers, name_max, min_pieces, season_id,
    opens_at, closes_at, created_by
  ) values (
    p_brand_id, p_code, btrim(p_title), p_project_id, p_product_id, p_release_id, btrim(p_factory_profile_id),
    btrim(p_fabric_key), coalesce(p_flags, '[]'::jsonb), p_currency, p_unit_minor, btrim(p_price_label),
    p_margin_bps, (p_unit_minor * p_margin_bps + 5000) / 10000, p_sizes, coalesce(p_names_numbers, true),
    p_name_max, p_min_pieces, p_season_id, p_opens_at, p_closes_at, p_user_id
  ) returning id into v_id;
  return v_id;
end;
$$;

-- The club closes a store now (its orders become the order at the next close run), or cancels it (everyone who
-- paid is refunded). Only an open store moves.
create function public.end_team_store(p_brand_id uuid, p_user_id uuid, p_store_id uuid, p_how text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'Only the club''s owners, admins and kit managers close a team store.' using errcode = '42501';
  end if;
  if p_how not in ('close', 'cancel') then
    raise exception 'A store is closed or cancelled.' using errcode = '22023', hint = 'invalid_input';
  end if;
  update public.team_stores s set
    opens_at = least(s.opens_at, now() - interval '1 second'),
    closes_at = least(s.closes_at, now()),
    status = case when p_how = 'cancel' then 'refunding' else s.status end,
    close_message = case when p_how = 'cancel' then 'The club cancelled the store, so everyone who paid is refunded.' else s.close_message end,
    closed_at = case when p_how = 'cancel' then now() else s.closed_at end
  where s.id = p_store_id and s.brand_id = p_brand_id and s.status = 'open';
  if not found then
    raise exception 'That store is not open.' using errcode = 'P0001', hint = 'store_not_open';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Buying. Everything is checked here again, and the amount is worked out here from the store's own prices: the
-- browser sends only sizes, names and numbers. A second call with the same request key answers that payment.

create function public.open_team_store_payment(
  p_code text, p_request_key text, p_buyer_name text, p_buyer_email text, p_lines jsonb
)
returns table (payment_id uuid, store_id uuid, brand_id uuid, amount_minor bigint, currency text, description text, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.team_stores;
  v_existing public.team_store_orders;
  v_pieces integer := coalesce(jsonb_array_length(case when jsonb_typeof(p_lines) = 'array' then p_lines end), 0);
  v_amount bigint;
  v_payment uuid;
  v_order uuid;
  v_line record;
begin
  select * into v_store from public.team_stores s where s.code = p_code;
  if not found then
    raise exception 'That store does not exist.' using errcode = 'P0002', hint = 'store_not_found';
  end if;
  select * into v_existing from public.team_store_orders o where o.store_id = v_store.id and o.request_key = p_request_key;
  if found then
    return query select v_existing.payment_id, v_store.id, v_store.brand_id, v_existing.amount_minor, v_store.currency,
      ('Team store: ' || v_store.title)::text, false;
    return;
  end if;
  if v_store.status <> 'open' or now() < v_store.opens_at or now() >= v_store.closes_at then
    raise exception 'This store is not taking orders.' using errcode = 'P0001', hint = 'store_not_open';
  end if;
  if p_request_key is null or length(p_request_key) not between 8 and 64 or v_pieces not between 1 and 10 then
    raise exception 'An order is 1 to 10 pieces.' using errcode = '22023', hint = 'invalid_input';
  end if;
  for v_line in select * from jsonb_to_recordset(p_lines) as l(size_label text, print_name text, print_number text) loop
    if v_line.size_label is null or not (v_store.sizes ? v_line.size_label) then
      raise exception 'Choose one of the store''s sizes.' using errcode = '22023', hint = 'invalid_sizes';
    end if;
    if not v_store.names_numbers and (coalesce(v_line.print_name, '') <> '' or coalesce(v_line.print_number, '') <> '') then
      raise exception 'This store prints no names or numbers.' using errcode = '22023', hint = 'invalid_input';
    end if;
    if length(coalesce(v_line.print_name, '')) > v_store.name_max then
      raise exception 'A shirt name here fits % characters.', v_store.name_max using errcode = '22023', hint = 'invalid_name';
    end if;
    if coalesce(v_line.print_number, '') <> '' then
      if v_line.print_number !~ '^[0-9]{1,3}$' then
        raise exception 'A number here is % to %.', v_store.number_min, v_store.number_max using errcode = '22023', hint = 'invalid_number';
      end if;
      if v_line.print_number::integer not between v_store.number_min and v_store.number_max then
        raise exception 'A number here is % to %.', v_store.number_min, v_store.number_max using errcode = '22023', hint = 'invalid_number';
      end if;
    end if;
  end loop;

  v_amount := v_pieces * (v_store.unit_minor + v_store.margin_minor);
  insert into public.order_payments (
    brand_id, purpose, method, status, currency, order_value_minor, amount_minor, schedule, balance_due_minor, description, created_by
  ) values (
    v_store.brand_id, 'team_store', 'card', 'open', v_store.currency, v_amount, v_amount, 'full', 0,
    'Team store: ' || v_store.title, null
  ) returning id into v_payment;
  insert into public.team_store_orders (store_id, brand_id, payment_id, request_key, buyer_name, buyer_email, pieces, amount_minor)
  values (v_store.id, v_store.brand_id, v_payment, p_request_key, btrim(p_buyer_name), lower(btrim(p_buyer_email)), v_pieces, v_amount)
  returning id into v_order;
  insert into public.team_store_order_lines (order_id, store_id, brand_id, position, size_label, print_name, print_number)
  select v_order, v_store.id, v_store.brand_id, l.ordinality::integer, l.value ->> 'size_label',
         btrim(coalesce(l.value ->> 'print_name', '')), btrim(coalesce(l.value ->> 'print_number', ''))
  from jsonb_array_elements(p_lines) with ordinality l;
  return query select v_payment, v_store.id, v_store.brand_id, v_amount, v_store.currency, ('Team store: ' || v_store.title)::text, true;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Closing. Asked by the cron (and right after a club closes or cancels). Only a store whose close time has come
-- moves, and only once: the purchases paid at that moment are counted, and the store becomes `closing` (the order
-- is sent next) or `refunding` (below the minimum). Purchases paid after this are refunded by the app.

create function public.begin_team_store_close(p_store_id uuid)
returns setof public.team_stores
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.team_stores;
  v_pieces integer;
  v_sizes jsonb;
begin
  select * into v from public.team_stores s where s.id = p_store_id for update;
  if not found then
    raise exception 'That store does not exist.' using errcode = 'P0002', hint = 'store_not_found';
  end if;
  if v.status <> 'open' or v.closes_at > now() then
    if v.status = 'refunding' then
      update public.team_store_orders o set counted = true
      where o.store_id = v.id and not o.counted
        and exists (select 1 from public.order_payments p where p.id = o.payment_id and p.status in ('paid', 'fulfilled'));
    end if;
    return next v;
    return;
  end if;

  update public.team_store_orders o set counted = true
  where o.store_id = v.id
    and exists (select 1 from public.order_payments p where p.id = o.payment_id and p.status in ('paid', 'fulfilled'));

  select coalesce(sum(x.n), 0)::integer, coalesce(jsonb_object_agg(x.size_label, x.n), '{}'::jsonb)
    into v_pieces, v_sizes
  from (
    select l.size_label, count(*)::integer as n
    from public.team_store_order_lines l
    join public.team_store_orders o on o.id = l.order_id and o.counted
    where l.store_id = v.id
    group by l.size_label
  ) x;

  if v_pieces >= v.min_pieces then
    update public.team_stores s set status = 'closing', close_sizes = v_sizes, pieces_sold = v_pieces,
      close_request_key = 'team-store:' || s.id::text, margin_owed_minor = v_pieces * s.margin_minor, closed_at = now()
    where s.id = v.id returning * into v;
  else
    update public.team_stores s set status = 'refunding', pieces_sold = v_pieces, margin_owed_minor = 0, closed_at = now(),
      close_message = format('The store closed with %s of the %s pieces it needed, so everyone who paid is refunded.', v_pieces, s.min_pieces)
    where s.id = v.id returning * into v;
  end if;
  return next v;
end;
$$;

-- The close's outcome: the order was sent (closed), production refused it (refunding), or every buyer was refunded
-- (refunded). Each move happens once, from the state before it.
create function public.finish_team_store_close(p_store_id uuid, p_status text, p_order_id uuid, p_run_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status = 'closed' then
    update public.team_stores s set status = 'closed', order_id = p_order_id, run_id = p_run_id
    where s.id = p_store_id and s.status = 'closing' and p_order_id is not null;
  elsif p_status = 'refunding' then
    update public.team_stores s set status = 'refunding', close_request_key = null, close_message = left(p_message, 500)
    where s.id = p_store_id and s.status = 'closing';
  elsif p_status = 'refunded' then
    update public.team_stores s set status = 'refunded'
    where s.id = p_store_id and s.status = 'refunding';
  else
    raise exception 'A close ends closed, refunding or refunded.' using errcode = '22023', hint = 'invalid_input';
  end if;
end;
$$;

-- F-T6 privacy (decision 0136, spec 05): the buyer's name, email and shirt names go 180 days after the store
-- closed. The purchase and its money stay. Idempotent; the server's key only.
create function public.purge_team_store_buyers(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.team_store_order_lines l set print_name = ''
  from public.team_stores s
  where s.id = l.store_id and s.closed_at < p_now - interval '180 days' and l.print_name <> '';
  update public.team_store_orders o set buyer_name = '', buyer_email = '', details_erased_at = p_now
  from public.team_stores s
  where s.id = o.store_id and s.closed_at < p_now - interval '180 days' and o.details_erased_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- THE GATE, widened by one case: a closing store's order is paid for by its buyers. The store names exactly the
-- order it becomes (product, release, factory, fabric, sizes and its own request key), as a payment line does.

create or replace function private.order_is_paid(
  p_brand_id uuid, p_request_key text, p_product_id uuid, p_kind text, p_release_id uuid,
  p_factory_profile_id text, p_fabric_key text, p_sizes jsonb
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.order_payment_lines l
    join public.order_payments p on p.id = l.payment_id
    where l.brand_id = p_brand_id and l.request_key = p_request_key and l.product_id = p_product_id
      and l.kind = p_kind and l.release_id = p_release_id
      and l.factory_profile_id = btrim(p_factory_profile_id) and l.fabric_key = btrim(p_fabric_key)
      and l.sizes = p_sizes and l.status <> 'refused'
      and p.status in ('paid', 'fulfilled', 'invoice')
  ) or exists (
    select 1
    from public.team_stores s
    where s.brand_id = p_brand_id and s.close_request_key = p_request_key and s.product_id = p_product_id
      and p_kind = 'run' and s.release_id = p_release_id
      and s.factory_profile_id = btrim(p_factory_profile_id) and s.fabric_key = btrim(p_fabric_key)
      and s.close_sizes = p_sizes and s.status in ('closing', 'closed')
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- F-G4, with team stores: their buyers' money is GMV and pre-order money until the store's order ships. As
-- migration 20261228010000 wrote it, with `team_store` counted beside `order`.

create or replace function private.finance_figures()
returns table (
  currency text, gmv_minor bigint, collected_minor bigint, refunded_minor bigint, revenue_minor bigint,
  open_pre_order_minor bigint, reserve_minor bigint, deposits_minor bigint, headroom_minor bigint, reserve_bps integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with c(currency) as (values ('GBP'), ('AUD')),
  s as (select refund_reserve_bps from public.payment_settings where id),
  paid as (
    select p.* from public.order_payments p
    where p.method = 'card' and p.status in ('paid', 'fulfilled', 'refunded')
  ),
  sums as (
    select c.currency,
      coalesce((select sum(p.order_value_minor) from paid p where p.currency = c.currency and p.purpose in ('order', 'team_store')), 0)::bigint as gmv,
      coalesce((select sum(p.amount_minor) from paid p where p.currency = c.currency), 0)::bigint as collected,
      coalesce((select sum(p.refunded_minor) from paid p where p.currency = c.currency), 0)::bigint as refunded,
      coalesce((
        select sum(greatest(p.order_value_minor - p.refunded_minor, 0)) from paid p
        where p.currency = c.currency and p.purpose = 'order' and p.status <> 'refunded'
          and exists (
            select 1 from public.order_payment_lines l
            where l.payment_id = p.id and l.status <> 'refused'
              and (l.order_id is null or not exists (select 1 from public.ops_shipments sh where sh.order_id = l.order_id))
          )
      ), 0)::bigint
      + coalesce((
        select sum(greatest(p.order_value_minor - p.refunded_minor, 0)) from paid p
        join public.team_store_orders o on o.payment_id = p.id
        join public.team_stores t on t.id = o.store_id
        where p.currency = c.currency and p.purpose = 'team_store' and p.status <> 'refunded'
          and (t.order_id is null or not exists (select 1 from public.ops_shipments sh where sh.order_id = t.order_id))
      ), 0)::bigint as open_value,
      coalesce((select sum(d.amount_minor) from public.factory_deposits d where d.currency = c.currency), 0)::bigint as deposits
    from c
  )
  select sums.currency, sums.gmv, sums.collected, sums.refunded, sums.collected - sums.refunded, sums.open_value,
         ceil(sums.open_value * s.refund_reserve_bps / 10000.0)::bigint,
         sums.deposits,
         sums.collected - sums.refunded - ceil(sums.open_value * s.refund_reserve_bps / 10000.0)::bigint - sums.deposits,
         s.refund_reserve_bps
  from sums cross join s
  order by case sums.currency when 'GBP' then 0 else 1 end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants: every function is the server's. None is for a browser.

revoke all on function private.reserved_subdomain(text) from public, anon, authenticated, service_role;
revoke all on function public.set_club_page(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.open_team_store(uuid, uuid, text, text, uuid, uuid, uuid, text, text, jsonb, text, bigint, text, integer, jsonb, boolean, integer, integer, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.end_team_store(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.open_team_store_payment(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.begin_team_store_close(uuid) from public, anon, authenticated;
revoke all on function public.finish_team_store_close(uuid, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.purge_team_store_buyers(timestamptz) from public, anon, authenticated;

grant execute on function public.set_club_page(uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.open_team_store(uuid, uuid, text, text, uuid, uuid, uuid, text, text, jsonb, text, bigint, text, integer, jsonb, boolean, integer, integer, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.end_team_store(uuid, uuid, uuid, text) to service_role;
grant execute on function public.open_team_store_payment(text, text, text, text, jsonb) to service_role;
grant execute on function public.begin_team_store_close(uuid) to service_role;
grant execute on function public.finish_team_store_close(uuid, text, uuid, uuid, text) to service_role;
grant execute on function public.purge_team_store_buyers(timestamptz) to service_role;
