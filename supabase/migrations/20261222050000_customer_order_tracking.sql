-- Plan v6 P5 (decision 0143): what a brand's own members may see of an order after the factory has it.
--
-- Members already read their brand's `ops_orders` and `ops_order_events`. They do not read
-- `ops_shipments` or `ops_qc_inspections`, which hold ops' own notes, measurements and checklists.
-- The Orders page needs three facts from those tables and no more:
--   * that a QC inspection passed, and when;
--   * the photos of a passing inspection that ops chose to show the customer;
--   * each parcel's courier, tracking number, tracking address, date and pieces.
-- Two functions hand over exactly those, for an order of a brand the caller is a member of. The tables'
-- own policies are unchanged.
--
-- QC photos are not shown to a customer unless ops says so: `photos_shared` defaults to false, and only
-- `ops_share_qc_photos` (platform admins, through the server's own key) changes it. The inspection stays
-- append-only for every other column.

alter table public.ops_qc_inspections
  add column photos_shared boolean not null default false;

comment on column public.ops_qc_inspections.photos_shared is
  'Whether the customer sees this inspection''s photos on the order page. Ops sets it; false until then.';

-- The append-only rule, with one more exception: ops may change whether an inspection's photos are
-- shown to the customer, and nothing else about it.
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
    if tg_table_name = 'ops_qc_inspections'
       and (to_jsonb(old) - 'photos_shared') = (to_jsonb(new) - 'photos_shared') then
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

-- Ops shows or hides one inspection's photos on the customer's order page.
create function public.ops_share_qc_photos(p_actor uuid, p_inspection_id uuid, p_shared boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_ops_actor(p_actor);
  if p_shared is null then
    raise exception 'Say whether the photos are shown.' using errcode = '22023', hint = 'invalid_input';
  end if;
  update public.ops_qc_inspections i set photos_shared = p_shared where i.id = p_inspection_id;
  if not found then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- For a list of orders: when each passed QC and when it first shipped. Orders of a brand the caller is
-- not a member of are left out, as if they did not exist.
create function public.customer_order_milestones(p_order_ids uuid[])
returns table (order_id uuid, qc_passed_at timestamptz, shipped_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id,
         (select min(i.at) from public.ops_qc_inspections i where i.order_id = o.id and i.result = 'pass'),
         (select min(s.shipped_on) from public.ops_shipments s where s.order_id = o.id)
  from public.ops_orders o
  where o.id = any (coalesce(p_order_ids, '{}'))
    and cardinality(coalesce(p_order_ids, '{}')) <= 500
    and (private.is_member(o.brand_id) or private.is_platform_admin());
$$;

-- For one order: its parcels and its passing inspections, with only the photos ops chose to share.
-- Null when the order does not exist or belongs to a brand the caller is not a member of.
create function public.customer_order_tracking(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'shipments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'courier', s.courier, 'tracking_number', s.tracking_number, 'tracking_url', s.tracking_url,
        'shipped_on', s.shipped_on, 'pieces', s.pieces) order by s.shipped_on, s.at)
      from public.ops_shipments s where s.order_id = o.id), '[]'::jsonb),
    'inspections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'at', i.at,
        'photo_file_ids', case when i.photos_shared then to_jsonb(i.photo_file_ids) else '[]'::jsonb end
      ) order by i.at)
      from public.ops_qc_inspections i where i.order_id = o.id and i.result = 'pass'), '[]'::jsonb)
  )
  from public.ops_orders o
  where o.id = p_order_id
    and (private.is_member(o.brand_id) or private.is_platform_admin());
$$;

revoke all on function public.ops_share_qc_photos(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.customer_order_milestones(uuid[]) from public, anon;
revoke all on function public.customer_order_tracking(uuid) from public, anon;

grant execute on function public.ops_share_qc_photos(uuid, uuid, boolean) to service_role;
grant execute on function public.customer_order_milestones(uuid[]) to authenticated, service_role;
grant execute on function public.customer_order_tracking(uuid) to authenticated, service_role;
