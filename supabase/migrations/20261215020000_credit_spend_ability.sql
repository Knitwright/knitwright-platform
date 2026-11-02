-- H4 of the v5 security review (docs/reviews/security-v5.md, decision 0116): a read-only member
-- could spend the brand's credits.
--
-- `public.credit_spend` asked `private.belongs_to`, which is true for every membership row,
-- including a viewer's. The v5 flows function states the intended policy verbatim and applies it
-- to the new path only (20261201030000_flow_runs.sql:692-695): "credit_spend asks only for
-- membership; a viewer should not be able to spend." Every credit-gated route is `auth: "member"`
-- with no ability check of its own, so a viewer -- described to people as someone who "cannot
-- change anything" -- could empty the balance through any pre-v5 paid path.
--
-- Charging a brand's credits is changing its kit, so this asks the same ability the rest of the
-- kit asks for, with the same errcode `credit_spend_output` raises. `private.can_manage_kit`
-- strictly implies `private.belongs_to` (it reads the same membership row and then the role), so
-- this can only narrow who may spend, never widen it.
--
-- The signature is unchanged, so `create or replace` keeps the grants of 20261025060000: revoked
-- from public, anon and authenticated, executable by the service role alone.

create or replace function public.credit_spend(
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
  -- A person who is in no brand of that id is told the brand does not exist, as before: naming the
  -- difference would say whether a brand exists to someone with no part in it.
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  -- A member who may not change the kit may not spend its credits either (security review v5 H4).
  -- This is the same question and the same errcode as public.credit_spend_output.
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not spend this brand''s credits.' using errcode = '42501';
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

comment on function public.credit_spend(uuid, uuid, text, text, uuid) is
  'Takes the price of an output from credit_prices, once per saved version. Asks private.can_manage_kit: a viewer may not spend a brand''s credits (security review v5 H4, decision 0116).';
