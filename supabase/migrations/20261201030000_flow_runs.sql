-- Flows: launch packs on one canvas (plans/platform-v5.md wave 4, L6; spec F-L4 and
-- docs/spec/07-template-library.md; decision 0096).
--
-- L1's migration (20261201010000) holds the canvas: `launch_projects`, `boards`, `board_edges` and
-- the saved versions. This file adds only what running that canvas needs:
--
--   1. `flow_templates`, `flow_template_steps` and `flow_template_links`: the six packs of `07`,
--      as rows. They are NOT rows of `templates`: that table's `snapshot` is a design, validated
--      against the registry, and a flow is a shape rather than a design. L8 made the same choice for
--      kit bundles and tech pack templates (`template_kit_bundles`, `template_techpacks`,
--      decision 0098), and following it means `lib/templates/service.ts` keeps reading one kind of
--      row and the design library does not break on ours.
--   2. `flow_runs` and `flow_run_boards`: what one press of Regenerate, Run all downstream or Run
--      all did -- the order, the status per board, what each board was charged and what was given
--      back. The run summary is read from here, so it survives a reload.
--   3. `flow_listings`: what "Publish to store" writes. **It publishes nothing.** Owner decision 1
--      keeps the Store out of this platform, so this is a payload wave 5's Store contract (O2)
--      collects, exactly as a collection drop is collected (decision 0085). There is no cart, no
--      checkout, no price, no payment, no payout and no storefront here, and no column that could
--      hold one. The table is append-only: a record of what was handed over is not something a
--      later hand-off may rewrite.
--   4. `credit_refund_spend`: gives back ONE spend, once. The credits migration has
--      `credit_refund_for_order`, which gives back every spend on a design version because a design
--      was ordered. A flow needs the other shape: one board of fourteen failed, so one charge comes
--      back and the other thirteen stand. It is written here rather than guessed at by the
--      application, and L3 and L5 need the same function for their own failed generations.
--   5. A trigger on `public.boards` that closes the one hole a chain of boards could open:
--      **artwork never comes through a board a model drew.** L1 refuses a generated board's output
--      as artwork, which is right for one board; a Marketing board fed by an AI Image board is a
--      board the platform draws itself, so L1's constraint lets its output be a print file while the
--      pixels came out of a model. This trigger asks the question of the whole branch
--      (spec decision 13, principle 4; `lib/flows/artwork.ts` asks it in the application).
--
-- Every brand table is brand-scoped with row level security on. The server's own key holds SELECT
-- only on all of them: every write goes through a SECURITY DEFINER function below that checks
-- `can_manage_kit` itself, as the launch canvas, the collection plans and the golden samples do.
--
-- No number in this file is a price. What a generated board costs is read from `credit_prices`,
-- which a platform admin sets, and every run records what it actually spent.

-- ---------------------------------------------------------------------------------------------
-- 1. The six flow templates of `07`, as rows.
--
-- The one place a pack is written down is `apps/web/lib/flows/templates/**`, and these rows are
-- seeded from it, exactly as the credit prices are set in one file and seeded from it
-- (20261025060000_credits.sql). `apps/web/lib/flows/migration.test.ts` fails when the two disagree.
-- EVERY ROW IS A LABELLED DEFAULT: `07` gives each pack a list of steps and a count of finished
-- assets and no more, so each row's note says nobody has reviewed it.

create table public.flow_templates (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  title text not null check (length(btrim(title)) between 1 and 120),
  -- One sentence for the template card.
  lead text not null check (length(btrim(lead)) between 1 and 300),
  -- The yellow section labels, in the order the canvas lays them out as columns (spec F-L4).
  sections text[] not null check (cardinality(sections) between 1 and 8),
  -- The count of finished assets `07` gives the pack. A test holds the steps below to it.
  assets integer not null check (assets between 1 and 100),
  tutorial_title text not null check (length(btrim(tutorial_title)) between 1 and 120),
  tutorial_body text not null check (length(btrim(tutorial_body)) between 1 and 500),
  -- The film, or null while none has been made. The card never pretends to have one.
  tutorial_url text check (tutorial_url is null or tutorial_url ~ '^https://'),
  tutorial_note text not null check (length(btrim(tutorial_note)) between 1 and 300),
  note text not null check (length(btrim(note)) between 1 and 300),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.flow_templates is
  'The six flow templates of docs/spec/07-template-library.md. Platform data: every signed-in member reads it, the server seeds it from apps/web/lib/flows/templates. Not reviewed by anyone.';

create table public.flow_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_slug text not null references public.flow_templates (slug) on delete cascade,
  -- Stable inside the template, so a link names a step rather than a position.
  step_key text not null check (step_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(step_key) <= 64),
  -- The yellow section label this step sits under. Held to the template's own list by a trigger below.
  section text not null check (length(btrim(section)) between 1 and 60),
  kind text not null check (kind in ('design', 'artboard', 'mockup', 'ai_image', 'ai_video', 'marketing', 'info_card')),
  name text not null check (length(btrim(name)) between 1 and 80),
  -- The board's own prompt, scene, colourway, aspect and seconds. Copied onto the board it makes.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 8192),
  -- The grey instruction note beside the step (spec F-L4), or null.
  note text check (note is null or length(btrim(note)) between 1 and 300),
  generation text not null check (generation in ('deterministic', 'model')),
  -- How many finished assets this step's output counts as. A Design board counts none.
  assets integer not null default 1 check (assets between 0 and 20),
  format text not null check (format in ('png', 'jpg', 'mp4', 'pdf')),
  sort integer not null default 0,
  unique (template_slug, step_key),
  -- A board a model draws is never a board the platform draws, in either direction.
  constraint flow_template_steps_generation_matches_kind check (
    (kind not in ('ai_image', 'ai_video') or generation = 'model')
    and (kind not in ('design', 'artboard', 'info_card') or generation = 'deterministic')
  ),
  -- A Design board makes no asset of its own: it is the garment every other board starts from.
  constraint flow_template_steps_design_makes_no_asset check ((kind = 'design') = (assets = 0))
);

comment on table public.flow_template_steps is
  'One step of a flow template: the board it adds, the settings it keeps and the grey instruction note beside it.';

create index flow_template_steps_template_idx on public.flow_template_steps (template_slug, sort, id);

create table public.flow_template_links (
  id uuid primary key default gen_random_uuid(),
  template_slug text not null references public.flow_templates (slug) on delete cascade,
  from_step text not null,
  to_step text not null,
  input_index integer not null check (input_index between 1 and 16),
  unique (template_slug, to_step, input_index),
  check (from_step <> to_step),
  foreign key (template_slug, from_step) references public.flow_template_steps (template_slug, step_key) on delete cascade,
  foreign key (template_slug, to_step) references public.flow_template_steps (template_slug, step_key) on delete cascade
);

comment on table public.flow_template_links is
  'A connector of a flow template: one step feeds a numbered input of another. The board table of F-L4 still decides whether it may be drawn.';

/*
 * A step's section has to be one of its own template's yellow labels. Written as a trigger rather
 * than a check constraint because a check constraint cannot look at another row.
 */
create function private.refuse_unknown_flow_section()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.flow_templates t
     where t.slug = new.template_slug and new.section = any (t.sections)
  ) then
    raise exception 'A step sits under one of its own template''s section labels.'
      using errcode = 'P0001', hint = 'unknown_flow_section';
  end if;
  return new;
end;
$$;

revoke all on function private.refuse_unknown_flow_section() from public, anon, authenticated;

create trigger flow_template_steps_section_is_known
  before insert or update on public.flow_template_steps
  for each row execute function private.refuse_unknown_flow_section();

-- ---------------------------------------------------------------------------------------------
-- 2. A run: what one press did.

create table public.flow_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  launch_project_id uuid not null references public.launch_projects (id) on delete cascade,
  -- Regenerate one board, run everything it feeds, or run the whole canvas (spec F-L4).
  scope text not null check (scope in ('board', 'downstream', 'all')),
  -- The board the person pressed the button on, or null for the whole canvas.
  from_board_id uuid references public.boards (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'part_done', 'failed')),
  -- The estimate shown BEFORE the run, kept so the summary can say what changed.
  estimate_credits integer not null default 0 check (estimate_credits between 0 and 1000000),
  -- What was actually charged, and what came back on a failure. Never the estimate.
  spent_credits integer not null default 0 check (spent_credits between 0 and 1000000),
  refunded_credits integer not null default 0 check (refunded_credits between 0 and 1000000),
  assets integer not null default 0 check (assets between 0 and 1000),
  -- The pack this run came from, when the canvas was opened from one.
  template_slug text references public.flow_templates (slug) on delete set null,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  -- A run that has finished says when. One that has not has no time on it.
  constraint flow_runs_finished_says_when check ((status in ('done', 'part_done', 'failed')) = (finished_at is not null))
);

comment on table public.flow_runs is
  'One press of Regenerate, Run all downstream or Run all: the order it ran in, what it made and what it cost after refunds. Brand-scoped; written by the flow functions only.';

create index flow_runs_project_idx on public.flow_runs (launch_project_id, created_at desc, id);
create index flow_runs_brand_idx on public.flow_runs (brand_id, created_at desc, id);

create table public.flow_run_boards (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  run_id uuid not null references public.flow_runs (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  -- Where in the run's order this board came. 1 is first.
  position integer not null check (position between 1 and 1000),
  status text not null default 'queued' check (status in ('queued', 'running', 'ready', 'failed', 'skipped')),
  credits integer not null default 0 check (credits between 0 and 1000000),
  refunded_credits integer not null default 0 check (refunded_credits between 0 and 1000000),
  -- The credit_ledger line this board's charge made, so a refund names the spend it gives back.
  spend_entry_id uuid references public.credit_ledger (id) on delete set null,
  assets integer not null default 1 check (assets between 0 and 20),
  format text not null default 'png' check (format in ('png', 'jpg', 'mp4', 'pdf')),
  output_file_id uuid references public.files (id) on delete set null,
  -- Why it did not finish, in words a person can act on. Null when it did.
  reason text check (reason is null or length(btrim(reason)) between 1 and 400),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  updated_at timestamptz not null default now(),
  unique (run_id, board_id),
  -- A board that did not finish holds no picture, and a board that was skipped was never charged:
  -- a skipped board is one the run never asked a model for, so there is nothing to charge or refund.
  --
  -- There is deliberately NO constraint saying a failed board kept nothing. It normally does -- the
  -- run gives its credits back before the next board starts -- but a refund that itself fails has to
  -- be recordable, and `credits` with `refunded_credits` beside it is then the only honest account of
  -- what happened. A constraint that refused to write that would hide it.
  constraint flow_run_boards_only_ready_holds_a_picture check (output_file_id is null or status = 'ready'),
  constraint flow_run_boards_skipped_is_never_charged check (status <> 'skipped' or (credits = 0 and refunded_credits = 0))
);

comment on table public.flow_run_boards is
  'One board of one run: its place in the order, its status, what it cost after a refund and why it did not finish.';

create index flow_run_boards_run_idx on public.flow_run_boards (run_id, position, id);
create index flow_run_boards_board_idx on public.flow_run_boards (board_id);

-- ---------------------------------------------------------------------------------------------
-- 3. "Publish to store", which publishes nothing.

create table public.flow_listings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  launch_project_id uuid not null references public.launch_projects (id) on delete cascade,
  -- The payload lib/flows/listing.ts builds: which finished pictures a listing may use, their
  -- labels, and the true-colour picture to show beside each AI scene. No money is in it.
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 262144),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- When the Store collected it, set by wave 5. Null while nothing has read it.
  collected_at timestamptz,
  constraint flow_listings_payload_is_a_listing check (payload ->> 'kind' = 'launch-listing')
);

comment on table public.flow_listings is
  'What "Publish to store" hands over: a listing payload for the separate Store to collect (wave 5, O2). Nothing here publishes, prices or sells anything. Append-only.';

create index flow_listings_brand_idx on public.flow_listings (brand_id, created_at desc, id);
create index flow_listings_uncollected_idx on public.flow_listings (created_at) where collected_at is null;

/*
 * A listing hand-off is append-only, as a saved launch version and a collection drop are: a record
 * of what somebody was given is not something a later hand-off may rewrite. The one change allowed
 * is `collected_at` going from null to a time, which is the Store saying it has read the row.
 */
create function private.refuse_flow_listing_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A statement-level TRUNCATE trigger has no `old` to look at, so it is answered first: reading
  -- `old` there is a run-time error, which would refuse the truncate with the wrong words.
  if tg_op = 'TRUNCATE' then
    raise exception 'A listing hand-off is never truncated.' using errcode = 'P0001', hint = 'append_only';
  end if;
  -- A hand-off goes when its brand or its canvas goes, and not otherwise. Both are checked because
  -- the row hangs off both, and which cascade fires first is not something to depend on.
  if tg_op = 'DELETE' and (
       not exists (select 1 from public.launch_projects p where p.id = old.launch_project_id)
       or not exists (select 1 from public.brands b where b.id = old.brand_id)
     ) then
    return old;
  end if;
  if tg_op = 'UPDATE' then
    -- The Store saying it has read the row. `is not distinct from` rather than `=`, because a
    -- row-wise `=` is null when a nullable field is null on both sides, and `created_by` is
    -- nullable: with `=` a hand-off whose author had been deleted could never be marked collected.
    if old.collected_at is null and new.collected_at is not null
       and row(new.id, new.brand_id, new.launch_project_id, new.payload, new.rule_id, new.created_by, new.created_at)
         is not distinct from row(old.id, old.brand_id, old.launch_project_id, old.payload, old.rule_id, old.created_by, old.created_at)
    then
      return new;
    end if;
    -- The person who pressed the button being deleted: `created_by` is set to null by the reference
    -- itself, and the record of the hand-off stays. Without this, deleting a user fails here.
    if old.created_by is not null and new.created_by is null
       and row(new.id, new.brand_id, new.launch_project_id, new.payload, new.rule_id, new.collected_at, new.created_at)
         is not distinct from row(old.id, old.brand_id, old.launch_project_id, old.payload, old.rule_id, old.collected_at, old.created_at)
    then
      return new;
    end if;
  end if;
  raise exception 'A listing hand-off can never be changed or removed; it can only be marked collected.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_flow_listing_change() from public, anon, authenticated;

create trigger flow_listings_append_only
  before update or delete on public.flow_listings
  for each row execute function private.refuse_flow_listing_change();

create trigger flow_listings_no_truncate
  before truncate on public.flow_listings
  for each statement execute function private.refuse_flow_listing_change();

-- ---------------------------------------------------------------------------------------------
-- 5. The hole a chain of boards could open, closed in the database as well as in the application.
--
-- `private.launch_board_has_design` (L1) walks the connectors backwards to find the garment. This
-- walks them backwards to find a board a model drew. If there is one, the board's output may be an
-- asset and nothing else -- however many hops away that board is, and whatever the application asks
-- for. `lib/flows/garment-lock.test.ts` and `tests/integration/flows.test.ts` both prove it on a
-- four-hop chain (spec decision 13).

create function private.launch_board_has_generated_upstream(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive upstream as (
    select b.id, b.kind, b.settings
      from public.boards b
     where b.id = p_board_id
    union
    select b.id, b.kind, b.settings
      from public.board_edges e
      join public.boards b on b.id = e.from_board_id
      join upstream u on u.id = e.to_board_id
  )
  select exists (
    select 1 from upstream
     where kind in ('ai_image', 'ai_video') or settings ->> 'generation' = 'model'
  );
$$;

revoke all on function private.launch_board_has_generated_upstream(uuid) from public, anon, authenticated;

create function private.refuse_laundered_artwork()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.output_role in ('panel_layer', 'print_file')
     and private.launch_board_has_generated_upstream(new.id) then
    raise exception 'This board''s picture comes through an AI board, and nothing a model made becomes a layer on the garment or part of a print file.'
      using errcode = 'P0001', hint = 'generated_is_never_artwork';
  end if;
  return new;
end;
$$;

revoke all on function private.refuse_laundered_artwork() from public, anon, authenticated;

-- `settings` is watched as well as the output, because a board says in its own settings that a
-- model made its picture (`generation`) and `save_launch_board` can change settings on a board that
-- already holds artwork. The WHEN clause keeps it cheap: nothing is walked unless the board's output
-- is artwork in the first place.
create trigger boards_artwork_never_comes_through_a_generated_board
  after insert or update of output_role, output_file_id, settings on public.boards
  for each row when (new.output_role in ('panel_layer', 'print_file'))
  execute function private.refuse_laundered_artwork();

/*
 * The same rule from the other end, which the trigger above cannot see.
 *
 * Setting an output and drawing a connector are two different writes, and the rule can be broken by
 * doing them in the other order: make a Marketing board's output a print file while its chain is
 * clean -- which is allowed, and right -- and then connect an AI Image board into it. The board's
 * row never changes, so nothing above fires, and the print file now holds pixels a model made.
 *
 * So a connector is refused when it would put something a model made behind a board whose output is
 * already artwork, anywhere downstream of it.
 */
create function private.launch_board_artwork_downstream(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive downstream as (
    select b.id, b.output_role
      from public.boards b
     where b.id = p_board_id
    union
    select b.id, b.output_role
      from public.board_edges e
      join public.boards b on b.id = e.to_board_id
      join downstream d on d.id = e.from_board_id
  )
  select exists (select 1 from downstream where output_role in ('panel_layer', 'print_file'));
$$;

revoke all on function private.launch_board_artwork_downstream(uuid) from public, anon, authenticated;

create function private.refuse_laundering_connector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.launch_board_has_generated_upstream(new.from_board_id)
     and private.launch_board_artwork_downstream(new.to_board_id) then
    raise exception 'That connector would put a picture a model made into a layer on the garment or part of a print file. Make that board''s output an asset first.'
      using errcode = 'P0001', hint = 'generated_is_never_artwork';
  end if;
  return new;
end;
$$;

revoke all on function private.refuse_laundering_connector() from public, anon, authenticated;

create trigger board_edges_artwork_never_comes_through_a_generated_board
  after insert or update of from_board_id, to_board_id on public.board_edges
  for each row execute function private.refuse_laundering_connector();

/*
 * And the third order of the same trick, which neither of the other two can see.
 *
 * A board says in its own settings that a model made its picture, and `save_launch_board` can save
 * settings long after an output was recorded. So: leave a clean Mockup board feeding a board whose
 * output is a print file, then give that Mockup board `{"generation": "model"}`. The row that
 * changed is the Mockup board, whose own output is only an asset, so the trigger on `boards` above
 * does not fire for it; no connector was drawn, so the trigger on `board_edges` does not either.
 *
 * This one fires on exactly that change and asks the question forwards instead of backwards.
 */
create function private.refuse_laundering_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.launch_board_artwork_downstream(new.id) then
    raise exception 'A board that feeds a layer on the garment or a print file cannot become a scene a model makes. Make that board''s output an asset first.'
      using errcode = 'P0001', hint = 'generated_is_never_artwork';
  end if;
  return new;
end;
$$;

revoke all on function private.refuse_laundering_settings() from public, anon, authenticated;

create trigger boards_a_model_scene_never_feeds_artwork
  after update of settings on public.boards
  for each row
  when (new.settings ->> 'generation' = 'model' and (old.settings ->> 'generation') is distinct from 'model')
  execute function private.refuse_laundering_settings();

-- ---------------------------------------------------------------------------------------------
-- Rights and row level security.

revoke all on public.flow_runs, public.flow_run_boards, public.flow_listings
  from public, anon, authenticated, service_role;
-- SELECT only for the server's key as well: every write goes through a function below, so a direct
-- update or delete answers "permission denied" before any trigger runs.
grant select on public.flow_runs, public.flow_run_boards, public.flow_listings to authenticated, service_role;

revoke all on public.flow_templates, public.flow_template_steps, public.flow_template_links
  from public, anon, authenticated, service_role;
grant select on public.flow_templates, public.flow_template_steps, public.flow_template_links to authenticated;
grant select, insert, update on public.flow_templates, public.flow_template_steps, public.flow_template_links to service_role;

alter table public.flow_runs enable row level security;
alter table public.flow_run_boards enable row level security;
alter table public.flow_listings enable row level security;
alter table public.flow_templates enable row level security;
alter table public.flow_template_steps enable row level security;
alter table public.flow_template_links enable row level security;

create policy "members read their brand's flow runs"
  on public.flow_runs for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's flow run boards"
  on public.flow_run_boards for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's listing hand-offs"
  on public.flow_listings for select to authenticated
  using (private.is_member(brand_id));

create policy "signed-in members read the flow templates"
  on public.flow_templates for select to authenticated
  using (true);

create policy "signed-in members read the flow template steps"
  on public.flow_template_steps for select to authenticated
  using (true);

create policy "signed-in members read the flow template links"
  on public.flow_template_links for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------------------------
-- Writes. Every one checks can_manage_kit itself and is callable by service_role only.

/* Starts a run and writes the estimate that was shown before it. */
create function public.start_flow_run(
  p_brand_id uuid, p_user_id uuid, p_launch_project_id uuid, p_scope text, p_from_board_id uuid,
  p_estimate_credits integer, p_template_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not run a flow for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.launch_projects p where p.id = p_launch_project_id and p.brand_id = p_brand_id) then
    raise exception 'That launch project does not exist.' using errcode = 'P0002', hint = 'launch_project_not_found';
  end if;
  -- The board the button was pressed on has to be a board of this brand and of this canvas. The
  -- column is a plain reference rather than a composite one, because `on delete set null` on a
  -- composite would try to null the brand as well (the same reason L1 gives on its own tables).
  if p_from_board_id is not null and not exists (
    select 1 from public.boards b
     where b.id = p_from_board_id and b.brand_id = p_brand_id and b.launch_project_id = p_launch_project_id
  ) then
    raise exception 'That board does not exist.' using errcode = 'P0002', hint = 'board_not_found';
  end if;

  insert into public.flow_runs (brand_id, launch_project_id, scope, from_board_id, status, estimate_credits, template_slug, created_by)
  values (p_brand_id, p_launch_project_id, p_scope, p_from_board_id, 'running', coalesce(p_estimate_credits, 0), p_template_slug, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

/* Records what one board of a run did. Called as the board starts and again as it finishes. */
create function public.set_flow_run_board(
  p_brand_id uuid, p_user_id uuid, p_run_id uuid, p_board_id uuid, p_position integer, p_status text,
  p_credits integer, p_refunded integer, p_spend_entry_id uuid, p_assets integer, p_format text,
  p_output_file_id uuid, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not run a flow for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.flow_runs r where r.id = p_run_id and r.brand_id = p_brand_id) then
    raise exception 'That flow run does not exist.' using errcode = 'P0002', hint = 'flow_run_not_found';
  end if;
  if not exists (select 1 from public.boards b where b.id = p_board_id and b.brand_id = p_brand_id) then
    raise exception 'That board does not exist.' using errcode = 'P0002', hint = 'board_not_found';
  end if;

  insert into public.flow_run_boards
    (brand_id, run_id, board_id, position, status, credits, refunded_credits, spend_entry_id, assets, format, output_file_id, reason)
  values
    (p_brand_id, p_run_id, p_board_id, p_position, p_status, coalesce(p_credits, 0), coalesce(p_refunded, 0),
     p_spend_entry_id, coalesce(p_assets, 1), coalesce(p_format, 'png'), p_output_file_id, p_reason)
  on conflict (run_id, board_id) do update
     set position = excluded.position,
         status = excluded.status,
         credits = excluded.credits,
         refunded_credits = excluded.refunded_credits,
         spend_entry_id = coalesce(excluded.spend_entry_id, public.flow_run_boards.spend_entry_id),
         assets = excluded.assets,
         format = excluded.format,
         output_file_id = excluded.output_file_id,
         reason = excluded.reason,
         updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

/* Closes a run: its status, what it spent after refunds and how many assets came out. */
create function public.finish_flow_run(
  p_brand_id uuid, p_user_id uuid, p_run_id uuid, p_status text, p_spent integer, p_refunded integer, p_assets integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not run a flow for this brand.' using errcode = '42501';
  end if;
  -- Closing a run means it ended. A run that is still going is written by set_flow_run_board, so
  -- the state it ends in is one of the three a finished run can be in; anything else would leave a
  -- row saying it had finished at a time it had not.
  if coalesce(p_status, '') not in ('done', 'part_done', 'failed') then
    raise exception 'A run is closed as done, part done or failed.' using errcode = 'P0001', hint = 'run_not_finished';
  end if;
  update public.flow_runs
     set status = p_status,
         spent_credits = coalesce(p_spent, spent_credits),
         refunded_credits = coalesce(p_refunded, refunded_credits),
         assets = coalesce(p_assets, assets),
         -- When it ended, kept: a second call says the same thing about the same run.
         finished_at = coalesce(finished_at, now())
   where id = p_run_id and brand_id = p_brand_id
  returning id into v_id;
  if v_id is null then
    raise exception 'That flow run does not exist.' using errcode = 'P0002', hint = 'flow_run_not_found';
  end if;
  return v_id;
end;
$$;

/*
 * Charges for ONE board's output, once per output kind, design version AND board.
 *
 * `credit_spend` charges once per output kind and design version, which is right for a tech pack
 * PDF -- asking for the same document twice should not cost twice -- and wrong for a launch pack,
 * where it would mean one charge for fourteen boards and nothing to give back when the thirteenth
 * fails. This keeps that idempotency and adds the board to the key.
 *
 * The ledger line still names the plain design version in `design_version_hash`, so
 * `credit_refund_for_order` still sweeps a flow's spends up when the design is ordered. Only the
 * idempotency key differs.
 *
 * **The output key carries the run, not only the board** (`lib/flows/server.ts` passes
 * `<run>:<board>`). Charging per board alone would make a retry free after its credits had been
 * given back: the key would already be in the ledger, so the second model call would cost nothing.
 * Within one run the key does not change, so a retry inside a run is free, which is the promise the
 * platform already makes. The key is stored as a digest, because a run, a board and a version hash
 * together are longer than a ledger key may be.
 *
 * Returns { ok: true, charged, price, balance, entry_id } or
 * { ok: false, reason: 'insufficient', price, balance }, exactly as `credit_spend` does.
 */
create function public.credit_spend_output(
  p_brand_id uuid,
  p_user_id uuid,
  p_kind text,
  p_version_hash text,
  p_output_key text,
  p_usage_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price integer;
  -- A digest, so a run id, a board id and a version hash together always fit a ledger key. The
  -- prefix differs from `credit_spend`'s, so the two can never land on one key.
  -- The length of the hash goes into the digest as well, so a version and an output key cannot be
  -- read two ways across the separator and two different spends can never share a key.
  v_key text := 'spend-output:' || p_kind || ':' || md5(length(p_version_hash)::text || ':' || p_version_hash || ':' || p_output_key);
  v_existing uuid;
  v_balance bigint;
  v_id uuid;
begin
  if p_version_hash is null or length(p_version_hash) not between 1 and 200 then
    raise exception 'A design version is named by a hash of 1 to 200 characters.' using errcode = '22023';
  end if;
  if p_output_key is null or length(p_output_key) not between 1 and 200 then
    raise exception 'An output is named by a key of 1 to 200 characters.' using errcode = '22023';
  end if;
  select cp.credits into v_price from public.credit_prices cp where cp.output_kind = p_kind;
  if not found then
    raise exception 'No credit price is set for that output.' using errcode = '22023';
  end if;
  -- Charging a brand's credits is changing its kit, so the same ability the rest of this file asks
  -- for. `credit_spend` asks only for membership; a viewer should not be able to spend.
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not spend this brand''s credits.' using errcode = '42501';
  end if;

  perform private.credit_lock(p_brand_id);
  v_balance := private.credit_balance(p_brand_id);

  select l.id into v_existing from public.credit_ledger l
   where l.brand_id = p_brand_id and l.idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'charged', false, 'price', v_price, 'balance', v_balance, 'entry_id', v_existing);
  end if;
  if v_price = 0 then
    return jsonb_build_object('ok', true, 'charged', false, 'price', 0, 'balance', v_balance, 'entry_id', null);
  end if;
  if v_balance < v_price then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'price', v_price, 'balance', v_balance);
  end if;

  insert into public.credit_ledger
    (brand_id, kind, amount, output_kind, design_version_hash, idempotency_key, created_by, usage_event_id)
  values
    (p_brand_id, 'spend', -v_price, p_kind, p_version_hash, v_key, p_user_id, p_usage_event_id)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'charged', true, 'price', v_price, 'balance', v_balance - v_price, 'entry_id', v_id);
end;
$$;

/*
 * Gives back ONE spend, once. Returns { refunded, balance }; { refunded: 0 } when there was
 * nothing to give back, so calling it twice is harmless.
 *
 * `credit_refund_for_order` gives back every spend on a design version, because the design was
 * ordered. This is the other shape, and the one a failed generation needs: one board of fourteen
 * did not finish, so its charge comes back and the other thirteen stand. The ledger's own
 * `unique (refund_of)` is what makes the second call do nothing.
 */
create function public.credit_refund_spend(p_brand_id uuid, p_entry_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refunded bigint;
begin
  perform private.credit_lock(p_brand_id);
  with given as (
    insert into public.credit_ledger
      (brand_id, kind, amount, output_kind, design_version_hash, refund_of, idempotency_key, note)
    -- The note is cut to what a ledger line holds: a board's own reason may be longer than that,
    -- and a refund that failed a length check would leave the brand short.
    select s.brand_id, 'refund', -s.amount, s.output_kind, s.design_version_hash, s.id, 'refund:' || s.id,
           left(coalesce(nullif(btrim(p_note), ''), 'Output did not finish'), 200)
      from public.credit_ledger s
     where s.id = p_entry_id and s.brand_id = p_brand_id and s.kind = 'spend'
       and not exists (select 1 from public.credit_ledger r where r.refund_of = s.id)
    returning amount
  )
  select coalesce(sum(amount), 0) into v_refunded from given;
  return jsonb_build_object('refunded', v_refunded, 'balance', private.credit_balance(p_brand_id));
end;
$$;

/*
 * The Store saying it has read a hand-off. The one change an append-only hand-off allows, and the
 * only thing that may make it: the table grants nobody UPDATE, so without this function the
 * `collected_at` column could never be set at all and the trigger's one exception would be dead
 * letter. Calling it twice leaves the first time on the row.
 *
 * It takes no person, because the Store is not one: it is the server's own key reading what it has
 * been given, as wave 5's Store contract (O2) will. Nothing about the hand-off itself can change.
 */
create function public.collect_flow_listing(p_listing_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  update public.flow_listings
     set collected_at = now()
   where id = p_listing_id and collected_at is null;
  select l.collected_at into v_at from public.flow_listings l where l.id = p_listing_id;
  if v_at is null then
    raise exception 'That listing hand-off does not exist.' using errcode = 'P0002', hint = 'listing_not_found';
  end if;
  return v_at;
end;
$$;

/* Writes a listing hand-off for the Store to collect. It publishes nothing. */
create function public.publish_flow_listing(
  p_brand_id uuid, p_user_id uuid, p_launch_project_id uuid, p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not hand a listing over for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.launch_projects p where p.id = p_launch_project_id and p.brand_id = p_brand_id) then
    raise exception 'That launch project does not exist.' using errcode = 'P0002', hint = 'launch_project_not_found';
  end if;
  if coalesce(p_payload ->> 'kind', '') <> 'launch-listing' then
    raise exception 'A listing hand-off carries a launch-listing payload.' using errcode = 'P0001', hint = 'not_a_listing';
  end if;

  insert into public.flow_listings (brand_id, launch_project_id, payload, created_by)
  values (p_brand_id, p_launch_project_id, p_payload, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.start_flow_run(uuid, uuid, uuid, text, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.set_flow_run_board(uuid, uuid, uuid, uuid, integer, text, integer, integer, uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_flow_run(uuid, uuid, uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.credit_spend_output(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.credit_refund_spend(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.publish_flow_listing(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.collect_flow_listing(uuid) from public, anon, authenticated;

grant execute on function public.start_flow_run(uuid, uuid, uuid, text, uuid, integer, text) to service_role;
grant execute on function public.set_flow_run_board(uuid, uuid, uuid, uuid, integer, text, integer, integer, uuid, integer, text, uuid, text) to service_role;
grant execute on function public.finish_flow_run(uuid, uuid, uuid, text, integer, integer, integer) to service_role;
grant execute on function public.credit_spend_output(uuid, uuid, text, text, text, uuid) to service_role;
grant execute on function public.credit_refund_spend(uuid, uuid, text) to service_role;
grant execute on function public.publish_flow_listing(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.collect_flow_listing(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Seeds: the six packs of `07`, from apps/web/lib/flows/templates/**.
--
-- `apps/web/lib/flows/migration.test.ts` reads this file and fails when a pack, a step, a link or a
-- count here disagrees with that directory, so neither side can drift. Nobody has reviewed these
-- packs: each row's note says so, and the template card prints it.
insert into public.flow_templates (slug, title, lead, sections, assets, tutorial_title, tutorial_body, tutorial_url, tutorial_note, note, rule_id, sort) values
  ('club-kit-launch-pack', 'Club kit launch pack', 'One design becomes the whole launch: six renders, three teamwear scenes, three posts, a turntable and an order story.', array['1 PICK YOUR KIT', '2 MOCKUPS', '3 SOCIAL POSTS', '4 VIDEO'], 14,
   'Watch tutorial: Club kit launch pack', 'Put your kit on the Design board, press Run all, and the fourteen outputs below are made in order. Swap the design and run it again for the away kit.', null, 'No tutorial film has been made yet, so this card opens nothing. The steps below say what each board does.',
   'Knitwright draft from docs/spec/07-template-library.md, not reviewed by anyone. The asset count is the spec''s own; the split across steps is a default.', 'R-GAP-000', 1),
  ('brand-drop-pack', 'Brand drop pack', 'A drop announced end to end: eight listing images, four lifestyle scenes, a post, a story and two clips.', array['1 PICK YOUR DESIGN', '2 LISTING IMAGES', '3 LIFESTYLE', '4 SOCIAL', '5 VIDEO'], 16,
   'Watch tutorial: Brand drop pack', 'Everything a drop needs in one run. The listing images are free; the four lifestyle scenes and the two clips cost credits, and the estimate is shown before anything is spent.', null, 'No tutorial film has been made yet, so this card opens nothing. The steps below say what each board does.',
   'Knitwright draft from docs/spec/07-template-library.md, not reviewed by anyone. The asset count is the spec''s own; the split across steps is a default.', 'R-GAP-000', 2),
  ('team-store-promo', 'Team store promo', 'The run a club does when the store opens: order now, a size reminder, and a last chance before it closes.', array['1 PICK YOUR KIT', '2 ORDER NOW', '3 REMINDERS'], 6,
   'Watch tutorial: Team store promo', 'Six outputs, every one free: the platform draws the kit and builds the posts around it. Run it once when the store opens and again before it closes.', null, 'No tutorial film has been made yet, so this card opens nothing. The steps below say what each board does.',
   'Knitwright draft from docs/spec/07-template-library.md, not reviewed by anyone. The asset count is the spec''s own; the split across steps is a default.', 'R-GAP-000', 3),
  ('shopify-product-listing', 'Shopify product listing', 'The seven files a product listing needs: five images, a size chart and a carousel clip.', array['1 PICK YOUR DESIGN', '2 LISTING IMAGES', '3 SIZE CHART', '4 CAROUSEL'], 7,
   'Watch tutorial: Shopify product listing', 'Run it, then Export all. The zip holds a png folder and an mp4 folder, which is what a listing wants. Publishing to a store is a separate hand-off.', null, 'No tutorial film has been made yet, so this card opens nothing. The steps below say what each board does.',
   'Knitwright draft from docs/spec/07-template-library.md, not reviewed by anyone. The asset count is the spec''s own; the split across steps is a default.', 'R-GAP-000', 4),
  ('colourway-set', 'Colourway set', 'Home, away and goalkeeper side by side: a render and a flat lay of each, and one post that compares them.', array['1 PICK YOUR KIT', '2 COLOURWAYS', '3 COMPARISON'], 7,
   'Watch tutorial: Colourway set', 'Every board here is free. Change a colour on the design and press Run all: the six pictures and the comparison post are all redrawn from it.', null, 'No tutorial film has been made yet, so this card opens nothing. The steps below say what each board does.',
   'Knitwright draft from docs/spec/07-template-library.md, not reviewed by anyone. The asset count is the spec''s own; the split across steps is a default.', 'R-GAP-000', 5),
  ('sponsor-pack', 'Sponsor pack', 'What a club sends a sponsor: the kit, a thank-you post, a close-up of their placement and an A4 poster.', array['1 PICK YOUR KIT', '2 THANK YOU', '3 PRINT'], 4,
   'Watch tutorial: Sponsor pack', 'Place the sponsor''s artwork on the design first; every board here reads it from the design rather than holding a copy. All four outputs are free.', null, 'No tutorial film has been made yet, so this card opens nothing. The steps below say what each board does.',
   'Knitwright draft from docs/spec/07-template-library.md, not reviewed by anyone. The asset count is the spec''s own; the split across steps is a default.', 'R-GAP-000', 6);

insert into public.flow_template_steps (template_slug, step_key, section, kind, name, settings, note, generation, assets, format, sort) values
  ('club-kit-launch-pack', 'design', '1 PICK YOUR KIT', 'design', 'Home kit',
   '{"designProjectId":null}'::jsonb, 'Swap in your design, then press Run all. Every board keeps its own prompt, so nothing is typed again.', 'deterministic', 0, 'png', 1),
  ('club-kit-launch-pack', 'render-front', '2 MOCKUPS', 'mockup', 'Front render',
   '{"scene":"render-front","aspect":"1:1"}'::jsonb, 'The platform draws these six from your design. They are free and they follow the design.', 'deterministic', 1, 'png', 2),
  ('club-kit-launch-pack', 'render-back', '2 MOCKUPS', 'mockup', 'Back render',
   '{"scene":"render-back","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 3),
  ('club-kit-launch-pack', 'render-three-quarter', '2 MOCKUPS', 'mockup', 'Three-quarter render',
   '{"scene":"render-three-quarter","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 4),
  ('club-kit-launch-pack', 'render-side', '2 MOCKUPS', 'mockup', 'Side render',
   '{"scene":"render-side","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 5),
  ('club-kit-launch-pack', 'flat-lay', '2 MOCKUPS', 'mockup', 'Flat lay',
   '{"scene":"flat-lay","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 6),
  ('club-kit-launch-pack', 'hanger', '2 MOCKUPS', 'mockup', 'On a hanger',
   '{"scene":"hanger","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 7),
  ('club-kit-launch-pack', 'changing-room', '2 MOCKUPS', 'ai_image', 'Changing-room kit layout',
   '{"scene":"changing-room-kit-layout","prompt":"Changing-room kit layout, floodlit, the garment unchanged","aspect":"4:5","count":1,"garmentLocked":true}'::jsonb, 'A model makes the scene around the kit. The kit itself stays the picture the platform drew.', 'model', 1, 'png', 8),
  ('club-kit-launch-pack', 'line-up', '2 MOCKUPS', 'ai_image', 'Team line-up (11)',
   '{"scene":"team-line-up-11","prompt":"Team line-up (11), floodlit, the garment unchanged","aspect":"4:5","count":1,"garmentLocked":true}'::jsonb, null, 'model', 1, 'png', 9),
  ('club-kit-launch-pack', 'tunnel', '2 MOCKUPS', 'ai_image', 'Tunnel walk-out',
   '{"scene":"tunnel-walk-out","prompt":"Tunnel walk-out, floodlit, the garment unchanged","aspect":"4:5","count":1,"garmentLocked":true}'::jsonb, null, 'model', 1, 'png', 10),
  ('club-kit-launch-pack', 'post-square', '3 SOCIAL POSTS', 'marketing', '"New kit" square',
   '{"campaign":"new-kit-launch","aspect":"1:1","headline":"New kit","copy":""}'::jsonb, 'The three formats of the spec: square, feed and story. Text comes from your brand styles.', 'deterministic', 1, 'png', 11),
  ('club-kit-launch-pack', 'post-feed', '3 SOCIAL POSTS', 'marketing', '"New kit" post',
   '{"campaign":"new-kit-launch","aspect":"4:5","headline":"New kit","copy":""}'::jsonb, null, 'deterministic', 1, 'png', 12),
  ('club-kit-launch-pack', 'post-story', '3 SOCIAL POSTS', 'marketing', '"New kit" story',
   '{"campaign":"new-kit-launch","aspect":"9:16","headline":"New kit","copy":""}'::jsonb, null, 'deterministic', 1, 'png', 13),
  ('club-kit-launch-pack', 'turntable', '4 VIDEO', 'mockup', '360° turntable',
   '{"scene":"turntable-360","seconds":6,"aspect":"1:1"}'::jsonb, 'Six seconds, drawn from the 3D model, so it is free and it never drifts.', 'deterministic', 1, 'mp4', 14),
  ('club-kit-launch-pack', 'order-story', '3 SOCIAL POSTS', 'marketing', '"Order your kit" story',
   '{"campaign":"team-store-open","aspect":"9:16","qrChip":true,"headline":"Order your kit","copy":""}'::jsonb, 'Export all as a zip when the run finishes: one folder per format.', 'deterministic', 1, 'png', 15),
  ('brand-drop-pack', 'design', '1 PICK YOUR DESIGN', 'design', 'The design you are dropping',
   '{"designProjectId":null}'::jsonb, 'Swap in your design, then press Run all. Every board keeps its own prompt, so nothing is typed again.', 'deterministic', 0, 'png', 1),
  ('brand-drop-pack', 'white-1-1-front', '2 LISTING IMAGES', 'mockup', 'White 1:1, front',
   '{"scene":"ecommerce-white","view":"front","aspect":"1:1"}'::jsonb, 'The e-commerce set: white background, square and 4:5, four views each. Free and deterministic.', 'deterministic', 1, 'png', 2),
  ('brand-drop-pack', 'white-1-1-back', '2 LISTING IMAGES', 'mockup', 'White 1:1, back',
   '{"scene":"ecommerce-white","view":"back","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 3),
  ('brand-drop-pack', 'white-1-1-three-quarter', '2 LISTING IMAGES', 'mockup', 'White 1:1, three quarter',
   '{"scene":"ecommerce-white","view":"three-quarter","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 4),
  ('brand-drop-pack', 'white-1-1-side', '2 LISTING IMAGES', 'mockup', 'White 1:1, side',
   '{"scene":"ecommerce-white","view":"side","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 5),
  ('brand-drop-pack', 'white-4-5-front', '2 LISTING IMAGES', 'mockup', 'White 4:5, front',
   '{"scene":"ecommerce-white","view":"front","aspect":"4:5"}'::jsonb, null, 'deterministic', 1, 'png', 6),
  ('brand-drop-pack', 'white-4-5-back', '2 LISTING IMAGES', 'mockup', 'White 4:5, back',
   '{"scene":"ecommerce-white","view":"back","aspect":"4:5"}'::jsonb, null, 'deterministic', 1, 'png', 7),
  ('brand-drop-pack', 'white-4-5-three-quarter', '2 LISTING IMAGES', 'mockup', 'White 4:5, three quarter',
   '{"scene":"ecommerce-white","view":"three-quarter","aspect":"4:5"}'::jsonb, null, 'deterministic', 1, 'png', 8),
  ('brand-drop-pack', 'white-4-5-side', '2 LISTING IMAGES', 'mockup', 'White 4:5, side',
   '{"scene":"ecommerce-white","view":"side","aspect":"4:5"}'::jsonb, null, 'deterministic', 1, 'png', 9),
  ('brand-drop-pack', 'lifestyle-city', '3 LIFESTYLE', 'ai_image', 'City street',
   '{"prompt":"City street at golden hour, shallow depth of field, the garment unchanged","style":"editorial","aspect":"4:5","count":1,"garmentLocked":true}'::jsonb, 'A model changes the scene, the light and the camera. It never redraws the garment.', 'model', 1, 'png', 10),
  ('brand-drop-pack', 'lifestyle-gym', '3 LIFESTYLE', 'ai_image', 'Gym mirror',
   '{"prompt":"Gym mirror under hard light, the garment unchanged","style":"editorial","aspect":"4:5","count":1,"garmentLocked":true}'::jsonb, null, 'model', 1, 'png', 11),
  ('brand-drop-pack', 'lifestyle-track', '3 LIFESTYLE', 'ai_image', 'Track warm-up',
   '{"prompt":"Running track at dawn, cool light, the garment unchanged","style":"editorial","aspect":"4:5","count":1,"garmentLocked":true}'::jsonb, null, 'model', 1, 'png', 12),
  ('brand-drop-pack', 'lifestyle-studio', '3 LIFESTYLE', 'ai_image', 'Studio backdrop',
   '{"prompt":"Coloured studio backdrop, soft light, the garment unchanged","style":"editorial","aspect":"4:5","count":1,"garmentLocked":true}'::jsonb, null, 'model', 1, 'png', 13),
  ('brand-drop-pack', 'drop-post', '4 SOCIAL', 'marketing', 'Drop announcement post',
   '{"campaign":"limited-drop","aspect":"4:5","headline":"The drop","copy":""}'::jsonb, 'Pixel-locked: the pictures you feed it stay exactly as they are.', 'deterministic', 1, 'png', 14),
  ('brand-drop-pack', 'drop-story', '4 SOCIAL', 'marketing', 'Drop announcement story',
   '{"campaign":"limited-drop","aspect":"9:16","headline":"The drop","copy":""}'::jsonb, null, 'deterministic', 1, 'png', 15),
  ('brand-drop-pack', 'clip-orbit', '5 VIDEO', 'ai_video', 'Slow orbit clip',
   '{"preset":"slow-orbit","seconds":6,"aspect":"9:16","audio":false,"garmentLocked":true}'::jsonb, 'The first frame is always a picture the platform drew, and the checker samples the frames.', 'model', 1, 'mp4', 16),
  ('brand-drop-pack', 'clip-tracking', '5 VIDEO', 'ai_video', 'Smooth tracking clip',
   '{"preset":"smooth-tracking","seconds":6,"aspect":"16:9","audio":false,"garmentLocked":true}'::jsonb, 'Export all as a zip when the run finishes: one folder per format.', 'model', 1, 'mp4', 17),
  ('team-store-promo', 'design', '1 PICK YOUR KIT', 'design', 'The kit you have a golden sample for',
   '{"designProjectId":null}'::jsonb, 'Swap in your design, then press Run all. Every board keeps its own prompt, so nothing is typed again.', 'deterministic', 0, 'png', 1),
  ('team-store-promo', 'hanger', '1 PICK YOUR KIT', 'mockup', 'Kit on a hanger',
   '{"scene":"hanger","aspect":"1:1"}'::jsonb, 'The one picture the four posts are built around.', 'deterministic', 1, 'png', 2),
  ('team-store-promo', 'order-post', '2 ORDER NOW', 'marketing', '"Order now" post',
   '{"campaign":"team-store-open","aspect":"1:1","headline":"Order now","copy":""}'::jsonb, 'Text comes from your brand''s headline and body styles.', 'deterministic', 1, 'png', 3),
  ('team-store-promo', 'order-story', '2 ORDER NOW', 'marketing', '"Order now" story',
   '{"campaign":"team-store-open","aspect":"9:16","headline":"Order now","copy":""}'::jsonb, null, 'deterministic', 1, 'png', 4),
  ('team-store-promo', 'size-card', '3 REMINDERS', 'info_card', 'Size reminder card',
   '{"card":"size_chart","aspect":"1:1"}'::jsonb, 'Read from the factory file and the catalogue, so the numbers are the garment''s own.', 'deterministic', 1, 'png', 5),
  ('team-store-promo', 'size-post', '3 REMINDERS', 'marketing', '"Check your size" post',
   '{"campaign":"team-store-open","aspect":"4:5","headline":"Check your size","copy":""}'::jsonb, null, 'deterministic', 1, 'png', 6),
  ('team-store-promo', 'last-chance', '3 REMINDERS', 'marketing', '"Last chance" story',
   '{"campaign":"last-chance","aspect":"9:16","headline":"Last chance","copy":""}'::jsonb, 'Export all as a zip when the run finishes: one folder per format.', 'deterministic', 1, 'png', 7),
  ('shopify-product-listing', 'design', '1 PICK YOUR DESIGN', 'design', 'The design you are listing',
   '{"designProjectId":null}'::jsonb, 'Swap in your design, then press Run all. Every board keeps its own prompt, so nothing is typed again.', 'deterministic', 0, 'png', 1),
  ('shopify-product-listing', 'white-square', '2 LISTING IMAGES', 'mockup', 'White background 1:1',
   '{"scene":"ecommerce-white","aspect":"1:1"}'::jsonb, 'Five pictures a listing needs, all free and all drawn from your design.', 'deterministic', 1, 'png', 2),
  ('shopify-product-listing', 'white-portrait', '2 LISTING IMAGES', 'mockup', 'White background 4:5',
   '{"scene":"ecommerce-white","aspect":"4:5"}'::jsonb, null, 'deterministic', 1, 'png', 3),
  ('shopify-product-listing', 'flat-lay', '2 LISTING IMAGES', 'mockup', 'Flat lay',
   '{"scene":"flat-lay","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 4),
  ('shopify-product-listing', 'hanger', '2 LISTING IMAGES', 'mockup', 'On a hanger',
   '{"scene":"hanger","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 5),
  ('shopify-product-listing', 'ghost', '2 LISTING IMAGES', 'mockup', 'Ghost mannequin',
   '{"scene":"ghost-mannequin","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 6),
  ('shopify-product-listing', 'size-chart', '3 SIZE CHART', 'info_card', 'Size chart image',
   '{"card":"size_chart","aspect":"1:1"}'::jsonb, 'Garment measurements, from the factory file. A listing that shows body sizes instead is a return waiting to happen.', 'deterministic', 1, 'png', 7),
  ('shopify-product-listing', 'carousel', '4 CAROUSEL', 'mockup', 'Product carousel',
   '{"scene":"product-carousel","seconds":12,"aspect":"1:1"}'::jsonb, 'Export all as a zip when the run finishes: one folder per format.', 'deterministic', 1, 'mp4', 8),
  ('colourway-set', 'design', '1 PICK YOUR KIT', 'design', 'The kit whose colourways you are showing',
   '{"designProjectId":null}'::jsonb, 'Swap in your design, then press Run all. Every board keeps its own prompt, so nothing is typed again.', 'deterministic', 0, 'png', 1),
  ('colourway-set', 'render-home', '2 COLOURWAYS', 'mockup', 'Home front render',
   '{"scene":"render-front","colourway":"home","aspect":"1:1"}'::jsonb, 'One board per colourway. The switcher on each board is the colourway it renders.', 'deterministic', 1, 'png', 2),
  ('colourway-set', 'flat-lay-home', '2 COLOURWAYS', 'mockup', 'Home flat lay',
   '{"scene":"flat-lay","colourway":"home","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 3),
  ('colourway-set', 'render-away', '2 COLOURWAYS', 'mockup', 'Away front render',
   '{"scene":"render-front","colourway":"away","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 4),
  ('colourway-set', 'flat-lay-away', '2 COLOURWAYS', 'mockup', 'Away flat lay',
   '{"scene":"flat-lay","colourway":"away","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 5),
  ('colourway-set', 'render-goalkeeper', '2 COLOURWAYS', 'mockup', 'Goalkeeper front render',
   '{"scene":"render-front","colourway":"goalkeeper","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 6),
  ('colourway-set', 'flat-lay-goalkeeper', '2 COLOURWAYS', 'mockup', 'Goalkeeper flat lay',
   '{"scene":"flat-lay","colourway":"goalkeeper","aspect":"1:1"}'::jsonb, null, 'deterministic', 1, 'png', 7),
  ('colourway-set', 'comparison', '3 COMPARISON', 'marketing', 'Colourway comparison post',
   '{"campaign":"new-kit-launch","aspect":"4:5","headline":"Three ways to play","copy":""}'::jsonb, 'Export all as a zip when the run finishes: one folder per format.', 'deterministic', 1, 'png', 8),
  ('sponsor-pack', 'design', '1 PICK YOUR KIT', 'design', 'The kit with the sponsor''s artwork on it',
   '{"designProjectId":null}'::jsonb, 'Swap in your design, then press Run all. Every board keeps its own prompt, so nothing is typed again.', 'deterministic', 0, 'png', 1),
  ('sponsor-pack', 'kit-render', '1 PICK YOUR KIT', 'mockup', 'Kit with the sponsor placed',
   '{"scene":"render-front","aspect":"1:1"}'::jsonb, 'The sponsor''s artwork is the one on your design, at the placement the factory file holds.', 'deterministic', 1, 'png', 2),
  ('sponsor-pack', 'thank-you', '2 THANK YOU', 'marketing', 'Sponsor thank-you post',
   '{"campaign":"sponsor-thank-you","aspect":"1:1","headline":"Thank you","copy":""}'::jsonb, 'The sponsor''s own mark goes in the empty slot. Knitwright ships no sponsor artwork.', 'deterministic', 1, 'png', 3),
  ('sponsor-pack', 'close-up', '2 THANK YOU', 'mockup', 'Close-up on the sponsor area',
   '{"scene":"render-front","frame":"sponsor-placement","aspect":"1:1"}'::jsonb, 'Framed on the placement, drawn at the print resolution rather than enlarged from the post.', 'deterministic', 1, 'png', 4),
  ('sponsor-pack', 'poster', '3 PRINT', 'marketing', 'A4 poster',
   '{"campaign":"sponsor-thank-you","preset":"a4-print","dpi":300,"headline":"Thank you","copy":""}'::jsonb, 'Export all as a zip when the run finishes: one folder per format.', 'deterministic', 1, 'pdf', 5);

insert into public.flow_template_links (template_slug, from_step, to_step, input_index) values
  ('club-kit-launch-pack', 'design', 'render-front', 1),
  ('club-kit-launch-pack', 'design', 'render-back', 1),
  ('club-kit-launch-pack', 'design', 'render-three-quarter', 1),
  ('club-kit-launch-pack', 'design', 'render-side', 1),
  ('club-kit-launch-pack', 'design', 'flat-lay', 1),
  ('club-kit-launch-pack', 'design', 'hanger', 1),
  ('club-kit-launch-pack', 'design', 'changing-room', 1),
  ('club-kit-launch-pack', 'design', 'line-up', 1),
  ('club-kit-launch-pack', 'design', 'tunnel', 1),
  ('club-kit-launch-pack', 'render-front', 'post-square', 1),
  ('club-kit-launch-pack', 'line-up', 'post-square', 2),
  ('club-kit-launch-pack', 'render-front', 'post-feed', 1),
  ('club-kit-launch-pack', 'line-up', 'post-feed', 2),
  ('club-kit-launch-pack', 'render-front', 'post-story', 1),
  ('club-kit-launch-pack', 'line-up', 'post-story', 2),
  ('club-kit-launch-pack', 'design', 'turntable', 1),
  ('club-kit-launch-pack', 'flat-lay', 'order-story', 1),
  ('brand-drop-pack', 'design', 'white-1-1-front', 1),
  ('brand-drop-pack', 'design', 'white-1-1-back', 1),
  ('brand-drop-pack', 'design', 'white-1-1-three-quarter', 1),
  ('brand-drop-pack', 'design', 'white-1-1-side', 1),
  ('brand-drop-pack', 'design', 'white-4-5-front', 1),
  ('brand-drop-pack', 'design', 'white-4-5-back', 1),
  ('brand-drop-pack', 'design', 'white-4-5-three-quarter', 1),
  ('brand-drop-pack', 'design', 'white-4-5-side', 1),
  ('brand-drop-pack', 'white-1-1-front', 'lifestyle-city', 1),
  ('brand-drop-pack', 'white-1-1-front', 'lifestyle-gym', 1),
  ('brand-drop-pack', 'white-1-1-front', 'lifestyle-track', 1),
  ('brand-drop-pack', 'white-1-1-front', 'lifestyle-studio', 1),
  ('brand-drop-pack', 'lifestyle-city', 'drop-post', 1),
  ('brand-drop-pack', 'white-1-1-front', 'drop-post', 2),
  ('brand-drop-pack', 'lifestyle-gym', 'drop-story', 1),
  ('brand-drop-pack', 'lifestyle-city', 'clip-orbit', 1),
  ('brand-drop-pack', 'lifestyle-track', 'clip-tracking', 1),
  ('team-store-promo', 'design', 'hanger', 1),
  ('team-store-promo', 'hanger', 'order-post', 1),
  ('team-store-promo', 'hanger', 'order-story', 1),
  ('team-store-promo', 'design', 'size-card', 1),
  ('team-store-promo', 'size-card', 'size-post', 1),
  ('team-store-promo', 'hanger', 'last-chance', 1),
  ('shopify-product-listing', 'design', 'white-square', 1),
  ('shopify-product-listing', 'design', 'white-portrait', 1),
  ('shopify-product-listing', 'design', 'flat-lay', 1),
  ('shopify-product-listing', 'design', 'hanger', 1),
  ('shopify-product-listing', 'design', 'ghost', 1),
  ('shopify-product-listing', 'design', 'size-chart', 1),
  ('shopify-product-listing', 'design', 'carousel', 1),
  ('colourway-set', 'design', 'render-home', 1),
  ('colourway-set', 'design', 'flat-lay-home', 1),
  ('colourway-set', 'design', 'render-away', 1),
  ('colourway-set', 'design', 'flat-lay-away', 1),
  ('colourway-set', 'design', 'render-goalkeeper', 1),
  ('colourway-set', 'design', 'flat-lay-goalkeeper', 1),
  ('colourway-set', 'render-home', 'comparison', 1),
  ('colourway-set', 'render-away', 'comparison', 2),
  ('colourway-set', 'render-goalkeeper', 'comparison', 3),
  ('sponsor-pack', 'design', 'kit-render', 1),
  ('sponsor-pack', 'kit-render', 'thank-you', 1),
  ('sponsor-pack', 'design', 'close-up', 1),
  ('sponsor-pack', 'kit-render', 'poster', 1);
