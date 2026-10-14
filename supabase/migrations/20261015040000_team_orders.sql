-- Team orders: who gets which shirt (plans/production-outputs.md, workstream W4).
--
-- A team order is a roster for one design: a name, a number, a size, a cut and a quantity for each
-- player. Player names are personal data. They live only in these two tables, are never copied
-- into a release (a release keeps a hash of the roster), and go when the order, the design or the
-- brand goes. Members read their brand's orders. Nobody writes to either table directly: every
-- write goes through a function here that only the server's own key may run, which checks that
-- the user belongs to the brand.

create table public.team_orders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets a row name its order and its brand together, so the two cannot disagree.
  unique (id, brand_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.team_orders is
  'A team list for one design. Holds personal data (player names). Written by the server only.';

create index team_orders_project_idx on public.team_orders (brand_id, project_id, created_at desc);

create table public.team_order_rows (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  brand_id uuid not null,
  position integer not null check (position >= 1),
  -- Empty when the design has no name place. Personal data.
  name text not null check (length(name) <= 40 and name !~ '[[:cntrl:]]'),
  -- Digits as printed, so "07" and "7" stay different.
  number text not null check (number ~ '^[0-9]{1,3}$'),
  size_label text not null check (length(size_label) between 1 and 16),
  cut text not null check (cut in ('mens', 'womens', 'junior', 'unisex')),
  quantity integer not null check (quantity between 1 and 999),
  unique (order_id, position),
  foreign key (order_id, brand_id) references public.team_orders (id, brand_id) on delete cascade
);

comment on table public.team_order_rows is
  'One line of a team list. The name is personal data and goes with its order. Written by the server only.';

create index team_order_rows_brand_idx on public.team_order_rows (brand_id);

-- Browsers may read their own brand's rows and nothing else. The server's own key may read, and
-- delete (an order is erased by deleting it). It writes through the functions below.
revoke all on public.team_orders, public.team_order_rows
  from public, anon, authenticated, service_role;
grant select on public.team_orders, public.team_order_rows to authenticated, service_role;
grant delete on public.team_orders to service_role;

alter table public.team_orders enable row level security;
alter table public.team_order_rows enable row level security;

create policy "members read their brand's team orders"
  on public.team_orders for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's team order rows"
  on public.team_order_rows for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on either table, on purpose.

-- The most team orders one design may have, and the most rows in one.
create function private.team_orders_limit()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;
create function private.team_order_rows_limit()
returns integer language sql immutable set search_path = '' as $$ select 1000 $$;

-- Makes a team order, or replaces the name and every row of an existing one, in one step so a
-- list is never half saved. p_rows is an array of { name, number, size_label, cut, quantity }.
-- Returns the order's id.
create function public.save_team_order(
  p_order_id uuid,
  p_project_id uuid,
  p_brand_id uuid,
  p_user_id uuid,
  p_name text,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_order_id;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) not between 1 and private.team_order_rows_limit() then
    raise exception 'A team list holds 1 to 1000 rows.' using errcode = '22023';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 then
    raise exception 'A team order needs a name of up to 120 characters.' using errcode = '22023';
  end if;

  -- Taken in turn with any other save to the same design.
  perform 1 from public.projects p
  where p.id = p_project_id and p.brand_id = p_brand_id for update;
  if not found or not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;

  if v_id is null then
    if (select count(*) from public.team_orders o where o.project_id = p_project_id)
       >= private.team_orders_limit() then
      raise exception 'This design has as many team orders as it may have.'
        using errcode = 'P0001', hint = 'too_many_orders';
    end if;
    insert into public.team_orders (brand_id, project_id, name, created_by)
    values (p_brand_id, p_project_id, btrim(p_name), p_user_id)
    returning id into v_id;
  else
    update public.team_orders o set name = btrim(p_name), updated_at = now()
    where o.id = v_id and o.brand_id = p_brand_id and o.project_id = p_project_id;
    if not found then
      raise exception 'That team order does not exist.' using errcode = 'P0002';
    end if;
    delete from public.team_order_rows r where r.order_id = v_id;
  end if;

  insert into public.team_order_rows (order_id, brand_id, position, name, number, size_label, cut, quantity)
  select v_id, p_brand_id, e.ordinality, e.row ->> 'name', e.row ->> 'number',
         e.row ->> 'size_label', e.row ->> 'cut', (e.row ->> 'quantity')::integer
  from jsonb_array_elements(p_rows) with ordinality as e(row, ordinality);

  return v_id;
end;
$$;

revoke all on function public.save_team_order(uuid, uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_team_order(uuid, uuid, uuid, uuid, text, jsonb) to service_role;
