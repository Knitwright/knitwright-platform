-- Base fabrics, fabric tests and size label maps (plans/production-outputs.md, workstream W2).
--
-- A brand keeps a library of base fabrics. A fabric holds what its supplier's sheet states; every
-- number a person measured lives in a fabric test, a record of who ran it, when, how and what it
-- found. A test is never changed, so a release can name the test it used. Size label maps say which
-- pattern size each size label is cut from.
--
-- Members read their own brand's rows. Only the server writes: there is no write grant and no write
-- policy for any browser role, as with pattern_jobs. No row refers to another workstream's tables.

create table public.base_fabrics (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  composition text not null default '' check (length(composition) <= 200),
  construction text not null default '' check (length(construction) <= 120),
  notes text not null default '' check (length(notes) <= 500),
  -- What the supplier's sheet states, as a FabricProfile (lib/production/contract/fabric.ts).
  -- Tested numbers are not stored here; they come from fabric_tests.
  profile jsonb not null check (jsonb_typeof(profile) = 'object' and pg_column_size(profile) < 4096),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id)
);

comment on table public.base_fabrics is
  'A brand''s base fabrics and what their supplier sheets state. Written by the server only.';

create unique index base_fabrics_name_idx on public.base_fabrics (brand_id, lower(btrim(name)));

create table public.fabric_tests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  fabric_id uuid not null,
  tested_by text not null check (length(btrim(tested_by)) between 1 and 80),
  tested_on date not null,
  method text not null check (length(btrim(method)) between 1 and 300),
  -- The load the fabric was stretched at, in newtons. Stretch results need it.
  load_newtons numeric check (load_newtons is null or load_newtons between 0.1 and 500),
  stretch_length_pct numeric check (stretch_length_pct is null or stretch_length_pct between 0 and 100),
  stretch_width_pct numeric check (stretch_width_pct is null or stretch_width_pct between 0 and 100),
  recovery_pct numeric check (recovery_pct is null or recovery_pct between 0 and 100),
  -- Shrink after pressing, and the temperature and time it was pressed at. Shrink results need both.
  shrink_length_pct numeric check (shrink_length_pct is null or shrink_length_pct between 0 and 30),
  shrink_width_pct numeric check (shrink_width_pct is null or shrink_width_pct between 0 and 30),
  press_temp_c numeric check (press_temp_c is null or press_temp_c between 20 and 250),
  press_seconds numeric check (press_seconds is null or press_seconds between 1 and 3600),
  -- The stretch reduction the technician found right for this fabric, when the test gave one.
  reduction_pct numeric check (reduction_pct is null or reduction_pct between 0 and 30),
  -- Photos of the test, as file ids. The server checks they belong to the brand.
  photo_file_ids uuid[] not null default '{}' check (cardinality(photo_file_ids) <= 6),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (fabric_id, brand_id) references public.base_fabrics (id, brand_id) on delete cascade,
  constraint fabric_tests_has_result check (
    stretch_length_pct is not null or stretch_width_pct is not null or recovery_pct is not null
    or shrink_length_pct is not null or shrink_width_pct is not null or reduction_pct is not null
  ),
  constraint fabric_tests_stretch_has_load check (
    (stretch_length_pct is null and stretch_width_pct is null and recovery_pct is null) or load_newtons is not null
  ),
  constraint fabric_tests_shrink_has_press check (
    (shrink_length_pct is null and shrink_width_pct is null) or (press_temp_c is not null and press_seconds is not null)
  )
);

comment on table public.fabric_tests is
  'Named fabric test records. Written by the server only, and never changed.';

create index fabric_tests_fabric_idx on public.fabric_tests (brand_id, fabric_id, tested_on desc);

create table public.size_label_maps (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 16),
  wearer text not null check (wearer in ('men', 'women', 'youth')),
  cut text not null check (cut in ('mens', 'womens', 'junior', 'unisex')),
  pattern_size text not null check (length(btrim(pattern_size)) between 1 and 16),
  -- The shipped default map is not stored: it is "suggested" and lives in code. A row here is a
  -- brand's own choice.
  source text not null check (source in ('brand-supplied', 'user-edited')),
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique (brand_id, wearer, cut, label)
);

comment on table public.size_label_maps is
  'Which pattern size each size label is cut from, where a brand has chosen. Written by the server only.';

revoke all on public.base_fabrics, public.fabric_tests, public.size_label_maps from public, anon, authenticated;
grant select on public.base_fabrics, public.fabric_tests, public.size_label_maps to authenticated;
-- A test is a record: the server can add one, never change it. Deleting a fabric removes its tests
-- through the foreign key.
grant select, insert, update on public.base_fabrics to service_role;
grant select, insert on public.fabric_tests to service_role;
grant select, insert, update, delete on public.size_label_maps to service_role;

alter table public.base_fabrics enable row level security;
alter table public.fabric_tests enable row level security;
alter table public.size_label_maps enable row level security;

create policy "members read their brand's base fabrics"
  on public.base_fabrics for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's fabric tests"
  on public.fabric_tests for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's size label maps"
  on public.size_label_maps for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.
