-- Credits (plan v4, workstream V6): the currency of paid outputs.
--
-- Designing, saved versions, 3D views, the team store hand-off and the tech pack summary are free.
-- Marketing media, the full tech pack PDF and pattern files will cost credits, and credits spent
-- on a design come back when that design is ordered. Nothing is gated by this migration: it holds
-- the ledger, the price list and the functions that move credits. Wave 2 wires them into exports.
--
-- Credits are not the beta usage caps (decision 0012). A cap limits what Knitwright pays for AI
-- calls; credits are what a brand spends. Both stay. See decision record 0044.
--
-- The ledger is append-only. A line is a grant, a spend, a refund or an expiry; the balance is the
-- sum of the lines and is never stored or edited. Like a saved version of a design, a line can
-- never be changed or removed; the delete is let through only when the brand itself is deleted.
--
-- Only the server writes, through the functions below, which only the server's own key may run.
-- Members read their brand's lines and the price list. Nothing here refers to another
-- workstream's tables: a line names a design version by its hash, so migrations merge in any order.
--
-- Every price in credit_prices is a PLACEHOLDER from lib/credits/settings.ts. The owner has not set
-- real prices.

create table public.credit_prices (
  output_kind text primary key check (output_kind in ('marketing_media', 'techpack_pdf', 'pattern_file')),
  credits integer not null check (credits between 0 and 100000),
  -- True until the owner sets the real price.
  is_placeholder boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.credit_prices is
  'What an output costs in credits. Platform data, readable by signed-in users, written only by credit_set_prices. The seeded values are placeholders, not prices.';

insert into public.credit_prices (output_kind, credits, is_placeholder) values
  ('marketing_media', 1, true),
  ('techpack_pdf', 1, true),
  ('pattern_file', 1, true);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  -- The order lines were made in, for a stable history when two share a moment.
  seq bigint generated always as identity,
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind text not null check (kind in ('grant', 'spend', 'refund', 'expire')),
  -- Signed: grants and refunds add, spends and expiries take away.
  amount integer not null check (amount <> 0 and amount between -1000000 and 1000000),
  output_kind text check (output_kind in ('marketing_media', 'techpack_pdf', 'pattern_file')),
  -- The saved version of the design a spend or refund is about. Not a foreign key, on purpose.
  design_version_hash text check (design_version_hash is null or length(design_version_hash) between 1 and 200),
  -- For a refund, the spend it gives back. A spend can be given back once.
  refund_of uuid references public.credit_ledger (id),
  -- Makes a retry safe: the same key in the same brand is one line.
  idempotency_key text not null check (length(idempotency_key) between 1 and 300),
  note text not null default '' check (length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  -- The usage_events row of the paid call this spend paid for, when there was one (decision 0012).
  usage_event_id uuid,
  created_at timestamptz not null default now(),
  unique (brand_id, idempotency_key),
  unique (refund_of),
  check ((kind in ('grant', 'refund') and amount > 0) or (kind in ('spend', 'expire') and amount < 0)),
  check ((kind in ('spend', 'refund')) = (output_kind is not null and design_version_hash is not null)),
  check ((kind = 'refund') = (refund_of is not null))
);

comment on table public.credit_ledger is
  'A brand''s credits, one line per change. Append-only; the balance is the sum of amount. Written by the server only.';

create index credit_ledger_history_idx on public.credit_ledger (brand_id, seq desc);
create index credit_ledger_version_idx on public.credit_ledger (brand_id, design_version_hash)
  where design_version_hash is not null;

create function private.refuse_credit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.brands b where b.id = old.brand_id) then
    return old;
  end if;
  raise exception 'A credit ledger line can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_credit_change() from public, anon, authenticated;

create trigger credit_ledger_is_append_only
  before update or delete on public.credit_ledger
  for each row execute function private.refuse_credit_change();

create trigger credit_ledger_is_not_truncated
  before truncate on public.credit_ledger
  for each statement execute function private.refuse_credit_change();

revoke all on public.credit_prices, public.credit_ledger
  from public, anon, authenticated, service_role;
grant select on public.credit_prices, public.credit_ledger to authenticated, service_role;

alter table public.credit_prices enable row level security;
alter table public.credit_ledger enable row level security;

create policy "signed-in users read the credit prices"
  on public.credit_prices for select to authenticated
  using (true);

create policy "members read their brand's credit ledger"
  on public.credit_ledger for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on either table, on purpose.

-- Takes the brand's lock for the rest of the transaction, so two spends cannot both see the same
-- balance.
create function private.credit_lock(p_brand_id uuid)
returns void
language sql
set search_path = ''
as $$ select pg_advisory_xact_lock(hashtextextended('credits:' || p_brand_id::text, 0)); $$;

create function private.credit_balance(p_brand_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$ select coalesce(sum(amount), 0)::bigint from public.credit_ledger where brand_id = p_brand_id; $$;

revoke all on function private.credit_lock(uuid) from public, anon, authenticated;
revoke all on function private.credit_balance(uuid) from public, anon, authenticated;

create function public.credit_balance(p_brand_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$ select private.credit_balance(p_brand_id); $$;

-- Adds credits once per key. Returns { applied, balance }.
create function public.credit_grant(
  p_brand_id uuid,
  p_amount integer,
  p_key text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then
    raise exception 'A grant is 1 to 1,000,000 credits.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.brands b where b.id = p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  perform private.credit_lock(p_brand_id);
  insert into public.credit_ledger (brand_id, kind, amount, idempotency_key, note)
  values (p_brand_id, 'grant', p_amount, p_key, coalesce(p_note, ''))
  on conflict (brand_id, idempotency_key) do nothing;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('applied', v_rows = 1, 'balance', private.credit_balance(p_brand_id));
end;
$$;

-- The brand's free credits for a month, given once. p_month is the first day of a UTC month
-- (lib/usage/period.ts allowanceMonth). Returns { applied, balance }.
create function public.credit_ensure_allowance(
  p_brand_id uuid,
  p_month date,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    raise exception 'An allowance month starts on the first day of a month.' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 1000000 then
    raise exception 'A monthly allowance is 0 to 1,000,000 credits.' using errcode = '22023';
  end if;
  if p_amount = 0 then
    return jsonb_build_object('applied', false, 'balance', private.credit_balance(p_brand_id));
  end if;
  return public.credit_grant(p_brand_id, p_amount, 'allowance:' || to_char(p_month, 'YYYY-MM'), 'Monthly free credits');
end;
$$;

-- Takes the price of an output from credit_prices. Charging the same output of the same saved
-- version again costs nothing. Returns
--   { ok: true, charged, price, balance, entry_id } or
--   { ok: false, reason: 'insufficient', price, balance }.
create function public.credit_spend(
  p_brand_id uuid,
  p_user_id uuid,
  p_kind text,
  p_version_hash text,
  p_usage_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price integer;
  v_key text := 'spend:' || p_kind || ':' || p_version_hash;
  v_existing uuid;
  v_balance bigint;
  v_id uuid;
begin
  if p_version_hash is null or length(p_version_hash) not between 1 and 200 then
    raise exception 'A design version is named by a hash of 1 to 200 characters.' using errcode = '22023';
  end if;
  select cp.credits into v_price from public.credit_prices cp where cp.output_kind = p_kind;
  if not found then
    raise exception 'No credit price is set for that output.' using errcode = '22023';
  end if;
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;

  perform private.credit_lock(p_brand_id);
  v_balance := private.credit_balance(p_brand_id);

  select l.id into v_existing from public.credit_ledger l
  where l.brand_id = p_brand_id and l.idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'charged', false, 'price', v_price, 'balance', v_balance, 'entry_id', v_existing);
  end if;
  if v_price = 0 then
    return jsonb_build_object('ok', true, 'charged', false, 'price', 0, 'balance', v_balance, 'entry_id', null);
  end if;
  if v_balance < v_price then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'price', v_price, 'balance', v_balance);
  end if;

  insert into public.credit_ledger
    (brand_id, kind, amount, output_kind, design_version_hash, idempotency_key, created_by, usage_event_id)
  values
    (p_brand_id, 'spend', -v_price, p_kind, p_version_hash, v_key, p_user_id, p_usage_event_id)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'charged', true, 'price', v_price, 'balance', v_balance - v_price, 'entry_id', v_id);
end;
$$;

-- Gives back every spend on a saved version that has not been given back. Called when the design
-- is ordered (V1 owns the status, V5 the order). Returns { refunded, balance }; { refunded: 0 }
-- when there was nothing to give back, so a second call is harmless.
create function public.credit_refund_for_order(p_brand_id uuid, p_version_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refunded bigint;
begin
  if p_version_hash is null or length(p_version_hash) not between 1 and 200 then
    raise exception 'A design version is named by a hash of 1 to 200 characters.' using errcode = '22023';
  end if;
  perform private.credit_lock(p_brand_id);
  with given as (
    insert into public.credit_ledger
      (brand_id, kind, amount, output_kind, design_version_hash, refund_of, idempotency_key, note)
    select s.brand_id, 'refund', -s.amount, s.output_kind, s.design_version_hash, s.id, 'refund:' || s.id, 'Design ordered'
    from public.credit_ledger s
    where s.brand_id = p_brand_id and s.kind = 'spend' and s.design_version_hash = p_version_hash
      and not exists (select 1 from public.credit_ledger r where r.refund_of = s.id)
    returning amount
  )
  select coalesce(sum(amount), 0) into v_refunded from given;
  return jsonb_build_object('refunded', v_refunded, 'balance', private.credit_balance(p_brand_id));
end;
$$;

-- Takes away credits that have run out, once per key, never more than the balance.
-- Returns { applied, balance }. Nothing calls it yet: when credits expire is an owner decision.
create function public.credit_expire(
  p_brand_id uuid,
  p_amount integer,
  p_key text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then
    raise exception 'An expiry is 1 to 1,000,000 credits.' using errcode = '22023';
  end if;
  perform private.credit_lock(p_brand_id);
  if p_amount > private.credit_balance(p_brand_id) then
    return jsonb_build_object('applied', false, 'balance', private.credit_balance(p_brand_id));
  end if;
  insert into public.credit_ledger (brand_id, kind, amount, idempotency_key, note)
  values (p_brand_id, 'expire', -p_amount, p_key, coalesce(p_note, ''))
  on conflict (brand_id, idempotency_key) do nothing;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('applied', v_rows = 1, 'balance', private.credit_balance(p_brand_id));
end;
$$;

-- Sets prices from lib/credits/settings.ts: { "techpack_pdf": 3, ... }. p_placeholder says whether
-- they are still placeholders. A kind not named is left as it is.
create function public.credit_set_prices(p_prices jsonb, p_placeholder boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_value jsonb;
begin
  if p_prices is null or jsonb_typeof(p_prices) <> 'object' then
    raise exception 'Prices are an object of output kind to credits.' using errcode = '22023';
  end if;
  for v_kind, v_value in select * from jsonb_each(p_prices) loop
    if jsonb_typeof(v_value) <> 'number' or (v_value #>> '{}') !~ '^[0-9]{1,6}$' then
      raise exception 'A price is a whole number of credits.' using errcode = '22023';
    end if;
    update public.credit_prices
    set credits = (v_value #>> '{}')::integer, is_placeholder = coalesce(p_placeholder, true), updated_at = now()
    where output_kind = v_kind;
    if not found then
      raise exception 'Unknown output kind.' using errcode = '22023';
    end if;
  end loop;
end;
$$;

revoke all on function public.credit_balance(uuid) from public, anon, authenticated;
revoke all on function public.credit_grant(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.credit_ensure_allowance(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.credit_spend(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.credit_refund_for_order(uuid, text) from public, anon, authenticated;
revoke all on function public.credit_expire(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.credit_set_prices(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.credit_balance(uuid) to service_role;
grant execute on function public.credit_grant(uuid, integer, text, text) to service_role;
grant execute on function public.credit_ensure_allowance(uuid, date, integer) to service_role;
grant execute on function public.credit_spend(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.credit_refund_for_order(uuid, text) to service_role;
grant execute on function public.credit_expire(uuid, integer, text, text) to service_role;
grant execute on function public.credit_set_prices(jsonb, boolean) to service_role;
