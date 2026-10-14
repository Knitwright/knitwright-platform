-- The pattern library (plans/production-outputs.md, workstream W1).
--
-- A block is one pattern for one product, wearer and cut, at one version: the pieces of every
-- size, the measurements read from them and the checks that were run. A new upload is a new
-- version; nothing is edited. A technician's review is a separate record against one block
-- version, and until one exists every file says "Draft pattern, not reviewed."
--
-- Every table is for one brand, which members read. Only the server writes: there is no write
-- grant and no write policy for any browser role. History is append-only, with the same second
-- lock as spec_versions. No other workstream's tables are referred to.

-- A pattern job is for one size, as before, or for a whole size set. A set job ends in a block.
alter table public.pattern_jobs
  add column kind text not null default 'single' check (kind in ('single', 'size-set'));

create table public.pattern_blocks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- The garment type the pattern is for, such as 'crew-tee' (the registry's id).
  product_key text not null check (product_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(product_key) <= 64),
  wearer text not null check (wearer in ('men', 'women', 'youth')),
  cut text not null check (cut in ('mens', 'womens', 'junior', 'unisex')),
  name text not null check (length(name) between 1 and 120),
  -- A knit programme (socks) holds a factory's programme and a size map, never pieces.
  kind text not null default 'pieces' check (kind in ('pieces', 'knit-programme')),
  version integer not null check (version >= 1),
  source text not null check (source in ('fashioninsta-bridge', 'technician-upload', 'brand-import')),
  sizes text[] not null check (cardinality(sizes) <= 30),
  -- Landmarks a person placed by hand, by "size/piece id".
  landmark_overrides jsonb not null default '{}' check (jsonb_typeof(landmark_overrides) = 'object' and pg_column_size(landmark_overrides) < 262144),
  -- What the library added to the files, what it warned about and what it still asks, one sentence each.
  derived text[] not null default '{}' check (cardinality(derived) <= 100),
  warnings text[] not null default '{}' check (cardinality(warnings) <= 100),
  questions text[] not null default '{}' check (cardinality(questions) <= 20),
  -- A knit programme's size map: a label and the programme size it is made from.
  size_map jsonb check (size_map is null or (jsonb_typeof(size_map) = 'object' and pg_column_size(size_map) < 16384)),
  programme_note text check (programme_note is null or length(programme_note) <= 500),
  -- The file of every size in one DXF, as it was when the version was made.
  set_dxf_file_id uuid references public.files (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (brand_id, product_key, wearer, cut, version),
  unique (id, brand_id),
  constraint pattern_blocks_pieces_have_sizes check (kind <> 'pieces' or cardinality(sizes) >= 1),
  constraint pattern_blocks_programme_has_no_pieces check (kind <> 'knit-programme' or (cardinality(sizes) = 0 and size_map is not null))
);

comment on table public.pattern_blocks is
  'A pattern for one product, wearer and cut, at one version. Append-only; written by the server only.';

create index pattern_blocks_brand_idx on public.pattern_blocks (brand_id, product_key, created_at desc);

create table public.pattern_block_sizes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  block_id uuid not null,
  size_label text not null check (length(size_label) between 1 and 16),
  position integer not null check (position between 0 and 29),
  -- The pieces of this size (PatternPiece in lib/production/contract), the points measured from
  -- them (PatternMeasurement), the points that could not be measured, and the checks that ran.
  pieces jsonb not null check (jsonb_typeof(pieces) = 'array' and jsonb_array_length(pieces) between 1 and 200 and pg_column_size(pieces) < 2097152),
  measurements jsonb not null check (jsonb_typeof(measurements) = 'array' and jsonb_array_length(measurements) <= 100),
  skipped jsonb not null default '[]' check (jsonb_typeof(skipped) = 'array' and jsonb_array_length(skipped) <= 100),
  checks jsonb not null default '[]' check (jsonb_typeof(checks) = 'array' and jsonb_array_length(checks) <= 400),
  dxf_file_id uuid references public.files (id) on delete set null,
  unique (block_id, size_label),
  unique (block_id, position),
  foreign key (block_id, brand_id) references public.pattern_blocks (id, brand_id) on delete cascade
);

comment on table public.pattern_block_sizes is
  'The pieces, measurements and checks of one size of a pattern block. Append-only; written by the server only.';

create index pattern_block_sizes_block_idx on public.pattern_block_sizes (block_id, position);

create table public.pattern_reviews (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  block_id uuid not null,
  -- Who looked at the pattern, in their own words, with their role, the day, and a note.
  reviewer_name text not null check (length(btrim(reviewer_name)) between 1 and 120),
  reviewer_role text not null default 'technician' check (length(btrim(reviewer_role)) between 1 and 60),
  note text not null default '' check (length(note) <= 1000),
  reviewed_on date not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (block_id, brand_id) references public.pattern_blocks (id, brand_id) on delete cascade
);

comment on table public.pattern_reviews is
  'A named person''s review of one pattern block version. Append-only; written by the server only.';

create index pattern_reviews_block_idx on public.pattern_reviews (block_id, created_at desc);

-- Pattern jobs may end in a block.
alter table public.pattern_jobs
  add column block_id uuid references public.pattern_blocks (id) on delete set null;

revoke all on public.pattern_blocks, public.pattern_block_sizes, public.pattern_reviews from public, anon, authenticated;
grant select on public.pattern_blocks, public.pattern_block_sizes, public.pattern_reviews to authenticated;
grant select, insert on public.pattern_blocks, public.pattern_block_sizes, public.pattern_reviews to service_role;

alter table public.pattern_blocks enable row level security;
alter table public.pattern_block_sizes enable row level security;
alter table public.pattern_reviews enable row level security;

create policy "members read their brand's pattern blocks"
  on public.pattern_blocks for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's pattern block sizes"
  on public.pattern_block_sizes for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's pattern reviews"
  on public.pattern_reviews for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

-- A second lock on the history. The grants already stop every role from changing or deleting a
-- row. This trigger stops the owner of the table and any role given a grant by mistake. It lets
-- through only what follows from something above being deleted (the brand, or the block), and a
-- stored file being removed, which sets its file column to null and changes nothing else.
create function private.refuse_pattern_library_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'pattern_blocks' then
      if not exists (select 1 from public.brands b where b.id = old.brand_id) then
        return old;
      end if;
    elsif not exists (select 1 from public.pattern_blocks b where b.id = old.block_id) then
      return old;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Removing a stored file sets its column to null. Nothing else may change.
    if tg_table_name = 'pattern_blocks' then
      if new.set_dxf_file_id is null and (to_jsonb(new) - 'set_dxf_file_id') = (to_jsonb(old) - 'set_dxf_file_id') then
        return new;
      end if;
    elsif tg_table_name = 'pattern_block_sizes' then
      if new.dxf_file_id is null and (to_jsonb(new) - 'dxf_file_id') = (to_jsonb(old) - 'dxf_file_id') then
        return new;
      end if;
    end if;
  end if;
  raise exception 'A saved pattern can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger pattern_blocks_are_append_only
  before update or delete on public.pattern_blocks
  for each row execute function private.refuse_pattern_library_change();
create trigger pattern_block_sizes_are_append_only
  before update or delete on public.pattern_block_sizes
  for each row execute function private.refuse_pattern_library_change();
create trigger pattern_reviews_are_append_only
  before update or delete on public.pattern_reviews
  for each row execute function private.refuse_pattern_library_change();

create trigger pattern_blocks_are_not_truncated
  before truncate on public.pattern_blocks
  for each statement execute function private.refuse_pattern_library_change();
create trigger pattern_block_sizes_are_not_truncated
  before truncate on public.pattern_block_sizes
  for each statement execute function private.refuse_pattern_library_change();
create trigger pattern_reviews_are_not_truncated
  before truncate on public.pattern_reviews
  for each statement execute function private.refuse_pattern_library_change();

-- Stores a block and all of its sizes as the next version, together or not at all. The key
-- (product, wearer, cut) is locked first, so two uploads that arrive together are numbered in
-- turn. Returns the new block's id and version.
create function public.create_pattern_block(
  p_brand_id uuid,
  p_user_id uuid,
  p_product_key text,
  p_wearer text,
  p_cut text,
  p_name text,
  p_kind text,
  p_source text,
  p_sizes text[],
  p_overrides jsonb,
  p_derived text[],
  p_warnings text[],
  p_questions text[],
  p_size_map jsonb,
  p_programme_note text,
  p_set_file uuid,
  p_size_rows jsonb
)
returns table (block_id uuid, block_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
  v_id uuid;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_size_rows) is distinct from 'array' then
    raise exception 'The sizes must be a list.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_brand_id::text || '/' || p_product_key || '/' || p_wearer || '/' || p_cut, 0));

  select coalesce(max(b.version), 0) + 1 into v_version
  from public.pattern_blocks b
  where b.brand_id = p_brand_id and b.product_key = p_product_key and b.wearer = p_wearer and b.cut = p_cut;

  insert into public.pattern_blocks
    (brand_id, product_key, wearer, cut, name, kind, version, source, sizes, landmark_overrides,
     derived, warnings, questions, size_map, programme_note, set_dxf_file_id, created_by)
  values
    (p_brand_id, p_product_key, p_wearer, p_cut, btrim(p_name), p_kind, v_version, p_source, p_sizes,
     coalesce(p_overrides, '{}'::jsonb), coalesce(p_derived, '{}'), coalesce(p_warnings, '{}'),
     coalesce(p_questions, '{}'), p_size_map, p_programme_note, p_set_file, p_user_id)
  returning id into v_id;

  insert into public.pattern_block_sizes
    (brand_id, block_id, size_label, position, pieces, measurements, skipped, checks, dxf_file_id)
  select p_brand_id, v_id, r ->> 'size', (r ->> 'position')::integer, r -> 'pieces', r -> 'measurements',
         coalesce(r -> 'skipped', '[]'::jsonb), coalesce(r -> 'checks', '[]'::jsonb), nullif(r ->> 'dxfFileId', '')::uuid
  from jsonb_array_elements(p_size_rows) as r;

  return query select v_id, v_version;
end;
$$;

-- Records a named person's review of one block version.
create function public.review_pattern_block(
  p_brand_id uuid,
  p_user_id uuid,
  p_block_id uuid,
  p_name text,
  p_role text,
  p_note text,
  p_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.pattern_blocks b where b.id = p_block_id and b.brand_id = p_brand_id) then
    raise exception 'That pattern does not exist.' using errcode = 'P0002';
  end if;
  insert into public.pattern_reviews (brand_id, block_id, reviewer_name, reviewer_role, note, reviewed_on, created_by)
  values (p_brand_id, p_block_id, btrim(p_name), btrim(coalesce(nullif(btrim(p_role), ''), 'technician')), coalesce(p_note, ''), p_on, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_pattern_block(uuid, uuid, text, text, text, text, text, text, text[], jsonb, text[], text[], text[], jsonb, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_pattern_block(uuid, uuid, text, text, text, text, text, text, text[], jsonb, text[], text[], text[], jsonb, text, uuid, jsonb)
  to service_role;
revoke all on function public.review_pattern_block(uuid, uuid, uuid, text, text, text, date)
  from public, anon, authenticated;
grant execute on function public.review_pattern_block(uuid, uuid, uuid, text, text, text, date) to service_role;
revoke all on function private.refuse_pattern_library_change() from public, anon, authenticated;
