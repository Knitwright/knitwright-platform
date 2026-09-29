-- A brand's own size charts, imported from a spreadsheet. Plan step 25.
--
-- A brand uploads a CSV or .xlsx file. The server checks it and stores it as a file of
-- kind "chart", the same way as any other upload. The person maps its columns, and the
-- server turns it into a chart and stores it here. A chart for the same wearer, garment
-- type and fit replaces the one before. Members may read their brand's charts. No
-- browser may write here: the server writes through replace_brand_chart, which checks
-- that the user belongs to the brand, as append_spec_version does for designs.

-- Chart files are stored with the other uploads.
alter table public.files drop constraint files_kind_check;
alter table public.files add constraint files_kind_check
  check (kind in ('artwork', 'sketch', 'photo', 'render', 'export', 'chart'));

update storage.buckets
set allowed_mime_types = array[
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
where id = 'uploads';

create table public.brand_size_charts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  wearer text not null check (wearer in ('men', 'women', 'youth')),
  garment_type text not null
    check (length(garment_type) between 1 and 64 and garment_type ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- "any" is a chart used for every fit.
  fit text not null check (fit in ('any', 'regular', 'slim', 'relaxed')),
  -- The chart and its size run, as lib/sizing describes them. The server checks both
  -- with the sizing schemas before writing, and again when reading.
  chart jsonb not null check (jsonb_typeof(chart) = 'object' and pg_column_size(chart) <= 65536),
  run jsonb not null check (jsonb_typeof(run) = 'object' and pg_column_size(run) <= 8192),
  -- The file it was read from. The chart stays if the file is removed.
  source_file_id uuid references public.files (id) on delete set null,
  imported_by uuid not null references auth.users (id) on delete restrict,
  imported_at timestamptz not null default now(),
  unique (brand_id, wearer, garment_type, fit)
);

comment on table public.brand_size_charts is
  'A brand''s own size charts. Written by the server only, through replace_brand_chart.';

revoke all on public.brand_size_charts from anon, authenticated;
grant select on public.brand_size_charts to authenticated;
grant select on public.brand_size_charts to service_role;

alter table public.brand_size_charts enable row level security;

create policy "members read their brand's charts"
  on public.brand_size_charts for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

-- Stores a brand's chart, replacing the one for the same wearer, garment type and fit.
-- The file must be a chart file of the same brand. Refused the same way whether the
-- brand is missing or belongs to someone else.
create function public.replace_brand_chart(
  p_brand_id uuid,
  p_user_id uuid,
  p_wearer text,
  p_garment_type text,
  p_fit text,
  p_chart jsonb,
  p_run jsonb,
  p_file_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user_id is null or not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;

  if p_file_id is not null and not exists (
    select 1 from public.files f
    where f.id = p_file_id and f.brand_id = p_brand_id and f.kind = 'chart'
  ) then
    raise exception 'That file does not exist.' using errcode = 'P0002';
  end if;

  insert into public.brand_size_charts
    (brand_id, wearer, garment_type, fit, chart, run, source_file_id, imported_by)
  values (p_brand_id, p_wearer, p_garment_type, p_fit, p_chart, p_run, p_file_id, p_user_id)
  on conflict (brand_id, wearer, garment_type, fit) do update
  set chart = excluded.chart,
      run = excluded.run,
      source_file_id = excluded.source_file_id,
      imported_by = excluded.imported_by,
      imported_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- Only the server's own key may run it. A browser is refused.
revoke all on function public.replace_brand_chart(uuid, uuid, text, text, text, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.replace_brand_chart(uuid, uuid, text, text, text, jsonb, jsonb, uuid)
  to service_role;
