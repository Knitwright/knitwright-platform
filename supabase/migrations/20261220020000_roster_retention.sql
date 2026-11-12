-- Roster retention (plan v6 D5, decision 0136).
--
-- The spec (05 security, 03 data model): "roster data is purged after 2 seasons unless the club opts in". Until
-- now nothing purged anything: a player's name, number and size stayed for as long as the club did.
--
-- WHAT IS PURGED. A season's roster: its players (roster_players), the people the manager was waiting on
-- (roster_signup_requests), what players sent (roster_signup_entries) and the sign-up links that took them
-- (roster_signup_links, which hold no names but would take new ones). The season itself stays: its name and dates
-- name nobody, and orders and history may point at it. `roster_purged_at` says when its roster was removed, so a
-- screen can say so rather than show an empty roster as if nobody had been entered.
--
-- WHEN. A season's roster is past keeping when either
--   * the club has two newer seasons (it is the third newest or older), or
--   * it ended more than two years ago (its end date, else its start date, else the day it was made), which is
--     what stops a club that never makes another season from keeping its last roster for ever.
-- A season is newer when it starts later; one with no start date counts from the day it was made.
--
-- UNLESS THE CLUB OPTS IN. `club_roster_retention.keep_old_rosters` is the opt-in, set by the club's owner or an
-- admin through `set_roster_retention`, the people who manage members. No row means the club has not opted in.
--
-- WHO RUNS IT. `purge_old_rosters` is run by the server's own key only, from the cron route
-- `app/api/cron/roster-purge` behind the deploy's CRON_SECRET (the idiom of decision 0100). It is idempotent: a
-- second run finds nothing left to remove and says so. It may be scoped to one brand, which is how the database
-- test runs it without touching any other test's club in the shared database.

-- ---------------------------------------------------------------------------------------------
-- The opt-in.

create table public.club_roster_retention (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  keep_old_rosters boolean not null,
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now()
);

comment on table public.club_roster_retention is
  'Whether a club keeps rosters older than two seasons (it opted in). No row: it has not. Written by the server only.';

revoke all on public.club_roster_retention from public, anon, authenticated, service_role;
grant select on public.club_roster_retention to authenticated, service_role;

alter table public.club_roster_retention enable row level security;

create policy "members read their brand's roster retention"
  on public.club_roster_retention for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

alter table public.club_seasons
  add column roster_purged_at timestamptz;

comment on column public.club_seasons.roster_purged_at is
  'When this season''s roster was last removed because it was older than two seasons (decision 0136). Null: never.';

-- ---------------------------------------------------------------------------------------------
-- The two limits, in the idiom of private.club_seasons_limit().

create function private.roster_seasons_kept()
returns integer language sql immutable set search_path = '' as $$ select 2 $$;
create function private.roster_years_kept()
returns integer language sql immutable set search_path = '' as $$ select 2 $$;

revoke all on function private.roster_seasons_kept() from public, anon, authenticated;
revoke all on function private.roster_years_kept() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Setting the opt-in.

create function public.set_roster_retention(p_brand_id uuid, p_user_id uuid, p_keep boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'You may not change this club.' using errcode = '42501';
  end if;
  if p_keep is null then
    raise exception 'Say whether the club keeps its old rosters.' using errcode = '22023';
  end if;
  insert into public.club_roster_retention (brand_id, keep_old_rosters, set_by, set_at)
  values (p_brand_id, p_keep, p_user_id, now())
  on conflict (brand_id) do update
    set keep_old_rosters = excluded.keep_old_rosters, set_by = excluded.set_by, set_at = excluded.set_at;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The purge.

create function public.purge_old_rosters(p_now timestamptz default now(), p_brand_id uuid default null)
returns table (seasons_purged integer, players_removed integer, requests_removed integer, entries_removed integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff date := (p_now - make_interval(years => private.roster_years_kept()))::date;
  v_seasons uuid[];
  v_touched uuid[];
  v_ids uuid[];
  v_players integer;
  v_requests integer;
  v_entries integer;
begin
  select coalesce(array_agg(r.id), '{}') into v_seasons
  from (
    select s.id,
           row_number() over (
             partition by s.brand_id
             order by coalesce(s.starts_on, s.created_at::date) desc, s.created_at desc, s.id desc
           ) as newness,
           coalesce(s.ends_on, s.starts_on, s.created_at::date) as ended_on
    from public.club_seasons s
    where (p_brand_id is null or s.brand_id = p_brand_id)
      and not exists (
        select 1 from public.club_roster_retention k where k.brand_id = s.brand_id and k.keep_old_rosters
      )
  ) r
  where r.newness > private.roster_seasons_kept() or r.ended_on < v_cutoff;

  with gone as (delete from public.roster_players p where p.season_id = any (v_seasons) returning p.season_id)
  select count(*)::integer, coalesce(array_agg(distinct gone.season_id), '{}') into v_players, v_touched from gone;

  with gone as (delete from public.roster_signup_entries e where e.season_id = any (v_seasons) returning e.season_id)
  select count(*)::integer, coalesce(array_agg(distinct gone.season_id), '{}') into v_entries, v_ids from gone;
  v_touched := v_touched || v_ids;

  with gone as (delete from public.roster_signup_requests q where q.season_id = any (v_seasons) returning q.season_id)
  select count(*)::integer, coalesce(array_agg(distinct gone.season_id), '{}') into v_requests, v_ids from gone;
  v_touched := v_touched || v_ids;

  -- The links hold no names, but an open one would take new names for a season whose roster is gone.
  with gone as (delete from public.roster_signup_links l where l.season_id = any (v_seasons) returning l.season_id)
  select coalesce(array_agg(distinct gone.season_id), '{}') into v_ids from gone;
  v_touched := v_touched || v_ids;

  update public.club_seasons s set roster_purged_at = p_now where s.id = any (v_touched);

  return query
    select (select count(distinct t.id)::integer from unnest(v_touched) as t (id)), v_players, v_requests, v_entries;
end;
$$;

revoke all on function public.set_roster_retention(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.purge_old_rosters(timestamptz, uuid) from public, anon, authenticated;

grant execute on function public.set_roster_retention(uuid, uuid, boolean) to service_role;
grant execute on function public.purge_old_rosters(timestamptz, uuid) to service_role;
