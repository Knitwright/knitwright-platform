-- Designer templates and the royalty ledger (plan v4, workstream W4-B, decision 0061).
--
-- A person opts in as a designer, offers a design as a template with a rights attestation, and a
-- platform admin accepts or rejects it. An accepted submission becomes a row in templates with source
-- 'designer' and the designer's name as attribution. When a design made from such a template is later
-- ordered, one line is added to the royalty ledger per release: the units, and what they accrue at the
-- rate in the platform setting designer.royalty_per_unit. While that setting is not set, or the order
-- carries no currency, the line records the units and accrues nothing. NO RATE IS EVER INVENTED.
--
-- Nothing here pays anyone. The payout state is a note the owner keeps by hand, as an append-only history.
-- No payment, no payout, no Stripe.
--
-- Only the server writes, through the functions below, which only the server's own key may run.
-- A designer reads their own profile, submissions, ledger lines and payout notes; platform admins read all.
-- Which brand used a template is never readable by a browser, and a ledger line holds counts, not names.
-- Nothing refers to another workstream's tables by key: a use names its project, and a ledger line its
-- order and release, by id, so migrations merge in any order.

create table public.designer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Shown as the attribution on a template.
  display_name text not null check (length(btrim(display_name)) between 1 and 80 and display_name = btrim(display_name)),
  created_at timestamptz not null default now()
);

comment on table public.designer_profiles is
  'People who opted in as designers. A designer reads their own row. Written by designer_enrol only.';

create table public.template_submissions (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.designer_profiles (user_id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120 and title = btrim(title)),
  sport text not null check (sport in ('football', 'cricket', 'running', 'training', 'general')),
  article_id text not null check (article_id ~ '^[a-z0-9-]{1,64}$'),
  wearer text not null check (wearer in ('men', 'women', 'youth')),
  style_tags text[] not null check (cardinality(style_tags) between 1 and 8),
  colour_family text not null check (colour_family in ('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white', 'grey')),
  -- The design offered, frozen when the submission is made. The server validates it against the registry.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 262144),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  rejection_reason text check (rejection_reason is null or length(btrim(rejection_reason)) between 1 and 500),
  -- The designer says they hold the rights to every artwork in the design.
  rights_attested boolean not null default false,
  rights_attested_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  -- The templates row made when the submission was accepted. Not a key, on purpose.
  template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submissions_rights_before_review check (
    status not in ('submitted', 'approved') or (rights_attested and rights_attested_at is not null)
  ),
  constraint submissions_rejection_has_reason check ((status = 'rejected') = (rejection_reason is not null)),
  constraint submissions_acceptance_has_template check ((status = 'approved') = (template_id is not null))
);

comment on table public.template_submissions is
  'A design offered as a template. A designer reads their own; platform admins read all. Written by functions only.';

create index template_submissions_designer_idx on public.template_submissions (designer_id, created_at desc);
create index template_submissions_queue_idx on public.template_submissions (created_at) where status = 'submitted';

-- A template can now carry a designer. A Knitwright template has neither; a designer template has both.
alter table public.templates
  add column designer_id uuid,
  add column attribution text check (attribution is null or length(btrim(attribution)) between 1 and 80);

alter table public.templates drop constraint templates_designer_source_is_off;
alter table public.templates add constraint templates_source_owner check (
  (source = 'knitwright' and designer_id is null and attribution is null)
  or (source = 'designer' and designer_id is not null and attribution is not null)
);

-- Which designer template a design was made from. Written when a member uses a designer template.
create table public.designer_template_uses (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  designer_id uuid not null references public.designer_profiles (user_id) on delete cascade,
  brand_id uuid not null,
  -- The design made from the template. One template per design.
  project_id uuid not null unique,
  created_at timestamptz not null default now()
);

comment on table public.designer_template_uses is
  'A design made from a designer template. Server only: no browser role reads it, so a designer never learns which brand used their work.';

create index designer_template_uses_designer_idx on public.designer_template_uses (designer_id);

-- The royalty ledger. One line per release ordered. Append-only.
create table public.royalty_accruals (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  designer_id uuid not null references public.designer_profiles (user_id) on delete cascade,
  template_id uuid not null,
  project_id uuid not null,
  order_id uuid not null unique,
  -- A release is accrued once, however many times the accrual runs.
  release_id uuid not null unique,
  units integer not null check (units >= 1),
  -- The rate in force, in the order's currency's smallest unit. Null when none was set.
  rate_minor bigint check (rate_minor is null or rate_minor between 0 and 1000000),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  accrued_minor bigint not null default 0 check (accrued_minor >= 0),
  created_at timestamptz not null default now(),
  constraint accrual_rate_has_currency check ((rate_minor is null) = (currency is null)),
  constraint accrual_is_units_times_rate check (accrued_minor = coalesce(rate_minor, 0) * units)
);

comment on table public.royalty_accruals is
  'What designers have earned, one line per release ordered. Append-only. Nothing is paid from here.';

create index royalty_accruals_designer_idx on public.royalty_accruals (designer_id, seq desc);

-- The owner's hand-kept note of where a designer's payout stands. The latest line is the state. Nothing moves money.
create table public.designer_payout_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  designer_id uuid not null references public.designer_profiles (user_id) on delete cascade,
  state text not null check (state in ('not_paid', 'on_hold', 'paid')),
  note text not null default '' check (length(note) <= 300),
  set_by uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

comment on table public.designer_payout_events is
  'Payout state notes, set by hand by a platform admin. Append-only. A note, not a payment.';

create index designer_payout_events_designer_idx on public.designer_payout_events (designer_id, seq desc);

create function private.refuse_designer_ledger_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Let a line go only with the designer's own account.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.designer_profiles p where p.user_id = old.designer_id) then
    return old;
  end if;
  raise exception 'A royalty ledger line can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_designer_ledger_change() from public, anon, authenticated;

create trigger royalty_accruals_are_append_only
  before update or delete on public.royalty_accruals
  for each row execute function private.refuse_designer_ledger_change();
create trigger royalty_accruals_are_not_truncated
  before truncate on public.royalty_accruals
  for each statement execute function private.refuse_designer_ledger_change();
create trigger designer_payout_events_are_append_only
  before update or delete on public.designer_payout_events
  for each row execute function private.refuse_designer_ledger_change();
create trigger designer_payout_events_are_not_truncated
  before truncate on public.designer_payout_events
  for each statement execute function private.refuse_designer_ledger_change();
create trigger designer_template_uses_are_append_only
  before update or delete on public.designer_template_uses
  for each row execute function private.refuse_designer_ledger_change();

-- Reads only. The server's key reads too; every write is a function below.
revoke all on public.designer_profiles, public.template_submissions, public.designer_template_uses,
  public.royalty_accruals, public.designer_payout_events
  from public, anon, authenticated, service_role;
grant select on public.designer_profiles, public.template_submissions, public.royalty_accruals,
  public.designer_payout_events to authenticated;
grant select on public.designer_profiles, public.template_submissions, public.designer_template_uses,
  public.royalty_accruals, public.designer_payout_events to service_role;

alter table public.designer_profiles enable row level security;
alter table public.template_submissions enable row level security;
alter table public.designer_template_uses enable row level security;
alter table public.royalty_accruals enable row level security;
alter table public.designer_payout_events enable row level security;

create policy "designers and platform admins read designer profiles"
  on public.designer_profiles for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());
create policy "designers and platform admins read template submissions"
  on public.template_submissions for select to authenticated
  using (designer_id = (select auth.uid()) or private.is_platform_admin());
create policy "designers and platform admins read royalty accruals"
  on public.royalty_accruals for select to authenticated
  using (designer_id = (select auth.uid()) or private.is_platform_admin());
create policy "designers and platform admins read payout notes"
  on public.designer_payout_events for select to authenticated
  using (designer_id = (select auth.uid()) or private.is_platform_admin());

-- designer_template_uses has no policy and no browser grant, on purpose. Nor does any table here have an
-- insert, update or delete policy.

create function private.designer_assert_admin(p_actor uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function private.designer_assert_admin(uuid) from public, anon, authenticated;

-- Opts a person in, or changes the name shown. Returns the user id.
create function public.designer_enrol(p_user_id uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 80 then
    raise exception 'A designer name is 1 to 80 characters.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  insert into public.designer_profiles (user_id, display_name)
  values (p_user_id, btrim(p_display_name))
  on conflict (user_id) do update set display_name = excluded.display_name;
  return p_user_id;
end;
$$;

-- Starts a submission as a draft. The design is validated by the server before it gets here.
create function public.template_submission_create(
  p_user_id uuid,
  p_title text,
  p_sport text,
  p_article_id text,
  p_wearer text,
  p_style_tags text[],
  p_colour_family text,
  p_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.designer_profiles p where p.user_id = p_user_id) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  insert into public.template_submissions
    (designer_id, title, sport, article_id, wearer, style_tags, colour_family, snapshot)
  values
    (p_user_id, btrim(p_title), p_sport, p_article_id, p_wearer, p_style_tags, p_colour_family, p_snapshot)
  returning id into v_id;
  return v_id;
end;
$$;

-- The designer offers a draft for review. They must say they hold the rights to every artwork in it.
create function public.template_submission_submit(p_user_id uuid, p_submission_id uuid, p_rights_attested boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select s.status into v_status from public.template_submissions s
  where s.id = p_submission_id and s.designer_id = p_user_id for update;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft can be offered.' using errcode = 'P0001', hint = 'not_a_draft';
  end if;
  if p_rights_attested is not true then
    raise exception 'Say that you hold the rights to every artwork in the design.' using errcode = 'P0001', hint = 'rights_required';
  end if;
  update public.template_submissions
  set status = 'submitted', rights_attested = true, rights_attested_at = now(), updated_at = now()
  where id = p_submission_id;
end;
$$;

-- Accepts a submission: a platform admin only. Adds the template, with the designer's name as attribution.
-- Returns the template id.
create function public.template_submission_approve(p_actor uuid, p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.template_submissions;
  v_name text;
  v_template uuid := gen_random_uuid();
begin
  perform private.designer_assert_admin(p_actor);
  select * into s from public.template_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if s.status <> 'submitted' then
    raise exception 'Only a submitted design can be accepted.' using errcode = 'P0001', hint = 'not_submitted';
  end if;
  if not s.rights_attested then
    raise exception 'The rights statement is missing.' using errcode = 'P0001', hint = 'rights_required';
  end if;
  select p.display_name into v_name from public.designer_profiles p where p.user_id = s.designer_id;
  insert into public.templates
    (id, slug, title, sport, article_id, wearer, style_tags, colour_family, snapshot, source, designer_id, attribution)
  values
    (v_template, 'designer-' || replace(v_template::text, '-', ''), s.title, s.sport, s.article_id, s.wearer,
     s.style_tags, s.colour_family, s.snapshot, 'designer', s.designer_id, v_name);
  update public.template_submissions
  set status = 'approved', template_id = v_template, reviewed_by = p_actor, reviewed_at = now(), updated_at = now()
  where id = p_submission_id;
  return v_template;
end;
$$;

-- Rejects a draft or a submission, with a reason. A platform admin only. Needs no rights statement.
create function public.template_submission_reject(p_actor uuid, p_submission_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform private.designer_assert_admin(p_actor);
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Give a reason of up to 500 characters.' using errcode = 'P0001', hint = 'reason_required';
  end if;
  select s.status into v_status from public.template_submissions s where s.id = p_submission_id for update;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if v_status not in ('draft', 'submitted') then
    raise exception 'That submission has already been decided.' using errcode = 'P0001', hint = 'already_decided';
  end if;
  update public.template_submissions
  set status = 'rejected', rejection_reason = btrim(p_reason), reviewed_by = p_actor, reviewed_at = now(), updated_at = now()
  where id = p_submission_id;
end;
$$;

-- Notes that a design was made from a designer template. Does nothing for a Knitwright template.
-- Returns true when a use was recorded.
create function public.designer_record_use(p_template_id uuid, p_brand_id uuid, p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_designer uuid;
  v_rows integer;
begin
  select t.designer_id into v_designer from public.templates t where t.id = p_template_id and t.source = 'designer';
  if not found then
    return false;
  end if;
  insert into public.designer_template_uses (template_id, designer_id, brand_id, project_id)
  values (p_template_id, v_designer, p_brand_id, p_project_id)
  on conflict (project_id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- Adds the ledger line for an order whose design came from a designer template. Once per release.
-- Units are the pieces ordered (a count; no names). The rate is read here from the platform setting
-- designer.royalty_per_unit and is used only when it is set and the order has a currency; otherwise the
-- line records the units and accrues nothing. Returns true when a line was added.
create function public.designer_accrue_for_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
  u public.designer_template_uses;
  v_value jsonb;
  v_rate bigint;
  v_rows integer;
begin
  select * into o from public.ops_orders where id = p_order_id;
  if not found then
    return false;
  end if;
  select * into u from public.designer_template_uses where project_id = o.project_id;
  if not found then
    return false;
  end if;
  select s.value into v_value from public.platform_settings s where s.key = 'designer.royalty_per_unit';
  if v_value is not null and jsonb_typeof(v_value) = 'number' and (v_value #>> '{}') ~ '^[0-9]{1,7}$'
     and o.currency is not null then
    v_rate := (v_value #>> '{}')::bigint;
    if v_rate > 1000000 then
      v_rate := null;
    end if;
  end if;
  insert into public.royalty_accruals
    (designer_id, template_id, project_id, order_id, release_id, units, rate_minor, currency, accrued_minor)
  values
    (u.designer_id, u.template_id, o.project_id, o.id, o.release_id, o.pieces,
     v_rate, case when v_rate is null then null else o.currency end, coalesce(v_rate, 0) * o.pieces)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- An order reaching ops accrues its royalty. A failure here must never stop an order, so it is only a warning.
create function private.designer_accrue_after_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.designer_accrue_for_order(new.id);
  exception when others then
    raise warning 'Royalty accrual for order % failed: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function private.designer_accrue_after_order() from public, anon, authenticated;

create trigger ops_orders_accrue_designer_royalty
  after insert on public.ops_orders
  for each row execute function private.designer_accrue_after_order();

-- The owner's hand-kept payout note for a designer. A platform admin only. Moves no money.
create function public.designer_set_payout_state(p_actor uuid, p_designer_id uuid, p_state text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.designer_assert_admin(p_actor);
  if not exists (select 1 from public.designer_profiles p where p.user_id = p_designer_id) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  insert into public.designer_payout_events (designer_id, state, note, set_by)
  values (p_designer_id, p_state, coalesce(p_note, ''), p_actor);
end;
$$;

revoke all on function public.designer_enrol(uuid, text) from public, anon, authenticated;
revoke all on function public.template_submission_create(uuid, text, text, text, text, text[], text, jsonb) from public, anon, authenticated;
revoke all on function public.template_submission_submit(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.template_submission_approve(uuid, uuid) from public, anon, authenticated;
revoke all on function public.template_submission_reject(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.designer_record_use(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.designer_accrue_for_order(uuid) from public, anon, authenticated;
revoke all on function public.designer_set_payout_state(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.designer_enrol(uuid, text) to service_role;
grant execute on function public.template_submission_create(uuid, text, text, text, text, text[], text, jsonb) to service_role;
grant execute on function public.template_submission_submit(uuid, uuid, boolean) to service_role;
grant execute on function public.template_submission_approve(uuid, uuid) to service_role;
grant execute on function public.template_submission_reject(uuid, uuid, text) to service_role;
grant execute on function public.designer_record_use(uuid, uuid, uuid) to service_role;
grant execute on function public.designer_accrue_for_order(uuid) to service_role;
grant execute on function public.designer_set_payout_state(uuid, uuid, text, text) to service_role;
