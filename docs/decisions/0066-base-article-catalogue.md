# 0066: The base article catalogue

Status: Proposed
Date: 2026-10-29
Plan step: plans/platform-v5.md, workstream X1 (spec F-S3 data, F-S8 data, spec decision 5)

## Context

The v2.2 build pack makes every design a **base article**: one makeable block with sizes, points of measure (POMs) with
grades and tolerances, parameters with factory-made ranges, options with catalogue codes, a construction table and the
fabrics it may be made in (`docs/spec/03-data-model.md`, `base_article`, `parameter_def`, `option_def`). The platform had
none of this as data: garments are types in the code registry (`lib/garment/registry`). Owner decision 4 for v5 keeps the
existing data model and adds the spec's catalogue beside it.

## Decision

1. **Six tables, platform data** (migration `20261101010000_base_articles.sql`): `base_articles`, `article_poms`,
   `parameter_defs`, `option_defs`, `article_construction`, `article_fabrics`. Signed-in members (anyone with a
   membership) read them; only the server's key writes them, so a platform admin writes through the service client,
   never the browser. No browser role has a write grant or a write policy, as with `factory_profiles` (decision 0039).
   The children refer only to `base_articles` (same migration), so migrations still merge in any order. IDs are
   `gen_random_uuid()`; money is integer minor units plus a currency.
2. **Seeded from the build pack, exactly.** `JSY-SS-01` is read from `docs/spec/articles/JSY-SS-01/article.json` by
   `lib/catalogue/seed/article-json.ts`. The other seven launch articles of `ONBOARDING.md` carry only what the build
   pack says: code, name, class and front doors (ONBOARDING.md), the sports named in their row of
   `01-product-direction.md` "Launch catalogue", and the fabric programme code from that row. Size ranges, POMs, ranges,
   options and construction are empty for them. Every seeded article says "Knitwright draft v0.1, not reviewed by a
   factory" (`data_label`) and has status `draft`.
3. **The migration seed is generated, and a test holds it to the source.** `lib/catalogue/seed/sql.ts` writes the seed
   SQL; the migration holds it between markers; `lib/catalogue/seed/sql.test.ts` fails if the migration and
   `launchCatalogue(article.json)` ever differ. To change the seed, change `article.json` (or `seed/launch.ts`) and paste
   the output of `pnpm --filter web exec tsx lib/catalogue/seed/print-sql.mts` into a new migration.
4. **Read API** in `lib/catalogue`: `getBaseArticle(client, code)`, `listBaseArticles(client, filters)` (sport, article
   type, fit, gender, class, fabric, status), `parameterRange(client, code, key)`, `optionsFor(client, code, group)`.
   Rows are checked with zod. The client is a parameter, so a page passes the member's own client and the database's rules
   decide what is seen. Nothing in `lib/catalogue` writes.
5. **Nothing is guessed.** A value the build pack does not hold is null: fit and gender are null except JSY-SS-01's fit
   (its name says "regular fit"); no option has a price, a thumbnail or a sample; no parameter has a sample
   (`approved_by_sample_id` null means "Not yet sampled"; the file's `approved: false`). A filter on fit or gender never
   matches an article whose fit or gender is unknown.
6. **Every option carries a rule** (plan v5, "Every rule explains itself"). `option_defs.rule_id` is `not null`. The
   three pattern fills `P00`, `P01` and `P02` are the only values the build pack gives no rule, so they carry
   `R-GAP-000` ("no rule written yet"), which X2 seeds. Points of measure, parameter ranges, construction rows, the
   thread and the seam allowances all carry the rule `article.json` names.

### How the spec's names map to these tables

| Spec (`03-data-model.md`) | Here | Notes |
|---|---|---|
| `base_article` | `base_articles` | `class` is `production_class`; `parametric_script` is `parametric_script_id` + `parametric_script_version`; `pom_table` is the `article_poms` table; `active` is `status` (draft, sampling, live) |
| `parameter_def` | `parameter_defs` | `approved_by_golden_sample_id` is `approved_by_sample_id`, an id only (no foreign key: golden samples are Y7's table) |
| `option_def` | `option_defs` | `value` is `code` (catalogue code, `C01`); `label`, `is_default` and `rule_id` (not null, `R-GAP-000` where none) added; `extra_cost` is `extra_cost_minor` + `currency`, null until priced |
| (construction table, F-S3) | `article_construction` | one row per `construction` entry of article.json; `iso_stitch_classes` are the "ISO nnn" numbers written in the operation, never inferred |
| (fabrics allowed, F-S3) | `article_fabrics` | programme code, plus role, GSM, width and shrink where article.json gives them. `fabric` itself (F-S8 programme) is not built here |
| `panel_geometry` | not built | the drafter (X3) computes geometry |

Shapes kept from article.json that the plan's column list did not name: POM grade type `fixed` (the file's word for a POM
with one value in every size; kept, not renamed to `ungraded`); a single tolerance stored as equal minus and plus; seam
allowances (a map per seam with its rule) and the needle and looper thread on the article row, since the file gives them
per article, not per construction step. The plan's construction columns "thread, allowance, hem/binding width" are
therefore covered by those two article-level columns and by the operation text itself ("20 mm turn-up", "15 mm
self-fabric binding"), which is kept word for word; no width is pulled out into a column the build pack does not have.

### Base articles and the garment registry

Existing designs keep their registry type; `lib/catalogue/registry-map.ts` says which base article stands behind each.
The first type is stored on the article as `registry_type_id` and is what a new design on that article is made as.

| Base article | Registry types (first is the main one) |
|---|---|
| `JSY-SS-01` short-sleeve jersey | `football-shirt`, `team-jersey` |
| `SHO-TR-01` football/training shorts | `football-shorts`, `shorts` |
| `JSY-LS-01` long-sleeve jersey / goalkeeper | `goalkeeper-shirt`, `long-sleeve-tee` |
| `CRK-SS-01` cricket coloured shirt | `cricket-shirt` |
| `TEE-TR-01` training tee | `crew-tee`, `v-neck-tee`, `cricket-training-tee` |
| `HOD-ST-01` hoodie | `pullover-hoodie`, `zip-hoodie` |
| `CMP-LS-01` compression top | `compression-top` |
| `FSH-MM-01` fight shorts | none yet |

Types with no article (socks, cap, trousers, leggings, joggers, jackets, polo, singlet, vest, sports bra, training top,
winter-code top) stay registry types only. `baseArticleForType` answers undefined for them.

## Not done, and why

- **No screen.** The catalogue home and article page are Y1 (wave 2). This workstream is data and a read API.
- **No `fabric` / `fabric_colour` programme table.** Only allowed fabric codes per article; the programme cards of F-S8 need
  data the build pack does not give yet.
- **No geometry, 3D model or parametric script.** Columns exist and are null; X3 owns the drafter.
- **The BOM, print, placements, personalisation, labels and QC sections of article.json** are not stored here; they belong
  to the tech pack and package workstreams (X5, Y4).

## Owner questions

1. Size ranges, sample sizes and genders of the seven other launch articles (none are in the build pack).
2. Sports for `JSY-LS-01`, `HOD-ST-01` and `CMP-LS-01`: the build pack names none, so they have no sport tag and do not
   appear under a sport filter.
3. Is `JSY-SS-01` men's, women's or unisex? ONBOARDING.md implies a women's fit would be a separate base (`JSY-SW-01`), but
   says nothing about this one, so no gender is set.
4. The registry mapping above: is a `crew-tee` design really a `TEE-TR-01`, and should fight shorts get a registry type?
5. The pattern fills `P00` to `P02` have no rule in `article.json`, so they are stored with `R-GAP-000`. What should
   their rulebook entry say (X2)?

## Evidence

| Claim | Test |
|---|---|
| Every POM, range, option, seam, thread, allowance and fabric of JSY-SS-01 is read from article.json value for value | `lib/catalogue/seed/article-json.test.ts` |
| The eight articles, their order, class, front doors and names match ONBOARDING.md; drafts hold fabric codes only | `lib/catalogue/seed/launch.test.ts` |
| The migration seed equals the generated seed | `lib/catalogue/seed/sql.test.ts` |
| Every mapped registry type exists and maps one way | `lib/catalogue/registry-map.test.ts` |
| Filters | `lib/catalogue/filters.test.ts`, `tests/integration/base-articles.test.ts` |
| Every option, range, measure and seam has a rule id, and only the pattern fills use `R-GAP-000` | `lib/catalogue/seed/article-json.test.ts`, `tests/integration/base-articles.test.ts` |
| The database seed reads back equal to article.json; members read, visitors and brandless people see nothing, no browser writes | `tests/integration/base-articles.test.ts`, `tests/integration/isolation.test.ts` |

No new dependency.

## Where the tests run

There is no local Supabase in the agent sandbox, so `tests/integration/base-articles.test.ts` and the catalogue's
entries in `tests/integration/isolation.test.ts` run in CI only (`pnpm --filter web test:cov`), as for every other
database test in this repository. The unit tests of `lib/catalogue` run everywhere.

Before the pull request the migration was applied to a throwaway PostgreSQL 17 (with `auth.uid()` and `memberships`
stubbed) to check, outside CI, that: it applies; `authenticated` holds `SELECT` only and `anon` nothing, with row level
security on and one read policy per table; a person with a membership sees all eight articles and their children and a
person without one sees nothing; each refusal this workstream's database test asserts really is refused; deleting an
article takes its children with it; and every row, read back as JSON in the shape PostgREST sends, parses through the
zod schemas and deep-equals `launchCatalogue(article.json)`. What that could not exercise is PostgREST itself and the
browser clients, which is what CI adds.
