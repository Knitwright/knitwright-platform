-- Who made each version, by name. Owner decision 2026-09-30: the tech pack's revision history
-- shows the person's name from their profile, or their email address when they have given no
-- name.
--
-- The profile is the person's Supabase Auth record: the name they set in Settings is kept in
-- its metadata as "display_name"; someone who signed in with Google may have "full_name" from
-- Google instead. No new table is needed.
--
-- A member may learn the names of the members of their own brand, and of no one else: the
-- function answers only for a brand the caller belongs to, and only with that brand's members.
-- Someone who made a version and has since left the brand is not named.

-- A name as it may be shown: control characters removed, spaces trimmed, at most 80 characters,
-- null when nothing is left.
create function private.shown_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 80), '');
$$;

create function public.brand_member_names(p_brand_id uuid)
returns table (user_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id,
         coalesce(
           private.shown_name(u.raw_user_meta_data ->> 'display_name'),
           private.shown_name(u.raw_user_meta_data ->> 'full_name'),
           u.email::text
         )
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.brand_id = p_brand_id
    and private.is_member(p_brand_id);
$$;

comment on function public.brand_member_names(uuid) is
  'The shown name (profile name, else email) of each member of a brand the caller belongs to. Nothing for any other brand.';

revoke all on function private.shown_name(text) from public, anon, authenticated;
revoke all on function public.brand_member_names(uuid) from public, anon, authenticated;
grant execute on function public.brand_member_names(uuid) to authenticated;
