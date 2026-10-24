# Plan v4: the platform against the final product spec

Status: ACTIVE. Written 2026-10-24 by the orchestrating session.
Spec: `Knitwright product spec.pdf` (2026-10-22), declared final by the owner on 2026-10-24.
Scope (owner, 2026-10-24): the PLATFORM only: Design Studio, design object, validation,
catalogue, templates, club workspace, credits, ops console. **Out of scope: the Store**
(checkout, team stores, club sites, payments, Sell; the owner builds it separately) and **the
`Sportswear/` model code** (separate repository, do not touch it).
Builds on: `plans/knitwright-mvp-blueprint.md` v3.1 and `plans/production-outputs.md`. Where they
disagree with this file on shared rules, those two win; where they disagree on scope, this file wins.

## How to use this plan

Each workstream below is one cloud agent, one branch `feat/v4-<id>-<slug>` cut from `main`, one PR
into `main`. Read, before writing code:

1. "Rules every workstream follows" below.
2. `apps/web/AGENTS.md`: this Next.js is not the one in your training data. Read the relevant guide in
   `apps/web/node_modules/next/dist/docs/` before any route, page or action.
3. `docs/decisions/` entries named in your section, and `plans/production-outputs.md` section 3.
4. Your own section.

An agent edits only the paths its section says it OWNS, plus: its own migration file, its own
decision record `docs/decisions/00NN-*.md` (number given), one navigation entry, and its own tests.
A file not listed belongs to nobody: do not edit it; work around it or say so on the PR. If a shared
file (navigation, `lib/garment/index.ts`, `lib/copy/vocabulary.ts`) must change, change the fewest
lines possible and rebase on conflict; the orchestrator merges PRs one at a time.

Do NOT merge your own PR. Open it, make CI green, post a summary comment (what was built, what
was left, owner questions), and stop. The orchestrator merges.

## Rules every workstream follows

- **No invented measurement.** Every number a factory reads carries a source. A default needed to
  run is a labelled setting ("Knitwright default, not from your factory"), never a measurement.
- **Missing owner input never blocks the build.** Ship with a labelled default, list the question in
  your PR comment and in your decision record under "Owner questions".
- **Wording.** `lib/techpack/wording.test.ts` forbids "checked, verified, approved, confirmed,
  final, production-ready, passed, validated, certified" in user text except in sentences saying
  something is NOT done. Use "reviewed by", "accepted by", "signed by" with a name and a date. Use
  plain words from `lib/copy/vocabulary.ts`.
- **Immutability, small files, TDD.** New objects, never mutation. Files under 400 lines, functions
  under 50. Write the test first. 80% coverage overall, 90% on every new `lib/` directory.
- **Server only writes.** Every new table: brand-scoped, row level security on, members read their own
  brand, no browser write grant, writes through `defineRoute` / `defineAction` with the service client,
  exactly as `pattern_jobs` and `team_orders` do. No foreign keys into other workstreams' tables; refer
  by id plus an immutable JSON snapshot, so migrations merge in any order.
- **Deterministic outputs.** No creation date, random id or unordered map in any generated file.
- **Cost.** Anything that calls a paid model goes through `lib/usage` metering and has a daily cap.
- **No MCP at runtime.** No new runtime dependency without a line in the decision record saying why
  and what the licence is (MIT/Apache/BSD only).
- **Gate before the PR** (run all; paste the tail of each in the PR): `pnpm --filter web typecheck`,
  `lint`, `test:cov`, `build`; `pnpm db:start` then `pnpm test:db` for any migration; `pnpm e2e` for any
  new route. CI must be green.
- **Seeds and fixtures are labelled.** Anything Knitwright-made but not reviewed by the factory says so.
- **Never** touch `Sportswear/`, `kitwright/`, `supabase/config.toml`, or Store concepts (cart,
  checkout, Stripe, team-store links, club sites).

## Migration timestamps (assigned, do not change)

| File | Workstream |
|---|---|
| `20261025010000_design_validation.sql` | V1 |
| `20261025030000_templates.sql` | V3 |
| `20261025040000_club_workspace.sql` | V4 |
| `20261025050000_ops_batches.sql` | V5 |
| `20261025060000_credits.sql` | V6 |

V2, V7, V8 add no migration. Decision record numbers: V1 0039, V2 0040, V3 0041, V4 0042, V5 0043,
V6 0044, V7 0045, V8 0046.

## Waves

- **Wave 1 (this file, all parallel):** V1 to V8.
- **Wave 2 (after wave 1 merges; written then):** inspiration variants engine (uses V7 and V1),
  chat edits as design diffs, glTF base-model pipeline with UV equal to panels, ops QC/packing/
  shipping/exceptions/metrics (continues V5), editor panel layers and Fabric.js decision,
  credits wired into outputs (uses V6), template seeding from the catalogue (uses V2, V3).
- **Wave 3:** media checker and watermark, lifestyle and turntable, owner-input replacements.

---

## V1. Validation gate and design-object status (spec principles 4 and 6)

**Goal.** One function `validateDesign(design, factoryProfile)` that decides whether a design is
orderable, runs before any order and any file generation, and one set of states on the design.

**Owns.** `apps/web/lib/validation/**` (new), `apps/web/lib/production/contract/validation.ts` (new
file only; additive to the contract), migration `20261025010000_design_validation.sql`.

**Do.**
1. Read the spec's design object: `status (draft, validated, ordered)` and
   `checks[] {dpi, seam_cross, gamut, safe_zone}`; and the factory profile (articles and blocks
   made, fabrics with swatch refs and colour delta, structural options, MOQ per article, price ladder,
   lead time, file formats accepted, HS codes). Map each to what already exists: `spec_versions`,
   `base_fabrics`, `print_profiles`, `pattern_blocks`, readiness in the production contract
   (`lib/production/contract/readiness.ts`), `lib/orders/checks.ts`.
2. Add a `factory_profiles` table (brand-independent platform data, readable by signed-in members,
   written only by platform admins through the service client) and a typed schema. Seed ONE profile,
   labelled "Knitwright default profile, not agreed with a factory": articles from the existing garment
   registry; MOQ, price ladder and lead time left **empty (`not-set`)**, not invented.
3. `validateDesign` returns a list of findings, each `{code, severity: blocker|warning, article/panel,
   message in plain words, fix: what to do and who}`. It composes the existing readiness checks and
   accepts pluggable check modules (V7 will register dpi, seam, gamut and safe-zone checks; define the
   `CheckModule` interface and a registry now, with a test double).
4. Design status: add `design_status` (draft, validated, ordered) per design version with a transition
   function that refuses illegal moves; "validated" means only "no blockers against profile X at date
   D", stored with the profile id and a hash of the findings. Use the wording rules: the UI text must not
   say "verified" or "approved".
5. Show it: a "Factory file" readiness list in the existing factory-file tab (`components/production`)
   fed by `validateDesign`. Minimal UI change; no redesign.

**Done when.** Unit tests for each finding code and each illegal transition; db tests for the table's
RLS; e2e: a design missing a fabric test shows the named blocker; the decision record explains the
profile model and lists owner questions (MOQ per article, price ladder, lead time, swatch fabrics).

## V2. Sports catalogue: football, cricket, one Australian winter code

**Goal.** Teamwear articles exist in the garment registry as real definitions, so a design can be made
on them. Spec catalogue: football (shirt, shorts, socks, goalkeeper shirt, training top), cricket (coloured
shirt, trousers, training tee, cap), and the Australian winter code the partner picks (AFL, rugby league,
rugby union or netball: undecided).

**Owns.** `apps/web/lib/garment/registry/teamwear/**` (new), its flats under `lib/flat/families/teamwear/**`
(new), the registration line in `lib/garment/index.ts`, and `lib/garment/registry/teamwear/OWNER-QUESTIONS.md`.

**Do.**
1. Study how `registry/tops`, `bottoms`, `outerwear` and `close-fitting` define an article: points of
   measure, options, construction, parts, applicability, flats, and the `lib/garment/definitions.test.ts`
   contract tests. Follow exactly that shape; do not invent a new one.
2. Add the football and cricket articles above. Reuse existing tops/bottoms geometry where the garment is
   the same (a football shirt is a team jersey with sport options; shorts reuse the shorts flat), adding only
   what differs: goalkeeper shirt (padded elbows option, long sleeve), socks and cap (new flats; socks have
   a foot length and calf point of measure and are knitted, so label the construction and fabric as "knitted,
   factory programme not supplied"), cricket coloured shirt and trousers.
3. For the Australian winter code add ONE neutral article slot `winter-code-top` ("Team top, winter code")
   whose sport option list is empty until the owner picks the code; do not guess.
4. Articles have no pattern block yet where none exists: they must show "No pattern yet" in the pattern
   library rather than a fake DXF. Do not call FashionInsta or draft patterns.
5. Starter size-chart coverage: reuse starter charts where they exist; where a measurement has no source,
   leave it `not-set`. Never invent a number.

**Done when.** Every new article passes the registry contract tests and has front/back flats rendering in
the existing flat snapshot test; each is listed on the new-design start screen under its sport; the OWNER
file lists the questions (AU winter code, sock programme, goalkeeper options, cricket cap blocks).

## V3. Template library

**Goal.** Spec: "a template library is the default starting point; blank canvas is the exception".
Templates are finished designs on makeable articles, filtered by sport, article, style and colour family,
and one click opens one in the editor.

**Owns.** `apps/web/lib/templates/**`, `apps/web/app/(app)/templates/**`, `apps/web/components/templates/**`,
`app/api/templates/**`, migration `20261025030000_templates.sql`, `lib/templates/seed/**`.

**Do.**
1. A `templates` table: platform-owned rows (title, sport, article id, style tags, colour family, the full
   design-object snapshot, source `knitwright` for now with a `designer` source reserved but disabled,
   `review_state` default "not reviewed by the factory"). Readable by signed-in users; written only by
   platform admins.
2. "Use this template" copies the snapshot into a new design in the user's brand workspace as version 1
   (a copy; templates never link live to designs). It must go through the same creation path the guided
   start uses; read `lib/guided` and `lib/projects` and reuse it.
3. Library UI: a paginated grid with filters (sport, article, style, colour family), a preview using the
   existing flat renderer, and "Use this template". Respect the redesign (dark glass shell, one screen, no
   long scroll; read `plans/design-reference.md` and an existing page such as the studio home).
4. Seed 12 Knitwright-made templates from existing kit styles and existing articles (do not depend on V2's
   new articles; V2 templates come in wave 2). Seeds are built by a script, deterministic, each marked "Knitwright
   starter, not reviewed by a factory".
5. Make the guided start offer templates first and blank canvas second.

**Done when.** db tests (RLS, admin-only write), unit tests (filters, pagination, copy-into-design is a deep
copy), e2e (pick a template, land in the editor on version 1), accessibility check on the grid.

## V4. Club workspace

**Goal.** Spec: one account per club with members and roles; a workspace holding the club kit (colours,
crest, sponsors, fonts), every design and version, rosters by season, order history, saved sizes per player
so next season is pre-filled. A small brand works the same way with a brand kit and a product list.

**Owns.** `apps/web/lib/clubs/**` (new), `app/(app)/club/**`, `components/club/**`, `app/api/club/**`,
migration `20261025040000_club_workspace.sql`.

**Do.**
1. Today's unit is `brands` with `memberships` and organisation type (club, school, brand...). Do NOT
   create a parallel account concept. Extend: roles `admin`, `kit_manager`, `viewer` on memberships (read how
   roles work today in `lib/auth` and decision 0003/0004; add a migration that extends, never rewrites);
   a `kit` per brand: primary/secondary/accent colours, crest file, up to three sponsor slots (name,
   logo file), fonts for names and numbers (choice from the bundled font only for now).
2. Seasons and rosters: `club_seasons` (name, dates) and `roster_players` (name, number, size label, wearer
   group, season id). A season roster can be copied to the next season with sizes pre-filled. Reuse `team_orders`
   and its text cleaning for names; player names are personal data: use the erasure path in `lib/deletion`
   and add the new tables to it.
3. Workspace UI at `/club`: kit, members and roles, seasons and rosters (CSV import reusing
   `lib/orders/import-csv`), designs list, order history (reads `production_releases`, read only).
4. Applying the kit to a design: "use club colours / crest / sponsors" fills the design object from the kit
   without hard-coding; the design keeps its own copy.
5. Role enforcement everywhere new: a viewer cannot write; a kit manager cannot change members.

**Done when.** db tests for roles and RLS across two clubs (no leakage), deletion test including roster
players, e2e for create season, import roster, copy to next season; the decision record notes how this maps
to `brands` and why.

## V5. Ops console, part 1: batches, factory sheet, factory status

**Goal.** Spec: an internal Next.js route group on the same database. The factory never logs in. Part 1
covers weekly batch cut-off, the factory sheet and factory status. (QC, packing, shipping, exceptions and
metrics are wave 2.)

**Owns.** `apps/web/app/(ops)/ops/**`, `components/ops/**`, `lib/ops/**`, `app/api/ops/**`, migration
`20261025050000_ops_batches.sql`, and `lib/ops/factory-sheet/**`.

**Do.**
1. Ops access: only platform admins (existing `platform_admins`) can open `/ops`. Add it to the existing
   admin guard; add an architecture test that no `/ops` route is reachable without it, and that nothing in
   `/ops` is linked from the public shell.
2. The input is existing `production_releases` (frozen releases with a roster hash and file hashes) and
   `team_orders`: a `batches` table groups paid/ready releases by factory profile, fabric and article.
   There is no payment concept in the platform: an order enters ops through an `ops_orders` table the Store
   will write to later through one documented function `submit_order_for_production(release_id, ...)`
   (service key only). Define that function and its contract carefully; it is the interface to the owner's
   Store. Include a "promised date" computed from the next batch cut-off and a lead time.
3. Batch cut-off: a function that groups unbatched orders for a cut-off time (fixed weekly time stored as a
   setting), shows pieces, sizes and value, lets ops move an order between batches or hold it.
4. Factory sheet: one PDF per batch (use the existing react-pdf renderer, `lib/pdf` conventions from decision
   0008): order list, size breakdown per article, fabric and trim BOM, name and number list per order,
   packing instructions, due date; plus a ZIP of the print files from each release (reuse `lib/print`
   builders and the manifest code in `lib/orders/manifest*.ts`). Deterministic.
5. Factory status: ops marks received, in production, ready; a delay pushes a new promised date and records
   why. Status history is append-only.
6. UI: a dense ops screen: batches list, batch detail, order detail with status control. Plain, fast, keyboard
   friendly.

**Done when.** db tests, unit tests (grouping, cut-off, status transitions, promised date), e2e (admin only),
a sample batch factory sheet PDF committed as a test snapshot hash, decision record with owner questions
(cut-off weekday and time, which factory per article).

## V6. Credits

**Goal.** Spec: designing, versions, 3D views, team store hand-off and the tech pack summary are free;
marketing media, the full tech pack PDF, and pattern files cost credits; credits spent on a design are
refunded when that design is ordered.

**Owns.** `apps/web/lib/credits/**`, `components/credits/**`, `app/api/credits/**`, migration
`20261025060000_credits.sql`.

**Do.**
1. Read `lib/usage` (meter, cost, limits) and decision 0012. Credits are separate from the beta usage caps:
   caps protect cost; credits are the product's currency. Keep both and document how they interact (a credit
   spend is also a metered event).
2. Ledger: append-only `credit_ledger` per brand (grant, spend, refund, expire), balance computed, never
   edited. Spending takes a price from a `credit_prices` table (output kind -> credits) seeded with
   placeholders that are labelled as such and all set to values read from one settings file; the real prices
   are an owner decision.
3. API: `spendCredits(brand, kind, designVersion)`, idempotent on (brand, kind, design version hash) so
   re-downloading the same output costs nothing; `refundForOrder(designVersion)` refunds every spend on that
   version when `design_status` becomes ordered (V1 owns the status; expose `refundForOrder` and let V1/V5
   call it later; do not edit V1's files).
4. Do NOT yet gate the existing exports; ship the ledger, prices, a balance chip in the shell, and a
   "credits" page showing balance and history. Gating is wave 2.
5. Allowance: monthly free credits per brand reusing `monthly_allowances`.

**Done when.** db tests (append-only trigger, RLS), property tests (balance equals sum, idempotent spend,
refund only once), e2e for the page, the decision record lists owner questions (price per media set, tech
pack, pattern export, refund rule).

## V7. Guardrails library

**Goal.** Spec stage 3 guardrails as pure, tested functions: seam-crossing warning for artwork spanning
panels, minimum DPI at the panel's print size, bleed added automatically, safe zones for names and numbers,
colour gamut warning for colours sublimation cannot hit.

**Owns.** `apps/web/lib/guardrails/**` (new). It may call but not edit `lib/print`, `lib/artwork-stack`,
`lib/pattern-library`, and registers into V1's `CheckModule` registry only after V1 merges (until then export
modules with the planned interface in `lib/guardrails/index.ts`).

**Do.**
1. Study the artwork layer model (decision 0035), print files (0031), and the pattern pieces' geometry in the
   production contract. Inputs are the design object and the panel geometry; outputs are findings
   `{code, severity, panel, location in mm, plain message, fix}`.
2. Implement: `seamCross` (artwork bounding region crossing a panel seam or a mirrored seam line, using real
   panel outlines and seam allowance), `minDpi` (effective dpi of each raster layer at its placed print size
   against the print profile minimum; the print profile's dpi default is labelled), `bleed` (compute the
   bleed region for each panel and report where artwork stops short of it), `safeZone` (names and numbers
   inside a zone with clear space from seams and edges; zone sizes are settings with labelled defaults),
   `gamut` (a conservative sRGB-to-sublimation estimate: flag colours outside a stated approximate gamut;
   say plainly that the true gamut needs the print house's ICC profile, which we do not have; no claim of
   accuracy).
3. Wrap them so the editor can call them live without blocking (pure, fast, under 20 ms for a typical
   design; benchmark test).
4. Add a minimal editor surface: a "Checks" list under the canvas using existing components; no editor rewrite.

**Done when.** Table-driven tests plus fast-check property tests; a benchmark test; the decision record lists
owner questions (print house ICC, minimum dpi, name/number clear space, league rules).

## V8. Intake test set and evaluation harness

**Goal.** Spec acceptance for stage 1: 95% of a 200-prompt test set maps to the right article; nothing is
created outside the catalogue; a jersey photo maps to article and colours in under 10 seconds. Build the
test set and the harness that scores it.

**Owns.** `apps/web/lib/intent/eval/**` (new), `docs/evals/intake-2026-10.md`. Read `lib/intent` (vocabulary,
golden tests, decisions 0013, 0019, 0020).

**Do.**
1. Write 200 realistic prompts as JSON fixtures (football and cricket kits, club and small-brand wording,
   Australian phrasings, typos, partial requests, out-of-catalogue requests such as "wetsuit" or "hockey
   stick", and ambiguous ones) each with the expected article id from the CURRENT registry plus the expected
   "nearest block with the difference said in one line" for out-of-catalogue. Where the right answer depends
   on V2's new articles (not merged yet), record the expected id under `pending_catalogue` and score those
   separately.
2. A harness `pnpm --filter web eval:intake` that scores: article accuracy, colour extraction (hex within a
   tolerance), refusal/nearest-block behaviour, latency, and cost; supports a stub provider (CI, free) and a
   live provider (manual, uses the configured key and the daily cap).
3. Run the stub in CI as a unit test so the fixtures stay valid; do not run the live provider in CI.
4. Report the baseline of the deterministic path (the vocabulary matcher without a model) in the doc.

**Done when.** The fixtures validate against the registry, the harness runs, and the doc states the baseline
and what would be needed to reach 95%.


---

# Wave 2 (active from 2026-10-25)

Repository: https://github.com/Knitwright/knitwright-platform (moved from SameedIlyas; the old URL redirects).
Branch names `feat/v4-w2-<id>-<slug>`. Decision records 0047 to 0053. Migration timestamps assigned at the end.
Wave 1 is merged on main.

## Lessons from wave 1 that every wave 2 agent follows

Wave 1 agents wrote database and end-to-end tests they could not run (no Docker in the cloud sandbox) and most of them
failed in CI for avoidable reasons. Read these before writing a single test:

1. **Study a passing neighbour first.** Copy the idiom of an existing integration test (`apps/web/tests/integration/*.test.ts`,
   helpers in `support.ts`) and an existing e2e spec (`apps/web/e2e/*.spec.ts`, helpers in `e2e/support.ts`). Never invent a
   label, route or helper: grep for it. A wave 1 test looked for a "Garment type" field that does not exist.
2. **A person may belong to at most 3 brands.** Create a fresh `person()` per brand in a db test; do not call `brandOf` four
   times for one person.
3. **Append-only and server-write tables.** The service role usually holds only SELECT on them (writes go through SECURITY
   DEFINER functions), so a direct write answers "permission denied", not a trigger message. Assert what the database really
   does. Never weaken a grant to make a test pass.
4. **Platform-only routes** (`/ops`, admin) answer 404 to members; an API call with no session answers whatever the existing
   guard answers (read `lib/server` and the admin leads route); do not guess 404 versus 401.
5. **Shared files conflict.** `apps/web/vitest.config.mts` (the per-directory coverage list) and
   `apps/web/tests/integration/isolation.test.ts` (the table lists) are edited by almost every workstream. Add only your own
   entry, and before your final push run `git fetch origin && git merge origin/main`; on a conflict keep the UNION of both
   sides. New tables must be added to the isolation test's lists in the existing shape (a `SHARED_TABLES` entry needs a `row`
   that exists and the `attempt` and `change` objects; platform tables follow the existing `PLATFORM_TABLES` shape).
6. **Cross-workstream tests.** A test that asserts something about the whole registry or catalogue (for example
   `lib/intent/eval/fixtures.test.ts`, which requires every article to be named by a prompt) breaks when someone else adds to
   the registry. If you add an article, route or table, search the tests for assertions that enumerate everything and update them.
7. **Do not stop early.** Your session is over when CI has finished on your last push, not when your code is written. After
   `gh pr create` run `gh pr checks <n> --watch` (about 15 to 20 minutes) and fix failures from the annotations:
   `gh api repos/Knitwright/knitwright-platform/check-runs/<job-id>/annotations`. Up to four rounds. Then post the PR comment.
8. **Local gate you can run:** `pnpm install`, `pnpm --filter web typecheck`, `pnpm --filter web lint`, and
   `pnpm --filter web exec vitest run --project unit <your dirs>`. Run them before every push. Use background runs and a monitor
   for anything over two minutes.
9. Everything in "Rules every workstream follows" above still applies. Do not merge your PR; the orchestrator merges.

## W2-A. Inspiration variants (spec stage 3, applicable variants)

**Goal.** A side panel that always shows 8 to 12 alternatives for the current design: colourways, pattern swaps, placement
moves, each a deterministic parameter set rendered by our own flat renderer. One click applies one as a NEW VERSION. Mood images
are out of scope here.

**Owns.** `apps/web/lib/variants/**`, `apps/web/components/variants/**`, `apps/web/app/api/projects/[projectId]/variants/**`,
decision 0047. The editor shell file that hosts tool panels (find it under `components/studio/workspace`) may get one new tool
entry and nothing else.

**Do.**
1. Read the design object, kit styles (`lib/kit-styles`), the artwork layer model (decision 0035), the guardrails
   (`lib/guardrails`, decision 0045) and the validation gate (`lib/validation`, decision 0039).
2. `generateVariants(design, { count: 8 to 12, seed })` is pure and deterministic for a given design and seed: colourways drawn
   from the club kit and from harmonious palettes (computed in Lab; no model calls), kit-style swaps from the existing gallery,
   placement moves of sponsor and crest within named zones. Never change structure the factory profile does not list.
3. Every variant is run through the guardrails and the validation gate BEFORE it is shown: a variant with a blocker is dropped
   and the next candidate is tried. The UI states which guardrail warnings a shown variant still carries.
4. Applying a variant creates a new version through the existing version-save path (read `lib/projects`); undo and history come
   free. Idempotent: applying the same variant twice to the same version does not create two versions.
5. UI: a one-screen panel of preview tiles drawn with the existing flat renderer, visibly separate from any future mood-image
   section. Respect `plans/design-reference.md`.

**Done when.** Property tests (deterministic, count in range, none violates structure, none carries a blocker), unit tests for
apply idempotency, an e2e that opens a design, sees 8 to 12 tiles and applies one to get version 2.

## W2-B. Chat edits as design diffs

**Goal.** Spec: "make the sleeves darker", "try diagonal stripes on the front", "move the sponsor lower" become design-object
diffs, previewed, applied on confirm. Every change is a version. No regenerated images.

**Owns.** `apps/web/lib/design-diff/**`, additions to `apps/web/components/studio/assistant/**` (find the existing assistant UI;
do not rewrite it), decision 0048. Read `lib/intent` (decisions 0013, 0019), the existing assistant route and the
`assistant_messages` table (migration 20261013020000).

**Do.**
1. A typed diff format over the design object (set colour, move placement, swap style, change option) with `previewDiff`
   (applies to a copy, returns the changed design plus what changed in plain words) and `applyDiff` (creates a new version).
2. The assistant turns text into a diff through the existing intent and provider layer with a fixed schema; unknown requests
   are refused with the nearest supported change named. A stub provider for tests; no live model in CI.
3. Every diff is validated against the factory profile and guardrails before preview; failures are shown, not applied.
4. UI in the existing assistant dock: the diff card shows before and after tiles and Confirm and Discard. Confirm applies;
   Discard leaves no trace. Metering through `lib/usage`.

**Done when.** Unit tests for each diff kind, a test that no diff can change something the profile does not allow, an e2e with
the stub provider (confirm creates the next version; discard does not).

## W2-C. glTF base-model pipeline (spec principle 2: UV layout equals the print panel layout)

**Goal.** The 3D view reads a real glTF per article whose UV islands are the print panels, with textures taken from the same
panel renders the print files use. There are no artist-made models yet, so build the pipeline and a procedural placeholder.

**Owns.** `apps/web/lib/gltf/**`, `apps/web/components/gltf/**`, `apps/web/lib/gltf/OWNER-QUESTIONS.md`, decision 0049. Do not
edit `lib/garment3d` or its component beyond one import line; keep three.js loaded only on demand (an architecture test enforces
this: read `tests/architecture/garment3d.test.ts` and extend it for your folders).

**Do.**
1. A glTF contract: a node per panel, UV rectangle equal to the panel's rectangle in the panel layout (production contract in
   `lib/production/contract`, decision 0034 coordinates), units stated, one material per panel group, texture size 2048.
2. `validateModel(gltf, panelLayout)` proves the UV islands equal the layout within a tolerance and reports each panel's error.
   This is the check an artist's model must pass.
3. A procedural placeholder generator that builds a glTF from the panel layout for the existing articles (extruded panel shapes,
   honestly labelled "placeholder, not an artist model"), plus a size-grading transform that scales a model by the block's
   grading so XS and 3XL show artwork scaled correctly.
4. Viewer: loads a model, applies per-panel textures from the panel renderer, orbit, zoom and preset views, and falls back to
   the existing viewer when no model exists. Keep the "not for fit or drape" label.

**Done when.** Unit tests for `validateModel` (passing and failing fixtures), grading tests, a render smoke test that builds a
scene with the placeholder without a GPU, and the architecture test still green.

## W2-D. Ops console part 2: QC, packing, shipping, exceptions, metrics

**Goal.** Continues V5 (`lib/ops`, decision 0043, migration `20261025050000_ops_batches.sql`): the rest of the spec's ops table.

**Owns.** `apps/web/lib/ops/qc/**`, `lib/ops/packing/**`, `lib/ops/shipping/**`, `lib/ops/exceptions/**`, `lib/ops/metrics/**`,
additions under `apps/web/app/(ops)/ops/**` and `apps/web/components/ops/**`, migration `20261026040000_ops_qc.sql`,
decision 0050.

**Do.** Read decision 0043 and all of `lib/ops` first and copy its patterns (platform-admin access guard, service-only writes,
append-only history).
1. QC gate: a checklist per order (measurements against the size spec on a sample, colour against the swatch, artwork placement,
   names and numbers against the roster, defect count, photos referenced as file ids). A fail blocks shipping and creates a
   remake line for the factory. QC record per order; defect rate per factory.
2. Packing: pack list per player from the roster (names are personal data: reuse the erasure path in `lib/deletion` and add the
   new tables to it), label per bag, carton weight and dimensions as inputs (no invented values), a packing list document.
3. Shipping: record courier, tracking number and shipped date; status moves to shipped only after QC pass. No courier API calls
   (owner decision pending): a provider interface with a manual implementation.
4. Exceptions log: remake, partial shipment, lost parcel, size swap; every exception has an owner and a due date.
5. Console home metrics: orders this week, pieces in production, on-time rate against the promise, defect rate by factory,
   remakes open, batch value, next cut-off. Computed from the tables; no mock data.

**Done when.** db tests (RLS, append-only, admin-only), unit tests for every transition and metric, an e2e that takes an order
through QC to shipped (use `e2e/ops.spec.ts` from V5 as the pattern).

## W2-E. Credits wired into outputs

**Goal.** Spec: marketing media, the full tech pack PDF and pattern files cost credits; credits spent on a design are refunded
when that design is ordered. Wave 1 built the ledger (`lib/credits`, decision 0044) and the status model (`lib/validation`).

**Owns.** `apps/web/lib/credits/**` (edits), `apps/web/lib/credits-gate/**` (new), the minimum lines in the existing export,
print-files, pattern and image routes needed to call the gate, decision 0051. No migration unless truly needed (timestamp
`20261026050000_credit_hooks.sql` is reserved).

**Do.**
1. A `withCredits(kind, handler)` wrapper for route handlers: balance check, idempotent spend keyed by (brand, kind, design
   version hash), refusal with a plain message naming the price and the balance. Free outputs stay free (design, versions, 3D
   views, team-store hand-off, tech pack summary).
2. Wire it into: the full tech pack PDF export, pattern file download, print-file download, photoreal image generation. Read
   each route first and keep the diff small. Downloading the same version again is not charged twice.
3. A feature flag `CREDITS_ENFORCED` (default OFF) so the owner switches enforcement on when prices are set. When off, the
   wrapper only records what would have been spent.
4. Refund: when a design version becomes `ordered` (see `lib/validation`), refund every spend on that version once.
5. UI: show the price on each paid action and the balance after spending.

**Done when.** Property tests (idempotency, refund once, free paths never charge), route tests for each wired route with the flag
on and off, and no behaviour change with the flag off (the existing e2e specs for exports must pass unchanged).

## W2-F. Football and cricket templates

**Goal.** Seed Knitwright-made templates for V2's new articles so a club never starts blank (spec: templates per sport on the
article page).

**Owns.** `apps/web/lib/templates/seed/teamwear/**`, the seed script entry, decision 0052 (short). Read V3 (`lib/templates`,
decision 0041) and V2 (`lib/garment/registry/teamwear`, decision 0040).

**Do.** At least 3 templates per new article that has a flat today (football shirt, shorts, goalkeeper shirt, training top;
cricket shirt, trousers, training tee), built deterministically from existing kit styles and the article's real options. Each
carries "Knitwright starter, not reviewed by a factory". Do not create templates for articles with no flat or for the empty
winter-code slot. Extend the template filter tests for the new sports. Update any all-articles assertions (lesson 6).

**Done when.** Seeds validate against the registry, every template opens in the editor (unit test through the copy-into-design
path), and an e2e: filter the library by football, use a template, land on version 1.

## W2-G. Editor: per-panel layers decision and spike (Fabric.js)

**Goal.** Spec stage 3 wants layers per panel and across panels (base colour, gradient, pattern fill, uploaded artwork, text, text
on a path, crest, sponsor, name and number placeholders) in a Fabric.js v7 editor. Rewriting the editor blind is too risky.
Produce a decision, a data model and a contained spike.

**Owns.** `docs/decisions/0053-panel-layer-editor.md`, `apps/web/lib/panel-layers/**`, `apps/web/components/panel-layers/**`, and
a feature-flagged, unlinked prototype route `app/(app)/studio/[projectId]/layers/` behind `NEXT_PUBLIC_PANEL_LAYERS`. Do not edit
the existing editor.

**Do.**
1. Read the current editor and artwork layer model (decision 0035, `lib/artwork-stack`, `lib/artwork-intake`) and write the
   decision record: what the current model already covers, what Fabric.js v7 would add (MIT licence; measure the bundle impact
   and the SSR constraints with this Next), the migration path, the risks, and a recommendation (adopt, adopt for panels only, or
   extend the current renderer). Concrete and measured, not generic.
2. A pure data model mapping between our layer stack and Fabric JSON, round-trip tested (no loss) for every layer kind.
3. The spike: one panel editable in Fabric on the unlinked route, loading and saving through the existing artwork layer model and
   running the V7 guardrails live in a Checks list. Dynamic import only.
4. List what remains (text on path, auto-vectorise raster logos, seam-crossing overlays across panels) with estimates.

**Done when.** Round-trip property tests; the route renders in an e2e smoke test only when the flag is on; the decision record
ends with a clear recommendation for the owner.

## Wave 2 migration timestamps (assigned)

| File | Workstream |
|---|---|
| `20261026040000_ops_qc.sql` | W2-D |
| `20261026050000_credit_hooks.sql` | W2-E (only if needed) |

W2-A, B, C, F and G add no migration.
