-- Golden samples and the make flow (plans/platform-v5.md Y7, F-S7; decision 0080).
--
-- A golden sample is the evidence that one made garment is the one to copy: the photos of it, the points
-- of measure a tape read on it, the colour readings taken off it, and the founder's own sign-off with the
-- date. A run may be made only when a golden sample of that design version has been signed off, or when
-- one of a parent version has and the two versions differ only on the surface.
--
-- It is built on what already exists and changes none of it:
--   * brand_products, brand_runs and submit_brand_run (decision 0062), which hold the sample the golden
--     sample came from and are the only code that calls public.submit_order_for_production (decision 0043);
--   * base_articles (decision 0066), for the production class that sets the 50 to 300 range of a Class B run.
--
-- Nothing here takes money (owner decision 1): there is no price, no payment and no value column. Prices and
-- dates are read from the factory rows (decision 0071) and shown; the hand-off is the existing contract.
--
-- Every table is brand-scoped with row level security on. Members read their own brand's rows; nobody writes
-- directly, not even the server's own key. Each write is a SECURITY DEFINER function only service_role may
-- run, which checks the caller's role itself (the club rule can_manage_kit, as the brand runs do).
--
-- The three evidence tables are append-only, and nothing may be added to a golden sample that has been
-- signed off: a measured point of measure or a colour reading recorded against a sign-off is evidence, and
-- evidence that can be edited afterwards is not evidence.

create table public.golden_samples (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  product_id uuid not null,
  -- The sample run this garment came out of. A golden sample is always a sample somebody ordered.
  run_id uuid not null,
  -- The saved version of the design the sample was cut from, read from the run's release.
  design_version integer not null check (design_version >= 1),
  factory_profile_id text not null check (length(btrim(factory_profile_id)) between 1 and 120),
  -- The attempt: 1, then 2 after changes were asked for, and so on.
  version integer not null check (version >= 1),
  state text not null default 'draft' check (state in ('draft', 'approved', 'changes_requested')),
  -- The founder's own marks out of 5. Both are needed to sign off.
  fit_rating smallint check (fit_rating between 1 and 5),
  colour_rating smallint check (colour_rating between 1 and 5),
  notes text not null default '' check (length(notes) <= 2000),
  -- Who signed it off. The account may be removed later; the date stays.
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (brand_id, product_id, version),
  foreign key (product_id, brand_id) references public.brand_products (id, brand_id) on delete cascade,
  foreign key (run_id, brand_id) references public.brand_runs (id, brand_id) on delete cascade,
  -- A sign-off always carries the date and both marks; nothing else carries a date.
  constraint golden_samples_signed_off_is_complete
    check ((state = 'approved') = (approved_at is not null and fit_rating is not null and colour_rating is not null)),
  constraint golden_samples_closed_when_changes_asked
    check ((state = 'changes_requested') = (closed_at is not null))
);

comment on table public.golden_samples is
  'The golden sample of a product: the version it was cut from, the founder''s marks and the sign-off. Written by the server only.';

create index golden_samples_product_idx on public.golden_samples (brand_id, product_id, version desc);
create index golden_samples_version_idx on public.golden_samples (brand_id, product_id, design_version) where state = 'approved';
-- One golden sample is being judged at a time: a second needs the first signed off or closed.
create unique index golden_samples_one_open on public.golden_samples (brand_id, product_id) where state = 'draft';

create table public.golden_sample_photos (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  golden_sample_id uuid not null,
  -- A picture the brand already holds (public.files), checked by the function that adds it. Not a key:
  -- removing the picture later must not force a change to an evidence row the triggers below forbid.
  file_id uuid not null,
  angle text not null check (angle in ('front', 'back', 'left', 'right', 'detail', 'label')),
  caption text not null default '' check (length(caption) <= 200),
  -- The account that added it. Not a key, for the same reason as on the measurements.
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (golden_sample_id, file_id),
  foreign key (golden_sample_id, brand_id) references public.golden_samples (id, brand_id) on delete cascade
);

comment on table public.golden_sample_photos is
  'The photos of a golden sample. Append-only. Written by add_golden_sample_photo only.';

create index golden_sample_photos_sample_idx on public.golden_sample_photos (golden_sample_id, created_at, id);

create table public.golden_sample_poms (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  golden_sample_id uuid not null,
  size_label text not null check (length(btrim(size_label)) between 1 and 16),
  -- The point of measure as the base article letters it (decision 0066).
  letter text not null check (letter ~ '^[A-Z]{1,2}$'),
  code text not null check (length(btrim(code)) between 1 and 64),
  description text not null default '' check (length(description) <= 200),
  -- Whole millimetres, as a tape reads them on the finished garment (owner decision 8).
  measured_mm integer not null check (measured_mm between 0 and 100000),
  -- What it was judged against. Null where the base article has no value or no tolerance yet:
  -- a missing tolerance is a question for the factory, never a guess (owner decision 18).
  target_mm integer check (target_mm between 0 and 100000),
  tol_minus_mm integer check (tol_minus_mm between 0 and 1000),
  tol_plus_mm integer check (tol_plus_mm between 0 and 1000),
  rule_id text not null check (rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  -- The account that recorded it. Not a key: an evidence row is never rewritten, not even to empty this.
  measured_by uuid,
  created_at timestamptz not null default now(),
  foreign key (golden_sample_id, brand_id) references public.golden_samples (id, brand_id) on delete cascade
);

comment on table public.golden_sample_poms is
  'A point of measure a tape read on the golden sample, with what it was judged against. Append-only. Written by add_golden_sample_pom only.';

create index golden_sample_poms_sample_idx on public.golden_sample_poms (golden_sample_id, size_label, letter);

create table public.golden_sample_colour_readings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  golden_sample_id uuid not null,
  colour_name text not null check (length(btrim(colour_name)) between 1 and 60),
  target_hex text check (target_hex ~ '^#[0-9A-F]{6}$'),
  -- The two Lab values the reading was computed from, so the number can be checked later. Exact decimals,
  -- never floats.
  target_l numeric(6, 2),
  target_a numeric(6, 2),
  target_b numeric(6, 2),
  measured_l numeric(6, 2),
  measured_a numeric(6, 2),
  measured_b numeric(6, 2),
  delta_e numeric(6, 3) not null check (delta_e >= 0 and delta_e <= 200),
  -- Who or what measured it, and in what space. Null means nobody stated it: it is not filled in for them
  -- (owner decision 15 keeps the white point an open question for the colour house).
  instrument text check (length(btrim(instrument)) between 1 and 120),
  white_point text check (length(btrim(white_point)) between 1 and 40),
  observer text check (length(btrim(observer)) between 1 and 40),
  rule_id text not null check (rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  -- The account that recorded it. Not a key, for the same reason as on the points of measure.
  measured_by uuid,
  created_at timestamptz not null default now(),
  foreign key (golden_sample_id, brand_id) references public.golden_samples (id, brand_id) on delete cascade
);

comment on table public.golden_sample_colour_readings is
  'A Delta-E reading taken off the golden sample, with the values it came from. Append-only. Written by add_golden_sample_colour_reading only.';

create index golden_sample_colour_readings_sample_idx on public.golden_sample_colour_readings (golden_sample_id, colour_name);

create table public.golden_sample_carryovers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  golden_sample_id uuid not null,
  from_version integer not null check (from_version >= 1),
  to_version integer not null check (to_version >= 1),
  -- [{ "field": "artwork", "group": "surface" }]: why the sign-off may be carried forward. Every entry
  -- must be labelled surface, or the function refuses it.
  changed_fields jsonb not null check (jsonb_typeof(changed_fields) = 'array' and jsonb_array_length(changed_fields) between 1 and 64),
  rule_id text not null check (rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  -- The account that carried it over. Not a key, for the same reason as on the measurements.
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (brand_id, golden_sample_id, to_version),
  foreign key (golden_sample_id, brand_id) references public.golden_samples (id, brand_id) on delete cascade,
  constraint golden_sample_carryovers_go_forward check (to_version > from_version)
);

comment on table public.golden_sample_carryovers is
  'A sign-off carried forward to a later version that differs only on the surface, with the fields that changed. Append-only. Written by carry_over_golden_sample only.';

-- Evidence can never be changed or removed. The delete is let through only when the golden sample itself is
-- gone (its product, its design or its brand was deleted).
create function private.refuse_golden_sample_evidence_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.golden_samples g where g.id = old.golden_sample_id) then
    return old;
  end if;
  raise exception 'What was measured on a golden sample can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_golden_sample_evidence_change() from public, anon, authenticated;

create trigger golden_sample_photos_are_append_only
  before update or delete on public.golden_sample_photos
  for each row execute function private.refuse_golden_sample_evidence_change();
create trigger golden_sample_photos_are_not_truncated
  before truncate on public.golden_sample_photos
  for each statement execute function private.refuse_golden_sample_evidence_change();
create trigger golden_sample_poms_are_append_only
  before update or delete on public.golden_sample_poms
  for each row execute function private.refuse_golden_sample_evidence_change();
create trigger golden_sample_poms_are_not_truncated
  before truncate on public.golden_sample_poms
  for each statement execute function private.refuse_golden_sample_evidence_change();
create trigger golden_sample_colour_readings_are_append_only
  before update or delete on public.golden_sample_colour_readings
  for each row execute function private.refuse_golden_sample_evidence_change();
create trigger golden_sample_colour_readings_are_not_truncated
  before truncate on public.golden_sample_colour_readings
  for each statement execute function private.refuse_golden_sample_evidence_change();
create trigger golden_sample_carryovers_are_append_only
  before update or delete on public.golden_sample_carryovers
  for each row execute function private.refuse_golden_sample_evidence_change();
create trigger golden_sample_carryovers_are_not_truncated
  before truncate on public.golden_sample_carryovers
  for each statement execute function private.refuse_golden_sample_evidence_change();

revoke all on public.golden_samples, public.golden_sample_photos, public.golden_sample_poms,
  public.golden_sample_colour_readings, public.golden_sample_carryovers
  from public, anon, authenticated, service_role;
grant select on public.golden_samples, public.golden_sample_photos, public.golden_sample_poms,
  public.golden_sample_colour_readings, public.golden_sample_carryovers
  to authenticated, service_role;

alter table public.golden_samples enable row level security;
alter table public.golden_sample_photos enable row level security;
alter table public.golden_sample_poms enable row level security;
alter table public.golden_sample_colour_readings enable row level security;
alter table public.golden_sample_carryovers enable row level security;

create policy "members read their brand's golden samples"
  on public.golden_samples for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's golden sample photos"
  on public.golden_sample_photos for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's measured points of measure"
  on public.golden_sample_poms for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's colour readings"
  on public.golden_sample_colour_readings for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's carried-over sign-offs"
  on public.golden_sample_carryovers for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on any of these, on purpose.

-- The most golden samples one product takes, and the most pieces of evidence one golden sample takes.
create function private.golden_sample_limits()
returns table (attempts integer, photos integer, measurements integer)
language sql
immutable
set search_path = ''
as $$ select 20, 40, 400 $$;

revoke all on function private.golden_sample_limits() from public, anon, authenticated;

-- The golden sample a run of a design version may be made on: one signed off for that very version, or one
-- of an earlier version carried forward because the two differ only on the surface. Null when there is none.
create function private.golden_sample_for_version(p_brand_id uuid, p_product_id uuid, p_version integer)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id
  from public.golden_samples g
  where g.brand_id = p_brand_id
    and g.product_id = p_product_id
    and g.state = 'approved'
    and (
      g.design_version = p_version
      or exists (
        select 1 from public.golden_sample_carryovers c
        where c.golden_sample_id = g.id and c.brand_id = p_brand_id and c.to_version = p_version
      )
    )
  order by (g.design_version = p_version) desc, g.design_version desc, g.approved_at desc
  limit 1;
$$;

revoke all on function private.golden_sample_for_version(uuid, uuid, integer) from public, anon, authenticated;

-- Starts judging the garment a sample run produced. Returns the golden sample id.
create function public.start_golden_sample(p_brand_id uuid, p_user_id uuid, p_product_id uuid, p_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.brand_runs;
  v_version integer;
  v_next integer;
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not judge samples for this brand.' using errcode = '42501';
  end if;
  select r.* into v_run from public.brand_runs r
  where r.id = p_run_id and r.brand_id = p_brand_id and r.product_id = p_product_id;
  if not found then
    raise exception 'That sample does not exist.' using errcode = 'P0002', hint = 'run_not_found';
  end if;
  if v_run.kind <> 'sample' then
    raise exception 'A golden sample is judged from a sample, not from a run.' using errcode = 'P0001', hint = 'not_a_sample';
  end if;
  select (rel.snapshot ->> 'specVersion')::integer into v_version
  from public.production_releases rel where rel.id = v_run.release_id and rel.brand_id = p_brand_id;
  if v_version is null then
    raise exception 'That sample''s release does not say which design version it froze.'
      using errcode = 'P0001', hint = 'version_unknown';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('golden_samples:' || p_product_id::text, 0));
  select coalesce(max(g.version), 0) + 1 into v_next
  from public.golden_samples g where g.brand_id = p_brand_id and g.product_id = p_product_id;
  if v_next > (select attempts from private.golden_sample_limits()) then
    raise exception 'This product has had as many golden samples as it may.' using errcode = 'P0001', hint = 'too_many_attempts';
  end if;

  insert into public.golden_samples (brand_id, product_id, run_id, design_version, factory_profile_id, version, created_by)
  values (p_brand_id, p_product_id, p_run_id, v_version, v_run.factory_profile_id, v_next, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- The golden sample a piece of evidence may be added to: it must be the brand's and still being judged.
create function private.golden_sample_open(p_brand_id uuid, p_user_id uuid, p_golden_sample_id uuid)
returns public.golden_samples
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sample public.golden_samples;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not judge samples for this brand.' using errcode = '42501';
  end if;
  select g.* into v_sample from public.golden_samples g
  where g.id = p_golden_sample_id and g.brand_id = p_brand_id for update;
  if not found then
    raise exception 'That golden sample does not exist.' using errcode = 'P0002', hint = 'golden_sample_not_found';
  end if;
  if v_sample.state <> 'draft' then
    raise exception 'This golden sample is settled: what was measured on it can no longer be added to.'
      using errcode = 'P0001', hint = 'golden_sample_settled';
  end if;
  return v_sample;
end;
$$;

revoke all on function private.golden_sample_open(uuid, uuid, uuid) from public, anon, authenticated;

create function public.add_golden_sample_photo(
  p_brand_id uuid, p_user_id uuid, p_golden_sample_id uuid, p_file_id uuid, p_angle text, p_caption text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sample public.golden_samples := private.golden_sample_open(p_brand_id, p_user_id, p_golden_sample_id);
  v_id uuid;
begin
  if not exists (select 1 from public.files f where f.id = p_file_id and f.brand_id = p_brand_id) then
    raise exception 'That picture does not exist.' using errcode = 'P0002', hint = 'file_not_found';
  end if;
  if (select count(*) from public.golden_sample_photos p where p.golden_sample_id = v_sample.id)
     >= (select photos from private.golden_sample_limits()) then
    raise exception 'This golden sample holds as many photos as it may.' using errcode = 'P0001', hint = 'too_many_photos';
  end if;
  insert into public.golden_sample_photos (brand_id, golden_sample_id, file_id, angle, caption, created_by)
  values (p_brand_id, v_sample.id, p_file_id, p_angle, coalesce(btrim(p_caption), ''), p_user_id)
  returning id into v_id;
  update public.golden_samples set updated_at = now() where id = v_sample.id;
  return v_id;
end;
$$;

create function public.add_golden_sample_pom(
  p_brand_id uuid, p_user_id uuid, p_golden_sample_id uuid, p_size_label text, p_letter text, p_code text,
  p_measured_mm integer, p_description text default '', p_target_mm integer default null,
  p_tol_minus_mm integer default null, p_tol_plus_mm integer default null, p_rule_id text default 'R-GAP-000'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sample public.golden_samples := private.golden_sample_open(p_brand_id, p_user_id, p_golden_sample_id);
  v_id uuid;
begin
  if (select count(*) from public.golden_sample_poms m where m.golden_sample_id = v_sample.id)
     >= (select measurements from private.golden_sample_limits()) then
    raise exception 'This golden sample holds as many measurements as it may.' using errcode = 'P0001', hint = 'too_many_measurements';
  end if;
  insert into public.golden_sample_poms (
    brand_id, golden_sample_id, size_label, letter, code, description, measured_mm,
    target_mm, tol_minus_mm, tol_plus_mm, rule_id, measured_by
  ) values (
    p_brand_id, v_sample.id, btrim(p_size_label), upper(btrim(p_letter)), btrim(p_code), coalesce(btrim(p_description), ''),
    p_measured_mm, p_target_mm, p_tol_minus_mm, p_tol_plus_mm, p_rule_id, p_user_id
  ) returning id into v_id;
  update public.golden_samples set updated_at = now() where id = v_sample.id;
  return v_id;
end;
$$;

create function public.add_golden_sample_colour_reading(
  p_brand_id uuid, p_user_id uuid, p_golden_sample_id uuid, p_colour_name text, p_delta_e numeric,
  p_target_hex text default null, p_target_lab numeric[] default null, p_measured_lab numeric[] default null,
  p_instrument text default null, p_white_point text default null, p_observer text default null,
  p_rule_id text default 'R-GAP-000'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sample public.golden_samples := private.golden_sample_open(p_brand_id, p_user_id, p_golden_sample_id);
  v_id uuid;
begin
  if p_delta_e is null then
    raise exception 'A colour reading is a Delta-E number.' using errcode = '22023', hint = 'invalid_reading';
  end if;
  if p_target_lab is not null and cardinality(p_target_lab) <> 3 then
    raise exception 'A Lab value is three numbers.' using errcode = '22023', hint = 'invalid_lab';
  end if;
  if p_measured_lab is not null and cardinality(p_measured_lab) <> 3 then
    raise exception 'A Lab value is three numbers.' using errcode = '22023', hint = 'invalid_lab';
  end if;
  if (select count(*) from public.golden_sample_colour_readings c where c.golden_sample_id = v_sample.id)
     >= (select measurements from private.golden_sample_limits()) then
    raise exception 'This golden sample holds as many readings as it may.' using errcode = 'P0001', hint = 'too_many_measurements';
  end if;
  insert into public.golden_sample_colour_readings (
    brand_id, golden_sample_id, colour_name, target_hex,
    target_l, target_a, target_b, measured_l, measured_a, measured_b,
    delta_e, instrument, white_point, observer, rule_id, measured_by
  ) values (
    p_brand_id, v_sample.id, btrim(p_colour_name), upper(nullif(btrim(p_target_hex), '')),
    p_target_lab[1], p_target_lab[2], p_target_lab[3], p_measured_lab[1], p_measured_lab[2], p_measured_lab[3],
    p_delta_e, nullif(btrim(p_instrument), ''), nullif(btrim(p_white_point), ''), nullif(btrim(p_observer), ''),
    p_rule_id, p_user_id
  ) returning id into v_id;
  update public.golden_samples set updated_at = now() where id = v_sample.id;
  return v_id;
end;
$$;

-- The founder's sign-off: both marks, the date and who. It needs a photo and at least one measurement on
-- file, because a sign-off with no evidence behind it is only an opinion. Signing off also moves the product
-- on to the run stage (decision 0062's stages), which is what makes a run possible at all.
create function public.sign_off_golden_sample(
  p_brand_id uuid, p_user_id uuid, p_golden_sample_id uuid, p_fit_rating integer, p_colour_rating integer, p_notes text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sample public.golden_samples := private.golden_sample_open(p_brand_id, p_user_id, p_golden_sample_id);
  v_stage text;
begin
  if p_fit_rating is null or p_colour_rating is null
     or p_fit_rating not between 1 and 5 or p_colour_rating not between 1 and 5 then
    raise exception 'Rate the fit and the colour from 1 to 5.' using errcode = '22023', hint = 'invalid_rating';
  end if;
  if not exists (select 1 from public.golden_sample_photos p where p.golden_sample_id = v_sample.id) then
    raise exception 'Add a photo of the sample first.' using errcode = 'P0001', hint = 'needs_photo';
  end if;
  if not exists (select 1 from public.golden_sample_poms m where m.golden_sample_id = v_sample.id) then
    raise exception 'Record what the tape read on the sample first.' using errcode = 'P0001', hint = 'needs_measurement';
  end if;

  update public.golden_samples
  set state = 'approved', fit_rating = p_fit_rating, colour_rating = p_colour_rating,
      notes = coalesce(btrim(p_notes), ''), approved_by = p_user_id, approved_at = now(), updated_at = now()
  where id = v_sample.id;

  select p.stage into v_stage from public.brand_products p where p.id = v_sample.product_id;
  if v_stage = 'idea' then
    perform public.confirm_brand_product_stage(p_brand_id, p_user_id, v_sample.product_id, 'sample');
    v_stage := 'sample';
  end if;
  if v_stage = 'sample' then
    perform public.confirm_brand_product_stage(p_brand_id, p_user_id, v_sample.product_id, 'run');
  end if;
  return 'approved';
end;
$$;

-- The founder asks for changes instead: the golden sample is closed with the reason, and the next draft of
-- the design is judged on its own golden sample.
create function public.request_golden_sample_changes(p_brand_id uuid, p_user_id uuid, p_golden_sample_id uuid, p_notes text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sample public.golden_samples := private.golden_sample_open(p_brand_id, p_user_id, p_golden_sample_id);
begin
  if p_notes is null or length(btrim(p_notes)) = 0 then
    raise exception 'Say what has to change.' using errcode = '22023', hint = 'needs_notes';
  end if;
  update public.golden_samples
  set state = 'changes_requested', notes = btrim(p_notes), closed_at = now(), updated_at = now()
  where id = v_sample.id;
  return 'changes_requested';
end;
$$;

-- Carries a sign-off forward to a later version that differs only on the surface. The server works the
-- fields out (lib/make/surface.ts) and sends them with their groups; anything not labelled surface is
-- refused here, so the database and not the browser is what allows the run.
create function public.carry_over_golden_sample(
  p_brand_id uuid, p_user_id uuid, p_golden_sample_id uuid, p_to_version integer, p_changed_fields jsonb, p_rule_id text default 'R-GAP-000'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sample public.golden_samples;
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not judge samples for this brand.' using errcode = '42501';
  end if;
  select g.* into v_sample from public.golden_samples g
  where g.id = p_golden_sample_id and g.brand_id = p_brand_id;
  if not found then
    raise exception 'That golden sample does not exist.' using errcode = 'P0002', hint = 'golden_sample_not_found';
  end if;
  if v_sample.state <> 'approved' then
    raise exception 'Only a golden sample that has been signed off can cover another version.'
      using errcode = 'P0001', hint = 'not_signed_off';
  end if;
  if p_changed_fields is null or jsonb_typeof(p_changed_fields) <> 'array' or jsonb_array_length(p_changed_fields) = 0 then
    raise exception 'Say which fields changed.' using errcode = '22023', hint = 'invalid_fields';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_changed_fields) as f
    where f.value ->> 'group' is distinct from 'surface'
       or coalesce(length(btrim(f.value ->> 'field')), 0) = 0
  ) then
    raise exception 'A sign-off is carried forward only where every change is on the surface.'
      using errcode = 'P0001', hint = 'not_surface_only';
  end if;

  -- Carrying the same sign-off forward twice is the same fact: the row already there is the answer.
  insert into public.golden_sample_carryovers (brand_id, golden_sample_id, from_version, to_version, changed_fields, rule_id, created_by)
  values (p_brand_id, p_golden_sample_id, v_sample.design_version, p_to_version, p_changed_fields, p_rule_id, p_user_id)
  on conflict (brand_id, golden_sample_id, to_version) do nothing
  returning id into v_id;
  if v_id is null then
    select c.id into v_id from public.golden_sample_carryovers c
    where c.brand_id = p_brand_id and c.golden_sample_id = p_golden_sample_id and c.to_version = p_to_version;
  end if;
  return v_id;
end;
$$;

-- The make flow's one door into production. It adds F-S7's three rules to the brand run contract and then
-- uses that contract, unchanged:
--   * a sample is at most three sizes (submit_brand_run already holds it to one piece of each);
--   * a run needs a golden sample signed off for the version being made, or one carried forward;
--   * a Class B run is 50 to 300 pieces per style, where the base article says which class the design is.
-- Everything else -- the role, the stage, the release, the sizes, the order -- is the brand run function's.
create function public.submit_make_order(
  p_brand_id uuid, p_user_id uuid, p_product_id uuid, p_kind text, p_release_id uuid,
  p_factory_profile_id text, p_fabric_key text, p_sizes jsonb, p_flags jsonb, p_request_key text
)
returns table (run_id uuid, order_id uuid, status text, cutoff_at timestamptz, promised_on date, created boolean, golden_sample_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.brand_products;
  v_version integer;
  v_class text;
  v_pieces integer;
  v_golden uuid;
  v_sent record;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not order for this brand.' using errcode = '42501';
  end if;
  if p_kind not in ('sample', 'run') then
    raise exception 'An order is a sample or a run.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if p_sizes is null or jsonb_typeof(p_sizes) <> 'object' then
    raise exception 'Sizes must be an object of size labels.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  if (select count(*) from jsonb_object_keys(p_sizes)) = 0 then
    raise exception 'Sizes must be an object of size labels.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  select * into v_product from public.brand_products x where x.id = p_product_id and x.brand_id = p_brand_id;
  if not found then
    raise exception 'That product does not exist.' using errcode = 'P0002';
  end if;

  if p_kind = 'sample' and (select count(*) from jsonb_object_keys(p_sizes)) > 3 then
    raise exception 'A sample is at most 3 sizes, one piece of each.' using errcode = 'P0001', hint = 'sample_sizes';
  end if;

  if p_kind = 'run' then
    select (rel.snapshot ->> 'specVersion')::integer into v_version
    from public.production_releases rel
    where rel.id = p_release_id and rel.brand_id = p_brand_id and rel.project_id = v_product.project_id;
    if v_version is null then
      raise exception 'That release does not exist.' using errcode = 'P0002', hint = 'release_not_found';
    end if;
    v_golden := private.golden_sample_for_version(p_brand_id, p_product_id, v_version);
    if v_golden is null then
      raise exception 'A run needs a golden sample signed off for version %, or for a parent version that differs only on the surface.', v_version
        using errcode = 'P0001', hint = 'golden_sample_required';
    end if;

    select a.production_class into v_class
    from public.projects p
    join public.base_articles a on a.registry_type_id = p.garment_type
    where p.id = v_product.project_id and p.brand_id = p_brand_id;
    if v_class = 'B' then
      select coalesce(sum((e.value #>> '{}')::integer), 0) into v_pieces
      from jsonb_each(p_sizes) as e
      where jsonb_typeof(e.value) = 'number' and (e.value #>> '{}') ~ '^[0-9]+$';
      if v_pieces < 50 or v_pieces > 300 then
        raise exception 'A Class B run is 50 to 300 pieces per style. This one is % pieces.', v_pieces
          using errcode = 'P0001', hint = 'class_b_quantity';
      end if;
    end if;
  end if;

  select * into v_sent from public.submit_brand_run(
    p_brand_id, p_user_id, p_product_id, p_kind, p_release_id,
    p_factory_profile_id, p_fabric_key, p_sizes, p_flags, p_request_key
  ) s;
  return query select v_sent.run_id, v_sent.order_id, v_sent.status, v_sent.cutoff_at, v_sent.promised_on, v_sent.created, v_golden;
end;
$$;

revoke all on function public.start_golden_sample(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.add_golden_sample_photo(uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.add_golden_sample_pom(uuid, uuid, uuid, text, text, text, integer, text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.add_golden_sample_colour_reading(uuid, uuid, uuid, text, numeric, text, numeric[], numeric[], text, text, text, text) from public, anon, authenticated;
revoke all on function public.sign_off_golden_sample(uuid, uuid, uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function public.request_golden_sample_changes(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.carry_over_golden_sample(uuid, uuid, uuid, integer, jsonb, text) from public, anon, authenticated;
revoke all on function public.submit_make_order(uuid, uuid, uuid, text, uuid, text, text, jsonb, jsonb, text) from public, anon, authenticated;

grant execute on function public.start_golden_sample(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.add_golden_sample_photo(uuid, uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.add_golden_sample_pom(uuid, uuid, uuid, text, text, text, integer, text, integer, integer, integer, text) to service_role;
grant execute on function public.add_golden_sample_colour_reading(uuid, uuid, uuid, text, numeric, text, numeric[], numeric[], text, text, text, text) to service_role;
grant execute on function public.sign_off_golden_sample(uuid, uuid, uuid, integer, integer, text) to service_role;
grant execute on function public.request_golden_sample_changes(uuid, uuid, uuid, text) to service_role;
grant execute on function public.carry_over_golden_sample(uuid, uuid, uuid, integer, jsonb, text) to service_role;
grant execute on function public.submit_make_order(uuid, uuid, uuid, text, uuid, text, text, jsonb, jsonb, text) to service_role;
