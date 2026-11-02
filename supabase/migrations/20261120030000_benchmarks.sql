-- Benchmarks: compare products (plan v5, wave 3, workstream Z3; decision 0084; spec F-S2).
--
-- Three tables, read by members of the brand and written only by the server through the functions below:
--   benchmarks        one comparison, optionally tied to a design. It holds 2 to 5 cards.
--   benchmark_cards   one card per source: the derived facts in a fixed shape, plus the source URL and nothing else.
--                     There is no column for a page's source, a third-party picture or a reviewer's words, and the
--                     constraints below refuse any string that carries markup, so a copy cannot be stored by mistake
--                     (spec F-S2 "Stored").
--   benchmark_fetches one row per URL per brand, which is what makes a page fetched **once**: the unique index is the
--                     promise, not the code. The row also carries the host, so the per-brand rate limit can be
--                     audited after the fact.
--
-- A card's photo is the member's own upload, kept in their brand's own files; `source_file_id` names it. A
-- third-party image is never fetched and never has a row.

create table public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- The design this comparison is for, when there is one. The function checks it belongs to the same brand.
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, brand_id)
);

comment on table public.benchmarks is
  'One product comparison (spec F-S2). Written by benchmark_create only; read by members of the brand.';

create index benchmarks_brand_idx on public.benchmarks (brand_id, created_at desc);
create index benchmarks_project_idx on public.benchmarks (project_id) where project_id is not null;

create table public.benchmark_cards (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  benchmark_id uuid not null,
  source_kind text not null check (source_kind in ('url', 'photo', 'review_text')),
  -- The source URL, which the spec does keep. Never the page behind it.
  source_url text check (source_url is null or (length(source_url) <= 2048 and source_url ~* '^https?://')),
  source_host text check (source_host is null or length(source_host) between 1 and 255),
  -- The member's own photograph, in their brand's files. Never a third-party image.
  source_file_id uuid references public.files (id) on delete set null,
  -- The card itself: the fixed schema of lib/benchmarks/schema.ts, every field saying how it is known.
  card jsonb not null,
  -- "stub", or the model id that read it, so a reader knows what read the card.
  extractor text not null check (length(btrim(extractor)) between 1 and 120),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (benchmark_id, brand_id) references public.benchmarks (id, brand_id) on delete cascade,
  constraint benchmark_cards_url_only_for_a_url check ((source_kind = 'url') = (source_url is not null)),
  constraint benchmark_cards_host_goes_with_url check (source_host is null or source_url is not null),
  constraint benchmark_cards_photo_names_a_file check (source_kind = 'photo' or source_file_id is null),
  constraint benchmark_cards_card_is_an_object check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 20000),
  -- Nothing out of a page's source is ever stored: no tag, no tag opening, no HTML entity, anywhere in the card.
  constraint benchmark_cards_no_markup check (
    card::text !~ '[<>]' and card::text !~* '&([a-z]{2,10}|#[0-9]{1,6}|#x[0-9a-f]{1,5});'
  ),
  constraint benchmark_cards_confirmation_whole check ((confirmed_at is null) = (confirmed_by is null))
);

comment on table public.benchmark_cards is
  'One benchmark card: derived facts and the source URL only (spec F-S2 "Stored"). No page source, no third-party image, no review text.';

create index benchmark_cards_benchmark_idx on public.benchmark_cards (benchmark_id, created_at, id);
create index benchmark_cards_brand_idx on public.benchmark_cards (brand_id, created_at desc);

create table public.benchmark_fetches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- The normalised URL's SHA-256, as 64 hex digits (lib/benchmarks/fetch.ts urlKey). The URL itself is on the card.
  url_sha256 text not null check (url_sha256 ~ '^[0-9a-f]{64}$'),
  host text not null check (length(btrim(host)) between 1 and 255),
  outcome text not null default 'claimed' check (outcome in ('claimed', 'fetched', 'robots_refused', 'failed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  -- One fetch of one page per brand, for good: this index is what "fetched once" means.
  unique (brand_id, url_sha256)
);

comment on table public.benchmark_fetches is
  'One row per URL per brand (spec F-S2 step 2: the server fetches each URL once). Written by benchmark_fetch_claim and benchmark_fetch_settle.';

create index benchmark_fetches_rate_idx on public.benchmark_fetches (brand_id, created_at desc);
create index benchmark_fetches_host_idx on public.benchmark_fetches (brand_id, host, created_at desc);

-- A fetch record says a page was read. That can never be unsaid: only the outcome is filled in, once.
create function private.guard_benchmark_fetch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mutable constant text[] := array['outcome', 'settled_at', 'created_by'];
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.brands b where b.id = old.brand_id) then
      return old;
    end if;
    raise exception 'A benchmark fetch record can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
  end if;
  if (to_jsonb(new) - v_mutable) is distinct from (to_jsonb(old) - v_mutable) then
    raise exception 'A benchmark fetch record can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
  end if;
  -- The outcome is written once. The one exception: a page we tried and could not reach was never read, so the person
  -- may try it again, and 'failed' goes back to 'claimed'. 'fetched' and 'robots_refused' are final — the first means
  -- the page has been read, which is the thing that happens once, and the second means the site said no.
  if new.outcome is distinct from old.outcome
     and not (old.outcome = 'claimed' or (old.outcome = 'failed' and new.outcome = 'claimed')) then
    raise exception 'A benchmark fetch record can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
  end if;
  -- A deleted account's id is cleared by the foreign key, which is an update. Clearing is all it may do.
  if new.created_by is distinct from old.created_by and new.created_by is not null then
    raise exception 'A benchmark fetch record can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_benchmark_fetch() from public, anon, authenticated;

create trigger benchmark_fetches_are_append_only
  before update or delete on public.benchmark_fetches
  for each row execute function private.guard_benchmark_fetch();

create function private.refuse_benchmark_truncate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'A benchmark fetch record can never be changed or removed.' using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.refuse_benchmark_truncate() from public, anon, authenticated;

create trigger benchmark_fetches_are_not_truncated
  before truncate on public.benchmark_fetches
  for each statement execute function private.refuse_benchmark_truncate();

-- The provenance rules of lib/benchmarks/schema.ts, in the database too, so a card that explains itself badly cannot
-- be stored by a caller that skipped the parser: every field says how it is known, a field that is not known holds no
-- value, and a price or a GSM is stated or not known — never read off a picture (plan rule: no invented measurement).
create function private.benchmark_card_fault(p_card jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_named constant text[] := array['productName', 'brandName', 'price', 'fabricComposition', 'gsm', 'fit', 'sizeRange'];
  v_lists constant text[] := array['features', 'claims', 'complaintThemes', 'surfaceLayout'];
  v_name text;
  v_field jsonb;
begin
  if p_card is null or jsonb_typeof(p_card) <> 'object' then
    return 'A card is an object.';
  end if;
  foreach v_name in array v_named loop
    v_field := p_card -> v_name;
    if v_field is null or jsonb_typeof(v_field) <> 'object' then
      return format('The card has no %s field.', v_name);
    end if;
    if (v_field ->> 'provenance') is null or (v_field ->> 'provenance') not in ('observed', 'inferred', 'unknown') then
      return format('%s does not say how it is known.', v_name);
    end if;
    if ((v_field ->> 'provenance') = 'unknown') <> (coalesce(jsonb_typeof(v_field -> 'value'), 'null') = 'null') then
      return format('%s holds a value it cannot explain, or explains a value it does not hold.', v_name);
    end if;
    if v_name in ('price', 'gsm') and (v_field ->> 'provenance') = 'inferred' then
      return format('%s is stated or not known: a measurement is never read off a picture.', v_name);
    end if;
  end loop;
  foreach v_name in array v_lists loop
    if coalesce(jsonb_typeof(p_card -> v_name), '') <> 'array' then
      return format('The card has no %s list.', v_name);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function private.benchmark_card_fault(jsonb) from public, anon, authenticated;

revoke all on public.benchmarks, public.benchmark_cards, public.benchmark_fetches
  from public, anon, authenticated, service_role;
grant select on public.benchmarks, public.benchmark_cards, public.benchmark_fetches to authenticated, service_role;

alter table public.benchmarks enable row level security;
alter table public.benchmark_cards enable row level security;
alter table public.benchmark_fetches enable row level security;

create policy "members read their brand's benchmarks"
  on public.benchmarks for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's benchmark cards"
  on public.benchmark_cards for select to authenticated
  using (private.is_member(brand_id));

create policy "members read their brand's benchmark fetches"
  on public.benchmark_fetches for select to authenticated
  using (private.is_member(brand_id));

-- There are no insert, update or delete policies, on purpose.

-- A new comparison. The design, when one is named, must belong to the same brand.
create function public.benchmark_create(p_brand_id uuid, p_user_id uuid, p_project_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  if length(v_title) not between 1 and 120 then
    raise exception 'Give the comparison a name, up to 120 characters.' using errcode = '22023', hint = 'invalid_input';
  end if;
  if p_project_id is not null
     and not exists (select 1 from public.projects p where p.id = p_project_id and p.brand_id = p_brand_id) then
    raise exception 'That design could not be found.' using errcode = 'P0002';
  end if;
  insert into public.benchmarks (brand_id, project_id, title, created_by)
  values (p_brand_id, p_project_id, v_title, p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Asks to read one page for this brand. 'ok' means the brand may read it now; 'already' means it has been read, or the
-- site refused it, and the caller shows the card it already has rather than fetching again. A page the brand tried and
-- could not reach was never read, so it may be tried again — still within the brand's rate limit.
create function public.benchmark_fetch_claim(p_brand_id uuid, p_user_id uuid, p_url_sha256 text, p_host text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  insert into public.benchmark_fetches (brand_id, url_sha256, host, created_by)
  values (p_brand_id, lower(p_url_sha256), lower(btrim(p_host)), p_user_id)
  on conflict (brand_id, url_sha256) do nothing;
  if found then
    return 'ok';
  end if;
  update public.benchmark_fetches
  set outcome = 'claimed', settled_at = null
  where brand_id = p_brand_id and url_sha256 = lower(p_url_sha256) and outcome = 'failed';
  if found then
    return 'ok';
  end if;
  return 'already';
end;
$$;

-- What came of the fetch. Written once; the record of the attempt itself never goes.
create function public.benchmark_fetch_settle(p_brand_id uuid, p_url_sha256 text, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome not in ('fetched', 'robots_refused', 'failed') then
    raise exception 'Say what came of the fetch.' using errcode = '22023', hint = 'invalid_input';
  end if;
  update public.benchmark_fetches
  set outcome = p_outcome, settled_at = now()
  where brand_id = p_brand_id and url_sha256 = lower(p_url_sha256) and outcome = 'claimed';
end;
$$;

-- One card on a comparison. At most five (spec F-S2 step 5), counted under a lock so two at once cannot both pass.
create function public.benchmark_card_add(
  p_brand_id uuid,
  p_user_id uuid,
  p_benchmark_id uuid,
  p_source_kind text,
  p_source_url text,
  p_source_host text,
  p_source_file_id uuid,
  p_card jsonb,
  p_extractor text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_fault text;
  v_held integer;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.benchmarks b where b.id = p_benchmark_id and b.brand_id = p_brand_id) then
    raise exception 'That benchmark could not be found.' using errcode = 'P0002';
  end if;
  v_fault := private.benchmark_card_fault(p_card);
  if v_fault is not null then
    raise exception '%', v_fault using errcode = '22023', hint = 'invalid_card';
  end if;
  if p_source_file_id is not null
     and not exists (select 1 from public.files f where f.id = p_source_file_id and f.brand_id = p_brand_id) then
    raise exception 'That photo could not be found.' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('benchmark:' || p_benchmark_id::text, 0));
  select count(*) into v_held from public.benchmark_cards c where c.benchmark_id = p_benchmark_id;
  if v_held >= 5 then
    raise exception 'A comparison holds 5 cards at most.' using errcode = '22023', hint = 'too_many_cards';
  end if;
  insert into public.benchmark_cards
    (brand_id, benchmark_id, source_kind, source_url, source_host, source_file_id, card, extractor, created_by)
  values
    (p_brand_id, p_benchmark_id, p_source_kind, p_source_url, nullif(lower(btrim(coalesce(p_source_host, ''))), ''),
     p_source_file_id, p_card, btrim(p_extractor), p_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- A person confirms or corrects the card (spec F-S2 step 4). The card is replaced by what they settled on, and the
-- confirmation is recorded against them. A card is confirmed once; a later correction is a change, not a new one.
create function public.benchmark_card_confirm(p_brand_id uuid, p_user_id uuid, p_card_id uuid, p_card jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fault text;
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  v_fault := private.benchmark_card_fault(p_card);
  if v_fault is not null then
    raise exception '%', v_fault using errcode = '22023', hint = 'invalid_card';
  end if;
  update public.benchmark_cards
  set card = p_card, confirmed_at = now(), confirmed_by = p_user_id
  where id = p_card_id and brand_id = p_brand_id;
  if not found then
    raise exception 'That card could not be found.' using errcode = 'P0002';
  end if;
end;
$$;

-- A member removes a card they no longer want compared. The comparison itself goes with the design or the brand.
create function public.benchmark_card_remove(p_brand_id uuid, p_user_id uuid, p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.belongs_to(p_user_id, p_brand_id) then
    raise exception 'That brand does not exist.' using errcode = 'P0002';
  end if;
  delete from public.benchmark_cards where id = p_card_id and brand_id = p_brand_id;
  if not found then
    raise exception 'That card could not be found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.benchmark_create(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.benchmark_fetch_claim(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.benchmark_fetch_settle(uuid, text, text) from public, anon, authenticated;
revoke all on function public.benchmark_card_add(uuid, uuid, uuid, text, text, text, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.benchmark_card_confirm(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.benchmark_card_remove(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.benchmark_create(uuid, uuid, uuid, text) to service_role;
grant execute on function public.benchmark_fetch_claim(uuid, uuid, text, text) to service_role;
grant execute on function public.benchmark_fetch_settle(uuid, text, text) to service_role;
grant execute on function public.benchmark_card_add(uuid, uuid, uuid, text, text, text, uuid, jsonb, text) to service_role;
grant execute on function public.benchmark_card_confirm(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.benchmark_card_remove(uuid, uuid, uuid) to service_role;
