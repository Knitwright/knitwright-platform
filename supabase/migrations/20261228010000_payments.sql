-- Payments core (plans/platform-v6.md, workstream C1; decision 0152; spec F-T7, F-S7, F-G4).
--
-- Owner decision 0131: checkout is built in this platform, Knitwright is merchant of record through the
-- UK entity, Stripe Checkout in GBP and AUD. This migration holds what the money side needs and nothing
-- that talks to Stripe: the app's adapter does that (lib/payments), and the database records what Stripe
-- said, once, and refuses anything that does not add up.
--
--   * order_payments        one checkout: an order's lines, a credit pack, or a plan. Card or invoice.
--   * order_payment_lines   the orders a payment pays for, each exactly as it will be sent to production.
--   * payment_events        every Stripe event id seen, so a delivered-twice webhook acts once.
--   * payment_refunds       every refund, from the app or from Stripe's own dashboard, once each.
--   * factory_deposits      money Knitwright sends a factory ahead of production (F-G4).
--   * brand_subscriptions   a brand's plan from Stripe Billing.
--   * payment_settings      the refund reserve, the deposit rule, what an unpriced order does. Labelled.
--
-- THE GATE. submit_brand_run is the one door every app order goes through: the make flow's sample, run
-- and order modal (through submit_make_order), the order drawer, the collection plan's samples and the
-- brand workspace's run. It now refuses an order that has no paid payment line naming exactly that
-- order -- the same brand, request key, product, kind, release, factory, fabric and sizes -- with hint
-- `payment_required`. A line of an invoice payment counts as paid: that is the path for an order whose
-- article has no price on file (setting unpriced_orders, owner question C1-1). The D1 validation gate
-- (decision 0132) stays inside submit_order_for_production, which submit_brand_run still calls, so it
-- runs after the payment check and refuses a paid order whose checks now fail; the app then refunds it.
--
-- Money is integer minor units. Currency is GBP or AUD.

-- ---------------------------------------------------------------------------------------------
-- Settings: one row, labelled, changed only by an ops function.

create table public.payment_settings (
  id boolean primary key default true check (id),
  -- F-G4: "a refund reserve (default 10% of open pre-order value)". Basis points of that value.
  refund_reserve_bps integer not null default 1000 check (refund_reserve_bps between 0 and 10000),
  -- F-S7: "40% deposit + 60% before shipping for runs over £2,000". The share paid at checkout.
  deposit_bps integer not null default 4000 check (deposit_bps between 1 and 9999),
  -- The order value from which a deposit may be chosen, per currency. Null: no deposit in that currency.
  deposit_threshold_gbp_minor bigint default 200000 check (deposit_threshold_gbp_minor is null or deposit_threshold_gbp_minor > 0),
  deposit_threshold_aud_minor bigint check (deposit_threshold_aud_minor is null or deposit_threshold_aud_minor > 0),
  -- An order whose article has no price on file: sent and invoiced by Knitwright, or refused.
  unpriced_orders text not null default 'invoice' check (unpriced_orders in ('invoice', 'refuse')),
  is_placeholder boolean not null default true,
  label text not null check (length(btrim(label)) between 1 and 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.payment_settings (id, label) values (
  true,
  'Spec defaults, not owner answers: refund reserve 10% of open pre-order value (F-G4); deposit 40% over £2,000 (F-S7); no AUD deposit until the AUD ladder exists'
);

-- ---------------------------------------------------------------------------------------------
-- Payments. Brand rows are kept when a brand is deleted, without the brand: money records outlive it.

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id) on delete set null,
  purpose text not null check (purpose in ('order', 'credits', 'plan')),
  method text not null check (method in ('card', 'invoice')),
  status text not null check (status in ('open', 'paid', 'fulfilled', 'invoice', 'expired', 'refunded')),
  currency text not null check (currency in ('GBP', 'AUD')),
  -- The whole order's value (GMV). Null for an invoice order, whose article has no price on file.
  order_value_minor bigint check (order_value_minor is null or order_value_minor >= 0),
  -- What the card is charged now: the whole value, or the deposit.
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  schedule text not null default 'full' check (schedule in ('full', 'deposit')),
  balance_due_minor bigint not null default 0 check (balance_due_minor >= 0),
  refunded_minor bigint not null default 0 check (refunded_minor >= 0),
  provider text check (provider in ('stripe', 'test')),
  provider_session_id text unique check (provider_session_id is null or length(provider_session_id) between 1 and 255),
  provider_payment_id text check (provider_payment_id is null or length(provider_payment_id) between 1 and 255),
  credits integer check (credits is null or credits between 1 and 1000000),
  plan_id text check (plan_id is null or plan_id ~ '^[a-z_]{1,40}$'),
  plan_interval text check (plan_interval is null or plan_interval in ('month', 'year')),
  description text not null check (length(btrim(description)) between 1 and 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  constraint order_payments_refund_within_charge check (refunded_minor <= amount_minor),
  constraint order_payments_invoice_has_no_card check (
    method = 'card' or (provider is null and amount_minor = 0 and order_value_minor is null and status in ('invoice', 'fulfilled'))
  ),
  constraint order_payments_card_charges check (method = 'invoice' or amount_minor > 0),
  constraint order_payments_card_is_not_an_invoice check (method = 'invoice' or status <> 'invoice'),
  constraint order_payments_balance_adds_up check (
    purpose <> 'order' or method = 'invoice' or order_value_minor = amount_minor + balance_due_minor
  ),
  constraint order_payments_deposit_leaves_a_balance check ((schedule = 'deposit') = (balance_due_minor > 0)),
  constraint order_payments_credits_name_a_pack check ((purpose = 'credits') = (credits is not null)),
  constraint order_payments_plan_names_a_plan check ((purpose = 'plan') = (plan_id is not null and plan_interval is not null)),
  constraint order_payments_only_orders_invoice check (method = 'card' or purpose = 'order'),
  constraint order_payments_paid_says_when check ((status in ('paid', 'fulfilled', 'refunded') and method = 'card') <= (paid_at is not null))
);

create index order_payments_brand on public.order_payments (brand_id, created_at desc);

create table public.order_payment_lines (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.order_payments (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  request_key text not null check (length(request_key) between 8 and 64),
  door text not null check (door in ('make', 'brand_run')),
  product_id uuid not null,
  project_id uuid not null,
  kind text not null check (kind in ('sample', 'run')),
  release_id uuid not null,
  factory_profile_id text not null check (length(btrim(factory_profile_id)) between 1 and 120),
  fabric_key text not null check (length(btrim(fabric_key)) between 1 and 120),
  sizes jsonb not null check (jsonb_typeof(sizes) = 'object'),
  flags jsonb not null default '[]'::jsonb check (jsonb_typeof(flags) = 'array'),
  pieces integer not null check (pieces between 1 and 1000000),
  value_minor bigint check (value_minor is null or value_minor >= 0),
  price_label text check (price_label is null or length(price_label) <= 300),
  status text not null default 'waiting' check (status in ('waiting', 'submitted', 'refused')),
  order_id uuid references public.ops_orders (id) on delete set null,
  run_id uuid,
  message text check (message is null or length(message) <= 500),
  submitted_at timestamptz,
  constraint order_payment_lines_submitted_has_an_order check ((status = 'submitted') = (submitted_at is not null))
);

create unique index order_payment_lines_request on public.order_payment_lines (brand_id, request_key);
create index order_payment_lines_payment on public.order_payment_lines (payment_id);
create index order_payment_lines_order on public.order_payment_lines (order_id);

create table public.payment_events (
  provider_event_id text primary key check (length(provider_event_id) between 1 and 255),
  type text not null check (length(type) between 1 and 120),
  received_at timestamptz not null default now()
);

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.order_payments (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('GBP', 'AUD')),
  provider_refund_id text unique check (provider_refund_id is null or length(provider_refund_id) between 1 and 255),
  reason text not null check (length(btrim(reason)) between 1 and 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index payment_refunds_payment on public.payment_refunds (payment_id);

create table public.factory_deposits (
  id uuid primary key default gen_random_uuid(),
  factory_profile_id text not null check (length(btrim(factory_profile_id)) between 1 and 120),
  currency text not null check (currency in ('GBP', 'AUD')),
  amount_minor bigint not null check (amount_minor > 0),
  note text not null check (length(btrim(note)) between 1 and 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.brand_subscriptions (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  plan_id text not null check (plan_id ~ '^[a-z_]{1,40}$'),
  plan_interval text not null check (plan_interval in ('month', 'year')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  provider text not null check (provider in ('stripe', 'test')),
  provider_customer_id text check (provider_customer_id is null or length(provider_customer_id) between 1 and 255),
  provider_subscription_id text not null unique check (length(provider_subscription_id) between 1 and 255),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- Who reads what: members their own brand's payments, lines and plan; platform admins everything.
revoke all on public.payment_settings, public.order_payments, public.order_payment_lines, public.payment_events,
  public.payment_refunds, public.factory_deposits, public.brand_subscriptions from public, anon, authenticated, service_role;
grant select on public.payment_settings, public.order_payments, public.order_payment_lines, public.payment_events,
  public.payment_refunds, public.factory_deposits, public.brand_subscriptions to authenticated, service_role;

alter table public.payment_settings enable row level security;
alter table public.order_payments enable row level security;
alter table public.order_payment_lines enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.factory_deposits enable row level security;
alter table public.brand_subscriptions enable row level security;

create policy "platform admins read payment settings" on public.payment_settings for select to authenticated
  using (private.is_platform_admin());
create policy "members and admins read payments" on public.order_payments for select to authenticated
  using (private.is_platform_admin() or (brand_id is not null and private.is_member(brand_id)));
create policy "members and admins read payment lines" on public.order_payment_lines for select to authenticated
  using (private.is_platform_admin() or (brand_id is not null and private.is_member(brand_id)));
create policy "platform admins read payment events" on public.payment_events for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read refunds" on public.payment_refunds for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read factory deposits" on public.factory_deposits for select to authenticated
  using (private.is_platform_admin());
create policy "members and admins read subscriptions" on public.brand_subscriptions for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));

-- ---------------------------------------------------------------------------------------------
-- Opening a payment. The app has priced it from the rows (lib/payments/pricing.ts); the database checks
-- that the parts add up and that the person may buy it. An order's lines are stored exactly as they will
-- be sent. A second call whose first request key is already used answers with that payment, so a double
-- press opens one checkout, not two.

create function public.open_order_payment(
  p_brand_id uuid,
  p_user_id uuid,
  p_purpose text,
  p_method text,
  p_currency text,
  p_order_value_minor bigint,
  p_amount_minor bigint,
  p_schedule text,
  p_description text,
  p_credits integer,
  p_plan_id text,
  p_plan_interval text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_lines integer := coalesce(jsonb_array_length(case when jsonb_typeof(p_lines) = 'array' then p_lines end), 0);
  v_sum bigint;
  v_unpriced integer;
begin
  if p_purpose = 'order' and not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not order for this brand.' using errcode = '42501';
  end if;
  if p_purpose in ('credits', 'plan') and not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'Only owners and admins buy credits and plans for this brand.' using errcode = '42501';
  end if;
  if p_purpose = 'order' and (v_lines not between 1 and 50) then
    raise exception 'An order payment pays for 1 to 50 orders.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if p_purpose <> 'order' and v_lines <> 0 then
    raise exception 'Only an order payment has orders.' using errcode = '22023', hint = 'invalid_input';
  end if;

  if p_purpose = 'order' then
    select l.payment_id into v_id
    from public.order_payment_lines l
    where l.brand_id = p_brand_id and l.request_key = (p_lines -> 0 ->> 'request_key');
    if found then
      return v_id;
    end if;
    select coalesce(sum((l ->> 'value_minor')::bigint), 0), count(*) filter (where l ->> 'value_minor' is null)
      into v_sum, v_unpriced
    from jsonb_array_elements(p_lines) l;
    if (p_method = 'card' and (v_unpriced > 0 or v_sum <> p_order_value_minor))
       or (p_method = 'invoice' and v_unpriced = 0) then
      raise exception 'The order lines do not add up to the payment.' using errcode = '22023', hint = 'payment_mismatch';
    end if;
  end if;

  insert into public.order_payments (
    brand_id, purpose, method, status, currency, order_value_minor, amount_minor, schedule, balance_due_minor,
    description, credits, plan_id, plan_interval, created_by
  ) values (
    p_brand_id, p_purpose, p_method, case when p_method = 'invoice' then 'invoice' else 'open' end, p_currency,
    case when p_method = 'invoice' then null else p_order_value_minor end,
    case when p_method = 'invoice' then 0 else p_amount_minor end,
    coalesce(p_schedule, 'full'),
    case when p_purpose = 'order' and p_method = 'card' then p_order_value_minor - p_amount_minor else 0 end,
    btrim(p_description), p_credits, p_plan_id, p_plan_interval, p_user_id
  ) returning id into v_id;

  insert into public.order_payment_lines (
    payment_id, brand_id, request_key, door, product_id, project_id, kind, release_id, factory_profile_id,
    fabric_key, sizes, flags, pieces, value_minor, price_label
  )
  select v_id, p_brand_id, l.request_key, l.door, l.product_id, l.project_id, l.kind, l.release_id,
         btrim(l.factory_profile_id), btrim(l.fabric_key), l.sizes, coalesce(l.flags, '[]'::jsonb), l.pieces,
         l.value_minor, l.price_label
  from jsonb_to_recordset(case when p_purpose = 'order' then p_lines else '[]'::jsonb end) as l(
    request_key text, door text, product_id uuid, project_id uuid, kind text, release_id uuid,
    factory_profile_id text, fabric_key text, sizes jsonb, flags jsonb, pieces integer, value_minor bigint, price_label text
  );
  return v_id;
end;
$$;

-- The checkout Stripe made for a payment.
create function public.attach_payment_session(p_payment_id uuid, p_provider text, p_session_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_payments p
  set provider = p_provider, provider_session_id = p_session_id
  where p.id = p_payment_id and p.status = 'open' and p.method = 'card'
    and (p.provider_session_id is null or p.provider_session_id = p_session_id);
  if not found then
    raise exception 'That payment is not waiting for a checkout.' using errcode = 'P0001', hint = 'payment_not_open';
  end if;
end;
$$;

-- Stripe says a checkout was paid. The amount and currency must be the ones the payment was opened for;
-- anything else is refused and left for a person. A payment already past `open` answers as it is.
create function public.record_payment_paid(p_session_id text, p_provider_payment_id text, p_amount_minor bigint, p_currency text)
returns setof public.order_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.order_payments;
begin
  select * into v from public.order_payments p where p.provider_session_id = p_session_id for update;
  if not found then
    raise exception 'No payment has that checkout.' using errcode = 'P0002', hint = 'payment_not_found';
  end if;
  if v.status not in ('open', 'expired') then
    return next v;
    return;
  end if;
  if p_amount_minor is null or p_currency is null or v.amount_minor <> p_amount_minor or v.currency <> upper(p_currency) then
    raise exception 'The amount paid is not the amount asked for.' using errcode = 'P0001', hint = 'payment_mismatch';
  end if;
  update public.order_payments p
  set status = 'paid', paid_at = now(), provider_payment_id = p_provider_payment_id
  where p.id = v.id
  returning * into v;
  return next v;
end;
$$;

-- A checkout that ran out of time or was abandoned. Only an open one moves.
create function public.record_payment_expired(p_session_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.order_payments p set status = 'expired' where p.provider_session_id = p_session_id and p.status = 'open';
$$;

-- One order line reached production, or was refused on the way. A settled line never moves again.
create function public.settle_payment_line(p_line_id uuid, p_status text, p_order_id uuid, p_run_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('submitted', 'refused') then
    raise exception 'A line is submitted or refused.' using errcode = '22023', hint = 'invalid_input';
  end if;
  update public.order_payment_lines l
  set status = p_status, order_id = p_order_id, run_id = p_run_id, message = left(p_message, 500),
      submitted_at = case when p_status = 'submitted' then now() end
  where l.id = p_line_id and l.status = 'waiting';
end;
$$;

-- A paid (or invoice) payment whose work is done: its orders settled, its credits given or its plan recorded.
create function public.finish_payment(p_payment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.order_payments p set status = 'fulfilled', fulfilled_at = now()
  where p.id = p_payment_id and p.status in ('paid', 'invoice')
    and not exists (select 1 from public.order_payment_lines l where l.payment_id = p.id and l.status = 'waiting');
$$;

-- A Stripe event, once. True the first time an id is seen, false after.
create function public.record_payment_event(p_event_id text, p_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payment_events (provider_event_id, type) values (p_event_id, p_type) on conflict do nothing;
  return found;
end;
$$;

-- A refund, once per Stripe refund id. Never more than was charged. A payment refunded in full says so.
create function public.record_payment_refund(p_payment_id uuid, p_amount_minor bigint, p_provider_refund_id text, p_reason text, p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.order_payments;
begin
  select * into v from public.order_payments p where p.id = p_payment_id for update;
  if not found or v.method <> 'card' or v.status not in ('paid', 'fulfilled', 'refunded') then
    raise exception 'That payment has nothing to refund.' using errcode = 'P0001', hint = 'nothing_to_refund';
  end if;
  if p_provider_refund_id is not null and exists (select 1 from public.payment_refunds r where r.provider_refund_id = p_provider_refund_id) then
    return false;
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or v.refunded_minor + p_amount_minor > v.amount_minor then
    raise exception 'A refund is more than nothing and never more than what is left of the charge.' using errcode = 'P0001', hint = 'refund_too_large';
  end if;
  insert into public.payment_refunds (payment_id, amount_minor, currency, provider_refund_id, reason, created_by)
  values (v.id, p_amount_minor, v.currency, p_provider_refund_id, btrim(p_reason), p_actor);
  update public.order_payments p
  set refunded_minor = p.refunded_minor + p_amount_minor,
      status = case when p.refunded_minor + p_amount_minor = p.amount_minor then 'refunded' else p.status end
  where p.id = v.id;
  return true;
end;
$$;

-- A brand's plan as Stripe Billing last described it.
create function public.record_brand_subscription(
  p_brand_id uuid, p_plan_id text, p_plan_interval text, p_status text, p_provider text,
  p_customer_id text, p_subscription_id text, p_current_period_end timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.brand_subscriptions as s (
    brand_id, plan_id, plan_interval, status, provider, provider_customer_id, provider_subscription_id, current_period_end
  ) values (p_brand_id, p_plan_id, p_plan_interval, p_status, p_provider, p_customer_id, p_subscription_id, p_current_period_end)
  on conflict (brand_id) do update set
    plan_id = excluded.plan_id, plan_interval = excluded.plan_interval, status = excluded.status,
    provider = excluded.provider, provider_customer_id = coalesce(excluded.provider_customer_id, s.provider_customer_id),
    provider_subscription_id = excluded.provider_subscription_id,
    current_period_end = coalesce(excluded.current_period_end, s.current_period_end), updated_at = now();
$$;

-- A later change to a subscription already recorded, by its Stripe id. An unknown id changes nothing.
create function public.update_brand_subscription(p_subscription_id text, p_status text, p_current_period_end timestamptz)
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  update public.brand_subscriptions s
  set status = p_status, current_period_end = coalesce(p_current_period_end, s.current_period_end), updated_at = now()
  where s.provider_subscription_id = p_subscription_id
  returning s.brand_id;
$$;

-- ---------------------------------------------------------------------------------------------
-- F-G4 financial controls. One set of figures per currency, worked out here so the ops page and the
-- deposit check below can never disagree:
--
--   gmv            the whole value of every order paid by card, deposits counted at the order's full value;
--   collected      what cards were charged, for orders, credits and plans;
--   refunded       what was given back;
--   revenue        collected less refunded: Knitwright's own takings. GMV is never added to it;
--   open_pre_order what paid orders are worth, less refunds, while any of their orders has not shipped;
--   reserve        refund_reserve_bps of open_pre_order, rounded up;
--   deposits       what Knitwright has sent factories;
--   headroom       collected - refunded - reserve - deposits: the most the next deposit may be.

create function private.finance_figures()
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
      coalesce((select sum(p.order_value_minor) from paid p where p.currency = c.currency and p.purpose = 'order'), 0)::bigint as gmv,
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

-- The figures, for platform admins only.
create function public.ops_finance_figures(p_actor uuid)
returns table (
  currency text, gmv_minor bigint, collected_minor bigint, refunded_minor bigint, revenue_minor bigint,
  open_pre_order_minor bigint, reserve_minor bigint, deposits_minor bigint, headroom_minor bigint, reserve_bps integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  return query select * from private.finance_figures();
end;
$$;

-- A deposit Knitwright sends a factory. F-G4: never more than collected cash less the refund reserve,
-- counting every deposit already sent. Refused with hint `deposit_over_cash` and the headroom in words.
create function public.record_factory_deposit(p_actor uuid, p_factory_profile_id text, p_currency text, p_amount_minor bigint, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headroom bigint;
  v_id uuid;
begin
  perform private.require_ops_actor(p_actor);
  if p_currency not in ('GBP', 'AUD') or p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'A deposit is a positive amount in GBP or AUD.' using errcode = '22023', hint = 'invalid_input';
  end if;
  -- One deposit decided at a time, so two at once cannot both fit the same headroom.
  perform pg_advisory_xact_lock(hashtextextended('factory_deposits', 0));
  select f.headroom_minor into v_headroom from private.finance_figures() f where f.currency = p_currency;
  if p_amount_minor > v_headroom then
    raise exception 'That deposit is more than collected cash less the refund reserve and the deposits already sent (% minor units free).', greatest(v_headroom, 0)
      using errcode = 'P0001', hint = 'deposit_over_cash';
  end if;
  insert into public.factory_deposits (factory_profile_id, currency, amount_minor, note, created_by)
  values (btrim(p_factory_profile_id), p_currency, p_amount_minor, btrim(p_note), p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- The settings, changed by a platform admin. Saving them says they are no longer the spec's placeholder.
create function public.set_payment_settings(
  p_actor uuid, p_refund_reserve_bps integer, p_deposit_bps integer, p_deposit_threshold_gbp_minor bigint,
  p_deposit_threshold_aud_minor bigint, p_unpriced_orders text, p_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  update public.payment_settings s set
    refund_reserve_bps = p_refund_reserve_bps, deposit_bps = p_deposit_bps,
    deposit_threshold_gbp_minor = p_deposit_threshold_gbp_minor, deposit_threshold_aud_minor = p_deposit_threshold_aud_minor,
    unpriced_orders = p_unpriced_orders, label = btrim(p_label), is_placeholder = false,
    updated_at = now(), updated_by = p_actor
  where s.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- THE GATE: an order goes to production only when a paid (or invoice) payment line names it exactly.

create function private.order_is_paid(
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
  );
$$;

-- submit_brand_run as migration 20261028030000 wrote it, with one check added after the replay answer:
-- the payment. A retry of an order already sent still answers with that order.
create or replace function public.submit_brand_run(
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

  -- Plan v6 C1 (decision 0152): not to production until paid.
  if not private.order_is_paid(p_brand_id, p_request_key, p_product_id, p_kind, p_release_id, p_factory_profile_id, p_fabric_key, p_sizes) then
    raise exception 'This order is not paid yet. It goes to production once its checkout is paid.'
      using errcode = 'P0001', hint = 'payment_required';
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

-- ---------------------------------------------------------------------------------------------
-- Grants: every function is the server's. None is for a browser.

revoke all on function private.finance_figures() from public, anon, authenticated, service_role;
revoke all on function private.order_is_paid(uuid, text, uuid, text, uuid, text, text, jsonb) from public, anon, authenticated, service_role;

revoke all on function public.open_order_payment(uuid, uuid, text, text, text, bigint, bigint, text, text, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.attach_payment_session(uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_payment_paid(text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.record_payment_expired(text) from public, anon, authenticated;
revoke all on function public.settle_payment_line(uuid, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_payment(uuid) from public, anon, authenticated;
revoke all on function public.record_payment_event(text, text) from public, anon, authenticated;
revoke all on function public.record_payment_refund(uuid, bigint, text, text, uuid) from public, anon, authenticated;
revoke all on function public.record_brand_subscription(uuid, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.update_brand_subscription(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.ops_finance_figures(uuid) from public, anon, authenticated;
revoke all on function public.record_factory_deposit(uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.set_payment_settings(uuid, integer, integer, bigint, bigint, text, text) from public, anon, authenticated;

grant execute on function public.open_order_payment(uuid, uuid, text, text, text, bigint, bigint, text, text, integer, text, text, jsonb) to service_role;
grant execute on function public.attach_payment_session(uuid, text, text) to service_role;
grant execute on function public.record_payment_paid(text, text, bigint, text) to service_role;
grant execute on function public.record_payment_expired(text) to service_role;
grant execute on function public.settle_payment_line(uuid, text, uuid, uuid, text) to service_role;
grant execute on function public.finish_payment(uuid) to service_role;
grant execute on function public.record_payment_event(text, text) to service_role;
grant execute on function public.record_payment_refund(uuid, bigint, text, text, uuid) to service_role;
grant execute on function public.record_brand_subscription(uuid, text, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.update_brand_subscription(text, text, timestamptz) to service_role;
grant execute on function public.ops_finance_figures(uuid) to service_role;
grant execute on function public.record_factory_deposit(uuid, text, text, bigint, text) to service_role;
grant execute on function public.set_payment_settings(uuid, integer, integer, bigint, bigint, text, text) to service_role;
