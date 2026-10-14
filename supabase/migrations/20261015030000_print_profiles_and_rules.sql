-- Print profiles and league rule sets (plans/production-outputs.md, workstream W3).
--
-- A brand keeps one print profile: what its print house asked for (bleed, resolution, colour
-- profile, widest print). Until a member saves one, the code uses its own labelled defaults and no
-- row exists. A brand may also keep league rule sets, each with the source it came from.
--
-- Members read their own brand's rows. Only the server writes: there is no write grant and no write
-- policy for any browser role, as with pattern_jobs. No row refers to another workstream's tables.

create table public.print_profiles (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  bleed_mm numeric not null default 15 check (bleed_mm between 0 and 100),
  dpi integer not null default 150 check (dpi between 72 and 1200),
  min_dpi integer not null default 150 check (min_dpi between 72 and 1200),
  -- The print house's ICC profile, a stored file. It must belong to this brand (see the trigger).
  icc_file_id uuid references public.files (id) on delete set null,
  max_print_width_mm numeric check (max_print_width_mm is null or (max_print_width_mm > 0 and max_print_width_mm <= 10000)),
  source text not null check (source in ('print-house', 'knitwright-default')),
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now()
);

comment on table public.print_profiles is
  'A brand''s print house settings, one row per brand. Written by the server only.';

create table public.league_rule_sets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  -- Where the rules came from (a rule book, a league email). Every rule has a source.
  source text not null check (length(btrim(source)) between 1 and 200),
  -- A PrintRuleSet (lib/production/contract/print.ts).
  rules jsonb not null check (jsonb_typeof(rules) = 'object' and pg_column_size(rules) < 4096),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.league_rule_sets is
  'A brand''s league rule sets and the source of each. Written by the server only.';

create unique index league_rule_sets_name_idx on public.league_rule_sets (brand_id, lower(btrim(name)));

-- The ICC file must be the brand's own, and a print file or a pattern source file. files has no
-- (id, brand_id) key to point a composite foreign key at, so a trigger holds the rule.
create function private.print_profile_icc_ok() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.icc_file_id is not null and not exists (
    select 1 from public.files f
    where f.id = new.icc_file_id and f.brand_id = new.brand_id and f.kind in ('print', 'pattern-source')
  ) then
    raise exception 'The colour profile file must be one of this brand''s print or pattern files.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.print_profile_icc_ok() from public, anon, authenticated;

create trigger print_profiles_icc_ok
  before insert or update of icc_file_id, brand_id on public.print_profiles
  for each row execute function private.print_profile_icc_ok();

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
