-- Designs read from a picture (plans/production-outputs.md, workstream W7d).
--
-- A person hands over a mockup, a flat, a photo of a kit or a sketch; the server reads it into a
-- proposed artwork stack and a report. The proposal lives here, beside the project, and is NOT the
-- design: nothing reaches the project's versions until the person accepts it, and acceptance is
-- recorded on the row (who and when, and which layers). A discarded proposal keeps its row so the
-- cost of the reading stays on record.
--
-- Members read their own brand's rows. Only the server writes: there is no write grant and no write
-- policy for any browser role, as with pattern_jobs. The stack and report are JSON read by code
-- (lib/design-import/), so a newer shape never needs a column.

create table public.design_imports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid not null,
  -- The picture the person uploaded. If the file is deleted the reading goes with it.
  source_file_id uuid not null references public.files (id) on delete cascade,
  status text not null default 'reading'
    check (status in ('reading', 'ready', 'failed', 'accepted', 'discarded')),
  -- What was found, how sure, and what was left empty: lib/design-import/report.ts.
  report jsonb check (report is null or (jsonb_typeof(report) = 'object' and pg_column_size(report) < 65536)),
  -- The proposed stack (lib/artwork-stack ArtworkStack). A proposal until accepted.
  result_stack jsonb check (result_stack is null or (jsonb_typeof(result_stack) = 'object' and pg_column_size(result_stack) < 262144)),
  -- Where the landmarks were found, in the picture's pixels, so a moved handle can redo the fit.
  landmarks jsonb check (landmarks is null or (jsonb_typeof(landmarks) = 'object' and pg_column_size(landmarks) < 65536)),
  -- What the reading used, against the per-import budget, and what it cost in microdollars.
  vision_calls integer not null default 0 check (vision_calls between 0 and 3),
  image_edits integer not null default 0 check (image_edits between 0 and 2),
  cost_microdollars bigint not null default 0 check (cost_microdollars >= 0),
  -- A sentence that is safe to show. Never a provider's own error text.
  error text check (error is null or length(error) between 1 and 300),
  -- Layer ids the person accepted, set when status becomes accepted.
  accepted_layers text[] not null default '{}' check (cardinality(accepted_layers) <= 64),
  accepted_by uuid references auth.users (id) on delete restrict,
  accepted_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade,
  constraint design_imports_failed_has_error check (status <> 'failed' or error is not null),
  constraint design_imports_ready_has_result check (status not in ('ready', 'accepted') or (report is not null and result_stack is not null)),
  constraint design_imports_accepted_has_record check (
    (status = 'accepted') = (accepted_by is not null and accepted_at is not null)
  )
);

comment on table public.design_imports is
  'Designs read from a user''s picture: a proposed artwork stack and a report, not saved as the design until the person accepts. Written by the server only.';

create index design_imports_project_idx on public.design_imports (brand_id, project_id, created_at desc);

revoke all on public.design_imports from public, anon, authenticated;
grant select on public.design_imports to authenticated;
-- A reading is a record of what was asked and spent, so the server can add and change one, never remove it
-- (it goes with its project or its picture through the foreign keys).
revoke all on public.design_imports from service_role;
grant select, insert, update on public.design_imports to service_role;

alter table public.design_imports enable row level security;

create policy "members read their brand's design imports"
  on public.design_imports for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.
