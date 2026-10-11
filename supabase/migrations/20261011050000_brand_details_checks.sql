-- Brand details the app can always read, and share links in the lead score. Decision 0024,
-- after the review of wave 3.
--
-- 1. The database took any two capital letters as a country and any region without spaces at its
--    ends, while the app takes only the countries on its list (COUNTRY_CODES in
--    apps/web/lib/leads/organisation.ts) and a region without line breaks or hidden characters.
--    A member could store, through set_brand_details, a value the app then refused to read. The
--    table now checks what the app checks, so set_brand_details (which turns a failed check into
--    "Those organisation details are not valid.") refuses the same values. The organisation types
--    already matched. Keep the country list here the same as the app's.
-- 2. admin_lead_rows also says whether the brand has made any share link (decision 0026), for the
--    lead score's "Shared with others" (guide page 9).

-- Values stored before this check that it would refuse are cleared: a country not on the list
-- (and its region, which needs a country), and a region with hidden characters or too long.
update public.brands
set country = null, region = null
where country is not null and country not in (
    'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
    'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
    'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
    'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
    'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
    'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
    'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
    'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
    'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
    'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
    'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
    'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
    'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
    'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
    'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
    'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
);

update public.brands
set region = null
where region ~ '[\x01-\x1f\x7f-\x9f]' or length(region) > 80;

alter table public.brands
  drop constraint brands_country_check,
  drop constraint brands_region_check,
  -- ISO 3166-1 two-letter codes: the app's list.
  add constraint brands_country_check check (country in (
    'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
    'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
    'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
    'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
    'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
    'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
    'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
    'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
    'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
    'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
    'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
    'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
    'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
    'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
    'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
    'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
  )),
  -- Up to 80 characters, no spaces at the ends, and no control characters (line breaks, tabs and
  -- the like), as the app's form refuses them.
  add constraint brands_region_check check (
    length(region) between 1 and 80
    and region = btrim(region)
    and region !~ '[\x01-\x1f\x7f-\x9f]'
  );

-- 2. The lead rows, now with "shared". Otherwise as in migration 20261011010000: platform admins
-- only, at most 1000 brands, the most recently changed first (a known limit, decision 0024).
create or replace function public.admin_lead_rows()
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
        'shared', exists (select 1 from public.share_links s where s.brand_id = b.id),
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

revoke all on function public.admin_lead_rows() from public, anon;
grant execute on function public.admin_lead_rows() to authenticated;
