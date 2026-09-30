-- Deletion, joined with photoreal images (step 14) and brand size charts (step 25). Integration of
-- plan step 26, task 5, with those steps, which were built on other branches.
--
-- 1. A person's jobs and imported charts are brand data. They must never stop that person's
--    account from being deleted. Today an account's brands go first, taking these rows with them;
--    when brands gain other members, the rows stay with the brand and lose only the name of who
--    made them. So the user keys become nullable and are set to null, not restricted.
-- 2. Deleting a design also deletes the photoreal pictures made of it: their rows and, through the
--    list the function returns, their objects in the images bucket.

alter table public.jobs alter column created_by drop not null;
alter table public.jobs drop constraint jobs_created_by_fkey;
alter table public.jobs
  add constraint jobs_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.brand_size_charts alter column imported_by drop not null;
alter table public.brand_size_charts drop constraint brand_size_charts_imported_by_fkey;
alter table public.brand_size_charts
  add constraint brand_size_charts_imported_by_fkey
  foreign key (imported_by) references auth.users (id) on delete set null;

-- The stored files that belong to this design alone: pictures its artwork points at, in its brand,
-- that no other design of the brand points at in any version, and every picture generated for it.
create or replace function private.files_of_project_alone(p_project_id uuid, p_brand_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.id
  from public.files f
  where f.brand_id = p_brand_id
    and (
      (
        f.id in (select private.artwork_file_ids(p_project_id))
        and not exists (
          select 1
          from public.projects other
          where other.brand_id = p_brand_id
            and other.id <> p_project_id
            and f.id in (select private.artwork_file_ids(other.id))
        )
      )
      or f.id in (
        select j.front_file_id from public.jobs j
        where j.project_id = p_project_id and j.brand_id = p_brand_id and j.front_file_id is not null
        union
        select j.back_file_id from public.jobs j
        where j.project_id = p_project_id and j.brand_id = p_brand_id and j.back_file_id is not null
      )
    );
$$;

revoke all on function private.files_of_project_alone(uuid, uuid) from public, anon, authenticated;
