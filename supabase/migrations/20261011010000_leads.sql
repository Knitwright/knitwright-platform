-- The lead engine. Decision 0024, from the Platform and Store Guide (pages 2, 9 and 12).
--
-- 1. A brand gains its organisation type, country and state or region, and a segment: the path
--    its first guided design took (team kit, brand launch, creator merch, own design).
-- 2. A design remembers the path it was started from (its buyer kind).
-- 3. Quote requests: a member asks the Knitwright team for a quote on one version of a design.
-- 4. Platform admins: people on the Knitwright team. Rows are added by hand in the database,
--    never by a browser and never by the app. Only they read across brands.
-- 5. Leads: one row per brand, written by platform admins only: who owns the lead (Knitwright or
--    the Australian partner) and the next step with its date.
--
-- Members read their own brand's quote requests. Platform admins read every brand's, through the
-- policies below and the functions at the end, which check platform_admins themselves.

-- 1. Organisation details. All optional: they are asked for at brand creation and again when a
-- design is first saved, and nothing is refused without them.
alter table public.brands
  add column organisation_type text
    check (organisation_type in ('club', 'school', 'brand', 'gym', 'event')),
  -- ISO 3166-1 two-letter code, such as AU.
  add column country text check (country ~ '^[A-Z]{2}$'),
  -- A state for Australia (one of the eight), free text elsewhere.
  add column region text check (length(region) between 1 and 80 and region = btrim(region)),
  add column segment text
    check (segment in ('team_kit', 'launch_brand', 'creator_merch', 'upload_design')),
  add constraint brands_region_needs_country check (region is null or country is not null),
  add constraint brands_australian_state check (
    country is distinct from 'AU' or region is null
    or region in ('ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA')
  );

-- 2. The path a design was started from.
alter table public.projects
  add column buyer_kind text
    check (buyer_kind in ('team_kit', 'launch_brand', 'creator_merch', 'upload_design'));

-- 4. Platform admins. No browser may read or write this table, and there are no policies: only
-- the functions below look at it.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'People on the Knitwright team who may see every brand''s lead. Added by hand only.';

revoke all on public.platform_admins from public, anon, authenticated;
alter table public.platform_admins enable row level security;

-- Whether the caller is a platform admin. Policies call this. It answers only about the caller.
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_platform_admin() from public, anon;
grant execute on function private.is_platform_admin() to authenticated, service_role;

-- The same question, through the API, so a page can answer "not found" to everyone else.
create function public.am_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin();
$$;

revoke all on function public.am_platform_admin() from public, anon;
grant execute on function public.am_platform_admin() to authenticated;

-- 3. Quote requests.
create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  project_id uuid not null,
  -- The version the person was looking at. Checked by request_quote, which is the only writer.
  version integer not null check (version >= 1),
  quantity integer not null check (quantity between 1 and 1000000),
  needed_by date not null,
  sizes_note text not null default '' check (length(sizes_note) <= 500),
  message text not null default '' check (length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'quoted', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, brand_id) references public.projects (id, brand_id)
    on delete cascade
);

comment on table public.quote_requests is
  'A member''s request for a quote on one version of a design. Written by the server; status changed by platform admins.';

create index quote_requests_brand_idx on public.quote_requests (brand_id, created_at desc);
create index quote_requests_project_idx on public.quote_requests (project_id, created_at desc);

revoke all on public.quote_requests from public, anon, authenticated, service_role;
grant select on public.quote_requests to authenticated, service_role;
-- Deleting a design or an account removes its requests through the keys above.
alter table public.quote_requests enable row level security;

create policy "members read their brand's quote requests"
  on public.quote_requests for select to authenticated
  using (private.is_member(brand_id));

create policy "platform admins read every quote request"
  on public.quote_requests for select to authenticated
  using (private.is_platform_admin());

-- 5. Leads.
create table public.leads (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  -- Null while nobody owns the lead.
  owner text check (owner in ('knitwright', 'partner')),
  next_step text not null default '' check (length(next_step) <= 200),
  next_step_on date,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.leads is
  'Who follows up each brand, and the next step. Platform admins only; members never see it.';

revoke all on public.leads from public, anon, authenticated, service_role;
grant select on public.leads to authenticated, service_role;
alter table public.leads enable row level security;

create policy "platform admins read leads"
  on public.leads for select to authenticated
  using (private.is_platform_admin());

-- There are no insert, update or delete policies on any table here, on purpose.

-- Sets a brand's organisation details. Any member of the brand may. Empty text clears a field.
create function public.set_brand_details(
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
  if not private.belongs_to(v_user, p_brand_id) then
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

-- Remembers the path a design was started from. The brand takes it as its segment when it has
-- none yet. The server has identified the user, so this checks the membership itself.
create function public.set_project_buyer_kind(
  p_project_id uuid,
  p_user_id uuid,
  p_buyer_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  select p.brand_id into v_brand from public.projects p where p.id = p_project_id;
  if v_brand is null or not private.belongs_to(p_user_id, v_brand) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if p_buyer_kind is null
     or p_buyer_kind not in ('team_kit', 'launch_brand', 'creator_merch', 'upload_design') then
    raise exception 'Choose which path fits you.' using errcode = '22023';
  end if;

  update public.projects set buyer_kind = p_buyer_kind where id = p_project_id;
  update public.brands set segment = p_buyer_kind where id = v_brand and segment is null;
end;
$$;

-- Stores a quote request for one version of a design. The brand is taken from the design, never
-- from the caller. The needed-by date must be after today.
create function public.request_quote(
  p_project_id uuid,
  p_user_id uuid,
  p_version integer,
  p_quantity integer,
  p_needed_by date,
  p_sizes_note text,
  p_message text
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
  select p.brand_id into v_brand from public.projects p where p.id = p_project_id;
  if v_brand is null or not private.belongs_to(p_user_id, v_brand) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.spec_versions v
    where v.project_id = p_project_id and v.version = p_version
  ) then
    raise exception 'That version does not exist.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
    raise exception 'A quantity is a whole number from 1.' using errcode = '22023';
  end if;
  if p_needed_by is null or p_needed_by <= current_date then
    raise exception 'The date must be after today.' using errcode = '22023';
  end if;

  insert into public.quote_requests
    (brand_id, project_id, version, quantity, needed_by, sizes_note, message, created_by)
  values (
    v_brand,
    p_project_id,
    p_version,
    p_quantity,
    p_needed_by,
    private.project_text(p_sizes_note, 0, 500, 'A sizes note'),
    private.project_text(p_message, 0, 1000, 'A message'),
    p_user_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Refuses anyone who is not a platform admin, with the same answer as a missing page.
create function private.require_platform_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not exists (
    select 1 from public.platform_admins a where a.user_id = v_user
  ) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  return v_user;
end;
$$;

-- Every brand as a lead, for the leads page. Platform admins only. At most 1000 brands, the most
-- recently changed first; the page sorts them by score.
create function public.admin_lead_rows()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();

  return (
    select coalesce(jsonb_agg(row_data order by (row_data ->> 'updated_at') desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'organisation_type', b.organisation_type,
        'country', b.country,
        'region', b.region,
        'segment', b.segment,
        'created_at', b.created_at,
        'updated_at', b.updated_at,
        'emails', (
          select coalesce(jsonb_agg(u.email::text order by m.created_at), '[]'::jsonb)
          from public.memberships m
          join auth.users u on u.id = m.user_id
          where m.brand_id = b.id
        ),
        'designs', (select count(*) from public.projects p where p.brand_id = b.id),
        'most_versions', (
          select coalesce(max(p.current_version), 0) from public.projects p where p.brand_id = b.id
        ),
        'last_design_at', (select max(p.updated_at) from public.projects p where p.brand_id = b.id),
        'quotes', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', q.id,
            'project_id', q.project_id,
            'project_name', p.name,
            'version', q.version,
            'quantity', q.quantity,
            'needed_by', q.needed_by,
            'sizes_note', q.sizes_note,
            'message', q.message,
            'status', q.status,
            'created_at', q.created_at
          ) order by q.created_at desc), '[]'::jsonb)
          from public.quote_requests q
          join public.projects p on p.id = q.project_id
          where q.brand_id = b.id
        ),
        'lead', (
          select jsonb_build_object(
            'owner', l.owner,
            'next_step', l.next_step,
            'next_step_on', l.next_step_on,
            'updated_at', l.updated_at
          )
          from public.leads l where l.brand_id = b.id
        )
      ) as row_data
      from public.brands b
      order by b.updated_at desc
      limit 1000
    ) rows
  );
end;
$$;

-- Sets who owns a lead and its next step. Platform admins only.
create function public.admin_set_lead(
  p_brand_id uuid,
  p_owner text,
  p_next_step text,
  p_next_step_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_platform_admin();
  v_owner text := nullif(btrim(coalesce(p_owner, '')), '');
begin
  if not exists (select 1 from public.brands b where b.id = p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  if v_owner is not null and v_owner not in ('knitwright', 'partner') then
    raise exception 'Choose who owns the lead.' using errcode = '22023';
  end if;

  insert into public.leads (brand_id, owner, next_step, next_step_on, updated_by, updated_at)
  values (
    p_brand_id,
    v_owner,
    private.project_text(p_next_step, 0, 200, 'A next step'),
    p_next_step_on,
    v_user,
    now()
  )
  on conflict (brand_id) do update
  set owner = excluded.owner,
      next_step = excluded.next_step,
      next_step_on = excluded.next_step_on,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
end;
$$;

-- Changes the status of a quote request. Platform admins only.
create function public.admin_set_quote_status(p_quote_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  if p_status is null or p_status not in ('new', 'quoted', 'closed') then
    raise exception 'Choose a status.' using errcode = '22023';
  end if;

  update public.quote_requests set status = p_status, updated_at = now() where id = p_quote_id;
  if not found then
    raise exception 'That quote request does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function private.require_platform_admin() from public, anon, authenticated;
revoke all on function public.set_brand_details(uuid, text, text, text) from public, anon;
grant execute on function public.set_brand_details(uuid, text, text, text) to authenticated;
revoke all on function public.set_project_buyer_kind(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_project_buyer_kind(uuid, uuid, text) to service_role;
revoke all on function public.request_quote(uuid, uuid, integer, integer, date, text, text)
  from public, anon, authenticated;
grant execute on function public.request_quote(uuid, uuid, integer, integer, date, text, text)
  to service_role;
revoke all on function public.admin_lead_rows() from public, anon;
grant execute on function public.admin_lead_rows() to authenticated;
revoke all on function public.admin_set_lead(uuid, text, text, date) from public, anon;
grant execute on function public.admin_set_lead(uuid, text, text, date) to authenticated;
revoke all on function public.admin_set_quote_status(uuid, text) from public, anon;
grant execute on function public.admin_set_quote_status(uuid, text) to authenticated;
