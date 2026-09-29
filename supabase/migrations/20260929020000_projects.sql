-- Projects and their versions. Plan step 6, task 1.
--
-- A project is one design. Every accepted change to it is stored as a new row in
-- spec_versions, and nothing ever changes or removes a row there. Going back to an old
-- version stores a new version that holds the old design.
--
-- No browser writes to either table. The server writes through the functions below,
-- because it must check a design against the garment rules (which live in the app, not
-- in the database) before anything is stored. Only the server's own key may run them.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80 and name = btrim(name)),
  style_number text not null default '' check (length(style_number) <= 40),
  season text not null default '' check (length(season) <= 40),
  garment_type text not null check (length(garment_type) between 1 and 64),
  current_version integer not null default 1 check (current_version >= 1),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets a version name its project and its brand together, so the two cannot disagree.
  unique (id, brand_id)
);

comment on table public.projects is
  'One design. Its content is the newest row of spec_versions. Written by the server only.';

create index projects_brand_id_idx on public.projects (brand_id, created_at desc);

create table public.spec_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  brand_id uuid not null,
  version integer not null check (version >= 1),
  spec jsonb not null check (jsonb_typeof(spec) = 'object'),
  schema_version integer not null check (schema_version >= 1),
  -- One plain sentence saying what changed.
  note text not null check (length(btrim(note)) between 1 and 200),
  -- The version this one was copied from, when it came from a restore.
  restored_from integer check (restored_from >= 1 and restored_from < version),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, version),
  -- The only way a version may go: together with its project.
  foreign key (project_id, brand_id) references public.projects (id, brand_id)
    on delete cascade
);

comment on table public.spec_versions is
  'Every saved state of every design. Append-only: see private.refuse_history_change.';

-- Browsers may read and nothing else. Even the server's own key may only read here:
-- it adds versions through append_spec_version, which numbers them in order.
revoke all on public.projects, public.spec_versions
  from public, anon, authenticated, service_role;
grant select on public.projects, public.spec_versions to authenticated, service_role;
-- Removing a project removes its versions with it. Account deletion (step 26) needs this.
grant delete on public.projects to service_role;

alter table public.projects enable row level security;
alter table public.spec_versions enable row level security;

create policy "members read their brand's projects"
  on public.projects for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's versions"
  on public.spec_versions for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on either table, on purpose.

-- A second lock on the history. The grants above already stop every role from changing
-- or deleting a version. This trigger stops the owner of the table and any role that is
-- given a grant by mistake. The one thing it lets through is the delete that follows
-- from deleting the project: by then the project row is already gone, so the version
-- has no project left to belong to. A delete while the project still exists is refused.
create function private.refuse_history_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.projects p where p.id = old.project_id) then
    return old;
  end if;
  raise exception 'A saved version can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger spec_versions_are_append_only
  before update or delete on public.spec_versions
  for each row execute function private.refuse_history_change();

create trigger spec_versions_are_not_truncated
  before truncate on public.spec_versions
  for each statement execute function private.refuse_history_change();

-- Trims a piece of text and refuses it when its length is outside the limits.
create function private.project_text(p_value text, p_min integer, p_max integer, p_what text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := btrim(coalesce(p_value, ''));
begin
  if length(v_text) < p_min or length(v_text) > p_max then
    raise exception '% has % to % characters.', p_what, p_min, p_max using errcode = '22023';
  end if;
  return v_text;
end;
$$;

-- Refuses a design that is not an object, or that has no format number. The app checks
-- the design in full before it calls the functions below. This is only the last guard.
create function private.check_spec(p_spec jsonb, p_schema_version integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_spec) is distinct from 'object'
     or p_schema_version is null or p_schema_version < 1 then
    raise exception 'A design must be an object with a format number.' using errcode = '22023';
  end if;
end;
$$;

-- Whether a person belongs to a brand. The functions below act for a user the server has
-- already identified, so they check this themselves.
create function private.belongs_to(p_user_id uuid, p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.brand_id = p_brand_id and m.user_id = p_user_id
  );
$$;

-- Makes a project and its first version. Returns the project's id.
create function public.create_project(
  p_brand_id uuid,
  p_user_id uuid,
  p_name text,
  p_style_number text,
  p_season text,
  p_garment_type text,
  p_spec jsonb,
  p_schema_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    -- The same answer whether the brand is missing or belongs to someone else.
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;

  perform private.check_spec(p_spec, p_schema_version);

  insert into public.projects (brand_id, name, style_number, season, garment_type, created_by)
  values (
    p_brand_id,
    private.project_text(p_name, 1, 80, 'A design name'),
    private.project_text(p_style_number, 0, 40, 'A style number'),
    private.project_text(p_season, 0, 40, 'A season'),
    private.project_text(p_garment_type, 1, 64, 'A garment type'),
    p_user_id
  )
  returning id into v_project;

  insert into public.spec_versions
    (project_id, brand_id, version, spec, schema_version, note, created_by)
  values (v_project, p_brand_id, 1, p_spec, p_schema_version, 'Design created.', p_user_id);

  return v_project;
end;
$$;

-- Stores a design as the next version. The caller says which version it started from.
-- The project row is locked first, so two saves that arrive together are taken in turn
-- and the second finds the version has moved on. It is refused with the hint
-- version_conflict, and nothing is stored. Returns the new version number.
create function public.append_spec_version(
  p_project_id uuid,
  p_user_id uuid,
  p_expected_version integer,
  p_spec jsonb,
  p_schema_version integer,
  p_note text,
  p_restored_from integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_next integer;
begin
  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found or not private.belongs_to(p_user_id, v_project.brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;

  if v_project.current_version is distinct from p_expected_version then
    raise exception 'This design was changed somewhere else.'
      using errcode = 'P0001', hint = 'version_conflict';
  end if;

  if p_restored_from is not null and not exists (
    select 1 from public.spec_versions v
    where v.project_id = p_project_id and v.version = p_restored_from
  ) then
    raise exception 'That version does not exist.' using errcode = '22023';
  end if;

  perform private.check_spec(p_spec, p_schema_version);

  v_next := v_project.current_version + 1;
  insert into public.spec_versions
    (project_id, brand_id, version, spec, schema_version, note, restored_from, created_by)
  values (
    p_project_id,
    v_project.brand_id,
    v_next,
    p_spec,
    p_schema_version,
    private.project_text(p_note, 1, 200, 'A note'),
    p_restored_from,
    p_user_id
  );
  -- The list of designs shows the garment type, so it follows the design when a change
  -- of type is saved. A design with no type in it leaves the last one in place.
  update public.projects
  set current_version = v_next,
      garment_type = coalesce(nullif(left(p_spec ->> 'typeId', 64), ''), garment_type),
      updated_at = now()
  where id = p_project_id;

  return v_next;
end;
$$;

-- Changes the name, style number and season. These are not part of a design's content,
-- so they are not versioned.
create function public.rename_project(
  p_project_id uuid,
  p_user_id uuid,
  p_name text,
  p_style_number text,
  p_season text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  select p.brand_id into v_brand from public.projects p where p.id = p_project_id;
  if v_brand is null or not private.belongs_to(p_user_id, v_brand) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;

  update public.projects
  set name = private.project_text(p_name, 1, 80, 'A design name'),
      style_number = private.project_text(p_style_number, 0, 40, 'A style number'),
      season = private.project_text(p_season, 0, 40, 'A season'),
      updated_at = now()
  where id = p_project_id;
end;
$$;

-- Only the server's own key may run the write functions. A browser is refused.
revoke all on function public.create_project(uuid, uuid, text, text, text, text, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.append_spec_version(uuid, uuid, integer, jsonb, integer, text, integer)
  from public, anon, authenticated;
revoke all on function public.rename_project(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_project(uuid, uuid, text, text, text, text, jsonb, integer)
  to service_role;
grant execute on function public.append_spec_version(uuid, uuid, integer, jsonb, integer, text, integer)
  to service_role;
grant execute on function public.rename_project(uuid, uuid, text, text, text) to service_role;

revoke all on function private.project_text(text, integer, integer, text) from public, anon, authenticated;
revoke all on function private.check_spec(jsonb, integer) from public, anon, authenticated;
revoke all on function private.belongs_to(uuid, uuid) from public, anon, authenticated;
revoke all on function private.refuse_history_change() from public, anon, authenticated;
