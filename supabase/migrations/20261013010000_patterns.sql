-- Sewing patterns for a design: a DXF file of the pieces and a picture of them.
--
-- A member asks for a pattern of a design at one size. The request is recorded here as a
-- queued job, and whatever drafts patterns picks it up: for now the owner's own Claude
-- session through FashionInsta (the "claude-bridge"), later FashionInsta's API directly.
-- The browser polls the row. Members read their brand's pattern jobs. Only the server
-- writes: there is no write grant and no write policy for any browser role.

-- Pattern files are stored with the other files: the DXF in "exports", its picture in "images".
alter table public.files drop constraint files_kind_check;
alter table public.files add constraint files_kind_check
  check (kind in ('artwork', 'sketch', 'photo', 'render', 'export', 'chart', 'pattern'));

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/dxf'
]
where id = 'exports';

create table public.pattern_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid not null,
  -- The version of the design the pattern was asked for.
  version integer not null check (version >= 1),
  -- Who drafts it: the owner's Claude session for now, FashionInsta's API later.
  provider text not null check (provider in ('claude-bridge', 'fashioninsta')),
  -- What was asked for, written by the server from the design: garment, wearer, fit, size.
  request jsonb not null check (jsonb_typeof(request) = 'object' and pg_column_size(request) < 16384),
  size_label text not null check (length(size_label) between 1 and 16),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  -- The draft the pattern was made from, as the provider names it.
  draft text check (draft is null or length(draft) between 1 and 120),
  pieces integer check (pieces is null or pieces between 1 and 200),
  -- How the pattern was drafted, sentence by sentence, as the provider explains it.
  notes text[] not null default '{}' check (cardinality(notes) <= 40),
  dxf_file_id uuid references public.files (id) on delete set null,
  preview_file_id uuid references public.files (id) on delete set null,
  -- A sentence that is safe to show. Never a provider's own error text.
  error text check (error is null or length(error) between 1 and 300),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  constraint pattern_jobs_failed_has_error check (status <> 'failed' or error is not null),
  constraint pattern_jobs_succeeded_has_file check (status <> 'succeeded' or dxf_file_id is not null),
  constraint pattern_jobs_finished_has_time check (
    (status in ('succeeded', 'failed')) = (finished_at is not null)
  )
);

comment on table public.pattern_jobs is
  'Requests for a sewing pattern of a design, and their DXF and picture. The browser polls it. Written by the server only.';

create index pattern_jobs_project_idx on public.pattern_jobs (brand_id, project_id, created_at desc);
create index pattern_jobs_open_idx on public.pattern_jobs (created_at) where status in ('queued', 'running');

revoke all on public.pattern_jobs from public, anon, authenticated;
grant select on public.pattern_jobs to authenticated;
grant select, insert, update on public.pattern_jobs to service_role;

alter table public.pattern_jobs enable row level security;

create policy "members read their brand's pattern jobs"
  on public.pattern_jobs for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.
