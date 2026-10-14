-- Print profiles and league rule sets (plans/production-outputs.md, workstream W3).
--
-- A brand keeps one print profile: the bleed, the resolution and the lowest resolution its print house asks for,
-- the widest print the house can make, and the colour profile (an ICC file) the house gave. Where the brand has not
-- set a profile, the code uses Knitwright's defaults and says so on every file; nothing is stored for them.
-- League rule sets hold a competition's rules for the kit (number heights, digits, colours to avoid), each with the
-- source it was read from. None ships.
--
-- Members read their own brand's rows. Only the server writes: there is no write grant and no write policy for any
-- browser role, as with pattern_jobs and base_fabrics. No row refers to another workstream's tables.

create table public.print_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  bleed_mm numeric not null check (bleed_mm between 0 and 100),
  dpi integer not null check (dpi between 72 and 1200),
  -- The lowest resolution a picture may have before a file warns that it may look soft.
  min_dpi integer not null check (min_dpi between 72 and 1200),
  max_print_width_mm numeric check (max_print_width_mm is null or (max_print_width_mm > 0 and max_print_width_mm <= 10000)),
  -- The print house's ICC profile, a file the brand uploaded. The server checks it belongs to the brand.
  icc_file_id uuid references public.files (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id)
);

comment on table public.print_profiles is
  'A brand''s print house settings: bleed, resolution, lowest resolution, widest print and colour profile. Written by the server only.';

create table public.league_rule_sets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  -- Where the rules were read, for example the competition's rulebook and section. Required: a rule has a source.
  source text not null check (length(btrim(source)) between 1 and 300),
  -- A PrintRuleSet (lib/production/contract/print.ts): text and line minimums, colours to avoid, number rules.
  rules jsonb not null check (jsonb_typeof(rules) = 'object' and pg_column_size(rules) < 4096),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.league_rule_sets is
  'A competition''s rules for the kit, each set with its source. None ships. Written by the server only.';

create unique index league_rule_sets_name_idx on public.league_rule_sets (brand_id, lower(btrim(name)));

revoke all on public.print_profiles, public.league_rule_sets from public, anon, authenticated;
grant select on public.print_profiles, public.league_rule_sets to authenticated;
revoke all on public.print_profiles, public.league_rule_sets from service_role;
grant select, insert, update on public.print_profiles to service_role;
grant select, insert, update, delete on public.league_rule_sets to service_role;

alter table public.print_profiles enable row level security;
alter table public.league_rule_sets enable row level security;

create policy "members read their brand's print profile"
  on public.print_profiles for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's league rule sets"
  on public.league_rule_sets for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.
