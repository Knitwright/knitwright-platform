-- User artwork intake (plans/production-outputs.md, workstream W7b; decision 0036).
--
-- CONTRACT CHANGE, declared on the pull request and labelled "contract": W0 owns `files_kind_check`
-- and the bucket types, and this migration adds two file kinds and one bucket type.
--   artwork-print   the full resolution print copy of an uploaded picture (a TIFF, in "exports").
--   artwork-vector  an uploaded vector reduced to restricted vector JSON (in "exports"). It is
--                   the print copy of a vector artwork.
-- The bucket type added is application/json, for that vector file. No SVG type is ever added to a
-- bucket: an uploaded SVG is never stored, and any SVG handed back is built on download.
--
-- The new table holds one row per uploaded artwork. Members read their own brand's rows. Only the
-- server writes: there is no write grant and no write policy for any browser role.

alter table public.files drop constraint files_kind_check;
alter table public.files add constraint files_kind_check
  check (kind in (
    'artwork', 'sketch', 'photo', 'render', 'export', 'chart', 'pattern',
    'print', 'proof', 'roster', 'pattern-source',
    'artwork-print', 'artwork-vector'
  ));

-- Add one type without replacing the list, so this cannot undo another workstream's types.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/json')
where id = 'exports'
  and not ('application/json' = any (allowed_mime_types));

create table public.user_artworks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind text not null check (kind in ('raster', 'vector')),
  -- What the first bytes said the upload was. The name and stated type are never used.
  source_format text not null check (source_format in ('png', 'jpeg', 'tiff', 'pdf', 'svg')),
  -- A name for the person to recognise it by. Never used as a path.
  name text not null check (length(btrim(name)) between 1 and 80),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  print_sha256 text not null check (print_sha256 ~ '^[0-9a-f]{64}$'),
  -- The print copy: a TIFF for a picture, restricted vector JSON for a vector.
  print_file_id uuid not null references public.files (id) on delete cascade,
  -- The small copy a browser may be shown.
  screen_file_id uuid not null references public.files (id) on delete cascade,
  width_px integer not null check (width_px between 1 and 12000),
  height_px integer not null check (height_px between 1 and 12000),
  -- The resolution the file states, when it states one.
  dpi_meta numeric check (dpi_meta is null or dpi_meta between 1 and 10000),
  -- A vector's natural size when the file states one.
  natural_width_mm numeric check (natural_width_mm is null or natural_width_mm > 0),
  colour_space text not null
    check (colour_space in ('srgb', 'cmyk', 'grey', 'adobe-rgb', 'display-p3', 'unknown')),
  colour_profile_name text check (colour_profile_name is null or length(colour_profile_name) <= 120),
  has_alpha boolean not null,
  -- A logo on an opaque white box, which the person can ask us to remove.
  white_background boolean not null default false,
  -- Sentences about what was found, left out or changed, shown with the artwork.
  warnings text[] not null default '{}' check (cardinality(warnings) <= 20),
  -- Set when this artwork was made from another one (remove white, make seamless).
  derived_from uuid references public.user_artworks (id) on delete set null,
  -- Decision 0025: who confirmed they may use it, when, and the words they saw.
  rights_confirmed_by uuid not null references auth.users (id) on delete restrict,
  rights_confirmed_at timestamptz not null,
  rights_wording_version text not null check (length(rights_wording_version) between 1 and 40),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.user_artworks is
  'Artwork a brand uploaded, as stored copies and facts about them. Written by the server only.';

create index user_artworks_brand_idx on public.user_artworks (brand_id, created_at desc);

revoke all on public.user_artworks from public, anon, authenticated;
grant select on public.user_artworks to authenticated;
revoke all on public.user_artworks from service_role;
grant select, insert, delete on public.user_artworks to service_role;

alter table public.user_artworks enable row level security;

create policy "members read their brand's artworks"
  on public.user_artworks for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.
