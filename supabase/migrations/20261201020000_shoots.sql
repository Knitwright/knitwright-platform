-- AI scenes and shoots with the garment locked (plans/platform-v5.md wave 4, L3; spec F-L1's AI
-- part and docs/spec/07-template-library.md; decision 0093).
--
-- L1's migration (20261201010000) holds the canvas and L2's (20261201070000) seeded the 40 mockup
-- scenes, 20 of which are photographic and marked for this workstream. This file adds only what
-- running one of those 20 needs:
--
--   1. `shoot_concepts`: the twelve shoot ideas of F-L1's "Shoot ideas library", each one a bundle
--      of the `templates` rows of kind `mockup_scene` that L2 seeded. A concept holds no scene of
--      its own, so the library has one list of scenes and not two.
--   2. `shoot_poses`: F-L1's five poses by name, and every pose and camera the 20 scenes already
--      name in their own slots. `kind` tells a pose from a camera; `source` says which list a row
--      came from, so nothing here can be mistaken for something somebody invented.
--   3. `model_presets`, **with the licence reference each one needs**. A row with no reference
--      cannot be used: a person's likeness is not something to assume. No row names a person and no
--      row holds a photograph -- there is no column for one to arrive in.
--   4. `shoot_jobs`: what one press of Generate did -- the scene, the model and the consent behind
--      it, how many attempts it took, what the picture checker said, what was charged and what was
--      given back. The panel reads it, so a result survives a reload.
--
-- THE GARMENT IS ALWAYS LOCKED, and this file is the fourth place that is true rather than hoped
-- for. `design_board_id` is NOT NULL, so a job names the Design board its garment came from, and
-- `start_shoot_job` refuses a board `private.launch_board_has_design` (L1) cannot reach a Design
-- board from. L1 refuses a generated asset as artwork in three places and L6 added three triggers
-- for a four-hop chain; nothing here is a way round any of them, because a shoot's output is
-- written through L1's own `set_launch_board_output` and not by any function below.
--
-- A FAILED SHOOT REFUNDS ITS CREDITS. The refund itself is L6's `public.credit_refund_spend`
-- (20261201030000), which gives back one spend once; this file adds no second way to move money,
-- and `shoot_jobs_refund_only_on_a_failure` refuses a row that claims a refund on a shoot that
-- worked.
--
-- Every brand table is brand-scoped with row level security on. The server's own key holds SELECT
-- only on `shoot_jobs`: every write goes through a SECURITY DEFINER function below that checks
-- `can_manage_kit` itself, as the launch canvas and the flow runs do. The three library tables are
-- platform data: every signed-in member reads them and the server seeds them from
-- `apps/web/lib/shoots/**`, which `apps/web/lib/shoots/migration.test.ts` holds this file to.
--
-- No number in this file is a price. What a shoot costs is read from `credit_prices`, which a
-- platform admin sets, and every job records what it really spent.

-- ---------------------------------------------------------------------------------------------
-- The library: the ideas, the presets and the people.

create table public.shoot_poses (
  key text primary key check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(key) <= 64),
  -- A pose moves the person, a camera moves the lens. Both are offered in their own picker.
  kind text not null check (kind in ('pose', 'camera')),
  label text not null check (length(btrim(label)) between 1 and 120),
  -- The words that go into the prompt. They never mention the garment.
  prompt text not null check (length(btrim(prompt)) between 1 and 300),
  -- True when the pose means nothing without somebody in the picture.
  needs_person boolean not null default false,
  -- 'spec': one of the five F-L1 names. 'scene': words a seeded mockup scene already uses.
  source text not null check (source in ('spec', 'scene')),
  note text not null check (length(btrim(note)) between 1 and 300),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A camera is pointed at whatever is there, so it never requires a person of its own.
  constraint shoot_poses_only_a_pose_needs_a_person check (kind = 'pose' or needs_person = false)
);

comment on table public.shoot_poses is
  'The pose and camera presets of F-L1, and the ones the seeded mockup scenes already name. Platform data: every signed-in member reads it, the server seeds it from apps/web/lib/shoots/poses.ts. Not reviewed by anyone.';

create index shoot_poses_kind_idx on public.shoot_poses (kind, sort, key);

create table public.model_presets (
  key text primary key check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(key) <= 64),
  -- A description of a range of people, never the name of one.
  label text not null check (length(btrim(label)) between 1 and 160),
  body_type text not null check (length(btrim(body_type)) between 1 and 60),
  age_band text not null check (length(btrim(age_band)) between 1 and 60),
  skin_tone text not null check (length(btrim(skin_tone)) between 1 and 60),
  -- THE LICENCE THAT ALLOWS THIS LIKENESS TO BE GENERATED. Null until somebody has one on file,
  -- and a preset with null here cannot be run: the panel says so and the run is refused.
  licence_ref text check (licence_ref is null or length(btrim(licence_ref)) between 1 and 200),
  licence_holder text check (licence_holder is null or length(btrim(licence_holder)) between 1 and 200),
  note text not null check (length(btrim(note)) between 1 and 400),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Somebody holding a licence is no use without the reference to it.
  constraint model_presets_a_holder_needs_a_reference check (licence_holder is null or licence_ref is not null)
);

comment on table public.model_presets is
  'The AI model presets of F-L1, each with the licence reference that allows its likeness to be generated. No row names a person and no row holds a photograph. A preset with no licence reference cannot be used. Not reviewed by anyone.';

create table public.shoot_concepts (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  title text not null check (length(btrim(title)) between 1 and 120),
  lead text not null check (length(btrim(lead)) between 1 and 300),
  -- The `templates.slug` of each mockup scene this idea shoots. 07 gives a scene 1 to 11 garment
  -- slots and an idea may bundle several scenes, so this is an array rather than one reference.
  scene_slugs text[] not null check (cardinality(scene_slugs) between 1 and 11),
  lighting text not null check (length(btrim(lighting)) between 1 and 200),
  -- Held to rows of `shoot_poses` by the trigger below, which a check constraint cannot do.
  pose_keys text[] not null check (cardinality(pose_keys) between 1 and 6),
  camera_keys text[] not null check (cardinality(camera_keys) between 1 and 6),
  -- Held to rows of `model_presets` by the same trigger. Empty for an idea with nobody in it.
  model_preset_keys text[] not null default '{}',
  style text not null check (style in ('editorial', 'matchday-flash', 'gritty-training', 'clean-ecom', 'retro-film')),
  -- 07's "output set": how many pictures, in which shapes. F-L1 allows 1 to 4 in one run.
  outputs_count integer not null check (outputs_count between 1 and 4),
  aspects text[] not null check (cardinality(aspects) between 1 and 5),
  needs_model boolean not null default false,
  sport_tags text[] not null default '{}',
  mood_tags text[] not null default '{}',
  note text not null check (length(btrim(note)) between 1 and 500),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An idea with nobody in the picture offers no model presets, and one with a person offers some.
  constraint shoot_concepts_presets_match_the_people check ((needs_model = false) = (cardinality(model_preset_keys) = 0))
);

comment on table public.shoot_concepts is
  'The twelve shoot ideas of F-L1, each a bundle of the mockup scenes 07 marks as AI-generated. Platform data: every signed-in member reads it, the server seeds it from apps/web/lib/shoots/concepts.ts. Not reviewed by anyone.';

create index shoot_concepts_sort_idx on public.shoot_concepts (sort, slug);

/*
 * A concept's poses, cameras and model presets have to be rows that exist. Written as a trigger
 * because a check constraint cannot look at another table, and refused with words a reader can act
 * on rather than a foreign-key code.
 */
create function private.refuse_unknown_shoot_preset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  foreach v_key in array new.pose_keys loop
    if not exists (select 1 from public.shoot_poses p where p.key = v_key and p.kind = 'pose') then
      raise exception 'The shoot idea % names a pose that is not a row: %', new.slug, v_key
        using errcode = 'P0001', hint = 'pose_not_found';
    end if;
  end loop;
  foreach v_key in array new.camera_keys loop
    if not exists (select 1 from public.shoot_poses p where p.key = v_key and p.kind = 'camera') then
      raise exception 'The shoot idea % names a camera that is not a row: %', new.slug, v_key
        using errcode = 'P0001', hint = 'camera_not_found';
    end if;
  end loop;
  foreach v_key in array new.model_preset_keys loop
    if not exists (select 1 from public.model_presets m where m.key = v_key) then
      raise exception 'The shoot idea % names a model preset that is not a row: %', new.slug, v_key
        using errcode = 'P0001', hint = 'model_preset_not_found';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.refuse_unknown_shoot_preset() from public, anon, authenticated;

create trigger shoot_concepts_presets_are_known
  before insert or update on public.shoot_concepts
  for each row
  execute function private.refuse_unknown_shoot_preset();

-- ---------------------------------------------------------------------------------------------
-- What one press of Generate did.

create table public.shoot_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  launch_project_id uuid not null references public.launch_projects (id) on delete cascade,
  -- The AI image board this shoot fills. Held to kind 'ai_image' by the function that writes it.
  board_id uuid not null references public.boards (id) on delete cascade,
  -- THE GARMENT LOCK: the Design board the garment in this picture came from. Never null.
  design_board_id uuid not null references public.boards (id) on delete cascade,
  -- The design version the garment was taken at, so a result can be read as out of date later.
  input_version integer check (input_version is null or input_version between 1 and 1000000),
  concept_slug text references public.shoot_concepts (slug) on delete set null,
  -- The `templates.slug` of the mockup scene being shot. Text, because a scene is a template row.
  scene_slug text not null check (length(btrim(scene_slug)) between 1 and 64),
  style text not null check (style in ('editorial', 'matchday-flash', 'gritty-training', 'clean-ecom', 'retro-film')),
  aspect text not null check (aspect in ('match', '1:1', '4:5', '9:16', '16:9')),
  image_count integer not null default 1 check (image_count between 1 and 4),
  pose_key text references public.shoot_poses (key) on delete set null,
  camera_key text references public.shoot_poses (key) on delete set null,
  model_source text not null default 'none' check (model_source in ('none', 'preset', 'upload')),
  model_preset_key text references public.model_presets (key) on delete set null,
  -- The brand's own model, and the consent they recorded for it.
  model_file_id uuid references public.files (id) on delete set null,
  consent_ref text check (consent_ref is null or length(btrim(consent_ref)) between 1 and 200),
  consent_statement text check (consent_statement is null or length(btrim(consent_statement)) between 1 and 500),
  consent_given_at timestamptz,
  status text not null default 'queued' check (status in ('queued', 'running', 'ready', 'failed', 'refused')),
  -- 1, or 2 when the picture checker turned the first one away (F-L1's one automatic retry).
  attempts integer not null default 0 check (attempts between 0 and 2),
  checker_verdict text check (checker_verdict is null or checker_verdict in ('kept', 'turned_away')),
  -- The checks that produced a finding, so a person can be told which one, and a retry can aim.
  checker_failed text[] not null default '{}',
  moderation text check (moderation is null or moderation in ('clear', 'flagged', 'blocked')),
  -- What was really charged and what came back. Never the estimate.
  credits integer not null default 0 check (credits between 0 and 1000000),
  refunded_credits integer not null default 0 check (refunded_credits between 0 and 1000000),
  -- The credit_ledger line this shoot was charged on, which a refund gives back.
  spend_entry_id uuid references public.credit_ledger (id) on delete set null,
  output_file_id uuid references public.files (id) on delete set null,
  -- The sentence the person was shown, kept so the board can say it again after a reload.
  message text check (message is null or length(btrim(message)) between 1 and 500),
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  -- A job that has finished says when. One that has not has no time on it.
  constraint shoot_jobs_finished_says_when check ((status in ('ready', 'failed', 'refused')) = (finished_at is not null)),
  -- A PERSON'S LIKENESS NEEDS CONSENT: an upload carries all three parts of the record or the row
  -- is refused, and a job that is not an upload carries none of them.
  constraint shoot_jobs_an_upload_records_its_consent check (
    (model_source = 'upload') = (consent_ref is not null and consent_statement is not null and consent_given_at is not null)
  ),
  constraint shoot_jobs_an_upload_has_a_picture check ((model_source = 'upload') = (model_file_id is not null)),
  constraint shoot_jobs_a_preset_job_names_its_preset check ((model_source = 'preset') = (model_preset_key is not null)),
  -- A picture is kept only when the checker kept it, and a kept picture has a file.
  constraint shoot_jobs_ready_was_kept check (status <> 'ready' or checker_verdict = 'kept'),
  constraint shoot_jobs_only_a_ready_job_has_a_picture check (output_file_id is null or status = 'ready'),
  -- Money comes back only on a shoot that failed, and only what was charged.
  constraint shoot_jobs_refund_only_on_a_failure check (refunded_credits = 0 or status in ('failed', 'refused')),
  constraint shoot_jobs_refund_is_never_more_than_the_charge check (refunded_credits <= credits)
);

comment on table public.shoot_jobs is
  'One press of Generate on an AI image board: the scene, the model and the consent behind it, what the picture checker said, and what was charged and given back. Brand-scoped; written by the shoot functions only.';

create index shoot_jobs_board_idx on public.shoot_jobs (board_id, created_at desc, id);
create index shoot_jobs_brand_idx on public.shoot_jobs (brand_id, created_at desc, id);
create index shoot_jobs_project_idx on public.shoot_jobs (launch_project_id, created_at desc, id);

/*
 * A shoot job's two boards have to be the boards they claim to be: the one being filled is an AI
 * image board of this brand and canvas, and the one behind it is a Design board. The function that
 * starts a job checks the same things with words a person reads; this trigger is what holds for a
 * row written any other way.
 */
create function private.refuse_unlocked_shoot_job()
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
  if v_design is distinct from 'design' then
    raise exception 'A shoot keeps the garment the platform drew, so it starts from a Design board.'
      using errcode = 'P0001', hint = 'garment_not_locked';
  end if;
  return new;
end;
$$;

revoke all on function private.refuse_unlocked_shoot_job() from public, anon, authenticated;

create trigger shoot_jobs_the_garment_is_locked
  before insert or update on public.shoot_jobs
  for each row
  execute function private.refuse_unlocked_shoot_job();

-- ---------------------------------------------------------------------------------------------
-- Who may reach what.

revoke all on public.shoot_jobs from public, anon, authenticated, service_role;
-- SELECT only for the server's key as well: every write goes through a function below, so a direct
-- update or delete answers "permission denied" before any trigger runs.
grant select on public.shoot_jobs to authenticated, service_role;

revoke all on public.shoot_concepts, public.shoot_poses, public.model_presets
  from public, anon, authenticated, service_role;
grant select on public.shoot_concepts, public.shoot_poses, public.model_presets to authenticated;
grant select, insert, update on public.shoot_concepts, public.shoot_poses, public.model_presets to service_role;

alter table public.shoot_jobs enable row level security;
alter table public.shoot_concepts enable row level security;
alter table public.shoot_poses enable row level security;
alter table public.model_presets enable row level security;

create policy "members read their brand's shoot jobs"
  on public.shoot_jobs for select to authenticated
  using (private.is_member(brand_id));

create policy "signed-in members read the shoot ideas"
  on public.shoot_concepts for select to authenticated
  using (true);

create policy "signed-in members read the pose and camera presets"
  on public.shoot_poses for select to authenticated
  using (true);

create policy "signed-in members read the model presets"
  on public.model_presets for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------------------------
-- Writes. Every one checks can_manage_kit itself and is callable by service_role only.

/*
 * Starts a shoot and records what it was asked for, before anything is spent.
 *
 * The garment lock is checked here as well as by the trigger, because a person deserves the
 * sentence rather than a constraint name: `private.launch_board_has_design` (L1) is the same
 * function `set_launch_board_output` uses, so there is one answer to "whose garment is this?".
 */
create function public.start_shoot_job(
  p_brand_id uuid, p_user_id uuid, p_launch_project_id uuid, p_board_id uuid, p_design_board_id uuid,
  p_scene_slug text, p_style text, p_aspect text, p_image_count integer, p_pose_key text, p_camera_key text,
  p_model_source text, p_model_preset_key text, p_model_file_id uuid, p_consent_ref text,
  p_consent_statement text, p_consent_given_at timestamptz, p_concept_slug text, p_input_version integer
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
    raise exception 'You may not run a shoot for this brand.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.launch_projects p where p.id = p_launch_project_id and p.brand_id = p_brand_id
  ) then
    raise exception 'That launch project does not exist.' using errcode = 'P0002', hint = 'launch_project_not_found';
  end if;
  if not private.launch_board_has_design(p_board_id) then
    raise exception 'Connect a Design board first: every picture starts from the design the platform drew.'
      using errcode = 'P0001', hint = 'garment_not_locked';
  end if;
  -- A preset may be run only once somebody has put a licence reference against it.
  if p_model_source = 'preset' and not exists (
    select 1 from public.model_presets m where m.key = p_model_preset_key and m.licence_ref is not null
  ) then
    raise exception 'No licence on file for this likeness, so it cannot be generated.'
      using errcode = 'P0001', hint = 'model_preset_has_no_licence';
  end if;

  insert into public.shoot_jobs (
    brand_id, launch_project_id, board_id, design_board_id, input_version, concept_slug, scene_slug,
    style, aspect, image_count, pose_key, camera_key, model_source, model_preset_key, model_file_id,
    consent_ref, consent_statement, consent_given_at, status, created_by
  )
  values (
    p_brand_id, p_launch_project_id, p_board_id, p_design_board_id, p_input_version, p_concept_slug, p_scene_slug,
    p_style, p_aspect, coalesce(p_image_count, 1), p_pose_key, p_camera_key, coalesce(p_model_source, 'none'),
    p_model_preset_key, p_model_file_id, p_consent_ref, p_consent_statement, p_consent_given_at, 'running', p_user_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

/*
 * Records what a shoot ended as: how many attempts it took, what the picture checker said, what the
 * review said, what was charged and what came back. The constraints above are what hold the answer
 * honest; this function only writes it.
 */
create function public.finish_shoot_job(
  p_brand_id uuid, p_user_id uuid, p_job_id uuid, p_status text, p_attempts integer,
  p_checker_verdict text, p_checker_failed text[], p_moderation text, p_credits integer,
  p_refunded_credits integer, p_spend_entry_id uuid, p_output_file_id uuid, p_message text
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
    raise exception 'You may not run a shoot for this brand.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shoot_jobs j where j.id = p_job_id and j.brand_id = p_brand_id) then
    raise exception 'That shoot does not exist.' using errcode = 'P0002', hint = 'shoot_job_not_found';
  end if;
  if p_output_file_id is not null and not exists (
    select 1 from public.files f where f.id = p_output_file_id and f.brand_id = p_brand_id
  ) then
    raise exception 'That file does not exist.' using errcode = 'P0002', hint = 'file_not_found';
  end if;

  update public.shoot_jobs
     set status = p_status,
         attempts = coalesce(p_attempts, attempts),
         checker_verdict = p_checker_verdict,
         checker_failed = coalesce(p_checker_failed, '{}'),
         moderation = p_moderation,
         credits = coalesce(p_credits, credits),
         refunded_credits = coalesce(p_refunded_credits, refunded_credits),
         spend_entry_id = coalesce(p_spend_entry_id, spend_entry_id),
         output_file_id = p_output_file_id,
         message = p_message,
         finished_at = case when p_status in ('ready', 'failed', 'refused') then now() else null end
   where id = p_job_id and brand_id = p_brand_id
  returning id into v_id;
  return v_id;
end;
$$;

-- A new function is executable by PUBLIC until that is taken away, and the isolation suite reads the
-- list of what a browser may call. Neither of these may be called from a browser: a shoot is run by
-- the server's own key, which checks `can_manage_kit` inside the function.
revoke all on function public.start_shoot_job(uuid, uuid, uuid, uuid, uuid, text, text, text, integer, text, text, text, text, uuid, text, text, timestamptz, text, integer) from public, anon, authenticated;
revoke all on function public.finish_shoot_job(uuid, uuid, uuid, text, integer, text, text[], text, integer, integer, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.start_shoot_job(uuid, uuid, uuid, uuid, uuid, text, text, text, integer, text, text, text, text, uuid, text, text, timestamptz, text, integer) to service_role;
grant execute on function public.finish_shoot_job(uuid, uuid, uuid, text, integer, text, text[], text, integer, integer, uuid, uuid, text) to service_role;
