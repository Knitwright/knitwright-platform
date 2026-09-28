# Blueprint v3.1: Knitwright, MVP first

Objective: a public platform where a sports brand describes a garment in text or uploads
a sketch, and receives photoreal images and a complete tech pack. Sewing patterns, brand
pattern import, and marker and costing are added afterwards as layers.

Status: APPROVED by the owner on 2026-09-27. Execution started the same day.
Date: 2026-09-27. Supersedes `plans/sportswear-design-platform.md` (v2) for scope and
order. Research: `plans/research-2026-09-27.md`.
Review: v3 was reviewed adversarially (5 critical, 7 high). v3.1 fixes them. v3.1 itself
has not been re-reviewed.

## How to use this plan

One person builds this with Claude Code, so steps run one after another in number order.
Each step is one branch and one pull request. Read "Shared context", then the step.
Every library named here was chosen on 2026-09-27 and has not been tried in this
project. Before writing code in a step, check the libraries it names against their
current documentation.

## Owner decisions (question session, 2026-09-27)

| Topic | Decision |
|---|---|
| Audience | Public sign-up |
| Deadline | None fixed. Order by worth against effort. |
| Goal | A fashionINSTA-class product for sports brands, usable for other apparel later |
| Build order | Tech pack and photoreal images first. Patterns after, as the hardest part. |
| Existing code | Fresh build. `kitwright/` and `Sportswear/` are reference only. |
| Sportswear repository | Stays separate. It is the team's model code, a work in progress. It will later provide patterns, renders and logo placement, and marker and costing. The platform must work without it. |
| Garment families | Tops; bottoms; outerwear; close-fitting pieces |
| Launch gate | All four families in design and tech pack before public launch |
| Input | Text, simple controls, and sketch or photo upload, all in the MVP |
| "3D" | Both. A rotatable 3D garment that moves with the spec, in the MVP if the step 9A trial succeeds, otherwise right after launch. Photoreal images on demand. A draped garment from real patterns is a later layer. |
| Tech pack sections | Cover, flats, graded measurement table, bill of materials, construction and stitch details, colourways and artwork placement |
| Tech pack formats | PDF, Excel, and editable SVG drawings |
| Measurements | Default charts labelled as suggested, editable. AI may suggest per garment. A brand may supply its own chart. |
| Wearers | Men, women and youth, each with its own chart and full size run |
| Pattern engine | The platform drafts every garment family itself. Geometry from formulas. AI interprets intent. |
| Pattern validation | A studio technician in Sialkot is planned, not yet in place. Until then nothing is shown as checked, and patterns ship marked as unreviewed drafts. |
| Release policy | Public beta. A draft label is lifted per garment family once validated. |
| Hosting | Managed services. The landing page is on Vercel Hobby today. |
| Billing | Free beta with usage caps per user |
| AI spend | No budget cap set by the owner. Minimise cost without lowering quality. Safety limits against abuse stay. |
| Photoreal images | On request, with a small monthly allowance per user. The 3D preview and flats are always available. |
| Design | Follow knitwright.com. See `plans/design-reference.md`. |
| AI providers | Reputable providers whose terms exclude training on customer data |
| Team | Owner with Claude Code |
| Name | Knitwright |
| Repository host | GitHub account `SameedIlyas` |

## Owner actions

These cannot be done by the assistant. Each blocks the step named.

| ID | Action | Blocks |
|---|---|---|
| A1 | Log the GitHub CLI in as `SameedIlyas` | 1 |
| A2 | Create a Supabase account (free tier). Move the Vercel account to Pro before public launch: the Hobby plan is limited to non-commercial use. | 1 for Supabase, 26 for Vercel Pro |
| A3 | Create AI provider keys. Set a monthly limit in each provider's console as protection against a runaway bill, at a level the owner is comfortable with. | 10 |
| A4 | Create an email-sending account. The database provider's built-in mail allows about 2 messages an hour and is not for production. | 2 |
| A5 | Supply or approve, per garment type, a base-size measurement set and grade increments for men, women and youth. Without this the assistant would have to invent numbers. | 5, 16, 19, 22 |
| A6 | Approve the drawing of each garment type from snapshot images | 7, 17, 20, 23 |
| A10 | Judge the 3D trial result: good enough for the MVP, or defer | 9A |
| A7 | Approve the expected outcomes in each golden set | 11, 13, 18, 21, 24 |
| A8 | Draw or photograph test images: 40 for tops, 15 for each other family. No third-party brand images. | 13, 18, 21, 24 |
| A9 | Arrange legal review of terms, privacy notice and data-processing page | 26 |

## Shared context (applies to every step)

### Acceptance criteria for the MVP

| ID | Criterion |
|---|---|
| M1 | A user with no technical knowledge goes from one sentence, or one uploaded sketch, to a downloadable tech pack (PDF, Excel, SVG) and photoreal images in under 5 minutes. |
| M2 | Every text instruction and every image reading becomes a validated spec change, a clarifying question, or an explained rejection. Model output is parsed, never trusted. |
| M3 | Changing a measurement updates the flat, the table and every export together. |
| M4 | Every value shows where it came from. Suggested and AI-proposed values are never shown as verified. |
| M5 | One brand can never read another brand's designs, files or images. |
| M6 | AI spend per user, per brand and in total is capped, and the cap holds under parallel requests. |
| M7 | 80% or higher test coverage, with measurement and tech pack maths tested first. |

### Constraints

- No branding, text or assets copied from specform or fashionINSTA.
- No MCP connector called at runtime.
- No `.env` file committed. No key in source.
- The product never says "production-ready" about a pattern without a recorded
  validation.

### Stack

| Need | Choice | Note |
|---|---|---|
| Web app | Next.js 16, React 19, TypeScript, Tailwind v4, Zod 4 | |
| Hosting | Vercel. Free during the build, Pro ($20 a month) from public launch | Function time limit is about 300 s. Code stays portable: no host-only storage or queue products. |
| Database, sign-in, files | Supabase, free tier to start | 500 MB database, 1 GB files, 50,000 monthly users. Projects pause after a week with no activity. Pro is $25 a month when outgrown. |
| Text and vision model | Chosen by measurement in step 12, behind `TextModelProvider` | The cheapest model that meets the quality target on the golden set wins. Paid API tiers only: free tiers of some providers train on the data. |
| Image generation | Chosen by comparison in step 14, behind `ImageProvider` | Must accept a reference image and must not train on customer data |
| Email | Resend, free tier | 100 messages a day. Sign-in with Google reduces how many are sent. |
| Bot check | Cloudflare Turnstile | Free, no volume limit |
| Error monitoring | Sentry, free tier | 5,000 errors a month |
| PDF | `@react-pdf/renderer` 4.9 or later, proven by the spike in step 7 | It draws only its own primitives. It cannot take an SVG string. Fallback: `pdfkit`. |
| Excel | `exceljs` 4.4 | Last release October 2023. Works, but expect no fixes. |
| 3D preview | `three`, `@react-three/fiber`, `earcut` | Runs in the browser, so it has no running cost. Loaded only when the 3D view is opened. |
| Tests | vitest, Playwright | CI runs local Supabase in Docker from step 3 |

### Cost plan

Prices were read from vendor pages on 2026-09-27 through a summarising tool. Re-check
each before relying on it.

Fixed monthly cost:

| Phase | Cost | Made up of |
|---|---|---|
| During the build | $0 | Free tiers throughout |
| From public launch | $20 | Vercel Pro. Everything else stays on free tiers. |
| When the database or files outgrow the free tier | $45 | Adds Supabase Pro at $25 |

AI cost per design session (six text instructions, one sketch reading):

| Configuration | Text and sketch | Two photoreal images | Session total |
|---|---|---|---|
| Cheapest models | about $0.003 | about $0.022 | about $0.025 |
| Mid-tier models | about $0.04 | about $0.13 | about $0.17 |

Rules that keep cost down without lowering quality:

1. **Controls and the 3D preview cost nothing.** They run without any AI call.
2. **Rules before models.** Simple requests that match a known pattern are handled by
   deterministic rules. Only the rest reach a model.
3. **Cheapest model that passes.** The golden set measures quality. Candidates are
   tried from cheapest to dearest and the first to meet the target is used.
4. **Escalate only when needed.** A request the cheap model cannot resolve is retried
   once on a stronger model before a question is asked.
5. **Images on request.** They are 80 to 90% of AI cost.
6. **Exports are built when downloaded, not stored.** This keeps file storage inside
   the free tier.
7. **Uploaded and generated images are resized and compressed before storage.**
8. **Prompt caching where the provider offers it** and the prompt is long enough to
   qualify.
9. **Per-user allowances and a safety ceiling.** The ceiling is set high. It exists to
   stop abuse, not to limit normal use, and the owner can raise it at any time.

### Next.js 16 rules

Read `node_modules/next/dist/docs/` before any web work.
- `params`, `searchParams`, `cookies()`, `headers()` are asynchronous and must be awaited.
- `middleware.ts` is now `proxy.ts`, for optimistic checks only. Authorisation is
  checked inside every route handler and server action.
- Route handlers are uncached by default. `next lint` is removed; run `eslint` directly.
- Streaming route handlers should send `X-Accel-Buffering: no`.
- Work that outlives the response uses `after()` and a status row the browser polls.

### Layout

```
knitwright-platform/
  apps/web/
    app/  components/
    lib/server/        defineRoute, defineAction, session, rate limit
    lib/garment/       registry, options, measurements, size charts
    lib/flat/          geometry model and its renderers
    lib/intent/        text and image to validated actions
    lib/techpack/      document model and exports
    lib/usage/         metering and caps
    lib/providers/     image provider interface (pattern and marker added in layers)
  supabase/migrations/
  plans/  docs/
  kitwright/  Sportswear/     reference folders, ignored by git, never modified
```

### Route and action wrappers

Every route handler is created with `defineRoute({ schema, auth, rateLimit, handler })`
and every server action with `defineAction(...)`. The wrapper parses input with Zod,
checks the session and active brand, applies the rate limit, then calls the handler.
Inline `"use server"` is banned by a lint rule. A test using the TypeScript compiler
API asserts that every exported route handler and action is wrapper output. Public
routes are listed in one allow-list file.

### Provenance values

Every measurement and tech pack field carries one of: `brand-supplied`, `user-edited`,
`suggested-chart`, `ai-suggested`, `read-from-image`, `derived`. A separate `reviewed`
record exists only when a named person signs off.

### Units

Measurements are stored as integer tenths of a millimetre. Shown in centimetres; an
inch toggle arrives in step 15.

### Invariants, checked at the end of every step

| ID | Invariant | Check |
|---|---|---|
| I1 | No secret committed | `git ls-files \| grep -E '(^\|/)\.env($\|\.)' \| grep -v '\.env\.example$'` prints nothing. Secret scan passes. |
| I2 | No MCP call at runtime | `grep -rIil "mcp" apps/web/app apps/web/lib apps/web/components` prints nothing |
| I3 | Every route and action is wrapper output | The compiler API test (from step 2) |
| I4 | Tests pass. Coverage 80% overall, 90% on `lib/garment` and `lib/techpack` | vitest thresholds |
| I5 | No value rendered or exported without provenance | Unit tests on table, PDF, Excel |
| I6 | No competitor branding, text or assets | Code review |

### Standard gate

`/verify pre-pr` runs on the developer's machine. CI runs:

```
pnpm install --frozen-lockfile
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test:cov
pnpm --filter web build
pnpm --filter web e2e
```

CI supplies placeholder environment values for `build` and starts local Supabase.

## Roadmap

| Stage | Steps | Result |
|---|---|---|
| Foundation | 1 to 3 | Deployed app with sign-in and brand isolation |
| Milestone 1A: tops without AI | 4 to 9A | **First usable product.** Pick a garment, adjust it with controls, see it in 3D, download a tech pack. |
| Milestone 1B: AI for tops | 10 to 15 | Text and sketch input, photoreal images, guided flow |
| Milestone 2: other families | 16 to 24 | Bottoms, outerwear, close-fitting |
| Launch | 25, 26 | Public beta |
| Layers A to F | after launch | Patterns; brand pattern import; marker and costing; Sportswear model code; payments and API; draped 3D from patterns |

Why this order. The tech pack is the part that is useful by itself and needs no AI, so
it comes first and gives a working product at step 9. AI input and images then attach
to something that already works. Accounts and isolation come before any of it because
retrofitting them to a public product is slower and riskier than starting with them.

---

# Foundation

## Step 1: Repository, app skeleton, CI, deployment

**Branch:** `chore/foundation`. **Blocked by:** A1, A2, A3.
**Rollback:** delete the repository and hosted projects.

**Context brief.** `C:\Users\Sameed\Documents\Devotrex\knitwright-platform` holds two
reference folders, each its own git repository, and `plans/`. The root is not a
repository. Toolchain on this machine: Node 24.9, pnpm 10.20, Docker 27.5.

**Tasks.**
1. `git init` at the root. `.gitignore` covers `/kitwright/`, `/Sportswear/`, `.env*`
   except `.env.example`, `node_modules`, `.next`, `coverage`.
2. New Next.js 16 app in `apps/web`, package name `web`, with vitest coverage
   thresholds, Playwright and eslint. Scripts: `typecheck`, `lint`, `test`,
   `test:cov`, `build`, `e2e`.
3. Product name in one configuration value.
4. Environment reader that validates required variables at start-up with Zod.
5. CI running the standard gate and a secret scan.
6. Private repository `SameedIlyas/knitwright-platform`. Preview and production
   deployments. Confirm the function time limit and record it.
7. `docs/decisions/` with a template and the stack choices.

**Acceptance criteria.**
- A fresh clone passes the standard gate.
- `gh repo view --json owner` shows `SameedIlyas`.
- Starting without a required variable fails with a clear message.
- I1, I2 hold.

## Step 2: Accounts and request wrappers

**Branch:** `feat/accounts`. **Blocked by:** A4.
**Rollback:** run down migrations, revert.

**Context brief.** A deployed empty app exists. The product is open to the public and
will call paid AI services. The reference app's paid routes accepted anonymous requests.

**Tasks (tests first).**
1. `defineRoute` and `defineAction` as described in "Route and action wrappers", the
   lint rule, the compiler API test and the public allow list.
2. Sign-up with email verification through the owner's email-sending account, and a
   bot check. Sign-in with Google as well, which sends no email. Sign-out, password
   reset.
3. A sign-up switch in configuration, **closed by default**. The owner's address is
   allowed while closed.
4. Rate limit per user and per address, stored in Postgres and enforced by one atomic
   function.

**Acceptance criteria.**
- A route without the wrapper fails the compiler API test.
- A request with no session is refused by every route not on the allow list.
- With the switch closed, a new address cannot register.
- The rate limit holds when 50 requests arrive at once.
- I3 holds.

## Step 3: Brands, isolation, file storage

**Branch:** `feat/brands`. **Rollback:** run down migrations, revert.

**Context brief.** Accounts and wrappers exist. Designs are confidential per brand. A
user may belong to several brands, so every request needs one active brand.

**Tasks (tests first).**
1. Tables `brands` and `memberships` with a role column. The MVP uses only the owner
   role; invitations and other roles are a later layer. A cap of 3 brands per user.
2. Active brand stored in the session. `verifySession()` returns user and active brand
   after confirming membership.
3. Row level security on every table. A `SECURITY DEFINER` function `is_member(brand)`
   is used by policies, since a policy on `memberships` that queries `memberships`
   recurses. **`memberships` has no client write policy.** Changes go through
   functions that check the caller's role.
4. Private storage buckets for uploads, exports and images, with the path convention
   `brand_id/...` and policies that match it.
5. One upload helper: type and size limits, content sniffing, metadata stripped.
   Raster images only. SVG uploads are refused.
6. One download route: checks membership, then issues a link that lives 60 seconds.
7. Isolation suite on local Supabase, run in CI: for every table and bucket, a user of
   brand A cannot read, change or delete anything of brand B, and cannot change their
   own role.

**Acceptance criteria.**
- The isolation suite passes.
- Brand B cannot obtain a download link for brand A's file.
- A fourth brand for one user is refused.
- A security review reports no critical or high finding.
- M5 holds.

---

# Milestone 1A: tops without AI

## Step 4: Garment contract and registry, tops

**Branch:** `feat/garment-registry`. **Rollback:** revert.

**Context brief.** An authenticated app with brands exists. Nothing about garments
does. The reference file `kitwright/lib/garment/styles.ts` shows a registry in which
each style declares its points of measure; read it for the idea only.

**Tasks (tests first).**
1. Zod schemas: `GarmentSpec`, `GarmentType`, `Option`, `Measurement` with provenance,
   `FabricSpec` (composition, construction, weight, finish, stretch), `Colourway`
   (colour codes as free text; colour libraries are licensed), `Artwork` (position,
   size, technique: sublimation, transfer, screen print, embroidery), `SpecAction`.
2. Registry: families, types, options per type, points of measure per type, which
   wearer charts apply to each type, impossible combinations with a reason each.
3. Tops entries: crew tee, V-neck tee, long sleeve tee, polo, team jersey with set-in
   or raglan sleeve.
4. Points of measure for tops: chest width, body length, shoulder width, sleeve
   length, armhole, upper arm, sleeve opening, hem width, neck width, front and back
   neck drop, collar height, placket length and width. Each has a plain-language
   "how to measure" sentence.

**Acceptance criteria.**
- Every tops type validates. Every impossible combination is rejected with its reason.
- Coverage on `lib/garment` at least 90%.

## Step 5: Size charts and measurement resolution

**Branch:** `feat/size-charts`. **Blocked by:** A5.
**Rollback:** run down migrations, revert.

**Context brief.** The registry lists points of measure. There are no numbers. These
are garment measurements, as a factory would check on a finished garment, not body
measurements. The research found no authoritative open source for them. The owner
supplies or approves the base-size set and grade increments (A5).

**Tasks (tests first).**
1. `SizeChart` and `SizeRun` schemas. Charts for men, women and youth. The base size
   is marked.
2. Load the owner's numbers as the default charts. Every value is `suggested-chart`
   and the chart's source note says who produced it and when.
3. Resolution order: chart value, then fit adjustment, then user edit. Dependants
   recompute. Grading across the run. Tolerance per point of measure.
4. Editing any value in the interface turns it into `brand-supplied` or `user-edited`.
5. Property-based tests: grading is monotonic, no negative values, every type and
   size resolves completely.

**Acceptance criteria.**
- Every tops type resolves for every size in every chart that applies to it.
- No number in the default charts lacks a source note naming a person.
- M4, I5 hold.

**Deferred.** Fabric-stretch ease adjustments belong to the pattern layer.

## Step 6: Projects, versions, editor

**Branch:** `feat/editor`. **Rollback:** run down migrations, revert.

**Context brief.** Garments and measurements exist as libraries with no screen. This
step makes the first screen a user can work in.

**Tasks (tests first).**
1. Tables `projects` and `spec_versions` (append-only), with `brand_id`, style number
   and season. Every accepted change is a new version. Restore creates a new version.
2. Pages: list of designs, new design, open design.
3. Controls generated from the registry, so a new garment type needs no new screen.
4. Measurement table, editable, showing provenance in plain words.
5. Undo through versions.

**Acceptance criteria.**
- An e2e test signs in, creates a crew tee, changes two options and one measurement,
  reloads, and finds them saved.
- The isolation suite covers the two new tables.

## Step 7: Flats for tops

**Branch:** `feat/flats-tops`. **Blocked by:** A6. **Rollback:** revert.

**Context brief.** The editor shows options and measurements but no drawing. Points of
measure do not fix the shape of an armhole, neckline or collar, so every garment type
needs a designed template for front and back. The reference file
`kitwright/lib/garment/geometry.ts` took 574 lines for five similar tees and used
different horizontal and vertical scales, so it was out of proportion. The PDF library
draws only its own primitives (paths, groups, text, basic shapes, dashes, transforms)
and cannot take an SVG string.

**Tasks (tests first).**
1. **Spike first, on a deployed preview.** Draw one flat with dashed stitching, callout
   text in a registered font, and a raster logo, as PDF primitives. If it fails, use
   `pdfkit`. Record in `docs/decisions/`.
2. `lib/flat` returns a geometry model: paths, groups, text and image placements,
   limited to what both renderers support.
3. Two renderers from that model: SVG string with named layers, and PDF primitives.
4. One scale on both axes. Templates for each tops type, front and back.
5. Options drawn: neckline, collar, placket, sleeve type and length, body length, hem,
   side panels, cuffs. Colour per panel.
6. Logo and artwork upload through the step 3 helper, placed with position and size.
   User text is escaped.
7. Tests: every path closed, no self-intersection, symmetry where expected, pairwise
   sampling of option combinations, and snapshot images per type approved by the owner.

**Acceptance criteria.**
- The spike decision is recorded with evidence.
- Geometric assertions pass for every sampled combination.
- The owner has approved a snapshot for every tops type.
- M3 holds for the flat.

**Effort note.** This is the largest step in milestone 1A.

## Step 8: Tech pack document

**Branch:** `feat/techpack-model`. **Rollback:** revert.

**Context brief.** A design has a spec, measurements and flats. The tech pack is the
product's main output. A factory expects more than the six sections the owner listed,
so the document carries the fields below, empty where the user has not filled them.

**Tasks (tests first).**
1. `lib/techpack`: a pure function from a spec version to a `TechPack` document.
2. Cover: style number, season, brand, version, date, base size, revision history.
3. Flats with callouts.
4. Measurement table for the size run, base size marked, tolerance and provenance per
   value, plus a how-to-measure page.
5. Component list: fabric per panel with composition and weight, rib, thread, labels,
   trims. Quantities are entered by the user or shown as "to be confirmed". None is
   invented.
6. Construction: seam class and stitch class per seam with stitch density, from rules
   in the registry.
7. Colourways per panel. Artwork placement with position, size and technique.
8. Labels and packing: care, composition, origin, fold and bag. User-entered.
9. A page listing every suggested and AI-proposed value.
10. Three-way test: change one measurement, assert flat, table and document change.

**Acceptance criteria.**
- The three-way test passes.
- No field is present without provenance.
- Coverage on `lib/techpack` at least 90%.
- M3, M4, I5 hold.

## Step 9: Exports

**Branch:** `feat/exports`. **Rollback:** revert.

**Context brief.** A `TechPack` document and a PDF renderer for flats exist. Files are
served only through the step 3 download route.

**Tasks (tests first).**
1. PDF at A4: every section, vector flats, page numbers, version and date.
2. Excel: measurement table, component list, colourways, provenance beside each
   value. Every cell written as a typed value, never as a formula.
3. SVG per view with named layers.
4. Exports are built when requested and streamed to the user. They are not stored.
   Each download is recorded with its spec version.

**Acceptance criteria.**
- A text extraction test finds every section heading in the PDF.
- The Excel file, read back by a parser, equals the document.
- A cell whose text starts with `=` is stored as text.
- One design exports within 30 seconds.
- I5, M5 hold.

## Step 9A: 3D garment preview

**Branch:** `feat/garment-3d`. **Blocked by:** A10 after task 1.
**Rollback:** revert. The flat remains the preview.

**Context brief.** The landing page promises that the flat, the table and a 3D garment
move together. Flats come from a geometry model (step 7) with a front and a back
outline per garment type and an SVG renderer that carries colours and artwork. No 3D
assets exist, and the reference app withdrew its 3D meshes because their licences were
unclear. A garment draped from real pattern pieces needs patterns, which come after
launch. This step builds the 3D form from the flat itself: the outline is triangulated,
given volume, and textured with the rendered flat, so every change to the spec changes
the 3D form with no extra work. It runs in the browser and costs nothing to run.

**Tasks (tests first).**
1. **Trial first, two days at most.** For the crew tee: triangulate the front and back
   outlines, raise each point by a smooth function of its distance from the edge, join
   front and back at the outline, render the flat to a texture, show it rotating. The
   owner judges the result (A10).
2. Decision rule. If the owner accepts it, continue with the tasks below. If not, stop,
   record the result in `docs/decisions/`, and move this step to layer F.
3. `lib/garment3d`: a pure function from the geometry model to vertices, faces and
   texture coordinates. No drawing code is duplicated.
4. Sleeves as separate volumes joined at the armhole. Collars and plackets as raised
   detail.
5. Viewer: rotate, zoom, front and back buttons, a reduced-motion setting. Loaded only
   when opened.
6. Labelled in plain words as a preview of shape and colour, not of fit or drape.
7. Tests: mesh is closed, has no inverted faces, and its width and length match the
   measurements in the same ratio as the flat.

**Acceptance criteria.**
- The decision is recorded with the owner's verdict and a screenshot.
- If accepted: changing a measurement or colour changes the 3D form within one second,
  proven in an e2e test.
- The rest of the app loads no 3D code until the viewer is opened, shown by the bundle
  report.
- M3 holds for the 3D view.

**Limits.** This is a stylised form. It does not show how fabric hangs on a body.

**Checkpoint.** The product is usable: sign in, pick a top, adjust it, see it in 3D,
download the tech pack. The owner reviews it before AI work begins.

---

# Milestone 1B: AI for tops

## Step 10: Usage metering and caps

**Branch:** `feat/usage`. **Rollback:** run down migrations, revert.

**Context brief.** No paid call exists yet. Public sign-up means new accounts and new
brands are free to create, so a cap per brand alone can be reset by making another.

**Tasks (tests first).**
1. Unit of account: estimated cost in minor currency units per call.
2. Tables `usage_events` and `usage_limits`, with **no client write policy**.
3. One atomic function `reserve(user, brand, cost)`: a single conditional update that
   succeeds only if the user, the brand and the global day total all stay within
   limits. A `refund` function for failed calls.
4. Allowance per user and per brand, with a separate allowance for photoreal images.
   A safety ceiling across all users, set high, with an alert to the owner at half
   and at full. The owner changes it in configuration.
5. `defineRoute` gains a `cost` option that reserves before the handler runs.

**Acceptance criteria.**
- 100 parallel reservations against an allowance of 10 succeed exactly 10 times.
- A member cannot change a limit or delete an event, proven in the isolation suite.
- M6 holds.

## Step 11: Intent core and golden set

**Branch:** `feat/intent-core`. **Blocked by:** A7. **Rollback:** revert.

**Context brief.** The editor changes a design through `SpecAction` values. The
reference folder `kitwright/lib/ai/` shows a working shape: tool calls, a stream
parser, Zod validation, an apply function that rejects impossible combinations. Its
defects: the model never saw the current garment, invalid actions vanished silently,
and it never asked a question.

**Tasks (tests first).**
1. Outcome type with exactly three cases: applied changes, clarifying question,
   explained rejection.
2. Parser from raw model output to an outcome. A property-based test feeds arbitrary
   output, including plain text, broken JSON and unknown actions, and asserts the
   result is always one of the three.
3. Deterministic ambiguity rules. Any change to garment type or construction that was
   not stated outright becomes a question.
4. Change explanations computed from the spec difference.
5. Golden set of at least 150 tops utterances with outcomes approved by the owner,
   scoring options as well as garment type.
6. Replay harness: recorded model responses are replayed in CI.

**Acceptance criteria.**
- The property-based test passes.
- Replayed golden set: never silent on 100%.
- M2 holds for the parser.

## Step 12: Text input

**Branch:** `feat/intent-text`. **Rollback:** revert.

**Context brief.** The intent core turns model output into outcomes. No model is
called yet.

**Tasks (tests first).**
1. `TextModelProvider` interface with one implementation per candidate provider.
2. Model selection: run the golden set on candidates from cheapest to dearest. Use
   the first that meets the target. Record cost per request beside accuracy.
3. Rules first: requests that match a known pattern are resolved without a model.
   One retry on a stronger model before asking a question.
4. Route with `defineRoute`, a cost, a fixed output token limit and an input length
   limit. The current spec is sent with every request. Response is streamed.
5. Chat panel in the editor. Questions shown as choices with a recommended option.
6. Live evaluation recorded in `docs/evals/` with model name, date and cost.

**Acceptance criteria.**
- Live run: correct outcome on at least 90% of the golden set. This is a starting
  target; the owner may change it through the mutation log.
- Text that tries to override instructions produces a rejection.
- M2, M6 hold.

## Step 13: Sketch and photo input

**Branch:** `feat/intent-image`. **Blocked by:** A7, A8. **Rollback:** revert.

**Context brief.** Text input works. Images are uploaded with the step 3 helper. A
vision model's reading of a sketch can be wrong, and its stated confidence is not
reliable, so its reading is a proposal.

**Tasks (tests first).**
1. Vision call through the same tool schema and parser as step 11.
2. Every field read carries `read-from-image`. Garment type and construction are
   always confirmed by the user.
3. Review screen: the image beside the proposed design. Nothing applies until
   confirmed.
4. Text inside an image is treated as content, never as instructions.
5. Golden set of the owner's 40 images, replayed in CI.

**Acceptance criteria.**
- An image of something that is not a garment produces an explained rejection.
- Live run: right garment type on at least 80% of golden images, and option accuracy
  reported beside it. Starting targets.
- M2, M4 hold.

## Step 14: Photoreal images

**Branch:** `feat/images`. **Rollback:** run down migrations, revert.

**Context brief.** Designs have true-to-proportion flats. Generated images can show
details the design does not have. The reference file
`kitwright/app/api/render/route.ts` sends the flat as a reference image to a hosted
model.

**Tasks (tests first).**
1. Compare at least three providers on the same ten designs: quality judged by the
   owner, price per image, and terms. Exclude any whose terms allow training on
   customer data. Record the choice and terms in `docs/data-processing.md`.
2. `lib/providers`: `ImageProvider` interface and one implementation. The prompt is
   built from the spec by a pure function.
3. Table `jobs` with status. The route reserves cost, starts work with `after()`, and
   the browser polls.
4. Images are made only when the user asks, within the image allowance. Front and
   back views. The logo is composited from the uploaded file.
5. Images are labelled as illustrations in the interface and the tech pack.

**Acceptance criteria.**
- With the provider stubbed, a design produces two images and one usage record.
- With the provider failing, cost is refunded and the rest of the product works.
- M5, M6 hold.

## Step 15: Guided flow and milestone review

**Branch:** `feat/guided-flow`. **Rollback:** revert.

**Context brief.** Every part exists for tops. They are not yet one path a non-expert
can follow.

**Tasks.**
1. One path: start from text, sketch or a garment picker; review; adjust; download.
2. Live preview of flat and table together.
3. `lib/copy/vocabulary.ts` mapping technical terms to plain words, with a test.
4. Inch toggle.
5. Accessibility checks. Reduced-motion support.
6. Five timed runs by the owner, recorded in `docs/reviews/`.

**Acceptance criteria.**
- An e2e test goes from one sentence to all downloads with stubbed providers. A second
  does the same from a sketch.
- Each timed run is under 5 minutes, or the slow stage is named.
- M1 holds for tops.

**Decision point.** The owner may launch with tops only. If so, step 26 runs next and
steps 16 to 25 follow it. Launch never skips step 26.

---

# Milestone 2: other families

Each family takes three steps. No family changes the editor, the tech pack flow or the
exports.

Where step 9A was accepted, each flat step also confirms that the family's types
produce a valid 3D form.

| Family | Garment types | Points of measure added | New drawing elements |
|---|---|---|---|
| Bottoms | Shorts, joggers, leggings, track pants | Waist relaxed and stretched, hip, front and back rise, thigh, knee, leg opening, inseam, outseam, waistband height | Waistband, drawcord, gusset, side stripe, pockets, cuffs |
| Outerwear | Pullover hoodie, zip hoodie, track jacket | Hood height and width, zip length, pocket size, cuff and hem rib height, collar height | Hood, zip, kangaroo and side pockets, rib bands |
| Close-fitting | Singlet, vest, sports bra, compression top | Underbust, strap width, armhole depth, back width at narrowest | Racerback, straps, elastic bands, bound edges |

These lists are starting proposals. The owner confirms them with A5.

| Step | Branch | Content | Blocked by |
|---|---|---|---|
| 16 | `feat/bottoms-model` | Registry entries, points of measure, charts | A5 |
| 17 | `feat/bottoms-flats` | Templates front and back, geometric tests, snapshots | A6 |
| 18 | `feat/bottoms-rules` | Construction and component rules, 50 golden utterances, 15 golden images | A7, A8 |
| 19 | `feat/outerwear-model` | as 16 | A5 |
| 20 | `feat/outerwear-flats` | as 17 | A6 |
| 21 | `feat/outerwear-rules` | as 18 | A7, A8 |
| 22 | `feat/closefit-model` | as 16. Sports bras and youth sizes use their own size systems, declared in the registry. | A5 |
| 23 | `feat/closefit-flats` | as 17 | A6 |
| 24 | `feat/closefit-rules` | as 18 | A7, A8 |

**Context brief for each.** Read the tops entries in `lib/garment`, `lib/flat` and
`lib/techpack` as the pattern to follow. Model steps follow steps 4 and 5. Flat steps
follow step 7 without the spike. Rule steps follow steps 8, 11 and 13.

**Acceptance criteria.** Model steps: every type resolves for every size in every
chart that applies. Flat steps: geometric assertions pass and the owner has approved
snapshots. Rule steps: replayed golden sets are never silent, live targets as in steps
12 and 13, and the guided e2e test passes for one type in the family. All invariants
hold.

**Rollback for each.** Revert. The entries disappear from the registry.

---

# Launch

## Step 25: Size chart import

**Branch:** `feat/chart-import`. **Rollback:** revert.

**Context brief.** Brands can edit chart values one by one. A brand with its own chart
wants to load it whole.

**Tasks (tests first).** Spreadsheet upload through the step 3 helper. Column mapping
screen. Values validated against the registry. Imported values are `brand-supplied`.

**Acceptance criteria.** A valid file replaces the chart. A file with a missing point
of measure is refused with the missing name.

## Step 26: Launch hardening

**Branch:** `release/public-beta`. **Blocked by:** A9.
**Rollback:** close the sign-up switch.

**Context brief.** The product works and sign-up is closed. It has not faced the
public.

**Tasks.**
1. Security review of accounts, uploads, routes, storage and prompts. Dependency
   licence report.
2. Rate limits and usage ceilings verified under load.
3. Terms, privacy notice and data-processing page written for this product.
4. Error monitoring. Alert on the spend ceiling.
5. Account deletion and design deletion, including stored files.
6. Evidence table: one row for each of M1 to M7 with the test or record proving it.
7. Open the sign-up switch.

**Acceptance criteria.**
- No critical or high security finding is open.
- The evidence table is complete and the owner has read it.

---

# After launch

Each layer is expanded into full steps, through the mutation log, when the layer
before it ships.

**Layer A: patterns.** Plan v2, steps 5 to 11, is the detailed reference: geometry
kernel spike, blocks with ease from fabric stretch, seam allowance and notches, seam
checks, grading, DXF and PDF export. Built family by family. Adds `PatternProvider`.
Every file is an unreviewed draft until the owner names who validates. Research
findings that still apply: no open library emits AAMA/ASTM garment DXF, the standard is
paid, no open validator exists, and no authoritative open source for knit ease rules
was found.

**Layer R: reviewer sign-off.** A screen for the studio technician to check a spec
and sign it by name and date, which sets the `reviewed` record. Built when that person
is in place. It can come before layer A.

**Layer B: brand pattern import.** Upload DXF, read it, run the same checks, grade,
export.

**Layer C: marker, fabric use, costing.** Adds `MarkerProvider`. Candidate engine:
`spyrrow`, untested.

**Layer D: Sportswear model code.** Added as provider implementations when its owners
expose it over an API. The platform publishes the request and response formats.

**Layer E: payments, team roles and invitations, public API, chat connectors.**

**Layer F: draped 3D from patterns.** Pattern pieces from layer A are sewn and hung on
a body form in the browser. Depends on layer A. A large build, so it starts with its
own trial. Also the home of step 9A if its trial was not accepted.

## Anti-patterns to refuse during execution

- Trusting model text for anything that reaches a file, a measurement or a price.
- Showing a suggested or AI-proposed value as verified.
- A route or action that is not wrapper output.
- A client write policy on usage, limits or memberships.
- Inventing a measurement or a quantity.
- Copying code from the reference folders without reading why it was written.
- Writing "production-ready" about a pattern.
- One pull request that spans two steps.

## Plan mutation protocol

A step may be split, inserted, skipped, reordered or abandoned only by editing this
file in its own commit, with a dated entry below.

| Date | Change | Reason |
|---|---|---|
| 2026-09-27 | v3 created, superseding v2 | Owner's answers: MVP is tech pack and images, fresh build, public sign-up, four families at launch, patterns after |
| 2026-09-27 | Added the cost plan. Hosting free during the build, Vercel Pro from launch. Supabase free tier. Text and image models chosen by measurement, cheapest that passes. Images on request. Exports built on download, not stored. Sign-in with Google. Added layer R for reviewer sign-off. Design follows knitwright.com. | Owner: lowest cost without lowering quality; landing page is on Vercel Hobby; reviewer planned |
| 2026-09-27 | Inserted step 9A (3D garment preview, trial first) and layer F (draped 3D). Photoreal images become on demand. | Owner wants the 3D garment that moves with the spec, in the MVP if possible. Also lowers image spend. |
| 2026-09-27 | v3.1. Reordered so the tech pack without AI ships at step 9. Closed two holes in usage caps. Added owner actions, request wrappers, storage, email, rate limits, active brand, download route. Flats return a geometry model with two renderers, PDF spike moved to step 7. Size charts come from the owner. Families split into three steps each. Tech pack gained fields a factory expects. | Adversarial review: 5 critical, 7 high findings |
