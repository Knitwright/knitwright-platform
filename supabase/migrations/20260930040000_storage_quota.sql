-- A storage quota for each brand. Security finding S-01. Owner decision 2026-09-30: 500 MB.
--
-- Every stored file has a row in public.files (uploads, size chart files and generated
-- pictures alike), so the quota is the sum of the brand's rows. The check lives here, in a
-- trigger, so no path into storage can skip it. Before summing, the trigger locks the
-- brand's row: two uploads for one brand at the same moment take turns, and the second sees
-- the first one's bytes, so parallel uploads cannot together pass the quota. Other brands
-- are not held up.
--
-- The server also asks how much is used before it uploads (brand_storage_used), so a
-- refused file is not sent to storage at all. That check is only a courtesy; this trigger
-- is the rule.

-- 500 MB, counted as 500 x 1024 x 1024 bytes. lib/storage/quota.ts holds the same number
-- and a database test checks that the two agree.
create function private.brand_storage_quota()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 524288000::bigint; $$;

create function private.files_within_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used bigint;
  v_quota bigint := private.brand_storage_quota();
begin
  -- One writer per brand at a time. Held until the inserting transaction ends.
  perform 1 from public.brands b where b.id = new.brand_id for update;

  select coalesce(sum(f.bytes), 0) into v_used
  from public.files f
  where f.brand_id = new.brand_id and f.id <> new.id;

  if v_used + new.bytes > v_quota then
    raise exception 'The brand''s storage quota is used up.'
      using errcode = 'KWQ01',
            detail = format('used %s, adding %s, quota %s bytes', v_used, new.bytes, v_quota);
  end if;
  return new;
end;
$$;

create trigger files_within_quota
  before insert or update of bytes, brand_id on public.files
  for each row execute function private.files_within_quota();

-- How many bytes a brand's files take. Server only.
create function public.brand_storage_used(p_brand_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(f.bytes), 0)::bigint from public.files f where f.brand_id = p_brand_id;
$$;

comment on function public.brand_storage_used(uuid) is
  'Bytes stored for a brand, to refuse an upload early. The files_within_quota trigger is the rule. Server only.';

revoke all on function private.brand_storage_quota() from public, anon, authenticated;
revoke all on function private.files_within_quota() from public, anon, authenticated;
revoke all on function public.brand_storage_used(uuid) from public, anon, authenticated;
grant execute on function private.brand_storage_quota() to service_role;
grant execute on function public.brand_storage_used(uuid) to service_role;
