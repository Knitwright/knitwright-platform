-- A club's own artwork (plans/production-outputs.md, workstream W7b; decision 0036).
--
-- Raster artwork is kept twice: a full resolution print copy (a lossless TIFF, read only by the print
-- files) and a screen copy. Vector artwork (an SVG, or a PDF page) is NEVER stored as given: it becomes
-- a restricted vector model stored as JSON, plus a screen picture. No SVG is stored or served.
--
-- Members read their brand's artwork records. Only the server writes: there is no write grant and no
-- write policy for any browser role.
--
-- CONTRACT CHANGES (declared on the PR, labelled `contract`; W0 owns both lists):
--   1. files_kind_check gains 'artwork-print' and 'artwork-vector'.
--   2. The exports bucket gains 'application/json' for the vector model. It is appended to whatever
--      the bucket allows, so other migrations' types are kept. 'image/svg+xml' is never added.

alter table public.files drop constraint files_kind_check;
alter table public.files add constraint files_kind_check
  check (kind in (
    'artwork', 'sketch', 'photo', 'render', 'export', 'chart', 'pattern',
    'print', 'proof', 'roster', 'pattern-source',
    'artwork-print', 'artwork-vector'
  ));

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct kind order by kind)
  from unnest(allowed_mime_types || array['application/json']) as kind
)
where id = 'exports';

create table public.user_artworks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind text not null check (kind in ('raster', 'vector')),
  -- The format the file really was, read from its first bytes. The original file is not kept.
  source_format text not null check (source_format in ('png', 'jpeg', 'tiff', 'pdf', 'svg', 'ai')),
  -- A plain name for lists, taken from the file name with anything unsafe removed. Never used as a path.
  label text not null check (length(btrim(label)) between 1 and 80),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  print_sha256 text not null check (print_sha256 ~ '^[0-9a-f]{64}$'),
  -- A raster has a print copy; a vector has its model as JSON. Both have a screen copy.
  print_file_id uuid references public.files (id) on delete cascade,
  vector_file_id uuid references public.files (id) on delete cascade,
  screen_file_id uuid not null references public.files (id) on delete cascade,
  width_px integer not null check (width_px between 1 and 12000),
  height_px integer not null check (height_px between 1 and 12000),
  -- The resolution the file states, when it states one.
  dpi_meta numeric check (dpi_meta is null or dpi_meta between 1 and 100000),
  colour_space text not null check (colour_space in ('srgb', 'cmyk', 'grey', 'adobe-rgb', 'display-p3', 'unknown')),
  profile_name text check (profile_name is null or length(profile_name) between 1 and 120),
  has_alpha boolean not null,
  -- Decision 0025: who said they may use this artwork on garments, when, and the words they saw.
  rights_confirmed_by uuid not null references auth.users (id) on delete restrict,
  rights_confirmed_at timestamptz not null,
  rights_wording_version text not null references private.consent_wordings (version)
    check (rights_wording_version like 'logo-rights-%'),
  -- Plain sentences about what was found, left out or turned into screen colours.
  warnings jsonb not null default '[]'
    check (jsonb_typeof(warnings) = 'array' and pg_column_size(warnings) < 8192),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  constraint user_artworks_copy_matches_kind check (
    (kind = 'raster' and print_file_id is not null and vector_file_id is null)
    or (kind = 'vector' and vector_file_id is not null and print_file_id is null)
  )
);

comment on table public.user_artworks is
  'A brand''s uploaded artwork: print and screen copies, or a vector model as JSON. Never an SVG. Written by the server only.';

create index user_artworks_brand_idx on public.user_artworks (brand_id, created_at desc);

revoke all on public.user_artworks from public, anon, authenticated;
grant select on public.user_artworks to authenticated;
-- The server adds records and removes them; a record is never edited, so a print file's hash stays true.
revoke all on public.user_artworks from service_role;
grant select, insert, delete on public.user_artworks to service_role;

alter table public.user_artworks enable row level security;

create policy "members read their brand's artwork"
  on public.user_artworks for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.
