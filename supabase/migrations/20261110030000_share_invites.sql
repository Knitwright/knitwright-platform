-- Share invites and link access (spec F-S4 "Share", plan v5 Y8, decision 0081).
--
-- Decision 0026 gave a design one kind of link: anyone holding it may look, vote and comment, and
-- the member sends it themselves. The spec's Share popover asks for two more things:
--
--   1. an invite to one email address, at Can view, Can comment or Can edit, with a message;
--   2. a link that is either "Only invited people" or "Anyone with the link can view".
--
-- An invite has its own token, made the same way a link's is: 256 random bits, shown to the member
-- once and never stored. Only its SHA-256 hash is kept, and the function that opens one hashes the
-- token itself, so a token never reaches a table and an unknown, revoked or expired token all take
-- the same path and give the same answer. Nothing here sends an email: the server decides that,
-- and without an email key nothing is sent at all (lib/share/email.ts). `email_sent_at` records
-- what really went out, so the People-with-access list never claims an email nobody sent.
--
-- Nobody writes to share_invites directly. Every write goes through a function here that only the
-- server's own key may run and that checks the member's brand itself.

-- Who may open a design through a link. Existing links were all made under "anyone with the
-- link", which is what decision 0026 built, so that is what they keep.
alter table public.share_links
  add column audience text not null default 'anyone'
    check (audience in ('anyone', 'invited'));

comment on column public.share_links.audience is
  'anyone: whoever holds the link may look. invited: only an invite of this design opens it (plan v5 Y8).';

-- A link set to "Only invited people" opens nothing at all. Rewritten rather than added to, so
-- there is one place that decides what a token opens; every link made before this migration is
-- 'anyone', which is what decision 0026 built, so none of them changes.
create or replace function private.open_share_link(p_token text)
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
    and l.expires_at > now()
    and l.audience = 'anyone';
$$;

create table public.share_invites (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  -- What the invited person may do. "edit" is the design's own editor, so it is offered only to
  -- someone who can sign in; the server checks that before it offers it.
  access text not null check (access in ('view', 'comment', 'edit')),
  -- Kept lower case and trimmed, so one address cannot be invited twice under two spellings.
  email text not null check (
    length(email) between 3 and 320
    and email = lower(btrim(email))
    and email like '%_@_%._%'
  ),
  -- The member's own words to the invited person. May be empty.
  message text not null default '' check (length(message) <= 1000),
  -- SHA-256 of the invite's token. The token itself is never stored.
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  -- When an email really went out. Null while no email provider is configured.
  email_sent_at timestamptz,
  -- When the invited person first opened the design through this invite.
  accepted_at timestamptz,
  check (expires_at > created_at),
  unique (id, brand_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.share_invites is
  'Invites to one design, by email, at view, comment or edit. Token hashes only. Written by the server only.';

create index share_invites_project_idx on public.share_invites (project_id, created_at desc);
create index share_invites_brand_idx on public.share_invites (brand_id);

-- Members read their brand's invites and nothing else. The server's own key may read too; it
-- writes through the functions below and nothing else.
revoke all on public.share_invites from public, anon, authenticated, service_role;
grant select on public.share_invites to authenticated, service_role;
-- Deleting a design or a brand removes these through their keys.
grant delete on public.share_invites to service_role;

alter table public.share_invites enable row level security;

create policy "members read their brand's share invites"
  on public.share_invites for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

-- The one invite a token opens: not revoked and not expired. One lookup by the unique hash, so a
-- token that matches nothing, a revoked one and an expired one take the same path.
create function private.open_share_invite_row(p_token text)
returns public.share_invites
language sql
stable
security definer
set search_path = ''
as $$
  select i.*
  from public.share_invites i
  where i.token_hash = private.share_token_hash(p_token)
    and i.revoked_at is null
    and i.expires_at > now();
$$;

-- The most invites one design may have that are still open.
create function private.share_invites_open_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 50 $$;

-- Finds an invite of a brand the user belongs to. A missing invite and another brand's invite give
-- the same answer.
create function private.member_share_invite(p_invite_id uuid, p_user_id uuid)
returns public.share_invites
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite public.share_invites;
begin
  select * into v_invite from public.share_invites i where i.id = p_invite_id;
  if not found or not private.belongs_to(p_user_id, v_invite.brand_id) then
    raise exception 'That invite does not exist.' using errcode = 'P0002';
  end if;
  return v_invite;
end;
$$;

-- Invites one address to one design. The server makes the token and passes it here once; only its
-- hash is kept. Inviting an address that already has an open invite changes that invite rather than
-- making a second one, so the People-with-access list has one row per person; the invite takes the
-- new token, so the member has a link to send and the one sent before stops working. Returns the
-- invite's id, its expiry, and whether it replaced one that was already there.
create function public.create_share_invite(
  p_project_id uuid,
  p_user_id uuid,
  p_email text,
  p_access text,
  p_message text,
  p_token text,
  p_days integer
)
returns table (id uuid, expires_at timestamptz, replaced boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_message text := btrim(coalesce(p_message, ''));
  v_open public.share_invites;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'A share token is 43 characters.' using errcode = '22023';
  end if;
  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'An invite lasts 7, 30 or 90 days.' using errcode = '22023';
  end if;
  if p_access is null or p_access not in ('view', 'comment', 'edit') then
    raise exception 'Choose Can view, Can comment or Can edit.' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 320 then
    raise exception 'Enter an email address.' using errcode = '22023';
  end if;
  if length(v_message) > 1000 then
    raise exception 'Keep the message to 1000 characters.' using errcode = '22023';
  end if;

  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found or not private.belongs_to(p_user_id, v_project.brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;

  select * into v_open
  from public.share_invites i
  where i.project_id = p_project_id
    and i.email = v_email
    and i.revoked_at is null
    and i.expires_at > now()
  limit 1;

  if found then
    -- The address already has an open invite. It takes the new access, message and token, so the
    -- member has a link to send; the link sent before stops working, because a token is shown once
    -- and cannot be read back (decision 0026, owner question 3).
    update public.share_invites i
    set access = p_access,
        message = v_message,
        token_hash = private.share_token_hash(p_token),
        expires_at = now() + make_interval(days => p_days),
        email_sent_at = null,
        accepted_at = null
    where i.id = v_open.id;
    return query select v_open.id, (now() + make_interval(days => p_days))::timestamptz, true;
    return;
  end if;

  if (
    select count(*) from public.share_invites i
    where i.project_id = p_project_id and i.revoked_at is null and i.expires_at > now()
  ) >= private.share_invites_open_limit() then
    raise exception 'This design has as many open invites as it may have. Revoke one first.'
      using errcode = 'P0001', hint = 'too_many_invites';
  end if;

  return query
    insert into public.share_invites as i
      (brand_id, project_id, access, email, message, token_hash, invited_by, expires_at)
    values (
      v_project.brand_id,
      p_project_id,
      p_access,
      v_email,
      v_message,
      private.share_token_hash(p_token),
      p_user_id,
      now() + make_interval(days => p_days)
    )
    returning i.id, i.expires_at, false;
end;
$$;

-- Stops an invite working. Revoking a revoked invite changes nothing.
create function public.revoke_share_invite(p_invite_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.member_share_invite(p_invite_id, p_user_id);
  update public.share_invites i
  set revoked_at = coalesce(i.revoked_at, now())
  where i.id = p_invite_id;
end;
$$;

-- Records that an email really went out for this invite. The server calls it only after a provider
-- took the message, so the People-with-access list never claims an email nobody sent.
create function public.share_invite_emailed(p_invite_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.member_share_invite(p_invite_id, p_user_id);
  update public.share_invites i set email_sent_at = now() where i.id = p_invite_id;
end;
$$;

-- Sets who may open a design through its link: whoever holds it, or only an invited person.
create function public.set_share_link_audience(p_link_id uuid, p_user_id uuid, p_audience text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_audience is null or p_audience not in ('anyone', 'invited') then
    raise exception 'Choose who may open the link.' using errcode = '22023';
  end if;
  perform private.member_share_link(p_link_id, p_user_id);
  update public.share_links l set audience = p_audience where l.id = p_link_id;
  return p_audience;
end;
$$;

-- What an invited person's page is drawn from, for a token that opens an invite, and nothing for
-- any other. Opening it the first time records that the invite was taken up.
create function public.open_share_invite(p_token text)
returns table (
  invite_id uuid,
  brand_id uuid,
  brand_name text,
  project_name text,
  access text,
  version integer,
  spec jsonb,
  saved_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.share_invites;
begin
  v_invite := private.open_share_invite_row(p_token);
  if v_invite.id is null then
    return;
  end if;

  update public.share_invites i
  set accepted_at = coalesce(i.accepted_at, now())
  where i.id = v_invite.id;

  return query
    select v_invite.id, v_invite.brand_id, b.name, p.name, v_invite.access,
           v.version, v.spec, v.created_at, v_invite.expires_at
    from public.projects p
    join public.brands b on b.id = p.brand_id
    join public.spec_versions v on v.project_id = p.id and v.version = p.current_version
    where p.id = v_invite.project_id and p.brand_id = v_invite.brand_id;
end;
$$;

-- Only the server's own key may run these. A browser, signed in or not, is refused.
revoke all on function public.create_share_invite(uuid, uuid, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.revoke_share_invite(uuid, uuid) from public, anon, authenticated;
revoke all on function public.share_invite_emailed(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_share_link_audience(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.open_share_invite(text) from public, anon, authenticated;
grant execute on function public.create_share_invite(uuid, uuid, text, text, text, text, integer) to service_role;
grant execute on function public.revoke_share_invite(uuid, uuid) to service_role;
grant execute on function public.share_invite_emailed(uuid, uuid) to service_role;
grant execute on function public.set_share_link_audience(uuid, uuid, text) to service_role;
grant execute on function public.open_share_invite(text) to service_role;

revoke all on function private.open_share_invite_row(text) from public, anon, authenticated;
revoke all on function private.share_invites_open_limit() from public, anon, authenticated;
revoke all on function private.member_share_invite(uuid, uuid) from public, anon, authenticated;
