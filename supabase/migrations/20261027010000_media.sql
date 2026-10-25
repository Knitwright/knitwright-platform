-- Media sets (plan v4, workstream W3-A): studio renders now, and the tables that lifestyle images,
-- turntable and clip (stage 2) plug into. Decision record 0054.
--
-- A media set belongs to one saved version of one design, so the same version is never made twice.
-- A set is made with a watermark. The clean files are kept in the images bucket under a folder
-- that is not a brand's id ("_private/<brand id>/..."), so the storage rule that lets members read
-- their brand's folder does not reach them: only the server's own key can read a clean file, and it
-- hands one out only once the set is unlocked (credits spent).
--
-- Only the server writes, through the functions below, which only the server's own key may run.
-- Members read their brand's rows. Nothing here has a foreign key into another workstream's tables:
-- a design is named by its id and version, a file by its id.

create table public.media_sets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid not null,
  version integer not null check (version >= 1),
  -- The hash credits use for this version (lib/credits/version-hash.ts).
  version_hash text not null check (length(version_hash) between 1 and 200),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  -- Set once the credits are spent. Until then only watermarked files are served.
  unlocked_at timestamptz,
  unlocked_by uuid references auth.users (id) on delete set null,
  -- A sentence that is safe to show. Never a provider's own error text.
  error text check (error is null or length(error) between 1 and 300),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, project_id, version_hash),
  unique (id, brand_id),
  constraint media_sets_failed_has_error check (status <> 'failed' or error is not null)
);

comment on table public.media_sets is
  'The media made from one saved version of a design. Written by the server only, through media_set_* functions.';

create index media_sets_project_idx on public.media_sets (brand_id, project_id, created_at desc);

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null,
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind text not null check (kind in ('studio_render', 'lifestyle', 'turntable', 'clip')),
  view text not null check (view in ('front', 'back', 'flat_lay', 'three_quarter', 'on_model', 'scene')),
  -- The watermarked picture, an ordinary file of the brand. Null for an item that has none.
  file_id uuid references public.files (id) on delete set null,
  -- Where the clean file is, in the images bucket. Never served before the set is unlocked.
  clean_path text check (clean_path is null or clean_path like '\_private/%'),
  width integer check (width > 0),
  height integer check (height > 0),
  checker_verdict text not null default 'not_checked'
    check (checker_verdict in ('pending', 'passed', 'rejected', 'not_checked')),
  provider text not null default 'knitwright-flat' check (length(provider) between 1 and 80),
  cost_microdollars bigint not null default 0 check (cost_microdollars >= 0),
  created_at timestamptz not null default now(),
  unique (set_id, kind, view),
  foreign key (set_id, brand_id) references public.media_sets (id, brand_id) on delete cascade
);

comment on table public.media_items is
  'One picture or clip of a media set. The clean file is never reachable by a member; see media_sets.';

create index media_items_set_idx on public.media_items (set_id);

-- Every state a set has been in, oldest first. Append-only, like a credit ledger line.
create table public.media_set_history (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  set_id uuid not null,
  brand_id uuid not null references public.brands (id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'unlocked')),
  note text not null default '' check (length(note) <= 300),
  created_at timestamptz not null default now(),
  foreign key (set_id, brand_id) references public.media_sets (id, brand_id) on delete cascade
);

comment on table public.media_set_history is
  'The states a media set has been in. Append-only; a line can never be changed or removed.';

create index media_set_history_idx on public.media_set_history (set_id, seq);

create function private.refuse_media_history_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A set that goes with its brand takes its history with it.
  if tg_op = 'DELETE'
     and (not exists (select 1 from public.brands b where b.id = old.brand_id)
          or not exists (select 1 from public.media_sets s where s.id = old.set_id)) then
    return old;
  end if;
  raise exception 'A media set history line can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_media_history_change() from public, anon, authenticated;

create trigger media_set_history_is_append_only
  before update or delete on public.media_set_history
  for each row execute function private.refuse_media_history_change();

create trigger media_set_history_is_not_truncated
  before truncate on public.media_set_history
  for each statement execute function private.refuse_media_history_change();

revoke all on public.media_sets, public.media_items, public.media_set_history
  from public, anon, authenticated, service_role;
grant select on public.media_sets, public.media_items, public.media_set_history
  to authenticated, service_role;

alter table public.media_sets enable row level security;
alter table public.media_items enable row level security;
alter table public.media_set_history enable row level security;

create policy "members read their brand's media sets"
  on public.media_sets for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's media items"
  on public.media_items for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's media set history"
  on public.media_set_history for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on any of the three, on purpose.

-- Starts a set for a version, once. Returns { id, created }. A set that failed is queued again
-- (created is true); any other existing set is returned as it is (created is false).
create function public.media_set_start(
  p_brand_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_version integer,
  p_version_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  insert into public.media_sets (brand_id, project_id, version, version_hash, created_by)
  values (p_brand_id, p_project_id, p_version, p_version_hash, p_user_id)
  on conflict (brand_id, project_id, version_hash) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.media_set_history (set_id, brand_id, status) values (v_id, p_brand_id, 'queued');
    return jsonb_build_object('id', v_id, 'created', true);
  end if;

  select id, status into v_id, v_status
  from public.media_sets
  where brand_id = p_brand_id and project_id = p_project_id and version_hash = p_version_hash
  for update;

  if v_status = 'failed' then
    update public.media_sets set status = 'queued', error = null, updated_at = now() where id = v_id;
    insert into public.media_set_history (set_id, brand_id, status, note)
    values (v_id, p_brand_id, 'queued', 'Started again after a failure.');
    return jsonb_build_object('id', v_id, 'created', true);
  end if;
  return jsonb_build_object('id', v_id, 'created', false);
end;
$$;

-- Moves a set on, only from one of the states it should be in. Returns whether it moved.
create function public.media_set_move(
  p_set_id uuid,
  p_from text[],
  p_to text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  if p_to not in ('running', 'succeeded', 'failed') then
    raise exception 'A set can only move to running, succeeded or failed.' using errcode = 'P0001';
  end if;
  update public.media_sets
  set status = p_to,
      error = case when p_to = 'failed' then coalesce(p_error, 'The media could not be made.') else null end,
      updated_at = now()
  where id = p_set_id and status = any (p_from)
  returning brand_id into v_brand;
  if v_brand is null then
    return false;
  end if;
  insert into public.media_set_history (set_id, brand_id, status, note)
  values (p_set_id, v_brand, p_to, coalesce(p_error, ''));
  return true;
end;
$$;

-- Adds or replaces one item of a set. Returns the item's id. A set that is not running takes none.
create function public.media_item_put(
  p_set_id uuid,
  p_kind text,
  p_view text,
  p_file_id uuid,
  p_clean_path text,
  p_width integer,
  p_height integer,
  p_provider text,
  p_cost_microdollars bigint,
  p_verdict text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
  v_id uuid;
begin
  select brand_id into v_brand from public.media_sets where id = p_set_id and status = 'running';
  if v_brand is null then
    raise exception 'The set is not running.' using errcode = 'P0001';
  end if;
  insert into public.media_items
    (set_id, brand_id, kind, view, file_id, clean_path, width, height, provider, cost_microdollars, checker_verdict)
  values
    (p_set_id, v_brand, p_kind, p_view, p_file_id, p_clean_path, p_width, p_height, p_provider,
     p_cost_microdollars, p_verdict)
  on conflict (set_id, kind, view) do update
    set file_id = excluded.file_id,
        clean_path = excluded.clean_path,
        width = excluded.width,
        height = excluded.height,
        provider = excluded.provider,
        cost_microdollars = excluded.cost_microdollars,
        checker_verdict = excluded.checker_verdict
  returning id into v_id;
  return v_id;
end;
$$;

-- Unlocks a finished set once the credits are spent. Returns whether this call unlocked it.
create function public.media_set_unlock(p_set_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  update public.media_sets
  set unlocked_at = now(), unlocked_by = p_user_id, updated_at = now()
  where id = p_set_id and status = 'succeeded' and unlocked_at is null
  returning brand_id into v_brand;
  if v_brand is null then
    return false;
  end if;
  insert into public.media_set_history (set_id, brand_id, status, note)
  values (p_set_id, v_brand, 'unlocked', 'Credits spent.');
  return true;
end;
$$;

revoke all on function public.media_set_start(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.media_set_move(uuid, text[], text, text) from public, anon, authenticated;
revoke all on function public.media_item_put(uuid, text, text, uuid, text, integer, integer, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.media_set_unlock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.media_set_start(uuid, uuid, uuid, integer, text) to service_role;
grant execute on function public.media_set_move(uuid, text[], text, text) to service_role;
grant execute on function public.media_item_put(uuid, text, text, uuid, text, integer, integer, text, bigint, text)
  to service_role;
grant execute on function public.media_set_unlock(uuid, uuid) to service_role;
