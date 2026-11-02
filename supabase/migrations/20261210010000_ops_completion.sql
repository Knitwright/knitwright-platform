-- Ops completion (plans/platform-v5.md, wave 5, workstream O1; decision 0100).
--
-- Continues 20261025050000_ops_batches.sql and 20261026040000_ops_qc.sql and copies their patterns exactly:
-- every table here is read by platform admins only, no browser role writes anything, every write is a
-- function that only the server's key may run and that checks the actor is a platform admin itself, and
-- every record (a colour reading, a booking, an invoice, an email, a parcel) is append-only. A correction is
-- a new record, never a change to an old one.
--
-- What this migration adds:
--   * the scheduled cut (F-O1): `ops_cut_runs` and `ops_cut_scheduled`, so a cron that fires twice in one
--     week cuts one set of batches and no more. The cut-off itself stays a setting in `ops_settings`; the
--     schedule only asks "has a cut-off passed".
--   * the AQL sampling table (F-O3): `ops_aql_sample_plans` and `ops_aql_acceptance`, as rows, never
--     literals in code. EVERY SEEDED ROW IS MARKED `sourced = false` AND ITS SOURCE IS NULL. See the seed.
--   * typed Delta-E readings on an inspection (F-O3): `ops_qc_colour_readings`.
--   * third-party inspection for a run over the seeded piece threshold (F-O3): `ops_inspection_bookings`.
--   * the commercial invoice as a record (F-O4): `ops_commercial_invoices`, with the HS code and the origin
--     read from the catalogue and the country rules, never invented here.
--   * couriers as data (F-O4): `ops_couriers`, and the courier columns a shipment now keeps.
--   * customer status emails (F-O4): `ops_customer_emails`, a record of what was sent, or of why nothing was.
--
-- Nothing here invents a measurement, a rate or a lead time. No delivery date is computed anywhere: QC days
-- and freight days are both unset (decision 0071), so every screen and every document names what is missing
-- instead of a date. The acceptable defect rate is owner question Q25 and is still unanswered, so no row and
-- no function here calls a defect rate acceptable.
--
-- Personal data. `ops_customer_emails` keeps the address a status email went to, which is personal data: it
-- is tied to the brand and goes with it (account erasure), like every other table of part 2. The other
-- tables here hold no names.
--
-- rule_id: every row that carries a rule, a range or a judgement says which rulebook entry explains it
-- (plan v5, "Every rule explains itself"). Plain text, not a foreign key. 'R-GAP-000' where no entry exists.

-- ---------------------------------------------------------------------------------------------
-- F-O1. The scheduled cut.

create table public.ops_cut_runs (
  id uuid primary key default gen_random_uuid(),
  -- The cut-off this run cut for: the latest cut-off at or before the run's clock. Unique, and that is what
  -- makes the job idempotent: a second fire in the same week inserts nothing and cuts nothing.
  cut_for timestamptz not null unique,
  orders_batched integer not null default 0 check (orders_batched >= 0),
  -- Null: nobody pressed the button, the schedule ran it. A scheduled cut has no human actor.
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

comment on table public.ops_cut_runs is
  'One run of the weekly cut, one row per cut-off. Append-only. Its unique cut_for is what makes a repeated run do nothing.';

-- ---------------------------------------------------------------------------------------------
-- F-O3. The AQL sampling table, as data.

create table public.ops_aql_sample_plans (
  id uuid primary key default gen_random_uuid(),
  -- ISO 2859-1 / ANSI-ASQ Z1.4 sample size code letter.
  code_letter text not null unique check (code_letter ~ '^[A-R]$'),
  -- The general inspection level the row belongs to. 'II' is the one the spec names (F-O3).
  inspection_level text not null default 'II' check (inspection_level in ('I', 'II', 'III')),
  lot_min integer not null check (lot_min >= 1),
  -- Null: no upper bound (the largest band).
  lot_max integer check (lot_max >= 1),
  sample_size integer not null check (sample_size between 1 and 100000),
  -- The published document this row was read out of, word for word. NULL MEANS NOBODY HAS CITED ONE.
  source text check (length(btrim(source)) between 1 and 300),
  -- False until someone has checked the row against a copy of the standard. A row that is not verified may
  -- be shown, with its label, and may never decide whether an order ships.
  sourced boolean not null default false,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 400),
  created_at timestamptz not null default now(),
  check (lot_max is null or lot_max >= lot_min),
  check (source is not null or not sourced)
);

comment on table public.ops_aql_sample_plans is
  'Lot size band to sample size code letter to sample size, per inspection level. Platform data. Every seeded row is unverified.';

create table public.ops_aql_acceptance (
  id uuid primary key default gen_random_uuid(),
  code_letter text not null references public.ops_aql_sample_plans (code_letter) on update cascade on delete cascade,
  -- The AQL column: 0 (no critical defect accepted), 2.50 (major) and 4.00 (minor) are the three the spec names.
  aql numeric(5, 3) not null check (aql >= 0 and aql <= 1000),
  -- What the AQL column is for, in the spec's words: critical, major or minor.
  defect_class text not null check (defect_class in ('critical', 'major', 'minor')),
  -- Accept at this many defects, reject at this many. Both or neither: a row with neither is an arrow.
  accept_at integer check (accept_at >= 0),
  reject_at integer check (reject_at >= 1),
  -- The table's arrow: "use the first sampling plan at this code letter instead".
  use_code_letter text check (use_code_letter ~ '^[A-R]$'),
  source text check (length(btrim(source)) between 1 and 300),
  sourced boolean not null default false,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 400),
  created_at timestamptz not null default now(),
  unique (code_letter, aql),
  constraint ops_aql_acceptance_pair check ((accept_at is null) = (reject_at is null)),
  constraint ops_aql_acceptance_single_sampling check (reject_at is null or reject_at = accept_at + 1),
  constraint ops_aql_acceptance_is_plan_or_arrow check ((accept_at is null) <> (use_code_letter is null)),
  constraint ops_aql_acceptance_source_or_unsourced check (source is not null or not sourced)
);

comment on table public.ops_aql_acceptance is
  'Accept and reject numbers per code letter and AQL, or the arrow to another letter. Platform data. Every seeded row is unverified.';

create index ops_aql_acceptance_aql_idx on public.ops_aql_acceptance (aql, code_letter);

-- ---------------------------------------------------------------------------------------------
-- F-O3. Typed Delta-E readings on an inspection.

create table public.ops_qc_colour_readings (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.ops_qc_inspections (id) on delete restrict,
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  colour_name text not null check (length(btrim(colour_name)) between 1 and 60),
  target_hex text check (target_hex ~ '^#[0-9A-F]{6}$'),
  -- The two Lab values the reading was computed from, so the number can be checked later. Exact decimals,
  -- never floats, as golden_sample_colour_readings keeps them.
  target_l numeric(6, 2),
  target_a numeric(6, 2),
  target_b numeric(6, 2),
  measured_l numeric(6, 2),
  measured_a numeric(6, 2),
  measured_b numeric(6, 2),
  -- Typed by the inspector off the instrument. Never computed from a hex code here.
  delta_e numeric(6, 3) not null check (delta_e >= 0 and delta_e <= 200),
  -- What it was judged against, copied from the factory's own tolerance at the time of the reading, so the
  -- judgement can be checked later. Null: no tolerance is on file, and nothing says whether the reading passes.
  limit_delta_e numeric(6, 3) check (limit_delta_e >= 0 and limit_delta_e <= 200),
  -- Which difference formula, which instrument, which white point, which observer. Null means nobody stated
  -- it: it is never filled in for them (the same rule as on a golden sample's readings).
  method text check (length(btrim(method)) between 1 and 40),
  instrument text check (length(btrim(instrument)) between 1 and 120),
  white_point text check (length(btrim(white_point)) between 1 and 40),
  observer text check (length(btrim(observer)) between 1 and 40),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  check ((target_l is null) = (target_a is null) and (target_a is null) = (target_b is null)),
  check ((measured_l is null) = (measured_a is null) and (measured_a is null) = (measured_b is null))
);

comment on table public.ops_qc_colour_readings is
  'A Delta-E reading taken at inspection, with what it was judged against. Append-only. Written by ops_record_inspection only.';

create index ops_qc_colour_readings_inspection_idx on public.ops_qc_colour_readings (inspection_id, colour_name);
create index ops_qc_colour_readings_order_idx on public.ops_qc_colour_readings (order_id, at desc);
create index ops_qc_colour_readings_brand_idx on public.ops_qc_colour_readings (brand_id);

-- The sampling plan the inspection was taken under, when one was on file. Null: none was, and the screen
-- says so rather than naming a sample size nobody agreed.
alter table public.ops_qc_inspections add column aql_code_letter text check (aql_code_letter ~ '^[A-R]$');

-- ---------------------------------------------------------------------------------------------
-- F-O3. Third-party inspection, booked for a run over the seeded piece threshold.

create table public.ops_inspection_bookings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- 'stub' is the only provider that exists. A real inspection house becomes another value, behind a key.
  provider text not null check (length(btrim(provider)) between 1 and 40),
  -- The provider's own reference for the booking. The stub derives one from the order, so it is deterministic.
  reference text not null check (length(btrim(reference)) between 1 and 120),
  pieces integer not null check (pieces >= 1),
  requested_on date not null,
  -- Null: the provider gave no date. No date is invented, and none is shown.
  inspect_on date,
  state text not null check (state in ('requested', 'booked', 'not_available')),
  -- What the provider said, in its own words, or why nothing was booked.
  outcome text not null default '' check (length(outcome) <= 300),
  note text not null default '' check (length(note) <= 300),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

comment on table public.ops_inspection_bookings is
  'A third-party inspection asked for on an order. Append-only: a change of plan is a new booking.';

create index ops_inspection_bookings_order_idx on public.ops_inspection_bookings (order_id, at desc);
create index ops_inspection_bookings_brand_idx on public.ops_inspection_bookings (brand_id);

-- ---------------------------------------------------------------------------------------------
-- F-O4. Couriers as data, and the columns a shipment keeps about one.

create table public.ops_couriers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(code) <= 40),
  name text not null check (length(btrim(name)) between 1 and 80),
  -- 'manual': ops types the tracking number in. Another value is an adapter that books a label, behind a key.
  provider text not null default 'manual' check (length(btrim(provider)) between 1 and 40),
  -- `https://…/{tracking}`: the number goes where {tracking} is. Null: this courier has no tracking page on
  -- file, and the platform invents no address. Checked without a regular expression on purpose — a pattern
  -- that has to match the literal braces trips Postgres's own counting of `{...}` repetitions.
  tracking_url_template text check (
    tracking_url_template is null
    or (tracking_url_template like 'https://%'
        and position('{tracking}' in tracking_url_template) > 0
        and length(tracking_url_template) between 20 and 320
        and tracking_url_template not like '% %')
  ),
  -- The terms agreed with the courier, in its own words. Empty: nothing is agreed.
  terms text not null default '' check (length(terms) <= 400),
  -- Calendar days this courier takes, when a figure is agreed. Null: not agreed, so no delivery date.
  transit_days integer check (transit_days between 0 and 120),
  active boolean not null default true,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  label text not null check (length(btrim(label)) between 1 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ops_couriers is
  'Platform data: the couriers ops may record a parcel against, and the terms agreed with each. Server only.';

-- A parcel now says which courier row it was recorded against and which provider gave the number. The
-- existing check allowed 'manual' alone; a parcel booked through a courier adapter is 'courier'.
alter table public.ops_shipments drop constraint ops_shipments_provider_check;
alter table public.ops_shipments add constraint ops_shipments_provider_check
  check (provider in ('manual', 'courier'));
alter table public.ops_shipments add column courier_code text references public.ops_couriers (code) on update cascade;
-- Checked without a regular expression for the same reason as the template above, and for one more: a POSIX
-- repetition count may not exceed 255, so `{1,320}` is not a pattern Postgres will even compile.
alter table public.ops_shipments add column tracking_url text
  check (
    tracking_url is null
    or (tracking_url like 'https://%' and length(tracking_url) between 9 and 320 and tracking_url not like '% %')
  );

-- ---------------------------------------------------------------------------------------------
-- F-O4. The commercial invoice as a record.

create table public.ops_commercial_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- 1 for the first invoice of an order, 2 for a correction, and so on.
  invoice_no integer not null check (invoice_no between 1 and 999),
  -- The invoice this one corrects, when it corrects one. An invoice is never edited. No "on delete" clause
  -- on purpose: a brand's erasure removes every invoice of that brand in one statement, and `restrict` would
  -- refuse that the moment one invoice replaced another. The default check lets the statement finish.
  replaces_id uuid references public.ops_commercial_invoices (id),
  issued_on date not null,
  -- Where the goods were made and where they are going, as ISO country codes.
  origin_country text not null check (origin_country ~ '^[A-Z]{2}$'),
  destination_country text not null check (destination_country ~ '^[A-Z]{2}$'),
  -- The preference scheme claimed, from country_rules (DCTS for the United Kingdom). Null: none claimed.
  preference_scheme text check (length(btrim(preference_scheme)) between 1 and 120),
  -- The terms of delivery, in the words ops typed. Empty: not stated, and none is assumed.
  incoterms text not null default '' check (length(incoterms) <= 40),
  -- [{description, hsCode | null, originCountry, pieces, unitValueMinor | null, lineValueMinor | null}].
  -- Checked by the function. An HS code that is not on file is null and the document says so.
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and pg_column_size(lines) < 16384),
  total_pieces integer not null check (total_pieces >= 1),
  -- The order's own value, as the Store gave it. Null: the Store gave none, and the invoice says so.
  total_value_minor bigint check (total_value_minor >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  -- What the invoice could not state, in plain words, so the document names it rather than guessing.
  missing text[] not null default '{}' check (cardinality(missing) <= 20),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  unique (order_id, invoice_no),
  constraint ops_commercial_invoices_value_with_currency check ((total_value_minor is null) = (currency is null))
);

comment on table public.ops_commercial_invoices is
  'A commercial invoice as issued, with its HS codes and origin. Append-only: a correction is a new invoice that replaces it.';

create index ops_commercial_invoices_order_idx on public.ops_commercial_invoices (order_id, invoice_no desc);
create index ops_commercial_invoices_brand_idx on public.ops_commercial_invoices (brand_id);

-- ---------------------------------------------------------------------------------------------
-- F-O4. Customer status emails.

create table public.ops_customer_emails (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ops_orders (id) on delete restrict,
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- Which status the message was about. The same set as the order's own events.
  kind text not null check (kind in ('batched', 'received', 'in_production', 'ready', 'shipped', 'delayed', 'qc_failed')),
  -- Personal data: the address the message went to. Goes with the brand.
  to_email text not null check (to_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and length(to_email) <= 320),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  -- The words as sent, so ops can see exactly what the customer was told.
  body text not null check (length(body) between 1 and 4000),
  -- The provider that took it, or 'none' when no provider is set up.
  provider text not null check (length(btrim(provider)) between 1 and 40),
  sent boolean not null,
  -- Why nothing was sent. Empty when it was sent.
  reason text not null default '' check (length(reason) <= 300),
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  constraint ops_customer_emails_reason_when_not_sent check (sent or length(btrim(reason)) > 0)
);

comment on table public.ops_customer_emails is
  'A status email to the customer, as sent, or the record of why nothing was sent. Append-only. Holds an address: goes with the brand.';

create index ops_customer_emails_order_idx on public.ops_customer_emails (order_id, at desc);
create index ops_customer_emails_brand_idx on public.ops_customer_emails (brand_id);

-- ---------------------------------------------------------------------------------------------
-- Append-only, except that a brand's erasure may remove its rows, exactly as part 2 allows.

create trigger ops_cut_runs_are_append_only
  before update or delete on public.ops_cut_runs
  for each row execute function private.ops_refuse_change();
create trigger ops_qc_colour_readings_are_append_only
  before update or delete on public.ops_qc_colour_readings
  for each row execute function private.ops_qc_refuse_change();
create trigger ops_inspection_bookings_are_append_only
  before update or delete on public.ops_inspection_bookings
  for each row execute function private.ops_qc_refuse_change();
create trigger ops_commercial_invoices_are_append_only
  before update or delete on public.ops_commercial_invoices
  for each row execute function private.ops_qc_refuse_change();
create trigger ops_customer_emails_are_append_only
  before update or delete on public.ops_customer_emails
  for each row execute function private.ops_qc_refuse_change();

create trigger ops_cut_runs_are_not_truncated
  before truncate on public.ops_cut_runs
  for each statement execute function private.ops_refuse_change();
create trigger ops_qc_colour_readings_are_not_truncated
  before truncate on public.ops_qc_colour_readings
  for each statement execute function private.ops_refuse_change();
create trigger ops_inspection_bookings_are_not_truncated
  before truncate on public.ops_inspection_bookings
  for each statement execute function private.ops_refuse_change();
create trigger ops_commercial_invoices_are_not_truncated
  before truncate on public.ops_commercial_invoices
  for each statement execute function private.ops_refuse_change();
create trigger ops_customer_emails_are_not_truncated
  before truncate on public.ops_customer_emails
  for each statement execute function private.ops_refuse_change();

-- ---------------------------------------------------------------------------------------------
-- Rights and row level security. Platform admins read; nobody in a browser writes. The server's key holds
-- SELECT alone on every append-only table: the writes go through the SECURITY DEFINER functions below.

revoke all on public.ops_cut_runs, public.ops_qc_colour_readings, public.ops_inspection_bookings,
  public.ops_commercial_invoices, public.ops_customer_emails
  from public, anon, authenticated, service_role;
grant select on public.ops_cut_runs, public.ops_qc_colour_readings, public.ops_inspection_bookings,
  public.ops_commercial_invoices, public.ops_customer_emails to authenticated, service_role;

-- The AQL tables and the couriers are platform data, like the factory rows: no browser role reaches them at
-- all. They carry what Knitwright inspects and ships to, and the figures are not agreed with anyone yet.
revoke all on public.ops_aql_sample_plans, public.ops_aql_acceptance, public.ops_couriers
  from public, anon, authenticated, service_role;
grant select on public.ops_aql_sample_plans, public.ops_aql_acceptance, public.ops_couriers to service_role;

alter table public.ops_cut_runs enable row level security;
alter table public.ops_qc_colour_readings enable row level security;
alter table public.ops_inspection_bookings enable row level security;
alter table public.ops_commercial_invoices enable row level security;
alter table public.ops_customer_emails enable row level security;
alter table public.ops_aql_sample_plans enable row level security;
alter table public.ops_aql_acceptance enable row level security;
alter table public.ops_couriers enable row level security;

create policy "platform admins read cut runs"
  on public.ops_cut_runs for select to authenticated using (private.is_platform_admin());
create policy "platform admins read qc colour readings"
  on public.ops_qc_colour_readings for select to authenticated using (private.is_platform_admin());
create policy "platform admins read inspection bookings"
  on public.ops_inspection_bookings for select to authenticated using (private.is_platform_admin());
create policy "platform admins read commercial invoices"
  on public.ops_commercial_invoices for select to authenticated using (private.is_platform_admin());
create policy "platform admins read customer emails"
  on public.ops_customer_emails for select to authenticated using (private.is_platform_admin());

-- No policy on ops_aql_sample_plans, ops_aql_acceptance or ops_couriers: no browser role reaches them.
-- There are no insert, update or delete policies anywhere here, on purpose.

-- ---------------------------------------------------------------------------------------------
-- F-O1. The scheduled cut, made idempotent.
--
-- The cut-off is a setting, so the schedule cannot be the cut-off: the job runs often and asks whether a
-- cut-off has passed since the last run. `ops_cut_runs.cut_for` is unique, so the first run of a week cuts
-- and every later one answers "already cut" and changes nothing.

-- The latest weekly cut-off at or before p_at, in UTC. The mirror of private.next_cutoff.
create function private.last_cutoff(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when private.next_cutoff(p_at) = p_at then p_at
    else private.next_cutoff(p_at) - interval '7 days'
  end;
$$;

-- The loop that cuts the batches. Shared by the button (ops_cut_batches, which checks the actor) and by the
-- schedule (ops_cut_scheduled, which has no human actor). p_actor may be null: the event rows allow it.
create function private.ops_cut_batches_run(p_actor uuid, p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
  v_batch uuid;
  v_count integer := 0;
  v_moved integer;
begin
  for v_group in
    select o.factory_profile_id, o.fabric_key, o.article_id, o.cutoff_at
    from public.ops_orders o
    where o.status = 'submitted' and o.cutoff_at <= p_now
    group by o.factory_profile_id, o.fabric_key, o.article_id, o.cutoff_at
    order by o.cutoff_at, o.factory_profile_id, o.fabric_key, o.article_id
  loop
    insert into public.batches (factory_profile_id, fabric_key, article_id, cutoff_at)
    values (v_group.factory_profile_id, v_group.fabric_key, v_group.article_id, v_group.cutoff_at)
    on conflict (factory_profile_id, fabric_key, article_id, cutoff_at) do update set factory_profile_id = excluded.factory_profile_id
    returning id into v_batch;

    with moved as (
      update public.ops_orders o
      set status = 'batched', batch_id = v_batch, updated_at = now()
      where o.status = 'submitted' and o.cutoff_at = v_group.cutoff_at
        and o.factory_profile_id = v_group.factory_profile_id
        and o.fabric_key = v_group.fabric_key and o.article_id = v_group.article_id
      returning o.id, o.brand_id, o.promised_on
    )
    insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, batch_id, promised_on, actor)
    select m.id, m.brand_id, 'batched', 'submitted', 'batched', v_batch, m.promised_on, p_actor from moved m;
    get diagnostics v_moved = row_count;
    v_count := v_count + v_moved;
  end loop;
  return v_count;
end;
$$;

-- Unchanged behaviour for the button: a platform admin cuts every waiting order whose cut-off has come.
create or replace function public.ops_cut_batches(p_actor uuid, p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  return private.ops_cut_batches_run(p_actor, p_now);
end;
$$;

-- The scheduled cut. No actor: nobody pressed anything, so the order events keep a null actor. Idempotent on
-- the cut-off: a second call for the same cut-off inserts nothing, cuts nothing and answers ran = false.
create function public.ops_cut_scheduled(p_now timestamptz default now())
returns table (cut_for timestamptz, orders_batched integer, ran boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cut_for timestamptz;
  v_count integer;
begin
  v_cut_for := private.last_cutoff(p_now);
  -- Two fires at once would both find no run row, so they are serialised here. The unique cut_for is the
  -- backstop: the second insert would fail even without the lock. The number is this migration's own.
  perform pg_catalog.pg_advisory_xact_lock(20261210010000);
  if exists (select 1 from public.ops_cut_runs r where r.cut_for = v_cut_for) then
    return query select r.cut_for, r.orders_batched, false from public.ops_cut_runs r where r.cut_for = v_cut_for;
    return;
  end if;
  -- The run row is append-only, so it is written once, after the cut, with the count it cut.
  v_count := private.ops_cut_batches_run(null, p_now);
  insert into public.ops_cut_runs (cut_for, orders_batched) values (v_cut_for, v_count);
  return query select v_cut_for, v_count, true;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- F-O3. The inspection, now with typed Delta-E readings and the sampling plan it was taken under.
--
-- The old function is dropped and written again rather than overloaded: an overload with defaults would make
-- every existing call ambiguous. Its behaviour is unchanged except for the two new arguments. A reading with
-- a limit on file that is over that limit fails the inspection; a reading with no limit cannot judge
-- anything, so it never fails it, and the screen says that nothing on file says whether it passes.

create function private.ops_valid_colour_readings(p_readings jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if p_readings is null or jsonb_typeof(p_readings) <> 'array' or jsonb_array_length(p_readings) > 20 then
    return false;
  end if;
  for v_item in select value from jsonb_array_elements(p_readings) loop
    if jsonb_typeof(v_item) <> 'object'
       or length(btrim(coalesce(v_item ->> 'colourName', ''))) not between 1 and 60
       or coalesce(jsonb_typeof(v_item -> 'deltaE'), '') <> 'number'
       or (v_item ->> 'deltaE')::numeric < 0 or (v_item ->> 'deltaE')::numeric > 200
       or coalesce(jsonb_typeof(v_item -> 'limitDeltaE'), 'missing') not in ('number', 'null', 'missing')
       or (jsonb_typeof(v_item -> 'limitDeltaE') = 'number'
           and ((v_item ->> 'limitDeltaE')::numeric < 0 or (v_item ->> 'limitDeltaE')::numeric > 200))
       or coalesce(v_item ->> 'ruleId', 'R-GAP-000') !~ '^R-[A-Z]{2,8}-[0-9]{3}$'
       or coalesce(v_item ->> 'targetHex', '#000000') !~ '^#[0-9A-F]{6}$'
       -- A value nobody stated is left out or null, never an empty string: the column takes no blanks.
       or (v_item ? 'method' and coalesce(length(btrim(v_item ->> 'method')), 1) not between 1 and 40)
       or (v_item ? 'instrument' and coalesce(length(btrim(v_item ->> 'instrument')), 1) not between 1 and 120)
       or (v_item ? 'whitePoint' and coalesce(length(btrim(v_item ->> 'whitePoint')), 1) not between 1 and 40)
       or (v_item ? 'observer' and coalesce(length(btrim(v_item ->> 'observer')), 1) not between 1 and 40) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- True when every reading that has a limit on file is inside it. Readings with no limit judge nothing.
create function private.ops_colour_readings_pass(p_readings jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1 from jsonb_array_elements(p_readings) as r(value)
    where jsonb_typeof(r.value -> 'limitDeltaE') = 'number'
      and (r.value ->> 'deltaE')::numeric > (r.value ->> 'limitDeltaE')::numeric
  );
$$;

drop function public.ops_record_inspection(uuid, uuid, jsonb, jsonb, integer, integer, uuid[], text, jsonb, text, date);

create function public.ops_record_inspection(
  p_actor uuid, p_order_id uuid, p_checklist jsonb, p_measurements jsonb, p_sample_size integer, p_defect_count integer,
  p_photo_file_ids uuid[] default '{}', p_note text default '',
  p_remake_sizes jsonb default null, p_remake_owner text default null, p_remake_due_on date default null,
  p_colour_readings jsonb default '[]', p_aql_code_letter text default null
)
returns table (inspection_id uuid, result text, exception_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  v_item jsonb;
  v_key text;
  v_all_pass boolean := true;
  v_seen text[] := '{}';
  v_in_tolerance boolean := true;
  v_colour_ok boolean;
  v_result text;
  v_exception uuid := null;
  v_inspection uuid := gen_random_uuid();
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if o.status <> 'ready' then
    raise exception 'An order is inspected once the factory has marked it ready.' using errcode = 'P0001', hint = 'not_ready_for_qc';
  end if;

  if p_checklist is null or jsonb_typeof(p_checklist) <> 'array' then
    raise exception 'The checklist is a list of items.' using errcode = '22023', hint = 'invalid_checklist';
  end if;
  for v_item in select value from jsonb_array_elements(p_checklist) loop
    v_key := v_item ->> 'key';
    if jsonb_typeof(v_item) <> 'object' or v_key is null or v_key not in ('measurements', 'colour', 'artwork', 'names_numbers')
       or v_key = any (v_seen) or (v_item ->> 'result') is null or (v_item ->> 'result') not in ('pass', 'fail', 'not_inspected')
       or length(coalesce(v_item ->> 'note', '')) > 300 then
      raise exception 'Each checklist item is measurements, colour, artwork or names_numbers, once, with pass, fail or not_inspected.'
        using errcode = '22023', hint = 'invalid_checklist';
    end if;
    v_seen := v_seen || v_key;
    if (v_item ->> 'result') <> 'pass' then
      v_all_pass := false;
    end if;
  end loop;
  if cardinality(v_seen) <> 4 then
    raise exception 'The checklist needs all four items.' using errcode = '22023', hint = 'invalid_checklist';
  end if;

  if p_measurements is null or jsonb_typeof(p_measurements) <> 'array' or jsonb_array_length(p_measurements) > 60 then
    raise exception 'Measurements are a list of up to 60 lines.' using errcode = '22023', hint = 'invalid_measurements';
  end if;
  for v_item in select value from jsonb_array_elements(p_measurements) loop
    if jsonb_typeof(v_item) <> 'object'
       or length(btrim(coalesce(v_item ->> 'point', ''))) not between 1 and 80
       or coalesce(jsonb_typeof(v_item -> 'specMm'), '') <> 'number' or coalesce(jsonb_typeof(v_item -> 'measuredMm'), '') <> 'number'
       or coalesce(jsonb_typeof(v_item -> 'toleranceMm'), '') <> 'number'
       or (v_item ->> 'specMm')::numeric <= 0 or (v_item ->> 'measuredMm')::numeric <= 0
       or (v_item ->> 'toleranceMm')::numeric < 0 then
      raise exception 'Each measurement needs a point, the spec, the measured value and the tolerance, in millimetres.'
        using errcode = '22023', hint = 'invalid_measurements';
    end if;
    if abs((v_item ->> 'measuredMm')::numeric - (v_item ->> 'specMm')::numeric) > (v_item ->> 'toleranceMm')::numeric then
      v_in_tolerance := false;
    end if;
  end loop;

  if not private.ops_valid_colour_readings(p_colour_readings) then
    raise exception 'Each colour reading needs a colour name and a Delta-E value, and up to 20 readings.'
      using errcode = '22023', hint = 'invalid_colour_readings';
  end if;
  if p_aql_code_letter is not null
     and not exists (select 1 from public.ops_aql_sample_plans s where s.code_letter = p_aql_code_letter) then
    raise exception 'That is not a sample size code letter on file.' using errcode = '22023', hint = 'invalid_aql_letter';
  end if;
  v_colour_ok := private.ops_colour_readings_pass(p_colour_readings);

  if p_sample_size is null or p_sample_size not between 1 and 99999
     or p_defect_count is null or p_defect_count < 0 or p_defect_count > p_sample_size
     or cardinality(coalesce(p_photo_file_ids, '{}')) > 20 or length(coalesce(p_note, '')) > 300 then
    raise exception 'The sample is 1 or more pieces, defects cannot exceed it, photos are up to 20.' using errcode = '22023', hint = 'invalid_input';
  end if;

  v_result := case
    when v_all_pass and v_in_tolerance and v_colour_ok and p_defect_count = 0 and jsonb_array_length(p_measurements) >= 1 then 'pass'
    else 'fail'
  end;

  if v_result = 'fail' then
    if not private.ops_valid_sizes(p_remake_sizes) or p_remake_owner is null or p_remake_due_on is null then
      raise exception 'A failed inspection needs the pieces to make again, an owner and a due date.'
        using errcode = '22023', hint = 'remake_needed';
    end if;
    v_exception := private.ops_open_exception(
      p_actor, o, 'remake', p_remake_owner, p_remake_due_on, coalesce(p_note, ''), p_remake_sizes, v_inspection
    );
  end if;

  insert into public.ops_qc_inspections (
    id, order_id, brand_id, factory_profile_id, result, checklist, measurements, sample_size, defect_count,
    photo_file_ids, note, exception_id, actor, aql_code_letter
  ) values (
    v_inspection, o.id, o.brand_id, o.factory_profile_id, v_result, p_checklist, p_measurements, p_sample_size, p_defect_count,
    coalesce(p_photo_file_ids, '{}'), coalesce(p_note, ''), v_exception, p_actor, p_aql_code_letter
  );

  insert into public.ops_qc_colour_readings (
    inspection_id, order_id, brand_id, colour_name, target_hex, target_l, target_a, target_b,
    measured_l, measured_a, measured_b, delta_e, limit_delta_e, method, instrument, white_point, observer, rule_id, actor
  )
  select
    v_inspection, o.id, o.brand_id, btrim(r.value ->> 'colourName'), r.value ->> 'targetHex',
    (r.value ->> 'targetL')::numeric, (r.value ->> 'targetA')::numeric, (r.value ->> 'targetB')::numeric,
    (r.value ->> 'measuredL')::numeric, (r.value ->> 'measuredA')::numeric, (r.value ->> 'measuredB')::numeric,
    (r.value ->> 'deltaE')::numeric, (r.value ->> 'limitDeltaE')::numeric,
    r.value ->> 'method', r.value ->> 'instrument', r.value ->> 'whitePoint', r.value ->> 'observer',
    coalesce(r.value ->> 'ruleId', 'R-GAP-000'), p_actor
  from jsonb_array_elements(p_colour_readings) as r(value);

  return query select v_inspection, v_result, v_exception;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- F-O3. Booking a third-party inspection.

create function public.ops_book_inspection(
  p_actor uuid, p_order_id uuid, p_provider text, p_reference text, p_state text, p_requested_on date,
  p_inspect_on date default null, p_outcome text default '', p_note text default '', p_rule_id text default 'R-GAP-000'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  v_id uuid;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if p_state is null or p_state not in ('requested', 'booked', 'not_available') then
    raise exception 'A booking is requested, booked or not available.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if p_provider is null or length(btrim(p_provider)) not between 1 and 40
     or p_reference is null or length(btrim(p_reference)) not between 1 and 120
     or p_requested_on is null or length(coalesce(p_outcome, '')) > 300 or length(coalesce(p_note, '')) > 300
     or coalesce(p_rule_id, 'R-GAP-000') !~ '^R-[A-Z]{2,8}-[0-9]{3}$' then
    raise exception 'A booking needs a provider, a reference and the day it was asked for.' using errcode = '22023', hint = 'invalid_input';
  end if;
  insert into public.ops_inspection_bookings
    (order_id, brand_id, provider, reference, pieces, requested_on, inspect_on, state, outcome, note, rule_id, actor)
  values
    (o.id, o.brand_id, btrim(p_provider), btrim(p_reference), o.pieces, p_requested_on, p_inspect_on, p_state,
     coalesce(p_outcome, ''), coalesce(p_note, ''), coalesce(p_rule_id, 'R-GAP-000'), p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- F-O4. Couriers as data.

create function public.ops_set_courier(
  p_actor uuid, p_code text, p_name text, p_provider text, p_tracking_url_template text,
  p_terms text, p_transit_days integer, p_active boolean, p_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  if p_code is null or p_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_code) > 40
     or p_name is null or length(btrim(p_name)) not between 1 and 80
     or p_label is null or length(btrim(p_label)) not between 1 and 400 then
    raise exception 'A courier needs a code, a name and a label saying where its terms come from.'
      using errcode = '22023', hint = 'invalid_input';
  end if;
  insert into public.ops_couriers (code, name, provider, tracking_url_template, terms, transit_days, active, label)
  values (p_code, btrim(p_name), coalesce(nullif(btrim(p_provider), ''), 'manual'), p_tracking_url_template,
          coalesce(p_terms, ''), p_transit_days, coalesce(p_active, true), btrim(p_label))
  on conflict (code) do update set
    name = excluded.name, provider = excluded.provider, tracking_url_template = excluded.tracking_url_template,
    terms = excluded.terms, transit_days = excluded.transit_days, active = excluded.active,
    label = excluded.label, updated_at = now();
end;
$$;

-- The parcel, now with the courier row it was recorded against and the tracking address, when there is one.
-- Dropped and written again for the same reason as the inspection: an overload would be ambiguous.
drop function public.ops_record_shipment(uuid, uuid, text, text, date, jsonb, text, text, date);

create function public.ops_record_shipment(
  p_actor uuid, p_order_id uuid, p_courier text, p_tracking_number text, p_shipped_on date, p_sizes jsonb,
  p_note text default '', p_owner text default null, p_due_on date default null,
  p_provider text default 'manual', p_courier_code text default null, p_tracking_url text default null
)
returns table (shipment_id uuid, shipped_pieces integer, complete boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  v_result text;
  v_id uuid;
  v_pieces integer;
  v_already integer;
  v_size record;
  v_before integer;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if o.status <> 'ready' then
    raise exception 'Only an order the factory has marked ready can be shipped.' using errcode = 'P0001', hint = 'not_ready_to_ship';
  end if;
  select i.result into v_result from public.ops_qc_inspections i where i.order_id = o.id order by i.at desc, i.id desc limit 1;
  if v_result is distinct from 'pass' then
    raise exception 'The latest inspection of this order is not a pass, so it cannot ship.' using errcode = 'P0001', hint = 'qc_not_passed';
  end if;
  if p_courier is null or length(btrim(p_courier)) not between 1 and 80
     or p_tracking_number is null or length(btrim(p_tracking_number)) not between 1 and 80
     or p_shipped_on is null or length(coalesce(p_note, '')) > 300 then
    raise exception 'A shipment needs a courier, a tracking number and the day it was sent.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if coalesce(p_provider, 'manual') not in ('manual', 'courier') then
    raise exception 'A parcel is recorded by hand or booked through a courier.' using errcode = '22023', hint = 'invalid_provider';
  end if;
  if p_courier_code is not null
     and not exists (select 1 from public.ops_couriers c where c.code = p_courier_code and c.active) then
    raise exception 'That courier is not on file.' using errcode = '22023', hint = 'no_such_courier';
  end if;
  if not private.ops_valid_sizes(p_sizes) then
    raise exception 'List the pieces sent, by size.' using errcode = '22023', hint = 'invalid_sizes';
  end if;
  for v_size in select key, (value #>> '{}')::integer as n from jsonb_each(p_sizes) loop
    select coalesce(sum((s.sizes ->> v_size.key)::integer), 0) into v_before
    from public.ops_shipments s where s.order_id = o.id;
    if v_size.n + v_before > coalesce((o.sizes ->> v_size.key)::integer, 0) then
      raise exception 'That is more pieces of size % than the order still owes.', v_size.key using errcode = 'P0001', hint = 'over_shipped';
    end if;
  end loop;
  v_pieces := private.ops_sum_sizes(p_sizes);
  select coalesce(sum(s.pieces), 0) into v_already from public.ops_shipments s where s.order_id = o.id;
  if v_pieces + v_already < o.pieces and (p_owner is null or p_due_on is null) then
    raise exception 'This leaves pieces behind: give an owner and a due date for the rest.' using errcode = '22023', hint = 'owner_and_due_needed';
  end if;
  insert into public.ops_shipments
    (order_id, brand_id, provider, courier, tracking_number, shipped_on, sizes, pieces, note, actor, courier_code, tracking_url)
  values
    (o.id, o.brand_id, coalesce(p_provider, 'manual'), btrim(p_courier), btrim(p_tracking_number), p_shipped_on, p_sizes,
     v_pieces, coalesce(p_note, ''), p_actor, p_courier_code, p_tracking_url)
  returning id into v_id;
  if v_pieces + v_already < o.pieces then
    perform private.ops_open_exception(p_actor, o, 'partial_shipment', p_owner, p_due_on, coalesce(p_note, ''), '{}'::jsonb, null);
  end if;
  return query select v_id, v_pieces, v_pieces + v_already = o.pieces;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- F-O4. The commercial invoice, issued once and never changed.

create function public.ops_issue_commercial_invoice(
  p_actor uuid, p_order_id uuid, p_issued_on date, p_origin_country text, p_destination_country text,
  p_lines jsonb, p_missing text[] default '{}', p_preference_scheme text default null,
  p_incoterms text default '', p_replaces_id uuid default null, p_rule_id text default 'R-GAP-000'
)
returns table (invoice_id uuid, invoice_no integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  v_no integer;
  v_id uuid;
  v_item jsonb;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if o.status <> 'ready' then
    raise exception 'A commercial invoice is issued once the factory has marked the order ready.'
      using errcode = 'P0001', hint = 'not_invoiceable';
  end if;
  if p_issued_on is null or p_origin_country is null or p_origin_country !~ '^[A-Z]{2}$'
     or p_destination_country is null or p_destination_country !~ '^[A-Z]{2}$'
     or length(coalesce(p_incoterms, '')) > 40 or cardinality(coalesce(p_missing, '{}')) > 20
     or coalesce(p_rule_id, 'R-GAP-000') !~ '^R-[A-Z]{2,8}-[0-9]{3}$' then
    raise exception 'An invoice needs the day it was issued and the country of origin and destination.'
      using errcode = '22023', hint = 'invalid_input';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 60 then
    raise exception 'An invoice has 1 to 60 lines.' using errcode = '22023', hint = 'invalid_lines';
  end if;
  for v_item in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_item) <> 'object'
       or length(btrim(coalesce(v_item ->> 'description', ''))) not between 1 and 200
       or coalesce(v_item ->> 'originCountry', '') !~ '^[A-Z]{2}$'
       or coalesce(jsonb_typeof(v_item -> 'pieces'), '') <> 'number'
       or (v_item ->> 'pieces')::numeric < 1
       or coalesce(jsonb_typeof(v_item -> 'hsCode'), 'null') not in ('string', 'null')
       or (jsonb_typeof(v_item -> 'hsCode') = 'string' and coalesce(v_item ->> 'hsCode', '') !~ '^[0-9]{4}([.][0-9]{2}([0-9]{2})?)?$') then
      raise exception 'Each line needs a description, the country it was made in, a piece count, and an HS code or none.'
        using errcode = '22023', hint = 'invalid_lines';
    end if;
  end loop;
  if p_replaces_id is not null
     and not exists (select 1 from public.ops_commercial_invoices i where i.id = p_replaces_id and i.order_id = o.id) then
    raise exception 'That invoice is not an invoice of this order.' using errcode = 'P0002', hint = 'no_such_invoice';
  end if;
  select coalesce(max(i.invoice_no), 0) + 1 into v_no from public.ops_commercial_invoices i where i.order_id = o.id;
  insert into public.ops_commercial_invoices
    (order_id, brand_id, invoice_no, replaces_id, issued_on, origin_country, destination_country,
     preference_scheme, incoterms, lines, total_pieces, total_value_minor, currency, missing, rule_id, actor)
  values
    (o.id, o.brand_id, v_no, p_replaces_id, p_issued_on, p_origin_country, p_destination_country,
     nullif(btrim(coalesce(p_preference_scheme, '')), ''), coalesce(p_incoterms, ''), p_lines, o.pieces,
     o.value_minor, o.currency, coalesce(p_missing, '{}'), coalesce(p_rule_id, 'R-GAP-000'), p_actor)
  returning id into v_id;
  return query select v_id, v_no;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- F-O4. The record of a status email. The app has already asked the provider; this keeps what happened.

create function public.ops_record_customer_email(
  p_actor uuid, p_order_id uuid, p_kind text, p_to_email text, p_subject text, p_body text,
  p_provider text, p_sent boolean, p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  v_id uuid;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if p_kind is null or p_kind not in ('batched', 'received', 'in_production', 'ready', 'shipped', 'delayed', 'qc_failed') then
    raise exception 'That is not a status a customer is told about.' using errcode = '22023', hint = 'invalid_kind';
  end if;
  if p_to_email is null or p_to_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or length(p_to_email) > 320
     or p_subject is null or length(btrim(p_subject)) not between 1 and 200
     or p_body is null or length(p_body) not between 1 and 4000
     or p_provider is null or length(btrim(p_provider)) not between 1 and 40
     or p_sent is null or length(coalesce(p_reason, '')) > 300 then
    raise exception 'A status email needs an address, a subject, the words sent and the provider that took it.'
      using errcode = '22023', hint = 'invalid_input';
  end if;
  if not p_sent and length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Say why nothing was sent.' using errcode = '22023', hint = 'reason_needed';
  end if;
  insert into public.ops_customer_emails (order_id, brand_id, kind, to_email, subject, body, provider, sent, reason, actor)
  values (o.id, o.brand_id, p_kind, p_to_email, btrim(p_subject), p_body, btrim(p_provider), p_sent, coalesce(p_reason, ''), p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Rights on the functions. The browser roles reach none of them; the server's key runs them all, and each
-- checks the actor itself. ops_cut_scheduled takes no actor: the cron route's shared secret is its door.

revoke all on function private.last_cutoff(timestamptz) from public, anon, authenticated;
revoke all on function private.ops_cut_batches_run(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.ops_valid_colour_readings(jsonb) from public, anon, authenticated;
revoke all on function private.ops_colour_readings_pass(jsonb) from public, anon, authenticated;

revoke all on function public.ops_cut_scheduled(timestamptz) from public, anon, authenticated;
revoke all on function public.ops_record_inspection(uuid, uuid, jsonb, jsonb, integer, integer, uuid[], text, jsonb, text, date, jsonb, text) from public, anon, authenticated;
revoke all on function public.ops_book_inspection(uuid, uuid, text, text, text, date, date, text, text, text) from public, anon, authenticated;
revoke all on function public.ops_set_courier(uuid, text, text, text, text, text, integer, boolean, text) from public, anon, authenticated;
revoke all on function public.ops_record_shipment(uuid, uuid, text, text, date, jsonb, text, text, date, text, text, text) from public, anon, authenticated;
revoke all on function public.ops_issue_commercial_invoice(uuid, uuid, date, text, text, jsonb, text[], text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.ops_record_customer_email(uuid, uuid, text, text, text, text, text, boolean, text) from public, anon, authenticated;

grant execute on function public.ops_cut_scheduled(timestamptz) to service_role;
grant execute on function public.ops_record_inspection(uuid, uuid, jsonb, jsonb, integer, integer, uuid[], text, jsonb, text, date, jsonb, text) to service_role;
grant execute on function public.ops_book_inspection(uuid, uuid, text, text, text, date, date, text, text, text) to service_role;
grant execute on function public.ops_set_courier(uuid, text, text, text, text, text, integer, boolean, text) to service_role;
grant execute on function public.ops_record_shipment(uuid, uuid, text, text, date, jsonb, text, text, date, text, text, text) to service_role;
grant execute on function public.ops_issue_commercial_invoice(uuid, uuid, date, text, text, jsonb, text[], text, text, uuid, text) to service_role;
grant execute on function public.ops_record_customer_email(uuid, uuid, text, text, text, text, text, boolean, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Seed.
--
-- THE AQL TABLE IS SEEDED UNVERIFIED, ON PURPOSE. Read this before you use a number out of it.
--
-- The spec's quality rule (docs/spec/02-features.md F-O3 and rule R-QC-001) names "AQL 0 critical / 2.5
-- major / 4.0 minor at inspection level II" and cites "AQL standard (ISO 2859-1)". ISO 2859-1 is a paid
-- standard. No copy of it, and no page reproducing its tables, could be reached while this was written, so
-- the figures below were typed from the widely republished general-level-II single-sampling table and
-- NOBODY HAS CHECKED THEM AGAINST THE STANDARD. Every row therefore has:
--   * source = null, because no document is cited; and
--   * sourced = false, which the check constraint ties to a null source.
-- The screens show the plan with its label, and the code never lets an unverified row decide anything: a
-- pass or a fail is still the inspector's typed verdict and the measurements, exactly as before. Owner
-- question O1-1 on the PR asks for a copy of ISO 2859-1 (or the factory's own agreed plan) so these rows can
-- be checked, cited and set verified.
--
-- The "AQL 0" column is not an ISO column at all. The lowest AQL in the standard is 0.010. "0 critical" is
-- the garment trade's shorthand, which the spec uses, for "no critical defect is accepted": accept at 0,
-- reject at 1, at every sample size. It is seeded as that, labelled as the spec's convention and not as a
-- figure out of the standard.

insert into public.ops_aql_sample_plans (code_letter, inspection_level, lot_min, lot_max, sample_size, label) values
  ('A', 'II', 2, 8, 2, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('B', 'II', 9, 15, 3, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('C', 'II', 16, 25, 5, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('D', 'II', 26, 50, 8, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('E', 'II', 51, 90, 13, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('F', 'II', 91, 150, 20, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('G', 'II', 151, 280, 32, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('H', 'II', 281, 500, 50, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('J', 'II', 501, 1200, 80, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('K', 'II', 1201, 3200, 125, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('L', 'II', 3201, 10000, 200, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('M', 'II', 10001, 35000, 315, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('N', 'II', 35001, 150000, 500, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('P', 'II', 150001, 500000, 800, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard'),
  ('Q', 'II', 500001, null, 1250, 'Unverified: typed from the republished ISO 2859-1 general level II table, not checked against the standard');

-- The critical column. Not an ISO column: the spec's "AQL 0 critical", which is "no critical defect is
-- accepted" at every sample size. R-QC-001 is the rule that says every order is inspected this way.
insert into public.ops_aql_acceptance (code_letter, aql, defect_class, accept_at, reject_at, rule_id, label)
select s.code_letter, 0, 'critical', 0, 1, 'R-QC-001',
       'The spec''s "AQL 0 critical": no critical defect is accepted. Not a column of ISO 2859-1; its lowest AQL is 0.010'
from public.ops_aql_sample_plans s where s.inspection_level = 'II';

-- The major (2.5) and minor (4.0) columns. A row with no accept number is an arrow: use the first plan at
-- the letter it names, which is what the published table's arrows mean.
insert into public.ops_aql_acceptance (code_letter, aql, defect_class, accept_at, reject_at, use_code_letter, rule_id, label)
values
  ('A', 2.5, 'major', null, null, 'C', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard'),
  ('B', 2.5, 'major', null, null, 'C', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard'),
  ('C', 2.5, 'major', 0, 1, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('D', 2.5, 'major', 0, 1, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('E', 2.5, 'major', 1, 2, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('F', 2.5, 'major', 1, 2, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('G', 2.5, 'major', 2, 3, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('H', 2.5, 'major', 3, 4, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('J', 2.5, 'major', 5, 6, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('K', 2.5, 'major', 7, 8, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('L', 2.5, 'major', 10, 11, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('M', 2.5, 'major', 14, 15, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('N', 2.5, 'major', 21, 22, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('P', 2.5, 'major', null, null, 'N', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard'),
  ('Q', 2.5, 'major', null, null, 'N', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard'),
  ('A', 4.0, 'minor', null, null, 'C', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard'),
  ('B', 4.0, 'minor', null, null, 'C', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard'),
  ('C', 4.0, 'minor', 0, 1, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('D', 4.0, 'minor', 1, 2, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('E', 4.0, 'minor', 1, 2, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('F', 4.0, 'minor', 2, 3, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('G', 4.0, 'minor', 3, 4, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('H', 4.0, 'minor', 5, 6, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('J', 4.0, 'minor', 7, 8, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('K', 4.0, 'minor', 10, 11, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('L', 4.0, 'minor', 14, 15, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('M', 4.0, 'minor', 21, 22, null, 'R-QC-001', 'Unverified: typed from the republished ISO 2859-1 level II table, not checked against the standard'),
  ('N', 4.0, 'minor', null, null, 'M', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard'),
  ('P', 4.0, 'minor', null, null, 'M', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard'),
  ('Q', 4.0, 'minor', null, null, 'M', 'R-QC-001', 'Unverified: arrow in the republished ISO 2859-1 level II table, not checked against the standard');

-- The one courier that exists: the manual option. Ops types in the courier and the number it was given, and
-- nothing is sent to anybody. No real courier is seeded: no terms, no transit time and no tracking address
-- is agreed with one, and the platform invents none.
insert into public.ops_couriers (code, name, provider, terms, label) values
  ('by-hand', 'Entered by hand', 'manual', '',
   'The manual option. Ops types in the courier and the tracking number; no courier is called and no terms are agreed');
