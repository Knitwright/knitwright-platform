-- Frozen releases, strike-offs and sign-offs (plans/production-outputs.md, workstream W4).
--
-- A release freezes what it takes to print a design again: the design version, the pattern
-- version, the fabric tests, the print settings, a fingerprint of the team list and the SHA-256
-- of every file. It keeps those inputs and hashes, never the files. Like a saved version of a
-- design, a release can never be changed or removed (private.refuse_history_change, which lets
-- the delete through only when the design itself is being deleted). A sign-off is the same: a
-- person's name and a date against a release.
--
-- A strike-off (a test print on the real fabric) moves through requested, received, accepted or
-- rejected, so its row changes until a named person decides. After that it is locked too.
--
-- As with saved versions, a person who made a row cannot be deleted while it exists (on delete
-- restrict). Account deletion removes the brand, and so these rows, first.
--
-- Only the server writes, through the functions below, which check that the user belongs to the
-- brand. Members read their brand's rows. Nothing here refers to another workstream's tables: a
-- release holds a JSON snapshot, so migrations merge in any order.

create table public.production_releases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  -- 1, 2, 3 ... within the design.
  number integer not null check (number >= 1),
  -- A short label such as "Round 1 jerseys".
  label text not null check (length(btrim(label)) between 1 and 120),
  -- The ReleaseSnapshot of lib/production/contract/release.ts.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 1048576),
  -- The PrintFileSpec of every file in the snapshot, in the same order, so a reorder can build
  -- the same files again. Settings only: no file and no player name.
  file_specs jsonb not null check (jsonb_typeof(file_specs) = 'array' and pg_column_size(file_specs) < 4194304),
  -- The team order the roster hash was made from, when there was one. Not a key: the order may
  -- be erased, and a release must stay.
  order_id uuid,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, number),
  unique (id, brand_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.production_releases is
  'A frozen set of inputs and file hashes for printing a design again. Append-only. Written by the server only.';

create index production_releases_project_idx on public.production_releases (brand_id, project_id, number desc);

create trigger production_releases_are_append_only
  before update or delete on public.production_releases
  for each row execute function private.refuse_history_change();

create trigger production_releases_are_not_truncated
  before truncate on public.production_releases
  for each statement execute function private.refuse_history_change();

create table public.strike_offs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  release_id uuid not null,
  status text not null default 'requested' check (status in ('requested', 'received', 'accepted', 'rejected')),
  requested_note text not null default '' check (length(requested_note) <= 500),
  requested_by uuid not null references auth.users (id) on delete restrict,
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  -- Measured on the strike-off, in percent. Left empty until someone measures.
  shrink_length_pct numeric(5, 2) check (shrink_length_pct between 0 and 30),
  shrink_width_pct numeric(5, 2) check (shrink_width_pct between 0 and 30),
  -- [{ "colour": "C1", "note": "..." }] one note per colour of the colour standard.
  colour_notes jsonb not null default '[]'
    check (jsonb_typeof(colour_notes) = 'array' and jsonb_array_length(colour_notes) <= 20 and pg_column_size(colour_notes) < 16384),
  -- Stored photos (files of kind 'proof'), up to six. Not keys: see private.proof_file_ids.
  photo_file_ids uuid[] not null default '{}' check (cardinality(photo_file_ids) <= 6),
  -- The person who decided, as they typed it, and their role.
  decided_by_name text check (decided_by_name is null or length(btrim(decided_by_name)) between 1 and 80),
  decided_role text check (decided_role is null or length(btrim(decided_role)) between 1 and 60),
  decided_on date,
  decision_note text not null default '' check (length(decision_note) <= 500),
  decided_by uuid references auth.users (id) on delete restrict,
  unique (id, brand_id),
  foreign key (release_id, brand_id) references public.production_releases (id, brand_id) on delete cascade,
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  constraint strike_offs_decision_is_named check (
    (status in ('accepted', 'rejected')) = (decided_by_name is not null and decided_role is not null and decided_on is not null)
  ),
  constraint strike_offs_received_has_time check (status = 'requested' or received_at is not null)
);

comment on table public.strike_offs is
  'A test print on the real fabric and the named person who accepted or rejected it. Locked once decided. Written by the server only.';

create index strike_offs_release_idx on public.strike_offs (brand_id, release_id, requested_at desc);

create function private.lock_decided_strike_off()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.projects p where p.id = old.project_id) then
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status in ('requested', 'received') then
    return new;
  end if;
  raise exception 'A decided strike-off can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger strike_offs_lock_when_decided
  before update or delete on public.strike_offs
  for each row execute function private.lock_decided_strike_off();

create table public.sign_offs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  release_id uuid not null,
  role text not null check (role in ('pattern', 'print', 'production', 'club')),
  signer_name text not null check (length(btrim(signer_name)) between 1 and 80),
  signed_on date not null,
  note text not null default '' check (length(note) <= 300),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (release_id, brand_id) references public.production_releases (id, brand_id) on delete cascade,
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.sign_offs is
  'A named person, a role and a date against a release. Append-only. Written by the server only.';

create index sign_offs_release_idx on public.sign_offs (brand_id, release_id, created_at);

create trigger sign_offs_are_append_only
  before update or delete on public.sign_offs
  for each row execute function private.refuse_history_change();

create trigger sign_offs_are_not_truncated
  before truncate on public.sign_offs
  for each statement execute function private.refuse_history_change();

revoke all on public.production_releases, public.strike_offs, public.sign_offs
  from public, anon, authenticated, service_role;
grant select on public.production_releases, public.strike_offs, public.sign_offs to authenticated, service_role;
-- Removing a design removes these through their keys. Their locks let that delete through.

alter table public.production_releases enable row level security;
alter table public.strike_offs enable row level security;
alter table public.sign_offs enable row level security;

create policy "members read their brand's releases"
  on public.production_releases for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's strike-offs"
  on public.strike_offs for select to authenticated
  using (private.is_member(brand_id));
create policy "members read their brand's sign-offs"
  on public.sign_offs for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on any of these, on purpose.

-- The most releases one design may have.
create function private.releases_limit()
returns integer language sql immutable set search_path = '' as $$ select 200 $$;

-- Freezes a release. The server computes the snapshot; this numbers it in order and checks the
-- user belongs to the brand. Returns the release's id and number.
create function public.create_release(
  p_project_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_label text,
  p_snapshot jsonb,
  p_file_specs jsonb,
  p_order_id uuid
)
returns table (id uuid, number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number integer;
begin
  if p_label is null or length(btrim(p_label)) not between 1 and 120 then
    raise exception 'A release needs a label of up to 120 characters.' using errcode = '22023';
  end if;
  perform 1 from public.projects p where p.id = p_project_id and p.brand_id = p_brand_id for update;
  if not found or not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  select coalesce(max(r.number), 0) + 1 into v_number
  from public.production_releases r where r.project_id = p_project_id;
  if v_number > private.releases_limit() then
    raise exception 'This design has as many releases as it may have.'
      using errcode = 'P0001', hint = 'too_many_releases';
  end if;
  return query
    insert into public.production_releases as r (brand_id, project_id, number, label, snapshot, file_specs, order_id, created_by)
    values (p_brand_id, p_project_id, v_number, btrim(p_label), p_snapshot, p_file_specs, p_order_id, p_user_id)
    returning r.id, r.number;
end;
$$;

-- Finds a release of a brand the user belongs to. A missing release and another brand's give the
-- same answer.
create function private.member_release(p_release_id uuid, p_brand_id uuid, p_user_id uuid)
returns public.production_releases
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_release public.production_releases;
begin
  select * into v_release from public.production_releases r
  where r.id = p_release_id and r.brand_id = p_brand_id;
  if not found or not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That release does not exist.' using errcode = 'P0002';
  end if;
  return v_release;
end;
$$;

-- Records a signature: a role, a name and a date against a release.
create function public.add_sign_off(
  p_release_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_role text,
  p_signer_name text,
  p_signed_on date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release public.production_releases;
  v_id uuid;
begin
  v_release := private.member_release(p_release_id, p_brand_id, p_user_id);
  insert into public.sign_offs (brand_id, project_id, release_id, role, signer_name, signed_on, note, created_by)
  values (p_brand_id, v_release.project_id, p_release_id, p_role, btrim(p_signer_name), p_signed_on, coalesce(p_note, ''), p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Asks for a strike-off against a release.
create function public.request_strike_off(
  p_release_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release public.production_releases;
  v_id uuid;
begin
  v_release := private.member_release(p_release_id, p_brand_id, p_user_id);
  if (select count(*) from public.strike_offs s where s.release_id = p_release_id) >= 20 then
    raise exception 'This release has as many strike-offs as it may have.'
      using errcode = 'P0001', hint = 'too_many_strike_offs';
  end if;
  insert into public.strike_offs (brand_id, project_id, release_id, requested_note, requested_by)
  values (p_brand_id, v_release.project_id, p_release_id, coalesce(p_note, ''), p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Finds a strike-off of a brand the user belongs to.
create function private.member_strike_off(p_strike_off_id uuid, p_brand_id uuid, p_user_id uuid)
returns public.strike_offs
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.strike_offs;
begin
  select * into v_row from public.strike_offs s where s.id = p_strike_off_id and s.brand_id = p_brand_id;
  if not found or not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That strike-off does not exist.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Records that the strike-off arrived, with what was measured and seen on it. May be called again
-- to correct the measurements until a person decides.
create function public.receive_strike_off(
  p_strike_off_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_shrink_length numeric,
  p_shrink_width numeric,
  p_colour_notes jsonb,
  p_photo_file_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.strike_offs;
begin
  v_row := private.member_strike_off(p_strike_off_id, p_brand_id, p_user_id);
  if v_row.status in ('accepted', 'rejected') then
    raise exception 'A decided strike-off can never be changed or removed.'
      using errcode = 'P0001', hint = 'append_only';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_photo_file_ids, '{}')) as f(id)
    where not exists (
      select 1 from public.files x where x.id = f.id and x.brand_id = p_brand_id and x.kind = 'proof'
    )
  ) then
    raise exception 'A photo is not one of this brand''s proof photos.' using errcode = '22023';
  end if;
  update public.strike_offs s
  set status = 'received',
      received_at = coalesce(s.received_at, now()),
      shrink_length_pct = p_shrink_length,
      shrink_width_pct = p_shrink_width,
      colour_notes = coalesce(p_colour_notes, '[]'),
      photo_file_ids = coalesce(p_photo_file_ids, '{}')
  where s.id = p_strike_off_id;
end;
$$;

-- A named person accepts or rejects a received strike-off. After this the row is locked.
create function public.decide_strike_off(
  p_strike_off_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_accept boolean,
  p_name text,
  p_role text,
  p_on date,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.strike_offs;
begin
  v_row := private.member_strike_off(p_strike_off_id, p_brand_id, p_user_id);
  if v_row.status <> 'received' then
    raise exception 'Only a strike-off that has arrived can be decided.'
      using errcode = 'P0001', hint = 'not_received';
  end if;
  update public.strike_offs s
  set status = case when p_accept then 'accepted' else 'rejected' end,
      decided_by_name = btrim(p_name),
      decided_role = btrim(p_role),
      decided_on = p_on,
      decision_note = coalesce(p_note, ''),
      decided_by = p_user_id
  where s.id = p_strike_off_id;
end;
$$;

revoke all on function public.create_release(uuid, uuid, uuid, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.add_sign_off(uuid, uuid, uuid, text, text, date, text) from public, anon, authenticated;
revoke all on function public.request_strike_off(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.receive_strike_off(uuid, uuid, uuid, numeric, numeric, jsonb, uuid[]) from public, anon, authenticated;
revoke all on function public.decide_strike_off(uuid, uuid, uuid, boolean, text, text, date, text) from public, anon, authenticated;
grant execute on function public.create_release(uuid, uuid, uuid, text, jsonb, jsonb, uuid) to service_role;
grant execute on function public.add_sign_off(uuid, uuid, uuid, text, text, date, text) to service_role;
grant execute on function public.request_strike_off(uuid, uuid, uuid, text) to service_role;
grant execute on function public.receive_strike_off(uuid, uuid, uuid, numeric, numeric, jsonb, uuid[]) to service_role;
grant execute on function public.decide_strike_off(uuid, uuid, uuid, boolean, text, text, date, text) to service_role;

-- Deleting a design also deletes the proof photos of its strike-offs: their rows and, through the
-- list the deletion functions return, their objects. A photo belongs to one strike-off.
create or replace function private.files_of_project_alone(p_project_id uuid, p_brand_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.id
  from public.files f
  where f.brand_id = p_brand_id
    and (
      (
        f.id in (select private.artwork_file_ids(p_project_id))
        and not exists (
          select 1
          from public.projects other
          where other.brand_id = p_brand_id
            and other.id <> p_project_id
            and f.id in (select private.artwork_file_ids(other.id))
        )
      )
      or f.id in (
        select j.front_file_id from public.jobs j
        where j.project_id = p_project_id and j.brand_id = p_brand_id and j.front_file_id is not null
        union
        select j.back_file_id from public.jobs j
        where j.project_id = p_project_id and j.brand_id = p_brand_id and j.back_file_id is not null
      )
      or (
        f.kind = 'proof'
        and f.id in (
          select unnest(s.photo_file_ids) from public.strike_offs s
          where s.project_id = p_project_id and s.brand_id = p_brand_id
        )
      )
    );
$$;

revoke all on function private.files_of_project_alone(uuid, uuid) from public, anon, authenticated;
