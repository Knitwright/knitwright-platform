-- What one garment consumes, per bill-of-materials line (plans/platform-v5.md section 6 item 2, the last of the
-- three unowned tables; decision 0101; decision 0070 revision 2, "Still owed after this revision").
--
-- Decision 0070 left three values with no table: the article's bill of materials with its consumption, the
-- care-label wording per market, and the AQL plan per factory. Z8 (decision 0089) added the last two. This adds
-- the first, and it is the one that stops the F-G2 gate refusing every real package for want of a quantity.
--
-- A CONSUMPTION IS A MEASUREMENT, SO NOTHING HERE IS INVENTED. One row is one figure an article really
-- publishes, quoted from the file that publishes it:
--
--   * Only JSY-SS-01 publishes a bill of materials at all. Its five figures that the package's BOM can carry
--     are seeded below, each with the exact words of its own `consumption` field in
--     docs/spec/articles/JSY-SS-01/article.json, and each labelled as that file labels them: a Knitwright draft
--     at version 0.1, a placeholder the factory confirms from the marker. No factory has agreed any of them.
--   * The other seven base articles publish no bill of materials and no measurement at all (decision 0090: seven
--     of the eight have empty point-of-measure tables). So NOTHING is seeded for them, and the gate goes on
--     refusing a package for them and naming the line it has no quantity for. A package that looks complete on
--     invented numbers is far worse than one that is refused: a factory would cut fabric to it.
--
-- The figure is text, not a number, because the package quotes what the article publishes rather than a figure
-- re-rounded on the way through: '0.80' stays '0.80' on the BOM a factory reads, and `0.80::numeric` would not.
-- A check still insists it parses as a positive number, so a word can never be stored in its place.
--
-- One row per article, item and VERSION, and nothing is ever changed or removed: a factory's own confirmed figure
-- is the next version of that line, and the read takes the newest version of each item. So the draft that was in
-- the package yesterday can still be found after the factory replaces it.
--
-- Rights follow the rulebook (decision 0067) and the option code map (decision 0099): every signed-in member
-- reads it, because the tech pack's BOM tab shows it; the server's key holds SELECT only and writes through
-- bom_consumption_record, which refuses anyone who is not a platform admin with "not found" (P0002), exactly as
-- rulebook_entry_save does.
--
-- rule_id: every row says which rulebook entry explains it (plan v5, "Every rule explains itself"). No rulebook
-- entry states a consumption figure, so what each row names is the entry that explains the ITEM: R-SUB-001 for
-- the sublimation fabric, R-CON-009 for the two threads (article.json's own `thread.rule`) and R-LAB-002 for the
-- care label (its own construction step's rule). The rib line has no entry of any kind and so carries
-- R-GAP-000. All four are seeded in draft by 20261101020000_rulebook.sql.

create table public.bom_consumption (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.base_articles (id) on delete cascade,
  -- The bill-of-materials item, as lib/kpp/input/materials.ts (BOM_ITEM_IDS) names it. Only the four shapes that
  -- file can carry are allowed: a row the package could never read would be clutter, not data.
  item_id text not null check (item_id ~ '^(fabric:[A-Z0-9][A-Z0-9-]{0,30}|thread:needle|thread:looper|label:care)$'),
  version integer not null check (version >= 1),
  -- The figure as its source publishes it, trailing zero and all. The two checks together insist it reads as a
  -- number greater than zero, so neither a word nor a nothing can be stored where a quantity belongs.
  qty_per_piece text not null
    check (qty_per_piece ~ '^[0-9]{1,6}(\.[0-9]{1,3})?$' and qty_per_piece !~ '^0+(\.0+)?$'),
  unit text not null check (unit in ('m', 'm2', 'pc', 'g')),
  -- True when the figure is for one size only and every other size needs its own, as a marker gives it.
  size_dependent boolean not null default false,
  -- The published file the figure is quoted from, from the repository root.
  source_file text not null check (length(btrim(source_file)) between 1 and 300),
  -- Where the number came from, in words: what the package's BOM line says about it, and what the README prints.
  source_label text not null check (length(btrim(source_label)) between 1 and 300),
  -- The words of that file, quoted, so a test can fail when the figure and the file disagree.
  source_quote text not null check (length(btrim(source_quote)) between 1 and 300),
  -- True only once a factory has agreed the figure from its own marker. No seeded row is confirmed.
  confirmed boolean not null default false,
  rule_id text not null default 'R-GAP-000' check (rule_id ~ '^R-[A-Z]+-[0-9]{3}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (article_id, item_id, version)
);

comment on table public.bom_consumption is
  'What one garment consumes per bill-of-materials line, quoted from the file that publishes it. One row per version of a line; never overwritten. Written by bom_consumption_record only (decision 0101).';
comment on column public.bom_consumption.qty_per_piece is
  'The figure as its source publishes it, as text, so the package quotes it rather than re-rounding it. A check insists it parses as a positive number.';
comment on column public.bom_consumption.confirmed is
  'True only once a factory has agreed the figure from its own marker. Every seeded row is false: a consumption is a measurement and no factory has confirmed one.';

create index bom_consumption_article_idx on public.bom_consumption (article_id, item_id);

-- ---------------------------------------------------------------------------------------------
-- A figure never changes and no row is removed. The one update allowed is the account behind created_by being
-- erased (on delete set null). A new figure is the next version of the line, which is what keeps the figure a
-- package was built on findable after a factory replaces it.

create function private.guard_bom_consumption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nested, so NEW and OLD are read only for a row update (they are not set for a truncate).
  if tg_op = 'UPDATE' then
    if (new.id, new.article_id, new.item_id, new.version, new.qty_per_piece, new.unit, new.size_dependent,
        new.source_file, new.source_label, new.source_quote, new.confirmed, new.rule_id, new.created_at)
       is not distinct from
       (old.id, old.article_id, old.item_id, old.version, old.qty_per_piece, old.unit, old.size_dependent,
        old.source_file, old.source_label, old.source_quote, old.confirmed, old.rule_id, old.created_at)
       and (new.created_by is null or new.created_by = old.created_by) then
      return new;
    end if;
  end if;
  raise exception 'A consumption figure can never be changed or removed; record a new version instead.'
    using errcode = 'P0001', hint = 'append_only';
end;
$$;

revoke all on function private.guard_bom_consumption() from public, anon, authenticated;

create trigger bom_consumption_is_versioned
  before update or delete on public.bom_consumption
  for each row execute function private.guard_bom_consumption();

create trigger bom_consumption_is_not_truncated
  before truncate on public.bom_consumption
  for each statement execute function private.guard_bom_consumption();

-- ---------------------------------------------------------------------------------------------
-- Rights, as the rulebook's (decision 0067): members read, the server's key reads and writes through the
-- function below only.

revoke all on public.bom_consumption from public, anon, authenticated, service_role;
grant select on public.bom_consumption to authenticated, service_role;

alter table public.bom_consumption enable row level security;

create policy "members read bom consumption"
  on public.bom_consumption for select to authenticated
  using (exists (select 1 from public.memberships m where m.user_id = (select auth.uid())));

-- There are no insert, update or delete policies, on purpose.

-- ---------------------------------------------------------------------------------------------
-- Recording a figure: the next version of one line of one article. Returns the new version number.

create function public.bom_consumption_record(
  p_actor uuid, p_article_code text, p_item_id text, p_qty_per_piece text, p_unit text,
  p_size_dependent boolean, p_source_file text, p_source_label text, p_source_quote text, p_confirmed boolean,
  p_rule_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_article uuid;
  v_version integer;
begin
  if p_actor is null or not exists (select 1 from public.platform_admins a where a.user_id = p_actor) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  select a.id into v_article from public.base_articles a where a.code = p_article_code;
  if v_article is null then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  -- Two recordings of the same line at once take turns, so each gets its own version number.
  perform pg_advisory_xact_lock(hashtext('bom_consumption:' || p_article_code || ':' || p_item_id));
  select coalesce(max(c.version), 0) + 1 into v_version
    from public.bom_consumption c where c.article_id = v_article and c.item_id = p_item_id;
  insert into public.bom_consumption
    (article_id, item_id, version, qty_per_piece, unit, size_dependent, source_file, source_label, source_quote,
     confirmed, rule_id, created_by)
  values
    (v_article, p_item_id, v_version, p_qty_per_piece, p_unit, coalesce(p_size_dependent, false), p_source_file,
     p_source_label, p_source_quote, coalesce(p_confirmed, false), coalesce(p_rule_id, 'R-GAP-000'), p_actor);
  return v_version;
end;
$$;

revoke all on function public.bom_consumption_record(uuid, text, text, text, text, boolean, text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.bom_consumption_record(uuid, text, text, text, text, boolean, text, text, text, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------------------------
-- Seed: JSY-SS-01's five published figures, each quoted from its own `consumption` field in
-- docs/spec/articles/JSY-SS-01/article.json. lib/kpp/sources/consumption-seed.test.ts reads every article's
-- article.json and this file and fails if a figure here is not in that file word for word, or if an article that
-- publishes a figure is missing from here, or if an article that publishes none has a row here.
--
-- The article publishes four more figures the package's BOM has no line for at all: the back neck tape (0.20 m),
-- the heat-transfer neck label (1 pc), the polybag (1 pc) and the sublimation transfer paper (about 1.6 m2, which
-- the article marks "for costing only"). lib/kpp/input/materials.ts builds fabric, thread and care-label lines and
-- no others, so a row for any of them could never be read. They are named in decision 0101 instead.

insert into public.bom_consumption
  (article_id, item_id, version, qty_per_piece, unit, size_dependent, source_file, source_label, source_quote,
   confirmed, rule_id)
values
  ((select id from public.base_articles where code = 'JSY-SS-01'), 'fabric:F-POLY-INT', 1, '0.80', 'm', true,
   'docs/spec/articles/JSY-SS-01/article.json',
   'Knitwright draft v0.1, placeholder consumption, factory confirms from the marker',
   '0.80 m at 180 cm width (size M, incl. bleed and press shrink)', false, 'R-SUB-001'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 'fabric:F-POLY-RIB', 1, '0.05', 'm', false,
   'docs/spec/articles/JSY-SS-01/article.json',
   'Knitwright draft v0.1, placeholder consumption, factory confirms from the marker',
   '0.05 m', false, 'R-GAP-000'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 'thread:needle', 1, '60', 'm', false,
   'docs/spec/articles/JSY-SS-01/article.json',
   'Knitwright draft v0.1, placeholder consumption, factory confirms from the marker',
   '60 m', false, 'R-CON-009'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 'thread:looper', 1, '110', 'm', false,
   'docs/spec/articles/JSY-SS-01/article.json',
   'Knitwright draft v0.1, placeholder consumption, factory confirms from the marker',
   '110 m', false, 'R-CON-009'),
  ((select id from public.base_articles where code = 'JSY-SS-01'), 'label:care', 1, '1', 'pc', false,
   'docs/spec/articles/JSY-SS-01/article.json',
   'Knitwright draft v0.1, placeholder consumption, factory confirms from the marker',
   '1 pc', false, 'R-LAB-002');
