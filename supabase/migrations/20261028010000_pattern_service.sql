-- Pattern service requests (plan v4, workstream W4-A; decision 0060).
--
-- For a garment with no pattern block, a brand can send the design to the Sialkot team, who draft the pattern and send files back
-- as a paid service. This migration holds the request, its append-only history and the functions that move it. It sells nothing:
-- the price is a number of credits copied from the platform settings when the request is made, and no price means no charge.
--
-- A request is one per saved design version. It keeps a snapshot of the design and its hash, and names the project and the files by
-- id with no foreign key, so migrations merge in any order. Only the server writes, through the functions below, which only the
-- server's own key may run; members read their brand's requests and platform admins read all of them.

create table public.pattern_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- The design and its saved version. Not foreign keys, on purpose.
  project_id uuid not null,
  design_version integer not null check (design_version >= 1),
  article_id text not null check (length(btrim(article_id)) between 1 and 120),
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'in_progress', 'delivered', 'declined')),
  -- The design as saved (lib/pattern-service/snapshot.ts) and its sha256. Immutable.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 1000000),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  -- Copied from the platform settings at request time. Null is "not set": nothing was promised or charged.
  quoted_price_credits integer check (quoted_price_credits is null or quoted_price_credits between 0 and 100000),
  quoted_turnaround_days integer check (quoted_turnaround_days is null or quoted_turnaround_days between 1 and 365),
  -- The credits line this request paid, when it paid one. Not a foreign key.
  spend_entry_id uuid,
  decline_reason text check (decline_reason is null or length(btrim(decline_reason)) between 1 and 500),
  -- Delivered DXF files (files.id, kind pattern-source), in the order they were attached.
  file_ids jsonb not null default '[]' check (jsonb_typeof(file_ids) = 'array' and jsonb_array_length(file_ids) <= 20),
  -- Set when a technician has reviewed the delivered files. Until then they are shown as not reviewed.
  reviewed_by text check (reviewed_by is null or length(btrim(reviewed_by)) between 1 and 120),
  reviewed_on date,
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, design_version),
  constraint pattern_requests_decline_has_reason check ((status = 'declined') = (decline_reason is not null)),
  constraint pattern_requests_delivered_has_files check (status <> 'delivered' or jsonb_array_length(file_ids) >= 1),
  constraint pattern_requests_review_pair check ((reviewed_by is null) = (reviewed_on is null))
);

comment on table public.pattern_requests is
  'A brand''s request to the Sialkot team for a pattern, one per design version. Written by the pattern_request_* functions only.';

create index pattern_requests_brand_idx on public.pattern_requests (brand_id, created_at desc);
create index pattern_requests_queue_idx on public.pattern_requests (created_at) where status in ('requested', 'accepted', 'in_progress');

create table public.pattern_request_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  request_id uuid not null references public.pattern_requests (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  kind text not null
    check (kind in ('requested', 'accepted', 'in_progress', 'delivered', 'declined', 'files_attached', 'reviewed')),
  from_status text,
  to_status text not null,
  note text not null default '' check (length(note) <= 500),
  -- Null when the brand made the request.
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

comment on table public.pattern_request_events is
  'Status history of a pattern request. Append-only; the delete is let through only when the brand itself is deleted.';

create index pattern_request_events_idx on public.pattern_request_events (request_id, seq);

create function private.refuse_pattern_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and not exists (select 1 from public.brands b where b.id = old.brand_id) then
    return old;
  end if;
  raise exception 'Pattern request history can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_pattern_event_change() from public, anon, authenticated;

create trigger pattern_request_events_are_append_only
  before update or delete on public.pattern_request_events
  for each row execute function private.refuse_pattern_event_change();

create trigger pattern_request_events_are_not_truncated
  before truncate on public.pattern_request_events
  for each statement execute function private.refuse_pattern_event_change();

revoke all on public.pattern_requests, public.pattern_request_events
  from public, anon, authenticated, service_role;
grant select on public.pattern_requests, public.pattern_request_events to authenticated, service_role;

alter table public.pattern_requests enable row level security;
alter table public.pattern_request_events enable row level security;

create policy "admins and members read pattern requests"
  on public.pattern_requests for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));

create policy "admins and members read pattern request history"
  on public.pattern_request_events for select to authenticated
  using (private.is_platform_admin() or private.is_member(brand_id));

-- There are no insert, update or delete policies on either table, on purpose.

-- Makes a request, and takes the credits for it when p_charge is true and the quote has a price above 0.
-- One request per design version: asking again answers with the one already there (created = false) and charges nothing.
-- Returns { ok: true, created, request_id, charged, balance } or { ok: false, reason: 'insufficient', price, balance }.
create function public.pattern_request_create(
  p_brand_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_design_version integer,
  p_article_id text,
  p_snapshot jsonb,
  p_snapshot_hash text,
  p_price_credits integer,
  p_turnaround_days integer,
  p_charge boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
  v_id uuid;
  v_balance bigint;
  v_spend uuid := null;
  v_key text := 'spend:pattern_service:' || p_snapshot_hash;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.projects pr where pr.id = p_project_id and pr.brand_id = p_brand_id
                   and p_design_version between 1 and pr.current_version) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;

  perform private.credit_lock(p_brand_id);

  select r.id into v_existing from public.pattern_requests r
  where r.project_id = p_project_id and r.design_version = p_design_version;
  if found then
    return jsonb_build_object('ok', true, 'created', false, 'request_id', v_existing, 'charged', false,
                              'balance', private.credit_balance(p_brand_id));
  end if;

  v_balance := private.credit_balance(p_brand_id);
  v_id := gen_random_uuid();

  if p_charge and p_price_credits is not null and p_price_credits > 0 then
    if v_balance < p_price_credits then
      return jsonb_build_object('ok', false, 'reason', 'insufficient', 'price', p_price_credits, 'balance', v_balance);
    end if;
    -- The line is named by the request's own hash, not the design version's, so it is not given back when the design is ordered:
    -- this pays for the team's work.
    insert into public.credit_ledger
      (brand_id, kind, amount, output_kind, design_version_hash, idempotency_key, note, created_by)
    values
      (p_brand_id, 'spend', -p_price_credits, 'pattern_file', p_snapshot_hash, v_key, 'Pattern service request', p_user_id)
    returning id into v_spend;
    v_balance := v_balance - p_price_credits;
  end if;

  insert into public.pattern_requests
    (id, brand_id, project_id, design_version, article_id, snapshot, snapshot_hash,
     quoted_price_credits, quoted_turnaround_days, spend_entry_id, requested_by)
  values
    (v_id, p_brand_id, p_project_id, p_design_version, p_article_id, p_snapshot, p_snapshot_hash,
     p_price_credits, p_turnaround_days, v_spend, p_user_id);

  insert into public.pattern_request_events (request_id, brand_id, kind, from_status, to_status, note, actor)
  values (v_id, p_brand_id, 'requested', null, 'requested', '', p_user_id);

  return jsonb_build_object('ok', true, 'created', true, 'request_id', v_id, 'charged', v_spend is not null, 'balance', v_balance);
end;
$$;

-- Moves a request one step. Platform admins only (the actor is checked here). A decline needs a reason and gives back what the
-- request paid. Delivering needs at least one attached file.
create function public.pattern_request_move(
  p_actor uuid,
  p_request_id uuid,
  p_to text,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.pattern_requests;
  v_spend public.credit_ledger;
  v_note text := btrim(coalesce(p_note, ''));
begin
  perform private.require_ops_actor(p_actor);
  select * into r from public.pattern_requests where id = p_request_id for update;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if not ((r.status = 'requested' and p_to in ('accepted', 'declined'))
       or (r.status = 'accepted' and p_to in ('in_progress', 'declined'))
       or (r.status = 'in_progress' and p_to in ('delivered', 'declined'))) then
    raise exception 'A request that is % cannot become %.', r.status, p_to using errcode = '22023', hint = 'invalid_transition';
  end if;
  if p_to = 'declined' and length(v_note) = 0 then
    raise exception 'Say why the request is declined.' using errcode = '22023', hint = 'reason_needed';
  end if;
  if p_to = 'delivered' and jsonb_array_length(r.file_ids) = 0 then
    raise exception 'Attach the pattern files before delivering.' using errcode = '22023', hint = 'files_needed';
  end if;

  if p_to = 'declined' and r.spend_entry_id is not null then
    perform private.credit_lock(r.brand_id);
    select * into v_spend from public.credit_ledger where id = r.spend_entry_id;
    insert into public.credit_ledger
      (brand_id, kind, amount, output_kind, design_version_hash, refund_of, idempotency_key, note)
    values
      (v_spend.brand_id, 'refund', -v_spend.amount, v_spend.output_kind, v_spend.design_version_hash, v_spend.id,
       'refund:' || v_spend.id, 'Pattern service request declined')
    on conflict (brand_id, idempotency_key) do nothing;
  end if;

  update public.pattern_requests
  set status = p_to,
      decline_reason = case when p_to = 'declined' then left(v_note, 500) else decline_reason end,
      updated_at = now()
  where id = p_request_id;

  insert into public.pattern_request_events (request_id, brand_id, kind, from_status, to_status, note, actor)
  values (r.id, r.brand_id, p_to, r.status, p_to, left(v_note, 500), p_actor);
end;
$$;

-- Attaches delivered DXF files while the request is being drafted. The files must be this brand's, of kind pattern-source.
create function public.pattern_request_attach_files(
  p_actor uuid,
  p_request_id uuid,
  p_file_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.pattern_requests;
  v_known integer;
begin
  perform private.require_ops_actor(p_actor);
  select * into r from public.pattern_requests where id = p_request_id for update;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if r.status <> 'in_progress' then
    raise exception 'Files can be attached while the request is being drafted.' using errcode = '22023', hint = 'invalid_transition';
  end if;
  if p_file_ids is null or cardinality(p_file_ids) not between 1 and 10 then
    raise exception 'Attach 1 to 10 files.' using errcode = '22023', hint = 'invalid_input';
  end if;
  select count(*) into v_known from public.files f
  where f.id = any (p_file_ids) and f.brand_id = r.brand_id and f.kind = 'pattern-source';
  if v_known <> (select count(distinct x) from unnest(p_file_ids) x) then
    raise exception 'Those files are not pattern files of this brand.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if jsonb_array_length(r.file_ids) + cardinality(p_file_ids) > 20 then
    raise exception 'A request holds at most 20 files.' using errcode = '22023', hint = 'invalid_input';
  end if;

  update public.pattern_requests
  set file_ids = r.file_ids || (
        select coalesce(jsonb_agg(to_jsonb(d.f::text)), '[]'::jsonb)
        from (select distinct u.f from unnest(p_file_ids) as u (f)) d
        where not (r.file_ids ? d.f::text)
      ),
      updated_at = now()
  where id = r.id;

  insert into public.pattern_request_events (request_id, brand_id, kind, from_status, to_status, note, actor)
  values (r.id, r.brand_id, 'files_attached', r.status, r.status, cardinality(p_file_ids)::text || ' file(s)', p_actor);
end;
$$;

-- Records that a technician reviewed the delivered files. Until then the brand sees them as not reviewed.
create function public.pattern_request_mark_reviewed(
  p_actor uuid,
  p_request_id uuid,
  p_reviewer_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.pattern_requests;
  v_name text := btrim(coalesce(p_reviewer_name, ''));
begin
  perform private.require_ops_actor(p_actor);
  select * into r from public.pattern_requests where id = p_request_id for update;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if r.status <> 'delivered' then
    raise exception 'Only delivered files can be marked reviewed.' using errcode = '22023', hint = 'invalid_transition';
  end if;
  if length(v_name) not between 1 and 120 then
    raise exception 'Give the reviewer''s name.' using errcode = '22023', hint = 'invalid_input';
  end if;

  update public.pattern_requests
  set reviewed_by = v_name, reviewed_on = (now() at time zone 'UTC')::date, updated_at = now()
  where id = r.id;

  insert into public.pattern_request_events (request_id, brand_id, kind, from_status, to_status, note, actor)
  values (r.id, r.brand_id, 'reviewed', r.status, r.status, 'Reviewed by ' || v_name, p_actor);
end;
$$;

revoke all on function public.pattern_request_create(uuid, uuid, uuid, integer, text, jsonb, text, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.pattern_request_move(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.pattern_request_attach_files(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.pattern_request_mark_reviewed(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.pattern_request_create(uuid, uuid, uuid, integer, text, jsonb, text, integer, integer, boolean) to service_role;
grant execute on function public.pattern_request_move(uuid, uuid, text, text) to service_role;
grant execute on function public.pattern_request_attach_files(uuid, uuid, uuid[]) to service_role;
grant execute on function public.pattern_request_mark_reviewed(uuid, uuid, text) to service_role;
