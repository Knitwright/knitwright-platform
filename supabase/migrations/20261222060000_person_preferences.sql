-- A person's own preferences (plan v6 P6, decision 0144).
--
-- Settings' Units card (spec 09 screen 19: "Units (mm default for garments)"). The unit a person reads
-- garment lengths in: millimetres, centimetres or inches. It is a person's, not a brand's: two members
-- of one club may read the same size chart in different units, and nothing stored in a design changes
-- with it (the tech pack view's lengths are whole millimetres, lib/techpack/view/units.ts).
--
-- No row means the default, millimetres. A person reads their own row; only the server writes it,
-- through set_length_unit, called with the person from the session.
--
-- The row goes with the account (user_id on delete cascade). It holds no name or address.

create table public.person_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  length_unit text not null default 'mm' check (length_unit in ('mm', 'cm', 'in')),
  updated_at timestamptz not null default now()
);

comment on table public.person_preferences is
  'A person''s own display preferences (the unit garment lengths are read in). A person reads their own row. Written by set_length_unit only.';

revoke all on public.person_preferences from public, anon, authenticated, service_role;
grant select on public.person_preferences to authenticated, service_role;

alter table public.person_preferences enable row level security;

create policy "people read their own preferences"
  on public.person_preferences for select to authenticated
  using (user_id = (select auth.uid()));

-- There are no insert, update or delete policies, on purpose.

create function public.set_length_unit(p_user_id uuid, p_unit text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_unit is null or p_unit not in ('mm', 'cm', 'in') then
    raise exception 'That is not a unit garments can be read in.' using errcode = '22023';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'That person does not exist.' using errcode = 'P0002';
  end if;
  insert into public.person_preferences (user_id, length_unit, updated_at)
  values (p_user_id, p_unit, now())
  on conflict (user_id) do update
    set length_unit = excluded.length_unit, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.set_length_unit(uuid, text) from public, anon, authenticated;
grant execute on function public.set_length_unit(uuid, text) to service_role;
