-- Brand Studio, manual entry (spec F-S9 without the URL import; plan v5 Y6; decision 0079).
--
-- A brand (a workspace) gains a brand record: details and visual style, named palettes, fonts by
-- role, the pictures it uses, and the Sportswear set (crest, sponsors, label artwork, packaging).
-- Everything is brand-scoped with row level security on, readable by the brand's members and
-- written by nobody directly: each write goes through a function only the server's own key may run,
-- and each function checks the caller's role itself with private.can_manage_kit (decision 0042).
--
-- THE CLUB KIT IS NOT MIGRATED AND NOT COPIED. public.club_kits stays exactly as it is and stays
-- the one place that holds a club's colours, crest and sponsors: /club writes it, lib/clubs reads
-- it, and lib/deletion erases it. Brand Studio READS IT THROUGH every time
-- (apps/web/lib/brand-studio/club-kit.ts) and shows what it finds as a palette and as Sportswear
-- pictures it does not own. Copying those values here would leave two rows meaning the same thing,
-- which drift the moment one is edited. Nothing can be lost, because nothing moved.
--
-- NO INVENTED LICENCE. brand_studio_fonts is the licensed kit-font list. A font may be chosen only
-- when the repository can show its licence; the check constraint on the table enforces exactly that.
-- The only fonts whose licence is on file are the two bundled Geist faces (SIL Open Font License
-- 1.1, node_modules/geist/LICENSE.txt). The rest are labelled placeholders that cannot be chosen,
-- and the owner question is on the Y6 pull request.
--
-- NO PANTONE DATA SHIPS (open item P6). pantone_tcx is whatever the brand typed, or null. Nothing
-- here ever works a Pantone code out from a screen colour.

-- ---------------------------------------------------------------------------------------------
-- The licensed kit-font list. Platform data: every signed-in person reads it, nobody writes it.

create table public.brand_studio_fonts (
  key text primary key check (key ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and length(key) <= 40),
  label text not null check (length(btrim(label)) between 1 and 80),
  -- The CSS family, when there is one. Empty for a placeholder: no file is bundled for it.
  family text not null check (length(family) <= 120),
  licence text not null check (licence in ('bundled', 'not_established')),
  -- Word for word, what the repository can show. Shown beside the font.
  licence_note text not null check (length(btrim(licence_note)) between 1 and 400),
  -- A font may be offered only when its licence is on file. This is the rule, in the database.
  selectable boolean not null,
  position integer not null check (position >= 1),
  check (selectable = (licence = 'bundled'))
);

comment on table public.brand_studio_fonts is
  'The kit-font list of Brand Studio. A font is selectable only when its licence is in the repository.';

insert into public.brand_studio_fonts (key, label, family, licence, licence_note, selectable, position) values
  ('geist', 'Geist Sans', 'var(--font-sans)', 'bundled',
   'SIL Open Font License 1.1. The licence file is in this repository, at node_modules/geist/LICENSE.txt.', true, 1),
  ('geist-mono', 'Geist Mono', 'var(--font-mono)', 'bundled',
   'SIL Open Font License 1.1. The licence file is in this repository, at node_modules/geist/LICENSE.txt.', true, 2),
  ('placeholder-block', 'Placeholder: wide block sans', '', 'not_established',
   'Placeholder, not reviewed by anyone. No licence for a font of this kind is on file, so it cannot be chosen yet.', false, 3),
  ('placeholder-condensed', 'Placeholder: condensed sans', '', 'not_established',
   'Placeholder, not reviewed by anyone. No licence for a font of this kind is on file, so it cannot be chosen yet.', false, 4),
  ('placeholder-serif', 'Placeholder: editorial serif', '', 'not_established',
   'Placeholder, not reviewed by anyone. No licence for a font of this kind is on file, so it cannot be chosen yet.', false, 5),
  ('placeholder-stencil', 'Placeholder: stencil', '', 'not_established',
   'Placeholder, not reviewed by anyone. No licence for a font of this kind is on file, so it cannot be chosen yet.', false, 6);

-- ---------------------------------------------------------------------------------------------
-- The brand record: one row per brand.

create table public.brand_profiles (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  -- The five categories of F-S9.
  category text not null check (category in ('club', 'sportswear_brand', 'gym', 'esports_team', 'school')),
  -- Club or brand. Worked out from the category, so the two can never disagree.
  kind text generated always as (case when category in ('club', 'school') then 'club' else 'brand' end) stored,
  website text check (website is null or (website ~ '^https?://[^[:space:]]+$' and length(website) between 8 and 200)),
  -- Free text the brand typed. Line breaks are kept; anything else unprintable is not.
  about text not null default '' check (length(about) <= 1000 and about !~ '[^[:print:][:space:]]'),
  -- Tags from the spec's list, at most all five. Used by "Write for me" copy.
  voice_tags text[] not null default '{}'
    check (cardinality(voice_tags) <= 5 and voice_tags <@ array['bold', 'gritty', 'community', 'premium', 'playful']::text[]),
  -- The three visual-style texts of F-S9. Typed by hand for now; L7 writes them from reference images.
  setting text not null default '' check (length(setting) <= 1000 and setting !~ '[^[:print:][:space:]]'),
  art_direction text not null default '' check (length(art_direction) <= 1000 and art_direction !~ '[^[:print:][:space:]]'),
  rules_boundaries text not null default '' check (length(rules_boundaries) <= 1000 and rules_boundaries !~ '[^[:print:][:space:]]'),
  -- Size labels this brand makes by default. Empty until the brand says; never guessed. Each label's
  -- own shape is checked by brand_studio_save_profile, the only thing that writes here: a check
  -- constraint cannot look inside an array without a function Postgres treats as stable.
  default_size_range text[] not null default '{}' check (cardinality(default_size_range) <= 20),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.brand_profiles is
  'The details and visual style of a brand (F-S9). Written by the server only.';

-- ---------------------------------------------------------------------------------------------
-- Named palettes, each holding colours.

create table public.brand_palettes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60 and name = btrim(name)),
  position integer not null check (position >= 1),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (brand_id, name)
);

comment on table public.brand_palettes is
  'A named palette of a brand, such as Primary or Kit colours. Written by the server only.';

create index brand_palettes_brand_idx on public.brand_palettes (brand_id, position);

create table public.brand_colours (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null,
  brand_id uuid not null,
  position integer not null check (position >= 1),
  name text not null check (length(name) <= 60 and name !~ '[[:cntrl:]]'),
  -- The screen colour, lower case. It is for drawings, never a factory reference.
  hex text not null check (hex ~ '^#[0-9a-f]{6}$'),
  -- As the brand typed it, or null. No Pantone data ships, so nothing is ever worked out from the hex.
  pantone_tcx text check (pantone_tcx is null or (length(btrim(pantone_tcx)) between 1 and 40 and pantone_tcx !~ '[[:cntrl:]]')),
  unique (palette_id, position),
  foreign key (palette_id, brand_id) references public.brand_palettes (id, brand_id) on delete cascade
);

comment on table public.brand_colours is
  'One colour of a brand palette: hex as shown, Pantone TCX as typed. Written by the server only.';

create index brand_colours_brand_idx on public.brand_colours (brand_id);

-- ---------------------------------------------------------------------------------------------
-- A font for each role of F-S9.

create table public.brand_fonts (
  brand_id uuid not null references public.brands (id) on delete cascade,
  role text not null check (role in ('headline', 'subheadline', 'body', 'accent', 'name_number')),
  font_key text not null references public.brand_studio_fonts (key) on delete restrict,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (brand_id, role)
);

comment on table public.brand_fonts is
  'The font a brand uses for one role. Only a font whose licence is on file can be stored here.';

-- ---------------------------------------------------------------------------------------------
-- The pictures a brand uses, all of them its own uploads.

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind text not null check (kind in ('logo', 'graphic', 'crest', 'sponsor', 'label', 'packaging')),
  -- One of the brand's own uploads. The save function checks it belongs to this brand.
  artwork_id uuid not null references public.user_artworks (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80 and label !~ '[[:cntrl:]]'),
  -- The sponsor's name, for a sponsor logo only.
  sponsor_name text check (sponsor_name is null or (length(btrim(sponsor_name)) between 1 and 40 and sponsor_name !~ '[[:cntrl:]]')),
  -- The width the brand wants it printed at. Null when the brand has not said: no width is assumed.
  print_width_mm numeric check (print_width_mm is null or (print_width_mm > 0 and print_width_mm <= 2000)),
  position integer not null check (position >= 1),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (brand_id, kind, position),
  check (sponsor_name is null or kind = 'sponsor')
);

comment on table public.brand_assets is
  'A logo, graphic, crest, sponsor logo, label or packaging picture of a brand, from its own uploads.';

create index brand_assets_artwork_idx on public.brand_assets (artwork_id);

-- ---------------------------------------------------------------------------------------------
-- Rights. Browsers read; nothing here has an insert, update or delete policy, on purpose.

revoke all on public.brand_studio_fonts, public.brand_profiles, public.brand_palettes,
  public.brand_colours, public.brand_fonts, public.brand_assets
  from public, anon, authenticated, service_role;
grant select on public.brand_studio_fonts, public.brand_profiles, public.brand_palettes,
  public.brand_colours, public.brand_fonts, public.brand_assets
  to authenticated, service_role;

alter table public.brand_studio_fonts enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.brand_palettes enable row level security;
alter table public.brand_colours enable row level security;
alter table public.brand_fonts enable row level security;
alter table public.brand_assets enable row level security;

create policy "signed-in people read the kit-font list"
  on public.brand_studio_fonts for select to authenticated
  using (true);
create policy "members read their brand's record"
  on public.brand_profiles for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's palettes"
  on public.brand_palettes for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's colours"
  on public.brand_colours for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's fonts"
  on public.brand_fonts for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's pictures"
  on public.brand_assets for select to authenticated
  using (private.is_member(brand_id));

-- ---------------------------------------------------------------------------------------------
-- Limits. Knitwright's own, not anybody's measurement.

create function private.brand_palettes_limit()
returns integer language sql immutable set search_path = '' as $$ select 12 $$;
create function private.brand_colours_limit()
returns integer language sql immutable set search_path = '' as $$ select 24 $$;

-- The club kit already allows three sponsors (decision 0042), so the sponsor limit matches it.
create function private.brand_assets_limit(p_kind text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'logo' then 12
    when 'graphic' then 60
    when 'crest' then 1
    when 'sponsor' then 3
    when 'label' then 6
    when 'packaging' then 6
  end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Writes. Each checks the caller's role itself; only the server's own key may call them.

-- The details and visual style. p_profile is
-- { category, website, about, voiceTags[], setting, artDirection, rulesBoundaries, defaultSizeRange[] }.
create function public.brand_studio_save_profile(p_brand_id uuid, p_user_id uuid, p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this brand.' using errcode = '42501';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'The brand details are not understood.' using errcode = '22023';
  end if;
  -- Each size label, checked here because a check constraint cannot look inside an array.
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_profile -> 'defaultSizeRange', '[]'::jsonb)) as e(label)
    where e.label !~ '^[A-Za-z0-9][A-Za-z0-9 ./+-]{0,15}$'
  ) then
    raise exception 'A size label is 1 to 16 letters, digits, spaces or . / + -.' using errcode = '22023';
  end if;

  insert into public.brand_profiles as p (
    brand_id, category, website, about, voice_tags,
    setting, art_direction, rules_boundaries, default_size_range, updated_by, updated_at
  ) values (
    p_brand_id,
    p_profile ->> 'category',
    nullif(btrim(coalesce(p_profile ->> 'website', '')), ''),
    coalesce(p_profile ->> 'about', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_profile -> 'voiceTags', '[]'::jsonb))), '{}'::text[]),
    coalesce(p_profile ->> 'setting', ''),
    coalesce(p_profile ->> 'artDirection', ''),
    coalesce(p_profile ->> 'rulesBoundaries', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_profile -> 'defaultSizeRange', '[]'::jsonb))), '{}'::text[]),
    p_user_id,
    now()
  )
  on conflict (brand_id) do update set
    category = excluded.category,
    website = excluded.website,
    about = excluded.about,
    voice_tags = excluded.voice_tags,
    setting = excluded.setting,
    art_direction = excluded.art_direction,
    rules_boundaries = excluded.rules_boundaries,
    default_size_range = excluded.default_size_range,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
end;
$$;

-- Saves one palette and replaces every colour in it, so a palette is never half saved.
-- p_palette_id null creates one. p_colours is an array of { name, hex, pantoneTcx }.
create function public.brand_studio_save_palette(
  p_brand_id uuid, p_user_id uuid, p_palette_id uuid, p_name text, p_colours jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_palette_id;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this brand.' using errcode = '42501';
  end if;
  if p_colours is null or jsonb_typeof(p_colours) <> 'array'
     or jsonb_array_length(p_colours) > private.brand_colours_limit() then
    raise exception 'A palette holds up to % colours.', private.brand_colours_limit()
      using errcode = '22023', hint = 'too_many_colours';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('brand_palettes:' || p_brand_id::text, 0));

  if v_id is null then
    if (select count(*) from public.brand_palettes b where b.brand_id = p_brand_id)
       >= private.brand_palettes_limit() then
      raise exception 'A brand may have % palettes.', private.brand_palettes_limit()
        using errcode = 'P0001', hint = 'too_many_palettes';
    end if;
    insert into public.brand_palettes (brand_id, name, position, created_by)
    values (
      p_brand_id, btrim(p_name),
      coalesce((select max(b.position) + 1 from public.brand_palettes b where b.brand_id = p_brand_id), 1),
      p_user_id
    )
    returning id into v_id;
  else
    update public.brand_palettes b set name = btrim(p_name)
    where b.id = v_id and b.brand_id = p_brand_id;
    if not found then
      raise exception 'That palette does not exist.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.brand_colours c where c.palette_id = v_id;
  insert into public.brand_colours (palette_id, brand_id, position, name, hex, pantone_tcx)
  select v_id, p_brand_id, e.ordinality, coalesce(e.colour ->> 'name', ''),
         lower(coalesce(e.colour ->> 'hex', '')), nullif(btrim(coalesce(e.colour ->> 'pantoneTcx', '')), '')
  from jsonb_array_elements(p_colours) with ordinality as e(colour, ordinality);
  return v_id;
end;
$$;

create function public.brand_studio_delete_palette(p_brand_id uuid, p_user_id uuid, p_palette_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this brand.' using errcode = '42501';
  end if;
  delete from public.brand_palettes b where b.id = p_palette_id and b.brand_id = p_brand_id;
  if not found then
    raise exception 'That palette does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- Replaces every font role in one step. p_fonts is an array of { role, fontKey }; a role left out,
-- or given a null font, is cleared. A font whose licence is not on file is refused.
create function public.brand_studio_save_fonts(p_brand_id uuid, p_user_id uuid, p_fonts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this brand.' using errcode = '42501';
  end if;
  if p_fonts is null or jsonb_typeof(p_fonts) <> 'array' or jsonb_array_length(p_fonts) > 5 then
    raise exception 'The fonts are not understood.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_fonts) as e(font)
    left join public.brand_studio_fonts f on f.key = e.font ->> 'fontKey'
    where e.font ->> 'fontKey' is not null and coalesce(f.selectable, false) = false
  ) then
    raise exception 'That font cannot be chosen: no licence for it is on file.'
      using errcode = 'P0001', hint = 'font_not_licensed';
  end if;

  delete from public.brand_fonts b where b.brand_id = p_brand_id;
  insert into public.brand_fonts (brand_id, role, font_key, updated_by, updated_at)
  select p_brand_id, e.font ->> 'role', e.font ->> 'fontKey', p_user_id, now()
  from jsonb_array_elements(p_fonts) as e(font)
  where e.font ->> 'fontKey' is not null;
end;
$$;

-- Replaces every picture of one kind in one step. p_assets is an array of
-- { artworkId, label, sponsorName, printWidthMm }. Each upload must belong to this brand.
create function public.brand_studio_save_assets(
  p_brand_id uuid, p_user_id uuid, p_kind text, p_assets jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.brand_assets_limit(p_kind);
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this brand.' using errcode = '42501';
  end if;
  if v_limit is null then
    raise exception 'That kind of picture is not offered.' using errcode = '22023';
  end if;
  if p_assets is null or jsonb_typeof(p_assets) <> 'array' or jsonb_array_length(p_assets) > v_limit then
    raise exception 'A brand holds up to % of those.', v_limit
      using errcode = '22023', hint = 'too_many_pictures';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_assets) as e(asset)
    where not exists (
      select 1 from public.user_artworks a
      where a.id = (e.asset ->> 'artworkId')::uuid and a.brand_id = p_brand_id
    )
  ) then
    raise exception 'That picture is not one of this brand''s uploads.' using errcode = 'P0002';
  end if;

  delete from public.brand_assets b where b.brand_id = p_brand_id and b.kind = p_kind;
  insert into public.brand_assets (brand_id, kind, artwork_id, label, sponsor_name, print_width_mm, position, created_by)
  select p_brand_id, p_kind, (e.asset ->> 'artworkId')::uuid, coalesce(e.asset ->> 'label', ''),
         case when p_kind = 'sponsor' then nullif(btrim(coalesce(e.asset ->> 'sponsorName', '')), '') end,
         (e.asset ->> 'printWidthMm')::numeric, e.ordinality, p_user_id
  from jsonb_array_elements(p_assets) with ordinality as e(asset, ordinality);
  return jsonb_array_length(p_assets);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Rights on the functions. No browser may call any of them.

revoke all on function private.brand_palettes_limit() from public, anon, authenticated;
revoke all on function private.brand_colours_limit() from public, anon, authenticated;
revoke all on function private.brand_assets_limit(text) from public, anon, authenticated;

revoke all on function public.brand_studio_save_profile(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.brand_studio_save_palette(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.brand_studio_delete_palette(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.brand_studio_save_fonts(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.brand_studio_save_assets(uuid, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.brand_studio_save_profile(uuid, uuid, jsonb) to service_role;
grant execute on function public.brand_studio_save_palette(uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.brand_studio_delete_palette(uuid, uuid, uuid) to service_role;
grant execute on function public.brand_studio_save_fonts(uuid, uuid, jsonb) to service_role;
grant execute on function public.brand_studio_save_assets(uuid, uuid, text, jsonb) to service_role;
