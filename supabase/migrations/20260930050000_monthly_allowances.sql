-- AI allowances reset every calendar month (UTC) instead of every day. Owner decision
-- 2026-09-30. Decision record 0012, amended.
--
-- The user's and the brand's totals for each allowance are now kept per month: their row in
-- private.usage_counters has the first day of the UTC month in "day". The safety ceiling
-- across everyone stays per UTC day: it is a guard against a runaway spend, not an allowance,
-- and a day limits the damage faster. The cost of one call is still at most 1,000,000,000
-- microdollars, as before.
--
-- Each event records the month it was counted in ("period"), so a refund leaves the right
-- totals. Events written before this migration have no period: they were counted per day,
-- and their refund uses their day, as before.

alter table public.usage_limits rename column daily_allowance to monthly_allowance;

comment on table public.usage_limits is
  'An allowance set for one user or one brand, in microdollars a calendar month (UTC). Replaces the configured default. Written by usage_set_limit only.';

alter table public.usage_events add column period date;

alter table public.usage_events
  add constraint usage_events_period_is_month_start
  check (period is null or period = date_trunc('month', period)::date);

comment on column public.usage_events.period is
  'The first day of the UTC month whose user and brand totals the cost was counted in. Null for events counted per day, before 2026-09-30.';
comment on column public.usage_events.day is
  'The UTC day whose safety-ceiling total the cost was counted in.';

create function private.usage_month()
returns date
language sql
volatile
set search_path = ''
as $$ select date_trunc('month', clock_timestamp() at time zone 'utc')::date; $$;

revoke all on function private.usage_month() from public, anon, authenticated;

-- Reserves the estimated cost of one call. The arguments and answer are as before, except
-- that p_user_allowance and p_brand_allowance are now amounts a month.
create or replace function public.usage_reserve(
  p_user_id uuid,
  p_brand_id uuid,
  p_feature text,
  p_cost bigint,
  p_route text,
  p_user_allowance bigint,
  p_brand_allowance bigint,
  p_global_ceiling bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feature text := private.usage_feature(p_feature);
  v_day date := private.usage_today();
  v_period date := private.usage_month();
  v_user_scope text := 'user:' || p_user_id || ':' || v_feature;
  v_brand_scope text := 'brand:' || p_brand_id || ':' || v_feature;
  v_user_allowance bigint;
  v_brand_allowance bigint;
  v_updated integer;
  v_refused text;
  v_global bigint;
  v_event uuid;
  v_alerts text[] := '{}';
begin
  if p_cost is null or p_cost < 1 or p_cost > 1000000000 then
    raise exception 'A cost is 1 to 1,000,000,000 microdollars.' using errcode = '22023';
  end if;
  if p_user_allowance is null or p_user_allowance < 0
     or p_brand_allowance is null or p_brand_allowance < 0
     or p_global_ceiling is null or p_global_ceiling < 0 then
    raise exception 'Allowances and the ceiling are zero or more.' using errcode = '22023';
  end if;
  if p_route is null or length(p_route) not between 1 and 200 then
    raise exception 'A route is named in 1 to 200 characters.' using errcode = '22023';
  end if;
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;

  select coalesce(
    (select l.monthly_allowance from public.usage_limits l
     where l.user_id = p_user_id and l.feature = v_feature),
    p_user_allowance) into v_user_allowance;
  select coalesce(
    (select l.monthly_allowance from public.usage_limits l
     where l.brand_id = p_brand_id and l.feature = v_feature),
    p_brand_allowance) into v_brand_allowance;

  insert into private.usage_counters (scope, day)
  values (v_user_scope, v_period), (v_brand_scope, v_period), ('global', v_day)
  on conflict do nothing;

  -- The three rows are locked in one fixed order, so two calls never wait on each other
  -- in a circle. The update below then reads their latest values.
  perform 1 from private.usage_counters c
  where (c.scope, c.day) in ((v_user_scope, v_period), (v_brand_scope, v_period), ('global', v_day))
  order by c.scope
  for update;

  -- The one conditional update: all three totals move together, or none does.
  with limits (scope, day, allowance) as (
    values (v_user_scope, v_period, v_user_allowance),
           (v_brand_scope, v_period, v_brand_allowance),
           ('global', v_day, p_global_ceiling)
  )
  update private.usage_counters c
  set spent = c.spent + p_cost
  from limits l
  where c.scope = l.scope
    and c.day = l.day
    and not exists (
      select 1 from private.usage_counters o
      join limits ol on ol.scope = o.scope and ol.day = o.day
      where o.spent + p_cost > ol.allowance
    );
  get diagnostics v_updated = row_count;

  select c.spent into v_global from private.usage_counters c
  where c.scope = 'global' and c.day = v_day;

  if v_updated = 0 then
    select case
      when u.spent + p_cost > v_user_allowance then 'user'
      when b.spent + p_cost > v_brand_allowance then 'brand'
      else 'global'
    end into v_refused
    from private.usage_counters u, private.usage_counters b
    where u.scope = v_user_scope and u.day = v_period
      and b.scope = v_brand_scope and b.day = v_period;

    if v_refused = 'global' and private.usage_raise(v_day, p_global_ceiling, 'full') then
      v_alerts := array_append(v_alerts, 'full');
    end if;

    return jsonb_build_object(
      'ok', false, 'refused', v_refused, 'global_spent', v_global,
      'global_ceiling', p_global_ceiling, 'alerts', to_jsonb(v_alerts));
  end if;

  insert into public.usage_events (brand_id, user_id, feature, cost, day, period, route)
  values (p_brand_id, p_user_id, v_feature, p_cost, v_day, v_period, p_route)
  returning id into v_event;

  if v_global * 2 >= p_global_ceiling and private.usage_raise(v_day, p_global_ceiling, 'half') then
    v_alerts := array_append(v_alerts, 'half');
  end if;
  if v_global >= p_global_ceiling and private.usage_raise(v_day, p_global_ceiling, 'full') then
    v_alerts := array_append(v_alerts, 'full');
  end if;

  -- Old totals are removed now and then, so the table stays small without a scheduler. A
  -- month's row is dated its first day, at most 30 days back, so it is never removed early.
  if random() < 0.01 then
    delete from private.usage_counters where day < v_day - 40;
    delete from private.usage_alerts where day < v_day - 40;
  end if;

  return jsonb_build_object(
    'ok', true, 'event_id', v_event, 'global_spent', v_global,
    'global_ceiling', p_global_ceiling, 'alerts', to_jsonb(v_alerts));
end;
$$;

-- Gives back the cost of a call that failed. Only once. The cost leaves the user's and the
-- brand's totals of the month it was counted in (or of its day, for an event from before
-- monthly allowances), and the ceiling total of its day.
create or replace function public.usage_refund(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.usage_events;
  v_period date;
begin
  update public.usage_events e
  set refunded_at = clock_timestamp()
  where e.id = p_event_id and e.refunded_at is null
  returning e.* into v_event;
  if v_event.id is null then
    return false;
  end if;
  v_period := coalesce(v_event.period, v_event.day);

  perform 1 from private.usage_counters c
  where (c.scope, c.day) in (
      ('user:' || v_event.user_id || ':' || v_event.feature, v_period),
      ('brand:' || v_event.brand_id || ':' || v_event.feature, v_period),
      ('global', v_event.day))
  order by c.scope
  for update;

  update private.usage_counters c
  set spent = greatest(c.spent - v_event.cost, 0)
  where (c.scope, c.day) in (
      ('user:' || v_event.user_id || ':' || v_event.feature, v_period),
      ('brand:' || v_event.brand_id || ':' || v_event.feature, v_period),
      ('global', v_event.day));

  return true;
end;
$$;

-- Sets the monthly allowance of one user or one brand, replacing the configured default. A
-- null allowance removes the row, so the default applies again. The argument is renamed, so
-- the function is made anew.
drop function public.usage_set_limit(text, uuid, text, bigint);

create function public.usage_set_limit(
  p_subject text,
  p_subject_id uuid,
  p_feature text,
  p_monthly_allowance bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feature text := private.usage_feature(p_feature);
  v_id uuid;
begin
  if p_subject is null or p_subject not in ('user', 'brand') or p_subject_id is null then
    raise exception 'A limit is for one user or one brand.' using errcode = '22023';
  end if;
  if p_monthly_allowance is not null and p_monthly_allowance < 0 then
    raise exception 'An allowance is zero or more.' using errcode = '22023';
  end if;

  if p_monthly_allowance is null then
    delete from public.usage_limits l
    where l.feature = v_feature
      and (case p_subject when 'user' then l.user_id else l.brand_id end) = p_subject_id;
    return null;
  end if;

  if p_subject = 'user' then
    insert into public.usage_limits (user_id, feature, monthly_allowance)
    values (p_subject_id, v_feature, p_monthly_allowance)
    on conflict (user_id, feature) where user_id is not null
    do update set monthly_allowance = excluded.monthly_allowance, updated_at = now()
    returning id into v_id;
  else
    insert into public.usage_limits (brand_id, feature, monthly_allowance)
    values (p_subject_id, v_feature, p_monthly_allowance)
    on conflict (brand_id, feature) where brand_id is not null
    do update set monthly_allowance = excluded.monthly_allowance, updated_at = now()
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

comment on function public.usage_reserve(uuid, uuid, text, bigint, text, bigint, bigint, bigint) is
  'Reserves the estimated cost of one AI call against the user''s and brand''s monthly allowances and the day''s ceiling. Server only.';
comment on function public.usage_set_limit(text, uuid, text, bigint) is
  'Sets or removes the monthly allowance of one user or brand. Server and owner only.';

revoke all on function public.usage_set_limit(text, uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.usage_set_limit(text, uuid, text, bigint) to service_role;
