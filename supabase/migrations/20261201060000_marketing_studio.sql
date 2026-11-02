-- The marketing studio (plans/platform-v5.md wave 4, workstream L4; spec F-L2 of
-- docs/spec/02-features.md and the marketing table of docs/spec/07-template-library.md; decision 0094).
--
-- No timestamp was assigned to L4 in the plan's table, so this one uses the wave's date
-- (20261201) with the next free hour after L1's 010000, L3's 020000, L6's 030000, the option-code
-- map's 040000 and L8's 050000. The pull request says so.
--
-- Three things are here:
--
--   1. `templates` can hold a row that is not a design. `07` counts 50 marketing templates, and the
--      plan has them as `templates` rows of kind `marketing` (L1's decision 0091 says the same).
--      Five of that table's columns describe a design and nothing else -- the sport, the article,
--      the wearer, the style tags and the colour family -- and a marketing layout has none of them:
--      it is not on a base article and has no wearer. They become nullable, and a constraint says
--      plainly that they belong to a design, so a design row can still never be missing one.
--      **L2 (mockup_scene), L5 (video) and L6 (flow) need exactly this; whichever of us lands
--      first adds it and the others keep it.** No column is added, so no new grant is needed
--      (`authenticated` holds SELECT on this table column by column).
--
--   2. `marketing_export_targets`: what the export panel offers, as rows. The spec's export panel
--      names quick PNG at 1x/2x/3x and a full export with a format, a resolution and a colour
--      space; every one of those is a row here, because a resolution or a format in code is a
--      decision hidden where nobody can change it.
--
--   3. `marketing_watermark_rules`: the spec's one sentence about watermarks ("Free plan exports
--      are watermarked; paid exports go up to 300 DPI") as two rows, so the panel can say which
--      applies and an admin can change it. The mark itself is the platform's existing one
--      (`lib/media/watermark.ts`); nothing here draws a second.
--
-- Platform data, as `templates` is: every signed-in user reads it, no browser role writes it, and
-- the server writes through the service client. No money, no Store concept and no measurement.

-- ---------------------------------------------------------------------------------------------
-- 1. A `templates` row that is not a design.

alter table public.templates
  alter column sport drop not null,
  alter column article_id drop not null,
  alter column wearer drop not null,
  alter column style_tags drop not null,
  alter column colour_family drop not null;

alter table public.templates add constraint templates_design_columns_describe_a_design check (
  (kind = 'design') = (
    sport is not null
    and article_id is not null
    and wearer is not null
    and style_tags is not null
    and colour_family is not null
  )
);

comment on column public.templates.article_id is
  'The base article a DESIGN template is made on. Null for every other kind: a marketing layout, a mockup scene, a video or a flow is not on an article, and templates_design_columns_describe_a_design holds both sides of that.';
comment on column public.templates.snapshot is
  'What the row holds, which depends on its kind: a design object for kind = design, and for kind = marketing the layout of lib/marketing (its group, its format and its slots, each slot a fraction of the artboard and a colour role).';

-- ---------------------------------------------------------------------------------------------
-- 2. What the export panel offers.

create table public.marketing_export_targets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(key) <= 64),
  label text not null check (length(btrim(label)) between 1 and 80),
  -- One line for the panel: what this target is for. Never a promise about a printer.
  lead text not null check (length(btrim(lead)) between 1 and 200),
  file_format text not null check (file_format in ('png', 'jpeg', 'svg', 'pdf')),
  colour_space text not null check (colour_space in ('rgb', 'cmyk')),
  -- Dots per inch. The spec's export panel offers 72 for a screen and 300 for print.
  dpi integer not null check (dpi between 1 and 1200),
  -- How many times the artboard's own pixel size, for the quick export's 1x / 2x / 3x.
  scale numeric(3, 1) not null default 1.0 check (scale between 0.1 and 10.0),
  -- True for a target the quick export shows as one button.
  quick boolean not null default false,
  sort integer not null default 0,
  -- R-GAP-000 while no rulebook entry covers marketing artwork (spec decision 11).
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  note text not null check (length(btrim(note)) between 1 and 200),
  created_at timestamptz not null default now()
);

comment on table public.marketing_export_targets is
  'What the marketing export panel offers: the quick PNG sizes and the full export''s formats, resolutions and colour spaces. Platform-owned; read by every signed-in user; written by the server only.';
comment on column public.marketing_export_targets.colour_space is
  'rgb or cmyk. A cmyk target is only made when a colour profile is on file; none is, so the panel says so rather than exporting an uncalibrated separation (decision 0094).';

create index marketing_export_targets_order_idx on public.marketing_export_targets (sort, key);

insert into public.marketing_export_targets (key, label, lead, file_format, colour_space, dpi, scale, quick, sort, note) values
  ('png-1x', 'PNG 1x', 'The artboard at its own size, for a screen.', 'png', 'rgb', 72, 1.0, true, 10, 'The spec''s quick export; nobody has reviewed these sizes'),
  ('png-2x', 'PNG 2x', 'Twice the artboard''s size, for a sharper screen.', 'png', 'rgb', 72, 2.0, true, 20, 'The spec''s quick export; nobody has reviewed these sizes'),
  ('png-3x', 'PNG 3x', 'Three times the artboard''s size.', 'png', 'rgb', 72, 3.0, true, 30, 'The spec''s quick export; nobody has reviewed these sizes'),
  ('png-print', 'PNG for print', 'The artboard at 300 dots per inch, as a PNG.', 'png', 'rgb', 300, 1.0, false, 40, 'Placeholder resolution, not reviewed by anyone'),
  ('jpeg-screen', 'JPEG', 'A smaller file for a screen, with no transparency.', 'jpeg', 'rgb', 72, 1.0, false, 50, 'Placeholder resolution, not reviewed by anyone'),
  ('svg-vector', 'SVG', 'The layout as shapes and text, which stays sharp at any size.', 'svg', 'rgb', 72, 1.0, false, 60, 'Placeholder resolution, not reviewed by anyone'),
  ('pdf-print', 'PDF for print', 'A page at 300 dots per inch, for a printer.', 'pdf', 'rgb', 300, 1.0, false, 70, 'Placeholder resolution, not reviewed by anyone'),
  ('pdf-print-cmyk', 'PDF for print (CMYK)', 'The same page separated for a press, once a colour profile is on file.', 'pdf', 'cmyk', 300, 1.0, false, 80, 'No colour profile is on file, so this target is refused and says why');

-- ---------------------------------------------------------------------------------------------
-- 3. The watermark rule, as rows.

create table public.marketing_watermark_rules (
  id uuid primary key default gen_random_uuid(),
  -- The words the spec uses: the free plan and a paid one. No plan model exists on this platform yet.
  plan text not null unique check (plan in ('free', 'paid')),
  label text not null check (length(btrim(label)) between 1 and 80),
  -- True when an export on this plan carries the platform's existing preview mark.
  watermarked boolean not null,
  -- The most dots per inch an export on this plan is made at.
  max_dpi integer not null check (max_dpi between 1 and 1200),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]{2,8}-[0-9]{3}$'),
  note text not null check (length(btrim(note)) between 1 and 200),
  created_at timestamptz not null default now()
);

comment on table public.marketing_watermark_rules is
  'Which exports carry the watermark and at what resolution, from the spec''s "Free plan exports are watermarked; paid exports go up to 300 DPI". The mark is the platform''s existing one (lib/media/watermark.ts).';

insert into public.marketing_watermark_rules (plan, label, watermarked, max_dpi, note) values
  ('free', 'Free plan', true, 72, 'The spec''s sentence; the resolution is a placeholder, not reviewed by anyone'),
  ('paid', 'Paid plan', false, 300, 'The spec''s sentence; the resolution is a placeholder, not reviewed by anyone');

-- ---------------------------------------------------------------------------------------------
-- Who may reach them: exactly as public.templates. Every signed-in user reads; no browser role writes.

revoke all on public.marketing_export_targets, public.marketing_watermark_rules
  from public, anon, authenticated, service_role;
grant select on public.marketing_export_targets, public.marketing_watermark_rules to authenticated;
grant select, insert, update, delete on public.marketing_export_targets, public.marketing_watermark_rules to service_role;

alter table public.marketing_export_targets enable row level security;
alter table public.marketing_watermark_rules enable row level security;

create policy "signed-in users read the export targets"
  on public.marketing_export_targets for select to authenticated
  using (true);

create policy "signed-in users read the watermark rules"
  on public.marketing_watermark_rules for select to authenticated
  using (true);

-- There are no insert, update or delete policies, on purpose.
