-- Deleting a design, and deleting an account. Plan step 26, task 5.
--
-- Nothing here can be run by a browser. The server runs these functions with its own key after it
-- has identified the user, so each one checks membership itself, as the project functions do.
--
-- Stored files live in two places: a row in public.files and an object in storage. Supabase does
-- not let SQL remove storage objects; the server removes them through the storage API. So the
-- server asks first which files a deletion will take (the *_files and *_brands functions below),
-- removes those objects, then runs the deletion, which returns what it removed so that anything
-- added in between is removed too. A failure part way leaves rows that point at missing objects,
-- never objects that nothing points at, and running the deletion again finishes it.

-- The ids of the stored pictures that a design's artwork points at, in any of its versions.
-- A fileId that is not an id gives null, which matches no file.
create function private.artwork_file_ids(p_project_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct private.brand_id_from(art -> 'source' ->> 'fileId')
  from public.spec_versions v
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(v.spec -> 'artwork') = 'array' then v.spec -> 'artwork' else '[]'::jsonb end
  ) as art
  where v.project_id = p_project_id
    and art -> 'source' ->> 'kind' = 'file'
    and private.brand_id_from(art -> 'source' ->> 'fileId') is not null;
$$;

-- The stored files that belong to this design alone: pictures its artwork points at, in its
-- brand, that no other design of the brand points at in any version. A picture shared with
-- another design stays, and so does a picture no design uses (it is part of the brand's library).
create function private.files_of_project_alone(p_project_id uuid, p_brand_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.id
  from public.files f
  where f.brand_id = p_brand_id
    and f.id in (select private.artwork_file_ids(p_project_id))
    and not exists (
      select 1
      from public.projects other
      where other.brand_id = p_brand_id
        and other.id <> p_project_id
        and f.id in (select private.artwork_file_ids(other.id))
    );
$$;

-- Refuses unless the design exists, is in the brand the user is working in, and the user belongs
-- to that brand. A missing design and another brand's design give the same answer.
create function private.check_project_for_deletion(
  p_project_id uuid,
  p_brand_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.brand_id = p_brand_id
  ) or not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
end;
$$;

-- What deleting a design will remove from storage. Changes nothing.
create function public.project_deletion_files(
  p_project_id uuid,
  p_brand_id uuid,
  p_user_id uuid
)
returns table (bucket text, path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.check_project_for_deletion(p_project_id, p_brand_id, p_user_id);
  return query
    select f.bucket, f.path
    from public.files f
    where f.id in (select private.files_of_project_alone(p_project_id, p_brand_id))
    order by f.bucket, f.path;
end;
$$;

-- Deletes a design: its versions, its download records and the stored pictures that belong to it
-- alone. Returns the storage objects whose rows it removed, for the server to remove.
create function public.delete_project(
  p_project_id uuid,
  p_brand_id uuid,
  p_user_id uuid
)
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_files uuid[];
begin
  -- Taken in turn with any save to the same design, so no version is added part way.
  perform 1 from public.projects p where p.id = p_project_id for update;
  perform private.check_project_for_deletion(p_project_id, p_brand_id, p_user_id);

  select coalesce(array_agg(id), '{}') into v_files
  from private.files_of_project_alone(p_project_id, p_brand_id) as id;

  -- Versions and download records go with the design, through their keys. Their append-only
  -- locks let that delete through because the design is gone by then.
  delete from public.projects p where p.id = p_project_id;

  return query
    with gone as (
      delete from public.files f
      where f.id = any (v_files) and f.brand_id = p_brand_id
      returning f.bucket, f.path
    )
    select gone.bucket, gone.path from gone order by gone.bucket, gone.path;
end;
$$;

-- The brands an account's deletion removes: every brand the user belongs to. Refuses when a brand
-- has another member, because deleting it would delete someone else's work. The MVP has one role
-- and no invitations, so this cannot happen yet; the check is here for when teams arrive.
create function private.brands_of_account(p_user_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.memberships mine
    join public.memberships other
      on other.brand_id = mine.brand_id and other.user_id <> mine.user_id
    where mine.user_id = p_user_id
  ) then
    raise exception 'A brand you belong to has other members.'
      using errcode = 'P0001', hint = 'shared_brand';
  end if;

  return query
    select m.brand_id from public.memberships m where m.user_id = p_user_id
    order by m.brand_id;
end;
$$;

-- What deleting an account will remove: the brands, whose storage folders the server empties.
create function public.account_deletion_brands(p_user_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'That account does not exist.' using errcode = 'P0002';
  end if;
  return query select private.brands_of_account(p_user_id);
end;
$$;

-- Deletes everything an account owns in the database: its brands with their designs, versions,
-- download records, file rows and memberships, and its address on the sign-up allow list.
-- Returns the brands it deleted. The server then empties their storage folders and deletes the
-- user from Supabase Auth, which the database may not do itself.
create function public.delete_account_data(p_user_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brands uuid[];
  v_email text;
begin
  select lower(u.email) into v_email from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'That account does not exist.' using errcode = 'P0002';
  end if;

  -- Two deletions of one account at once are taken in turn, and so is a brand being created.
  perform pg_advisory_xact_lock(hashtextextended('create_brand:' || p_user_id::text, 0));

  select coalesce(array_agg(id), '{}') into v_brands from private.brands_of_account(p_user_id) as id;

  delete from public.brands b where b.id = any (v_brands);

  if v_email is not null then
    delete from private.signup_allowlist a where a.email = v_email;
  end if;

  return query select unnest(v_brands);
end;
$$;

revoke all on function private.artwork_file_ids(uuid) from public, anon, authenticated;
revoke all on function private.files_of_project_alone(uuid, uuid) from public, anon, authenticated;
revoke all on function private.check_project_for_deletion(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.brands_of_account(uuid) from public, anon, authenticated;

revoke all on function public.project_deletion_files(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_project(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.account_deletion_brands(uuid) from public, anon, authenticated;
revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;

grant execute on function public.project_deletion_files(uuid, uuid, uuid) to service_role;
grant execute on function public.delete_project(uuid, uuid, uuid) to service_role;
grant execute on function public.account_deletion_brands(uuid) to service_role;
grant execute on function public.delete_account_data(uuid) to service_role;
