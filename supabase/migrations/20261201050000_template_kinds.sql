-- Template kinds, the launch tag set, kit bundles and tech pack templates
-- (plans/platform-v5.md wave 4, workstream L8; spec docs/spec/07-template-library.md; decision 0098).
--
-- `07` names seven kinds of template and a launch count for each. This migration adds:
--
--   1. `templates.kind`, the column `07`'s seven types need, defaulting to `design` so every row that
--      already exists keeps its meaning. **A reader of `templates` sees every kind.**
--      `lib/templates/service.ts` (owned by no wave-4 workstream) reads the whole table and parses
--      every row against the design shape, so a workstream that seeds a kind other than `design`
--      must narrow that read to `kind = 'design'` first, or the design library breaks on its row.
--   2. The launch tag set `07` asks for — sport, style, era, mood, colour family. Style and colour
--      family are already columns (`style_tags`, `colour_family`); sport, era and mood are added as
--      arrays over a closed vocabulary, mirrored in `lib/templates/kinds/tags.ts` and held to this
--      file by a test. The spec's six sport groups include `esports` and `combat`, which the `sport`
--      column's five-value check does not hold and which `SPORTS` in `lib/templates/catalogue.ts`
--      does not type; `sport_tags` carries them without changing a file this workstream does not own.
--   3. `template_kit_bundles` and its members: `07`'s 15 kit bundles, each a set of design templates
--      that belong together, by role (home, away, goalkeeper) and slot (shirt, shorts, trousers).
--      A member names a `templates` row by its slug, so a bundle can never point at a design that is
--      not in the library.
--   4. `template_techpacks`: `07`'s 8 tech pack templates, one per base article, each a page set, the
--      default fields that article's own data fills, and the gaps it cannot fill. Seven of the eight
--      base articles have an empty point-of-measure table and no drafting script (decision 0090), so
--      their template states the gap and the rule that explains it instead of a measurement.
--
-- Platform data, as `templates` is: every signed-in user reads it, no browser role writes it, and the
-- server writes through the service client. No money, no Store concept and no measurement is here.

-- ---------------------------------------------------------------------------------------------
-- 1 and 2. The kind column and the launch tag set.

alter table public.templates
  add column kind text not null default 'design'
    check (kind in ('design', 'kit_bundle', 'mockup_scene', 'marketing', 'video', 'flow', 'techpack')),
  add column sport_tags text[] not null default '{}'
    check (cardinality(sport_tags) <= 6 and sport_tags <@ array['football', 'cricket', 'training', 'esports', 'running-gym', 'combat']::text[]),
  add column era_tags text[] not null default '{}'
    check (cardinality(era_tags) <= 3 and era_tags <@ array['classic', 'retro-90s', 'modern']::text[]),
  add column mood_tags text[] not null default '{}'
    check (cardinality(mood_tags) <= 4 and mood_tags <@ array['bold', 'clean', 'sharp', 'playful', 'understated']::text[]);

comment on column public.templates.kind is
  'Which of the seven template types of docs/spec/07-template-library.md this row is. A reader that expects a design must ask for kind = ''design''.';
comment on column public.templates.sport_tags is
  'The spec''s six sport groups, including esports and combat, which the five-value sport column does not hold. Knitwright''s own tags: they say what a kit is for, not that a league accepts it.';
comment on column public.templates.era_tags is 'Knitwright''s own look-and-feel tags, for search and the inspiration board. Not a factory fact.';
comment on column public.templates.mood_tags is 'Knitwright''s own look-and-feel tags, for search and the inspiration board. Not a factory fact.';

create index templates_kind_idx on public.templates (kind, sport, article_id);

-- `authenticated` holds SELECT on `templates` column by column, not on the whole table
-- (20261030020000_member_visible_columns.sql: the designer's account behind an attribution is the
-- server's business). A column added later therefore has no grant at all, and a read that names it is
-- refused for the whole table, so the four new ones are granted here. None of them says anything about
-- a person.
grant select (kind, sport_tags, era_tags, mood_tags) on public.templates to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Kit bundles: a set of design templates that belong together.

create table public.template_kit_bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  title text not null check (length(title) between 1 and 120 and title = btrim(title)),
  sport text not null check (sport in ('football', 'cricket', 'running', 'training', 'general')),
  colour_family text not null check (colour_family in ('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white', 'grey')),
  sport_tags text[] not null default '{}'
    check (cardinality(sport_tags) <= 6 and sport_tags <@ array['football', 'cricket', 'training', 'esports', 'running-gym', 'combat']::text[]),
  era_tags text[] not null default '{}'
    check (cardinality(era_tags) <= 3 and era_tags <@ array['classic', 'retro-90s', 'modern']::text[]),
  mood_tags text[] not null default '{}'
    check (cardinality(mood_tags) <= 4 and mood_tags <@ array['bold', 'clean', 'sharp', 'playful', 'understated']::text[]),
  -- What the screen says about where this bundle's values come from. Never "approved": see lib/techpack/wording.test.ts.
  label text not null check (length(btrim(label)) between 1 and 200),
  -- The parts `07` names that this bundle cannot carry yet, one entry each with the rule that explains it.
  gaps jsonb not null default '[]'::jsonb check (jsonb_typeof(gaps) = 'array' and pg_column_size(gaps) < 16384),
  source text not null default 'knitwright' check (source = 'knitwright'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.template_kit_bundles is
  'The kit bundles of docs/spec/07-template-library.md: a set of design templates that belong together. Platform-owned; read by every signed-in user; written by the server only.';

create table public.template_kit_bundle_members (
  id uuid primary key default gen_random_uuid(),
  bundle_slug text not null references public.template_kit_bundles (slug) on update cascade on delete cascade,
  -- A design in the library. Named by slug, so a bundle can never point at a design that is not there.
  template_slug text not null references public.templates (slug) on update cascade on delete restrict,
  role text not null check (role in ('home', 'away', 'goalkeeper', 'training', 'warm-up')),
  slot text not null check (slot in ('shirt', 'shorts', 'trousers', 'tee', 'hoodie', 'base-layer')),
  position integer not null check (position between 1 and 12),
  unique (bundle_slug, position),
  unique (bundle_slug, role, slot)
);

comment on table public.template_kit_bundle_members is
  'One design template in one kit bundle, with its role (home, away, goalkeeper) and its slot (shirt, shorts, trousers).';

create index template_kit_bundle_members_bundle_idx on public.template_kit_bundle_members (bundle_slug, position);
create index template_kit_bundle_members_template_idx on public.template_kit_bundle_members (template_slug);

-- ---------------------------------------------------------------------------------------------
-- 4. Tech pack templates: a page set and default fields per base article.

create table public.template_techpacks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  -- One template per base article, and the article must be in the catalogue.
  base_article_code text not null unique references public.base_articles (code) on update cascade on delete cascade,
  title text not null check (length(title) between 1 and 120 and title = btrim(title)),
  -- The pages this article's pack has, in order: the section ids of lib/techpack/types.ts.
  sections text[] not null check (cardinality(sections) between 1 and 32),
  -- The fields the pack fills for this article from the article's own catalogue row. No measurement is here.
  defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(defaults) = 'object' and pg_column_size(defaults) < 65536),
  -- What this article has no data for: the section, what is missing, and the rulebook entry that explains it.
  gaps jsonb not null default '[]'::jsonb check (jsonb_typeof(gaps) = 'array' and pg_column_size(gaps) < 65536),
  label text not null check (length(btrim(label)) between 1 and 200),
  source text not null default 'knitwright' check (source = 'knitwright'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.template_techpacks is
  'The tech pack templates of docs/spec/07-template-library.md: the page set and default fields of one base article, with the gaps that article has no data for. Platform-owned; read by every signed-in user; written by the server only.';
comment on column public.template_techpacks.gaps is
  'One entry per missing part: seven of the eight base articles publish no point of measure and no drafting script (decision 0090), and the template says so rather than filling one in.';

-- ---------------------------------------------------------------------------------------------
-- Who may reach them: exactly as public.templates. Every signed-in user reads; no browser role writes.

revoke all on public.template_kit_bundles, public.template_kit_bundle_members, public.template_techpacks
  from public, anon, authenticated, service_role;
grant select on public.template_kit_bundles, public.template_kit_bundle_members, public.template_techpacks to authenticated;
grant select, insert, update, delete on public.template_kit_bundles, public.template_kit_bundle_members, public.template_techpacks to service_role;

alter table public.template_kit_bundles enable row level security;
alter table public.template_kit_bundle_members enable row level security;
alter table public.template_techpacks enable row level security;

create policy "signed-in users read the kit bundles"
  on public.template_kit_bundles for select to authenticated
  using (true);

create policy "signed-in users read what is in a kit bundle"
  on public.template_kit_bundle_members for select to authenticated
  using (true);

create policy "signed-in users read the tech pack templates"
  on public.template_techpacks for select to authenticated
  using (true);

-- There are no insert, update or delete policies, on purpose.
