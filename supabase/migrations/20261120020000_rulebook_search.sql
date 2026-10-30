-- Rulebook search, behind "Ask" and the best-practice card (plan v5, workstream Z2, decision 0083; spec F-S5 v2).
--
-- What this adds, and why:
--  * A `search` column on `rulebook_entries`: a weighted tsvector of the "Applies to" line, the rule, the why
--    and the best practice. It is GENERATED ALWAYS, so it is derived from the words of that version and can
--    never drift from them, and nothing ever writes it. Postgres full text needs no extension.
--  * A GIN index on it, so the search reads the index rather than the table.
--  * An index on (rule_id, version desc): workstream X2b's finding (decision 0067, revision section 5) is that
--    `rulesFor` reads every version and that PostgREST stops a read at max_rows = 1000, so the article, method
--    and status filters have to move into SQL before the table passes 500 versions. `rulebook_search` filters in
--    SQL from the start, and this index serves both it and the move X2b asked for.
--  * `rulebook_search(query, article_code, method, limit)`: the rules whose words match the question, ranked,
--    with how many of the question's words each one holds. It returns rule ids and scores only. Which VERSION of
--    a rule a reader may see is owner decision 11's business and stays in `lib/rulebook/select.ts` (`inForce`),
--    so a draft's words never reach a member through this function either.
--
-- pgvector: the extension is available in the pinned Supabase Postgres image (vector 0.8.2), so the plan's
-- condition is met, but it is NOT used. A vector search needs an embedding of every rule and of every question:
-- a paid model call per question, with nothing deterministic to test the meaning of, for a table of 46 versions
-- where weighted full text over four fields is both free and exact. Decision 0083 records this and raises it as
-- an owner question. Nothing here creates an extension, and lib/rulebook/ask/migration.test.ts asserts that, so
-- the search works on any Postgres this repository can be run on.
--
-- The scope filter is the SQL twin of `inScope` (lib/rulebook/scope.ts, owner decision 12): asking about an
-- article or a method matches only the rules that name it, so no rule is stretched over an article it never saw.
-- Nothing in the earlier rulebook migrations is edited, and no row is written here.

-- ---------------------------------------------------------------------------------------------
-- The words of a version, weighted.

alter table public.rulebook_entries
  add column search tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('english'::regconfig, coalesce(rule, '')), 'B')
    || setweight(to_tsvector('english'::regconfig, coalesce(body, '')), 'C')
    || setweight(to_tsvector('english'::regconfig, coalesce(best_practice, '')), 'D')
  ) stored;

comment on column public.rulebook_entries.search is
  'The words of this version, weighted: applies-to A, rule B, why C, best practice D. Derived from those columns, so it can never say something the version does not. Read by rulebook_search only; not granted to a browser.';

create index rulebook_entries_search on public.rulebook_entries using gin (search);

-- X2b's finding: the version filters belong in SQL before the table passes 500 versions.
create index rulebook_entries_rule_version on public.rulebook_entries (rule_id, version desc);

-- ---------------------------------------------------------------------------------------------
-- The search. One row per rule the question matched.

create type public.rulebook_hit as (
  rule_id text,
  -- ts_rank over the weighted vector, highest first.
  rank real,
  -- How many of the question's searchable words this rule holds, and how many it was asked with. The caller
  -- decides from these whether anything covers the question at all (lib/rulebook/ask/retrieve.ts).
  matched integer,
  asked integer
);

comment on type public.rulebook_hit is
  'One rule a question matched: its id, its rank, and how many of the question''s words it holds out of how many were asked.';

create function public.rulebook_search(
  p_query text,
  p_article_code text default null,
  p_method text default null,
  p_limit integer default 8
)
returns setof public.rulebook_hit
language sql
stable
security definer
set search_path = ''
as $$
  with ask as (
    -- The question's words, stemmed the way the column is, so "seams" finds "seam". A word the English
    -- configuration throws away (a stop word) never reaches this list, so it can never count as a match.
    -- Only plain words are searched: an id, a price or an address is matched by its words, if at all, and
    -- cannot carry punctuation into the query it is built into.
    select array_agg(distinct word) as words,
           to_tsquery('english'::regconfig, string_agg(distinct '''' || word || '''', ' | ')) as any_of
      from unnest(tsvector_to_array(to_tsvector('english'::regconfig, coalesce(p_query, '')))) as word
     where word ~ '^[a-z0-9]+$'
  ),
  scored as (
    select e.rule_id,
           ts_rank('{0.1, 0.2, 0.4, 1.0}'::real[], e.search, a.any_of) as rank,
           cardinality(array(
             select unnest(a.words)
             intersect
             select unnest(tsvector_to_array(e.search))
           )) as matched,
           cardinality(a.words) as asked
      from public.rulebook_entries e, ask a
     where a.any_of is not null
       and e.search @@ a.any_of
       -- The SQL twin of inScope (owner decision 12): nothing in particular matches every rule; an article or
       -- a method matches only the rules that name it.
       and (
         (p_article_code is null and p_method is null)
         or (p_article_code is not null and p_article_code = any (e.article_codes))
         or (p_method is not null and p_method = any (e.scope_methods))
       )
  )
  select s.rule_id, max(s.rank)::real, max(s.matched)::integer, max(s.asked)::integer
    from scored s
   group by s.rule_id
   order by 2 desc, 1
   limit least(greatest(coalesce(p_limit, 8), 1), 50);
$$;

comment on function public.rulebook_search(text, text, text, integer) is
  'The rules whose words match a question, ranked, scoped as owner decision 12 scopes them. Ids and scores only: which version a reader may see is decided in lib/rulebook/select.ts.';

revoke all on function public.rulebook_search(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.rulebook_search(text, text, text, integer) to service_role;
