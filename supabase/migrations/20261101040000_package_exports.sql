-- The record of production package exports, and the credit kind they are charged under.
-- Plan v5, workstream X5b (decision 0070, revision 2). Owner decisions 15 to 20.
--
-- A production package (docs/spec/04-production-package.md) is built when it is asked for and is
-- never stored: the ZIP is sent to the browser and thrown away. What is stored is one row for each
-- export: which design, which version of it, which factory, how big the ZIP was, how many files it
-- held and the SHA-256 of the whole ZIP. The same version and factory always give the same bytes,
-- so a stored hash is how a factory's copy is checked against ours.
--
-- It follows export_downloads (20260929030000) exactly: no browser writes here, the server writes
-- through one function that checks the user belongs to the design's brand, only the server's own
-- key may run it, and rows are never changed or removed.
--
-- The 'production_package' credit kind is added to the two check constraints of the credits
-- migration (20261025060000) and seeded into credit_prices. ITS PRICE IS A PLACEHOLDER, NOT A
-- PRICE: owner decision 20 of plan v5 says a sample package for a factory Knitwright does not own
-- stays charged, free when Knitwright makes it and free for a batch, and that the owner may
-- overturn that. The number comes from lib/credits/settings.ts, which is the one source for it
-- (lib/credits/settings-seed.test.ts fails if the two disagree).

-- The credit kind. Both constraints are replaced rather than added to: a check constraint cannot
-- be extended in place, and the old name is kept so nothing that names it has to change.
alter table public.credit_prices drop constraint credit_prices_output_kind_check;
alter table public.credit_prices add constraint credit_prices_output_kind_check
  check (output_kind in ('marketing_media', 'techpack_pdf', 'pattern_file', 'production_package'));

alter table public.credit_ledger drop constraint credit_ledger_output_kind_check;
alter table public.credit_ledger add constraint credit_ledger_output_kind_check
  check (output_kind in ('marketing_media', 'techpack_pdf', 'pattern_file', 'production_package'));

insert into public.credit_prices (output_kind, credits, is_placeholder) values
  ('production_package', 1, true);

create table public.package_exports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  spec_version integer not null check (spec_version >= 1),
  -- The style code and the package root folder, as the ZIP holds them.
  design_code text not null check (length(design_code) between 1 and 200),
  root text not null check (length(root) between 1 and 300),
  file_name text not null check (length(file_name) between 1 and 300),
  -- sha256 of the design version: the same name the credit ledger and the manifest use.
  design_hash text not null check (length(design_hash) between 1 and 200),
  -- The factory the package was laid out for, by its code. Not a key: a package can be exported
  -- for a factory that is later retired, and the row is evidence of what was sent.
  factory_code text not null check (length(factory_code) between 1 and 64),
  kind text not null check (kind in ('sample', 'batch')),
  generator_version text not null check (length(generator_version) between 1 and 64),
  -- sha256 of the whole ZIP. Deterministic: the same version and factory always give the same one.
  zip_sha256 text not null check (zip_sha256 ~ '^[0-9a-f]{64}$'),
  zip_bytes bigint not null check (zip_bytes between 1 and 10737418240),
  file_count integer not null check (file_count between 1 and 100000),
  -- The version's creation time, which every file in the package is pinned to.
  built_for timestamptz not null,
  user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- The design and its brand together, so the two cannot disagree.
  foreign key (project_id, brand_id) references public.projects (id, brand_id)
    on delete cascade
  -- There is no key to spec_versions on purpose, as in export_downloads: the function below
  -- checks that the version exists, and it is the only way a row is written.
);

comment on table public.package_exports is
  'One row for each production package export: which design version, which factory, and the SHA-256 of the ZIP. Append-only: see private.refuse_package_export_change. Written by the server only.';

create index package_exports_project_idx on public.package_exports (project_id, created_at desc);
create index package_exports_brand_idx on public.package_exports (brand_id, created_at desc);

-- Browsers may read their own brand's rows and nothing else. The server's own key may read too.
-- It writes through record_package_export, and nothing else.
revoke all on public.package_exports from public, anon, authenticated, service_role;
grant select on public.package_exports to authenticated, service_role;

alter table public.package_exports enable row level security;

create policy "members read their brand's package exports"
  on public.package_exports for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

-- A second lock, as on export_downloads. The grants already stop every role from changing or
-- removing a row; this stops the owner of the table and any role given a grant by mistake. The one
-- thing it lets through is the delete that follows from deleting the design.
create function private.refuse_package_export_change()
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
  raise exception 'A package export record can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger package_exports_are_append_only
  before update or delete on public.package_exports
  for each row execute function private.refuse_package_export_change();

create trigger package_exports_are_not_truncated
  before truncate on public.package_exports
  for each statement execute function private.refuse_package_export_change();

-- Records one export. The server has already identified the user, so this checks the membership
-- itself: a design of another brand, and a design that does not exist, give the same answer. The
-- brand is taken from the design, never from the caller.
create function public.record_package_export(
  p_project_id uuid,
  p_user_id uuid,
  p_spec_version integer,
  p_design_code text,
  p_root text,
  p_file_name text,
  p_design_hash text,
  p_factory_code text,
  p_kind text,
  p_generator_version text,
  p_zip_sha256 text,
  p_zip_bytes bigint,
  p_file_count integer,
  p_built_for timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
  v_id uuid;
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

  insert into public.package_exports (
    brand_id, project_id, spec_version, design_code, root, file_name, design_hash,
    factory_code, kind, generator_version, zip_sha256, zip_bytes, file_count, built_for, user_id
  )
  values (
    v_brand, p_project_id, p_spec_version, p_design_code, p_root, p_file_name, p_design_hash,
    p_factory_code, p_kind, p_generator_version, p_zip_sha256, p_zip_bytes, p_file_count, p_built_for, p_user_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Only the server's own key may run it. A browser is refused.
revoke all on function public.record_package_export(uuid, uuid, integer, text, text, text, text, text, text, text, text, bigint, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_package_export(uuid, uuid, integer, text, text, text, text, text, text, text, text, bigint, integer, timestamptz)
  to service_role;

revoke all on function private.refuse_package_export_change() from public, anon, authenticated;
