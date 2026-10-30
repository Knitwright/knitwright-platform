-- Compliance and pre-export unification (plan v5 Z8, F-G2 and F-G3, decision 0089).
--
-- Decision 0070 left three values with no table: the article's bill of materials, "the care-label wording per
-- market in country_rules.label_rules", and "the AQL plan per factory". This migration adds the last two and
-- seeds the first of them. Nothing here is invented:
--
--   * country_rules.label_rules is seeded with the parts a source in this repository states, and nothing else.
--     The fibre line's language and order cite rulebook R-LAB-002 (draft); the origin sentence cites
--     docs/spec/04-production-package.md, section 07_labels ("Made in Pakistan"). The care symbols, the size
--     wording and whether a market requires an importer address are left null, because no source in this
--     repository states them, and lib/compliance refuses a label that is missing any of them.
--   * care_symbols holds the ISO 3758 care symbols. ISO 3758 is not in this repository, so no symbol and no
--     care instruction is transcribed: the five rows are the five categories the standard is built from, with
--     symbol_ref and words null. lib/compliance prints a care line only from a row that has a symbol, words and
--     a source, so no seeded row can reach a label a factory reads.
--   * aql_plans holds the AQL plan, per factory or for every factory. One row is seeded: owner decision 19's
--     Class A sample, inspected piece by piece. No run plan is seeded, because no factory has agreed a level
--     and decision 0070 section 6 says docs/spec/04's "level II, AQL 0 critical / 2.5 major / 4.0 minor" is
--     never assumed on a factory's behalf.
--
-- Rights follow country_rules (decision 0071): catalogue data every signed-in member may read, written only by
-- the server's key after the app has checked the caller is a platform admin. Each row keeps who changed it last.
--
-- rule_id: every row says which rulebook entry explains it, as plain text (plan v5, "Every rule explains
-- itself"). R-LAB-002 is the care label entry, R-LAB-003 the PFAS-free one and R-QC-001 the AQL one; all three
-- are seeded in draft by 20261101020000_rulebook.sql. A value no entry covers is 'R-GAP-000'.

-- ---------------------------------------------------------------------------------------------
-- The ISO 3758 care symbols.

create table public.care_symbols (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and length(code) <= 48),
  -- The five categories ISO 3758 is built from.
  kind text not null check (kind in ('washing', 'bleaching', 'drying', 'ironing', 'professional')),
  -- The standard's own reference for the symbol, such as a figure number. Null: not transcribed from the standard.
  symbol_ref text check (length(symbol_ref) <= 120),
  -- The plain words a factory reads beside the symbol. Null: nobody has written them.
  words text check (length(words) <= 200),
  -- BCP 47. The wording is per language, because a market may require its own.
  language text not null default 'en' check (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  -- Where the words came from, quoted. Null: nowhere, and lib/compliance keeps the row off every label.
  source text check (length(source) <= 300),
  source_kind text check (source_kind in ('standard', 'supplier', 'factory', 'knitwright')),
  -- True only once a person with a licensed copy of the standard has checked the row.
  confirmed boolean not null default false,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 300),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A row that claims words claims a source for them.
  check (words is null or source is not null),
  -- A confirmed row is a whole row.
  check (not confirmed or (symbol_ref is not null and words is not null and source is not null))
);

comment on table public.care_symbols is
  'Platform data: the ISO 3758 care symbols. Read by signed-in members, written by the server only (decision 0089). A row with no symbol, words or source never reaches a label.';

-- ---------------------------------------------------------------------------------------------
-- The AQL plan. factory_id null: the plan applies to every factory.

create table public.aql_plans (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references public.factories (id) on delete cascade,
  scope text not null check (scope in ('class_a_sample', 'run')),
  -- Owner decision 19: a Class A sample Knitwright makes is inspected piece by piece, whoever sews it.
  inspect_every_piece boolean not null default false,
  -- The inspection level, such as 'II'. Null: none agreed.
  inspection_level text check (length(inspection_level) <= 8),
  -- Acceptance quality limits, in percent. Null: none agreed.
  critical_aql numeric(4, 1) check (critical_aql between 0 and 100),
  major_aql numeric(4, 1) check (major_aql between 0 and 100),
  minor_aql numeric(4, 1) check (minor_aql between 0 and 100),
  source text check (length(source) <= 300),
  confirmed boolean not null default false,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 300),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (factory_id, scope),
  -- A plan that names a level says where the level came from.
  check (inspection_level is null or source is not null),
  -- A plan either inspects every piece or names a level: an empty plan is not a plan.
  check (inspect_every_piece or inspection_level is not null)
);

-- One plan per scope for every factory at once, beside the per-factory ones.
create unique index aql_plans_every_factory_idx on public.aql_plans (scope) where factory_id is null;
create index aql_plans_factory_idx on public.aql_plans (factory_id);

comment on table public.aql_plans is
  'Platform data: the AQL plan per factory, or for every factory when factory_id is null. Read by signed-in members, written by the server only (decision 0089).';

-- ---------------------------------------------------------------------------------------------
-- Rights and row level security, as country_rules (decision 0071).

revoke all on public.care_symbols, public.aql_plans from public, anon, authenticated, service_role;
grant select on public.care_symbols, public.aql_plans to authenticated;
grant select, insert, update on public.care_symbols, public.aql_plans to service_role;

alter table public.care_symbols enable row level security;
alter table public.aql_plans enable row level security;

create policy "members read care symbols"
  on public.care_symbols for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

create policy "members read aql plans"
  on public.aql_plans for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

-- There are no insert, update or delete policies on purpose.

-- ---------------------------------------------------------------------------------------------
-- Seed: the five ISO 3758 categories, with no symbol and no instruction.

insert into public.care_symbols (code, kind, source, source_kind, rule_id, label) values
  ('ISO3758-WASHING', 'washing', 'ISO 3758:2012, the washing category', 'standard', 'R-LAB-002',
   'Knitwright draft: the category only. ISO 3758 is not in this repository, so no symbol and no washing instruction is transcribed.'),
  ('ISO3758-BLEACHING', 'bleaching', 'ISO 3758:2012, the bleaching category', 'standard', 'R-LAB-002',
   'Knitwright draft: the category only. ISO 3758 is not in this repository, so no symbol and no bleaching instruction is transcribed.'),
  ('ISO3758-DRYING', 'drying', 'ISO 3758:2012, the drying category', 'standard', 'R-LAB-002',
   'Knitwright draft: the category only. ISO 3758 is not in this repository, so no symbol and no drying instruction is transcribed.'),
  ('ISO3758-IRONING', 'ironing', 'ISO 3758:2012, the ironing category', 'standard', 'R-LAB-002',
   'Knitwright draft: the category only. ISO 3758 is not in this repository, so no symbol and no ironing instruction is transcribed.'),
  ('ISO3758-PROFESSIONAL', 'professional', 'ISO 3758:2012, the professional textile care category', 'standard', 'R-LAB-002',
   'Knitwright draft: the category only. ISO 3758 is not in this repository, so no symbol and no professional care instruction is transcribed.');

-- Seed: owner decision 19's Class A sample. No run plan, per decision 0070 section 6.
insert into public.aql_plans (factory_id, scope, inspect_every_piece, source, rule_id, label) values
  (null, 'class_a_sample', true, 'Owner decision 19 (plans/platform-v5.md) and decision 0070, section 6', 'R-QC-001',
   'Knitwright draft from owner decision 19: a Class A sample is inspected piece by piece, whoever sews it. No run plan is seeded: no factory has agreed a level.');

-- ---------------------------------------------------------------------------------------------
-- Seed: the care-label wording per market. X6 left label_rules as {} with a note saying the wording was still
-- to be written (decision 0071). This writes down only what a source in this repository states.
--
-- The top-level `origin` key is the shape lib/kpp/input/labels.ts already reads; `lines` is the same wording
-- with its source and its confirmed flag per line, which lib/compliance reads. Both describe one label.

update public.country_rules set
  label_rules = jsonb_build_object(
    'version', 1,
    'label', 'Knitwright draft v0.1, not reviewed by a factory or a legal adviser',
    'origin', 'Made in Pakistan',
    'lines', jsonb_build_object(
      'fibre', jsonb_build_object(
        'text', null, 'language', 'en', 'order', 'descending_percentage', 'confirmed', false,
        'source', 'Rulebook R-LAB-002 (draft): UK Textile Products regulations. Confirm with a legal consult'),
      'care', jsonb_build_object('symbolCodes', jsonb_build_array(), 'confirmed', false, 'source', null),
      'origin', jsonb_build_object(
        'text', 'Made in Pakistan', 'confirmed', false,
        'source', 'docs/spec/04-production-package.md, section 07_labels'),
      'size', jsonb_build_object('text', null, 'confirmed', false, 'source', null),
      'importer', jsonb_build_object('text', null, 'required', null, 'confirmed', false, 'source', null)
    )
  ),
  label = 'Placeholder, to confirm with a customs adviser. Label wording is a Knitwright draft (decision 0089); the care symbols, the size wording and the importer requirement are not written.',
  rule_id = 'R-LAB-002',
  updated_at = now()
where country = 'GB';

update public.country_rules set
  label_rules = jsonb_build_object(
    'version', 1,
    'label', 'Knitwright draft v0.1, not reviewed by a factory or a legal adviser',
    'origin', 'Made in Pakistan',
    'lines', jsonb_build_object(
      'fibre', jsonb_build_object(
        'text', null, 'language', 'en', 'order', 'descending_percentage', 'confirmed', false,
        'source', 'Rulebook R-LAB-002 (draft): Australian care labelling standard. Confirm with a legal consult'),
      'care', jsonb_build_object('symbolCodes', jsonb_build_array(), 'confirmed', false, 'source', null),
      'origin', jsonb_build_object(
        'text', 'Made in Pakistan', 'confirmed', false,
        'source', 'docs/spec/04-production-package.md, section 07_labels'),
      'size', jsonb_build_object('text', null, 'confirmed', false, 'source', null),
      'importer', jsonb_build_object('text', null, 'required', null, 'confirmed', false, 'source', null)
    )
  ),
  label = 'Placeholder, to confirm with a customs adviser. Label wording is a Knitwright draft (decision 0089); the care symbols, the size wording and the importer requirement are not written.',
  rule_id = 'R-LAB-002',
  updated_at = now()
where country = 'AU';

-- The United States needs CPSIA testing before anything is sold there, and children's sizes need it wherever
-- they are sold (spec F-G3). No test certificate exists, so no wording is written and the market stays closed.
update public.country_rules set
  label_rules = jsonb_build_object(
    'version', 1,
    'label', 'Market closed at launch. No label wording is written: a sale here needs CPSIA testing, which does not exist (spec F-G3).',
    'cpsiaRequired', true,
    'cpsiaSource', 'docs/spec/02-features.md, F-G3',
    'lines', jsonb_build_object(
      'fibre', jsonb_build_object('text', null, 'language', null, 'order', null, 'confirmed', false, 'source', null),
      'care', jsonb_build_object('symbolCodes', jsonb_build_array(), 'confirmed', false, 'source', null),
      'origin', jsonb_build_object('text', null, 'confirmed', false, 'source', null),
      'size', jsonb_build_object('text', null, 'confirmed', false, 'source', null),
      'importer', jsonb_build_object('text', null, 'required', null, 'confirmed', false, 'source', null)
    )
  ),
  label = 'Placeholder, market closed at launch. CPSIA testing does not exist, so no label wording is written (decision 0089).',
  updated_at = now()
where country = 'US';

-- The European Union requires fibre content in the languages of the member state of sale. Which languages, and
-- in what order, is not stated anywhere in this repository, so nothing is written.
update public.country_rules set
  label_rules = jsonb_build_object(
    'version', 1,
    'label', 'Market closed at launch. No label wording is written: the languages a member state requires are not recorded anywhere here.',
    'lines', jsonb_build_object(
      'fibre', jsonb_build_object('text', null, 'language', null, 'order', null, 'confirmed', false, 'source', null),
      'care', jsonb_build_object('symbolCodes', jsonb_build_array(), 'confirmed', false, 'source', null),
      'origin', jsonb_build_object('text', null, 'confirmed', false, 'source', null),
      'size', jsonb_build_object('text', null, 'confirmed', false, 'source', null),
      'importer', jsonb_build_object('text', null, 'required', null, 'confirmed', false, 'source', null)
    )
  ),
  label = 'Placeholder, market closed at launch. The label languages a member state requires are not recorded (decision 0089).',
  updated_at = now()
where country = 'EU';
