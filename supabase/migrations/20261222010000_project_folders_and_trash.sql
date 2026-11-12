-- The Projects page (plan v6, workstream P1, decision 0139): folders, the Trash, and "Shared with me".
--
-- Studio designs (`projects`) and launch canvases (`launch_projects`) are two tables until E1
-- unifies them, so an item here names exactly one of the two. Nothing is added to either table:
-- the folder an item is in and whether it is in the Trash are kept beside it (v5 decision 4).
--
-- A member reads their own brand's rows. Only the server writes, through the functions below,
-- and only a member who may manage the kit (private.can_manage_kit) may change anything.

create table public.project_folders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60 and name = btrim(name)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (brand_id, name)
);

comment on table public.project_folders is
  'A brand''s folders on the Projects page. Written by the server only (decision 0139).';

-- Which folder an item is in. An item is in one folder at most; an item in none has no row.
create table public.project_folder_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  folder_id uuid not null,
  project_id uuid,
  launch_project_id uuid,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  constraint project_folder_items_one_item check (num_nonnulls(project_id, launch_project_id) = 1),
  unique (project_id),
  unique (launch_project_id),
  foreign key (folder_id, brand_id) references public.project_folders (id, brand_id) on delete cascade,
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  foreign key (launch_project_id, brand_id) references public.launch_projects (id, brand_id) on delete cascade
);

comment on table public.project_folder_items is
  'The folder a design or launch project is in. Written by the server only (decision 0139).';

-- The Trash. An item with a row here is hidden from the brand's lists until it is restored or
-- deleted for good; deleting for good goes through the existing deletion of its kind.
create table public.project_trash (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid,
  launch_project_id uuid,
  trashed_by uuid references auth.users (id) on delete set null,
  trashed_at timestamptz not null default now(),
  constraint project_trash_one_item check (num_nonnulls(project_id, launch_project_id) = 1),
  unique (project_id),
  unique (launch_project_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  foreign key (launch_project_id, brand_id) references public.launch_projects (id, brand_id) on delete cascade
);

comment on table public.project_trash is
  'Designs and launch projects moved to the Trash. Written by the server only (decision 0139).';

create index project_folder_items_folder_idx on public.project_folder_items (folder_id);
create index project_folder_items_brand_idx on public.project_folder_items (brand_id);
create index project_trash_brand_idx on public.project_trash (brand_id, trashed_at desc);

revoke all on public.project_folders, public.project_folder_items, public.project_trash
  from public, anon, authenticated, service_role;
grant select on public.project_folders, public.project_folder_items, public.project_trash
  to authenticated, service_role;

alter table public.project_folders enable row level security;
alter table public.project_folder_items enable row level security;
alter table public.project_trash enable row level security;

create policy "members read their brand's project folders"
  on public.project_folders for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's project folder items"
  on public.project_folder_items for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's trash"
  on public.project_trash for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

-- The most folders one brand may have.
create function private.project_folders_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 200 $$;

-- Refuses anyone who may not change the brand's projects. A viewer reads but changes nothing.
create function private.check_projects_writer(p_user_id uuid, p_brand_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this brand''s projects.' using errcode = '42501';
  end if;
end;
$$;

-- Refuses an item that is not this brand's. A missing item and another brand's give one answer.
create function private.check_project_item(p_brand_id uuid, p_kind text, p_item_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind = 'design' then
    perform 1 from public.projects p where p.id = p_item_id and p.brand_id = p_brand_id;
  elsif p_kind = 'launch' then
    perform 1 from public.launch_projects l where l.id = p_item_id and l.brand_id = p_brand_id;
  else
    raise exception 'A project is a design or a launch project.' using errcode = '22023';
  end if;
  if not found then
    raise exception 'That project does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- Checks a folder's name: trimmed, 1 to 60 characters.
create function private.project_folder_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if length(v_name) not between 1 and 60 then
    raise exception 'Give the folder a name of 1 to 60 characters.' using errcode = '22023';
  end if;
  return v_name;
end;
$$;

create function public.create_project_folder(p_brand_id uuid, p_user_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := private.project_folder_name(p_name);
begin
  perform private.check_projects_writer(p_user_id, p_brand_id);
  if (select count(*) from public.project_folders f where f.brand_id = p_brand_id) >= private.project_folders_limit() then
    raise exception 'This brand has as many folders as it may have.' using errcode = 'P0001', hint = 'too_many_folders';
  end if;
  if exists (select 1 from public.project_folders f where f.brand_id = p_brand_id and f.name = v_name) then
    raise exception 'There is already a folder with that name.' using errcode = 'P0001', hint = 'folder_name_taken';
  end if;
  insert into public.project_folders (brand_id, name, created_by)
  values (p_brand_id, v_name, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.rename_project_folder(p_brand_id uuid, p_user_id uuid, p_folder_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := private.project_folder_name(p_name);
begin
  perform private.check_projects_writer(p_user_id, p_brand_id);
  if exists (
    select 1 from public.project_folders f
    where f.brand_id = p_brand_id and f.name = v_name and f.id <> p_folder_id
  ) then
    raise exception 'There is already a folder with that name.' using errcode = 'P0001', hint = 'folder_name_taken';
  end if;
  update public.project_folders f set name = v_name, updated_at = now()
  where f.id = p_folder_id and f.brand_id = p_brand_id;
  if not found then
    raise exception 'That folder does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- Removes a folder. The projects in it stay, in no folder.
create function public.remove_project_folder(p_brand_id uuid, p_user_id uuid, p_folder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_projects_writer(p_user_id, p_brand_id);
  delete from public.project_folders f where f.id = p_folder_id and f.brand_id = p_brand_id;
  if not found then
    raise exception 'That folder does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- Moves an item into a folder, or out of every folder when the folder is null.
create function public.place_project_item(p_brand_id uuid, p_user_id uuid, p_kind text, p_item_id uuid, p_folder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_projects_writer(p_user_id, p_brand_id);
  perform private.check_project_item(p_brand_id, p_kind, p_item_id);
  delete from public.project_folder_items i
  where i.brand_id = p_brand_id
    and (case when p_kind = 'design' then i.project_id else i.launch_project_id end) = p_item_id;
  if p_folder_id is null then
    return;
  end if;
  if not exists (select 1 from public.project_folders f where f.id = p_folder_id and f.brand_id = p_brand_id) then
    raise exception 'That folder does not exist.' using errcode = 'P0002';
  end if;
  insert into public.project_folder_items (brand_id, folder_id, project_id, launch_project_id, added_by)
  values (
    p_brand_id, p_folder_id,
    case when p_kind = 'design' then p_item_id end,
    case when p_kind = 'launch' then p_item_id end,
    p_user_id
  );
end;
$$;

-- Whether a design has been ordered: a version marked ordered, or an order in the ops console.
create function private.design_was_ordered(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.design_statuses d where d.project_id = p_project_id and d.status = 'ordered')
      or exists (select 1 from public.ops_orders o where o.project_id = p_project_id);
$$;

-- Moves an item to the Trash. A design that has been ordered cannot be: its order needs it.
create function public.trash_project_item(p_brand_id uuid, p_user_id uuid, p_kind text, p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_projects_writer(p_user_id, p_brand_id);
  perform private.check_project_item(p_brand_id, p_kind, p_item_id);
  if p_kind = 'design' and private.design_was_ordered(p_item_id) then
    raise exception 'This design has been ordered, so it stays.' using errcode = 'P0001', hint = 'ordered';
  end if;
  insert into public.project_trash (brand_id, project_id, launch_project_id, trashed_by)
  values (
    p_brand_id,
    case when p_kind = 'design' then p_item_id end,
    case when p_kind = 'launch' then p_item_id end,
    p_user_id
  )
  on conflict do nothing;
end;
$$;

-- Takes an item back out of the Trash, into the folder it was in.
create function public.restore_project_item(p_brand_id uuid, p_user_id uuid, p_kind text, p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_projects_writer(p_user_id, p_brand_id);
  perform private.check_project_item(p_brand_id, p_kind, p_item_id);
  delete from public.project_trash t
  where t.brand_id = p_brand_id
    and (case when p_kind = 'design' then t.project_id else t.launch_project_id end) = p_item_id;
end;
$$;

-- "Shared with me": the open invites to designs of other brands sent to the signed-in person's
-- confirmed address. The token is never stored, so the invite is opened from its email; this
-- lists what was shared, by whom and at what access, and nothing of the design itself.
create function public.shared_with_me()
returns table (
  invite_id uuid,
  brand_name text,
  project_name text,
  access text,
  invited_at timestamptz,
  expires_at timestamptz,
  opened_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, b.name, p.name, i.access, i.created_at, i.expires_at, i.accepted_at
  from public.share_invites i
  join public.projects p on p.id = i.project_id and p.brand_id = i.brand_id
  join public.brands b on b.id = i.brand_id
  join auth.users u on u.id = (select auth.uid())
  where u.email_confirmed_at is not null
    and lower(u.email::text) = i.email
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at desc, i.id
  limit 200;
$$;

revoke all on function private.project_folders_limit() from public, anon, authenticated;
revoke all on function private.check_projects_writer(uuid, uuid) from public, anon, authenticated;
revoke all on function private.check_project_item(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.project_folder_name(text) from public, anon, authenticated;
revoke all on function private.design_was_ordered(uuid) from public, anon, authenticated;
revoke all on function public.create_project_folder(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rename_project_folder(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.remove_project_folder(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.place_project_item(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.trash_project_item(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.restore_project_item(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.shared_with_me() from public, anon, authenticated;

grant execute on function public.create_project_folder(uuid, uuid, text) to service_role;
grant execute on function public.rename_project_folder(uuid, uuid, uuid, text) to service_role;
grant execute on function public.remove_project_folder(uuid, uuid, uuid) to service_role;
grant execute on function public.place_project_item(uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.trash_project_item(uuid, uuid, text, uuid) to service_role;
grant execute on function public.restore_project_item(uuid, uuid, text, uuid) to service_role;
grant execute on function public.shared_with_me() to authenticated;
