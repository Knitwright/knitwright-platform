-- Rate limiting, stored in Postgres and enforced by one atomic function.
-- Plan step 2, task 4.

-- Tables that no browser may reach live here. The API exposes only "public".
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null check (count > 0),
  primary key (key, window_start)
);

comment on table private.rate_limits is
  'One row per key and time window. Written only by public.rate_limit_hit.';

create index rate_limits_window_start_idx on private.rate_limits (window_start);

-- Counts one request against a key. Returns false when the key has reached its limit
-- in the current window. The insert-or-update is a single statement, so two requests
-- arriving together cannot both take the last place.
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 300 then
    raise exception 'rate_limit_hit: key must be 1 to 300 characters'
      using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'rate_limit_hit: window must be at least 1 second'
      using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 then
    return false;
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into private.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
  do update set count = r.count + 1
  where r.count < p_limit
  returning r.count into v_count;

  -- Old windows are removed now and then, so the table stays small without a scheduler.
  if random() < 0.01 then
    delete from private.rate_limits
    where window_start < clock_timestamp() - interval '1 day';
  end if;

  return v_count is not null;
end;
$$;

comment on function public.rate_limit_hit(text, integer, integer) is
  'Counts one request against a key. False when the key is over its limit. Server only.';

revoke all on function public.rate_limit_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
