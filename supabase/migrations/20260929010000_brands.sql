-- Brands and memberships. Plan step 3, tasks 1 to 3.
--
-- A user may belong to several brands. Every design, file and image belongs to one
-- brand, and only its members may read it. Nothing here can be written by a browser
-- directly: changes go through the functions below, which check who is calling.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80 and name = btrim(name)),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.brands is
  'A customer of the platform. Every design, file and image belongs to one brand.';

create table public.memberships (
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The MVP has one role. Invitations and other roles are a later layer.
  role text not null check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);

comment on table public.memberships is
  'Who belongs to which brand. No browser may write here. See create_brand.';

create index memberships_user_id_idx on public.memberships (user_id);

-- Browsers reach tables through these two roles. Start from nothing and grant only
-- what a policy below allows.
revoke all on public.brands, public.memberships from anon, authenticated;
grant select on public.brands, public.memberships to authenticated;

alter table public.brands enable row level security;
alter table public.memberships enable row level security;

-- Whether the caller belongs to a brand. Policies call this instead of querying
-- memberships themselves: a policy on memberships that reads memberships would call
-- itself without end. It runs with its owner's rights, so it sees every membership,
-- and it answers only about the caller.
create function private.is_member(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.brand_id = p_brand_id
      and m.user_id = (select auth.uid())
  );
$$;

-- Reads a brand id from text, such as the first folder of a file path. Text that is
-- not an id gives null, which belongs to nobody, instead of an error.
create function private.brand_id_from(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception
  when others then
    return null;
end;
$$;

grant usage on schema private to authenticated;
revoke all on function private.is_member(uuid) from public, anon;
revoke all on function private.brand_id_from(text) from public, anon;
grant execute on function private.is_member(uuid) to authenticated, service_role;
grant execute on function private.brand_id_from(text) to authenticated, service_role;

create policy "members read their brands"
  on public.brands for select to authenticated
  using (private.is_member(id));

create policy "users read their own memberships"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));

-- There are no insert, update or delete policies on either table, on purpose.

-- The most brands one user may belong to.
create function private.max_brands_per_user()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3; $$;

-- Creates a brand and makes the caller its owner. Refuses when the caller already
-- belongs to the most brands allowed. Two calls at once from one user are taken in
-- turn, so the cap cannot be passed by sending them together.
create function public.create_brand(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_count integer;
  v_brand uuid;
begin
  if v_user is null then
    raise exception 'Sign in to create a brand.' using errcode = '28000';
  end if;
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'A brand name has 1 to 80 characters.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('create_brand:' || v_user::text, 0));

  select count(*) into v_count from public.memberships m where m.user_id = v_user;
  if v_count >= private.max_brands_per_user() then
    raise exception 'You can belong to % brands at most.', private.max_brands_per_user()
      using errcode = 'P0001', hint = 'brand_limit';
  end if;

  insert into public.brands (name, created_by) values (v_name, v_user)
  returning id into v_brand;
  insert into public.memberships (brand_id, user_id, role) values (v_brand, v_user, 'owner');

  return v_brand;
end;
$$;

-- Renames a brand. Owners only.
create function public.rename_brand(p_brand_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_user is null then
    raise exception 'Sign in to rename a brand.' using errcode = '28000';
  end if;
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'A brand name has 1 to 80 characters.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.brand_id = p_brand_id and m.user_id = v_user and m.role = 'owner'
  ) then
    -- The same answer whether the brand is missing or belongs to someone else.
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;

  update public.brands set name = v_name, updated_at = now() where id = p_brand_id;
end;
$$;

revoke all on function public.create_brand(text) from public, anon;
revoke all on function public.rename_brand(uuid, text) from public, anon;
grant execute on function public.create_brand(text) to authenticated;
grant execute on function public.rename_brand(uuid, text) to authenticated;
