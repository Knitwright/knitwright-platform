-- Base article catalogue (plans/platform-v5.md, workstream X1, decision 0066).
--
-- A base article is one makeable garment block: sizes, points of measure with grades and tolerances, structural
-- parameters with the ranges a factory makes, options with catalogue codes, the construction table and the fabrics
-- it may be made in (docs/spec/03-data-model.md, base_article, parameter_def, option_def).
--
-- Platform data, not owned by a brand. Signed-in members read it; only the server's own key writes it (platform
-- admins, through the service client), as with factory_profiles. No browser role holds a write grant or a write policy.
-- The child tables refer only to base_articles, which this file creates, so migrations still merge in any order.
--
-- The seed at the end is generated from docs/spec/articles/JSY-SS-01/article.json and ONBOARDING.md by
-- lib/catalogue/seed/sql.ts; lib/catalogue/seed/sql.test.ts fails if the two drift apart. Every seeded article is
-- labelled "Knitwright draft v0.1, not reviewed by a factory".

create table public.base_articles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{3}-[A-Z]{2}-[A-Z0-9]{2}$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  -- The first part of the code: JSY, SHO, CRK. The catalogue filters on it.
  article_type text not null check (article_type ~ '^[A-Z]{3}$'),
  production_class text not null check (production_class in ('A', 'B')),
  status text not null default 'draft' check (status in ('draft', 'sampling', 'live')),
  sport_tags text[] not null default '{}' check (cardinality(sport_tags) <= 16),
  uses text[] not null default '{}' check (uses <@ array['teamwear', 'studio']::text[]),
  -- Null when the build pack does not say: never guessed.
  fit text check (fit is null or fit ~ '^[a-z]+(-[a-z]+)*$'),
  genders text[] not null default '{}' check (cardinality(genders) <= 4),
  size_range text[] not null default '{}' check (cardinality(size_range) <= 24),
  sample_size text,
  -- The garment registry type a new design on this article is made as (lib/catalogue/registry-map.ts).
  registry_type_id text check (registry_type_id is null or registry_type_id ~ '^[a-z0-9-]{1,64}$'),
  -- Who stands behind the values: the seed says Knitwright's draft, not reviewed by a factory.
  data_label text not null check (length(btrim(data_label)) between 1 and 200),
  hs_code text,
  origin char(2),
  source_version text,
  source_note text,
  glb_model_key text,
  uv_panel_map jsonb check (uv_panel_map is null or jsonb_typeof(uv_panel_map) = 'object'),
  parametric_script_id text,
  parametric_script_version text,
  seam_allowances_mm jsonb check (seam_allowances_mm is null or jsonb_typeof(seam_allowances_mm) = 'object'),
  seam_allowance_rule_id text check (seam_allowance_rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  thread_needle text,
  thread_looper text,
  thread_rule_id text check (thread_rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint base_articles_type_is_code_prefix check (code like article_type || '-%'),
  constraint base_articles_sample_size_in_range check (sample_size is null or sample_size = any (size_range)),
  constraint base_articles_script_has_version check ((parametric_script_id is null) = (parametric_script_version is null))
);

comment on table public.base_articles is
  'Makeable garment blocks (spec base_article). Platform data: read by signed-in members, written by the server only.';
comment on column public.base_articles.data_label is
  'Who stands behind the values. Seeded rows say they are Knitwright''s draft, not reviewed by a factory.';

create table public.article_poms (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.base_articles (id) on delete cascade,
  position integer not null check (position >= 0),
  letter text not null check (letter ~ '^[A-Z]{1,2}$'),
  code text not null check (code ~ '^[A-Z]{1,4}$'),
  description text not null check (length(btrim(description)) between 1 and 300),
  grade_type text not null check (grade_type in ('linear', 'non_linear', 'ungraded', 'fixed')),
  grade_mm numeric not null check (grade_mm >= 0),
  tol_minus_mm numeric not null check (tol_minus_mm >= 0),
  tol_plus_mm numeric not null check (tol_plus_mm >= 0),
  -- Size label to millimetres, one entry per size in the article's size range.
  values_mm jsonb not null check (jsonb_typeof(values_mm) = 'object'),
  rule_id text not null check (rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  unique (article_id, letter),
  unique (article_id, position)
);

comment on table public.article_poms is 'Points of measure of a base article, with grade, tolerance and value per size, in mm.';

create table public.parameter_defs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.base_articles (id) on delete cascade,
  position integer not null check (position >= 0),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  type text not null check (type in ('range', 'enum', 'bool')),
  min numeric,
  max numeric,
  step numeric check (step is null or step > 0),
  default_value jsonb not null,
  enum_values text[],
  unit text,
  affects_panels text[] not null default '{}',
  pom_letters text[] not null default '{}',
  rule_id text not null check (rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  -- Null means "Not yet sampled": no sample at the ends of the range exists. Refers to a golden sample by id only.
  approved_by_sample_id uuid,
  unique (article_id, key),
  unique (article_id, position),
  constraint parameter_defs_range_is_whole check (
    type <> 'range' or (
      min is not null and max is not null and step is not null and min <= max
      and jsonb_typeof(default_value) = 'number'
      and (default_value #>> '{}')::numeric between min and max
    )
  ),
  constraint parameter_defs_enum_has_values check (
    type <> 'enum' or (coalesce(cardinality(enum_values), 0) >= 1 and coalesce((default_value #>> '{}') = any (enum_values), false))
  ),
  constraint parameter_defs_bool_is_bool check (type <> 'bool' or jsonb_typeof(default_value) = 'boolean')
);

comment on table public.parameter_defs is
  'Structural parameters of a base article with the ranges a factory makes. approved_by_sample_id is null until sampled.';

create table public.option_defs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.base_articles (id) on delete cascade,
  position integer not null check (position >= 0),
  option_group text not null check (option_group ~ '^[a-z][a-z0-9_]{0,63}$'),
  code text not null check (code ~ '^[A-Z][0-9]{2}$'),
  label text not null check (length(btrim(label)) between 1 and 200),
  is_default boolean not null default false,
  thumbnail_key text,
  -- Null until priced. Integer minor units plus a currency, both or neither.
  extra_cost_minor integer check (extra_cost_minor is null or extra_cost_minor >= 0),
  currency char(3) check (currency is null or currency ~ '^[A-Z]{3}$'),
  -- Every option explains itself (plan v5, spec decision 11). An option the rulebook has no entry for yet carries
  -- R-GAP-000, never nothing.
  rule_id text not null check (rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  approved_by_sample_id uuid,
  unique (article_id, option_group, code),
  unique (article_id, position),
  constraint option_defs_cost_has_currency check ((extra_cost_minor is null) = (currency is null))
);

comment on table public.option_defs is 'Discrete structural options of a base article (collar C01, sleeve finish K01), by catalogue code.';

-- One default per group at most.
create unique index option_defs_one_default on public.option_defs (article_id, option_group) where is_default;

create table public.article_construction (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.base_articles (id) on delete cascade,
  step integer not null check (step >= 1),
  seam text not null check (length(btrim(seam)) between 1 and 200),
  operation text not null check (length(btrim(operation)) between 1 and 1000),
  -- ISO 4915 stitch classes named in the operation, as '514'.
  iso_stitch_classes text[] not null default '{}',
  spi text,
  rule_id text not null check (rule_id ~ '^R-[A-Z]{2,5}-\d{3}$'),
  unique (article_id, step)
);

comment on table public.article_construction is 'The construction table of a base article: each seam and how it is sewn.';

create table public.article_fabrics (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.base_articles (id) on delete cascade,
  position integer not null check (position >= 0),
  fabric_code text not null check (fabric_code ~ '^F-[A-Z0-9]+(-[A-Z0-9]+)*$'),
  role text check (role is null or role in ('body', 'rib')),
  description text,
  gsm text,
  width_cm numeric check (width_cm is null or width_cm > 0),
  press_shrink_length_pct numeric,
  press_shrink_width_pct numeric,
  source_note text,
  unique (article_id, fabric_code),
  unique (article_id, position)
);

comment on table public.article_fabrics is 'Fabric programme codes a base article may be made in.';

create index article_fabrics_code_idx on public.article_fabrics (fabric_code);

-- Rights: signed-in members read; the server's key writes. Same idiom as factory_profiles (20261025010000).
revoke all on public.base_articles, public.article_poms, public.parameter_defs, public.option_defs, public.article_construction, public.article_fabrics
  from public, anon, authenticated, service_role;
grant select on public.base_articles, public.article_poms, public.parameter_defs, public.option_defs, public.article_construction, public.article_fabrics
  to authenticated, service_role;
grant insert, update, delete on public.base_articles, public.article_poms, public.parameter_defs, public.option_defs, public.article_construction, public.article_fabrics
  to service_role;

alter table public.base_articles enable row level security;
alter table public.article_poms enable row level security;
alter table public.parameter_defs enable row level security;
alter table public.option_defs enable row level security;
alter table public.article_construction enable row level security;
alter table public.article_fabrics enable row level security;

create policy "members read base_articles"
  on public.base_articles for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

create policy "members read article_poms"
  on public.article_poms for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

create policy "members read parameter_defs"
  on public.parameter_defs for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

create policy "members read option_defs"
  on public.option_defs for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

create policy "members read article_construction"
  on public.article_construction for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

create policy "members read article_fabrics"
  on public.article_fabrics for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

-- There are no insert, update or delete policies, on purpose.

-- BEGIN GENERATED SEED (lib/catalogue/seed/sql.ts; do not edit by hand)
insert into public.base_articles (code, name, article_type, production_class, status, sport_tags, uses, fit, genders, size_range, sample_size, registry_type_id, data_label, hs_code, origin, source_version, source_note, glb_model_key, uv_panel_map, parametric_script_id, parametric_script_version, seam_allowances_mm, seam_allowance_rule_id, thread_needle, thread_looper, thread_rule_id) values
  ('JSY-SS-01', 'Short-sleeve sublimated jersey, set-in sleeve, regular fit', 'JSY', 'A', 'draft', '{"football","training","esports","running"}', '{"teamwear","studio"}', 'regular', '{}', '{"XS","S","M","L","XL","2XL","3XL"}', 'M', 'football-shirt', 'Knitwright draft v0.1, not reviewed by a factory', '6110.30', 'PK', '0.1', 'All measurements are Knitwright''s draft. The factory''s pattern master replaces any value that differs from their proven block. Values marked placeholder must be confirmed in the sample round.', null, null, null, null, '{"shoulder":6,"side":6,"armhole":6,"sleeve_underarm":6,"neck":6,"body_hem":25,"sleeve_hem":20,"rib":6}'::jsonb, 'R-PAT-001', 'Polyester core-spun Tex 27 (Tkt 120), colour-matched to dominant colour or white', 'Textured polyester Tex 18 for stretch and softness', 'R-CON-009'),
  ('SHO-TR-01', 'Football/training shorts', 'SHO', 'A', 'draft', '{"football","training"}', '{"teamwear","studio"}', null, '{}', '{}', null, 'football-shorts', 'Knitwright draft v0.1, not reviewed by a factory', null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('JSY-LS-01', 'Long-sleeve jersey / goalkeeper', 'JSY', 'A', 'draft', '{}', '{"teamwear","studio"}', null, '{}', '{}', null, 'goalkeeper-shirt', 'Knitwright draft v0.1, not reviewed by a factory', null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('CRK-SS-01', 'Cricket coloured shirt (pique)', 'CRK', 'A', 'draft', '{"cricket"}', '{"teamwear"}', null, '{}', '{}', null, 'cricket-shirt', 'Knitwright draft v0.1, not reviewed by a factory', null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('TEE-TR-01', 'Training tee, stock-colour fabric', 'TEE', 'B', 'draft', '{"training"}', '{"teamwear","studio"}', null, '{}', '{}', null, 'crew-tee', 'Knitwright draft v0.1, not reviewed by a factory', null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('HOD-ST-01', 'Hoodie, stock-colour fleece', 'HOD', 'B', 'draft', '{}', '{"teamwear","studio"}', null, '{}', '{}', null, 'pullover-hoodie', 'Knitwright draft v0.1, not reviewed by a factory', null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('CMP-LS-01', 'Compression top / rash guard', 'CMP', 'A', 'draft', '{}', '{"studio"}', null, '{}', '{}', null, 'compression-top', 'Knitwright draft v0.1, not reviewed by a factory', null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('FSH-MM-01', 'Fight shorts (MMA/BJJ)', 'FSH', 'A', 'draft', '{"mma","bjj"}', '{"studio"}', null, '{}', '{}', null, null, 'Knitwright draft v0.1, not reviewed by a factory', null, null, null, null, null, null, null, null, null, null, null, null, null);

insert into public.article_poms (article_id, position, letter, code, description, grade_type, grade_mm, tol_minus_mm, tol_plus_mm, values_mm, rule_id) values
  ((select id from public.base_articles where code = 'JSY-SS-01'), 0, 'A', 'CH', 'Chest width, 25 mm below armhole, half', 'linear', 30, 10, 10, '{"XS":460,"S":490,"M":520,"L":550,"XL":580,"2XL":610,"3XL":640}'::jsonb, 'R-FIT-001'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 1, 'B', 'BL', 'Body length, front, HPS to hem', 'linear', 20, 10, 10, '{"XS":680,"S":700,"M":720,"L":740,"XL":760,"2XL":780,"3XL":800}'::jsonb, 'R-FIT-002'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 2, 'C', 'SW', 'Across shoulder, seam to seam', 'linear', 15, 7, 7, '{"XS":430,"S":445,"M":460,"L":475,"XL":490,"2XL":505,"3XL":520}'::jsonb, 'R-FIT-003'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 3, 'D', 'SL', 'Sleeve length, shoulder point to hem', 'linear', 10, 7, 7, '{"XS":190,"S":200,"M":210,"L":220,"XL":230,"2XL":240,"3XL":250}'::jsonb, 'R-FIT-004'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 4, 'E', 'BI', 'Bicep width, 25 mm below armhole, half', 'linear', 10, 5, 5, '{"XS":175,"S":185,"M":195,"L":205,"XL":215,"2XL":225,"3XL":235}'::jsonb, 'R-FIT-005'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 5, 'F', 'SO', 'Sleeve opening, half', 'linear', 10, 5, 5, '{"XS":150,"S":160,"M":170,"L":180,"XL":190,"2XL":200,"3XL":210}'::jsonb, 'R-FIT-005'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 6, 'G', 'AD', 'Armhole depth, HPS to underarm, straight down', 'linear', 10, 7, 7, '{"XS":230,"S":240,"M":250,"L":260,"XL":270,"2XL":280,"3XL":290}'::jsonb, 'R-FIT-006'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 7, 'H', 'NW', 'Neck width, seam to seam', 'linear', 5, 5, 5, '{"XS":170,"S":175,"M":180,"L":185,"XL":190,"2XL":195,"3XL":200}'::jsonb, 'R-FIT-007'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 8, 'I', 'FND', 'Front neck drop, HPS to seam (crew C01)', 'linear', 3, 5, 5, '{"XS":79,"S":82,"M":85,"L":88,"XL":91,"2XL":94,"3XL":97}'::jsonb, 'R-FIT-007'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 9, 'J', 'BND', 'Back neck drop, HPS to seam', 'fixed', 0, 3, 3, '{"XS":20,"S":20,"M":20,"L":20,"XL":20,"2XL":20,"3XL":20}'::jsonb, 'R-FIT-007'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 10, 'K', 'HW', 'Hem width, half (straight body)', 'linear', 30, 10, 10, '{"XS":460,"S":490,"M":520,"L":550,"XL":580,"2XL":610,"3XL":640}'::jsonb, 'R-FIT-001'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 11, 'L', 'NR', 'Neck rib height, finished (C01)', 'fixed', 0, 2, 2, '{"XS":20,"S":20,"M":20,"L":20,"XL":20,"2XL":20,"3XL":20}'::jsonb, 'R-CON-004');

insert into public.parameter_defs (article_id, position, key, type, min, max, step, default_value, enum_values, unit, affects_panels, pom_letters, rule_id, approved_by_sample_id) values
  ((select id from public.base_articles where code = 'JSY-SS-01'), 0, 'body_length_offset', 'range', -30, 40, 10, '0'::jsonb, null, 'mm', '{"front","back"}', '{"B"}', 'R-PAT-003', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 1, 'sleeve_length_offset', 'range', -20, 40, 10, '0'::jsonb, null, 'mm', '{"sleeve"}', '{"D"}', 'R-PAT-004', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 2, 'back_drop_tail', 'range', 0, 40, 10, '0'::jsonb, null, 'mm', '{"back"}', '{}', 'R-PAT-005', null);

insert into public.option_defs (article_id, position, option_group, code, label, is_default, thumbnail_key, extra_cost_minor, currency, rule_id, approved_by_sample_id) values
  ((select id from public.base_articles where code = 'JSY-SS-01'), 0, 'collar', 'C01', 'Crew neck, 1x1 rib, 20 mm finished', true, null, null, null, 'R-CON-004', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 1, 'collar', 'C02', 'V-neck, self-fabric binding 15 mm, mitred V, front drop 140 mm', false, null, null, null, 'R-CON-005', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 2, 'collar', 'C03', 'Crew neck, self-fabric binding 15 mm', false, null, null, null, 'R-CON-006', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 3, 'sleeve_finish', 'K01', 'Coverstitch hem, 20 mm', true, null, null, null, 'R-CON-007', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 4, 'sleeve_finish', 'K02', '1x1 rib cuff, 25 mm finished', false, null, null, null, 'R-CON-008', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 5, 'pattern_fill', 'P00', 'Plain', true, null, null, null, 'R-GAP-000', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 6, 'pattern_fill', 'P01', 'Vertical stripes', false, null, null, null, 'R-GAP-000', null),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 7, 'pattern_fill', 'P02', 'Diagonal gradient', false, null, null, null, 'R-GAP-000', null);

insert into public.article_construction (article_id, step, seam, operation, iso_stitch_classes, spi, rule_id) values
  ((select id from public.base_articles where code = 'JSY-SS-01'), 1, 'Shoulder seams', '4-thread overlock (ISO 514), back neck to shoulder taped with 10 mm poly tape', '{"514"}', '12-14 per inch (5-5.5 per cm)', 'R-CON-001'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 2, 'Neck (C01)', 'Rib joined into a loop with a 6 mm seam, quartered, attached with 4-thread overlock, seam at centre back', '{}', '12-14', 'R-CON-004'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 3, 'Back neck', 'Neck seam covered with self-fabric or poly tape, topstitched 2-needle coverstitch (ISO 406)', '{"406"}', '10-12', 'R-CON-002'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 4, 'Sleeve attach', '4-thread overlock (ISO 514), sleeve set in flat before side seams, notches matched', '{"514"}', '12-14', 'R-CON-001'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 5, 'Side and underarm seams', '4-thread overlock (ISO 514), one continuous seam hem to sleeve hem, underarm seams matched', '{"514"}', '12-14', 'R-CON-003'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 6, 'Sleeve hem (K01)', '20 mm turn-up, 2-needle coverstitch (ISO 406), 6.4 mm gauge', '{"406"}', '10-12', 'R-CON-007'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 7, 'Body hem', '25 mm turn-up, 2-needle coverstitch (ISO 406), 6.4 mm gauge', '{"406"}', '10-12', 'R-CON-007'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 8, 'Care label', 'Inserted in the wearer''s left side seam, 80 mm above the hem', '{}', null, 'R-LAB-002'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 9, 'Neck label', 'Heat-transfer or sublimated neck label inside back neck; no sewn neck label', '{}', null, 'R-LAB-001');

insert into public.article_fabrics (article_id, position, fabric_code, role, description, gsm, width_cm, press_shrink_length_pct, press_shrink_width_pct, source_note) values
  ((select id from public.base_articles where code = 'JSY-SS-01'), 0, 'F-POLY-INT', 'body', '100% polyester interlock, white, sublimation-ready, moisture-wicking finish, PFAS-free', '140-160', 180, 1.5, 1, 'placeholder: factory to confirm fabric, GSM and shrink'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 1, 'F-POLY-RIB', 'rib', '1x1 rib, 95% polyester 5% elastane, white, sublimation-ready', '220', null, null, null, 'placeholder'),
  ((select id from public.base_articles where code = 'SHO-TR-01'), 0, 'F-POLY-INT', null, null, null, null, null, null, null),
  ((select id from public.base_articles where code = 'JSY-LS-01'), 0, 'F-POLY-INT', null, null, null, null, null, null, null),
  ((select id from public.base_articles where code = 'CRK-SS-01'), 0, 'F-POLY-PQ', null, null, null, null, null, null, null),
  ((select id from public.base_articles where code = 'TEE-TR-01'), 0, 'F-STK-TEE', null, null, null, null, null, null, null),
  ((select id from public.base_articles where code = 'HOD-ST-01'), 0, 'F-STK-FLC', null, null, null, null, null, null, null),
  ((select id from public.base_articles where code = 'CMP-LS-01'), 0, 'F-POLY-EL', null, null, null, null, null, null, null),
  ((select id from public.base_articles where code = 'FSH-MM-01'), 0, 'F-POLY-4W', null, null, null, null, null, null, null);
-- END GENERATED SEED
