-- The launch shell and its boards (plans/platform-v5.md wave 4, L1; spec Launch section, F-L1 to
-- F-L4; decision 0091).
--
-- A launch project is a canvas of boards joined by connectors: a Design board, mockups, AI image
-- and AI video boards, marketing artboards and info cards. L2 to L6 fill the panels; this file is
-- the state they all read and write through.
--
-- THE GARMENT IS ALWAYS LOCKED. Every picture starts from the deterministic render or the
-- golden-sample photo, and a model may only change the scene (spec decision 13, principle 4). This
-- file makes that structural rather than advisory, in three places:
--
--   * `boards_generated_output_is_never_artwork`: a board whose picture comes out of a model
--     (ai_image, ai_video) can only ever carry output_role 'asset'. It can never be recorded as a
--     panel layer or as part of a print file, whatever the application asks for.
--   * `connect_launch_boards` refuses any connector the spec's board table does not allow, so a
--     generated board cannot be fed by something that is not a picture the platform drew.
--   * `set_launch_board_output` refuses to record an output on a generated board unless a Design
--     board can be reached by following its connectors backwards.
--
-- Money and credits are integer counts of credits, as `credit_ledger` holds them. No price is in
-- this file: what a generated board costs is read from the platform's credit settings
-- (`credit_prices`), which a platform admin changes, and every board records what its own last run
-- actually spent.
--
-- There is no Store here (owner decision 1): no cart, no checkout, no payment, no storefront, no
-- payout, and no column that could hold one. The spec's "Publish to store" is L6's, and it produces
-- a payload for the Store to collect, exactly as the collection drop does.
--
-- Every table is brand-scoped with row level security on, except launch_artboard_presets, which is
-- platform data every signed-in member may read. Members read their own brand's rows; nobody writes
-- directly, not even the server's own key. Each write is a SECURITY DEFINER function only
-- service_role may run, which checks the caller's role itself (the club rule can_manage_kit, as the
-- collection plans and the brand runs do).

-- ---------------------------------------------------------------------------------------------
-- The artboard presets (platform data).
--
-- The spec names the sizes a launch artboard starts from: Instagram post 4:5, Story 9:16, social
-- square 1:1, hero banner 16:9, Pin 2:3 and A4 print. They are rows, not literals in TypeScript,
-- because a size nobody can change is a decision hidden in code. None of them was reviewed by
-- anybody, and each row says so; rule_id is R-GAP-000 because no rulebook entry covers them.

create table public.launch_artboard_presets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (length(btrim(label)) between 1 and 60),
  -- The size in `unit`. A screen size is in pixels; a print size is in millimetres or inches.
  width numeric(12, 3) not null check (width > 0 and width <= 100000),
  height numeric(12, 3) not null check (height > 0 and height <= 100000),
  unit text not null check (unit in ('px', 'in', 'mm')),
  -- The dots per inch a physical size is read at. The spec's export panel offers 72 and 300.
  dpi integer not null default 72 check (dpi in (72, 300)),
  sort integer not null default 0,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  -- Says where the size came from. A seeded size says it was not reviewed by anyone.
  note text not null check (length(btrim(note)) between 1 and 200),
  updated_at timestamptz not null default now()
);

comment on table public.launch_artboard_presets is
  'Platform data: the artboard sizes the launch inspector offers. Read by signed-in members, written by the server only (decision 0091).';

-- ---------------------------------------------------------------------------------------------
-- The launch project.

create table public.launch_projects (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80 and name = btrim(name)),
  -- The person's own unit, from the Settings item of the main menu (spec: Inches / Pixels / Millimetres).
  units text not null default 'px' check (units in ('px', 'in', 'mm')),
  -- The project palette of the right inspector: [{ "hex": "#0b1f4b", "name": "Club navy" }].
  -- Checked by the app against its own schema before it is written.
  colours jsonb not null default '[]'::jsonb check (jsonb_typeof(colours) = 'array' and jsonb_array_length(colours) <= 48),
  -- The design this project is launching, when one is chosen. The Design board carries its own.
  -- A plain reference, not a composite one: "set null" on a composite key would try to null
  -- brand_id as well, which is not null. create_launch_project checks the brand instead.
  design_project_id uuid references public.projects (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (brand_id, name)
);

comment on table public.launch_projects is
  'One launch canvas of a brand: its name, its unit and its palette (spec Launch shell). Written by the server only.';

create index launch_projects_brand_idx on public.launch_projects (brand_id, updated_at desc, id);

-- ---------------------------------------------------------------------------------------------
-- The boards.

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  launch_project_id uuid not null,
  kind text not null check (kind in ('design', 'artboard', 'mockup', 'ai_image', 'ai_video', 'marketing', 'info_card')),
  name text not null default '' check (length(name) <= 80),
  -- Where the board sits on the infinite canvas, in whole pixels from the origin.
  x integer not null default 0 check (x between -1000000 and 1000000),
  y integer not null default 0 check (y between -1000000 and 1000000),
  -- The board's own size in whole pixels. The bounds match lib/launch/artboard.ts.
  width integer not null default 1080 check (width between 16 and 20000),
  height integer not null default 1080 check (height between 16 and 20000),
  -- The board's own prompt, model, aspect, style and scene, so Regenerate reruns it unchanged.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 65536),
  -- The design version this board's input was taken at, so a board says which kit it shows.
  input_version integer check (input_version >= 1),
  -- The file the last run produced. Null for a board that has not run. `files` carries no
  -- (id, brand_id) key, so the brand is checked by set_launch_board_output rather than by a
  -- composite foreign key, as the other tables that point at a file do.
  output_file_id uuid references public.files (id) on delete set null,
  -- What the output may be used as. See the constraint below: a generated board can only be 'asset'.
  output_role text not null default 'asset' check (output_role in ('asset', 'panel_layer', 'print_file')),
  status text not null default 'empty' check (status in ('empty', 'queued', 'running', 'ready', 'failed')),
  -- Credits the last run spent. Null for a board that has never run or never cost anything.
  last_cost_credits integer check (last_cost_credits between 0 and 1000000),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id),
  foreign key (launch_project_id, brand_id) references public.launch_projects (id, brand_id) on delete cascade,
  -- AI NEVER DRAWS THE GARMENT (spec decision 13). A board whose picture comes out of a model is
  -- scenery: its output can never be recorded as a layer on a panel or as part of a print file.
  -- The application says the same thing in its types (lib/launch/assets.ts); this is the floor
  -- under it, so no route, action or later workstream can get round it.
  constraint boards_generated_output_is_never_artwork check (
    output_role = 'asset' or kind in ('design', 'artboard', 'mockup', 'marketing', 'info_card')
  )
);

comment on table public.boards is
  'One board of a launch canvas: its kind, its place, its size, its own settings and its last output (spec F-L4). Written by the server only.';

comment on column public.boards.output_role is
  'What this board''s output may be used as. A generated board (ai_image, ai_video) can only ever be ''asset'': spec decision 13, enforced by boards_generated_output_is_never_artwork.';

create index boards_project_idx on public.boards (launch_project_id, created_at, id);
create index boards_output_idx on public.boards (output_file_id) where output_file_id is not null;

-- The connectors. One per (board, input number), so "image 1" is always the same picture.
create table public.board_edges (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  launch_project_id uuid not null,
  from_board_id uuid not null,
  to_board_id uuid not null,
  -- 1 for "image 1", 2 for "image 2", as the AI boards' prompts name them (spec F-L4).
  input_index integer not null check (input_index between 1 and 16),
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (to_board_id, input_index),
  unique (from_board_id, to_board_id),
  check (from_board_id <> to_board_id),
  foreign key (launch_project_id, brand_id) references public.launch_projects (id, brand_id) on delete cascade,
  foreign key (from_board_id, brand_id) references public.boards (id, brand_id) on delete cascade,
  foreign key (to_board_id, brand_id) references public.boards (id, brand_id) on delete cascade
);

comment on table public.board_edges is
  'A connector from one board''s right-edge dot into another board''s numbered input (spec F-L4). Written by the server only.';

create index board_edges_project_idx on public.board_edges (launch_project_id, to_board_id, input_index);
create index board_edges_from_idx on public.board_edges (from_board_id);

-- ---------------------------------------------------------------------------------------------
-- Version history.
--
-- The main menu's Save and Version history (spec Launch shell). A version is what the canvas held
-- when it was saved, and it is append-only: a record of what a person had is not something a later
-- save may rewrite.

create table public.launch_project_versions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  launch_project_id uuid not null,
  version integer not null check (version >= 1),
  -- The boards and connectors as they stood. Checked by the app against its own schema.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 1048576),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  unique (launch_project_id, version),
  foreign key (launch_project_id, brand_id) references public.launch_projects (id, brand_id) on delete cascade
);

comment on table public.launch_project_versions is
  'A saved version of a launch canvas, for the main menu''s Version history. Append-only. Written by save_launch_project_version only.';

create index launch_project_versions_project_idx on public.launch_project_versions (launch_project_id, version desc);

create function private.refuse_launch_version_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A project being removed takes its versions with it; nothing else may change one.
  if tg_op = 'DELETE' and not exists (select 1 from public.launch_projects p where p.id = old.launch_project_id) then
    return old;
  end if;
  raise exception 'A saved version of a launch project can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger launch_project_versions_append_only
  before update or delete on public.launch_project_versions
  for each row execute function private.refuse_launch_version_change();

create trigger launch_project_versions_no_truncate
  before truncate on public.launch_project_versions
  for each statement execute function private.refuse_launch_version_change();

-- ---------------------------------------------------------------------------------------------
-- Rights and row level security.

revoke all on function private.refuse_launch_version_change() from public, anon, authenticated;

revoke all on public.launch_projects, public.boards, public.board_edges,
  public.launch_project_versions from public, anon, authenticated, service_role;
-- The server's key holds SELECT only, as it does on the collection plans: every write goes through
-- a function below, so a direct update or delete answers "permission denied" before any trigger runs.
grant select on public.launch_projects, public.boards, public.board_edges,
  public.launch_project_versions to authenticated, service_role;

revoke all on public.launch_artboard_presets from public, anon, authenticated, service_role;
grant select on public.launch_artboard_presets to authenticated;
grant select, insert, update on public.launch_artboard_presets to service_role;

alter table public.launch_projects enable row level security;
alter table public.boards enable row level security;
alter table public.board_edges enable row level security;
alter table public.launch_project_versions enable row level security;
alter table public.launch_artboard_presets enable row level security;

create policy "members read their brand's launch projects"
  on public.launch_projects for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's boards"
  on public.boards for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's connectors"
  on public.board_edges for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's saved launch versions"
  on public.launch_project_versions for select to authenticated
  using (private.is_member(brand_id));

create policy "signed-in members read the artboard presets"
  on public.launch_artboard_presets for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------------------------
-- Writes. Every one checks can_manage_kit itself and is callable by service_role only.

create function public.create_launch_project(
  p_brand_id uuid, p_user_id uuid, p_name text, p_units text, p_design_project_id uuid
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
    raise exception 'You may not start a launch project for this brand.' using errcode = '42501';
  end if;
  if p_design_project_id is not null and not exists (
    select 1 from public.projects p where p.id = p_design_project_id and p.brand_id = p_brand_id
  ) then
    raise exception 'That design does not exist.' using errcode = 'P0002', hint = 'design_not_found';
  end if;
  insert into public.launch_projects (brand_id, name, units, design_project_id, created_by)
  values (p_brand_id, btrim(p_name), coalesce(p_units, 'px'), p_design_project_id, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.save_launch_project(
  p_brand_id uuid, p_user_id uuid, p_launch_project_id uuid, p_name text, p_units text, p_colours jsonb
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
    raise exception 'You may not change a launch project for this brand.' using errcode = '42501';
  end if;
  if p_colours is not null and jsonb_typeof(p_colours) <> 'array' then
    raise exception 'The project colours are a list.' using errcode = 'P0001', hint = 'colours_not_a_list';
  end if;
  update public.launch_projects
     set name = coalesce(btrim(p_name), name),
         units = coalesce(p_units, units),
         colours = coalesce(p_colours, colours),
         updated_at = now()
   where id = p_launch_project_id and brand_id = p_brand_id
  returning id into v_id;
  if v_id is null then
    raise exception 'That launch project does not exist.' using errcode = 'P0002', hint = 'launch_project_not_found';
  end if;
  return v_id;
end;
$$;

create function public.remove_launch_project(p_brand_id uuid, p_user_id uuid, p_launch_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not remove a launch project for this brand.' using errcode = '42501';
  end if;
  delete from public.launch_projects where id = p_launch_project_id and brand_id = p_brand_id;
end;
$$;

/*
 * Adds or changes one board. The kind is fixed when the board is made: a mockup board that became
 * an AI board would carry settings and an output that belong to something else, and the connectors
 * into it were allowed for the kind it was.
 */
create function public.save_launch_board(
  p_brand_id uuid, p_user_id uuid, p_launch_project_id uuid, p_board_id uuid, p_kind text,
  p_name text, p_x integer, p_y integer, p_width integer, p_height integer, p_settings jsonb,
  p_input_version integer
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
    raise exception 'You may not change a launch project for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.launch_projects p where p.id = p_launch_project_id and p.brand_id = p_brand_id) then
    raise exception 'That launch project does not exist.' using errcode = 'P0002', hint = 'launch_project_not_found';
  end if;
  if p_settings is not null and jsonb_typeof(p_settings) <> 'object' then
    raise exception 'A board''s settings are an object.' using errcode = 'P0001', hint = 'settings_not_an_object';
  end if;

  if p_board_id is null then
    insert into public.boards (brand_id, launch_project_id, kind, name, x, y, width, height, settings, input_version)
    values (
      p_brand_id, p_launch_project_id, p_kind, coalesce(btrim(p_name), ''), coalesce(p_x, 0), coalesce(p_y, 0),
      coalesce(p_width, 1080), coalesce(p_height, 1080), coalesce(p_settings, '{}'::jsonb), p_input_version
    )
    returning id into v_id;
    return v_id;
  end if;

  update public.boards
     set name = coalesce(btrim(p_name), name),
         x = coalesce(p_x, x),
         y = coalesce(p_y, y),
         width = coalesce(p_width, width),
         height = coalesce(p_height, height),
         settings = coalesce(p_settings, settings),
         input_version = coalesce(p_input_version, input_version),
         updated_at = now()
   where id = p_board_id and brand_id = p_brand_id and launch_project_id = p_launch_project_id
  returning id into v_id;
  if v_id is null then
    raise exception 'That board does not exist.' using errcode = 'P0002', hint = 'board_not_found';
  end if;
  return v_id;
end;
$$;

create function public.remove_launch_board(p_brand_id uuid, p_user_id uuid, p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change a launch project for this brand.' using errcode = '42501';
  end if;
  delete from public.boards where id = p_board_id and brand_id = p_brand_id;
end;
$$;

/*
 * Whether a Design board can be reached from a board by following its connectors backwards. This
 * is the garment lock: every picture of the garment comes from a design version the platform drew,
 * so a board with no Design board behind it has no garment and may not produce one.
 */
create function private.launch_board_has_design(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive upstream as (
    select b.id, b.kind
      from public.boards b
     where b.id = p_board_id
    union
    select b.id, b.kind
      from public.board_edges e
      join public.boards b on b.id = e.from_board_id
      join upstream u on u.id = e.to_board_id
  )
  select exists (select 1 from upstream where kind = 'design');
$$;

/*
 * Draws a connector. The pairs allowed are the spec's own board table (F-L4), written out here so
 * the database refuses a wiring the application would never ask for. A loop is refused as well: it
 * could never finish, and `launch_board_has_design` would not terminate on one.
 */
create function public.connect_launch_boards(
  p_brand_id uuid, p_user_id uuid, p_from_board_id uuid, p_to_board_id uuid, p_input_index integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.boards;
  v_to public.boards;
  v_id uuid;
  v_allowed boolean;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change a launch project for this brand.' using errcode = '42501';
  end if;
  select * into v_from from public.boards where id = p_from_board_id and brand_id = p_brand_id;
  select * into v_to from public.boards where id = p_to_board_id and brand_id = p_brand_id;
  if v_from.id is null or v_to.id is null then
    raise exception 'That board does not exist.' using errcode = 'P0002', hint = 'board_not_found';
  end if;
  if v_from.launch_project_id <> v_to.launch_project_id then
    raise exception 'Those boards are on different canvases.' using errcode = 'P0001', hint = 'different_canvas';
  end if;

  v_allowed := case v_to.kind
    when 'mockup' then v_from.kind = 'design'
    when 'ai_image' then v_from.kind in ('design', 'mockup', 'ai_image')
    when 'ai_video' then v_from.kind in ('mockup', 'ai_image')
    when 'marketing' then v_from.kind in ('design', 'mockup', 'ai_image', 'ai_video', 'info_card')
    when 'info_card' then v_from.kind = 'design'
    else false
  end;
  if not v_allowed then
    raise exception 'A % board cannot start from a % board.', v_to.kind, v_from.kind
      using errcode = 'P0001', hint = 'input_not_allowed';
  end if;

  -- A loop: the board being fed already reaches the board doing the feeding.
  if exists (
    with recursive downstream as (
      -- The cast is explicit so the non-recursive term settles the column's type as uuid.
      select p_to_board_id::uuid as id
      union
      select e.to_board_id from public.board_edges e join downstream d on d.id = e.from_board_id
    )
    select 1 from downstream where id = p_from_board_id
  ) then
    raise exception 'That would make a loop, and a loop could never finish.'
      using errcode = 'P0001', hint = 'loop';
  end if;

  insert into public.board_edges (brand_id, launch_project_id, from_board_id, to_board_id, input_index)
  values (p_brand_id, v_to.launch_project_id, p_from_board_id, p_to_board_id, coalesce(p_input_index, 1))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.disconnect_launch_boards(p_brand_id uuid, p_user_id uuid, p_edge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change a launch project for this brand.' using errcode = '42501';
  end if;
  delete from public.board_edges where id = p_edge_id and brand_id = p_brand_id;
end;
$$;

/*
 * Records what a run produced: the file, the status and what it cost. L2 to L6 call this and
 * nothing else, so the two rules below hold for every one of them.
 *
 *   * A board whose picture comes out of a model may not record an output unless a Design board is
 *     behind it. The garment in the picture is then the one the platform drew (spec decision 13).
 *   * The role is refused for a generated board by boards_generated_output_is_never_artwork; this
 *     function refuses it first, with words a person can read.
 */
create function public.set_launch_board_output(
  p_brand_id uuid, p_user_id uuid, p_board_id uuid, p_output_file_id uuid, p_output_role text,
  p_status text, p_last_cost_credits integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board public.boards;
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change a launch project for this brand.' using errcode = '42501';
  end if;
  select * into v_board from public.boards where id = p_board_id and brand_id = p_brand_id;
  if v_board.id is null then
    raise exception 'That board does not exist.' using errcode = 'P0002', hint = 'board_not_found';
  end if;
  if v_board.kind in ('ai_image', 'ai_video') then
    if coalesce(p_output_role, 'asset') <> 'asset' then
      raise exception 'A generated picture never becomes a layer on the garment or part of a print file.'
        using errcode = 'P0001', hint = 'generated_is_never_artwork';
    end if;
    if not private.launch_board_has_design(p_board_id) then
      raise exception 'Connect a Design board first: every picture starts from the design the platform drew.'
        using errcode = 'P0001', hint = 'garment_not_locked';
    end if;
  end if;
  if p_output_file_id is not null and not exists (
    select 1 from public.files f where f.id = p_output_file_id and f.brand_id = p_brand_id
  ) then
    raise exception 'That file does not exist.' using errcode = 'P0002', hint = 'file_not_found';
  end if;

  update public.boards
     set output_file_id = p_output_file_id,
         output_role = coalesce(p_output_role, 'asset'),
         status = coalesce(p_status, status),
         last_cost_credits = coalesce(p_last_cost_credits, last_cost_credits),
         updated_at = now()
   where id = p_board_id and brand_id = p_brand_id
  returning id into v_id;
  return v_id;
end;
$$;

/* The main menu's Save: the canvas as it stands, with the next version number. */
create function public.save_launch_project_version(
  p_brand_id uuid, p_user_id uuid, p_launch_project_id uuid, p_snapshot jsonb
)
returns table (id uuid, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_id uuid;
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not save a version for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.launch_projects p where p.id = p_launch_project_id and p.brand_id = p_brand_id) then
    raise exception 'That launch project does not exist.' using errcode = 'P0002', hint = 'launch_project_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('launch_project_versions:' || p_launch_project_id::text, 0));
  select coalesce(max(v.version), 0) + 1 into v_next
  from public.launch_project_versions v where v.launch_project_id = p_launch_project_id;

  insert into public.launch_project_versions (brand_id, launch_project_id, version, snapshot, created_by)
  values (p_brand_id, p_launch_project_id, v_next, p_snapshot, p_user_id)
  returning launch_project_versions.id into v_id;
  return query select v_id, v_next;
end;
$$;

revoke all on function public.create_launch_project(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.save_launch_project(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.remove_launch_project(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_launch_board(uuid, uuid, uuid, uuid, text, text, integer, integer, integer, integer, jsonb, integer) from public, anon, authenticated;
revoke all on function public.remove_launch_board(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.connect_launch_boards(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.disconnect_launch_boards(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_launch_board_output(uuid, uuid, uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.save_launch_project_version(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.launch_board_has_design(uuid) from public, anon, authenticated;

grant execute on function public.create_launch_project(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.save_launch_project(uuid, uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.remove_launch_project(uuid, uuid, uuid) to service_role;
grant execute on function public.save_launch_board(uuid, uuid, uuid, uuid, text, text, integer, integer, integer, integer, jsonb, integer) to service_role;
grant execute on function public.remove_launch_board(uuid, uuid, uuid) to service_role;
grant execute on function public.connect_launch_boards(uuid, uuid, uuid, uuid, integer) to service_role;
grant execute on function public.disconnect_launch_boards(uuid, uuid, uuid) to service_role;
grant execute on function public.set_launch_board_output(uuid, uuid, uuid, uuid, text, text, integer) to service_role;
grant execute on function public.save_launch_project_version(uuid, uuid, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Seeds.
--
-- The artboard sizes the spec's inspector and export panel name. Every one is a labelled default:
-- nobody has reviewed this list, and the inspector prints each row's note beside it. A4 is the ISO
-- 216 size in millimetres, read at 300 dots per inch for print; the rest are screen sizes in pixels.

insert into public.launch_artboard_presets (key, label, width, height, unit, dpi, sort, note) values
  ('social-post-4-5', 'Social post 4:5', 1080, 1350, 'px', 72, 10, 'Placeholder size, not reviewed by anyone'),
  ('social-square-1-1', 'Social square 1:1', 1080, 1080, 'px', 72, 20, 'Placeholder size, not reviewed by anyone'),
  ('story-9-16', 'Story 9:16', 1080, 1920, 'px', 72, 30, 'Placeholder size, not reviewed by anyone'),
  ('hero-banner-16-9', 'Hero banner 16:9', 1920, 1080, 'px', 72, 40, 'Placeholder size, not reviewed by anyone'),
  ('pin-2-3', 'Pin 2:3', 1000, 1500, 'px', 72, 50, 'Placeholder size, not reviewed by anyone'),
  ('a4-print', 'A4 print', 210, 297, 'mm', 300, 60, 'ISO 216 A4; the resolution is a placeholder, not reviewed by anyone');
