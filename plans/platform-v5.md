# Plan v5: the platform against the v2.2 build pack

Status: ACTIVE. Written 2026-10-29 by the orchestrating session.
Spec: `docs/spec/` (the Knitwright build pack v2.2, 28 Oct 2026). Start with `docs/spec/README.md`, then
`01-product-direction.md` (settled decisions), `02-features.md` (feature IDs and acceptance tests), `03-data-model.md`,
`04-production-package.md`, `07-template-library.md` and `articles/` (the worked base article `JSY-SS-01`).
Builds on: `plans/platform-v4.md` (all five waves merged). Where v4's shared rules and this file disagree, this file wins.

## Owner decisions for v5 (2026-10-29)

1. **The Store stays separate.** Checkout, payments, team stores, club pages, storefronts, drops, Shopify, payouts and the
   seller dashboard (F-T6, F-T7 payment, F-L5, F-L6, F-L7, F-G4) are NOT built here. The platform builds everything up to the
   order and hands it over through `public.submit_order_for_production` (decision 0043). Where a feature ends in "pay", the
   platform shows the price and the delivery date and hands off; it never takes money. A workstream may add a read contract the
   Store can call (Wave 5, O2).
2. **The Sportswear model is not wired in yet.** It becomes a Python service once the model is final. `Sportswear/` is still
   never touched. The platform defines the seam now: a typed files-service contract with a stub that says "not available"
   (Wave 1, X5). Everything the spec puts on the Python service (nesting, garment-locked AI renders, logo compositing,
   brand-mark detection) goes behind that contract. Deterministic file generation (DXF, SVG, PDF, CSV, ZIP) stays in TypeScript,
   as today.
3. **The whole spec, in waves.** Waves 1 to 5 below. Each wave starts when the previous one is merged.
4. **Keep the existing data model; add the spec's catalogue beside it.** Do not rename `projects`, `spec_versions`, `brands`,
   `factory_profiles` or any table to the spec's names. The spec's entities are added where they are missing, and the mapping is
   written down in the decision record of the workstream that adds them. The spec's snake_case design object
   (`docs/spec/schemas/design-object.schema.json`) is an export format (techpack.json, interop), produced by an adapter from the
   platform spec; it is not the stored shape. Supabase stays (decision 0001); the spec's Neon/R2/Modal/Drizzle choices are not
   adopted. IDs stay `gen_random_uuid()`. New money columns are integer minor units plus a currency.

## How to use this plan

Each workstream is one cloud agent, one branch `feat/v5-<id>-<slug>` cut from `main`, one PR into `main`. Read, before code:

1. "Rules every workstream follows" and "Lessons" below.
2. `apps/web/AGENTS.md`: this Next.js is not the one in your training data. Read the relevant guide in
   `apps/web/node_modules/next/dist/docs/` before any route, page or action.
3. `docs/architecture.md` and the decision records named in your section.
4. The spec features named in your section, in `docs/spec/02-features.md`, including their acceptance tests.
5. Your own section.

An agent edits only the paths its section OWNS, plus its own migration file, its own decision record
`docs/decisions/00NN-*.md` (number given), one navigation entry, its own tests, and the shared-file entries listed in Lessons 5.
A file not listed belongs to nobody: do not edit it; work around it or say so on the PR.

Do NOT merge your own PR. Open it, make CI green, post a summary comment (what was built against which acceptance test, what was
left, owner questions), and stop. The orchestrator merges one PR at a time.

## Rules every workstream follows

All the v4 rules still apply (`plans/platform-v4.md`, "Rules every workstream follows"): no invented measurement, missing owner
input never blocks (labelled default + owner question), wording rules (`lib/techpack/wording.test.ts`), immutability, files under
400 lines and functions under 50, TDD, 80% coverage overall and 90% on new `lib/` directories, server-only writes with RLS,
deterministic outputs, metering on paid calls, no MCP at runtime, MIT/Apache/BSD dependencies only with a line in the decision
record, seeds labelled. In addition, from the spec:

- **Manufacturable by construction** (spec decision 5). Structural values only ever come from a base article's approved
  options and parameter ranges. The UI makes out-of-range values impossible, and validation still checks them.
- **Every rule explains itself** (spec decision 11). Every validation finding, parameter range, option and tech-pack field carries a
  `ruleId` (format `R-<TOPIC>-<NNN>`, e.g. `R-SUB-004`) that resolves to a `rulebook_entry`. Until wave 1 merges, use the IDs from
  `docs/spec/articles/JSY-SS-01/rulebook.md`; never invent a rule's text. A check with no entry yet uses `R-GAP-000` and is listed in
  the PR comment.
- **AI never draws the garment** (spec decision 13, principle 4). AI output becomes parameters and layers, never pixels on a panel.
  Generated imagery and inspiration images never reach a panel layer or a print file; a test proves it where the code could.
- **Data, not constants.** Catalogue, prices, tiers, cut-offs, lead times, country rules and factory capabilities are rows or
  settings, never literals in code. Spec placeholders (prices, tolerances, fabric codes) are seeded as labelled defaults.
- **No live paid call from tests or your own run.** Every provider is an interface with a deterministic stub; a real adapter exists
  only behind an env key and is never called in CI. No third-party HTML or image is stored (spec rule for F-S1, F-S2).
- **Never touch** `Sportswear/`, `kitwright/`, `supabase/config.toml`, or Store concepts (cart, checkout, Stripe, payments,
  team-store links, storefronts, payouts).

## Lessons (from v4; every agent reads these)

1. **Study a passing neighbour first.** Copy the idiom of an existing integration test (`apps/web/tests/integration/*.test.ts`,
   helpers in `support.ts`) and e2e spec (`apps/web/e2e/*.spec.ts`, helpers in `e2e/support.ts`). Never invent a label, route or
   helper: grep for it.
2. **A person may belong to at most 3 brands.** Create a fresh `person()` per brand in a db test.
3. **Append-only and server-write tables:** the service role usually holds only SELECT; writes go through SECURITY DEFINER
   functions. Assert what the database really does. Never weaken a grant to make a test pass.
4. **Platform-only routes** (`/ops`, admin) answer 404 to members; for no session, read the existing guard, don't guess.
5. **Shared files conflict:** `apps/web/vitest.config.mts` (coverage list), `apps/web/tests/integration/isolation.test.ts`
   (table lists), navigation, `lib/copy/vocabulary.ts`, `lib/garment/spec-schema.ts`. Add only your own entry. Before your final
   push run `git fetch origin && git merge origin/main`; on a conflict keep the UNION of both sides. New tables go into the
   isolation test's lists in the existing shape.
6. **Cross-workstream tests** that enumerate the registry, catalogue, routes or tables break when someone else adds to them.
   Search for them and update them.
7. **Do not stop early.** You are done when CI has finished on your last push. After `gh pr create` run
   `gh pr checks <n> --watch` and fix failures from the annotations
   (`gh api repos/Knitwright/knitwright-platform/check-runs/<job-id>/annotations`). Up to four rounds. Then post the PR comment.
8. **Local gate:** `pnpm install`, `pnpm --filter web typecheck`, `pnpm --filter web lint`,
   `pnpm --filter web exec vitest run --project unit <your dirs>`. There is no Docker in the cloud sandbox: database and e2e tests
   run in CI only, so write them with extra care (Lesson 1).
9. **Interfaces before the other side exists.** When your section says "through an interface", define the smallest TypeScript
   interface in your owned directory with a test double, and depend on that. The orchestrator wires real implementations in a
   later wave. Never import from another workstream's unmerged directory.

---

# Wave 1: foundation (all parallel)

Decision records 0066 to 0073.

## X1. Base article catalogue (F-S3 data, F-S8 data, spec decision 5)

**Goal.** The spec's base articles exist as data: a makeable block with sizes, POMs with grades and tolerances, parameters with
factory-approved ranges, options with catalogue codes, allowed fabrics and a construction table.

**Owns.** `apps/web/lib/catalogue/**` (new), migration `20261101010000_base_articles.sql`, decision 0066.

**Do.**
1. Tables (platform data, readable by signed-in members, written only by platform admins through the service client):
   `base_articles` (code e.g. `JSY-SS-01`, production class A|B, sport tags, status draft|sampling|live, size range, sample size,
   glb model key, uv panel map, parametric script id + version, registry type id it maps to), `article_poms` (letter, code,
   description, grade type linear|non_linear|ungraded, grade mm, tol −/+ mm, value per size, rule id), `parameter_defs` (key, type
   range|enum|bool, min, max, step, default, unit, affects panels, rule id, `approved_by_sample_id` nullable = "Not yet sampled"),
   `option_defs` (group e.g. collar, catalogue code `C01`, label, thumbnail key, extra cost minor units + currency, rule id,
   approved sample nullable), `article_construction` (seam, ISO stitch class, SPI, thread, allowance, hem/binding width, rule id),
   `article_fabrics` (allowed fabric codes).
2. Seed `JSY-SS-01` from `docs/spec/articles/JSY-SS-01/article.json` exactly (every value labelled "Knitwright draft v0.1, not
   reviewed by a factory"). Seed the other 7 launch articles of `docs/spec/articles/ONBOARDING.md` as `status: draft` with code,
   class, sport tags, size range and allowed fabric codes only; leave POMs, ranges and construction empty. Never invent values.
3. Map each base article to the existing garment registry type (`lib/garment/registry/**`) so existing designs keep working:
   `baseArticleForType(typeId)` and the reverse. Document the mapping table in the decision record.
4. Read API in `lib/catalogue`: `getBaseArticle(code)`, `listBaseArticles(filters)` (sport, article type, fit, gender, class,
   fabric), `parameterRange(code, key)`, `optionsFor(code, group)`. Typed, zod-validated rows.

**Done when.** Seed round-trips `article.json` (test compares every POM and range); filters tested; RLS db tests; isolation test
lists updated.

## X2. Rulebook and "Why?" v1 (F-S5 v1)

**Goal.** A versioned rulebook and a "Why?" link that shows a rule's text. No LLM yet.

**Owns.** `apps/web/lib/rulebook/**`, `apps/web/components/rulebook/**` (new), migration `20261101020000_rulebook.sql`, decision 0067.

**Do.**
1. `rulebook_entries` (rule id unique per version, topic construction|fabric|print|fit|grading|labels|qc|cost|pattern|
   personalisation, article codes, title, body, best practice, source factory|pattern_master|standard|knitwright, version, status
   draft|confirmed, confirmed by + at) and `rulebook_gaps` (question or check code with no entry, context, count, first/last seen).
2. Seed all 45 rules from `docs/spec/articles/JSY-SS-01/rulebook.md` verbatim, status `draft`, source as stated. Add `R-GAP-000`
   ("No rule written yet; the team has been told").
3. `resolveRule(ruleId)`, `rulesFor({articleCode, topic})`, `logGap(...)`.
4. `<WhyLink ruleId>`: a small accessible popover showing title, body, best practice, source and status ("Draft, not yet confirmed
   by the factory" when draft). An unknown id shows the gap text and logs a gap through a server action.
5. A platform-admin page `/admin/rulebook` to list, edit (new version, never overwrite) and confirm entries, and to see gaps.

**Done when.** All 45 seeded and tested; popover a11y test; versioning test; admin guard test; e2e opens a Why? popover.

## X3. Graded parametric drafter (F-S3 geometry)

**Goal.** Base article geometry from a graded POM table and parameters, for every size, matching the worked example.

**Owns.** `apps/web/lib/parametric/**` (new), decision 0068. No migration.

**Do.**
1. Port `docs/spec/articles/JSY-SS-01/tools/draft-pattern.ps1` to TypeScript: input `article.json` shape + size + parameters, output
   panels in mm (cut line, sew line, notches, grain line, labels) as the existing `lib/production/contract` pattern-piece types.
   Keep its armhole/sleeve-cap solve (3 mm ease, 0–6 mm allowed) and neck/rib length check.
2. Golden tests: for every size XS–3XL, outline lengths and POMs match the committed `docs/spec/articles/JSY-SS-01/pattern/*.dxf`
   within 0.5 mm; `pattern-report.md` rows reproduced. Every size × every parameter at its range ends gives closed, non-self-
   intersecting panels (spec F-S3 acceptance).
3. Parameters: body length, sleeve length, drop tail (ranges from `article.json`); options C01–C03 collars and K01/K02 sleeve
   finishes where `article.json` defines them; anything it doesn't define returns "not drafted yet", never a guess.
4. A script registry `draftArticle(code, size, params)` so more articles plug in; `SHO-TR-01` returns "not drafted yet".
5. Writers: reuse `lib/pattern-library/dxf/write.ts` (layers 1 cut, 14 sew, 7 grain, 4 notch, 13 drill, 15 text) and add an SVG 1:1
   writer if none fits. A graded nest (all sizes stacked) as DXF and SVG.

**Done when.** Golden tests green; nest file deterministic (same bytes twice); coverage 90%.

## X4. Design object v2 and validation (F-0)

**Goal.** Every design sits on a base article, carries parameters, validates on every save, and every finding has a rule.

**Owns.** `apps/web/lib/validation/**`, `apps/web/lib/design-object/**` (new: the spec-schema export adapter),
the `article` addition in `apps/web/lib/garment/spec-schema.ts` (smallest change, schema version bump with a migration of old
specs in code), migration `20261101030000_design_validation_v2.sql`, decision 0069.

**Do.**
1. Spec schema: add `article { baseArticleCode, productionClass, parameters: Record<string, number|string|boolean> }`, optional for
   old specs (derived from the registry type through an interface with a test double; X1 provides the real map in wave 2).
2. Status: add `approved` (draft → validated → approved → ordered; editing an approved or ordered version makes a new draft).
   Store `validation_results` (version, profile, checks with code, severity, message, target, rule id, passed) per version.
3. Validate on every save (hook into the existing version save path in `lib/projects` with the smallest change), not only on demand.
4. Every finding gets a `ruleId`. Register the existing `lib/guardrails` checks (dpi, bleed, safe zone, seam crossing, gamut) as
   validation check modules. Add `parameters-in-range` (reads ranges through an interface) and `moderation-clear` (reads a
   moderation status through an interface) modules.
5. `toDesignObjectV2(spec)` in `lib/design-object`: export to `docs/spec/schemas/design-object.schema.json`, validated against that
   schema in tests (use a JSON-schema validator already in the repo, or add `ajv` (MIT) with a line in the decision record).

**Done when.** Each finding has a rule id (test enumerates all codes); illegal transitions refused; save-path test; schema export
validates on 10 fixture designs.

## X5. Production package (KPP) assembler and the files-service seam (04-production-package.md)

**Goal.** One deterministic ZIP per design version × factory, laid out exactly as `docs/spec/04-production-package.md`, and a typed
seam for the future Python service.

**Owns.** `apps/web/lib/kpp/**`, `apps/web/lib/files-service/**` (new), decision 0070. No migration unless storing package exports
needs one (`20261101040000_package_exports.sql`).

**Do.**
1. Assembler: `manifest.json` (every file, sha256, generator version, design hash), `00_README.pdf`, `01_techpack/techpack.pdf`
   (existing PDF) + `techpack.json`, `02_measurements/pom.csv` + `size_chart_customer.pdf`, `03_patterns/{dxf_aama,pdf_1to1,svg}`
   per size + nest, `04_print/<size>/…` (existing print files), `05_colour/colour_spec.{pdf,json}`, `06_bom/bom.csv`,
   `07_labels/care_label_<market>.pdf`, `08_personalisation/names_numbers.csv`, `09_qc/qc_checklist.pdf`,
   `10_reference/renders_front_back.pdf`. Batch variant adds `job_sheet.pdf` and groups print files by order.
2. Every file is built from existing generators where they exist (`lib/techpack`, `lib/print`, `lib/pattern-library`,
   `lib/ops/factory-sheet`); write the missing ones. The 1:1 PDF is tiled for A0 with alignment marks and a 100 mm scale bar.
   Pattern inputs come through an interface (X3 provides graded panels in wave 2; until then the existing pattern blocks).
3. F-G2 gate: the package refuses to build while any field is "needs your input" or contains `[TBC]`; the refusal lists them.
4. Deterministic: same version + profile gives byte-identical ZIP (test builds twice and compares sha256). PDF metadata dates are
   pinned to the version's creation time.
5. `lib/files-service`: the contract for the future Python service (nest/marker with fabric width and shrinkage, costing, garment-
   locked render, design transfer, logo composite, brand-mark check, avatar fit) as TypeScript request/response types, a client
   that calls `FILES_SERVICE_URL` with a signed service token, and a stub that answers "not available" when the URL is unset.
   Document in the decision record which Sportswear engine each endpoint will come from (see `Sportswear/README.md`) and its
   licence notes (the klein-9b waiver and SegFormer must not be used commercially). Nothing calls it yet except a health check.
6. Export route behind the credits gate (`production_package` kind; free when Knitwright makes it, per spec decision 9).

**Done when.** Layout test lists every path in 04; determinism test; gate test; files-service stub test; build under 60 s in a
test for one article × 7 sizes.

## X6. Factory model as data (factory profile read model, F-O1 data, F-S7 dates)

**Goal.** Factories, capabilities, price tiers, fabrics and country rules as rows, built into the existing factory profile.

**Owns.** `apps/web/lib/factory/**` (new), migration `20261101050000_factories.sql`, decision 0071. Reads, does not edit,
`lib/validation/profile.ts` (X4 owns it; X6 exports a builder that produces the same type).

**Do.**
1. Tables: `factories` (name, city, WhatsApp contact, certifications with expiry, status), `factory_capabilities` (factory × base
   article code × fabric code: lead time days, MOQ, weekly slot capacity for class A, file formats accepted, golden sample status,
   colour ΔE max), `price_tiers` (capability, qty min/max, cost minor + currency, sell GBP minor, sell AUD minor, personalisation
   cost), `programme_fabrics` (code, blend, gsm, stretch, finish, pfas_free, oeko_tex cert, sublimatable, swatch ref) and
   `programme_fabric_colours` (name, hex, Lab, Pantone), `country_rules` (country, VAT rate, low-value threshold, duty by HS,
   preference scheme, label rules JSON, selling enabled).
2. Seed: one factory "Sialkot partner (placeholder)", capabilities for JSY-SS-01 and SHO-TR-01, the spec's fabric codes
   (F-POLY-INT, F-POLY-PQ, F-POLY-EL, F-POLY-4W, F-STK-TEE, F-STK-FLC) and the club price ladder £29/£25/£22 from
   `docs/spec/01-product-direction.md`, all labelled placeholders. GB and AU country rules enabled; US and EU present, disabled.
3. `buildFactoryProfile(factoryId)` producing the existing `FactoryProfile` type, cached and invalidated on change;
   `priceFor(article, qty, currency)` across a basket (tiers counted across the whole basket, spec F-T5);
   `promisedDate(orderAt, article, class)` = next cut-off + lead time + QC + freight, cut-off Class A Monday 12:00 Asia/Karachi
   (a setting), Class B on confirmation.
4. Ops settings page section to edit these (platform admins only), reusing `lib/settings` patterns.

**Done when.** Price and date unit tests (incl. DST and the PKT cut-off); profile builder parity with the old seeded JSON; RLS.

## X7. Factory job packet (F-O2)

**Goal.** A factory gets a link, no account, to its batch: files, lists, due date, and buttons to update status and add photos.

**Owns.** `apps/web/lib/job-packet/**`, `apps/web/app/job/[token]/**`, `apps/web/app/api/job/**` (new), migration
`20261101060000_job_packets.sql`, decision 0072.

**Do.**
1. `job_packets` (batch id, token hash, expires at, revoked) and `factory_events` (packet, type received|in_production|
   ready_for_qc|note|photo, note, photo keys, at). Tokens: random, stored hashed, expiring, revocable (same model as `share_links`).
2. Page: job sheet PDF, order list, size breakdown, name/number list, BOM, ZIP of print files and patterns (reuse the batch print ZIP;
   add patterns through an interface X5 fills in wave 2), due date. Buttons Received / In production / Ready for QC write
   `factory_events` and move the ops order status through the existing ops service. Photo upload with MIME sniff, size limit and
   EXIF strip, rate limited.
3. Ops: create, resend and revoke a packet from the batch page.
4. WhatsApp: `lib/job-packet/notify` with a provider interface, a stub, and a WhatsApp Business Cloud API adapter behind
   `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` (never called in CI). Message text in plain words with the link.

**Done when.** Token tests (hash, expiry, revoke); status transition tests; upload limits; e2e: ops creates a packet, the packet page
loads without a session and records "Received".

## X8. Moderation and IP basics (F-G1)

**Goal.** Every upload, generation and order passes a moderation check with a stored result.

**Owns.** `apps/web/lib/moderation/**` (new), `apps/web/app/(ops)/ops/review/**` (new), migration
`20261101070000_moderation.sql`, decision 0073.

**Do.**
1. `moderation_checks` (target kind asset|text|version|generation, target id, result clear|flagged|blocked, reasons, reviewer,
   reviewed at), `rights_holder_marks` (holder, mark text, image hash, contact), `takedown_notices` (+ repeat-infringer count per
   brand).
2. Text screening: profanity list (licensed MIT/CC0 list, or a small curated one), brand-name blocklist, product titles containing
   "dupe" or "inspired by <brand>" blocked; names and slogans for names/numbers.
3. Image screening through a provider interface: perceptual hash against `rights_holder_marks`, plus a vision check adapter using
   `lib/providers` behind its existing key (stubbed in tests).
4. Hook points as functions other code calls: `screenUpload`, `screenText`, `screenGeneration`, `screenBeforeOrder`. Wire
   `screenUpload` into the existing artwork upload path with the smallest change; the rest are wired in wave 2.
5. Ops review queue: flagged items, approve/block with a reason; human review is required before any Class B run (enforced by a
   function later code calls).
6. A public rights-holder report form (rate limited, Turnstile like the existing public forms).

**Done when.** Each screen has unit tests incl. false-positive cases ("Arsenal" blocked as a brand term in a title only per the
blocklist); queue guard tests; upload hook test.

---

# Wave 2: Studio core, Fabra-style (starts after wave 1 merges)

Before wave 2 starts the orchestrator wires the wave 1 interfaces (X1 map into X4, X3 into X5, X5 into X7, X8 into X4) in one
small PR. Decision records 0074 to 0081. Spec references: F-S4, F-S6, F-S7, F-S8, F-S9, `docs/spec/research/kittl-fabra/
video-ui-notes.md` Videos 1–2. The editor follows Fabra's layout; Form only exposes approved options and ranges.

## Y1. Studio home, create-new modal and catalogue (F-S4 home, F-S8)

**Owns.** `apps/web/app/(app)/studio/(home)/**`, `apps/web/app/(app)/catalogue/**` (new), `apps/web/components/studio/home/**`,
`apps/web/lib/home/**`. Decision 0074.
Studio home per F-S4: left sidebar (+ New, workspace switcher, Products, Brand kit, Projects with All · Designs · Collections ·
Moodboards · Pattern fills · Mockups · Flows, Library, Help, Trash), top bar search, credits, notifications; action cards; Jump back
in with filter chips and type tags. Create-new modal: Base products, Templates, From your crest or logo, Your team; no blank canvas
(existing blank option removed; custom patterns go through the pattern service). Catalogue: Base products | Templates tabs, sort,
filter panel (Sport, Article type, Fit, Gender, Class, Fabric, Style), grid cards with "From £x · from 1 pc" from X6 tiers, the
"Edit this product's form" icon. Article page (F-S8): photos (labelled "render, not photo" until sample photos exist), price ladder,
fabrics with spec cards, size chart, fit notes, care, lead time; UK|GBP / AU|AUD selector. Links to Projects sections that do not
exist yet show "Coming in a later release", not a dead link.

## Y2. Editor shell and Form toolbar (F-S4 editor)

**Owns.** `apps/web/app/(app)/studio/[projectId]/page.tsx` and a new `components/studio/editor/**`, `lib/editor/**`. Decision 0075.
Top bar (auto-name from options, File menu, undo/redo, credits, Validate chip with findings list and Why? links, Share, Export),
left rail segmented Form | Library | Specs (Library and Specs panels are slots Y3 and Y4 fill), canvas with **2D | 3D | Tech pack**
toggle and side-by-side mode, bottom bar colourway selector (Home · Away · GK · + New) and size selector, Simulate button with
status chip, right Design Summary panel (Fabrics, Colours, Pattern fills, Graphics, Names & numbers, Trims & labels, Stitches)
whose rows open their editors in place. Form toolbar: option tiles with catalogue codes, parameter sliders showing the approved range
("Body length +20 mm · range −30 to +40"), lock + "Not yet sampled" + Why? for unapproved options; a change re-drafts through X3 and
updates 3D. 3D is on by default for base articles (drop the `SHOW_3D` gate there) using `lib/gltf` with the placeholder model
labelled until artist models exist. The existing workspace tools are moved into the new shell, not deleted; existing e2e journeys
keep passing.

## Y3. 2D pattern view and Library toolbar (F-S4)

**Owns.** `components/studio/editor/view-2d/**`, `components/studio/editor/library/**`, `lib/panel-layers/**`. Decision 0076.
2D view: dotted grid, rulers, pieces with cut line, sew line, bleed, safe zone and a 100 mm scale bar (Fabric.js, decision 0053).
Library: Knitwright library (Fabrics from X6 with spec cards, Colours with Pantone TCX search + sportswear palettes, Pattern fills,
Graphics), Your library (Brand kit, Palettes, Pattern fills, Uploads), Inspiration (slot for wave 3). Click to apply to all or drag
onto one panel (hint text from the spec). Pattern-fill popover (colours, W/H mm with ratio lock, padding, rotation, apply to all or
selected, delete). Edit Graphic panel (Remove background via provider interface, Convert to pattern fill, colours, type sublimation /
heat transfer / embroidery only if the profile supports it, W × H mm, X/Y mm from anchor CF/HPS, rotation, flip, align, apply to sizes
grade/fixed/anchor, delete). All writes are design-diff patches (`lib/design-diff`), never pixels.

## Y4. Specs toolbar and tech pack view (F-S6 tabs)

**Owns.** `components/studio/editor/techpack-view/**`, `components/studio/editor/specs/**`, `lib/techpack/view/**`. Decision 0077.
Tabs Overview, Body, Measurements, Materials (BOM), Callouts, Artworks, Colourways, Personalisation, Labels & packaging, QC, Review,
with a mm | cm | in toggle and provenance chips (From base, From design, Needs your input, Confirmed). Measurements: Measurement |
Grading toggle, columns letter, measurement, grade type, grade, tol −/+, sizes with the sample size highlighted, rule column; grades
locked from X1 with lock + Why?; + Add measurement for extra QC POMs; Auto-map. Specs toolbar: Select, Measure point, Measure line,
Measure edge, Callout, drawing on 2D (and 3D where the viewer supports picking) and writing to the tech pack. Review tab lists every
"Needs your input" plus the F-G2 check; Export is blocked until clear. Excel and PDF carry identical values (test).

## Y5. Tech pack PDF to the 16-page layout and the Export panel (F-S6 export)

**Owns.** `lib/techpack/exports/**`, `components/studio/editor/export/**`. Decision 0078.
Reorder and extend the PDF to the 16 pages of `docs/spec/02-features.md` F-S6 (header and "Page x of y" footer on each), with
`docs/spec/articles/JSY-SS-01/techpack/JSY-SS-01_techpack.html` as the visual reference. Excel one sheet per tab with an "Open in
Knitwright" link cell. Export panel with live 3D preview and tabs Tech pack (section picker), Images (Front/Back/Left/Right/All,
PNG/JPG, size, mannequin and background toggles), Pattern (DXF-AAMA / 1:1 PDF / SVG / PNG, with fills and graphics, with
measurements), Print files, Production package (X5), Mockups & media (opens the existing media screen until wave 4).

## Y6. Brand Studio, manual (F-S9 without URL import)

**Owns.** `lib/brand-studio/**`, `components/brand-studio/**`, `app/(app)/brand-studio/**` (new), migration
`20261110010000_brand_studio.sql`. Decision 0079.
Brand record per brand (workspace): kind club | brand (category Club · Sportswear brand · Gym · Esports team · School), website,
about (1,000 chars), named palettes (each colour hex, Pantone TCX, nearest sublimation-safe match with a gamut warning), fonts by role
(Headline, Subheadline, Body, Accent, Name & number from a licensed kit-font list), logos and graphics (from existing uploads),
visual style (Setting, Art direction, Rules & boundaries, typed by hand now), voice and tone tags, Sportswear tab (crest, sponsors with
DPI check, label artwork, packaging, default size range), completion %. Clubs can start from their crest: palette extracted as in F-T2
(k-means in Lab; put the shared function in `lib/colour/palette.ts`). Brand switcher with completion pill in the top bar. A shared
`<BrandTab>` for colour and font pickers that Y3 and later waves use. Existing `club_kits` data is migrated or read through, not lost.

## Y7. Make: product created, samples, golden sample, order modal (F-S7)

**Owns.** `lib/make/**`, `components/make/**`, `app/(app)/studio/[projectId]/make/**`, migration
`20261110020000_golden_samples.sql`. Decision 0080.
Product-created hand-off page (summary with price at 1/50/100 from X6, hero render; next steps Order a sample, Shoot it, Connect your
store & publish (link out to the Store: shows "Handled by the Knitwright Store"), Order a run (disabled until a golden sample)).
Sample request: one piece per size, max 3 sizes, price and lead time shown, submitted to ops through `submit_order_for_production`
(no payment here). `golden_samples` (version, factory, photos, measured POM, ΔE readings, approved by + at): founder rates fit and
colour and approves, or requests changes (new draft). Order modal "Select sizes": search my products, chips All · Class A · Class B ·
Ready by <date>, rows per product × size with tier price recalculating, total, delivery date from X6, hand-off button. A run requires an
approved golden sample of the version or of a parent that differs only in surface (test). Class B 50–300 per style.

## Y8. Names & numbers, repeat maker and Share (F-S4)

**Owns.** `components/studio/editor/names-numbers/**`, `components/studio/editor/repeat-maker/**`, `lib/repeat/**`,
`components/share/**`, `lib/share/**` (extend). Migration `20261110030000_share_invites.sql` if needed. Decision 0081.
Names & numbers: licensed font list, colour role, outline, zones fixed by the base (R-PER rules), preview "SMITH 7" on 3D.
Repeat / pattern-fill maker: upload or draw, tile size cm/in, Full drop · Half-drop · Brick · Mirror, tile bounds, layers, background;
Publish to Your library; uploads go through X8 `screenUpload`. Share popover: invite by email with Can view / Can comment / Can edit and
a message (email via a provider interface; no email is sent without a key), Copy link with "Only invited people" / "Anyone with the
link can view", People with access list.

---

# Wave 3: Inspire, intelligence and Teamwear (starts after wave 2 merges)

Decision records 0082 to 0090.

## Z1. Inspiration board (F-S1)
**Owns** `lib/inspiration/**`, `components/inspiration/**`, migration `20261120010000_inspiration.sql`. Context query from the design
object (sport, article, colour names, option style tags, brand mood words) with pin/remove tags; sources in the spec's order:
Knitwright library (templates, past designs with permission), Unsplash and Pexels APIs (attribution, hotlink per terms; keys
`UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`), link-preview cards (Open Graph fetched once server-side, not stored), Behance/Pinterest
search buttons, AI mood images (labelled, via the existing image provider, credits). Pinterest OAuth boards behind
`PINTEREST_APP_ID` and a flag. Moodboards with items storing URL + preview + attribution only. "Suggest from this": vision model →
transferable elements in Knitwright vocabulary → up to 3 design-diff patches, each validated through X4 before it is shown and
rendered by Knitwright's renderer; things the base cannot do said plainly. Test: no inspiration image can reach a panel layer or
print file. Refresh within 3 s.

## Z2. Product intelligence v2: Ask and best practice (F-S5 v2)
**Owns** `lib/rulebook/ask/**`, `components/rulebook/ask/**`, migration `20261120020000_rulebook_search.sql` (Postgres full-text, and
pgvector only if available in Supabase local). Retrieval over `rulebook_entries` scoped to the design, LLM phrases an answer citing
rule ids, structured output; no covering entry → "not covered" + `logGap`. Best-practice card on part selection. A 50-question test
set (fixtures with stubbed model) where every answer cites only retrieved ids; a grader rejects any sentence without a citation.
Tech-pack field drafting (overview sentences from the construction table) with provenance `from_base`.

## Z3. Benchmarks (F-S2)
**Owns** `lib/benchmarks/**`, `components/benchmarks/**`, `app/(app)/studio/benchmarks/**`, migration
`20261120030000_benchmarks.sql`. URL fetch once, logged out, robots.txt honoured, UA `KnitwrightBenchmark/1.0 (+https://knitwright.com/bot)`,
rate limited per brand, no HTML stored; photo and review-text intake; vision LLM extracts the card into a fixed schema with
observed/inferred/unknown provenance, user confirm/correct; compare view (2–5 cards, feature matrix, complaint themes as short
paraphrases); "Apply to my design" maps functional features onto the base's options/ranges, unsupported listed; design-around check
warns on close silhouette/layout matches; logos, names and prints never carried over.

## Z4. Collection plan and line plan (F-S10)
**Owns** `lib/collections/**`, `components/collections/**`, `app/(app)/studio/collections/**`, migration
`20261120040000_collections.sql`. Collection board (dotted canvas, frames as groups with Styles · Style-colourways · SKUs counters,
style cards with render, name, status, colourway, retail, qty, sizes, class; right totals panel). Line plan table (rows per style
expandable to sizes; unit cost live from X6 tiers incl. freight and duty to destination; wholesale/D2C split, RRP, margin; footer
totals with "Assumes full-price sell-through"). Actions: Order samples for all approved styles (Y7), Create drop (exports a drop
payload for the Store; no storefront here). Totals equal `priceFor` of the same basket to the penny (test).

## Z5. Teamwear configurator (F-T1)
**Owns** `app/(app)/teamwear/**` (new), `components/teamwear/**`, `lib/teamwear/**`. NOKTO-style: full-bleed 3D stage with sport
backdrop, view chip, tool rail (undo/redo, add element, ideas → Z6, play turntable, fullscreen, snapshot PNG), right panel with kit
part pills (Shirt · Shorts · Socks) and accordion rows showing catalogue codes, sticky footer with quantity stepper, tier price and
discount badge from X6, total, Save, Quote (Z6), and "Order through the Knitwright Store" hand-off instead of Add to cart. Kit bundle
templates (shirt + shorts + socks colour; home/away/GK). "Design in Studio" opens the same design in the Y2 editor. Phone: right panel
becomes a bottom sheet. First 3D render < 3 s budget test.

## Z6. Crest-to-kit and quote PDF (F-T2, F-T5)
**Owns** `lib/crest-to-kit/**`, `lib/quotes/**`, `components/crest-to-kit/**`. Crest upload (PNG/JPG/SVG/PDF ≤ 10 MB) or up to 3
colours, club name, sport, home/away/GK/all, feel classic/modern/bold/plain → vectorise check, palette (shared `lib/colour/palette.ts`,
snapped to sublimation gamut and nearest Pantone), rules engine palette × template family × feel → 6–9 kits, each validated (X4) before
shown, LLM only ranks and writes one line (stubbed). Crest placed unaltered (byte test). 100-crest fixture set: ≥ 95% primary within
ΔE00 < 5 (use generated fixtures; no third-party crests committed). Quote PDF: number, tier prices counted across the basket,
inclusions, delivery estimate from cut-off, VAT treatment from `country_rules`, 30-day validity, link back; generated < 5 s; numbers equal
`priceFor`.

## Z7. Committee link v2, roster sign-up (F-T3, F-T4)
**Owns** `lib/share/committee/**`, `app/s/[token]/**` (extend), `lib/clubs/signup/**`, `app/join/[token]/**` (new), migration
`20261120050000_committee_signup.sql`. Committee: read-only 3D of up to 3 versions, pin comments on a panel point, A/B/C vote, Approve
with name (recorded with timestamp and version), kit manager locks the approved version (→ status approved). 30-day expiry, revocable,
name required, email optional, phone without login (e2e on a phone viewport). Roster: paste list, CSV (existing import), or a player
sign-up link (name on shirt, number, size with size guide); duplicates flagged; profanity via X8; name length per zone; numbers 0–99
configurable per sport; collected vs missing grid; chase by WhatsApp link (wa.me with prefilled text, no API needed) or email via the
provider interface; saved sizes pre-fill next season.

## Z8. Compliance and pre-export unification (F-G2, F-G3)
**Owns** `lib/compliance/**`, `lib/techpack/labels.ts` (extend). Labels per destination from `country_rules.label_rules` (fibre
content order and language, ISO 3758 care symbols, "Made in Pakistan", size, importer); PFAS-free only; OEKO-TEX shown where the fabric
has it; US and kids' sizes blocked until CPSIA testing exists. One F-G2 checklist used by tech pack Review, KPP (X5) and ordering, with
rule ids. Class B human-review gate (X8) enforced before a run is handed off.

## Z9. Remaining base article data (onboarding wave 2 and 3)
**Owns** `lib/catalogue/seed/**`, `lib/parametric/articles/**`. For SHO-TR-01, JSY-LS-01, CRK-SS-01, TEE-TR-01, HOD-ST-01, CMP-LS-01,
FSH-MM-01: an `article.json` draft per `docs/spec/articles/ONBOARDING.md` step 1 (written under `docs/spec/articles/<CODE>/`), the
POM table only from published sources cited per row or left empty, and a parametric script where the POMs exist. Every value labelled
"Knitwright draft, not reviewed by a factory". No article goes `live`. Rulebook entries drafted for each in `draft` status with sources.

---

# Wave 4: Launch content, Kittl-style (starts after wave 3 merges)

Decision records 0091 to 0098. Spec: Launch section of `02-features.md`, `07-template-library.md`,
`research/kittl-fabra/video-ui-notes.md` Videos 3–5. The garment is always locked: every image starts from the deterministic render or
the golden-sample photo, and `lib/media-check` rejects drift. Paid generation goes through the files-service contract (X5) when the
capability is model-based (garment-locked renders, transfer, logo composite), and otherwise through the existing `lib/media/lifestyle`
adapters; both are stubbed in tests.

## L1. Launch shell and boards
**Owns** `lib/launch/**`, `components/launch/**`, `app/(app)/launch/**`, migration `20261201010000_launch_projects.sql`
(`launch_projects`, `boards` kind design|artboard|mockup|ai_image|ai_video|marketing|info_card with position, size, settings, input
version, output file, status, last cost; `board_edges` with input index). Kittl editor chrome: icon rail (Templates, Text, Elements,
AI Image, Mockups, Photos, Pattern fills, Likes, Uploads, Brand, AI assistant, Layers), right inspector (project colours, tools; artboard
size with px/in/mm and presets), bottom prompt pill and tool dock, undo/redo, zoom, credit balance, main menu with units incl. mm and
version history, contextual task bars, Brand tabs (Y6) in pickers.

## L2. Mockup studio, deterministic and live-linked (F-L1 free part)
**Owns** `lib/mockups/**`, `components/mockups/**`. Free mockups from 3D: renders front/back/¾/side, flat lay, hanger, folded stack,
ghost mannequin, 360° turntable; e-commerce white 1:1 and 4:5, studio colour backdrop, size-chart and colour-chart cards. Mockup board
linked to a design version: changing the design updates the board; colourway/roster switcher (Home/Away/GK, "SMITH 7"); placement fixed
by the scene's garment slot; Convert to image. Mockup library panel with collections, search, filters; the 40 scenes of `07` seeded as
`templates` rows of kind mockup_scene (deterministic ones work now; AI ones marked for L3). Render < 5 s.

## L3. AI scenes and shoots with the garment locked (F-L1 AI part)
**Owns** `lib/shoots/**`, `components/shoots/**`, migration `20261201020000_shoots.sql` (`shoot_concepts`, `shoot_poses`,
`model_presets` with licence ref, `shoot_jobs`). Shoot ideas library (12 concepts from `07`), custom shoot panel (garment locked + up to
2 more products, model preset or consented upload, background, pose and camera presets, style, aspect, count 1–4, credit cost on the
button). Results as AI Image boards with placeholder timer and Regenerate. Checker (`lib/media-check`) on every result: auto-regenerate
once, then "Couldn't keep your garment accurate, try another pose"; failed generations refund credits; "AI-generated model" labels; image
modal edits limited to the scene. Moderation via X8 `screenGeneration`.

## L4. Marketing studio (F-L2)
**Owns** `lib/marketing/**`, `components/marketing/**`. Marketing templates (the 50 of `07` as `templates` rows of kind marketing) as
artboards with slots; Replace keeps size and colours; text uses brand styles; Write for me (LLM in the brand's voice tags, metered,
stubbed). Campaign workflow form (7 steps of the spec) generating layouts around pixel-locked mockups. Export panel: quick PNG 1x/2x/3x;
full export with targets, W/H in px/in/mm, DPI 72/300, live print size, PNG/JPEG/SVG/PDF, RGB or CMYK (ICC via an MIT/BSD library or
server-side; say which), remove background, zip for multiple; free plan watermark (existing watermark code).

## L5. Video studio (F-L3)
**Owns** `lib/media/video/**` (extend), `components/video/**`. Deterministic videos from 3D: turntable 6 s, flip 4 s, kit reveal 8 s,
home/away/GK carousel 9 s, MP4 at 9:16, 1:1, 16:9, 1080p (server-side with ffmpeg if available in the deploy target, otherwise the
existing browser recorder; decide and record why). AI video board: first/end frame, sportswear prompt presets (8 from the spec), model
picker from an admin-configured list with credits per second and commercial-licence flag, aspect, 3–15 s, audio; checker samples frames;
"AI-generated" label; refunds on failure. Social frames: the 12 video templates of `07` with text burned in.

## L6. Flows (F-L4)
**Owns** `lib/flows/**`, `components/flows/**`, migration `20261201030000_flow_runs.sql`. Board canvas with connectors from the right-
edge dot, Add… menu, fan-out and fan-in; each board keeps its own settings; Regenerate and Run all downstream (topological, cost
estimate first, per-board status, refunds on failure); Flatten/Upscale/Reframe; the 6 flow templates of `07` with thumbnail, tutorial
card, yellow section labels and grey instruction notes; run summary; Export all as a zip with folders per format; "Publish to store"
produces a listing payload for the Store (O2) instead of publishing. Acceptance: Club kit launch pack yields 14 assets with stubs; swap
the design and Run all regenerates without re-entering prompts.

## L7. Brand import from URL (F-S9 Phase 3)
**Owns** `lib/brand-studio/import/**`. Server fetch of the user's own website or Instagram URL (same fetch rules as Z3), favicon and
logos, palette, nearest licensed fonts, product photos as graphics (stored as the user's own uploads only with a rights tick), written
visual style from 5+ reference images (vision LLM, stubbed), completion %. About one minute budget.

## L8. Template library to the launch counts (07)
**Owns** `lib/templates/seed/**`, `lib/templates/kinds/**`. Template `kind` column (design, kit_bundle, mockup_scene, marketing, video,
flow, techpack) if L2–L6 have not added it; design templates to 60 on spec article codes (football, cricket, training, esports, running/
gym, combat), kit bundles 15, tech pack templates 8 (one per base); tags sport, style, era, mood, colour family. Every design template
passes X4 validation in a test.

---

# Wave 5: ops completion, Store contract, Australia, review (starts after wave 4 merges)

Decision records 0099 onward.

- **O1. Ops completion (F-O1, F-O3, F-O4, F-O6).** Class A/B batches cut by a scheduled job at the cut-off setting (Supabase cron or a
  Vercel cron route; say which); AQL level II sample-size table (0 / 2.5 / 4.0), typed ΔE readings, third-party inspection booking for
  runs > 300; commercial invoice with HS codes and origin (DCTS) PDF; courier provider interface + manual; customer status emails through
  an email provider interface (Resend adapter behind a key); per-factory scorecard (on-time, defects, ΔE pass rate, remakes, golden
  samples per article) and "active only with an approved golden sample".
- **O2. Store contract v2.** Read endpoints and a documented payload the separate Store consumes: published products with media, sizes,
  tier prices in GBP/AUD, delivery dates, personalisation rules, size chart; drops from collection plans (Z4) and Flow outputs (L6); team
  store configuration from a club design. Signed service token. No payment code.
- **O3. Australia and Translate.** AUD tiers, GST trigger as data, AU country rules and labels, AFL/netball/cricket templates; tech pack
  PDF in English + Urdu (font licensed for Urdu, RTL layout in the PDF renderer, translation strings reviewed-by field).
- **R1–R4. Review and hardening**, as v4 W5: security (`docs/reviews/security-v5.md`), code (`code-v5.md`), journeys and coverage
  (`coverage-v5.md`: founder from base to golden sample to run hand-off; club from crest-to-kit to committee approval to roster to
  hand-off; ops from batch to job packet to QC to shipment), documentation (README, architecture map, decision index, owner guide).

---

## Migration timestamps (assigned, do not change)

| File | Workstream |
|---|---|
| `20261101010000_base_articles.sql` | X1 |
| `20261101020000_rulebook.sql` | X2 |
| `20261101030000_design_validation_v2.sql` | X4 |
| `20261101040000_package_exports.sql` | X5 (only if needed) |
| `20261101050000_factories.sql` | X6 |
| `20261101060000_job_packets.sql` | X7 |
| `20261101070000_moderation.sql` | X8 |
| `20261110010000_brand_studio.sql` | Y6 |
| `20261110020000_golden_samples.sql` | Y7 |
| `20261110030000_share_invites.sql` | Y8 (only if needed) |
| `20261120010000_inspiration.sql` … `20261120050000_committee_signup.sql` | Z1–Z7 as listed |
| `20261201010000_launch_projects.sql` … `20261201030000_flow_runs.sql` | L1, L3, L6 |

A workstream that needs a migration not listed uses its wave's date with the next free hour and says so in the PR.
