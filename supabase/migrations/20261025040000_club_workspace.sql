-- Club workspace (plans/platform-v4.md, workstream V4; decision 0042).
--
-- A club is a brand: this migration adds no parallel account. It extends what a brand holds:
--   * roles on memberships: owner (as today), admin, kit_manager, viewer;
--   * one club kit per brand (colours, crest, up to three sponsors, fonts for names and numbers);
--   * seasons, and a roster of players for each season;
--   * invitations, so a second person can join a brand.
--
-- Player names are personal data. They live only in roster_players (and in the team lists of
-- team_orders, which are separate). Every new table is brand-scoped with row level security on,
-- readable by members, written by nobody directly: each write is a function only the server's own
-- key may run, and each function checks the caller's role itself. Rows go with the brand through
-- `on delete cascade`, and a season's roster goes when the season goes. Nothing here refers to
-- another workstream's tables; the crest and sponsor logos are file ids, not keys.

-- ---------------------------------------------------------------------------------------------
-- Roles. The old check allowed only 'owner'. This widens it and never rewrites a row.

alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships add constraint memberships_role_check
  check (role in ('owner', 'admin', 'kit_manager', 'viewer'));

-- The caller's role in a brand, or null for a stranger.
create function private.club_role(p_user_id uuid, p_brand_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m
  where m.brand_id = p_brand_id and m.user_id = p_user_id;
$$;

-- Who may change the kit, seasons and rosters: owners, admins and kit managers.
create function private.can_manage_kit(p_user_id uuid, p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.club_role(p_user_id, p_brand_id) in ('owner', 'admin', 'kit_manager'), false);
$$;

-- Who may change members and their roles: owners and admins. Not kit managers, not viewers.
create function private.can_manage_members(p_user_id uuid, p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.club_role(p_user_id, p_brand_id) in ('owner', 'admin'), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- The kit: one row per brand.

create table public.club_kits (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  -- '#rrggbb' or null when not chosen. Never guessed.
  primary_colour text check (primary_colour ~ '^#[0-9a-f]{6}$'),
  secondary_colour text check (secondary_colour ~ '^#[0-9a-f]{6}$'),
  accent_colour text check (accent_colour ~ '^#[0-9a-f]{6}$'),
  -- A file id in public.files. Not a key: the file may be removed, and the kit then has no crest.
  crest_file_id uuid,
  -- Up to three: [{ "name": text, "logoFileId": uuid | null }].
  sponsors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sponsors) = 'array' and jsonb_array_length(sponsors) <= 3),
  -- Only the bundled font exists for now (Geist). The list widens when more fonts are bundled.
  name_font text not null default 'geist' check (name_font in ('geist')),
  number_font text not null default 'geist' check (number_font in ('geist')),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.club_kits is
  'The club kit of a brand: colours, crest, sponsors, fonts. Written by the server only.';

create table public.club_seasons (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80 and name = btrim(name)),
  starts_on date,
  ends_on date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (brand_id, name),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

comment on table public.club_seasons is
  'A season of a club. Its roster goes with it. Written by the server only.';

create index club_seasons_brand_idx on public.club_seasons (brand_id, created_at desc);

create table public.roster_players (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  brand_id uuid not null,
  position integer not null check (position >= 1),
  -- Empty when the player has no printed name. Personal data.
  name text not null check (length(name) <= 40 and name !~ '[[:cntrl:]]'),
  -- Digits as printed, so "07" and "7" stay different. Empty when not yet given.
  number text not null check (number = '' or number ~ '^[0-9]{1,3}$'),
  size_label text not null check (length(size_label) between 1 and 16),
  wearer_group text not null check (wearer_group in ('mens', 'womens', 'junior', 'unisex')),
  unique (season_id, position),
  foreign key (season_id, brand_id) references public.club_seasons (id, brand_id) on delete cascade
);

comment on table public.roster_players is
  'One player of a season roster. The name is personal data and goes with its season or brand. Written by the server only.';

create index roster_players_brand_idx on public.roster_players (brand_id);

create table public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- Lower case. Personal data. Matched against the signed-in person's confirmed address.
  email text not null check (email = lower(email) and length(email) between 3 and 254 and email !~ '[[:space:]]'),
  role text not null check (role in ('admin', 'kit_manager', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (brand_id, email)
);

comment on table public.club_invitations is
  'A person invited to join a brand. Accepted by that person when signed in with the same address.';

revoke all on public.club_kits, public.club_seasons, public.roster_players, public.club_invitations
  from public, anon, authenticated, service_role;
grant select on public.club_kits, public.club_seasons, public.roster_players to authenticated, service_role;
grant select on public.club_invitations to authenticated, service_role;

alter table public.club_kits enable row level security;
alter table public.club_seasons enable row level security;
alter table public.roster_players enable row level security;
alter table public.club_invitations enable row level security;

create policy "members read their brand's kit"
  on public.club_kits for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's seasons"
  on public.club_seasons for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's roster"
  on public.roster_players for select to authenticated
  using (private.is_member(brand_id));
-- Invitations hold addresses, so only the people who manage members see them.
create policy "member managers read their brand's invitations"
  on public.club_invitations for select to authenticated
  using (private.is_member(brand_id) and private.can_manage_members((select auth.uid()), brand_id));

-- There are no insert, update or delete policies on any of these, on purpose.

-- ---------------------------------------------------------------------------------------------
-- Limits.

create function private.club_seasons_limit()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;
create function private.roster_players_limit()
returns integer language sql immutable set search_path = '' as $$ select 1000 $$;
create function private.club_members_limit()
returns integer language sql immutable set search_path = '' as $$ select 50 $$;

-- ---------------------------------------------------------------------------------------------
-- Kit.

create function public.save_club_kit(p_brand_id uuid, p_user_id uuid, p_kit jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this kit.' using errcode = '42501';
  end if;
  if p_kit is null or jsonb_typeof(p_kit) <> 'object' then
    raise exception 'The kit is not understood.' using errcode = '22023';
  end if;

  insert into public.club_kits as k (
    brand_id, primary_colour, secondary_colour, accent_colour, crest_file_id,
    sponsors, name_font, number_font, updated_by, updated_at
  ) values (
    p_brand_id,
    p_kit ->> 'primaryColour',
    p_kit ->> 'secondaryColour',
    p_kit ->> 'accentColour',
    nullif(p_kit ->> 'crestFileId', '')::uuid,
    coalesce(p_kit -> 'sponsors', '[]'::jsonb),
    coalesce(p_kit ->> 'nameFont', 'geist'),
    coalesce(p_kit ->> 'numberFont', 'geist'),
    p_user_id,
    now()
  )
  on conflict (brand_id) do update set
    primary_colour = excluded.primary_colour,
    secondary_colour = excluded.secondary_colour,
    accent_colour = excluded.accent_colour,
    crest_file_id = excluded.crest_file_id,
    sponsors = excluded.sponsors,
    name_font = excluded.name_font,
    number_font = excluded.number_font,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Seasons and rosters.

create function public.create_club_season(
  p_brand_id uuid, p_user_id uuid, p_name text, p_starts_on date, p_ends_on date
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
    raise exception 'You may not change this club.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club_seasons:' || p_brand_id::text, 0));
  if (select count(*) from public.club_seasons s where s.brand_id = p_brand_id)
     >= private.club_seasons_limit() then
    raise exception 'A club may have 20 seasons.' using errcode = 'P0001', hint = 'too_many_seasons';
  end if;
  insert into public.club_seasons (brand_id, name, starts_on, ends_on, created_by)
  values (p_brand_id, btrim(p_name), p_starts_on, p_ends_on, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Replaces every player of a season in one step, so a roster is never half saved.
-- p_players is an array of { name, number, sizeLabel, wearerGroup }.
create function public.replace_season_roster(
  p_brand_id uuid, p_user_id uuid, p_season_id uuid, p_players jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this roster.' using errcode = '42501';
  end if;
  if p_players is null or jsonb_typeof(p_players) <> 'array'
     or jsonb_array_length(p_players) > private.roster_players_limit() then
    raise exception 'A roster holds up to 1000 players.' using errcode = '22023';
  end if;
  perform 1 from public.club_seasons s
  where s.id = p_season_id and s.brand_id = p_brand_id for update;
  if not found then
    raise exception 'That season does not exist.' using errcode = 'P0002';
  end if;

  delete from public.roster_players r where r.season_id = p_season_id;
  insert into public.roster_players (season_id, brand_id, position, name, number, size_label, wearer_group)
  select p_season_id, p_brand_id, e.ordinality, e.player ->> 'name', e.player ->> 'number',
         e.player ->> 'sizeLabel', e.player ->> 'wearerGroup'
  from jsonb_array_elements(p_players) with ordinality as e(player, ordinality);
  return jsonb_array_length(p_players);
end;
$$;

-- Starts the next season with the roster of an earlier one, sizes included. The copy is
-- independent: changing one season never changes the other.
create function public.start_next_season(
  p_brand_id uuid, p_user_id uuid, p_from_season_id uuid,
  p_name text, p_starts_on date, p_ends_on date
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
    raise exception 'You may not change this club.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club_seasons:' || p_brand_id::text, 0));
  if not exists (
    select 1 from public.club_seasons s where s.id = p_from_season_id and s.brand_id = p_brand_id
  ) then
    raise exception 'That season does not exist.' using errcode = 'P0002';
  end if;
  if (select count(*) from public.club_seasons s where s.brand_id = p_brand_id)
     >= private.club_seasons_limit() then
    raise exception 'A club may have 20 seasons.' using errcode = 'P0001', hint = 'too_many_seasons';
  end if;

  insert into public.club_seasons (brand_id, name, starts_on, ends_on, created_by)
  values (p_brand_id, btrim(p_name), p_starts_on, p_ends_on, p_user_id)
  returning id into v_id;

  insert into public.roster_players (season_id, brand_id, position, name, number, size_label, wearer_group)
  select v_id, p_brand_id, r.position, r.name, r.number, r.size_label, r.wearer_group
  from public.roster_players r
  where r.season_id = p_from_season_id and r.brand_id = p_brand_id;
  return v_id;
end;
$$;

-- Erases a season and every player in it.
create function public.delete_club_season(p_brand_id uuid, p_user_id uuid, p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this club.' using errcode = '42501';
  end if;
  delete from public.club_seasons s where s.id = p_season_id and s.brand_id = p_brand_id;
  if not found then
    raise exception 'That season does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- Erases one player, for a person who asks to be forgotten.
create function public.erase_roster_player(p_brand_id uuid, p_user_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this roster.' using errcode = '42501';
  end if;
  delete from public.roster_players r where r.id = p_player_id and r.brand_id = p_brand_id;
  if not found then
    raise exception 'That player does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Members and invitations.

-- The members of a brand the caller belongs to, with the name shown for each. Nothing for any
-- other brand.
create function public.club_members(p_brand_id uuid)
returns table (user_id uuid, role text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role,
         coalesce(
           private.shown_name(u.raw_user_meta_data ->> 'display_name'),
           private.shown_name(u.raw_user_meta_data ->> 'full_name'),
           u.email::text
         )
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.brand_id = p_brand_id
    and private.is_member(p_brand_id)
  order by m.created_at, m.user_id;
$$;

create function public.set_member_role(
  p_brand_id uuid, p_user_id uuid, p_target_id uuid, p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'You may not change members.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'kit_manager', 'viewer') then
    raise exception 'That role is not offered.' using errcode = '22023';
  end if;
  v_current := private.club_role(p_target_id, p_brand_id);
  if v_current is null then
    raise exception 'That member does not exist.' using errcode = 'P0002';
  end if;
  if v_current = 'owner' then
    raise exception 'The owner keeps the owner role.' using errcode = 'P0001', hint = 'owner_fixed';
  end if;
  update public.memberships m set role = p_role
  where m.brand_id = p_brand_id and m.user_id = p_target_id;
end;
$$;

create function public.remove_member(p_brand_id uuid, p_user_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  -- Anyone may leave. Removing someone else needs a member manager.
  if p_user_id <> p_target_id and not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'You may not change members.' using errcode = '42501';
  end if;
  v_current := private.club_role(p_target_id, p_brand_id);
  if v_current is null then
    raise exception 'That member does not exist.' using errcode = 'P0002';
  end if;
  if v_current = 'owner' then
    raise exception 'The owner cannot be removed.' using errcode = 'P0001', hint = 'owner_fixed';
  end if;
  delete from public.memberships m where m.brand_id = p_brand_id and m.user_id = p_target_id;
end;
$$;

create function public.invite_member(p_brand_id uuid, p_user_id uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'You may not change members.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'kit_manager', 'viewer') then
    raise exception 'That role is not offered.' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'Enter an email address.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club_invitations:' || p_brand_id::text, 0));
  if (select count(*) from public.memberships m where m.brand_id = p_brand_id)
     + (select count(*) from public.club_invitations i where i.brand_id = p_brand_id)
     >= private.club_members_limit() then
    raise exception 'A club may have 50 members and invitations.' using errcode = 'P0001', hint = 'too_many_members';
  end if;
  insert into public.club_invitations (brand_id, email, role, invited_by)
  values (p_brand_id, v_email, p_role, p_user_id)
  on conflict (brand_id, email) do update set role = excluded.role
  returning id into v_id;
  return v_id;
end;
$$;

create function public.cancel_invitation(p_brand_id uuid, p_user_id uuid, p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'You may not change members.' using errcode = '42501';
  end if;
  delete from public.club_invitations i where i.id = p_invitation_id and i.brand_id = p_brand_id;
  if not found then
    raise exception 'That invitation does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- The invitations that name the caller's own address, with the brand's name. Nothing else.
create function public.my_club_invitations()
returns table (id uuid, brand_id uuid, brand_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.brand_id, b.name, i.role
  from public.club_invitations i
  join public.brands b on b.id = i.brand_id
  join auth.users u on u.id = (select auth.uid())
  where u.email_confirmed_at is not null and lower(u.email::text) = i.email
  order by i.created_at, i.id;
$$;

-- Accepts an invitation as the person it names. Refused for any other person.
create function public.accept_invitation(p_user_id uuid, p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.club_invitations;
begin
  perform pg_advisory_xact_lock(hashtextextended('create_brand:' || p_user_id::text, 0));
  select i.* into v_invite
  from public.club_invitations i
  join auth.users u on u.id = p_user_id
  where i.id = p_invitation_id
    and u.email_confirmed_at is not null and lower(u.email::text) = i.email;
  if not found then
    raise exception 'That invitation does not exist.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.memberships m where m.brand_id = v_invite.brand_id and m.user_id = p_user_id) then
    delete from public.club_invitations i where i.id = v_invite.id;
    return v_invite.brand_id;
  end if;
  if (select count(*) from public.memberships m where m.user_id = p_user_id) >= private.max_brands_per_user() then
    raise exception 'You can belong to % brands at most.', private.max_brands_per_user()
      using errcode = 'P0001', hint = 'brand_limit';
  end if;
  insert into public.memberships (brand_id, user_id, role) values (v_invite.brand_id, p_user_id, v_invite.role);
  delete from public.club_invitations i where i.id = v_invite.id;
  return v_invite.brand_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Rights. Browsers may run only the two reads; the rest are for the server's own key.

revoke all on function private.club_role(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_kit(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_members(uuid, uuid) from public, anon, authenticated;
-- Only the invitations policy runs a role check as a browser; the rest are for the functions here.
grant execute on function private.club_role(uuid, uuid) to service_role;
grant execute on function private.can_manage_kit(uuid, uuid) to service_role;
grant execute on function private.can_manage_members(uuid, uuid) to authenticated, service_role;
revoke all on function private.club_seasons_limit() from public, anon, authenticated;
revoke all on function private.roster_players_limit() from public, anon, authenticated;
revoke all on function private.club_members_limit() from public, anon, authenticated;

revoke all on function public.save_club_kit(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.create_club_season(uuid, uuid, text, date, date) from public, anon, authenticated;
revoke all on function public.replace_season_roster(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.start_next_season(uuid, uuid, uuid, text, date, date) from public, anon, authenticated;
revoke all on function public.delete_club_season(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.erase_roster_player(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_member_role(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.remove_member(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.invite_member(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_invitation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.accept_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.club_members(uuid) from public, anon, authenticated;
revoke all on function public.my_club_invitations() from public, anon, authenticated;

grant execute on function public.save_club_kit(uuid, uuid, jsonb) to service_role;
grant execute on function public.create_club_season(uuid, uuid, text, date, date) to service_role;
grant execute on function public.replace_season_roster(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.start_next_season(uuid, uuid, uuid, text, date, date) to service_role;
grant execute on function public.delete_club_season(uuid, uuid, uuid) to service_role;
grant execute on function public.erase_roster_player(uuid, uuid, uuid) to service_role;
grant execute on function public.set_member_role(uuid, uuid, uuid, text) to service_role;
grant execute on function public.remove_member(uuid, uuid, uuid) to service_role;
grant execute on function public.invite_member(uuid, uuid, text, text) to service_role;
grant execute on function public.cancel_invitation(uuid, uuid, uuid) to service_role;
grant execute on function public.accept_invitation(uuid, uuid) to service_role;
grant execute on function public.club_members(uuid) to authenticated;
grant execute on function public.my_club_invitations() to authenticated;
