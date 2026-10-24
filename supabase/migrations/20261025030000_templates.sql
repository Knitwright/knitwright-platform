-- Template library (plans/platform-v4.md, workstream V3, decision 0041).
--
-- A template is a finished design on a makeable article, owned by the platform, not by a brand. Using one
-- copies its snapshot into a new design (create_project, as the guided start does); a template never links live
-- to a design, and no row refers to another table, so migrations merge in any order.
--
-- Every signed-in user reads the library. Only the server writes: there is no write grant and no write policy for any
-- browser role, as with pattern_jobs, so even a platform admin writes through the service client, never the browser.

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  -- A stable name for a template, so the seed script can update a row instead of adding another.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  title text not null check (length(title) between 1 and 120 and title = btrim(title)),
  sport text not null check (sport in ('football', 'cricket', 'running', 'training', 'general')),
  -- The garment article the design is made on (a garment type id from the registry; checked by the server).
  article_id text not null check (article_id ~ '^[a-z0-9-]{1,64}$'),
  wearer text not null check (wearer in ('men', 'women', 'youth')),
  style_tags text[] not null check (cardinality(style_tags) between 1 and 8),
  colour_family text not null check (colour_family in ('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white', 'grey')),
  -- The full design as an immutable JSON snapshot. The server validates it against the registry before storing it.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 262144),
  -- Who made it. Designer templates are reserved and switched off: the check below refuses them until it is changed.
  source text not null default 'knitwright' check (source in ('knitwright', 'designer')),
  review_state text not null default 'not_reviewed' check (review_state in ('not_reviewed', 'reviewed')),
  reviewed_by text check (reviewed_by is null or length(reviewed_by) between 1 and 120),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint templates_designer_source_is_off check (source = 'knitwright'),
  constraint templates_review_names_a_person check (
    (review_state = 'reviewed') = (reviewed_by is not null)
    and (review_state = 'reviewed') = (reviewed_at is not null)
  )
);

comment on table public.templates is
  'Finished designs the library offers as starting points. Platform-owned; read by every signed-in user; written by the server only.';
comment on column public.templates.review_state is
  'not_reviewed until a factory has looked at it, with the name and date of the reviewer.';

create index templates_browse_idx on public.templates (sport, article_id, colour_family);

revoke all on public.templates from public, anon, authenticated;
grant select on public.templates to authenticated;
revoke all on public.templates from service_role;
grant select, insert, update, delete on public.templates to service_role;

alter table public.templates enable row level security;

create policy "signed-in users read the template library"
  on public.templates for select to authenticated
  using (true);

-- There are no insert, update or delete policies, on purpose.
