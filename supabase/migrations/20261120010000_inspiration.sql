-- The inspiration board (plans/platform-v5.md, wave 3, Z1; spec F-S1; decision 0082).
--
-- Two things are stored, and only two:
--   * design_moodboards / moodboard_items: the cards a person saved, as an address, a preview address and the
--     attribution words. Nothing else. No third-party HTML, no copy of anyone's picture, no bytes at all. The column
--     checks below say so: every address must be https, and `data:`, `blob:` and `file:` are refused by name, because
--     those three are the ways a picture itself could be smuggled into a text column.
--   * inspiration_tag_steers: the tags a person pinned or removed, so the board does not keep offering back a tag
--     they threw away. A tag with no row is simply whatever the design implies.
--
-- Nothing here holds a suggestion. A suggestion is worked out again from the design every time, because it is only
-- ever shown after validation (X4) has looked at the design as it is now; a stored suggestion would be a stale one.
--
-- Both tables are brand-scoped with row level security on. Members read their brand's rows; nobody writes directly.
-- Each write is a SECURITY DEFINER function only the server's own key may run, and each checks the caller's
-- membership itself. Items go with their moodboard, a moodboard with its design, and a design with its brand.

create table public.design_moodboards (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  project_id uuid not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id),
  -- One moodboard per design.
  unique (brand_id, project_id),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.design_moodboards is
  'One moodboard per design: the inspiration a person saved. Written by the server only (decision 0082).';

-- An address we may keep: https only, and never the picture itself.
create function private.is_reference_url(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url is not null
     and length(p_url) between 8 and 2048
     and p_url like 'https://%'
     and p_url !~* '^(data|blob|file):';
$$;

revoke all on function private.is_reference_url(text) from public, anon, authenticated;

create table public.moodboard_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  moodboard_id uuid not null,
  -- The card's source, in the words of lib/inspiration/vocabulary.ts. The code checks the same list.
  source text not null check (source in ('knitwright-library', 'pinterest-board', 'unsplash', 'pexels', 'link-preview', 'ai-mood')),
  title text not null check (length(btrim(title)) between 1 and 200),
  -- Where the card opens, and the picture the provider serves. Hotlinked, never copied.
  open_url text not null check (private.is_reference_url(open_url)),
  preview_url text not null check (private.is_reference_url(preview_url)),
  -- { creator, creatorUrl, provider, providerUrl, notice }: the words each provider's terms ask us to show.
  attribution jsonb not null check (
    jsonb_typeof(attribution) = 'object'
    and pg_column_size(attribution) < 2048
    and attribution ? 'provider'
    and attribution ? 'notice'
  ),
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  unique (id, brand_id),
  -- The same card is saved once per moodboard. A second press changes nothing.
  unique (moodboard_id, open_url),
  foreign key (moodboard_id, brand_id) references public.design_moodboards (id, brand_id) on delete cascade
);

comment on table public.moodboard_items is
  'A saved inspiration card: its address, its preview address and its attribution. No picture and no page is ever stored here.';

create index moodboard_items_board_idx on public.moodboard_items (brand_id, moodboard_id, added_at desc);

create table public.inspiration_tag_steers (
  brand_id uuid not null,
  project_id uuid not null,
  -- Lower case, trimmed, as lib/inspiration/context-query.ts writes it.
  tag text not null check (tag = lower(btrim(tag)) and length(tag) between 1 and 40),
  state text not null check (state in ('pinned', 'removed')),
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (brand_id, project_id, tag),
  foreign key (project_id, brand_id) references public.projects (id, brand_id) on delete cascade
);

comment on table public.inspiration_tag_steers is
  'The tags a person pinned or removed on one design''s inspiration board. Written by the server only.';

revoke all on public.design_moodboards, public.moodboard_items, public.inspiration_tag_steers
  from public, anon, authenticated, service_role;
grant select on public.design_moodboards, public.moodboard_items, public.inspiration_tag_steers
  to authenticated, service_role;

alter table public.design_moodboards enable row level security;
alter table public.moodboard_items enable row level security;
alter table public.inspiration_tag_steers enable row level security;

create policy "members read their brand's moodboards"
  on public.design_moodboards for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's moodboard items"
  on public.moodboard_items for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's inspiration tags"
  on public.inspiration_tag_steers for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies on any of the three, on purpose.

create function private.moodboard_limit()
returns integer language sql immutable set search_path = '' as $$ select 60 $$;
revoke all on function private.moodboard_limit() from public, anon, authenticated;

-- Saves one card on a design's moodboard, making the moodboard on first use. Returns the item's id; saving the same
-- address again answers with the item already there, so a double press is one item.
create function public.save_moodboard_item(
  p_brand_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_source text,
  p_title text,
  p_open_url text,
  p_preview_url text,
  p_attribution jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board uuid;
  v_id uuid;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.brand_id = p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if not private.is_reference_url(p_open_url) or not private.is_reference_url(p_preview_url) then
    raise exception 'Only a picture a provider serves can be saved to a moodboard; nothing is copied here.'
      using errcode = '22023', hint = 'not_a_reference';
  end if;

  insert into public.design_moodboards (brand_id, project_id, created_by)
  values (p_brand_id, p_project_id, p_user_id)
  on conflict (brand_id, project_id) do nothing;
  select m.id into v_board from public.design_moodboards m
  where m.brand_id = p_brand_id and m.project_id = p_project_id;

  select i.id into v_id from public.moodboard_items i where i.moodboard_id = v_board and i.open_url = p_open_url;
  if found then
    return v_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('moodboard:' || v_board::text, 0));
  if (select count(*) from public.moodboard_items i where i.moodboard_id = v_board) >= private.moodboard_limit() then
    raise exception 'A moodboard holds 60 items. Remove one to save another.' using errcode = 'P0001', hint = 'moodboard_full';
  end if;

  insert into public.moodboard_items (brand_id, moodboard_id, source, title, open_url, preview_url, attribution, added_by)
  values (p_brand_id, v_board, p_source, btrim(p_title), p_open_url, p_preview_url, p_attribution, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Removes one saved item. A moodboard is a person's own notes, so any member of the brand may tidy it.
create function public.remove_moodboard_item(p_brand_id uuid, p_user_id uuid, p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gone integer;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That item does not exist.' using errcode = 'P0002';
  end if;
  delete from public.moodboard_items where id = p_item_id and brand_id = p_brand_id;
  get diagnostics v_gone = row_count;
  return v_gone > 0;
end;
$$;

-- Pins or removes one tag of a design's context query, or clears the steer when p_state is null.
create function public.set_inspiration_tag(p_brand_id uuid, p_user_id uuid, p_project_id uuid, p_tag text, p_state text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag text := lower(btrim(coalesce(p_tag, '')));
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.brand_id = p_brand_id) then
    raise exception 'That design does not exist.' using errcode = 'P0002';
  end if;
  if length(v_tag) not between 1 and 40 then
    raise exception 'A tag is 1 to 40 characters.' using errcode = '22023', hint = 'invalid_tag';
  end if;
  if p_state is null then
    delete from public.inspiration_tag_steers
    where brand_id = p_brand_id and project_id = p_project_id and tag = v_tag;
    return;
  end if;
  if p_state not in ('pinned', 'removed') then
    raise exception 'A tag is pinned or removed.' using errcode = '22023', hint = 'invalid_state';
  end if;
  if (select count(*) from public.inspiration_tag_steers s
      where s.brand_id = p_brand_id and s.project_id = p_project_id) >= 40
     and not exists (select 1 from public.inspiration_tag_steers s
                     where s.brand_id = p_brand_id and s.project_id = p_project_id and s.tag = v_tag) then
    raise exception 'A design keeps 40 steered tags at most.' using errcode = 'P0001', hint = 'too_many_tags';
  end if;
  insert into public.inspiration_tag_steers (brand_id, project_id, tag, state, set_by)
  values (p_brand_id, p_project_id, v_tag, p_state, p_user_id)
  on conflict (brand_id, project_id, tag)
    do update set state = excluded.state, set_by = excluded.set_by, set_at = now();
end;
$$;

revoke all on function public.save_moodboard_item(uuid, uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.remove_moodboard_item(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_inspiration_tag(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_moodboard_item(uuid, uuid, uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.remove_moodboard_item(uuid, uuid, uuid) to service_role;
grant execute on function public.set_inspiration_tag(uuid, uuid, uuid, text, text) to service_role;
