-- H1 of the v5 security review (docs/reviews/security-v5.md, decision 0116): the garment lock's
-- provenance was taken from the request body, and `public.files` held nothing that could answer
-- instead.
--
-- The lock asks three questions. Two were already answered server-side and are airtight: *is this
-- board a kind a model draws?* comes from `boards.kind`, immutable after insert; *is there a
-- generated board upstream?* comes from a recursive walk of `board_edges`. The third -- *did this
-- file come out of a model?* -- was `asset.provenance`, a `z.enum` in the request body, and
-- `public.files` classified by `kind` alone, where a deterministic mockup and an AI lifestyle image
-- are both `'render'`. So a member with `manageKit` could add a design board and a mockup board,
-- connect them, and record a generated file as a print file: all six enforcement points agreed,
-- because every one tested the board or the graph and none tested the file.
--
-- This migration gives the file its own answer and puts it under three doors:
--
--   * `public.set_launch_board_output` reads the file's provenance and refuses a generated file any
--     role but 'asset', and refuses it on a board the platform draws at all;
--   * `public.save_launch_board` refuses a marketing board whose settings name a generated file as
--     a picture, which is the lock L4 describes as shut "in three places" and ran only in the
--     browser;
--   * `public.add_golden_sample_photo` takes a photograph and not any file of the brand, so a
--     generated render can no longer be recorded as the photo of a signed-off sample.
--
-- The application says the same things first, in `lib/launch`, `lib/marketing` and
-- `lib/storage/provenance.ts`. This is the floor under them, so no route, action or later
-- workstream can get round it.

-- ---------------------------------------------------------------------------------------------
-- The column.
--
-- The default is the restrictive value: a store site that writes a row without saying loses the
-- right to use the file as artwork rather than gaining it. `files_within_quota` is a before-insert
-- trigger on this table, so the column is added with a default and only then made not null -- a
-- not-null column with no default would be checked after the trigger had already run.

alter table public.files
  add column provenance text not null default 'generated'
    check (provenance in ('deterministic', 'uploaded', 'generated'));

comment on column public.files.provenance is
  'What made this file: ''deterministic'' our own code from the design, ''uploaded'' a person, ''generated'' a model. Written by the server at the moment the file is stored and read by the garment lock; never sent by a client (security review v5 H1, decision 0116).';

-- ---------------------------------------------------------------------------------------------
-- The backfill.
--
-- Every row that exists was written before this column did, so each has to be judged by its kind.
-- Exactly one kind was ever written by a model-backed path: `'render'`, by `lib/images/service.ts`
-- (the photoreal image model) and by `lib/media/service.ts` (which serves the deterministic studio
-- renders *and* the AI lifestyle pictures through one call). A render therefore cannot be told
-- apart after the fact, and takes the restrictive value, which the column default has already
-- given it.
--
-- Every other kind has only ever been written by a path with no model in it at all, and each is
-- named here rather than swept up by an `else`, so a kind a later release adds keeps the strict
-- default until somebody decides what it is:
--
--   * uploaded -- 'artwork', 'sketch', 'photo' (the one upload route), 'chart' (a size chart),
--     'proof' (a photograph of a strike-off), 'artwork-print' and 'artwork-vector' (copies our own
--     code derives from an uploaded artwork, whose picture is still the person's);
--   * deterministic -- 'pattern' and 'pattern-source' (DXF the drafter wrote), 'print' and
--     'roster' (files the server builds), 'export'.

update public.files set provenance = 'uploaded'
 where kind in ('artwork', 'sketch', 'photo', 'chart', 'proof', 'artwork-print', 'artwork-vector');

update public.files set provenance = 'deterministic'
 where kind in ('pattern', 'pattern-source', 'print', 'roster', 'export');

-- ---------------------------------------------------------------------------------------------
-- A generated file is never a golden sample's photograph.
--
-- `add_golden_sample_photo` checked only that the file belonged to the brand, and 'golden_sample'
-- is one of the two provenances an asset may claim that may be artwork or a print file -- so a
-- generated render could be recorded as the photograph of a signed-off sample with no AI board and
-- no topology at all. A golden sample is a real garment somebody held, so its photograph is a
-- photograph: `kind = 'photo'`, and nothing a model made.

create or replace function public.add_golden_sample_photo(
  p_brand_id uuid, p_user_id uuid, p_golden_sample_id uuid, p_file_id uuid, p_angle text, p_caption text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sample public.golden_samples := private.golden_sample_open(p_brand_id, p_user_id, p_golden_sample_id);
  v_file public.files;
  v_id uuid;
begin
  select * into v_file from public.files f where f.id = p_file_id and f.brand_id = p_brand_id;
  if v_file.id is null then
    raise exception 'That picture does not exist.' using errcode = 'P0002', hint = 'file_not_found';
  end if;
  if v_file.kind <> 'photo' then
    raise exception 'A golden sample is photographed, so its pictures are photographs you took of the sample itself.'
      using errcode = 'P0001', hint = 'golden_sample_photo_not_a_photograph';
  end if;
  if v_file.provenance = 'generated' then
    raise exception 'A golden sample is a garment somebody held, so nothing a model made can be its photograph.'
      using errcode = 'P0001', hint = 'golden_sample_photo_was_generated';
  end if;
  if (select count(*) from public.golden_sample_photos p where p.golden_sample_id = v_sample.id)
     >= (select photos from private.golden_sample_limits()) then
    raise exception 'This golden sample holds as many photos as it may.' using errcode = 'P0001', hint = 'too_many_photos';
  end if;
  insert into public.golden_sample_photos (brand_id, golden_sample_id, file_id, angle, caption, created_by)
  values (p_brand_id, v_sample.id, p_file_id, p_angle, coalesce(btrim(p_caption), ''), p_user_id)
  returning id into v_id;
  update public.golden_samples set updated_at = now() where id = v_sample.id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The board's output: the role is judged against the file's own provenance, not the caller's word.
--
-- Unchanged from 20261201010000 except for the block marked below. The two rules that were already
-- here still hold first, so their wording is what a person sees when they apply.

create or replace function public.set_launch_board_output(
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
  v_file public.files;
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
  if p_output_file_id is not null then
    select * into v_file from public.files f where f.id = p_output_file_id and f.brand_id = p_brand_id;
    if v_file.id is null then
      raise exception 'That file does not exist.' using errcode = 'P0002', hint = 'file_not_found';
    end if;
    -- NEW (security review v5 H1). The file says what made it, so the role is judged against that
    -- and not against the board alone. Both of these were previously unreachable from the
    -- database's point of view: every gate tested the board or the graph, and none tested the file.
    if v_file.provenance = 'generated' then
      if coalesce(p_output_role, 'asset') <> 'asset' then
        raise exception 'A generated picture never becomes a layer on the garment or part of a print file.'
          using errcode = 'P0001', hint = 'generated_is_never_artwork';
      end if;
      if v_board.kind not in ('ai_image', 'ai_video') then
        raise exception 'This picture came out of a model, so it belongs on an AI board rather than on one the platform draws.'
          using errcode = 'P0001', hint = 'generated_file_on_a_drawn_board';
      end if;
    end if;
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

-- ---------------------------------------------------------------------------------------------
-- The marketing lock, on the server.
--
-- A marketing board is a board the platform draws itself, so its output may be a print file, which
-- makes `lib/marketing/assets.ts` "the place where a generated picture would reach artwork if
-- anything could". It is shut in the type system, at `fillSlot` and in the words -- and all three
-- ran only in the browser: the chosen file id is persisted as plain settings jsonb, which
-- `save_launch_board` validated with nothing but `jsonb_typeof(p_settings) <> 'object'`.
--
-- So the fourth door is here. A marketing board's `pictures` map is slot id to file id; every file
-- it names must be one of this brand's and must not have come out of a model. Unchanged from
-- 20261201010000 except for the block marked below.

create or replace function public.save_launch_board(
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
  v_kind text;
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

  -- NEW (security review v5 H1). The kind of the board these settings are for: the one given when
  -- the board is made, or the stored one when it is changed -- `kind` is immutable, so the stored
  -- one is the one it was made with.
  v_kind := p_kind;
  if p_board_id is not null then
    select b.kind into v_kind from public.boards b where b.id = p_board_id and b.brand_id = p_brand_id;
  end if;
  if v_kind = 'marketing' and p_settings is not null and jsonb_typeof(p_settings -> 'pictures') = 'object' then
    -- Each check is its own statement, in this order, so the casts below are safe: by the time one
    -- runs, the statement before it has refused anything that is not the id of one of this brand's
    -- files. There is no `::uuid` of unchecked text anywhere here.
    if exists (
      select 1 from jsonb_each_text(p_settings -> 'pictures') as named(slot, file_id)
       where named.file_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) then
      raise exception 'A picture in a layout is named by the id of one of your files.'
        using errcode = 'P0001', hint = 'marketing_picture_not_a_file';
    end if;
    if exists (
      select 1 from jsonb_each_text(p_settings -> 'pictures') as named(slot, file_id)
       where not exists (select 1 from public.files f where f.id = named.file_id::uuid and f.brand_id = p_brand_id)
    ) then
      raise exception 'A picture in a layout is named by the id of one of your files.'
        using errcode = 'P0001', hint = 'marketing_picture_not_a_file';
    end if;
    if exists (
      select 1 from jsonb_each_text(p_settings -> 'pictures') as named(slot, file_id)
       where exists (
         select 1 from public.files f
          where f.id = named.file_id::uuid and f.brand_id = p_brand_id and f.provenance = 'generated'
       )
    ) then
      raise exception 'A generated picture is scenery. It never becomes the picture in a layout or part of a print file.'
        using errcode = 'P0001', hint = 'generated_is_never_artwork';
    end if;
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
