# 0098: The template library to the launch counts of `07`

Status: Proposed; owner questions listed
Date: 2026-11-02
Plan step: `plans/platform-v5.md`, wave 4, workstream L8 (spec `docs/spec/07-template-library.md`)
Migration: `supabase/migrations/20261201050000_template_kinds.sql`

## Context

`docs/spec/07-template-library.md` names seven kinds of template and a launch count for each: 60 design
templates on the eight base articles, 15 kit bundles, 40 mockup scenes, 50 marketing templates, 12 video
templates, 6 flows and 8 tech pack templates, one per base article. It also asks every template to carry
five tags — sport, style, era, mood and colour family — so search and the inspiration board (F-S1) can
find one.

What already existed, from plan v4 (decision 0041): a `templates` table holding one finished design per
row, with 33 seeded starters (12 on the tops family, 21 on the football and cricket articles), a library
page with four filters and a pager, and a seed that is re-runnable by slug. Nothing said which **kind** of
template a row was, no row carried a sport group outside the five-value `sport` column, and neither kit
bundles nor tech pack templates existed in any form.

Three facts of the repository decide most of what follows:

1. **Only one of the eight base articles has factory-shaped data.** `JSY-SS-01` has a point-of-measure
   table, a construction table, seam allowances and a drafting script. The other seven publish **no
   measurement at all** and have no block (decision 0090); each carries its own rulebook entries saying so.
2. **A kit pattern is drawn on the tops family only** (`lib/garment/kit-pattern.ts`). The teamwear,
   outerwear, bottoms and close-fitting families carry colour blocking and their own options instead.
3. **Two of the eight base articles have no design route**: `FSH-MM-01` stands behind no garment type at
   all, and so can carry no design template (decision 0066).

## Decision

1. **`templates.kind` carries `07`'s seven types**, defaulting to `design` so every row that already
   exists keeps its meaning. `lib/templates/kinds/index.ts` holds the same seven values and the launch
   counts, and `index.test.ts` reads the "Launch count" column of `07` itself rather than trusting a
   number typed here. L2 to L6 of the same wave seed the other four kinds.

   **A reader of `templates` sees every kind.** `lib/templates/service.ts` reads the whole table and
   parses every row against the design shape, and that file belongs to no wave-4 workstream, so it was
   not edited. A workstream that seeds a kind other than `design` must narrow that read to
   `kind = 'design'` first. The migration says so in a comment; it is also in the pull request.

2. **The kinds whose shape is not a design get their own tables, rather than null columns on
   `templates`.** A kit bundle has no snapshot, no wearer and no single article; a tech pack template has
   no design at all. Making `article_id`, `wearer`, `style_tags`, `colour_family` and `snapshot` nullable
   would have broken the existing library reader on the first non-design row, so
   `template_kit_bundles` (with `template_kit_bundle_members`) and `template_techpacks` hold them. Both
   are platform data with exactly `templates`' own rules: every signed-in user reads, no browser role
   writes, the server writes through the service client.

3. **The launch tag set is three new array columns over a closed vocabulary**, beside the `style_tags`
   and `colour_family` that already exist: `sport_tags`, `era_tags`, `mood_tags`. Each is checked in the
   database with `<@ array[...]`, mirrored in `lib/templates/kinds/tags.ts`, and `tags.test.ts` reads the
   migration and holds the two to each other.

   `07`'s six sport groups include **esports** and **combat**, which the `sport` column's five-value
   check does not hold and which `SPORTS` in `lib/templates/catalogue.ts` does not type. That file is
   owned by no wave-4 workstream, so the column is left alone and the real group is carried in
   `sport_tags`: an esports or combat starter is filed under `general` in the column and named in the
   tag. Widening the column is a one-line change there plus the filter panel, and it is owner question 1.

   **Era and mood are Knitwright's own words for how a design looks**, for search and the inspiration
   board. They are not a factory fact and say nothing about how a garment is made, so they are read from
   the design's own style rather than written per row.

4. **The design templates reach 60, and every one passes X4 validation.** 27 starters were added to the
   33 of plan v4, on the sport groups and base articles `07` lists and v4 had none of: the hoodies
   (`HOD-ST-01`), the compression top and rash guard (`CMP-LS-01`), the training shorts (`SHO-TR-01`),
   esports and running/gym on the jersey, and the football long sleeve (`JSY-LS-01`). The library now
   sits on seven base articles; `FSH-MM-01` has none, for fact 3 above.

   **Manufacturable by construction** (spec decision 5): every option set is a choice the article's own
   registry entry offers — `applyAction` refuses anything else, and a plan that cannot be built throws
   with its own slug in the message — every colour is read from `CLUB_PALETTE`, the palette the editor
   itself offers, and no measurement is set anywhere. The acceptance test
   (`lib/templates/seed/launch/validation.test.ts`) runs the real gate — the five guardrails, parameters
   in range and moderation clear — over all 60 against the default factory profile and the committed
   launch catalogue: **no blocker anywhere, and every check carries a rule id.**

5. **A kit bundle is built from the design templates themselves.** A member names a design by its slug,
   and the database holds it to a real row, so a bundle can never point at a design that is not in the
   library. A bundle holds no colour, option or measurement of its own: its sport, colour family and tags
   are its lead member's, so it cannot disagree with what is in it. 15 bundles: nine football kits (three
   with a goalkeeper shirt), three cricket sets, two training sets and a gym set.

   **`07` also asks a bundle for a sock colour, and no bundle has one.** Socks are a garment type of the
   registry that the catalogue maps to **no base article** (decision 0066), so there is no sock design
   template to put in a bundle, and inventing one would put a garment in a kit that nothing can make.
   Every bundle carries that gap instead, with `R-GAP-000`, because no rulebook entry says it.

6. **A tech pack template is a page set, default fields and the gaps the article has.** A page of
   `lib/techpack`'s sixteen is in an article's page set only when the article's own row can fill it, and a
   page that cannot be filled is reported as a gap naming what is missing and the rulebook entry that
   explains it. The eight templates are built from the catalogue rows rather than from a list in code, so
   the day a factory sends a point of measure the template gains the page without a change here.

   **A refusal that names its gap is the output for seven of the eight.** `SHO-TR-01`, `JSY-LS-01`,
   `CRK-SS-01`, `TEE-TR-01`, `HOD-ST-01`, `CMP-LS-01` and `FSH-MM-01` have no measurement page, no
   how-to-measure page, no pattern-and-cutting page, no construction page and no order-of-work page, each
   refused with that article's own published rule: `R-FIT-x01` (no point of measure without a factory
   value **and** a tolerance), `R-PAT-x01` (no block and no master pattern on file) and `R-CON-x01` (no
   construction, seam allowance or thread on file). `rules.ts` holds no rule's text, and
   `build.test.ts` reads each article's committed `rulebook.md` and asserts every id used is published
   there. `FSH-MM-01` also has no flats, artwork or artwork-and-colour page, because no garment type
   stands behind it.

   **No measurement is copied into a template either.** Where an article has a point-of-measure table,
   the template names its letters and codes — never a value: the values belong to the article.

7. **The one open item on a page that is otherwise filled.** `JSY-SS-01` gets all sixteen pages and one
   gap: no factory-checked master pattern is on file, so the pattern on the page is a Knitwright draft.
   That is owner decision 10 of the plan rather than a factory's rule, and no entry of `JSY-SS-01`'s
   rulebook states it, so it carries `R-GAP-000` and is listed below.

8. **Four of `07`'s ten football styles are not seeded.** Half-and-half, chevron, retro-90s geometric and
   camo fade are not among the eight kit patterns the drawing can draw
   (`KIT_PATTERN_STYLES`: hoops, vertical stripes, pinstripes, sash, side panels, chest band, fade, polka
   dots). Seeding one under a neighbour's name would describe a design the editor cannot produce, so none
   is seeded and the four are owner question 2. The same holds for the combat group's tribal/geometric
   and the cricket group's shoulder flash, which are artwork and panel shapes rather than a style the
   editor offers.

9. **Nothing third-party is committed.** Every thumbnail the library shows is drawn here from the design
   itself (`lib/templates/preview.ts`: the flat is rendered to an SVG data address, so nothing in it can
   run), deterministically, with no crest, photo, font or artwork from anywhere else. No template holds a
   club crest, a real player name or a real person, and no generated image exists in this workstream at
   all, so nothing of AI's reaches a panel layer or a print file (spec decision 13).

## Evidence

| Claim | Test |
|---|---|
| The seven kinds and the seven launch counts are `07`'s own, read from the file | `lib/templates/kinds/index.test.ts` |
| The sport, era and mood vocabularies are the migration's, word for word | `lib/templates/kinds/tags.test.ts` |
| A tag filter narrows on each of the five groups, and search finds a starter by a tag's words | same, and `lib/templates/seed/launch/build.test.ts` |
| The gap a starter's article carries comes from the register of decision 0090, with its rule | `lib/templates/kinds/gaps.test.ts` |
| There are 60 design templates, every slug and title once, built the same way every time | `lib/templates/seed/launch/build.test.ts` |
| Every sport group of `07` is covered, esports and combat included; `FSH-MM-01` carries none | same |
| **Every design template passes validation: no blocker, and every check has a rule id** | `lib/templates/seed/launch/validation.test.ts` |
| A plan with an article, an option or a colour that does not exist throws, naming itself | `lib/templates/seed/launch/build.test.ts` |
| There are 15 kit bundles, each holding only designs in the library, each naming the socks gap | `lib/templates/seed/bundles/build.test.ts` |
| Seeding bundles writes the bundle by slug and its members from scratch, and reports any failure | `lib/templates/seed/bundles/seed.test.ts` |
| There are 8 tech pack templates, one per base article, in the tech pack's own page order | `lib/templates/seed/techpacks/build.test.ts` |
| The seven articles with no data refuse five pages each, with their own published rule ids | same |
| Every gap rule id is published in that article's committed `rulebook.md` | same |
| No measurement reaches a tech pack template; a POM table gives letters only | same |
| The templates are built from the catalogue, so an empty catalogue writes no row | `lib/templates/seed/techpacks/seed.test.ts` |
| The kind column, the tag checks, the bundles and the tech pack templates in the database | `tests/integration/template-kinds.test.ts` |
| No browser write to any of the three new tables lands, a platform admin's included | same |
| The three tables are platform-read, server-write, as `templates` is | `tests/integration/isolation.test.ts` |
| The library still lists and filters with 60 rows, and a hoodie starter says it is unreviewed | `apps/web/e2e/templates.spec.ts` |

`lib/templates/**` is already in the 90% list of `apps/web/vitest.config.mts`, so that file is unchanged.
No new dependency: nothing was added to any `package.json`, so there is no licence line to write. Nothing
in `Sportswear/`, `kitwright/` or `supabase/config.toml` was touched, and nothing here reads or writes a
Store concept.

## Not done, and why

- **No mockup scene, marketing, video or flow template.** Those four kinds are L2, L4, L5 and L6 of the
  same wave, and their counts (40, 50, 12, 6) are theirs. The `kind` column and the tag columns they need
  are in place.
- **No design template on `FSH-MM-01`.** No garment type stands behind the fight shorts, so there is no
  design route at all (decision 0066). It still gets a tech pack template, which is a refusal.
- **No sock design template and no sock in a bundle.** Point 5.
- **Four football styles, the combat group's tribal/geometric and cricket's shoulder flash.** Point 8.
- **No filter panel for the new tags.** `components/templates/**` and `lib/templates/filters.ts` belong to
  no wave-4 workstream and were not edited. The library's four filters still work, every starter still
  carries the existing label on its card, and the new tags are served by pure functions
  (`matchesTags`, `matchesSearch`, `TAG_CHOICES`, `gapForType`) ready for the panel that shows them. Owner
  question 1 covers widening the `sport` column and the panel together.
- **No browser surface for the kit bundles or the tech pack templates.** Crest-to-kit (F-T2) and the tech
  pack builder (F-S6) are the screens that read them, and neither is this workstream's.

## Gaps in the rulebook (`R-GAP-000`)

1. **A bundle has no socks**, because socks are not one of the eight base articles. No entry anywhere says
   that, and the reason is the catalogue's map (decision 0066), not a factory's rule.
2. **`JSY-SS-01` has no factory-checked master pattern on file**, so the pattern on its tech pack page is a
   Knitwright draft. That is owner decision 10 of the plan; no entry of `JSY-SS-01`'s rulebook states it.
3. **`FSH-MM-01` has no garment type**, so its tech pack template has no drawing to put on the page. No
   rule says an article needs a design route.

## Owner and factory questions

1. **Should the `sport` column become `07`'s six groups?** Today it holds five values
   (football, cricket, running, training, general) and the spec's esports and combat live in `sport_tags`
   only, so the library's sport filter cannot offer them. Widening it means widening `SPORTS` and
   `SPORT_LABELS` in `lib/templates/catalogue.ts`, the column's check, and the filter panel — three files
   this workstream does not own.
2. **Four of `07`'s football styles have no geometry in the editor**: half-and-half, chevron, retro-90s
   geometric and camo fade. Should the kit-pattern vocabulary grow to hold them (which is
   `lib/garment/kit-pattern.ts` and the drawing code), or do they belong to artwork rather than to a kit
   pattern? The same question covers combat's tribal/geometric and cricket's shoulder flash.
3. **Should socks and caps become base articles?** `07` asks a kit bundle for a sock colour and the
   registry has football socks and a cricket cap, but the catalogue maps neither to a base article, so
   neither can carry a template that is manufacturable by construction.
4. **Is `general` the right home for an esports or combat starter** until question 1 is answered, or
   should such a starter not be listed under a sport at all?
5. **Which era and mood words does the owner want?** `classic`, `retro-90s`, `modern` and `bold`, `clean`,
   `sharp`, `playful`, `understated` are Knitwright's own, chosen here because `07` names the two tag
   groups without naming a value. They are a closed check in the database, so a word added later is a
   one-line migration.
6. **Who reviews a template?** Every one of the 60 is `not_reviewed` and says so on its card. `07` says a
   template "passes F-0 validation and F-G1 moderation before release": validation it does, in the test
   above, and moderation has nothing to screen because no template holds an uploaded picture. What makes
   a template `reviewed` — a factory, or Knitwright — is not written down anywhere.
7. **Phase 4 designer templates.** `07` ends with designer-made templates earning a royalty per unit.
   Decision 0061 built the ledger; nothing here opens the door, and `templates.source = 'designer'` is
   still only reachable through the submission flow.
