-- Factory model as data (plans/platform-v5.md, workstream X6; decision 0071).
--
-- Factories, what each makes (factory x base article x fabric), the price ladder of each capability, the
-- fabric programme with its stock colours, and country rules. Every price, tier, lead time and rule is a
-- row here, never a literal in code. Money is integer minor units plus an ISO currency.
--
-- Who reaches what:
--   factories, factory_capabilities, price_tiers: no browser role at all. They carry the factory's contact
--     and cost prices (spec decision 1: factories must not be cut in or out by a customer). The server reads
--     them with its own key, and only for a platform admin or to work out a price or a date.
--   programme_fabrics, programme_fabric_colours, country_rules: catalogue data every signed-in member may read
--     (fabric spec cards, VAT treatment). No visitor.
--   Writes: the server's key only, after the app has checked the caller is a platform admin (as factory_profiles,
--     decision 0039). Each row keeps who changed it last and when.
--
-- Every seeded row is a placeholder and says so in its label. No earlier migration is edited.
--
-- rule_id: every row that carries a range, an option or a term says which rulebook entry explains it
-- (plan v5, "Every rule explains itself"). It is plain text, not a foreign key: the rulebook is another
-- workstream's table (X2, decision 0067). A value with no entry yet is 'R-GAP-000', which that workstream
-- seeds as "No rule written yet; the team has been told".

-- ---------------------------------------------------------------------------------------------
-- The fabric programme (spec F-S8). A small set of fabrics with a fixed palette.

create table public.programme_fabrics (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^F-[A-Z0-9]+(-[A-Z0-9]+)*$' and length(code) <= 32),
  name text not null check (length(btrim(name)) between 1 and 120),
  production_class text not null check (production_class in ('A', 'B')),
  blend text not null check (length(btrim(blend)) between 1 and 200),
  gsm_min integer check (gsm_min between 1 and 2000),
  gsm_max integer check (gsm_max between 1 and 2000),
  stretch text check (length(stretch) <= 120),
  finish text check (length(finish) <= 120),
  -- Null: not confirmed.
  pfas_free boolean,
  oeko_tex_cert text check (length(oeko_tex_cert) <= 120),
  sublimatable boolean,
  swatch_ref text check (length(swatch_ref) <= 120),
  -- The rulebook entry that explains this row's values ('R-GAP-000' while none is written).
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 200),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gsm_min is null or gsm_max is null or gsm_min <= gsm_max)
);

comment on table public.programme_fabrics is
  'Platform data: the fabric programme. Read by signed-in members, written by the server only (decision 0071).';

create table public.programme_fabric_colours (
  id uuid primary key default gen_random_uuid(),
  fabric_code text not null references public.programme_fabrics (code) on update cascade on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  hex text not null check (hex ~ '^#[0-9A-F]{6}$'),
  -- CIE Lab, null until measured from the physical swatch.
  lab_l numeric(6, 2) check (lab_l between 0 and 100),
  lab_a numeric(6, 2) check (lab_a between -128 and 128),
  lab_b numeric(6, 2) check (lab_b between -128 and 128),
  pantone text check (length(pantone) <= 40),
  label text not null check (length(btrim(label)) between 1 and 200),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fabric_code, name),
  check ((lab_l is null) = (lab_a is null) and (lab_a is null) = (lab_b is null))
);

comment on table public.programme_fabric_colours is
  'Platform data: stock colours of a programme fabric. Read by signed-in members, written by the server only (decision 0071).';

-- ---------------------------------------------------------------------------------------------
-- Factories and what they make.

create table public.factories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  name text not null check (length(btrim(name)) between 1 and 120),
  city text not null check (length(btrim(city)) between 1 and 120),
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- The factory's own clock: the weekly cut-off is read in this zone. The app checks it is a real IANA zone.
  time_zone text not null check (length(time_zone) between 1 and 64),
  -- E.164, null while not given.
  contact_whatsapp text check (contact_whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  -- [{"name": "...", "expiresOn": "YYYY-MM-DD" | null, "documentRef": "..." | null}]. Checked by the app.
  certifications jsonb not null default '[]'::jsonb check (jsonb_typeof(certifications) = 'array'),
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'paused', 'retired')),
  label text not null check (length(btrim(label)) between 1 and 200),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.factories is
  'Platform data: partner factories. No browser role reads it; the server does, for platform admins (decision 0071).';

create table public.factory_capabilities (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories (id) on delete cascade,
  -- The spec's base article code. Plain text, not a foreign key: the catalogue is another workstream's table.
  article_code text not null check (article_code ~ '^[A-Z]{3}-[A-Z]{2}-[0-9]{2}$'),
  -- The garment registry type the article is made as today, so the factory profile lists it under the id the
  -- validation gate knows. Null when no registry type maps to it yet.
  garment_type_id text check (garment_type_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(garment_type_id) <= 64),
  fabric_code text not null references public.programme_fabrics (code) on update cascade on delete restrict,
  -- Working days (Monday to Friday) from the cut-off to ready for QC. Null: not agreed.
  lead_time_days integer check (lead_time_days between 1 and 365),
  moq integer check (moq between 1 and 1000000),
  -- Pieces per weekly Class A print slot. Null: not agreed.
  weekly_slot_capacity integer check (weekly_slot_capacity between 0 and 1000000),
  file_formats text[] not null default '{}' check (cardinality(file_formats) <= 20),
  golden_sample_status text not null default 'none'
    check (golden_sample_status in ('none', 'requested', 'approved', 'rejected')),
  -- Largest colour difference (delta E CMC 2:1) the factory holds on this fabric. Null: not agreed.
  colour_delta_max numeric(5, 2) check (colour_delta_max between 0 and 100),
  -- The rulebook entry that explains this row's values ('R-GAP-000' while none is written).
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 200),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (factory_id, article_code, fabric_code)
);

comment on table public.factory_capabilities is
  'Platform data: what a factory makes, on which fabric, on what terms. Server only (decision 0071).';

create table public.price_tiers (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references public.factory_capabilities (id) on delete cascade,
  qty_min integer not null check (qty_min between 1 and 1000000),
  -- Null: no upper bound.
  qty_max integer check (qty_max between 1 and 1000000),
  -- What Knitwright pays the factory, per piece. Both or neither.
  cost_minor bigint check (cost_minor between 0 and 100000000),
  cost_currency text check (cost_currency ~ '^[A-Z]{3}$'),
  -- What Knitwright sells at, per piece, names and numbers included. Null: not set for that market.
  sell_gbp_minor bigint check (sell_gbp_minor between 0 and 100000000),
  sell_aud_minor bigint check (sell_aud_minor between 0 and 100000000),
  -- What personalisation costs per piece, in the cost currency.
  personalisation_cost_minor bigint check (personalisation_cost_minor between 0 and 100000000),
  -- The rulebook entry that explains this row's values ('R-GAP-000' while none is written).
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 200),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (capability_id, qty_min),
  check (qty_max is null or qty_max >= qty_min),
  check ((cost_minor is null) = (cost_currency is null)),
  check (personalisation_cost_minor is null or cost_currency is not null)
);

comment on table public.price_tiers is
  'Platform data: cost and sell price ladders per capability. Server only (decision 0071).';

-- ---------------------------------------------------------------------------------------------
-- Country rules (spec decision 3): markets open later without a schema change.

create table public.country_rules (
  id uuid primary key default gen_random_uuid(),
  -- ISO 3166 alpha-2, or EU for the union as a whole.
  country text not null unique check (country ~ '^[A-Z]{2}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Basis points: 2000 is 20%. Null: not set.
  vat_rate_bp integer check (vat_rate_bp between 0 and 10000),
  -- The import low-value threshold, in minor units of the country's currency. Null: none or not set.
  low_value_threshold_minor bigint check (low_value_threshold_minor between 0 and 100000000000),
  -- {"6110.30": 1200}: duty in basis points by HS code. Checked by the app.
  duty_by_hs jsonb not null default '{}'::jsonb check (jsonb_typeof(duty_by_hs) = 'object'),
  preference_scheme text check (length(preference_scheme) <= 120),
  label_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(label_rules) = 'object'),
  -- Calendar days from the factory to the customer. Null: not agreed with a carrier.
  freight_days integer check (freight_days between 0 and 120),
  selling_enabled boolean not null default false,
  -- The rulebook entry that explains this row's values ('R-GAP-000' while none is written).
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 200),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.country_rules is
  'Platform data: market rules (VAT, low-value threshold, duty, labels). Read by signed-in members, written by the server only (decision 0071).';

-- ---------------------------------------------------------------------------------------------
-- Rights and row level security.

revoke all on public.factories, public.factory_capabilities, public.price_tiers from public, anon, authenticated, service_role;
grant select, insert, update on public.factories, public.factory_capabilities, public.price_tiers to service_role;

revoke all on public.programme_fabrics, public.programme_fabric_colours, public.country_rules from public, anon, authenticated, service_role;
grant select on public.programme_fabrics, public.programme_fabric_colours, public.country_rules to authenticated;
grant select, insert, update on public.programme_fabrics, public.programme_fabric_colours, public.country_rules to service_role;

alter table public.factories enable row level security;
alter table public.factory_capabilities enable row level security;
alter table public.price_tiers enable row level security;
alter table public.programme_fabrics enable row level security;
alter table public.programme_fabric_colours enable row level security;
alter table public.country_rules enable row level security;

-- No policy on factories, factory_capabilities or price_tiers: no browser role reaches them.

create policy "members read programme fabrics"
  on public.programme_fabrics for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

create policy "members read programme fabric colours"
  on public.programme_fabric_colours for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

create policy "members read country rules"
  on public.country_rules for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

-- There are no insert, update or delete policies on purpose.

create index factory_capabilities_factory_idx on public.factory_capabilities (factory_id);
create index factory_capabilities_fabric_idx on public.factory_capabilities (fabric_code);
create index price_tiers_capability_idx on public.price_tiers (capability_id);
create index programme_fabric_colours_fabric_idx on public.programme_fabric_colours (fabric_code);

-- ---------------------------------------------------------------------------------------------
-- Seed. Every value is a placeholder from the build pack (docs/spec/01-product-direction.md) and says so.

-- The six launch fabric codes (docs/spec/01-product-direction.md, launch catalogue). The sublimated ones are
-- explained by R-SUB-001 ("only white polyester-rich fabric is sublimated"); the Class B stock fabrics have no
-- rulebook entry yet, so they carry R-GAP-000.
insert into public.programme_fabrics (code, name, production_class, blend, gsm_min, gsm_max, stretch, sublimatable, rule_id, label) values
  ('F-POLY-INT', 'Polyester interlock', 'A', '100% polyester', 140, 160, null, true, 'R-SUB-001',
   'Placeholder from the build pack, not confirmed in the Phase 0 factory test'),
  ('F-POLY-PQ', 'Polyester pique', 'A', '100% polyester', 160, 160, null, true, 'R-SUB-001',
   'Placeholder from the build pack, not confirmed in the Phase 0 factory test'),
  ('F-POLY-EL', 'Polyester elastane', 'A', '85% polyester, 15% elastane', 200, 220, null, true, 'R-SUB-001',
   'Placeholder from the build pack, not confirmed in the Phase 0 factory test'),
  ('F-POLY-4W', 'Polyester 4-way stretch woven', 'A', 'Polyester, blend to confirm', null, null, '4-way', true, 'R-SUB-001',
   'Placeholder from the build pack, not confirmed in the Phase 0 factory test'),
  ('F-STK-TEE', 'Stock tee fabric', 'B', 'Polyester or cotton-polyester, to confirm', null, null, null, null, 'R-GAP-000',
   'Placeholder from the build pack, not confirmed in the Phase 0 factory test'),
  ('F-STK-FLC', 'Stock fleece', 'B', 'Polyester fleece, to confirm', null, null, null, null, 'R-GAP-000',
   'Placeholder from the build pack, not confirmed in the Phase 0 factory test');

insert into public.programme_fabric_colours (fabric_code, name, hex, label)
select f.code, c.name, c.hex, 'Placeholder stock colour, no swatch measured'
from (values ('F-STK-TEE'), ('F-STK-FLC')) as f(code)
cross join (values ('Black', '#111111'), ('White', '#FFFFFF'), ('Navy', '#1F2A44')) as c(name, hex);

insert into public.factories (slug, name, city, country, time_zone, status, label) values
  ('sialkot-partner', 'Sialkot partner (placeholder)', 'Sialkot', 'PK', 'Asia/Karachi', 'onboarding',
   'Placeholder, not agreed with a factory');

-- Class A from one piece (spec decision 4), 8 working days (top of the spec's 5 to 8), the build pack's file set
-- (spec decision 6) and the colour tolerance of rule R-SUB-005. Slot capacity is not set. The row's rule_id is
-- R-GAP-000: no rulebook entry explains a lead time, a minimum order or a weekly slot yet.
insert into public.factory_capabilities
  (factory_id, article_code, garment_type_id, fabric_code, lead_time_days, moq, file_formats, colour_delta_max, rule_id, label)
select f.id, a.code, a.type_id, 'F-POLY-INT', 8, 1, array['pdf', 'svg', 'eps', 'dxf'], 1.5, 'R-GAP-000',
       'Placeholder from the build pack (colour tolerance from rule R-SUB-005), not agreed with a factory'
from public.factories f
cross join (values ('JSY-SS-01', 'football-shirt'), ('SHO-TR-01', 'football-shorts')) as a(code, type_id)
where f.slug = 'sialkot-partner';

-- The club price ladder for a jersey, names and numbers included: 10-19 at GBP 29, 20-49 at GBP 25, 50+ at GBP 22.
-- No cost (the factory quotes are supplier claims, not agreed), no AUD price, no shorts price: all not set.
insert into public.price_tiers (capability_id, qty_min, qty_max, sell_gbp_minor, rule_id, label)
select c.id, t.qty_min, t.qty_max, t.sell, 'R-COST-003', 'Placeholder club price from the build pack, not a factory quote'
from public.factory_capabilities c
join public.factories f on f.id = c.factory_id and f.slug = 'sialkot-partner'
cross join (values (10, 19, 2900), (20, 49, 2500), (50, null::integer, 2200)) as t(qty_min, qty_max, sell)
where c.article_code = 'JSY-SS-01';

-- UK first, Australia second; US and EU present but closed (spec decision 3). Rates are public figures to confirm
-- with a customs adviser; duty by HS code and freight days are not set.
-- rule_id is R-GAP-000 on all four: no rulebook entry covers VAT, duty or a low-value threshold. R-LAB-002
-- (fibre, care and origin per destination market) will explain label_rules once those are written.
insert into public.country_rules
  (country, name, currency, vat_rate_bp, low_value_threshold_minor, preference_scheme, selling_enabled, label) values
  ('GB', 'United Kingdom', 'GBP', 2000, 13500, 'DCTS', true, 'Placeholder, to confirm with a customs adviser'),
  ('AU', 'Australia', 'AUD', 1000, 100000, null, true, 'Placeholder, to confirm with a customs adviser'),
  ('US', 'United States', 'USD', null, null, null, false, 'Placeholder, market closed at launch'),
  ('EU', 'European Union', 'EUR', null, null, null, false, 'Placeholder, market closed at launch');
