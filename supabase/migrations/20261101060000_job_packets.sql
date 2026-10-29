-- Factory job packet (plans/platform-v5.md, X7; spec F-O2). Decision 0072.
--
-- A factory gets a link, with no account, to one batch: its files, lists and due date, and three buttons
-- (Received, In production, Ready for QC), a note box and a photo upload. The link's token is 256 random
-- bits made by the server; only its SHA-256 hash is stored, as for share links (decision 0026). A link
-- expires and ops can revoke it. "Send again" gives the packet a new token, so the old address stops
-- opening anything.
--
-- Nobody writes these tables directly. Ops (platform admins) make, renew and revoke a packet through
-- functions that check the actor themselves. The factory's buttons go through job_packet_record, which
-- takes the token, hashes it, and checks the packet is open. Every function here is for the server's own
-- key only. Platform admins read both tables; members and visitors read nothing.
--
-- factory_events is append-only: what the factory said, and when, can never be changed or removed.

create table public.job_packets (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete restrict,
  -- SHA-256 of the token. The token itself is never stored.
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  -- How many times a link was made for this packet: the first, then each "Send again".
  sent_count integer not null default 1 check (sent_count >= 1),
  last_sent_at timestamptz not null default now(),
  check (expires_at > created_at)
);

comment on table public.job_packets is
  'A link that shows one batch to its factory without an account. Token hashes only. Written by ops functions only.';

-- A batch has at most one packet that has not been revoked. Revoke it to make another.
create unique index job_packets_one_live_per_batch on public.job_packets (batch_id) where revoked_at is null;
create index job_packets_batch_idx on public.job_packets (batch_id, created_at desc);

create table public.factory_events (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.job_packets (id) on delete restrict,
  batch_id uuid not null references public.batches (id) on delete restrict,
  kind text not null check (kind in ('received', 'in_production', 'ready_for_qc', 'note', 'photo')),
  note text not null default '' check (length(note) <= 1000 and note = btrim(note)),
  -- Storage paths in the uploads bucket, under job-packets/<packet id>/. One per photo event.
  photo_keys text[] not null default '{}',
  -- How many orders of the batch this step moved on.
  orders_moved integer not null default 0 check (orders_moved >= 0),
  at timestamptz not null default now(),
  constraint factory_events_photo_has_key check ((kind = 'photo') = (cardinality(photo_keys) = 1)),
  constraint factory_events_note_has_text check (kind <> 'note' or length(note) >= 1)
);

comment on table public.factory_events is
  'What a factory recorded through its job packet: steps, notes and photos. Append-only. Written by job_packet_record only.';

create index factory_events_batch_idx on public.factory_events (batch_id, at, id);
create index factory_events_packet_idx on public.factory_events (packet_id, kind);

create function private.factory_events_refuse_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'What a factory recorded can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
end;
$$;

create trigger factory_events_are_append_only
  before update or delete on public.factory_events
  for each row execute function private.factory_events_refuse_change();

create trigger factory_events_are_not_truncated
  before truncate on public.factory_events
  for each statement execute function private.factory_events_refuse_change();

revoke all on public.job_packets, public.factory_events from public, anon, authenticated, service_role;
grant select on public.job_packets, public.factory_events to authenticated, service_role;

alter table public.job_packets enable row level security;
alter table public.factory_events enable row level security;

create policy "platform admins read job packets"
  on public.job_packets for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read factory events"
  on public.factory_events for select to authenticated
  using (private.is_platform_admin());

-- There are no insert, update or delete policies on either table, on purpose.

-- The hash a token is stored and looked up by.
create function private.job_packet_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
$$;

-- The one packet a token opens: not revoked and not expired. One lookup by the unique hash, so a token
-- that matches nothing, a revoked one and an expired one take the same path.
create function private.open_job_packet(p_token text)
returns public.job_packets
language sql
stable
security definer
set search_path = ''
as $$
  select j.*
  from public.job_packets j
  where j.token_hash = private.job_packet_hash(p_token)
    and j.revoked_at is null
    and j.expires_at > now();
$$;

create function private.job_packet_check_input(p_token text, p_days integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'A job packet token is 43 characters.' using errcode = '22023';
  end if;
  if p_days is null or p_days not between 1 and 90 then
    raise exception 'A job packet link lasts 1 to 90 days.' using errcode = '22023';
  end if;
end;
$$;

-- Makes the packet of a batch. Refused while the batch has a packet that has not been revoked: send that
-- one again, or revoke it first.
create function public.create_job_packet(p_actor uuid, p_batch_id uuid, p_token text, p_days integer)
returns table (id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  perform private.job_packet_check_input(p_token, p_days);
  perform 1 from public.batches b where b.id = p_batch_id for update;
  if not found then
    raise exception 'That batch does not exist.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.job_packets j where j.batch_id = p_batch_id and j.revoked_at is null) then
    raise exception 'This batch already has a factory link. Send it again or revoke it.'
      using errcode = 'P0001', hint = 'packet_exists';
  end if;
  return query
    insert into public.job_packets as j (batch_id, token_hash, created_by, expires_at)
    values (p_batch_id, private.job_packet_hash(p_token), p_actor, now() + make_interval(days => p_days))
    returning j.id, j.expires_at;
end;
$$;

-- Gives a packet a new token and a new expiry. The old address opens nothing from now on. The packet must be
-- the one ops is looking at, so a mistyped id can never renew another batch's link under this batch's message.
create function public.resend_job_packet(p_actor uuid, p_batch_id uuid, p_packet_id uuid, p_token text, p_days integer)
returns table (id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_packet public.job_packets;
begin
  perform private.require_ops_actor(p_actor);
  perform private.job_packet_check_input(p_token, p_days);
  select * into v_packet from public.job_packets j where j.id = p_packet_id and j.batch_id = p_batch_id for update;
  if not found then
    raise exception 'That factory link does not exist.' using errcode = 'P0002';
  end if;
  if v_packet.revoked_at is not null then
    raise exception 'That factory link was revoked. Make a new one.' using errcode = 'P0001', hint = 'packet_revoked';
  end if;
  return query
    update public.job_packets j
    set token_hash = private.job_packet_hash(p_token),
        expires_at = now() + make_interval(days => p_days),
        sent_count = j.sent_count + 1,
        last_sent_at = now()
    where j.id = p_packet_id
    returning j.id, j.expires_at;
end;
$$;

-- Stops a packet working. Revoking a revoked packet changes nothing.
create function public.revoke_job_packet(p_actor uuid, p_batch_id uuid, p_packet_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  update public.job_packets j
  set revoked_at = coalesce(j.revoked_at, now())
  where j.id = p_packet_id and j.batch_id = p_batch_id;
  if not found then
    raise exception 'That factory link does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- The batch a token opens, and nothing for any other token.
create function public.open_job_packet(p_token text)
returns table (packet_id uuid, batch_id uuid, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.batch_id, j.expires_at from private.open_job_packet(p_token) j where j.id is not null;
$$;

-- The most photos, and the most events of any kind, one packet takes.
create function private.job_packet_limits()
returns table (photos integer, events integer)
language sql
immutable
set search_path = ''
as $$ select 200, 1000 $$;

-- The step the factory recorded last for a batch, or null.
create function private.job_packet_last_step(p_batch_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.kind from public.factory_events e
  where e.batch_id = p_batch_id and e.kind in ('received', 'in_production', 'ready_for_qc')
  order by e.at desc, e.id desc
  limit 1;
$$;

-- Records what the factory pressed or wrote. A step moves on, one at a time, every order of the batch that
-- stands at the step before it, and writes each order's history as the ops console does, with no actor:
--   received      batched        -> received
--   in_production received       -> in_production
--   ready_for_qc  in_production  -> ready
-- lib/job-packet/steps.ts holds the same table and the tests hold the two to each other.
create function public.job_packet_record(p_token text, p_kind text, p_note text default '', p_photo_key text default null)
returns table (event_id uuid, at timestamptz, orders_moved integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_packet public.job_packets;
  v_note text := btrim(coalesce(p_note, ''));
  v_last text;
  v_from text;
  v_to text;
  v_moved integer := 0;
  v_limits record;
begin
  v_packet := private.open_job_packet(p_token);
  if v_packet.id is null then
    raise exception 'That link does not exist.' using errcode = 'P0002';
  end if;
  if p_kind is null or p_kind not in ('received', 'in_production', 'ready_for_qc', 'note', 'photo') then
    raise exception 'That is not something a factory can record.' using errcode = '22023';
  end if;
  if length(v_note) > 1000 or (p_kind = 'note' and length(v_note) = 0) then
    raise exception 'A note has 1 to 1000 characters.' using errcode = '22023', hint = 'invalid_note';
  end if;
  if (p_kind = 'photo') <> (p_photo_key is not null)
     or (p_photo_key is not null and p_photo_key !~ ('^job-packets/' || v_packet.id::text || '/[0-9a-f-]{36}\.(jpg|png)$')) then
    raise exception 'A photo is stored under its own packet.' using errcode = '22023';
  end if;

  -- One batch at a time, so two presses cannot both pass the step check or the counts below.
  perform 1 from public.batches b where b.id = v_packet.batch_id for update;

  select * into v_limits from private.job_packet_limits();
  if (select count(*) from public.factory_events e where e.packet_id = v_packet.id) >= v_limits.events
     or (p_kind = 'photo' and (select count(*) from public.factory_events e where e.packet_id = v_packet.id and e.kind = 'photo') >= v_limits.photos) then
    raise exception 'This link has taken as much as it can. Ask Knitwright for a new one.'
      using errcode = 'P0001', hint = 'packet_full';
  end if;

  if p_kind in ('received', 'in_production', 'ready_for_qc') then
    v_last := private.job_packet_last_step(v_packet.batch_id);
    if not ((p_kind = 'received' and v_last is null)
         or (p_kind = 'in_production' and v_last = 'received')
         or (p_kind = 'ready_for_qc' and v_last = 'in_production')) then
      raise exception 'The steps go one at a time: received, in production, ready for QC.'
        using errcode = 'P0001', hint = 'illegal_step';
    end if;
    v_from := case p_kind when 'received' then 'batched' when 'in_production' then 'received' else 'in_production' end;
    v_to := case p_kind when 'ready_for_qc' then 'ready' else p_kind end;

    with moved as (
      update public.ops_orders o
      set status = v_to, updated_at = now()
      where o.batch_id = v_packet.batch_id and o.status = v_from
      returning o.id, o.brand_id, o.promised_on
    )
    insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, batch_id, promised_on, note, actor)
    select m.id, m.brand_id, v_to, v_from, v_to, v_packet.batch_id, m.promised_on, 'Marked by the factory through its job packet.', null
    from moved m;
    get diagnostics v_moved = row_count;
  end if;

  return query
    insert into public.factory_events as e (packet_id, batch_id, kind, note, photo_keys, orders_moved)
    values (
      v_packet.id, v_packet.batch_id, p_kind, v_note,
      case when p_photo_key is null then '{}'::text[] else array[p_photo_key] end,
      v_moved
    )
    returning e.id, e.at, e.orders_moved;
end;
$$;

-- Only the server's own key may run these. A browser, signed in or not, is refused.
revoke all on function public.create_job_packet(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.resend_job_packet(uuid, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.revoke_job_packet(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.open_job_packet(text) from public, anon, authenticated;
revoke all on function public.job_packet_record(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_job_packet(uuid, uuid, text, integer) to service_role;
grant execute on function public.resend_job_packet(uuid, uuid, uuid, text, integer) to service_role;
grant execute on function public.revoke_job_packet(uuid, uuid, uuid) to service_role;
grant execute on function public.open_job_packet(text) to service_role;
grant execute on function public.job_packet_record(text, text, text, text) to service_role;

revoke all on function private.factory_events_refuse_change() from public, anon, authenticated;
revoke all on function private.job_packet_hash(text) from public, anon, authenticated;
revoke all on function private.open_job_packet(text) from public, anon, authenticated;
revoke all on function private.job_packet_check_input(text, integer) from public, anon, authenticated;
revoke all on function private.job_packet_limits() from public, anon, authenticated;
revoke all on function private.job_packet_last_step(uuid) from public, anon, authenticated;
