-- Database findings of the v4 security review (docs/reviews/security-v4.md): M5, M6, M8, L10, L11, L12, L13.
-- L9 is deliberately not changed; the report says why. Nothing in an earlier migration is edited.

-- ---------------------------------------------------------------------------------------------
-- M5. Changing a brand's details is member management, like renaming: owners and admins only.
-- The answer for anyone else is the same as for a missing brand.

create or replace function public.set_brand_details(
  p_brand_id uuid,
  p_organisation_type text,
  p_country text,
  p_region text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_country text := nullif(upper(btrim(coalesce(p_country, ''))), '');
  v_region text := nullif(btrim(coalesce(p_region, '')), '');
begin
  if v_user is null then
    raise exception 'Sign in to change a brand.' using errcode = '28000';
  end if;
  if not private.can_manage_members(v_user, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  if v_country is null then
    v_region := null;
  end if;

  begin
    update public.brands
    set organisation_type = nullif(btrim(coalesce(p_organisation_type, '')), ''),
        country = v_country,
        region = v_region,
        updated_at = now()
    where id = p_brand_id;
  exception
    when check_violation then
      raise exception 'Those organisation details are not valid.' using errcode = '22023';
  end;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- M6. Every file the kit names (crest, sponsor logos) must be a file of this brand.

create or replace function public.save_club_kit(p_brand_id uuid, p_user_id uuid, p_kit jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_files uuid[];
begin
  if not private.can_manage_kit(p_user_id, p_brand_id) then
    raise exception 'You may not change this kit.' using errcode = '42501';
  end if;
  if p_kit is null or jsonb_typeof(p_kit) <> 'object' then
    raise exception 'The kit is not understood.' using errcode = '22023';
  end if;
  if p_kit -> 'sponsors' is not null and jsonb_typeof(p_kit -> 'sponsors') <> 'array' then
    raise exception 'The kit is not understood.' using errcode = '22023';
  end if;

  v_files := array_remove(
    array[nullif(p_kit ->> 'crestFileId', '')::uuid]
      || array(
        select nullif(s ->> 'logoFileId', '')::uuid
        from jsonb_array_elements(coalesce(p_kit -> 'sponsors', '[]'::jsonb)) as s
      ),
    null
  );
  if exists (
    select 1 from unnest(v_files) as f(id)
    where not exists (select 1 from public.files x where x.id = f.id and x.brand_id = p_brand_id)
  ) then
    raise exception 'A picture in the kit does not belong to this club.' using errcode = '22023', hint = 'foreign_file';
  end if;

  insert into public.club_kits as k (
    brand_id, primary_colour, secondary_colour, accent_colour, crest_file_id,
    sponsors, name_font, number_font, updated_by, updated_at
  ) values (
    p_brand_id,
    p_kit ->> 'primaryColour',
    p_kit ->> 'secondaryColour',
    p_kit ->> 'accentColour',
    nullif(p_kit ->> 'crestFileId', '')::uuid,
    coalesce(p_kit -> 'sponsors', '[]'::jsonb),
    coalesce(p_kit ->> 'nameFont', 'geist'),
    coalesce(p_kit ->> 'numberFont', 'geist'),
    p_user_id,
    now()
  )
  on conflict (brand_id) do update set
    primary_colour = excluded.primary_colour,
    secondary_colour = excluded.secondary_colour,
    accent_colour = excluded.accent_colour,
    crest_file_id = excluded.crest_file_id,
    sponsors = excluded.sponsors,
    name_font = excluded.name_font,
    number_font = excluded.number_font,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- M8. Members read a media item's picture facts, not what it cost, who made it or where the clean file is.
-- The server's key keeps the whole table (lib/media/service.ts reads with it, filtered by brand).

revoke select on public.media_items from authenticated;
grant select (id, set_id, brand_id, kind, view, file_id, width, height, checker_verdict, created_at)
  on public.media_items to authenticated;

-- ---------------------------------------------------------------------------------------------
-- L10. Deleting a sign-in record sets the actor column of append-only history to null. That update is the
-- only change let through, and only when it changes nothing else. Any other change is refused as before.

create or replace function private.ops_refuse_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if to_jsonb(new) ->> 'actor' is null and to_jsonb(old) ->> 'actor' is not null
       and (to_jsonb(old) - 'actor') = (to_jsonb(new) - 'actor') then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    -- An order goes with its brand, and takes its history with it.
    if not exists (select 1 from public.brands b where b.id = old.brand_id) then
      return old;
    end if;
  end if;
  raise exception 'Ops history can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
end;
$$;

create or replace function private.ops_qc_refuse_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if to_jsonb(new) ->> 'actor' is null and to_jsonb(old) ->> 'actor' is not null
       and (to_jsonb(old) - 'actor') = (to_jsonb(new) - 'actor') then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    if not exists (select 1 from public.brands b where b.id = old.brand_id) then
      return old;
    end if;
  end if;
  raise exception 'Ops history can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
end;
$$;

create or replace function private.refuse_settings_history_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.set_by is null and old.set_by is not null
       and (to_jsonb(old) - 'set_by') = (to_jsonb(new) - 'set_by') then
      return new;
    end if;
  end if;
  raise exception 'A settings history line can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create or replace function private.refuse_designer_ledger_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Let a line go with the designer's own account.
    if not exists (select 1 from public.designer_profiles p where p.user_id = old.designer_id) then
      return old;
    end if;
    -- A use of a template goes with the brand that made the design (L11).
    if tg_table_name = 'designer_template_uses'
       and not exists (select 1 from public.brands b where b.id = old.brand_id) then
      return old;
    end if;
  elsif tg_op = 'UPDATE' and tg_table_name = 'designer_payout_events' then
    if new.set_by is null and old.set_by is not null
       and (to_jsonb(old) - 'set_by') = (to_jsonb(new) - 'set_by') then
      return new;
    end if;
  end if;
  raise exception 'A royalty ledger line can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create or replace function private.refuse_pattern_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.brands b where b.id = old.brand_id) then
      return old;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.actor is null and old.actor is not null
       and (to_jsonb(old) - 'actor') = (to_jsonb(new) - 'actor') then
      return new;
    end if;
  end if;
  raise exception 'Pattern request history can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create or replace function private.refuse_brand_run_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_column text := case tg_table_name when 'brand_runs' then 'created_by' else 'actor' end;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.brand_products p where p.id = old.product_id) then
      return old;
    end if;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) ->> v_column is null and to_jsonb(old) ->> v_column is not null
       and (to_jsonb(old) - v_column) = (to_jsonb(new) - v_column) then
      return new;
    end if;
  end if;
  raise exception 'A brand run and its history can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

create or replace function private.refuse_credit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.brands b where b.id = old.brand_id) then
      return old;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.created_by is null and old.created_by is not null
       and (to_jsonb(old) - 'created_by') = (to_jsonb(new) - 'created_by') then
      return new;
    end if;
  end if;
  raise exception 'A credit ledger line can never be changed or removed.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- L11. Orders, their history and the uses of designer templates go with their brand.
-- Every key from the ops tables to an order was `on delete restrict`; the brand cascade would reach a
-- parent and a child in either order, so each becomes a cascade (the append-only triggers still refuse
-- a delete while the brand exists). Rows left behind by brands deleted earlier are not touched:
-- the new keys are added not valid, so they bind new rows and the cascade, and nothing is removed here.

do $$
declare
  c record;
begin
  for c in
    select con.conrelid::regclass as tbl, con.conname, pg_get_constraintdef(con.oid) as def
    from pg_catalog.pg_constraint con
    where con.contype = 'f' and con.confrelid = 'public.ops_orders'::regclass and con.confdeltype = 'r'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
    execute format('alter table %s add constraint %I %s', c.tbl, c.conname,
                   replace(c.def, 'ON DELETE RESTRICT', 'ON DELETE CASCADE'));
  end loop;
end;
$$;

alter table public.ops_orders
  add constraint ops_orders_brand_id_fkey foreign key (brand_id) references public.brands (id) on delete cascade not valid;
alter table public.designer_template_uses
  add constraint designer_template_uses_brand_id_fkey foreign key (brand_id) references public.brands (id) on delete cascade not valid;

create index if not exists designer_template_uses_brand_idx on public.designer_template_uses (brand_id);

-- `batches` hold a factory, a fabric, an article and a cut-off, never a brand or a person, and one batch
-- serves many brands. They are left as they are.

-- Invitations expire. Existing ones get 14 days from now. Inviting again renews the date.
alter table public.club_invitations
  add column expires_at timestamptz not null default (now() + interval '14 days');

create or replace function public.invite_member(p_brand_id uuid, p_user_id uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if not private.can_manage_members(p_user_id, p_brand_id) then
    raise exception 'You may not change members.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'kit_manager', 'viewer') then
    raise exception 'That role is not offered.' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'Enter an email address.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club_invitations:' || p_brand_id::text, 0));
  if (select count(*) from public.memberships m where m.brand_id = p_brand_id)
     + (select count(*) from public.club_invitations i where i.brand_id = p_brand_id)
     >= private.club_members_limit() then
    raise exception 'A club may have 50 members and invitations.' using errcode = 'P0001', hint = 'too_many_members';
  end if;
  insert into public.club_invitations (brand_id, email, role, invited_by)
  values (p_brand_id, v_email, p_role, p_user_id)
  on conflict (brand_id, email) do update
    set role = excluded.role, expires_at = now() + interval '14 days'
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.my_club_invitations()
returns table (id uuid, brand_id uuid, brand_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.brand_id, b.name, i.role
  from public.club_invitations i
  join public.brands b on b.id = i.brand_id
  join auth.users u on u.id = (select auth.uid())
  where u.email_confirmed_at is not null and lower(u.email::text) = i.email
    and i.expires_at > now()
  order by i.created_at, i.id;
$$;

create or replace function public.accept_invitation(p_user_id uuid, p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.club_invitations;
begin
  perform pg_advisory_xact_lock(hashtextextended('create_brand:' || p_user_id::text, 0));
  select i.* into v_invite
  from public.club_invitations i
  join auth.users u on u.id = p_user_id
  where i.id = p_invitation_id
    and u.email_confirmed_at is not null and lower(u.email::text) = i.email;
  if not found then
    raise exception 'That invitation does not exist.' using errcode = 'P0002';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'That invitation has expired. Ask for a new one.' using errcode = 'P0002', hint = 'invitation_expired';
  end if;
  if exists (select 1 from public.memberships m where m.brand_id = v_invite.brand_id and m.user_id = p_user_id) then
    delete from public.club_invitations i where i.id = v_invite.id;
    return v_invite.brand_id;
  end if;
  if (select count(*) from public.memberships m where m.user_id = p_user_id) >= private.max_brands_per_user() then
    raise exception 'You can belong to % brands at most.', private.max_brands_per_user()
      using errcode = 'P0001', hint = 'brand_limit';
  end if;
  insert into public.memberships (brand_id, user_id, role) values (v_invite.brand_id, p_user_id, v_invite.role);
  delete from public.club_invitations i where i.id = v_invite.id;
  return v_invite.brand_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- L12. A design made from a designer template must be a design of the brand. A designer's own use of their
-- own template (they belong to the brand) earns nothing and is not recorded: it answers false.
-- A failed royalty accrual stays non-blocking and is logged as a warning with the reason and its code.

create or replace function public.designer_record_use(p_template_id uuid, p_brand_id uuid, p_project_id uuid)
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
  if not exists (select 1 from public.projects pr where pr.id = p_project_id and pr.brand_id = p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.memberships m where m.brand_id = p_brand_id and m.user_id = v_designer) then
    return false;
  end if;
  insert into public.designer_template_uses (template_id, designer_id, brand_id, project_id)
  values (p_template_id, v_designer, p_brand_id, p_project_id)
  on conflict (project_id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create or replace function private.designer_accrue_after_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.designer_accrue_for_order(new.id);
  exception when others then
    -- An order must never be stopped by this, so the reason goes to the log and the order goes on.
    raise warning 'Royalty accrual for order % failed (SQLSTATE %): %', new.id, sqlstate, sqlerrm;
  end;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- L13. A delay needs a date. The refusal trigger function pins its search path.
-- pattern_request_create keeps taking the quote from its caller: see the report.

create or replace function public.ops_delay_order(p_actor uuid, p_order_id uuid, p_new_date date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.ops_orders;
begin
  perform private.require_ops_actor(p_actor);
  select * into o from public.ops_orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'That order does not exist.' using errcode = 'P0002';
  end if;
  if p_new_date is null then
    raise exception 'Give the new promised date.' using errcode = '22023', hint = 'date_needed';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 300 then
    raise exception 'Give the reason for the delay, up to 300 characters.' using errcode = '22023', hint = 'reason_needed';
  end if;
  if o.status not in ('batched', 'received', 'in_production') then
    raise exception 'Only an order in a batch or at the factory can be delayed.' using errcode = 'P0001', hint = 'not_delayable';
  end if;
  if o.promised_on is not null and p_new_date <= o.promised_on then
    raise exception 'The new promised date must be later than the current one.' using errcode = 'P0001', hint = 'not_later';
  end if;
  update public.ops_orders set promised_on = p_new_date, updated_at = now() where id = p_order_id;
  insert into public.ops_order_events (order_id, brand_id, kind, from_status, to_status, batch_id, promised_on, note, actor)
  values (o.id, o.brand_id, 'delayed', o.status, o.status, o.batch_id, p_new_date, btrim(p_reason), p_actor);
end;
$$;

-- Rights are unchanged by `create or replace`; stated again so this file shows them.
revoke all on function public.set_brand_details(uuid, text, text, text) from public, anon;
grant execute on function public.set_brand_details(uuid, text, text, text) to authenticated;
revoke all on function public.designer_record_use(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.designer_record_use(uuid, uuid, uuid) to service_role;
