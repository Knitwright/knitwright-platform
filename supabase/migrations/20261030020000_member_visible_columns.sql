-- Finding L8 of the v4 security review (docs/reviews/security-v4.md): what members and designers read.
-- Nothing in an earlier migration is edited.

-- ---------------------------------------------------------------------------------------------
-- club_members. A member's shown name falls back to their email address only for a caller who manages
-- members (owner or admin), who sees the addresses on invitations anyway. Anyone else gets null for a member
-- without a profile name, and the app shows "A member". The caller comes from auth.uid(), never an argument.

create or replace function public.club_members(p_brand_id uuid)
returns table (user_id uuid, role text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role,
         coalesce(
           private.shown_name(u.raw_user_meta_data ->> 'display_name'),
           private.shown_name(u.raw_user_meta_data ->> 'full_name'),
           case when private.can_manage_members((select auth.uid()), p_brand_id) then u.email::text end
         )
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.brand_id = p_brand_id
    and private.is_member(p_brand_id)
  order by m.created_at, m.user_id;
$$;

-- Rights are unchanged by `create or replace`; stated again so this file shows them.
revoke all on function public.club_members(uuid) from public, anon, authenticated;
grant execute on function public.club_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- templates. Every signed-in user reads the library, but not who designed a designer template: the
-- attribution is the designer's shown name, and the account behind it is the server's business
-- (designer_record_use reads it with its owner's rights). The server's key keeps the whole table.

revoke select on public.templates from authenticated;
grant select (
  id, slug, title, sport, article_id, wearer, style_tags, colour_family, snapshot, source,
  review_state, reviewed_by, reviewed_at, created_at, updated_at, attribution
) on public.templates to authenticated;

-- ---------------------------------------------------------------------------------------------
-- royalty_accruals. As the designers migration says, a ledger line holds counts, not names: a designer (and a
-- platform admin in the browser) reads the template, the units and what they accrued, never the order, the
-- design or the release, which belong to the buying brand. The server's key keeps the whole table.

revoke select on public.royalty_accruals from authenticated;
grant select (id, seq, designer_id, template_id, units, rate_minor, currency, accrued_minor, created_at)
  on public.royalty_accruals to authenticated;
