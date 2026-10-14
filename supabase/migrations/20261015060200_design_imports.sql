-- Design imports (plans/production-outputs.md, workstream W7d, decision 0038).
--
-- A person hands over a picture of a kit; the server reads it into a proposed artwork stack. The proposal is a
-- close reading, not a copy, and nothing becomes the design until the person accepts it: `accepted_stack` is null
-- until then. The proposal, the reading it came from (so a fit can be redone with no new vision call), the
-- report and the overlay are kept as JSON snapshots; no row refers to another workstream's tables, so
-- migrations merge in any order.
--
-- Members read their own brand's rows. Only the server writes: there is no write grant and no write policy for any
-- browser role, as with pattern_jobs. A row that has been accepted or discarded is never changed again.

create table public.design_imports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- The picture the person uploaded (a files row of the same brand; checked by the server, not by a foreign key).
  source_file_id uuid not null,
  -- The rights statement the person made before the picture was sent to the vision and image providers.
  rights_accepted_at timestamptz not null,
  status text not null default 'ready' check (status in ('ready', 'accepted', 'discarded')),
  -- The vision model's reply as validated, the report, the overlay and the proposed stack.
  reading jsonb not null check (jsonb_typeof(reading) = 'object' and pg_column_size(reading) < 65536),
  report jsonb not null check (jsonb_typeof(report) = 'object' and pg_column_size(report) < 65536),
  overlay jsonb not null check (jsonb_typeof(overlay) = 'object' and pg_column_size(overlay) < 65536),
  result jsonb not null check (jsonb_typeof(result) = 'object' and pg_column_size(result) < 262144),
  -- Null until the person accepts. Then the layers they chose, as a stack.
  accepted_stack jsonb check (accepted_stack is null or (jsonb_typeof(accepted_stack) = 'object' and pg_column_size(accepted_stack) < 262144)),
  accepted_layer_ids text[] check (accepted_layer_ids is null or cardinality(accepted_layer_ids) <= 64),
  accepted_by uuid references auth.users (id) on delete restrict,
  accepted_at timestamptz,
  -- What the import used, for the owner's cost view. Counts and whole microdollars, never a price list.
  vision_calls smallint not null default 0 check (vision_calls between 0 and 3),
  image_edits smallint not null default 0 check (image_edits between 0 and 2),
  cost_microdollars bigint not null default 0 check (cost_microdollars >= 0),
  generated_pixels boolean not null default false,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_imports_accept_is_complete check (
    (status = 'accepted') = (accepted_stack is not null and accepted_at is not null and accepted_by is not null)
  )
);

comment on table public.design_imports is
  'Designs read from a person''s picture. A proposal until accepted; accepted_stack is null before that. Written by the server only.';

create index design_imports_brand_idx on public.design_imports (brand_id, created_at desc);

-- A settled import (accepted or discarded) is a record: it is not changed again. Deleting a brand still removes it.
create function private.refuse_settled_import_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'ready' then
    raise exception 'An import that has been accepted or discarded cannot be changed.'
      using errcode = 'P0001', hint = 'settled';
  end if;
  return new;
end;
$$;

create trigger design_imports_settled_are_not_changed
  before update on public.design_imports
  for each row execute function private.refuse_settled_import_change();

revoke all on function private.refuse_settled_import_change() from public, anon, authenticated;
revoke all on public.design_imports from public, anon, authenticated;
grant select on public.design_imports to authenticated;
revoke all on public.design_imports from service_role;
grant select, insert, update on public.design_imports to service_role;

alter table public.design_imports enable row level security;

create policy "members read their brand's design imports"
  on public.design_imports for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.
