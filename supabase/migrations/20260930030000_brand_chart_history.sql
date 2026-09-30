-- Brand size charts keep their history. A saved version of a design is shown and exported with
-- the charts that applied when it was saved, so importing a new chart must not change an old
-- version. replace_brand_chart now marks the chart it replaces as superseded instead of
-- overwriting it. At most one chart per brand, wearer, garment type and fit is current.

alter table public.brand_size_charts add column superseded_at timestamptz;

alter table public.brand_size_charts
  add constraint brand_size_charts_superseded_after_import
  check (superseded_at is null or superseded_at >= imported_at);

alter table public.brand_size_charts
  drop constraint brand_size_charts_brand_id_wearer_garment_type_fit_key;

create unique index brand_size_charts_current
  on public.brand_size_charts (brand_id, wearer, garment_type, fit)
  where superseded_at is null;

-- Finding the charts that applied at a moment.
create index brand_size_charts_brand_period
  on public.brand_size_charts (brand_id, imported_at, superseded_at);

comment on column public.brand_size_charts.superseded_at is
  'When a newer import replaced this chart. Null for the current chart. A chart applied from imported_at until then.';

-- Stores a brand's chart in place of the current one for the same wearer, garment type and fit,
-- which is kept, marked as superseded now. The file must be a chart file of the same brand.
-- Refused the same way whether the brand is missing or belongs to someone else.
create or replace function public.replace_brand_chart(
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

  -- Two imports of the same chart at once take turns here, so one current chart remains.
  perform pg_advisory_xact_lock(hashtextextended(
    'brand_size_charts:' || p_brand_id::text || ':' || p_wearer || ':' || p_garment_type || ':' || p_fit, 0));

  update public.brand_size_charts
  set superseded_at = now()
  where brand_id = p_brand_id
    and wearer = p_wearer
    and garment_type = p_garment_type
    and fit = p_fit
    and superseded_at is null;

  insert into public.brand_size_charts
    (brand_id, wearer, garment_type, fit, chart, run, source_file_id, imported_by, imported_at)
  values (p_brand_id, p_wearer, p_garment_type, p_fit, p_chart, p_run, p_file_id, p_user_id, now())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.replace_brand_chart(uuid, uuid, text, text, text, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.replace_brand_chart(uuid, uuid, text, text, text, jsonb, jsonb, uuid)
  to service_role;
