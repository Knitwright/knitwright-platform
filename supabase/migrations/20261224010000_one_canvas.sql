-- One infinite canvas (plans/platform-v6.md wave 3, E1; decision 0145).
--
-- Until now a studio design (`projects` + `spec_versions`) and a launch canvas (`launch_projects` +
-- `boards` + `board_edges`) were two things with two editors. From here every project opens at
-- `/project/<id>` on one canvas of boards, and the canvas IS a `launch_projects` row: the launch
-- tables already hold boards with places, sizes and connectors, row level security and server-only
-- writes, so nothing new is invented beside them (v5 owner decision 4: keep the model, add beside it).
--
-- THE MAPPING (decision 0145 writes it down in full):
--
--   * A studio project gets a canvas of its own -- its *home canvas* -- marked by
--     `launch_projects.studio_project_id`, holding one Garment board that references the project.
--     Every existing project is given one below, and a trigger gives every new project one as it is
--     made, so no studio project exists without a canvas to open on.
--   * A launch project is a canvas already and keeps every board and connector it has. Its Design
--     boards are garment boards under their launch-era name: each now also points at its studio
--     project through the typed column `boards.design_project_id`, filled from the board's own
--     `settings.designProjectId` or, failing that, the project's `design_project_id`.
--   * `/project/<id>` takes either id: a canvas id, or a studio project's id, which opens its home
--     canvas. The old addresses redirect there.
--
-- THE GARMENT IS STILL THE DESIGN OBJECT. A Garment board holds a reference, never a copy: its
-- picture is drawn from the project's current spec version, which is written and validated through
-- the editor's own path (`lib/validation`, the D1 order gate) and nowhere else. Nothing here writes
-- a spec version.
--
-- AI never draws the garment (spec decision 13): the three new kinds are deterministic, and every
-- rule that asked for a Design board behind a generated one now accepts a Garment board as well,
-- and nothing else.
--
-- No new table: the isolation test's lists are unchanged. Every write stays in a SECURITY DEFINER
-- function or trigger; the grants of 20261201010000 stand.

-- ---------------------------------------------------------------------------------------------
-- The home canvas of a studio project.

alter table public.launch_projects
  add column studio_project_id uuid unique,
  -- Composite, so a canvas can never be the home of another brand's design. Cascade: removing a
  -- design removes the canvas that was only ever its own.
  add constraint launch_projects_studio_project_fk
    foreign key (studio_project_id, brand_id) references public.projects (id, brand_id) on delete cascade;

comment on column public.launch_projects.studio_project_id is
  'The studio project this canvas is the home of, or null for a launch canvas. Set only by private.ensure_project_canvas (decision 0145).';

-- A launch canvas's name is unique in its brand, as before. A home canvas carries its design's name,
-- and two designs may share a name, so the rule is for launch canvases only.
alter table public.launch_projects drop constraint launch_projects_brand_id_name_key;
create unique index launch_projects_brand_name_idx on public.launch_projects (brand_id, name) where studio_project_id is null;

-- ---------------------------------------------------------------------------------------------
-- The board kinds: garment, tech_pack and order beside the launch kinds.

alter table public.boards drop constraint boards_kind_check;
alter table public.boards add constraint boards_kind_check
  check (kind in ('design', 'artboard', 'mockup', 'ai_image', 'ai_video', 'marketing', 'info_card', 'garment', 'tech_pack', 'order'));

alter table public.boards drop constraint boards_generated_output_is_never_artwork;
alter table public.boards add constraint boards_generated_output_is_never_artwork check (
  output_role = 'asset' or kind in ('design', 'artboard', 'mockup', 'marketing', 'info_card', 'garment', 'tech_pack', 'order')
);

alter table public.flow_run_boards drop constraint flow_run_boards_kind_check;
alter table public.flow_run_boards add constraint flow_run_boards_kind_check
  check (kind in ('design', 'artboard', 'mockup', 'ai_image', 'ai_video', 'marketing', 'info_card', 'garment', 'tech_pack', 'order'));

-- The studio project a garment board (or a launch-era design board) stands for. A plain reference
-- with "set null", as launch_projects.design_project_id has: a composite one would try to null the
-- brand as well. The trigger below holds it to the board's own brand.
alter table public.boards add column design_project_id uuid references public.projects (id) on delete set null;

comment on column public.boards.design_project_id is
  'The studio project a garment or design board shows, kept equal to settings.designProjectId by private.sync_garment_reference (decision 0145).';

create index boards_design_project_idx on public.boards (design_project_id) where design_project_id is not null;

/*
 * Keeps the typed reference and the settings the flow code reads in step, and holds a Garment board
 * to a design of its own brand. A launch-era Design board may still have no design chosen; a Garment
 * board may not, because a garment board with no garment is nothing.
 */
create function private.sync_garment_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_named text;
begin
  if new.kind not in ('design', 'garment') then
    new.design_project_id := null;
    return new;
  end if;
  v_named := new.settings ->> 'designProjectId';
  if v_named is null and new.design_project_id is not null then
    new.settings := jsonb_set(new.settings, '{designProjectId}', to_jsonb(new.design_project_id::text));
    v_named := new.design_project_id::text;
  end if;
  if v_named ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (select 1 from public.projects p where p.id = v_named::uuid and p.brand_id = new.brand_id) then
    new.design_project_id := v_named::uuid;
  else
    new.design_project_id := null;
  end if;
  if new.kind = 'garment' and new.design_project_id is null then
    raise exception 'A garment board shows one of your designs. Choose the design first.'
      using errcode = 'P0001', hint = 'garment_without_design';
  end if;
  return new;
end;
$$;

revoke all on function private.sync_garment_reference() from public, anon, authenticated;

create trigger boards_garment_reference
  before insert or update of kind, settings, design_project_id on public.boards
  for each row execute function private.sync_garment_reference();

-- ---------------------------------------------------------------------------------------------
-- The rules that asked for a Design board now take a Garment board as well.

create or replace function private.launch_board_has_design(p_board_id uuid)
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
  select exists (select 1 from upstream where kind in ('design', 'garment'));
$$;

/*
 * The connector table of 20261201010000 with the new kinds. The arms must say what
 * `lib/launch/boards.ts` says; `lib/launch/migration.test.ts` reads both.
 */
create or replace function public.connect_launch_boards(
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
    when 'mockup' then v_from.kind in ('design', 'garment')
    when 'ai_image' then v_from.kind in ('design', 'garment', 'mockup', 'ai_image')
    when 'ai_video' then v_from.kind in ('mockup', 'ai_image')
    when 'marketing' then v_from.kind in ('design', 'garment', 'mockup', 'ai_image', 'ai_video', 'info_card')
    when 'info_card' then v_from.kind in ('design', 'garment')
    when 'tech_pack' then v_from.kind = 'garment'
    when 'order' then v_from.kind = 'garment'
    else false
  end;
  if not v_allowed then
    raise exception 'A % board cannot start from a % board.', v_to.kind, v_from.kind
      using errcode = 'P0001', hint = 'input_not_allowed';
  end if;

  if exists (
    with recursive downstream as (
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

create or replace function private.refuse_unlocked_shoot_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_design text;
begin
  select kind into v_kind from public.boards
   where id = new.board_id and brand_id = new.brand_id and launch_project_id = new.launch_project_id;
  if v_kind is null then
    raise exception 'That board does not exist.' using errcode = 'P0002', hint = 'board_not_found';
  end if;
  if v_kind <> 'ai_image' then
    raise exception 'A shoot fills an AI image board, not a % board.', v_kind
      using errcode = 'P0001', hint = 'board_is_not_an_ai_image_board';
  end if;
  select kind into v_design from public.boards
   where id = new.design_board_id and brand_id = new.brand_id and launch_project_id = new.launch_project_id;
  if v_design is null or v_design not in ('design', 'garment') then
    raise exception 'A shoot keeps the garment the platform drew, so it starts from a Design board.'
      using errcode = 'P0001', hint = 'garment_not_locked';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Every studio project has a canvas.

/*
 * The home canvas of a studio project: found, or made with one Garment board at the origin. Called
 * by the triggers below and once for every existing project, never by the app, so it checks no role
 * of its own -- the project's own creation already did.
 */
create function private.ensure_project_canvas(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_canvas uuid;
begin
  select l.id into v_canvas from public.launch_projects l where l.studio_project_id = p_project_id;
  if v_canvas is not null then
    return v_canvas;
  end if;
  select * into v_project from public.projects p where p.id = p_project_id;
  if v_project.id is null then
    return null;
  end if;
  insert into public.launch_projects (brand_id, name, units, studio_project_id, design_project_id, created_by, created_at, updated_at)
  values (v_project.brand_id, v_project.name, 'px', v_project.id, v_project.id, v_project.created_by, v_project.created_at, v_project.updated_at)
  returning id into v_canvas;
  -- The board's box on the canvas, in world units (lib/canvas/boards.ts GARMENT_BOX).
  insert into public.boards (brand_id, launch_project_id, kind, name, x, y, width, height, settings, input_version)
  values (
    v_project.brand_id, v_canvas, 'garment', v_project.name, 0, 0, 320, 380,
    jsonb_build_object('designProjectId', v_project.id::text), v_project.current_version
  );
  return v_canvas;
end;
$$;

revoke all on function private.ensure_project_canvas(uuid) from public, anon, authenticated;

create function private.give_project_a_canvas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_project_canvas(new.id);
  return new;
end;
$$;

revoke all on function private.give_project_a_canvas() from public, anon, authenticated;

create trigger projects_have_a_canvas
  after insert on public.projects
  for each row execute function private.give_project_a_canvas();

-- A home canvas is called what its design is called.
create function private.name_home_canvas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.launch_projects set name = new.name, updated_at = now()
   where studio_project_id = new.id and name is distinct from new.name;
  return new;
end;
$$;

revoke all on function private.name_home_canvas() from public, anon, authenticated;

create trigger projects_name_their_canvas
  after update of name on public.projects
  for each row execute function private.name_home_canvas();

/*
 * A design's home canvas goes with the design and only with it: removing the canvas on its own
 * would leave a design with nowhere to open. Unchanged from 20261201010000 but for that refusal.
 */
create or replace function public.remove_launch_project(p_brand_id uuid, p_user_id uuid, p_launch_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not remove a launch project for this brand.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.launch_projects l
     where l.id = p_launch_project_id and l.brand_id = p_brand_id and l.studio_project_id is not null
  ) then
    raise exception 'This canvas is a design''s own. Remove the design and its canvas goes with it.'
      using errcode = 'P0001', hint = 'home_canvas';
  end if;
  delete from public.launch_projects where id = p_launch_project_id and brand_id = p_brand_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The existing rows. Nothing is removed and no board moves.

-- Launch-era Design boards point at their design: their own settings first, else the canvas's.
update public.boards b
   set design_project_id = l.design_project_id
  from public.launch_projects l
 where b.kind = 'design'
   and l.id = b.launch_project_id
   and l.design_project_id is not null
   and (b.settings ->> 'designProjectId') is null;

update public.boards set settings = settings where kind = 'design' and (settings ->> 'designProjectId') is not null;

-- Every studio project there is gets its home canvas.
select private.ensure_project_canvas(p.id) from public.projects p order by p.created_at, p.id;
