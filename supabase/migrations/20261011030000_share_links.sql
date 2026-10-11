-- Share links: a design shown to a club committee or a co-founder, who can comment and vote
-- without an account. Guide module 4 ("share a link with the committee for comments and votes").
-- Decision 0026.
--
-- A link points at one saved version of one design. Its token is random (256 bits) and is never
-- stored: only its SHA-256 hash is. The server makes the token, shows it to the member once, and
-- the member sends it to their committee themselves. Knitwright emails nobody.
--
-- Members read their brand's links and answers through the rules below. Nobody writes to either
-- table directly. Every write, and every read made with a token, goes through a function here
-- that only the server's own key may run. The functions that take a token hash it themselves and
-- compare the hash, so a token never reaches a table, and an unknown, expired or revoked token all
-- take the same path and give the same answer: nothing.
--
-- Why the server's key and not the browser's: the publishable key is public, so a function open
-- to it could be called by anyone holding a link, past the bot check, the rate limits and the
-- field limits the server applies, and could read the whole stored design rather than the parts
-- the public page shows.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  -- The saved version the link shows. A member may move it to a newer one.
  version integer not null check (version >= 1),
  -- SHA-256 of the token. The token itself is never stored.
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  -- Lets an answer name its link and its brand together, so the two cannot disagree.
  unique (id, brand_id),
  -- The design and its brand together. Deleting the design, or its brand, deletes its links.
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.share_links is
  'Links that show one version of a design to people without an account. Token hashes only. Written by the server only.';

create index share_links_project_idx on public.share_links (project_id, created_at desc);
create index share_links_brand_idx on public.share_links (brand_id);

create table public.share_responses (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  brand_id uuid not null,
  -- SHA-256 of the link and the random key in the visitor's cookie. One browser has one answer
  -- per link, which it can change. The hash includes the link, so it cannot follow a browser
  -- from one link to another.
  visitor_hash bytea not null check (octet_length(visitor_hash) = 32),
  name text not null check (length(name) between 1 and 60 and name = btrim(name)),
  vote text check (vote in ('yes', 'not_yet')),
  comment text check (length(comment) between 1 and 1000 and comment = btrim(comment)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vote is not null or comment is not null),
  unique (link_id, visitor_hash),
  -- Deleting the link deletes its answers, so deleting a design or a brand does too.
  foreign key (link_id, brand_id) references public.share_links (id, brand_id) on delete cascade
);

comment on table public.share_responses is
  'Comments and votes left through a share link. No email address is asked. Written by the server only.';

create index share_responses_link_idx on public.share_responses (link_id, updated_at desc);
create index share_responses_brand_idx on public.share_responses (brand_id);

-- Browsers may read and nothing else, and only their own brand's rows. The server's own key may
-- read too. It writes through the functions below and nothing else.
revoke all on public.share_links, public.share_responses
  from public, anon, authenticated, service_role;
grant select on public.share_links, public.share_responses to authenticated, service_role;
-- Deleting a design or a brand removes these through their keys.
grant delete on public.share_links, public.share_responses to service_role;

alter table public.share_links enable row level security;
alter table public.share_responses enable row level security;

create policy "members read their brand's share links"
  on public.share_links for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's share answers"
  on public.share_responses for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on either table, on purpose.

-- The hash a token is stored and looked up by.
create function private.share_token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
$$;

-- The one link a token opens: not revoked and not expired. One lookup by the unique hash, so a
-- token that matches nothing, a revoked one and an expired one take the same path.
create function private.open_share_link(p_token text)
returns public.share_links
language sql
stable
security definer
set search_path = ''
as $$
  select l.*
  from public.share_links l
  where l.token_hash = private.share_token_hash(p_token)
    and l.revoked_at is null
    and l.expires_at > now();
$$;

-- The most links one design may have that are still open. Old ones can be revoked.
create function private.share_links_open_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;

-- The most people who may answer through one link.
create function private.share_answers_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 300 $$;

-- Makes a link to the design's newest version. The server makes the token and passes it here
-- once; only its hash is kept. Returns the link's id, version and expiry.
create function public.create_share_link(
  p_project_id uuid,
  p_user_id uuid,
  p_token text,
  p_days integer
)
returns table (id uuid, version integer, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'A share token is 43 characters.' using errcode = '22023';
  end if;
  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'A link lasts 7, 30 or 90 days.' using errcode = '22023';
  end if;

  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found or not private.belongs_to(p_user_id, v_project.brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;

  if (
    select count(*) from public.share_links l
    where l.project_id = p_project_id and l.revoked_at is null and l.expires_at > now()
  ) >= private.share_links_open_limit() then
    raise exception 'This design has as many open links as it may have. Revoke one first.'
      using errcode = 'P0001', hint = 'too_many_links';
  end if;

  return query
    insert into public.share_links as l
      (brand_id, project_id, version, token_hash, created_by, expires_at)
    values (
      v_project.brand_id,
      p_project_id,
      v_project.current_version,
      private.share_token_hash(p_token),
      p_user_id,
      now() + make_interval(days => p_days)
    )
    returning l.id, l.version, l.expires_at;
end;
$$;

-- Finds a link of a brand the user belongs to. A link that is missing and another brand's link
-- give the same answer.
create function private.member_share_link(p_link_id uuid, p_user_id uuid)
returns public.share_links
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.share_links;
begin
  select * into v_link from public.share_links l where l.id = p_link_id;
  if not found or not private.belongs_to(p_user_id, v_link.brand_id) then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;
  return v_link;
end;
$$;

-- Stops a link working. Revoking a revoked link changes nothing.
create function public.revoke_share_link(p_link_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.member_share_link(p_link_id, p_user_id);
  update public.share_links l
  set revoked_at = coalesce(l.revoked_at, now())
  where l.id = p_link_id;
end;
$$;

-- Moves an open link to the design's newest version. Returns the version it now shows.
create function public.move_share_link(p_link_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.share_links;
  v_version integer;
begin
  v_link := private.member_share_link(p_link_id, p_user_id);
  if v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'That link no longer works. Make a new one.'
      using errcode = 'P0001', hint = 'link_closed';
  end if;

  select p.current_version into v_version from public.projects p where p.id = v_link.project_id;
  update public.share_links l set version = v_version where l.id = p_link_id;
  return v_version;
end;
$$;

-- What the public page is drawn from, for a token that opens a link, and nothing for any other.
-- The brand is returned for the server, which reads the brand's size charts and pictures to draw
-- the design. The server shows the visitor only the design's name, the brand's name, the
-- drawings and the colours and fabrics.
create function public.open_share(p_token text)
returns table (
  link_id uuid,
  brand_id uuid,
  brand_name text,
  project_name text,
  version integer,
  is_current boolean,
  spec jsonb,
  saved_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.brand_id, b.name, p.name, v.version, v.version = p.current_version,
         v.spec, v.created_at, l.expires_at
  from private.open_share_link(p_token) l
  join public.projects p on p.id = l.project_id and p.brand_id = l.brand_id
  join public.brands b on b.id = l.brand_id
  join public.spec_versions v on v.project_id = l.project_id and v.version = l.version
  where l.id is not null;
$$;

-- Keeps one answer from a visitor through a link that is open. The same browser answering again
-- changes its answer: a new vote replaces the old, a new comment replaces the old, and leaving
-- one out keeps what was there. An unknown, expired or revoked token is refused with one message.
create function public.share_respond(
  p_token text,
  p_visitor_key text,
  p_name text,
  p_vote text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.share_links;
  v_visitor bytea;
  v_name text := btrim(coalesce(p_name, ''));
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  v_link := private.open_share_link(p_token);
  if v_link.id is null then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;

  if p_visitor_key is null or p_visitor_key !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'A visitor key is 43 characters.' using errcode = '22023';
  end if;
  if length(v_name) < 1 or length(v_name) > 60 then
    raise exception 'A name has 1 to 60 characters.' using errcode = '22023';
  end if;
  if p_vote is not null and p_vote not in ('yes', 'not_yet') then
    raise exception 'A vote is yes or not yet.' using errcode = '22023';
  end if;
  if v_comment is not null and length(v_comment) > 1000 then
    raise exception 'A comment has at most 1000 characters.' using errcode = '22023';
  end if;
  if p_vote is null and v_comment is null then
    raise exception 'Leave a vote, a comment or both.' using errcode = '22023';
  end if;

  v_visitor := sha256(convert_to(v_link.id::text || ':' || p_visitor_key, 'UTF8'));

  -- Answers to one link are taken in turn, so the count below cannot be passed by two at once.
  perform 1 from public.share_links l where l.id = v_link.id for update;

  if not exists (
    select 1 from public.share_responses r
    where r.link_id = v_link.id and r.visitor_hash = v_visitor
  ) and (
    select count(*) from public.share_responses r where r.link_id = v_link.id
  ) >= private.share_answers_limit() then
    raise exception 'This link has taken as many answers as it can.'
      using errcode = 'P0001', hint = 'too_many_answers';
  end if;

  insert into public.share_responses as r
    (link_id, brand_id, visitor_hash, name, vote, comment)
  values (v_link.id, v_link.brand_id, v_visitor, v_name, p_vote, v_comment)
  on conflict (link_id, visitor_hash) do update
  set name = excluded.name,
      vote = coalesce(excluded.vote, r.vote),
      comment = coalesce(excluded.comment, r.comment),
      updated_at = now();
end;
$$;

-- Only the server's own key may run these. A browser, signed in or not, is refused.
revoke all on function public.create_share_link(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.revoke_share_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.move_share_link(uuid, uuid) from public, anon, authenticated;
revoke all on function public.open_share(text) from public, anon, authenticated;
revoke all on function public.share_respond(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_share_link(uuid, uuid, text, integer) to service_role;
grant execute on function public.revoke_share_link(uuid, uuid) to service_role;
grant execute on function public.move_share_link(uuid, uuid) to service_role;
grant execute on function public.open_share(text) to service_role;
grant execute on function public.share_respond(text, text, text, text, text) to service_role;

revoke all on function private.share_token_hash(text) from public, anon, authenticated;
revoke all on function private.open_share_link(text) from public, anon, authenticated;
revoke all on function private.share_links_open_limit() from public, anon, authenticated;
revoke all on function private.share_answers_limit() from public, anon, authenticated;
revoke all on function private.member_share_link(uuid, uuid) from public, anon, authenticated;
