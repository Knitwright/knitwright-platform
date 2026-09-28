# Blueprint: sportswear design platform

Objective: text-and-config driven tech pack and pattern generation platform for
sportswear, built on kitwright and Sportswear.

Status: SUPERSEDED on 2026-09-27 by `plans/knitwright-mvp-blueprint.md` (v3) for scope
and order. Never approved. Kept because its steps 5 to 11 are the detailed reference for
the pattern layer. Do not execute steps from this file.
Date: 2026-09-27. Research input: `plans/research-2026-09-27.md` (read it first).
Mode: git and GitHub CLI are available, so every step is one branch and one pull request.
Review: v1 of this plan was reviewed adversarially. v2 fixes 4 critical and 10 high
findings. See the mutation log at the end.

## How to use this plan

Each step is written so that an agent with no memory of earlier sessions can execute it.
Read "Shared context", then the step. Do not read other steps unless the step's
dependency list names them. Every step ends with the standard gate and its own checks.

## Shared context (applies to every step)

### Product

A person with no pattern knowledge describes a knit sportswear garment in plain text, or
adjusts simple controls, and downloads a tech pack PDF and graded sewing patterns.

### v1 acceptance criteria (owner's, verbatim in meaning)

| ID | Criterion |
|---|---|
| V1 | A user with no pattern knowledge goes from a one-sentence description to a downloadable tech pack PDF and graded DXF in under 5 minutes. |
| V2 | Every text instruction maps to a validated spec change or a clarifying question. Model output is parsed, never trusted. |
| V3 | Changing a measurement updates the flat, the table and the pattern together. |
| V4 | Drafting assumptions are labelled as assumptions, never shown as verified measurements. |
| V5 | Seam lengths that must match are checked and failures are reported. |
| V6 | 80% or higher test coverage, with geometry and costing maths tested first. |

### Owner constraints

- Do not copy branding, text or assets from specform or fashionINSTA.
- Do not discard kitwright's tested modules without a stated reason.
- Do not depend on an MCP connector at runtime.
- Do not commit `.env` files or hardcode API keys.
- v1 scope is the design core. Quote, production, samples, passport, messages and studio
  are parked, not deleted.

### Open questions

A step whose "Blocks" entry names it must not start until the question is answered or
the owner accepts the default in writing.

| ID | Question | Blocks | Default if the owner accepts it |
|---|---|---|---|
| Q1 | Three GitHub accounts are involved: `SameedIlyas` owns knitwright, `4833R11Y45` owns Sportswear, the CLI is logged in as `reachrazamair`. Who owns the Sportswear code, may it go into a private monorepo, and which account or organisation hosts the new repository? | 1 | Local repository only. Nothing is pushed. |
| Q2 | kitwright has uncommitted changes (`app/design-system.css`, one e2e screenshot) and six untracked files (two landing page documents, one PDF, three images). Commit, discard or leave out? | 1 | Import committed `main` only. Leave the original folder untouched. |
| Q3 | Is there a pattern maker, a factory, or access to CLO, Gerber or Lectra to check the output, and will a sample be sewn? | 9, 20 | Every export is marked "unreviewed draft". Product copy never says "production-ready". |
| Q4 | Target wearer and size chart: men, women, unisex or youth, whose body chart, which size run? | 3 | Unisex adult, XS to 3XL, chart written by us and labelled as an assumption. |
| Q5 | Hosting and data residency. | 12, 13, 17 | Containers on one cloud region, Postgres in the same region. |
| Q6 | Can one user belong to several brands? Which roles? Who may sign off a design as reviewed? | 13, 14, 15 | Yes. Roles: owner, editor, viewer. Only an owner signs off. |
| Q7 | Units shown to the user. | 3, 18 | Stored in metric. Shown in cm with an inch toggle. |
| Q8 | Which AI providers may receive confidential designs? Today: Anthropic (text), fal (images), Gemini (Sportswear vision). | 4, R1 | Anthropic only on the v1 path. Image models are opt-in per brand. |
| Q9 | Costing currency, and is the selling price set by markup on cost or margin on price? | 11 | USD. Both figures are shown, each named. |
| Q10 | Product name: Kitwright or Knitwright. | 18 | Kitwright. |
| Q11 | What is a "jersey" here, and what happens to raglan and henley, which exist today but are not in the v1 list? | 3 | Jersey is a set-in short-sleeve team top in mesh with crew or V neckline, optional side panels, number and logo. Raglan and henley stay in the registry, hidden from v1. |
| Q12 | The nesting library links a component under MPL-2.0. Acceptable? | 11 | Yes, used unmodified and listed in the licence report. |
| Q13 | Will you buy the ASTM D6673 standard and obtain a known-good DXF from a factory? | 9 | No. One DXF per size is the main deliverable. The grade rule table is labelled experimental. |
| Q14 | Can you provide three people with no pattern knowledge for a timed trial? | 20 | No. V1 is reported as "measured by the team only". |
| Q15 | Are pipeline render and logo jobs needed for v1? | R1 | No. The existing web render route is kept behind sign-in. |

### Starting assets

- `kitwright`: Next.js 16.2.9, React 19.2.4, TypeScript, Tailwind v4, Zod 4, Anthropic
  SDK, fal client, vitest, Playwright, pnpm. Package name `kitwright`. Scripts are
  `test:unit` and `test:unit:cov`; there is no `test` script. 44 unit test files, 21
  e2e spec files. Five top styles. Browser storage only. Its `node_modules` links point
  at an old folder, so nothing builds until dependencies are reinstalled.
- `Sportswear`: Python, version not pinned (3.13.2 on the owner's machine), 1,402 lines
  of Python including tests. `pipeline.py` sits at the project root, libraries in
  `src/`. Marker nesting, fabric model, costing, logo compositing, hosted image models.
  One commit. No sample data, so about 9 of 28 tests cannot pass.

### Target layout (created in step 1)

```
knitwright-platform/
  apps/web/             kitwright, history preserved, package renamed "web"
  services/pipeline/    Sportswear, history preserved
  packages/contract/    Zod source, generated JSON Schema, generated Pydantic
  db/migrations/        one migration history, owned by step 13
  plans/  docs/
  docker-compose.yml
  kitwright/  Sportswear/   original folders, ignored by git, never modified
```

### Architecture decisions

| # | Decision | Reason |
|---|---|---|
| D1 | All pattern geometry is produced in TypeScript (`apps/web/lib/pattern`). | Live preview needs fast re-drafts, and kitwright's tested modules are TypeScript. |
| D2 | TypeScript emits nest-ready shapes: curves flattened, fold pieces opened, pairs expanded to instances, seam allowance included, shrinkage applied. Python only places them and measures the result. | One source of geometry truth. The exported pattern and the marker cannot disagree. |
| D3 | The Python service receives JSON (`NestInput`), never a DXF. | DXF round trips lose fold, pairing and notch data. |
| D4 | Zod schemas in `packages/contract` are the source of truth for structure. JSON Schema and Pydantic models are generated. The contract is structural only. Rules that span fields are named validators with shared test vectors. | JSON Schema cannot carry Zod refinements. |
| D5 | Every measurement carries provenance: `user`, `size-chart`, `derived` or `assumption`. A separate `reviewed` record is created only by a human sign-off. | V4. |
| D6 | Explanations of changes are computed from the validated spec difference, not taken from model text. | V2. |
| D7 | `@freesewing/core` (MIT) is the geometry kernel, wrapped behind `lib/pattern/kernel`. Step 5 is a spike that confirms or replaces it. | Avoids hand-writing curve offset, split and length maths. Block formulas stay our own. |
| D8 | Nesting uses `spyrrow` (MIT, links MPL-2.0 `jagua-rs`). Step 11 starts with a spike. | Matches a fabric marker: fixed width, minimised length, 0 or 180 degree rotation, spacing. |
| D9 | The job queue is backed by Postgres. Candidate: Procrastinate, in its own database schema. | Postgres is already required. |
| D10 | Parked areas sit behind the server flag `FEATURE_PARKED_AREAS` (`true` or `false`). | Owner's scope decision. |
| D11 | The vision-generated tech pack from Sportswear is not used in v1. | It reads an AI image, so it cannot satisfy V3. |
| D12 | No MCP connector is called at runtime. | Owner's constraint. Already true of the code. |
| D13 | Units. Measurements: integer tenths of a millimetre. Geometry coordinates: floating point millimetres, compared with a tolerance of 0.01 mm. Money: integer minor units plus a currency code. | Integer millimetres would repeat the 1 mm rounding defect in today's `draft.ts`. |
| D14 | Every export carries an "unreviewed draft" mark until a sign-off exists for that spec version. | Seam checks prove internal consistency, not that the garment sews or fits. |
| D15 | Export is blocked when any seam check fails, allowed with a visible warning when one warns. | V5. |

### Next.js 16 rules

From `node_modules/next/dist/docs/`. Read before any web work.
- `params`, `searchParams`, `cookies()`, `headers()` are asynchronous and must be awaited.
- `middleware.ts` is now `proxy.ts`, Node runtime only, for optimistic checks only.
  Authorisation is checked inside every route handler and server action.
- Route handlers are uncached by default. `next lint` is removed; run `eslint` directly.
- Turbopack is the default. A custom webpack config fails the build.
- Streaming route handlers should send `X-Accel-Buffering: no`.
- Static export is not possible for this product.

### Contract change protocol

`packages/contract` is created by step 2. Later steps may add fields and schemas. They
may not rename, remove or change the meaning of an existing field without an entry in
the mutation log. Every contract change is its own commit, regenerates the JSON Schema
and Pydantic files, and bumps `schemaVersion` when stored data is affected.

### Time budget for V1

| Stage | Budget |
|---|---|
| Text to applied changes or question | 15 s |
| Draft one size | 50 ms |
| Graded DXF export, full size run | 5 s |
| Tech pack PDF | 30 s |
| Marker | 60 s, not on the V1 path. Consumption is shown as a labelled estimate until it finishes. |

### Invariants, checked at the end of every step

| ID | Invariant | Mechanical check |
|---|---|---|
| I1 | No secret is committed. No `.env` file is tracked. | `git ls-files \| grep -E '(^\|/)\.env($\|\.)' \| grep -v '\.env\.example$'` prints nothing. Secret scan passes. |
| I2 | No runtime call to an MCP connector. | `grep -rIil "mcp" apps/web/app apps/web/lib apps/web/components services/pipeline --include='*.ts' --include='*.tsx' --include='*.py'` prints only files on the allow list in `docs/mcp-allowlist.txt` (comments and diagram labels). |
| I3 | Request bodies and model output pass a contract schema before use. | `grep -rn " as GarmentSpec" apps/web` prints nothing outside tests. Schema tests pass. |
| I4 | Tests pass and coverage meets the threshold in force at that step (table below). | Coverage tools with fail-under set. |
| I5 | No measurement is shown or exported without provenance. | Unit tests on the table, DXF notes and PDF. |
| I6 | Parked areas compile and their tests pass with the flag on. | CI job with `FEATURE_PARKED_AREAS=true`. |
| I7 | No competitor branding, text or assets. | Code review. Not mechanical. |

Coverage thresholds in force:

| From step | Web | Python |
|---|---|---|
| 1 | Existing gate: 90% on `lib/{garment,ai,projects,render,techpack,pattern}` | Baseline recorded, no threshold. Legacy `pipeline.py` is excluded, with the reason stated in `pyproject.toml`. |
| 11 | unchanged | 90% on costing, consumption and nesting modules |
| 12 | unchanged | 80% overall |
| 18 | 80% overall including `app/api` and `components` | unchanged |

### Standard gate

`/verify pre-pr` is a command on the developer's machine. CI runs the list below.

```
pnpm install --frozen-lockfile
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test:cov
pnpm --filter web build
cd services/pipeline
uv run ruff check .
uv run mypy src
uv run pytest --cov
```

## Step overview

| Step | Owner's phase | Title | Depends on | May run alongside | Tier |
|---|---|---|---|---|---|
| 1 | a | Monorepo, git, CI, park non-core areas | none | none | default |
| 2 | a | Shared spec contract | 1 | none | strongest |
| 3 | c | Garment engine: measurements, ease, styles | 2 | 5, 13 | strongest |
| 4 | b | Intent layer | 3 | 5, 6, 13 | strongest |
| 5 | d | Geometry kernel (spike and wrapper) | 2 | 3, 4, 13 | strongest |
| 6 | d | Tee blocks and seam checks | 3, 5 | 4, 13 | strongest |
| 7 | d | Seam allowance, notches, annotations | 6 | 13, 14 | strongest |
| 8 | d | Polo and jersey pieces | 7 | 13, 14 | strongest |
| 9 | d | Grading and DXF export | 8 | 14, 16 | strongest |
| 10 | d | Pattern PDF export | 9 | 11, 15, 16 | default |
| 11 | e | Marker maths: costing, consumption, nesting | 9 | 10, 15, 16 | strongest |
| 12 | e | Pipeline service: job API and queue | 11, 14 | 10, 15, 16 | default |
| 13 | g | Database, row level security, isolation tests | 2 | 3 to 8 | strongest |
| 14 | g | Accounts, route guards, limits | 4, 13 | 7, 8, 9 | strongest |
| 15 | g | Versioning, sign-off, artefact storage | 14 | 10, 11, 12, 16 | default |
| 16 | f | Tech pack document and bill of materials | 3, 8 | 9 to 12, 15 | default |
| 17 | f | Tech pack PDF job | 12, 15, 16 | none | default |
| 18 | h | Guided experience for non-experts | 4, 10, 12, 15, 17 | none | default |
| 19 | c, d | Shorts | 18 | none | strongest |
| 20 | all | v1 acceptance record | 1 to 19 | none | strongest |
| R1 | e | Render and logo jobs (after v1) | 12 | any | default |

Dependency edges, complete:

```
1->2   2->3   2->5   2->13
3->4   3->6   5->6   6->7   7->8   8->9   9->10  9->11
4->14  13->14 14->15 11->12 14->12
3->16  8->16  12->17 15->17 16->17
4->18  10->18 12->18 15->18 17->18
18->19 19->20 12->R1
```

"May run alongside" lists only pairs that touch different folders. Two steps that are
not listed together must not be in progress at the same time.

Changes from the owner's phase list, with reasons:
1. **Garment engine (c) comes before the intent layer (b).** The intent layer needs
   measurement actions and knock-on effects that only exist once the engine does.
2. **Phase d is four build steps plus two export steps.** One pull request could not be
   reviewed.
3. **Phase g is three steps on a parallel track starting after the contract.** Both
   paid API routes accept anonymous requests today, and the job API needs a database.
4. **Phase e is split into maths (11) and service (12).** Maths is tested first (V6).
5. **Renders move to R1, after v1.** They serve none of V1 to V6. The existing web
   render route keeps working.

---

## Step 1: Monorepo, git, CI, park non-core areas

**Branch:** `chore/monorepo-setup`. **Depends on:** none. **Blocked by:** Q1, Q2.
**Rollback:** delete the new `.git` folder and the new folders at the root. The original
`kitwright/` and `Sportswear/` folders are never modified.

**Context brief.** See "Starting assets". The root is not a repository. kitwright has a
nested `pnpm-workspace.yaml` and lock file. Parked areas live in
`app/(brand)/{quote,production,samples,passport,messages,materials,settings}` and
`app/(studio)`. They import nothing the design core depends on, but these cross-links
exist: `components/shell/nav.ts`, `lib/flow.ts`, `lib/commands.ts`, the home page, the
"Send to quote" button in `components/techpack/TechPackView.tsx`, `lib/demo/reset.ts`,
and `lib/projects/resolve.ts` line 13, which imports a fixture from the `lib/data`
barrel. Several e2e specs cover parked flows.

**Tasks.**
1. `git init` at the root with branch `main`. Root `.gitignore` covers `/kitwright/`,
   `/Sportswear/`, `.env*` except `.env.example`, `node_modules`, `.next`, `.venv`,
   `out/`, `coverage/`, `__pycache__`.
2. Import with history: `git subtree add --prefix=apps/web` from kitwright `main`, and
   `--prefix=services/pipeline` from Sportswear `main`.
3. Move `pnpm-workspace.yaml` and the lock file to the root. Rename the package to
   `web`. Add scripts `test`, `test:cov`, `lint`, `typecheck`. Reinstall.
4. Record the real unit test result and coverage figure in the pull request.
5. Python: `pyproject.toml` with a pinned Python version, `uv` lock file. Remove unused
   `ezdxf`, `imageio`, `imageio-ffmpeg` from runtime dependencies. Add `pytest`,
   `pytest-cov`, `ruff`, `mypy`, and `ezdxf` as a test dependency. Move `torch`,
   `torchvision`, `transformers` to an optional group.
6. Mark the Python tests that need missing sample data as expected failures, each with a
   reason naming step 11.
7. `apps/web/lib/features.ts`: typed reader for `FEATURE_PARKED_AREAS`. With the flag
   off, parked routes call `notFound()` and the cross-links listed above are hidden.
   Tag parked e2e specs so they run only with the flag on.
8. CI: web job, python job, parked-areas job, secret scan.
9. `docker-compose.yml` with Postgres only. `docs/mcp-allowlist.txt`.
10. Root `.env.example` with variable names and empty values. Correct stale README
    claims in both projects.

**Acceptance criteria.**
- `git log --oneline | wc -l` at the root is at least 80.
- The standard gate passes from a fresh clone in a temporary folder.
- Flag off: `/quote` returns 404 and core e2e specs pass. Flag on: all specs pass.
- I1, I2, I6 hold.

---

## Step 2: Shared spec contract

**Branch:** `feat/spec-contract`. **Depends on:** 1.
**Rollback:** revert. The interface is replaced only in the final task.

**Context brief.** `apps/web/lib/garment/spec.ts` lines 61 to 106 define `GarmentSpec`
as a TypeScript interface. Zod is used only at two API boundaries. Fields today: `style`
(crew, raglan, polo, henley, vneck), `sleeve` (cap, short, three-quarter, long),
`bodyLength`, `fit` (athletic, relaxed), `fabric` (interlock, pique, mesh), `overrides`
(cm, size M, four base measurements), `colorway`, `print`, `logo`, `number`. Sizes are
fixed at S/M/L. Colour types drift: `lib/ai/vocabulary.ts` types colours as palette
identifiers while `lib/ai/schema.ts` accepts hex and casts. The render route casts
unvalidated input at `app/api/render/route.ts` line 121.

**Tasks.**
1. Create `packages/contract` with Zod 4 schemas: `GarmentSpec` v2, `Measurement`,
   `FabricSpec` (construction, weight, width, stretch widthwise and lengthwise,
   recovery, shrinkage, nap), `SizeRun`, `SpecAction`, `ClarifyingQuestion`,
   `PatternSet`, `SeamCheck`, `NestInput`, `MarkerResult`, `CostingInput`,
   `CostingResult`, `TechPack`, `JobStatus`, `SignOff`. Units per D13.
2. `schemaVersion` on every top-level schema. Migration from today's stored spec to v2.
3. Generate JSON Schema with Zod's exporter, then Pydantic models from it. Commit both.
   CI fails when generated files are stale.
4. Fixtures in `packages/contract/fixtures`, valid and invalid, loaded by vitest and
   pytest. They test structure only (D4).
5. Replace the interface with the inferred type. Fix the colour drift. Validate in the
   render route.

**Acceptance criteria.**
- Every structural fixture gives the same result in TypeScript and Python.
- A fixture of today's stored projects loads through the migration.
- I3, I4 hold.

**Verify.** Standard gate, plus `pnpm --filter contract generate && git diff --exit-code`.

---

## Step 3: Garment engine: measurements, ease, styles

**Branch:** `feat/garment-engine`. **Depends on:** 2. **Blocked by:** Q4, Q7, Q11.
**Rollback:** revert. Visual baselines are restored by the revert.

**Context brief.** `lib/garment/styles.ts` holds the style registry and ten points of
measure in centimetres for size M: chest 54, length 72, sleeve 21, shoulder 45, derived
hem sweep and side seam, and four fixed values (shoulder drop, armhole depth, back and
front neck drop) that do not grade. `lib/garment/measure.ts` derives sizes as base plus
grade times step. `lib/garment/calibration.ts` back-computes six of the ten from pixels
of the hand-drawn flat, which is anisotropic: 4.5 px/cm vertical, 1.741 horizontal.
`lib/garment/geometry.ts` (574 lines) draws that flat. Unit tests in `lib/garment` lock
the silhouette, and `e2e/visual-parity.spec.ts` compares committed screenshots. Ease is
additive only: relaxed adds chest 4 and length 2. Fabric affects only visuals. There is
no body measurement model. `lib/ai` enumerates styles from the registry.

**Tasks (tests first).**
1. Body size chart module with a configurable size run. Default chart per Q4.
2. Ease model: garment measurement = body measurement + ease. Ease depends on fit and
   on fabric stretch. Negative ease is capped by a usable-stretch fraction. Every
   coefficient sits in one file with provenance `assumption` and a source note.
3. Remove pixel calibration as a source of measurements.
4. Redraw the flat from measurements at equal horizontal and vertical scale. Update the
   silhouette tests deliberately. Regenerate visual baselines in a separate commit and
   attach before and after images to the pull request for the owner to approve.
5. All structural measurements grade.
6. v1 styles per Q11. Each style declares its measurements, pieces and seam pairs in
   the registry. Styles hidden from v1 carry `availableInV1: false`.
7. Provenance on every value. Overrides allowed on any measurement; dependants
   recompute.
8. Property-based tests: grading is monotonic, left and right are symmetric, no
   negative lengths, every style and size yields a complete set.

**Acceptance criteria.**
- A test shows that raising fabric stretch lowers chest ease.
- Flat scale is equal on both axes, asserted in a unit test.
- `grep -rn "calibration" apps/web/lib/garment/measure.ts` prints nothing.
- Every measurement in every size has provenance.
- I4, I5 hold.

**Risk.** The ease coefficients have no authoritative open source. They are assumptions
until a pattern maker reviews them (Q3).

---

## Step 4: Intent layer

**Branch:** `feat/intent-layer`. **Depends on:** 3. **Blocked by:** Q8.
**Rollback:** revert.

**Context brief.** `apps/web/app/api/design/route.ts` streams model tool calls to the
browser. The model name is hardcoded at line 28. `lib/ai/vocabulary.ts` defines two
tools and twelve action types, none of them for measurements. `lib/ai/stream-parse.ts`
extracts actions, `lib/ai/schema.ts` validates them, `lib/ai/apply.ts` applies them and
rejects impossible combinations. `lib/ai/offline.ts` is a keyword parser used when no
key is set. Defects: `components/ai/useDesignChat.ts` line 80 sends messages only, so
the model cannot see the garment; invalid actions are dropped silently at `route.ts`
lines 201 to 202; there are no clarifying questions; there is no tool-result round
trip. `lib/ai/apply.ts` line 23 imports from a client component file. Step 3 has added
measurements with provenance, an ease model and a registry flag for v1 styles.

**Tasks (tests first).**
1. Golden set of at least 120 utterances in `lib/ai/golden/`, each with the expected
   outcome. Include vague, relative, mixed-unit, contradictory, out-of-scope and
   prompt-injection cases.
2. Outcome type with exactly three cases: applied changes, clarifying question,
   explained rejection. A property-based test feeds arbitrary model output, including
   plain text with no tool call, malformed JSON and unknown actions, and asserts that
   the result is always one of the three.
3. Send the current spec and the last applied changes with every request.
4. New actions from the contract: set and adjust a measurement, set fabric stretch, set
   size run. New `ask_clarification` tool with 2 to 4 options.
5. Deterministic ambiguity rules before and after the model.
6. Explanations computed from the spec difference, including effects on derived
   measurements (D6).
7. Tool-result round trip.
8. Model name and limits from configuration. Fix the layering inversion.
9. Offline parser extended and run against the golden set in CI. Live model run as a
   recorded evaluation committed to `docs/evals/`.

**Acceptance criteria.**
- Never silent: 100% of golden utterances give one of the three outcomes, offline and
  live.
- Correct outcome: live model at least 90% of the golden set, offline parser at least
  60%. The owner may change these numbers through the mutation log.
- The property-based test in task 2 passes.
- I3, I4 hold.

---

## Step 5: Geometry kernel (spike and wrapper)

**Branch:** `feat/pattern-kernel`. **Depends on:** 2.
**Rollback:** revert. Nothing else imports the kernel yet.

**Context brief.** `apps/web/lib/pattern/draft.ts` builds outlines by direct coordinate
construction. Curves are single quadratic Beziers sampled to 8 segments and rounded to
1 mm (lines 87 to 116). There is no curve offset, split or intersection code. The plan
proposes `@freesewing/core` (MIT, npm 4.10.2) as the kernel. It has not been tried in
this codebase.

**Tasks.**
1. Spike, one day. In a vitest test, build a closed outline with two cubic curves in
   `@freesewing/core`. Measure: path length and offset against reference values, import
   under Next.js 16 on server and client, added client bundle size.
2. Reference values: closed form for lines and circular arcs, numerical integration at
   10,000 samples for cubic curves.
3. Decision rule. Adopt if length and offset errors are under 0.01 mm and the added
   client bundle is under 150 kB compressed. Otherwise use `bezier-js` with an own
   kernel. Record the result in `docs/decisions/0001-geometry-kernel.md`.
4. `lib/pattern/kernel`: point, line, cubic curve, path, offset, split, length,
   intersection, mirror, flatten to a polyline at a stated tolerance. Pure functions.
   Values are never mutated.

**Acceptance criteria.**
- The decision record exists with measured numbers.
- Kernel functions meet the 0.01 mm tolerance against the references.
- Coverage on `lib/pattern/kernel` is at least 90%.

---

## Step 6: Tee blocks and seam checks

**Branch:** `feat/tee-blocks`. **Depends on:** 3, 5.
**Rollback:** revert. The old `draftPattern` export is kept under its name until step 9.

**Context brief.** `lib/pattern/draft.ts` drafts three half pieces on the fold: front,
back, sleeve. Style reaches it only through measurement deltas (`draft.ts` line 120,
`lib/garment/measure.ts` line 57). The piece set is the same for every style. Front and
back differ only in neck drop. The sleeve y-axis runs opposite to the body (lines 21 and
191). A scratch recomputation for size M found the sleeve cap at 28.6 cm against a 32.5
cm armhole, and the side seam at 52.4 cm against a published 50.2 cm. These figures are
unconfirmed. There is no seam check anywhere. Step 3 provides measurements with ease
from stretch. Step 5 provides the kernel.

**Tasks (tests first).**
1. Tests that measure the current output and record the two mismatches as facts.
2. Crew and V-neck: front, back, sleeve, neckband. Front and back differ in armhole and
   shoulder. One coordinate convention for all pieces.
3. Seam pairs from the style registry: armhole to sleeve cap, front to back side seam,
   front to back shoulder, neckline to neckband by a stretch ratio, sleeve underarm.
4. Seam check measures the final flattened sew lines independently of how they were
   drafted. Target relation and tolerance per pair, each labelled as an assumption.
   Result: pass, warn or fail, with a plain-language message.
5. Sleeve cap solved to fit the armhole. The check in task 4 still runs on the result.
6. Drafting assumptions returned as data.

**Acceptance criteria.**
- Crew and V-neck pass every seam check in every size at default settings.
- A deliberately broken input gives a failing check with a message.
- Drafting one size takes under 50 ms in a vitest benchmark.
- I4, I5 hold.

**Stated limit.** Passing checks show that the pattern is consistent with our own
assumptions. They do not show that the garment sews or fits (D14, Q3).

---

## Step 7: Seam allowance, notches, annotations

**Branch:** `feat/pattern-details`. **Depends on:** 6. **Rollback:** revert.

**Context brief.** After step 6, `lib/pattern` drafts crew and V-neck pieces with sew
lines and seam checks. Seam allowance today is a constant 1 cm printed as a note
(`draft.ts` line 60, `dxf.ts` lines 91 to 95). There are no notches, fold markers, cut
quantities or pairing data. Each piece has one grainline.

**Tasks (tests first).**
1. Seam allowance as offset geometry, per edge, with a width per seam type from the
   style registry. Correct corners at seam ends. No self-intersection.
2. Notches on both sides of every matched seam, at matching distances along the seam.
3. Fold edge, grainline, piece name, size, cut quantity, pairing and mirror data.
4. Nest-ready output per D2: flattened, fold pieces opened, pairs expanded.
5. Hem and cuff allowances.

**Acceptance criteria.**
- Cut line area exceeds sew line area by the expected amount within 1%, per piece.
- Notch positions on matched seams agree within 0.5 mm after seam checks.
- No cut line self-intersects, in any size.
- I4, I5 hold.

---

## Step 8: Polo and jersey pieces

**Branch:** `feat/polo-jersey`. **Depends on:** 7. **Rollback:** revert.

**Context brief.** After step 7 the engine drafts crew and V-neck with seam allowance
and notches. The registry lists polo, which today gets no collar or placket piece, and
jersey, defined per Q11. `components/` holds flats for the existing styles.

**Tasks (tests first).**
1. Polo: collar, collar stand if the style has one, placket and facing, button
   positions as drill marks.
2. Jersey: side panels where chosen, neckline options, sleeve hem bands.
3. Seam pairs for every new seam.
4. Flats for the new pieces, drawn from the same measurements.

**Acceptance criteria.**
- Polo and jersey pass every seam check in every size.
- Every declared piece is drafted, asserted against the registry.
- I4, I5 hold.

---

## Step 9: Grading and DXF export

**Branch:** `feat/grading-dxf`. **Depends on:** 8. **Blocked by:** Q3, Q13.
**Rollback:** revert. The old plain export remains behind a flag.

**Context brief.** `apps/web/lib/pattern/dxf.ts` writes header and entities only, named
layers, polylines side by side, in centimetres. It can write any size, but
`components/techpack/PatternExportButton.tsx` line 24 offers size M only. Its comments
say it is not AAMA. No open library emits AAMA/ASTM garment DXF with grade rules, no
open validator exists, and the standard is paid. The layer map below comes from public
descriptions and is unconfirmed: 1 cut line, 2 turn points, 3 curve points, 4 notches,
5 grade reference, 6 mirror line, 7 grainline, 8 internal lines, 13 drill holes, 14 sew
line, 15 annotation.

**Tasks (tests first).**
1. Grading: draft every size, match grade points by identifier, derive deltas from the
   base size. Applying the deltas to the base reproduces each size within 0.01 mm.
2. DXF writer: one block per piece, numeric layers as above, ASCII only, units
   declared. **Main deliverable: one file per size, in a zip.**
3. Grade rule table file, labelled experimental in the interface and the file notes
   until an import is recorded.
4. Independent reader: a pytest in `services/pipeline/tests` opens exported fixtures
   with `ezdxf` and checks piece count, layer contents, closed cut lines and areas.
   This proves valid DXF with the intended content. It does not prove that a CAD system
   accepts it.
5. "Unreviewed draft" mark and the assumptions list in every file (D14).
6. Export blocked on a failing seam check (D15).
7. `docs/validation/cad-import.md`: a checklist for importing into a CAD system and
   recording the result.

**Acceptance criteria.**
- The reader test passes for all v1 styles across the size run.
- Full size run export finishes within 5 s.
- Either an import into a CAD system is recorded, or the export screen states that no
  CAD system has read the file.
- I4, I5 hold.

**Verify.** Standard gate, plus `cd services/pipeline && uv run pytest tests/test_dxf_roundtrip.py`.

---

## Step 10: Pattern PDF export

**Branch:** `feat/pattern-pdf`. **Depends on:** 9. **Rollback:** revert.

**Context brief.** There is no pattern PDF today. After step 9, graded pieces exist
with cut lines, sew lines, notches and annotations, and every export carries the draft
mark and assumptions list. `pdfkit` (MIT) is the chosen library.

**Tasks (tests first).**
1. Full-scale plotter output on a roll of a given width.
2. Tiled A4 and Letter with overlap marks, page grid labels, assembly diagram.
3. A 100 mm check square on the first page.
4. Cover page with the assumptions list and the draft mark.

**Acceptance criteria.**
- The check square is 100 mm in the file's own units, read back by a PDF parser.
- Page count equals the tiling calculation for each size.
- I4, I5 hold.

---

## Step 11: Marker maths: costing, consumption, nesting

**Branch:** `feat/marker-maths`. **Depends on:** 9. **Blocked by:** Q9, Q12.
**Rollback:** revert. The command line pipeline keeps working.

**Context brief.** In `services/pipeline`: `src/nest.py` is a greedy bottom-left-fill
nester with real polygon intersection tests, whose starting positions come from
bounding boxes, so pieces do not settle into concave gaps. Rotation is 0 or 180
degrees. Efficiency is 52 to 61% by the project's own README. Single size only.
`src/fabric.py` has shrinkage, nap, weight and fabric cost. Costing exists twice:
`nest.cost()` is tested; the inline version at `pipeline.py` lines 286 to 290 is the
one used and is untested. Its "margin" is a markup on cost. `src/dxf_panels.py` parses
the fold flag at line 106 and never uses it. There is no sample data. After step 9 the
web side can emit `NestInput` fixtures for every style and size.

**Tasks (tests first, in this order).**
1. Costing as one pure module using `Decimal`: fabric, trims, labour, overhead,
   wastage, then markup and margin as separately named outputs. Currency code carried.
   Every rate carries provenance. Delete the duplicate.
2. Consumption: marker length, efficiency on cut area, weight, per garment consumption
   for a size ratio, end loss, usable width.
3. Spike, half a day: install `spyrrow` on Windows and Linux with the pinned Python
   version, run it inside a worker process, confirm the same seed gives the same
   result. Record in `docs/decisions/0002-nesting.md`. If it fails, keep the existing
   nester and record the efficiency gap as a known limit.
4. Nesting module taking `NestInput`. Rotation limited by nap and grain. Fixed seed and
   time limit. The old nester stays as fallback and benchmark.
5. Shrinkage removed from Python geometry (D2). Its formulas become shared test vectors
   for the TypeScript implementation.
6. `NestInput` fixtures replace the missing DXF data. Remove the expected-failure marks
   from step 1.

**Acceptance criteria.**
- Costing tests cover markup against margin, zero and missing rates, rounding,
  currency.
- On the same crew tee size-ratio input, the new nester's efficiency is at least 10
  percentage points above the old one within 60 s. If not, the measured figures are
  reported and the owner decides.
- Coverage on costing, consumption and nesting modules is at least 90%.
- I2, I4 hold.

---

## Step 12: Pipeline service: job API and queue

**Branch:** `feat/pipeline-service`. **Depends on:** 11, 14. **Blocked by:** Q5.
**Rollback:** revert, then run the down migration for the queue schema.

**Context brief.** `services/pipeline/pipeline.py` is a command line orchestrator with
module globals `COST` and `LOG` (lines 26 to 27), errors caught into a dictionary with
exit code 0 (lines 226 to 229), a cache keyed on file existence (lines 218 to 219), the
SKU used in paths unsanitised, and an `env()` helper that fails when `.env` is absent
(lines 154 to 158). After step 11 the maths modules are pure and tested. After steps 13
and 14 there is a Postgres database with row level security, a `jobs` table, accounts
and a data access layer in the web app.

**Tasks (tests first).**
1. FastAPI application: create job, get job, get result, cancel. Bodies are the
   generated Pydantic models.
2. Queue in Postgres in its own schema, with its own migrations run by the owner role.
3. Jobs are idempotent by a content hash of the input. A changed input is a new job.
4. Service-to-service authentication with a signed, short-lived token. The service is
   reachable only from the web server. Brand identifier travels with every job, and the
   worker sets it as the tenant for its transaction.
5. Remove module globals, swallowed errors and the `.env` requirement. Structured logs.
6. Web side: typed client, job status hook, route handler guarded by `verifySession()`.
7. Retire `pipeline.py` from the service path. Keep it as a developer tool.

**Acceptance criteria.**
- The same input returns the cached result; a changed price gives a new result.
- A job for brand A cannot be read with brand B's token.
- A marker job finishes within 60 s or reports a timeout.
- Python coverage is at least 80% overall.
- I2, I3, I4 hold.

**Verify.** Standard gate, plus `docker compose up -d` and `cd services/pipeline && uv run pytest -m integration`.

---

## Step 13: Database, row level security, isolation tests

**Branch:** `feat/database`. **Depends on:** 2. **Blocked by:** Q5, Q6.
**Rollback:** run down migrations, then revert. No user data exists yet.

**Context brief.** There is no database. Projects are in browser `localStorage` under
`kitwright.projects.v1` via `apps/web/lib/projects/store.ts`. Designs are confidential
and must be isolated per brand. This step owns `db/migrations/` for the whole platform.

**Tasks (tests first).**
1. Choose one migration tool and record it in `docs/decisions/0003-database.md`. Every
   migration has a down migration.
2. Tables: brands, users, memberships with role, projects, spec versions (append-only),
   sign-offs, artefacts, jobs, audit log. Every tenant table has `brand_id`.
3. Row level security on every tenant table, with `FORCE ROW LEVEL SECURITY`.
4. Roles: `owner` runs migrations; `app` is used by the web server and cannot bypass
   policies; `worker` is used by the pipeline. Neither `app` nor `worker` owns tables.
5. Tenant context is set with a transaction-local setting at the start of every
   transaction, so a pooled connection cannot leak it to the next request.
6. Isolation test suite against a real Postgres: for every table, a session with brand
   A's context cannot read, update or delete brand B's rows, including after the
   connection is returned to the pool and reused.

**Acceptance criteria.**
- The isolation suite passes for every tenant table.
- A query with no tenant context returns no rows.
- `/verify-security db` (a developer-machine command) reports no critical or high
  finding.
- I1, I4 hold.

---

## Step 14: Accounts, route guards, limits

**Branch:** `feat/accounts`. **Depends on:** 4, 13. **Blocked by:** Q6.
**Rollback:** run down migrations, then revert.

**Context brief.** There are no accounts. `app/api/design/route.ts` and
`app/api/render/route.ts` accept anonymous requests and call paid services. Step 4 has
rewritten the design route. Step 13 has created the database with row level security
and an `app` role. Next.js 16 requires authorisation inside every route handler;
`proxy.ts` is for optimistic checks only.

**Tasks (tests first).**
1. Accounts and sessions with an established library. No hand-written password or
   session code. Record the choice in `docs/decisions/0004-accounts.md`.
2. Data access layer with `verifySession()` returning user, brand and role.
3. Guard every route handler. A test enumerates all files under `app/api` and fails if
   one does not call the guard.
4. Rate limit per user and spend limit per brand on the model and image routes.
5. Random, non-guessable identifiers replace `KW-` plus a count.

**Acceptance criteria.**
- Anonymous requests to every API route are refused, proven by the enumeration test.
- A viewer role cannot change a design.
- The rate limit test passes.
- I1, I3, I4 hold.

---

## Step 15: Versioning, sign-off, artefact storage

**Branch:** `feat/versioning`. **Depends on:** 14. **Rollback:** run down migrations,
then revert. The browser import copies data and leaves browser storage intact.

**Context brief.** After step 14 there are accounts, roles and a guarded data access
layer. Projects still load from browser storage through the store interface in
`lib/projects/store.ts`. Tech pack version is hardcoded to 1. Created packs have
`reviewedSpec: null` and can never be verified (`lib/projects/resolve.ts` lines 43 to
55). There is no sign-off flow.

**Tasks (tests first).**
1. Database implementation behind the existing store interface.
2. Every accepted change creates an immutable spec version. Restore creates a new one.
3. Sign-off: a permitted role records a sign-off against one spec version, with name
   and time. Any later change produces a new, unsigned version.
4. Exports read the sign-off state to decide the draft mark (D14).
5. Artefacts in private object storage with short-lived signed links.
6. One-time import of browser-stored projects, by copy.

**Acceptance criteria.**
- Changing a signed-off design yields an unsigned version, asserted in a test.
- An artefact link for brand A fails for brand B and after expiry.
- I4, I5 hold.

---

## Step 16: Tech pack document and bill of materials

**Branch:** `feat/techpack-model`. **Depends on:** 3, 8. **Rollback:** revert.

**Context brief.** `apps/web/lib/techpack/document.ts` defines the model: id, title,
version, spec, rows, stamp, fabric, construction. It imports from `components/` at line
9. `components/techpack/TechPackDocument.tsx` renders cover, flats, graded measurements
with tolerance, fabric, construction notes and an approval line. There is no bill of
materials, colourway sheet, artwork placement sheet or revision history. The
"production ready" tag at `components/techpack/TechPackView.tsx` lines 49 to 50 keys
off provenance, so a diverged pack can still show it. After step 8 each style declares
its pieces and seams.

**Tasks (tests first).**
1. Document model from the contract: cover, flats with callouts, measurement table for
   the size run with tolerance and provenance, bill of materials, construction notes
   per seam, colourways, artwork placement, labels and care, assumptions page, revision
   history.
2. Bill of materials derived from the registry and spec. Consumption is a labelled
   estimate until a marker result exists.
3. Construction notes generated from declared seams. Model-drafted wording is limited
   to descriptive copy, validated, and marked as drafted.
4. Three-way test: change one measurement and assert that the flat, the table and the
   pattern all change (V3).
5. Fix the layering inversion and the status tag. Remove the words "production ready".

**Acceptance criteria.**
- The three-way test passes.
- No value is rendered without provenance.
- I4, I5 hold.

---

## Step 17: Tech pack PDF job

**Branch:** `feat/techpack-pdf`. **Depends on:** 12, 15, 16. **Blocked by:** Q5.
**Rollback:** revert. The browser print route remains.

**Context brief.** The print route at `app/(brand)/tech-pack/[id]/print/page.tsx`
resolves the pack from browser storage through `components/techpack/PrintLoader.tsx`
(lines 23 to 24) and calls `window.print()` itself (line 33). A server-side browser has
empty storage, so that route cannot be used as it is. After steps 12, 15 and 16 there
is a job queue, versioned specs in the database, and a complete document model.

**Tasks (tests first).**
1. A server-rendered print route that loads one spec version through the data access
   layer and never calls `window.print()`. Access by a signed, short-lived token
   scoped to that version.
2. A PDF job in a worker that opens the route in headless Chromium and saves A4 output
   to artefact storage.
3. If the hosting choice rules out Chromium, build the PDF with `pdfkit` instead and
   record the decision.
4. Draft mark and assumptions page per D14.

**Acceptance criteria.**
- A text extraction test finds every section heading in the PDF.
- Flats are vector, asserted by checking that the pages hold no raster image of them.
- The job finishes within 30 s.
- Two PDFs of the same version have identical extracted text and page count.
- I4, I5 hold.

---

## Step 18: Guided experience for non-experts

**Branch:** `feat/guided-ux`. **Depends on:** 4, 10, 12, 15, 17. **Blocked by:** Q7, Q10.
**Rollback:** revert.

**Context brief.** The configurator and chat exist with Playwright coverage. After the
earlier steps the system turns text into validated changes or a question, drafts graded
patterns with seam checks, builds a tech pack, exports DXF and PDF, and runs marker and
costing jobs. The user knows nothing about patterns.

**Tasks.**
1. One path: describe, review, adjust, download. Defaults give a first result with no
   further input.
2. Live preview: flat, table and pattern outline update together.
3. Clarifying questions as choices with a recommended option.
4. Plain-language change list after every instruction, with undo.
5. Status for each value in plain words: you chose this, we assumed this, checked by a
   person. Seam failures explained with what to change.
6. Fabric use and cost shown when the marker job finishes, as an estimate before then.
7. `lib/copy/vocabulary.ts` maps technical terms to plain wording. A test fails when a
   listed term appears in the interface without its explanation.
8. Download screen shows the assumptions and the draft mark before download.
9. Accessibility checks and reduced-motion support kept.

**Acceptance criteria.**
- An e2e test goes from one sentence to both downloads with no other typed input,
  using stubbed model responses.
- The vocabulary test passes.
- Web coverage is at least 80% overall.
- I4, I5, I7 hold.

**Verify.** Standard gate, plus `pnpm --filter web exec playwright test`.

---

## Step 19: Shorts

**Branch:** `feat/shorts`. **Depends on:** 18. **Rollback:** revert.

**Context brief.** The engine supports knit tops through a registry in which each
style declares measurements, pieces and seam pairs. The intent layer, tech pack,
exports and guided path read that registry. Shorts are the first lower-body garment.

**Tasks (tests first).**
1. Lower-body measurements: waist, hip, rise, inseam, outseam, thigh, leg opening.
2. Pieces: front, back, waistband, optional side panel, gusset, pocket bag.
3. Seam pairs: inseam, outseam, front and back rise, waistband to waist by a stretch
   ratio.
4. Flat, tech pack sections, intent vocabulary and golden utterances.
5. Nesting and costing fixtures.

**Acceptance criteria.**
- Shorts pass every seam check across the size run.
- The guided path produces a shorts tech pack and graded DXF in the e2e test.
- I4, I5 hold.

---

## Step 20: v1 acceptance record

**Branch:** `release/v1`. **Depends on:** 1 to 19. **Blocked by:** Q3, Q14.
**Rollback:** not applicable. This step changes documents only.

**Context brief.** All features are merged. This step records evidence. It does not fix
defects. Any defect found becomes a new step through the mutation log.

**Tasks.**
1. Timed runs with the live model for five descriptions, by the people named in Q14.
2. Evidence table: one row for each of V1 to V6 with the test or record that proves it,
   or "not met" with the reason.
3. Coverage reports, security scan, dependency licence report.
4. CAD import record and sewn sample report, if Q3 provides them.
5. Update both READMEs and `docs/`.

**Acceptance criteria.** The evidence table is complete and the owner has read it.

---

## Step R1: Render and logo jobs (after v1)

**Branch:** `feat/render-jobs`. **Depends on:** 12. **Blocked by:** Q8, Q15.
**Rollback:** revert. The web render route is unchanged.

**Context brief.** Renders exist twice. `apps/web/app/api/render/route.ts` calls a
hosted image model with the flat as reference. `services/pipeline` calls hosted models
for render and depth, then composites a logo with `src/logo.py` (deterministic) placed
by `src/segment.py` (SegFormer on torch, with a colour-contrast fallback). The
segmentation weights may carry a non-commercial licence. No seed or model version is
pinned.

**Tasks.**
1. Confirm the weights' licence. If unusable, ship the fallback only.
2. Render and logo compositing as jobs on a separate heavy worker image.
3. Pin model versions. Brand check on the final render.
4. `docs/data-processing.md` lists each provider and what is sent to it.

**Acceptance criteria.**
- A render job returns an image with a record of model, version and cost.
- With the heavy worker stopped, steps 1 to 20 still pass.

---

## Anti-patterns to refuse during execution

- Trusting model text for anything that reaches a file, a measurement or a price.
- A second implementation of geometry, shrinkage or costing in another language.
- Labelling a drafted or assumed value as measured or verified.
- Writing "production-ready" or claiming CAD compatibility without a recorded import.
- Deleting parked areas or their tests to make a build pass.
- Starting a step before its dependencies are merged or its questions are answered.
- One pull request that spans two steps.

## Plan mutation protocol

A step may be split, inserted, skipped, reordered or abandoned only by editing this
file in its own commit, with a dated entry below.

| Date | Change | Reason |
|---|---|---|
| 2026-09-27 | v1 drafted, 13 steps | Initial draft |
| 2026-09-27 | v2, 20 steps plus R1. Added criteria, constraints and open questions to shared context. Reordered garment engine before intent layer. Split pattern, service, persistence and tech pack steps. Units changed from integer mm (D13). Python limited to placing shapes (D2). Contract made structural only (D4). Draft mark on all exports (D14). Gate commands corrected. Renders moved after v1. Three context brief claims corrected. | Adversarial review: 4 critical, 10 high findings |
