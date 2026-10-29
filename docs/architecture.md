# Architecture map

How the Knitwright platform fits together: the app, the code areas and the workstream that built each, how a design becomes
a factory order, which providers are stand-ins, how to run it, and what CI runs. Every path below exists in the repository.
Decision records are in `docs/decisions/` (index: `docs/decisions/README.md`). The plan that wave 1 to 5 followed is
`plans/platform-v4.md`.

## Scope

This repository is the **platform**: studio, club and brand workspaces, tech pack and factory files, and the ops console. It
does not hold the **Store** or **Sell** storefront (cart, checkout, payment, team-store links, club sites). The Store calls the
platform through one database function, `submit_order_for_production` (decision 0043). `Sportswear/`, `kitwright/` and
`supabase/config.toml` are not changed by platform work.

## Apps and layout

One app, `apps/web`: Next.js 16 and React 19, Supabase for Postgres, auth and storage (decision 0001). The pnpm workspace is
`pnpm-workspace.yaml` (`apps/*`).

| Path | What is there |
|---|---|
| `apps/web/app/` | Pages and routes. Route groups: `(auth)` sign-in and reset, `(onboarding)` welcome, `(app)` the signed-in product, `(admin)` platform-admin pages, `(ops)` the ops console. Also `legal`, `s/[token]` (share links) and `unsubscribe`. |
| `apps/web/app/api/` | Route handlers, all made with `defineRoute` (78 `route.ts` files). |
| `apps/web/lib/` | The code that decides things, in plain TypeScript with unit tests beside it. |
| `apps/web/components/` | UI. |
| `apps/web/e2e/` | Playwright specs, one per area (for example `ops.spec.ts`, `club.spec.ts`). |
| `apps/web/tests/architecture/` | Tests that read the source: every route and action is wrapper output, rate limits, page guards, ops access, bundle weight, motion. |
| `apps/web/tests/integration/` | Database tests against local Supabase (isolation, ledgers, ops, RLS). |
| `supabase/migrations/` | Every table, policy and function, in timestamp order. |
| `docs/` | Decisions, owner documents, runbooks, launch records, reviews. |
| `plans/` | The build plans. |
| `scripts/` | `check-invariants.sh`, `check-auth-settings.mjs`, `write-local-env.mjs`. |

Where the signed-in pages are:

| Area | Routes under `apps/web/app/` |
|---|---|
| Studio | `(app)/studio/...` (new, start, charts, and per design: guide, kit-styles, layers, tech-pack, pattern-service) |
| Club and brand | `(app)/club`, `(app)/brand`, `(app)/brands`, `(app)/brands/fabrics`, `(app)/templates`, `(app)/designer`, `(app)/credits`, `(app)/settings` |
| Platform admin | `(admin)/admin/settings`, `(admin)/admin/templates`, `(admin)/admin/leads` |
| Ops | `(ops)/ops` with `batches`, `exceptions`, `orders`, `pattern-requests`, `settings` |

### Rules the code enforces

- **Server writes only.** Tables are brand-scoped with row level security. Browsers get no write grant; writes go through
  `defineRoute` / `defineAction` (`lib/server/`) and database functions the server's key alone may run.
- **Isolation by brand.** One brand never reads another's rows (`tests/integration/isolation.test.ts`).
- **No invented numbers.** A value a factory reads carries a source. Anything else is a labelled "Knitwright default".
- **Deterministic files.** Generated PDFs and print files carry no date or random id, so the same input gives the same bytes.
- **Plain words.** `lib/copy/vocabulary.ts` and the wording tests (`lib/techpack/wording.test.ts`, `lib/ops/wording.test.ts`).
- **No MCP at runtime** and no tracked environment file: `scripts/check-invariants.sh`.

## Code areas under `apps/web/lib/`, by workstream

Wave and workstream names are from `plans/platform-v4.md`. The decision number is where to read why.

### Foundation (the first build, before v4)

| Area | Purpose | Decision |
|---|---|---|
| `server`, `supabase`, `auth`, `config`, `monitoring` | request wrappers, sessions, environment contract, error monitoring | 0001, 0003, 0023 |
| `brands`, `storage`, `profile`, `deletion`, `leads`, `consent`, `legal`, `share` | accounts, brand isolation, files and quota, erasure, quote requests, marketing consent, share links | 0004, 0023 to 0026 |
| `garment`, `sizing`, `charts`, `units`, `flat`, `fabrics`, `pattern-library`, `cutting` | the garment contract and registry, sizes, flats, fabrics, pattern pieces, cut list | 0005, 0006, 0009, 0015 to 0017, 0029, 0030 |
| `projects`, `techpack`, `images`, `garment3d`, `usage`, `providers` | designs and versions, tech pack and exports, photoreal images, 3D trial, spend caps, model providers | 0007 to 0012, 0014, 0018 |
| `intent`, `guided`, `home`, `navigation`, `copy`, `forms`, `pagination` | assistant and test set, guided flow, plain words, shared UI logic | 0013, 0019 to 0022 |

### Production files (W1 to W7 of the earlier plan)

| Area | Purpose | Decision |
|---|---|---|
| `production` | the production contract | 0028 |
| `print` | print files for any design | 0031 |
| `orders`, `releases`, `proofs` | team orders, frozen releases, strike-offs, sign-offs | 0032 |
| `artwork-stack`, `artwork-intake`, `design-import`, `pattern-generators` | artwork layers, a club's own files, designs from an image, pattern generators | 0035 to 0038 |

### Wave 1 (V1 to V8)

| Workstream | Area | Decision |
|---|---|---|
| V1 validation gate | `validation` | 0039 |
| V2 sports catalogue | `garment/registry/teamwear`, `config` | 0040 |
| V3 template library | `templates` | 0041 |
| V4 club workspace | `clubs`, `workspace` | 0042 |
| V5 ops console part 1 | `ops` | 0043 |
| V6 credits | `credits` | 0044 |
| V7 guardrails | `guardrails` | 0045 |
| V8 intake evaluation | `intent/golden` | 0046 |

### Wave 2

| Workstream | Area | Decision |
|---|---|---|
| W2-A inspiration variants | `variants`, `kit-styles` | 0047 |
| W2-B chat edits as diffs | `design-diff` | 0048 |
| W2-C glTF base models | `gltf` | 0049 |
| W2-D ops part 2 | `ops/qc`, `ops/packing`, `ops/shipping`, `ops/exceptions`, `ops/metrics` | 0050 |
| W2-E credits wired into outputs | `credits-gate` | 0051 |
| W2-F football and cricket templates | `templates`, `garment/registry/teamwear` | 0052 |
| W2-G per-panel layers | `panel-layers` | 0053 |

### Wave 3

| Workstream | Area | Decision |
|---|---|---|
| W3-A media sets | `media` | 0054 |
| W3-C generated-image checker | `media-check` | 0055 |
| W3-F settings console | `settings` | 0056 |
| W3-B lifestyle images | `media/lifestyle` | 0057 |
| W3-D turntable and clip | `media/video` | 0058 |
| W3-E Studio media screen | `media`, `components/studio` | 0059 |

### Wave 4

| Workstream | Area | Decision |
|---|---|---|
| W4-A pattern service | `pattern-service`, `patterns` | 0060 |
| W4-B designer templates, royalties | `designers` | 0061 |
| W4-C brand runs | `brand-runs` | 0062 |
| W4-D design comments | `comments` | 0063 |
| W4-E phone layout and accessibility | `components`, `app/globals.css` | 0064 |
| W4-F two-click reorder | `clubs/reorder` | 0065 |

### Wave 5 (review and hardening)

W5-A, B and C write reports to `docs/reviews/`: [security](reviews/security-v4.md), [code](reviews/code-v4.md),
[coverage](reviews/coverage-v4.md). W5-D is these documents.

## Data flow: from a design to an order to ops

1. **Design.** A person starts from a sentence, a sketch, a template or a club kit (`lib/intent`, `lib/templates`, `lib/clubs`).
   The garment contract (`lib/garment`) turns it into a spec. Every edit saves a new version (`lib/projects`, decision 0007).
2. **Checks.** Guardrails (`lib/guardrails`) flag dpi, bleed, safe zone, seam crossings and colours the print cannot reach. The
   validation gate (`lib/validation`) compares the design with the factory profile and gives it a status. Blockers stop "Ready
   for the factory"; warnings do not.
3. **Factory file.** The tech pack (`lib/techpack`) is one view of the design: measurements, construction notes, artwork, and a
   source on every value. Exports are PDF, Excel and SVG (decision 0011). Print files and pattern DXF come from `lib/print` and
   `lib/pattern-library`. Paid outputs go through `lib/credits-gate`.
4. **Team order and release.** A club's roster becomes a team order (`lib/orders`). A **release** freezes the design version, the
   team list hash and the file settings, with hashes, so the files can be rebuilt and compared later (`lib/releases`, decision
   0032). Sign-offs (`lib/proofs`) carry a name, a role and a date.
5. **Hand-off to production.** The Store (outside this repo) calls `public.submit_order_for_production` with a release id and the
   quantities. A brand run calls the same function from `lib/brand-runs`. The wrapper is `lib/ops/contract.ts`.
6. **Ops.** The order waits for the weekly cut-off, goes into a batch, and gets a factory sheet and a print files ZIP. Ops records
   factory status, quality control, packing, shipping and exceptions. The factory never logs in. See `docs/runbook/ops.md`.
7. **Reorder.** A club reorders from its order history (`lib/clubs/reorder`); a new team order results and goes through steps 4 to 6.

Sideways: pattern requests for garments the library cannot draft go to ops (`/ops/pattern-requests`, decision 0060); credits are
a ledger beside all of it (`lib/credits`, decision 0044); platform settings (`lib/settings`) feed credits, ops, the factory profile
and guardrails (decision 0056).

## Where providers are stubbed

Nothing reaches a paid service without a key. Without one the feature says it is not available, or a stand-in answers.

| Service | Real provider | Stand-in or default | Where |
|---|---|---|---|
| Assistant text and image reading | Anthropic or OpenAI (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) | `AI_PROVIDER_STUB=on` answers without the network, for browser tests only; refused where real people sign in | `lib/providers/stand-in.ts`, `stub.ts` |
| Photoreal images | Google (`GEMINI_API_KEY`) or fal.ai (`FAL_KEY`), `IMAGE_PROVIDER` picks | `stubImageProvider` in tests; with no key, "not available" | `lib/providers/image-stub.ts`, `select.ts` |
| Lifestyle scenes and try-on | Photoroom, Google, FASHN, fal (`LIFESTYLE_SCENE_PROVIDER`, `LIFESTYLE_TRYON_PROVIDER`) | Nothing is chosen by default; `stub` is a value | `lib/media/lifestyle/select.ts`, `stub.ts` |
| Image-to-video clip | fal (`FAL_KEY` and `MEDIA_VIDEO_LIVE=true`) | The stub, so a key for images alone never starts paid video | `lib/media/video/select.ts`, `stub.ts` |
| Pattern drafting | The Sialkot team (people); `PATTERN_PROVIDER=claude-bridge` for the owner's own session | Unset: patterns shown as not available | `lib/patterns`, `lib/pattern-service` |
| Courier | None yet | `manual`: typed courier and tracking number | `lib/ops/shipping/provider.ts` |
| Email | None built (Resend is the suggested choice, questionnaire 47) | No mail is sent | `docs/owner/questionnaire-2026-10-25.md` |
| Payment, cart, checkout | The Store | Not in this repo | |
| Bot check | Cloudflare Turnstile | Cloudflare's test keys locally and in CI; a deploy refuses them | `lib/config/env.ts` |
| 3D view | Trial code | Off unless `SHOW_3D=true` | decisions 0014, 0027 |
| Credit charging | The ledger | Off unless `CREDITS_ENFORCED=true`; the log records the would-be cost | decision 0051 |

Fixtures and seeds are labelled as made by Knitwright and not reviewed by a factory.

## Running it locally

You need Node 22.13 or newer (CI uses 24), pnpm 10 and Docker (for local Supabase).

```
pnpm install
cp supabase/.env.example supabase/.env
pnpm db:start        # starts local Supabase and writes apps/web/.env.local
pnpm dev             # http://localhost:3000
```

`apps/web/.env.example` lists every variable with its comment. `pnpm db:stop` stops the database; `pnpm db:reset` rebuilds it
from `supabase/migrations/`. Before sign-up opens, read `docs/launch/sign-up-switch.md`.

Checks, from the repository root:

| Command | Runs |
|---|---|
| `pnpm typecheck` | `next typegen` then `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | unit and PDF tests (vitest projects `unit` and `pdf`) |
| `pnpm test:cov` | all tests with coverage thresholds |
| `pnpm --filter web test:db` | database tests; need `pnpm db:start` first |
| `pnpm --filter web exec vitest run --project unit tests/architecture` | the source-reading architecture tests |
| `pnpm e2e` | Playwright against `pnpm start`, so run `pnpm build` first (`apps/web/playwright.config.ts`) |
| `pnpm build` | production build |
| `bash scripts/check-invariants.sh` | no tracked env file, no MCP in runtime code |

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every pull request. Every action is pinned to a commit.

| Job (name on GitHub) | Does |
|---|---|
| Secret scan and invariants | `scripts/check-invariants.sh`, then gitleaks over the history |
| Checks | install, `pnpm audit --prod --audit-level high`, local Supabase, the sign-in settings check, typecheck, lint, `test:cov`, build |
| End-to-end tests | install, local Supabase, build, Playwright with Chromium |
| Standard gate | passes only when Checks and End-to-end tests both passed |

Checks and End-to-end tests run side by side, each with a 35 minute limit.
