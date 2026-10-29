-- Moderation and IP basics (plan v5, workstream X8; decision 0073; spec F-G1).
--
-- Three tables, all read by platform admins only and written only by the server through the functions below:
--   moderation_checks     one row per screening (an upload, a text, a design version, a generation, an order), with the automatic
--                         result and, once a person has looked, their decision. The automatic result never changes; the decision is
--                         set once.
--   rights_holder_marks   the registry of protected marks: a name and/or a perceptual hash of the mark's picture. The rows with
--                         source 'knitwright-default' are a short starting list, labelled as such, not a licensed registry.
--   takedown_notices      reports from rights holders through the public form, and ops' decision. An upheld notice names the brand
--                         and carries that brand's strike number (the repeat-infringer count) at the time.
-- Brands and design versions are named by id; only brand_id is a foreign key, so this file merges in any order with wave 1.

create table public.moderation_checks (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  brand_id uuid not null references public.brands (id) on delete cascade,
  target_kind text not null check (target_kind in ('asset', 'text', 'version', 'generation')),
  -- The checked thing's id. Null when nothing was kept (an upload refused before it was stored, a title that was never saved).
  target_id uuid,
  hook text not null check (hook in ('upload', 'text', 'generation', 'order', 'review')),
  -- What a reviewer reads: the file's label or the words themselves.
  label text not null default '' check (length(label) <= 500),
  subject_sha256 text check (subject_sha256 is null or subject_sha256 ~ '^[0-9a-f]{64}$'),
  result text not null check (result in ('clear', 'flagged', 'blocked')),
  -- [{ code, severity (note|flag|block), message, ruleId, term? }], at most 20. The result is the worst severity.
  reasons jsonb not null default '[]'
    check (jsonb_typeof(reasons) = 'array' and jsonb_array_length(reasons) <= 20 and pg_column_size(reasons) < 20000),
  decision text check (decision in ('allowed', 'blocked')),
  decision_reason text check (decision_reason is null or length(btrim(decision_reason)) between 1 and 500),
  reviewer uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint moderation_checks_decision_whole check (
    (decision is null and decision_reason is null and reviewed_at is null)
    or (decision is not null and decision_reason is not null and reviewed_at is not null)
  )
);

comment on table public.moderation_checks is
  'F-G1 screening results. Written by moderation_record and moderation_review only; read by platform admins.';

create index moderation_checks_queue_idx on public.moderation_checks (created_at) where decision is null and result <> 'clear';
create index moderation_checks_target_idx on public.moderation_checks (target_kind, target_id, seq);
create index moderation_checks_brand_idx on public.moderation_checks (brand_id, created_at desc);

create table public.rights_holder_marks (
  id uuid primary key default gen_random_uuid(),
  holder text not null check (length(btrim(holder)) between 1 and 200),
  mark_text text check (mark_text is null or length(btrim(mark_text)) between 2 and 120),
  -- A 128-bit perceptual hash of the mark's picture, as 32 hex digits (lib/moderation/image-hash.ts). The picture itself is
  -- never kept.
  image_hash text check (image_hash is null or image_hash ~ '^[0-9a-f]{32}$'),
  contact text not null default '' check (length(contact) <= 320),
  source text not null check (source in ('knitwright-default', 'rights-holder', 'ops')),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint rights_holder_marks_has_a_mark check (mark_text is not null or image_hash is not null)
);

comment on table public.rights_holder_marks is
  'Protected marks screened against (F-G1). source knitwright-default rows are a labelled starting list, not a licensed registry.';

create unique index rights_holder_marks_text_idx on public.rights_holder_marks (lower(btrim(mark_text))) where mark_text is not null;

create table public.takedown_notices (
  id uuid primary key default gen_random_uuid(),
  reporter_name text not null check (length(btrim(reporter_name)) between 1 and 200),
  reporter_email text not null check (length(reporter_email) between 3 and 320 and position('@' in reporter_email) > 1),
  holder text not null check (length(btrim(holder)) between 1 and 200),
  mark text not null check (length(btrim(mark)) between 1 and 200),
  -- Where the reporter saw it: a link or a product name. Kept as text, never fetched.
  location text not null check (length(btrim(location)) between 1 and 500),
  details text not null default '' check (length(details) <= 2000),
  status text not null default 'received' check (status in ('received', 'upheld', 'rejected')),
  brand_id uuid references public.brands (id) on delete set null,
  -- The brand's number of upheld notices, this one included, when it was upheld.
  strike_number integer check (strike_number is null or strike_number >= 1),
  decision_note text check (decision_note is null or length(btrim(decision_note)) between 1 and 500),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint takedown_notices_decided_whole check (
    (status = 'received' and decision_note is null and decided_at is null and strike_number is null)
    or (status <> 'received' and decision_note is not null and decided_at is not null)
  ),
  constraint takedown_notices_upheld_names_brand check (status <> 'upheld' or strike_number is not null)
);

comment on table public.takedown_notices is
  'Rights-holder reports (F-G1 notice and takedown). Written by takedown_submit and takedown_decide; read by platform admins.';

create index takedown_notices_open_idx on public.takedown_notices (created_at) where status = 'received';
create index takedown_notices_brand_idx on public.takedown_notices (brand_id) where status = 'upheld';

-- The automatic result is never changed; the decision is set once. A delete is let through only when the brand is gone.
create function private.guard_moderation_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- The columns a decision and a deleted account may touch. Everything else is the screening itself, and never changes.
  v_mutable constant text[] := array['decision', 'decision_reason', 'reviewer', 'reviewed_at', 'created_by'];
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.brands b where b.id = old.brand_id) then
      return old;
    end if;
    raise exception 'A moderation check can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
  end if;
  if (to_jsonb(new) - v_mutable) is distinct from (to_jsonb(old) - v_mutable) then
    raise exception 'A moderation check can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
  end if;
  -- A decision is made once, and never unmade.
  if old.decision is not null
     and (new.decision, new.decision_reason, new.reviewed_at) is distinct from (old.decision, old.decision_reason, old.reviewed_at) then
    raise exception 'A moderation check can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
  end if;
  -- A deleted account's id is cleared from these columns by the foreign keys, which is an update. Clearing is all they may do:
  -- the row may never be made to name somebody else.
  if (new.created_by is distinct from old.created_by and new.created_by is not null)
     or (new.reviewer is distinct from old.reviewer and new.reviewer is not null and old.reviewer is not null) then
    raise exception 'A moderation check can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_moderation_check() from public, anon, authenticated;

create trigger moderation_checks_are_append_only
  before update or delete on public.moderation_checks
  for each row execute function private.guard_moderation_check();

-- A row trigger never sees a truncate, so the table needs its own refusal (same idiom as spec_versions).
create function private.refuse_moderation_truncate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'A moderation check can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_moderation_truncate() from public, anon, authenticated;

create trigger moderation_checks_are_not_truncated
  before truncate on public.moderation_checks
  for each statement execute function private.refuse_moderation_truncate();

create trigger takedown_notices_are_not_truncated
  before truncate on public.takedown_notices
  for each statement execute function private.refuse_moderation_truncate();

revoke all on public.moderation_checks, public.rights_holder_marks, public.takedown_notices
  from public, anon, authenticated, service_role;
grant select on public.moderation_checks, public.rights_holder_marks, public.takedown_notices to authenticated, service_role;

alter table public.moderation_checks enable row level security;
alter table public.rights_holder_marks enable row level security;
alter table public.takedown_notices enable row level security;

create policy "platform admins read moderation checks"
  on public.moderation_checks for select to authenticated using (private.is_platform_admin());
create policy "platform admins read rights holder marks"
  on public.rights_holder_marks for select to authenticated using (private.is_platform_admin());
create policy "platform admins read takedown notices"
  on public.takedown_notices for select to authenticated using (private.is_platform_admin());

-- There are no insert, update or delete policies, on purpose.

-- Keeps one screening result. The caller (the server) has already decided the result; the database checks its shape and that the
-- person belongs to the brand, when a person is named.
create function public.moderation_record(
  p_brand_id uuid,
  p_user_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_hook text,
  p_label text,
  p_subject_sha256 text,
  p_result text,
  p_reasons jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_expected text;
begin
  if p_user_id is not null and not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  -- coalesce, because jsonb_typeof of a missing key is null, and `null <> 'string'` is null, not true: a reason with no code
  -- at all would otherwise pass this check.
  if p_reasons is null or jsonb_typeof(p_reasons) <> 'array'
     or exists (select 1 from jsonb_array_elements(p_reasons) r
                where coalesce(jsonb_typeof(r), '') <> 'object'
                   or coalesce(jsonb_typeof(r -> 'code'), '') <> 'string'
                   or coalesce(jsonb_typeof(r -> 'message'), '') <> 'string'
                   or coalesce(jsonb_typeof(r -> 'ruleId'), '') <> 'string') then
    raise exception 'Reasons must be a list of { code, message, ruleId }.' using errcode = '22023', hint = 'invalid_input';
  end if;
  v_expected := case
    when exists (select 1 from jsonb_array_elements(p_reasons) r where r ->> 'severity' = 'block') then 'blocked'
    when exists (select 1 from jsonb_array_elements(p_reasons) r where r ->> 'severity' = 'flag') then 'flagged'
    else 'clear' end;
  if p_result is distinct from v_expected then
    raise exception 'The result does not match the reasons.' using errcode = '22023', hint = 'invalid_input';
  end if;

  insert into public.moderation_checks
    (brand_id, target_kind, target_id, hook, label, subject_sha256, result, reasons, created_by)
  values
    (p_brand_id, p_target_kind, p_target_id, p_hook, left(coalesce(p_label, ''), 500), p_subject_sha256, p_result, p_reasons, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- A person's decision on a flagged or blocked check. Platform admins only; a reason is required; a check is decided once.
create function public.moderation_review(
  p_actor uuid,
  p_check_id uuid,
  p_decision text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.moderation_checks;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform private.require_ops_actor(p_actor);
  select * into c from public.moderation_checks where id = p_check_id for update;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if c.decision is not null then
    raise exception 'This item has already been decided.' using errcode = '22023', hint = 'invalid_transition';
  end if;
  if c.result = 'clear' then
    raise exception 'A clear item has nothing to review.' using errcode = '22023', hint = 'invalid_transition';
  end if;
  if p_decision not in ('allowed', 'blocked') then
    raise exception 'Choose allow or block.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if length(v_reason) not between 1 and 500 then
    raise exception 'Give a reason, up to 500 characters.' using errcode = '22023', hint = 'reason_needed';
  end if;
  update public.moderation_checks
  set decision = p_decision, decision_reason = v_reason, reviewer = p_actor, reviewed_at = now()
  where id = p_check_id;
end;
$$;

-- True only when a person has allowed the target and nothing about it has been flagged, blocked or refused since. Class B runs
-- (and the first order of a storefront product) call this before they start (spec F-G1).
create function public.moderation_human_allowed(p_target_kind text, p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select max(c.seq) as seq from public.moderation_checks c
    where c.target_kind = p_target_kind and c.target_id = p_target_id and c.decision = 'allowed'
  )
  select a.seq is not null
     and not exists (
       select 1 from public.moderation_checks c
       where c.target_kind = p_target_kind and c.target_id = p_target_id and c.seq > a.seq
         and (c.decision = 'blocked' or (c.decision is null and c.result <> 'clear'))
     )
  from allowed a;
$$;

-- Ops adds a mark to the registry, by name, by picture hash, or both.
create function public.rights_mark_add(
  p_actor uuid,
  p_holder text,
  p_mark_text text,
  p_image_hash text,
  p_contact text,
  p_source text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_ops_actor(p_actor);
  if p_source not in ('rights-holder', 'ops') then
    raise exception 'Say where the mark came from.' using errcode = '22023', hint = 'invalid_input';
  end if;
  insert into public.rights_holder_marks (holder, mark_text, image_hash, contact, source, created_by)
  values (btrim(p_holder), nullif(btrim(coalesce(p_mark_text, '')), ''), nullif(p_image_hash, ''), btrim(coalesce(p_contact, '')), p_source, p_actor)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.rights_mark_set_active(p_actor uuid, p_mark_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  update public.rights_holder_marks set active = p_active where id = p_mark_id;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- A report from the public form. The server checks the bot check and the rate limit first.
create function public.takedown_submit(
  p_reporter_name text,
  p_reporter_email text,
  p_holder text,
  p_mark text,
  p_location text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.takedown_notices (reporter_name, reporter_email, holder, mark, location, details)
  values (btrim(p_reporter_name), lower(btrim(p_reporter_email)), btrim(p_holder), btrim(p_mark), btrim(p_location), btrim(coalesce(p_details, '')))
  returning id into v_id;
  return v_id;
end;
$$;

-- Ops upholds or rejects a notice. Upholding names the brand and gives it its next strike number.
create function public.takedown_decide(
  p_actor uuid,
  p_notice_id uuid,
  p_status text,
  p_brand_id uuid,
  p_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.takedown_notices;
  v_note text := btrim(coalesce(p_note, ''));
  v_strike integer := null;
begin
  perform private.require_ops_actor(p_actor);
  select * into n from public.takedown_notices where id = p_notice_id for update;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if n.status <> 'received' then
    raise exception 'This notice has already been decided.' using errcode = '22023', hint = 'invalid_transition';
  end if;
  if p_status not in ('upheld', 'rejected') then
    raise exception 'Choose uphold or reject.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if length(v_note) not between 1 and 500 then
    raise exception 'Give a reason, up to 500 characters.' using errcode = '22023', hint = 'reason_needed';
  end if;
  if p_status = 'upheld' then
    if p_brand_id is null or not exists (select 1 from public.brands b where b.id = p_brand_id) then
      raise exception 'Name the brand the notice is about.' using errcode = '22023', hint = 'invalid_input';
    end if;
    -- One strike counter per brand: serialise decisions for the same brand.
    perform pg_advisory_xact_lock(hashtextextended('takedown:' || p_brand_id::text, 0));
    select count(*) + 1 into v_strike from public.takedown_notices t where t.brand_id = p_brand_id and t.status = 'upheld';
  end if;
  update public.takedown_notices
  set status = p_status,
      brand_id = case when p_status = 'upheld' then p_brand_id else null end,
      strike_number = v_strike,
      decision_note = v_note,
      decided_by = p_actor,
      decided_at = now()
  where id = p_notice_id;
  return v_strike;
end;
$$;

revoke all on function public.moderation_record(uuid, uuid, text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.moderation_review(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.moderation_human_allowed(text, uuid) from public, anon, authenticated;
revoke all on function public.rights_mark_add(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.rights_mark_set_active(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.takedown_submit(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.takedown_decide(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.moderation_record(uuid, uuid, text, uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.moderation_review(uuid, uuid, text, text) to service_role;
grant execute on function public.moderation_human_allowed(text, uuid) to service_role;
grant execute on function public.rights_mark_add(uuid, text, text, text, text, text) to service_role;
grant execute on function public.rights_mark_set_active(uuid, uuid, boolean) to service_role;
grant execute on function public.takedown_submit(text, text, text, text, text, text) to service_role;
grant execute on function public.takedown_decide(uuid, uuid, text, uuid, text) to service_role;

-- A short starting list of third-party brand and competition names, so a title like "Nike dupe" is caught on day one. A Knitwright
-- default, not a licensed registry: rights holders and ops add to it, and ops can switch any row off.
insert into public.rights_holder_marks (holder, mark_text, source) values
  ('Nike, Inc.', 'Nike', 'knitwright-default'),
  ('adidas AG', 'Adidas', 'knitwright-default'),
  ('PUMA SE', 'Puma', 'knitwright-default'),
  ('Under Armour, Inc.', 'Under Armour', 'knitwright-default'),
  ('New Balance Athletics, Inc.', 'New Balance', 'knitwright-default'),
  ('Reebok International', 'Reebok', 'knitwright-default'),
  ('Umbro', 'Umbro', 'knitwright-default'),
  ('BasicNet (Kappa)', 'Kappa', 'knitwright-default'),
  ('Lululemon Athletica', 'Lululemon', 'knitwright-default'),
  ('Gymshark', 'Gymshark', 'knitwright-default'),
  ('The Arsenal Football Club', 'Arsenal', 'knitwright-default'),
  ('Chelsea FC', 'Chelsea FC', 'knitwright-default'),
  ('Manchester United', 'Manchester United', 'knitwright-default'),
  ('Real Madrid CF', 'Real Madrid', 'knitwright-default'),
  ('Juventus FC', 'Juventus', 'knitwright-default'),
  ('The Football Association Premier League', 'Premier League', 'knitwright-default'),
  ('FIFA', 'FIFA', 'knitwright-default'),
  ('UEFA', 'UEFA', 'knitwright-default');
