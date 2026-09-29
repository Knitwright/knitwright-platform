-- The record of tech pack downloads. Plan step 9, task 4.
--
-- Exports are built when they are asked for and are never stored. What is stored is one row for
-- each download: which design, which version of it, which format and, for a drawing, which view,
-- who asked and when. The route records a download before it sends the file, and sends nothing
-- when the record cannot be made.
--
-- It follows the projects tables exactly. No browser writes here. The server writes through one
-- function, which checks that the user belongs to the design's brand, and only the server's own
-- key may run it. Rows are never changed or removed.

create table public.export_downloads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  spec_version integer not null check (spec_version >= 1),
  format text not null check (format in ('pdf', 'xlsx', 'svg')),
  -- Which drawing, for an SVG file. Every other format has none.
  view text check (view in ('front', 'back')),
  user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((format = 'svg') = (view is not null)),
  -- The design and its brand together, so the two cannot disagree.
  foreign key (project_id, brand_id) references public.projects (id, brand_id)
    on delete cascade
  -- There is no key to spec_versions on purpose: a key would make emptying that table fail with
  -- a different message from the one its own lock gives. The function below checks that the
  -- version exists, and it is the only way a row is written.
);

comment on table public.export_downloads is
  'One row for each tech pack download. Append-only: see private.refuse_download_change. Written by the server only.';

create index export_downloads_project_idx on public.export_downloads (project_id, created_at desc);
create index export_downloads_brand_idx on public.export_downloads (brand_id, created_at desc);

-- Browsers may read and nothing else. The server's own key may read too. It writes through
-- record_export_download, and nothing else.
revoke all on public.export_downloads from public, anon, authenticated, service_role;
grant select on public.export_downloads to authenticated, service_role;

alter table public.export_downloads enable row level security;

create policy "members read their brand's downloads"
  on public.export_downloads for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

-- A second lock, as on the history of a design. The grants already stop every role from changing
-- or removing a row. This trigger stops the owner of the table and any role given a grant by
-- mistake. The one thing it lets through is the delete that follows from deleting the design:
-- by then the design is gone, so the row has nothing left to belong to.
create function private.refuse_download_change()
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
  raise exception 'A download record can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger export_downloads_are_append_only
  before update or delete on public.export_downloads
  for each row execute function private.refuse_download_change();

create trigger export_downloads_are_not_truncated
  before truncate on public.export_downloads
  for each statement execute function private.refuse_download_change();

-- Records one download. The server has already identified the user, so this checks the
-- membership itself: a design of another brand, and a design that does not exist, give the same
-- answer. The brand is taken from the design, never from the caller.
create function public.record_export_download(
  p_project_id uuid,
  p_user_id uuid,
  p_spec_version integer,
  p_format text,
  p_view text
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

  if not exists (
    select 1 from public.spec_versions v
    where v.project_id = p_project_id and v.version = p_spec_version
  ) then
    raise exception 'That version does not exist.' using errcode = 'P0002';
  end if;

  insert into public.export_downloads (brand_id, project_id, spec_version, format, view, user_id)
  values (v_brand, p_project_id, p_spec_version, p_format, p_view, p_user_id);
end;
$$;

-- Only the server's own key may run it. A browser is refused.
revoke all on function public.record_export_download(uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.record_export_download(uuid, uuid, integer, text, text)
  to service_role;

revoke all on function private.refuse_download_change() from public, anon, authenticated;
