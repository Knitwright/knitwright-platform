-- Design comments (plan v4, workstream W4-D). Decision record 0063.
--
-- Members of a brand talk about a design: a comment is anchored to a saved version of the design and,
-- if the writer wants, to a panel or to a point on a panel (millimetres). A comment starts a thread
-- and others reply to it. Anyone in the brand may read and write comments; owners, admins and kit
-- managers may mark a thread resolved; the author may change or remove their own comment for a short
-- window after writing it. Comments are for members only: nothing here is reachable through a share
-- link (decision 0026).
--
-- Only the server writes, through the functions below, which only the server's own key may run.
-- Members read their brand's rows. A comment goes with its design (and so with its brand); the
-- names of people inside comments are personal data and the erasure test lists these tables.
--
-- A change to a comment keeps what it said before in design_comment_edits. That history is
-- append-only: a line can never be changed. It can go only when its comment goes (the design or the
-- brand is deleted) or when its author deletes a comment that has replies: the comment stays as an
-- empty line so the replies keep their place, and the old words go.

create table public.design_comments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid not null,
  -- Null for the first comment of a thread; the first comment's id for a reply. Replies do not nest.
  parent_id uuid,
  -- The saved version of the design the comment is about. A reply takes its thread's version.
  version integer not null check (version >= 1),
  -- The panel and the point on it, in millimetres from the panel's top left. Replies have none.
  panel_id text check (panel_id is null or length(panel_id) between 1 and 64),
  x_mm numeric(8, 2) check (x_mm is null or x_mm between 0 and 5000),
  y_mm numeric(8, 2) check (y_mm is null or y_mm between 0 and 5000),
  -- Cleaned by the app (lib/comments/text.ts); the database holds the length limit and the empty
  -- line a removed comment leaves behind.
  body text not null check (length(body) <= 2000),
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  unique (id, brand_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  foreign key (parent_id, brand_id) references public.design_comments (id, brand_id) on delete cascade,
  constraint design_comments_body_present check (deleted_at is not null or length(btrim(body)) >= 1),
  constraint design_comments_removed_is_empty check (deleted_at is null or body = ''),
  constraint design_comments_point_has_panel check ((x_mm is null) = (y_mm is null) and (x_mm is null or panel_id is not null)),
  constraint design_comments_reply_has_no_anchor check (parent_id is null or (panel_id is null and x_mm is null)),
  constraint design_comments_only_threads_resolve check (parent_id is null or resolved_at is null),
  constraint design_comments_resolver_has_time check (resolved_by is null or resolved_at is not null)
);

comment on table public.design_comments is
  'Comments on a design, in threads, for members of the brand only. Written by the server only, through design_comment_* functions.';

create index design_comments_project_idx on public.design_comments (brand_id, project_id, created_at, id);
create index design_comments_parent_idx on public.design_comments (parent_id) where parent_id is not null;
create index design_comments_author_idx on public.design_comments (author_id, created_at desc);

-- What a comment said before it was changed. Append-only.
create table public.design_comment_edits (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  comment_id uuid not null,
  brand_id uuid not null references public.brands (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  edited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (comment_id, brand_id) references public.design_comments (id, brand_id) on delete cascade
);

comment on table public.design_comment_edits is
  'The earlier words of a changed comment. Append-only; goes only with its comment, or when its comment is removed.';

create index design_comment_edits_idx on public.design_comment_edits (comment_id, seq);

-- Members of the same brand a comment names. Shown to them as a count on the design; no email is sent.
create table public.design_comment_mentions (
  comment_id uuid not null,
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id),
  foreign key (comment_id, brand_id) references public.design_comments (id, brand_id) on delete cascade
);

comment on table public.design_comment_mentions is
  'Which members a comment names. Only members of the comment''s own brand can be named. Written by the server only.';

create index design_comment_mentions_user_idx on public.design_comment_mentions (brand_id, user_id);

-- The edit history may go with its comment (design or brand deleted), or once its comment has been
-- removed by its author. Any other delete, and every update, is refused.
create function private.refuse_comment_edit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and (not exists (select 1 from public.brands b where b.id = old.brand_id)
          or not exists (select 1 from public.design_comments c where c.id = old.comment_id)
          or exists (select 1 from public.design_comments c where c.id = old.comment_id and c.deleted_at is not null)) then
    return old;
  end if;
  raise exception 'A comment''s earlier words can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_comment_edit_change() from public, anon, authenticated;

create trigger design_comment_edits_are_append_only
  before update or delete on public.design_comment_edits
  for each row execute function private.refuse_comment_edit_change();

create trigger design_comment_edits_are_not_truncated
  before truncate on public.design_comment_edits
  for each statement execute function private.refuse_comment_edit_change();

revoke all on public.design_comments, public.design_comment_edits, public.design_comment_mentions
  from public, anon, authenticated, service_role;
grant select on public.design_comments, public.design_comment_edits, public.design_comment_mentions
  to authenticated, service_role;

alter table public.design_comments enable row level security;
alter table public.design_comment_edits enable row level security;
alter table public.design_comment_mentions enable row level security;

create policy "members read their brand's design comments"
  on public.design_comments for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's design comment edits"
  on public.design_comment_edits for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's design comment mentions"
  on public.design_comment_mentions for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on any of the three, on purpose.

-- Writes the mentions of a comment, replacing what was there. Every name must be a member of the
-- brand; the person writing may not name themselves. At most 10.
create function private.set_comment_mentions(p_comment_id uuid, p_brand_id uuid, p_author_id uuid, p_mentions uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wanted uuid[] := coalesce((select array_agg(distinct m) from unnest(coalesce(p_mentions, '{}'::uuid[])) as m where m <> p_author_id), '{}'::uuid[]);
begin
  if coalesce(array_length(v_wanted, 1), 0) > 10 then
    raise exception 'A comment can name 10 people at most.' using errcode = '22023', hint = 'too_many_mentions';
  end if;
  if exists (
    select 1 from unnest(v_wanted) as m
    where not exists (select 1 from public.memberships ms where ms.brand_id = p_brand_id and ms.user_id = m)
  ) then
    raise exception 'Only members of this brand can be named.' using errcode = '22023', hint = 'mention_not_member';
  end if;
  delete from public.design_comment_mentions where comment_id = p_comment_id;
  insert into public.design_comment_mentions (comment_id, brand_id, user_id)
  select p_comment_id, p_brand_id, m from unnest(v_wanted) as m;
end;
$$;

revoke all on function private.set_comment_mentions(uuid, uuid, uuid, uuid[]) from public, anon, authenticated;

-- Adds a comment, or a reply when p_parent_id is given. Returns the new comment's id.
--   A reply takes its thread's version and has no anchor of its own.
--   30 comments by one person in 10 minutes, 500 on a design and 200 replies on a thread at most.
create function public.design_comment_add(
  p_brand_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_parent_id uuid,
  p_version integer,
  p_panel_id text,
  p_x_mm numeric,
  p_y_mm numeric,
  p_body text,
  p_mentions uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
  v_parent public.design_comments%rowtype;
  v_version integer := p_version;
  v_id uuid;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  select p.current_version into v_current from public.projects p
  where p.id = p_project_id and p.brand_id = p_brand_id;
  if not found then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'A comment is 1 to 2000 characters.' using errcode = '22023';
  end if;

  if p_parent_id is not null then
    select * into v_parent from public.design_comments c
    where c.id = p_parent_id and c.brand_id = p_brand_id and c.project_id = p_project_id and c.parent_id is null;
    if not found or v_parent.deleted_at is not null then
      raise exception 'That comment does not exist.' using errcode = 'P0002';
    end if;
    if (select count(*) from public.design_comments c where c.parent_id = p_parent_id) >= 200 then
      raise exception 'A thread can hold 200 replies.' using errcode = 'P0001', hint = 'too_many_comments';
    end if;
    v_version := v_parent.version;
  elsif v_version is null or v_version < 1 or v_version > v_current then
    raise exception 'That version of the design does not exist.' using errcode = '22023';
  end if;

  if (select count(*) from public.design_comments c
      where c.author_id = p_user_id and c.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Too many comments. Wait a few minutes.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if (select count(*) from public.design_comments c where c.brand_id = p_brand_id and c.project_id = p_project_id) >= 500 then
    raise exception 'A design can hold 500 comments.' using errcode = 'P0001', hint = 'too_many_comments';
  end if;

  insert into public.design_comments (brand_id, project_id, parent_id, version, panel_id, x_mm, y_mm, body, author_id)
  values (
    p_brand_id, p_project_id, p_parent_id, v_version,
    case when p_parent_id is null then p_panel_id end,
    case when p_parent_id is null then p_x_mm end,
    case when p_parent_id is null then p_y_mm end,
    btrim(p_body), p_user_id
  )
  returning id into v_id;
  perform private.set_comment_mentions(v_id, p_brand_id, p_user_id, p_mentions);
  return v_id;
end;
$$;

-- Changes the words of one's own comment, within 15 minutes of writing it. The earlier words are kept.
create function public.design_comment_edit(
  p_brand_id uuid,
  p_user_id uuid,
  p_comment_id uuid,
  p_body text,
  p_mentions uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment public.design_comments%rowtype;
begin
  select * into v_comment from public.design_comments c
  where c.id = p_comment_id and c.brand_id = p_brand_id for update;
  if not found or v_comment.deleted_at is not null or not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That comment does not exist.' using errcode = 'P0002';
  end if;
  if v_comment.author_id is distinct from p_user_id then
    raise exception 'Only the person who wrote a comment can change it.' using errcode = '42501';
  end if;
  if now() > v_comment.created_at + interval '15 minutes' then
    raise exception 'A comment can be changed for 15 minutes after it is written.' using errcode = '42501', hint = 'edit_window_closed';
  end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'A comment is 1 to 2000 characters.' using errcode = '22023';
  end if;
  if btrim(p_body) <> v_comment.body then
    insert into public.design_comment_edits (comment_id, brand_id, body, edited_by)
    values (v_comment.id, p_brand_id, v_comment.body, p_user_id);
    update public.design_comments set body = btrim(p_body), edited_at = now() where id = v_comment.id;
  end if;
  perform private.set_comment_mentions(v_comment.id, p_brand_id, p_user_id, p_mentions);
end;
$$;

-- Removes one's own comment, within 15 minutes of writing it. A comment nobody replied to goes
-- altogether. One with replies stays as an empty line so the replies keep their place; its words,
-- its earlier words and its mentions go.
create function public.design_comment_delete(p_brand_id uuid, p_user_id uuid, p_comment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment public.design_comments%rowtype;
begin
  select * into v_comment from public.design_comments c
  where c.id = p_comment_id and c.brand_id = p_brand_id for update;
  if not found or v_comment.deleted_at is not null or not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That comment does not exist.' using errcode = 'P0002';
  end if;
  if v_comment.author_id is distinct from p_user_id then
    raise exception 'Only the person who wrote a comment can remove it.' using errcode = '42501';
  end if;
  if now() > v_comment.created_at + interval '15 minutes' then
    raise exception 'A comment can be removed for 15 minutes after it is written.' using errcode = '42501', hint = 'edit_window_closed';
  end if;
  if exists (select 1 from public.design_comments c where c.parent_id = v_comment.id) then
    update public.design_comments
      set body = '', deleted_at = now(), edited_at = null, resolved_at = null, resolved_by = null
      where id = v_comment.id;
    delete from public.design_comment_edits where comment_id = v_comment.id;
    delete from public.design_comment_mentions where comment_id = v_comment.id;
    return 'emptied';
  end if;
  delete from public.design_comments where id = v_comment.id;
  return 'removed';
end;
$$;

-- Marks a thread resolved, or opens it again. Owners, admins and kit managers only; viewers may
-- comment but not resolve. Only the first comment of a thread can be resolved.
create function public.design_comment_resolve(p_brand_id uuid, p_user_id uuid, p_comment_id uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment public.design_comments%rowtype;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That comment does not exist.' using errcode = 'P0002';
  end if;
  select * into v_comment from public.design_comments c
  where c.id = p_comment_id and c.brand_id = p_brand_id and c.parent_id is null for update;
  if not found or v_comment.deleted_at is not null then
    raise exception 'That comment does not exist.' using errcode = 'P0002';
  end if;
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'Your role in this club does not allow that.' using errcode = '42501';
  end if;
  if p_resolved then
    update public.design_comments
      set resolved_at = coalesce(resolved_at, now()), resolved_by = coalesce(resolved_by, p_user_id)
      where id = v_comment.id;
  else
    update public.design_comments set resolved_at = null, resolved_by = null where id = v_comment.id;
  end if;
end;
$$;

revoke all on function public.design_comment_add(uuid, uuid, uuid, uuid, integer, text, numeric, numeric, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.design_comment_edit(uuid, uuid, uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.design_comment_delete(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.design_comment_resolve(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.design_comment_add(uuid, uuid, uuid, uuid, integer, text, numeric, numeric, text, uuid[])
  to service_role;
grant execute on function public.design_comment_edit(uuid, uuid, uuid, text, uuid[]) to service_role;
grant execute on function public.design_comment_delete(uuid, uuid, uuid) to service_role;
grant execute on function public.design_comment_resolve(uuid, uuid, uuid, boolean) to service_role;
