-- File storage. Plan step 3, tasks 4 to 6.
--
-- Three private buckets. Every path starts with the id of the brand that owns the
-- file: "<brand id>/<kind>/<file id>.<ext>". Members may read their brand's files.
-- No browser may write to storage: the server checks every upload first (its type, its
-- size and its content) and writes the file itself.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads', 'uploads', false, 10485760, array['image/png', 'image/jpeg']),
  ('images', 'images', false, 10485760, array['image/png', 'image/jpeg']),
  -- No SVG here: a browser runs the scripts inside one. Exports are built when they
  -- are downloaded and are not stored, so nothing writes to this bucket yet.
  ('exports', 'exports', false, 52428800, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]);

create policy "members read their brand's files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('uploads', 'images', 'exports')
    and private.is_member(private.brand_id_from((storage.foldername(name))[1]))
  );

-- There are no insert, update or delete policies on storage.objects, on purpose.

-- One row for each stored file, so a file is asked for by its id and never by a path.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  bucket text not null check (bucket in ('uploads', 'images', 'exports')),
  path text not null,
  kind text not null check (kind in ('artwork', 'sketch', 'photo', 'render', 'export')),
  content_type text not null,
  bytes integer not null check (bytes > 0),
  width integer check (width > 0),
  height integer check (height > 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (bucket, path),
  -- A file's path must sit inside its own brand's folder.
  constraint files_path_in_brand_folder check (path like brand_id::text || '/%')
);

comment on table public.files is
  'One row per stored file. Written by the server only, after the upload is checked.';

create index files_brand_id_idx on public.files (brand_id, created_at desc);

revoke all on public.files from anon, authenticated;
grant select on public.files to authenticated;

alter table public.files enable row level security;

create policy "members read their brand's file records"
  on public.files for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on files, on purpose.
