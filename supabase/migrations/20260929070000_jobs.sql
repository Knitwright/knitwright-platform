-- Background jobs. Plan step 14, task 3. Decision record 0018.
--
-- Work that may outlast one request (a photoreal image takes several seconds for each
-- view) is started by a route, carried on with after(), and recorded here. The browser
-- polls the row. Members read their brand's jobs. Only the server writes: there is no
-- write grant and no write policy for any browser role.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid not null,
  -- The version of the design the images were made from.
  version integer not null check (version >= 1),
  kind text not null check (kind in ('photoreal')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  -- The reservation that paid for the job. Its cost is given back when the job fails.
  usage_event_id uuid references public.usage_events (id) on delete set null,
  front_file_id uuid references public.files (id) on delete set null,
  back_file_id uuid references public.files (id) on delete set null,
  -- A sentence that is safe to show. Never a provider's own error text.
  error text check (error is null or length(error) between 1 and 300),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  -- A finished job says how it finished.
  constraint jobs_failed_has_error check (status <> 'failed' or error is not null),
  constraint jobs_finished_has_time check (
    (status in ('succeeded', 'failed')) = (finished_at is not null)
  )
);

comment on table public.jobs is
  'Work carried on after a response, such as photoreal images. The browser polls it. Written by the server only.';

create index jobs_project_idx on public.jobs (brand_id, project_id, created_at desc);

revoke all on public.jobs from public, anon, authenticated;
grant select on public.jobs to authenticated;
grant select, insert, update on public.jobs to service_role;

alter table public.jobs enable row level security;

create policy "members read their brand's jobs"
  on public.jobs for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.
