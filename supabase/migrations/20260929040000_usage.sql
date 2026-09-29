-- Usage metering and caps. Plan step 10, tasks 1 to 4. Decision record 0012.
--
-- Every paid AI call reserves its estimated cost before it is made. The unit of account
-- is the microdollar: one millionth of a US dollar, kept as a whole number. A cheap text
-- call costs a fraction of a cent, so whole cents would round it away.
--
-- Three running totals are kept for each UTC day: the user's, the brand's (each for one
-- allowance: "ai" for text and image reading, "photoreal" for generated pictures), and
-- the total across everyone. A reservation succeeds only if all three stay within their
-- limits, and it is taken in one conditional update, so parallel requests cannot all
-- take the last place.
--
-- No browser writes to any of these tables. The server writes through the functions
-- below, which only the server's own key may run.

create table public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  feature text not null check (feature in ('ai', 'photoreal')),
  daily_allowance bigint not null check (daily_allowance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A limit is for one user or for one brand, never both.
  check (num_nonnulls(brand_id, user_id) = 1)
);

comment on table public.usage_limits is
  'An allowance set for one user or one brand, in microdollars a day. Replaces the configured default. Written by usage_set_limit only.';

create unique index usage_limits_brand_idx on public.usage_limits (brand_id, feature)
  where brand_id is not null;
create unique index usage_limits_user_idx on public.usage_limits (user_id, feature)
  where user_id is not null;

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('ai', 'photoreal')),
  -- Estimated cost in microdollars.
  cost bigint not null check (cost > 0),
  -- The UTC day whose totals the cost was counted in.
  day date not null,
  route text not null check (length(route) between 1 and 200),
  created_at timestamptz not null default now(),
  -- Set when the call failed and the cost was given back.
  refunded_at timestamptz
);

comment on table public.usage_events is
  'One row per reserved AI call. Written by usage_reserve and usage_refund only.';

create index usage_events_brand_idx on public.usage_events (brand_id, created_at desc);
create index usage_events_user_idx on public.usage_events (user_id, created_at desc);

-- Running totals. Out of reach of the API: they live in the private schema.
create table private.usage_counters (
  -- "global", "user:<id>:<feature>" or "brand:<id>:<feature>".
  scope text not null check (length(scope) between 1 and 100),
  day date not null,
  spent bigint not null default 0 check (spent >= 0),
  primary key (scope, day)
);

-- Which alerts about the safety ceiling have been raised. One of each level a day for
-- each ceiling, so an alert is raised once, and again if the owner changes the ceiling.
create table private.usage_alerts (
  day date not null,
  ceiling bigint not null,
  level text not null check (level in ('half', 'full')),
  raised_at timestamptz not null default now(),
  primary key (day, ceiling, level)
);

-- Browsers may read and nothing else. The server's key may read too; it writes through
-- the functions below.
revoke all on public.usage_limits, public.usage_events
  from public, anon, authenticated, service_role;
grant select on public.usage_limits, public.usage_events to authenticated, service_role;
revoke all on private.usage_counters, private.usage_alerts
  from public, anon, authenticated, service_role;

alter table public.usage_limits enable row level security;
alter table public.usage_events enable row level security;
alter table private.usage_counters enable row level security;
alter table private.usage_alerts enable row level security;

create policy "members read their brand's usage"
  on public.usage_events for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's limits and their own"
  on public.usage_limits for select to authenticated
  using (
    (brand_id is not null and private.is_member(brand_id))
    or user_id = (select auth.uid())
  );

-- There are no insert, update or delete policies, on purpose.

create function private.usage_feature(p_feature text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_feature is null or p_feature not in ('ai', 'photoreal') then
    raise exception 'Unknown usage feature.' using errcode = '22023';
  end if;
  return p_feature;
end;
$$;

create function private.usage_today()
returns date
language sql
volatile
set search_path = ''
as $$ select (clock_timestamp() at time zone 'utc')::date; $$;

-- Records an alert level for the day and ceiling. True only the first time.
create function private.usage_raise(p_day date, p_ceiling bigint, p_level text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into private.usage_alerts (day, ceiling, level)
  values (p_day, p_ceiling, p_level)
  on conflict do nothing;
  return found;
end;
$$;

-- Reserves the estimated cost of one call.
--
-- p_user_allowance and p_brand_allowance are the configured defaults for the feature; a
-- row in usage_limits replaces them. p_global_ceiling is the safety ceiling for the day
-- across all users and both features. All are in microdollars.
--
-- Returns {ok, event_id?, refused?, global_spent, global_ceiling, alerts}. "refused" is
-- "user", "brand" or "global", the first limit that would be passed. "alerts" lists the
-- ceiling alerts ("half", "full") raised by this call for the first time today.
create function public.usage_reserve(
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
    (select l.daily_allowance from public.usage_limits l
     where l.user_id = p_user_id and l.feature = v_feature),
    p_user_allowance) into v_user_allowance;
  select coalesce(
    (select l.daily_allowance from public.usage_limits l
     where l.brand_id = p_brand_id and l.feature = v_feature),
    p_brand_allowance) into v_brand_allowance;

  insert into private.usage_counters (scope, day)
  values (v_user_scope, v_day), (v_brand_scope, v_day), ('global', v_day)
  on conflict do nothing;

  -- The three rows are locked in one fixed order, so two calls never wait on each other
  -- in a circle. The update below then reads their latest values.
  perform 1 from private.usage_counters c
  where c.day = v_day and c.scope in (v_user_scope, v_brand_scope, 'global')
  order by c.scope
  for update;

  -- The one conditional update: all three totals move together, or none does.
  with limits (scope, allowance) as (
    values (v_user_scope, v_user_allowance),
           (v_brand_scope, v_brand_allowance),
           ('global', p_global_ceiling)
  )
  update private.usage_counters c
  set spent = c.spent + p_cost
  from limits l
  where c.day = v_day
    and c.scope = l.scope
    and not exists (
      select 1 from private.usage_counters o join limits ol on ol.scope = o.scope
      where o.day = v_day and o.spent + p_cost > ol.allowance
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
    where u.scope = v_user_scope and u.day = v_day
      and b.scope = v_brand_scope and b.day = v_day;

    if v_refused = 'global' and private.usage_raise(v_day, p_global_ceiling, 'full') then
      v_alerts := array_append(v_alerts, 'full');
    end if;

    return jsonb_build_object(
      'ok', false, 'refused', v_refused, 'global_spent', v_global,
      'global_ceiling', p_global_ceiling, 'alerts', to_jsonb(v_alerts));
  end if;

  insert into public.usage_events (brand_id, user_id, feature, cost, day, route)
  values (p_brand_id, p_user_id, v_feature, p_cost, v_day, p_route)
  returning id into v_event;

  if v_global * 2 >= p_global_ceiling and private.usage_raise(v_day, p_global_ceiling, 'half') then
    v_alerts := array_append(v_alerts, 'half');
  end if;
  if v_global >= p_global_ceiling and private.usage_raise(v_day, p_global_ceiling, 'full') then
    v_alerts := array_append(v_alerts, 'full');
  end if;

  -- Old totals are removed now and then, so the table stays small without a scheduler.
  if random() < 0.01 then
    delete from private.usage_counters where day < v_day - 40;
    delete from private.usage_alerts where day < v_day - 40;
  end if;

  return jsonb_build_object(
    'ok', true, 'event_id', v_event, 'global_spent', v_global,
    'global_ceiling', p_global_ceiling, 'alerts', to_jsonb(v_alerts));
end;
$$;

-- Gives back the cost of a call that failed. Only once: true the first time, false after
-- that or for an event that does not exist. The cost leaves the totals of the day it was
-- counted in.
create function public.usage_refund(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.usage_events;
begin
  update public.usage_events e
  set refunded_at = clock_timestamp()
  where e.id = p_event_id and e.refunded_at is null
  returning e.* into v_event;
  if v_event.id is null then
    return false;
  end if;

  perform 1 from private.usage_counters c
  where c.day = v_event.day
    and c.scope in (
      'user:' || v_event.user_id || ':' || v_event.feature,
      'brand:' || v_event.brand_id || ':' || v_event.feature,
      'global')
  order by c.scope
  for update;

  update private.usage_counters c
  set spent = greatest(c.spent - v_event.cost, 0)
  where c.day = v_event.day
    and c.scope in (
      'user:' || v_event.user_id || ':' || v_event.feature,
      'brand:' || v_event.brand_id || ':' || v_event.feature,
      'global');

  return true;
end;
$$;

-- Sets the allowance of one user or one brand, replacing the configured default. A null
-- allowance removes the row, so the default applies again. Returns the row's id, or null
-- when a row was removed.
create function public.usage_set_limit(
  p_subject text,
  p_subject_id uuid,
  p_feature text,
  p_daily_allowance bigint
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
  if p_daily_allowance is not null and p_daily_allowance < 0 then
    raise exception 'An allowance is zero or more.' using errcode = '22023';
  end if;

  if p_daily_allowance is null then
    delete from public.usage_limits l
    where l.feature = v_feature
      and (case p_subject when 'user' then l.user_id else l.brand_id end) = p_subject_id;
    return null;
  end if;

  if p_subject = 'user' then
    insert into public.usage_limits (user_id, feature, daily_allowance)
    values (p_subject_id, v_feature, p_daily_allowance)
    on conflict (user_id, feature) where user_id is not null
    do update set daily_allowance = excluded.daily_allowance, updated_at = now()
    returning id into v_id;
  else
    insert into public.usage_limits (brand_id, feature, daily_allowance)
    values (p_subject_id, v_feature, p_daily_allowance)
    on conflict (brand_id, feature) where brand_id is not null
    do update set daily_allowance = excluded.daily_allowance, updated_at = now()
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

comment on function public.usage_reserve(uuid, uuid, text, bigint, text, bigint, bigint, bigint) is
  'Reserves the estimated cost of one AI call against the user, the brand and the day total. Server only.';
comment on function public.usage_refund(uuid) is
  'Gives back the cost of a failed call, once. Server only.';
comment on function public.usage_set_limit(text, uuid, text, bigint) is
  'Sets or removes the allowance of one user or brand. Server and owner only.';

revoke all on function public.usage_reserve(uuid, uuid, text, bigint, text, bigint, bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.usage_refund(uuid) from public, anon, authenticated;
revoke all on function public.usage_set_limit(text, uuid, text, bigint)
  from public, anon, authenticated;
revoke all on function private.usage_feature(text) from public, anon, authenticated;
revoke all on function private.usage_today() from public, anon, authenticated;
revoke all on function private.usage_raise(date, bigint, text) from public, anon, authenticated;

grant execute on function public.usage_reserve(uuid, uuid, text, bigint, text, bigint, bigint, bigint)
  to service_role;
grant execute on function public.usage_refund(uuid) to service_role;
grant execute on function public.usage_set_limit(text, uuid, text, bigint) to service_role;
