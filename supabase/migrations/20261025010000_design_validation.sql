-- Validation gate and design status (plans/platform-v4.md, workstream V1).
--
-- factory_profiles: what a factory makes and on what terms. Platform data, not owned by a brand.
-- Signed-in members read it; only the server's own key writes it (platform admins, through the
-- service client). The one seeded row says plainly that no factory has agreed to it, and leaves
-- minimum orders, price ladder and lead time unset.
--
-- design_statuses: one row per design version: draft, validated or ordered. "validated" means only
-- that there were no blockers against one profile on one date; the row keeps the profile and a hash
-- of the findings. Moves are checked here as well as in the app. No browser writes.

create table public.factory_profiles (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 64),
  name text not null check (length(btrim(name)) between 1 and 120),
  -- Says who has agreed to the profile.
  label text not null check (length(btrim(label)) between 1 and 200),
  -- The typed body: see factoryProfileSchema in lib/validation/profile.ts. Checked by the app.
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.factory_profiles is
  'Platform data: what a factory makes and on what terms. Read by signed-in members, written by the server only.';

revoke all on public.factory_profiles from public, anon, authenticated, service_role;
grant select on public.factory_profiles to authenticated, service_role;
grant insert, update on public.factory_profiles to service_role;

alter table public.factory_profiles enable row level security;

create policy "members read factory profiles"
  on public.factory_profiles for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

-- There are no insert, update or delete policies on purpose.

-- The seed profile. Its body is rewritten from the garment registry by the app when it reads it
-- (defaultFactoryProfile), so this row only has to exist and carry the label.
insert into public.factory_profiles (id, name, label, profile)
values (
  'knitwright-default',
  'Knitwright default',
  'Knitwright default profile, not agreed with a factory',
  '{"id":"knitwright-default","name":"Knitwright default","label":"Knitwright default profile, not agreed with a factory","articles":[],"fabrics":[],"structuralOptions":[],"priceLadder":{"status":"not-set"},"leadTimeDays":{"status":"not-set"},"fileFormats":[],"hsCodes":{"status":"not-set"}}'::jsonb
);

create table public.design_statuses (
  project_id uuid not null,
  brand_id uuid not null,
  version integer not null check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'validated', 'ordered')),
  -- Set exactly when the status is validated or ordered. Plain text, not a foreign key.
  profile_id text,
  findings_hash text check (findings_hash ~ '^[0-9a-f]{64}$'),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null,
  primary key (project_id, version),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  foreign key (project_id, version) references public.spec_versions (project_id, version) on delete cascade,
  check ((status = 'draft') = (profile_id is null and findings_hash is null))
);

comment on table public.design_statuses is
  'Status of one design version. Written by set_design_status only.';

create index design_statuses_brand_idx on public.design_statuses (brand_id);

revoke all on public.design_statuses from public, anon, authenticated, service_role;
grant select on public.design_statuses to authenticated, service_role;

alter table public.design_statuses enable row level security;

create policy "members read their brand's design statuses"
  on public.design_statuses for select to authenticated
  using (private.is_member(brand_id));

-- Refuses a move the app would refuse: an ordered version never moves, and a draft cannot be ordered.
create function private.refuse_illegal_status_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'ordered' then
    raise exception 'An ordered version can never change its status.' using errcode = 'P0001', hint = 'status_ordered';
  end if;
  if old.status = 'draft' and new.status = 'ordered' then
    raise exception 'A draft cannot be ordered.' using errcode = 'P0001', hint = 'status_move';
  end if;
  return new;
end;
$$;

create trigger design_statuses_legal_moves
  before update on public.design_statuses
  for each row execute function private.refuse_illegal_status_move();

-- Sets the status of one version of a design. Only the server's own key may run it; it has already
-- run the validation. A draft clears the profile and the hash.
create function public.set_design_status(
  p_project_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_version integer,
  p_status text,
  p_profile_id text,
  p_findings_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if p_status = 'ordered' and not exists (
    select 1 from public.design_statuses d
    where d.project_id = p_project_id and d.version = p_version and d.brand_id = p_brand_id
  ) then
    raise exception 'A draft cannot be ordered.' using errcode = 'P0001', hint = 'status_move';
  end if;
  if p_status = 'draft' then
    p_profile_id := null;
    p_findings_hash := null;
  end if;
  insert into public.design_statuses (project_id, brand_id, version, status, profile_id, findings_hash, changed_by)
  values (p_project_id, p_brand_id, p_version, p_status, p_profile_id, p_findings_hash, p_user_id)
  on conflict (project_id, version) do update
    set status = excluded.status,
        profile_id = excluded.profile_id,
        findings_hash = excluded.findings_hash,
        changed_at = now(),
        changed_by = excluded.changed_by
    where public.design_statuses.brand_id = p_brand_id;
end;
$$;

revoke all on function public.set_design_status(uuid, uuid, uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.set_design_status(uuid, uuid, uuid, integer, text, text, text) to service_role;
