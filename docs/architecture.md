# Architecture map

How the Knitwright platform fits together: the app, the code areas and the workstream that built each,
the two panel contracts other code is written against, how a design becomes a factory package and then
an order, which providers are stand-ins, how this repository is actually worked on, and what CI runs.
Every path below exists in the repository.

Decision records are in `docs/decisions/` (index: `docs/decisions/README.md`, 106 records). Plan v4
built waves 1 to 5 (`plans/platform-v4.md`); **plan v5** (`plans/platform-v5.md`) built the thirty
workstreams of waves X, Y, Z, L and O that most of this map describes.

If you want to know what state the product is in rather than how the code is shaped, read
[`owner/README.md`](owner/README.md) first: the platform cannot place a real order today, for six
reasons, and that page is the list.

## Scope

This repository is the **platform**: the studio, the club and brand workspaces, the tech pack and the
factory files, the Launch content surface and the ops console. It does not hold the **Store** or
**Sell** storefront (cart, checkout, payment, team-store links, club sites).

Two doors connect them, both read or called from outside:

- `public.submit_order_for_production` — the Store hands a release and its quantities to ops
  (decision 0043). `public.submit_make_order` is the studio's own equivalent for a brand's run.
- the **Store contract**, a read-only payload of published products, media, sizes, tier prices in GBP
  and AUD, delivery dates, personalisation rules and size charts, under `app/api/store/**`. It is
  specified in [`store-contract-v2.md`](store-contract-v2.md) (decision 0106) — give that document to
  whoever builds the Store; it is not restated here.

`Sportswear/`, `kitwright/` and `supabase/config.toml` are not changed by platform work.

## Apps and layout

One app, `apps/web`: Next.js 16 and React 19, Supabase for Postgres, auth and storage (decision 0001).
The pnpm workspace is `pnpm-workspace.yaml` (`apps/*`).

| Path | What is there |
|---|---|
| `apps/web/app/` | Pages and routes. Route groups: `(auth)` sign-in and reset, `(onboarding)` welcome, `(app)` the signed-in product, `(admin)` platform-admin pages, `(ops)` the ops console. Also `legal`, `s/[token]` (share and committee links), `job/[token]` (the factory's own screen), `join/[token]` (roster sign-up), `collect`, `report-a-mark` and `unsubscribe`. |
| `apps/web/app/api/` | Route handlers, all made with `defineRoute` (95 `route.ts` files). |
| `apps/web/lib/` | The code that decides things, in plain TypeScript with unit tests beside it. 97 areas. |
| `apps/web/components/` | UI, 52 areas. |
| `apps/web/e2e/` | Playwright specs, 62 of them, one per area. |
| `apps/web/tests/architecture/` | Tests that read the source: every route and action is wrapper output, rate limits, page guards, ops access, bundle weight, motion, migration timestamps, the decision index, the documents. |
| `apps/web/tests/integration/` | Database tests against local Supabase (isolation, ledgers, ops, RLS, compliance, the Store contract). |
| `apps/web/scripts/` | `write-legal-docs.mts`, `eval-intake.mts`. |
| `supabase/migrations/` | 76 migrations: every table, policy and function, in timestamp order. |
| `docs/` | Decisions, owner documents, the build-pack spec, runbooks, launch records, reviews. |
| `plans/` | The build plans. Current: `plans/platform-v5.md`. |
| `scripts/` | `check-invariants.sh`, `check-auth-settings.mjs`, `write-local-env.mjs`, `write-decision-index.mjs`. |

Where the signed-in pages are:

| Area | Routes under `apps/web/app/` |
|---|---|
| Studio | `(app)/studio/(home)`, `(app)/catalogue`, and per design `(app)/studio/[projectId]` with `make`, `tech-pack`, `guide`, `kit-styles`, `layers`, `pattern-service`; plus `studio/new`, `start`, `charts`, `benchmarks`, `collections` |
| Launch | `(app)/launch` — the canvas shell, its boards and its panels |
| Teamwear and clubs | `(app)/teamwear`, `(app)/crest-to-kit`, `(app)/club`, `(app)/collect` |
| Brand | `(app)/brand`, `(app)/brands`, `(app)/brand-studio`, `(app)/templates`, `(app)/designer`, `(app)/credits`, `(app)/settings` |
| Platform admin | `(admin)/admin/settings`, `templates`, `leads`, `rulebook` |
| Ops | `(ops)/ops` with `batches`, `exceptions`, `orders`, `pattern-requests`, `review`, `factories`, `scorecard`, `settings` |
| No login needed | `s/[token]` share and committee links, `job/[token]` the factory's screen, `join/[token]` roster sign-up |

### Rules the code enforces

- **Server writes only.** Tables are brand-scoped with row level security. Browsers get no write
  grant; writes go through `defineRoute` / `defineAction` (`lib/server/`) and database functions the
  server's key alone may run.
- **Isolation by brand.** One brand never reads another's rows (`tests/integration/isolation.test.ts`).
- **No invented numbers.** A value a factory reads carries a source. Anything else is a labelled
  "Knitwright default", and missing owner input leaves a labelled default and an owner question rather
  than blocking.
- **Manufacturable by construction.** Structural values come only from a base article's approved
  options and parameter ranges, and the two panel contracts below make an invalid result impossible
  rather than merely checked.
- **Every rule explains itself.** Every finding, range, option and tech-pack field carries a `ruleId`
  resolving to a `rulebook_entries` row. A check with no entry carries `R-GAP-000` and is listed in its
  decision record.
- **AI never draws the garment.** AI output becomes parameters and layers, never pixels on a panel; a
  generated asset has no role but `"scene"`, so it cannot be written down as a panel layer or a print
  file (`lib/launch/assets.ts`), and tests prove it.
- **Deterministic files.** Generated PDFs and print files carry no date or random id, so the same input
  gives the same bytes.
- **Plain words.** `lib/copy/vocabulary.ts` and the wording tests — `lib/techpack/wording.test.ts`,
  `lib/ops/wording.test.ts`, `lib/crest-to-kit/wording.test.ts` (which fails on any sentence naming a
  Pantone number, because the platform holds no Pantone values).
- **No MCP at runtime** and no tracked environment file: `scripts/check-invariants.sh`.

## Two contracts other code — and another product — is written against

Three files are worth reading before anything else, because changing one of them changes work that is
not in front of you.

### `apps/web/lib/editor/slots.ts` — the editor slot contract (Y2, decision 0075)

The editor shell owns the top bar, the left rail, the canvas, the bottom bar and the Design Summary.
The seven panels inside it are built by other workstreams, and each is given exactly `EditorSlotProps`:
the design as read-only facts (`EditorDesign`) and the commands it may call (`EditorCommands`). Nothing
else crosses the seam. The seven slots are `library`, `specs`, `view-2d`, `tech-pack`, `export`,
`names-numbers` and `repeat-maker`; until one is built the shell draws `slotPlaceholder(id)`, which says
plainly who is building it.

**The point of it is that a panel cannot produce an invalid result.** Every entry of `EditorCommands` is
a *request*, never a write: the shell checks it against the article's approved options and ranges, saves
it, shows the save status and re-drafts. `setOption` takes a group and one of that group's approved
codes; `setParameter` is refused outside the article's approved range. So an unmanufacturable design is
not something a panel is trusted not to make — it is something a panel has no way to express.

Y3, Y4, Y5 and Y8 code against this file. It does not change without a loud note on the pull request.

### `apps/web/lib/launch/panels.ts` — the board panel contract (L1, decision 0091)

The same shape one surface over. The launch shell owns the icon rail, the right inspector, the prompt
pill and tool dock, undo and redo, the zoom, the credit balance and the canvas; the eighteen panels
(twelve rail panels, five board inspectors, one flow-run summary) are built by L2 to L6 and each is given
exactly `LaunchPanelProps`. It follows `slots.ts` deliberately, including the same principle, and names
the three invalid results it makes impossible:

- a connector the spec's board table does not allow — `connect` goes through `canConnect`;
- a paid run with no locked garment behind it — `requestRun` goes through `runnable`, which refuses a
  board no Design board feeds;
- a generated picture used as artwork — `offerAsset` takes a `LaunchAsset`, and a generated asset has
  no role but `"scene"`.

L2 to L6 code against this file; five workstreams depend on it.

### `docs/store-contract-v2.md` — the payload the Store reads (O2, decision 0106)

Written up in full in its own document, because it is a contract with a separate product. Read it
there.

## Code areas under `apps/web/lib/`, by workstream

The decision number is where to read why. Wave and workstream names are from `plans/platform-v4.md`
for the first five tables and `plans/platform-v5.md` for the rest.

### Foundation (the first build, before v4)

| Area | Purpose | Decision |
|---|---|---|
| `server`, `supabase`, `auth`, `config`, `monitoring`, `http` | request wrappers, sessions, environment contract, error monitoring | 0001, 0003, 0023 |
| `brands`, `storage`, `profile`, `deletion`, `leads`, `consent`, `legal`, `share` | accounts, brand isolation, files and quota, erasure, quote requests, marketing consent, share links | 0004, 0023 to 0026 |
| `garment`, `sizing`, `charts`, `units`, `flat`, `fabrics`, `pattern-library`, `cutting` | the garment contract and registry, sizes, flats, fabrics, pattern pieces, cut list | 0005, 0006, 0009, 0015 to 0017, 0029, 0030 |
| `projects`, `techpack`, `images`, `garment3d`, `usage`, `providers` | designs and versions, tech pack and exports, photoreal images, 3D trial, spend caps, model providers | 0007 to 0012, 0014, 0018 |
| `intent`, `guided`, `home`, `navigation`, `copy`, `forms`, `pagination` | assistant and test set, guided flow, plain words, shared UI logic | 0013, 0019 to 0022 |

### Production files, then v4 waves 1 to 4

| Workstream | Area | Decision |
|---|---|---|
| Production contract, print files, orders | `production`, `print`, `orders`, `releases`, `proofs` | 0028, 0031, 0032 |
| Artwork and generators | `artwork-stack`, `artwork-intake`, `design-import`, `pattern-generators` | 0035 to 0038 |
| V1 to V8 | `validation`, `garment/registry/teamwear`, `templates`, `clubs`, `workspace`, `ops`, `credits`, `guardrails`, `intent/golden` | 0039 to 0046 |
| W2-A to W2-G | `variants`, `kit-styles`, `design-diff`, `gltf`, `ops/qc`, `ops/packing`, `ops/shipping`, `credits-gate`, `panel-layers` | 0047 to 0053 |
| W3-A to W3-F | `media`, `media-check`, `settings`, `media/lifestyle`, `media/video` | 0054 to 0059 |
| W4-A to W4-F | `pattern-service`, `patterns`, `designers`, `brand-runs`, `comments`, `clubs/reorder` | 0060 to 0065 |

### Plan v5 wave 1 — foundation: the article, the rule, the geometry, the package (X1 to X8)

| Workstream | Area | Decision |
|---|---|---|
| X1 base article catalogue | `catalogue` | 0066 |
| X2, X2b rulebook and "Why?" | `rulebook`, `components/rulebook` | 0067 |
| X3, X3b graded parametric drafter | `parametric` | 0068 |
| X4 design object v2 and validation on every save | `validation`, `design-object` | 0069 |
| X5, X5b production package and the files-service seam | `kpp`, `files-service` | 0070 |
| X6 the factory model as data | `factory` | 0071 |
| X7 the factory job packet | `job-packet`, `app/job/[token]`, `app/api/job` | 0072 |
| X8 moderation and IP basics | `moderation`, `(ops)/ops/review` | 0073 |

### Plan v5 wave 2 — the Studio shell and its seven editor slots (Y1 to Y8)

| Workstream | Area | Decision |
|---|---|---|
| Y1 studio home, create-new modal, catalogue | `(app)/studio/(home)`, `(app)/catalogue`, `components/studio/home` | 0074 |
| Y2 **the editor shell and the slot contract** | `editor`, `components/studio/editor` | 0075 |
| Y3 2D pattern view and Library toolbar | `components/studio/editor/view-2d`, `.../library`, `panel-layers` | 0076 |
| Y4 Specs toolbar and tech pack view | `techpack/view`, `components/studio/editor/techpack-view`, `.../specs` | 0077 |
| Y5 the 16-page tech pack PDF and the Export panel | `techpack/exports`, `components/studio/editor/export` | 0078 |
| Y6 Brand Studio, typed by hand | `brand-studio`, `components/brand-studio` | 0079 |
| Y7 make: product created, samples, golden samples, the order modal | `make`, `components/make` | 0080 |
| Y8 names and numbers, the repeat maker, Share | `repeat`, `share/invites.ts`, `components/studio/editor/names-numbers`, `.../repeat-maker` | 0081 |

### Plan v5 wave 3 — Inspire, intelligence, Teamwear, compliance (Z1 to Z9)

| Workstream | Area | Decision |
|---|---|---|
| Z1 the inspiration board | `inspiration` | 0082 |
| Z2 Ask and best practice | `rulebook/ask` | 0083 |
| Z3 benchmarks | `benchmarks` | 0084 |
| Z4 the collection plan and the line plan | `collections` | 0085 |
| Z5 the teamwear configurator | `teamwear` | 0086 |
| Z6 crest-to-kit and the quote PDF | `crest-to-kit`, `quotes`, `colour` | 0105 |
| Z7 committee link v2 and roster sign-up | `share/committee`, `clubs/signup`, `app/join/[token]` | 0087 |
| Z8 compliance and one pre-export checklist | `compliance`, `techpack/labels.ts` | 0089 |
| Z9 the remaining base article data | `catalogue/seed`, `parametric/articles` | 0090 |

### Plan v5 wave 4 — the Launch surface (L1 to L8)

| Workstream | Area | Decision |
|---|---|---|
| L1 **the launch shell, its boards and the panel contract** | `launch`, `components/launch` | 0091 |
| L2 the mockup studio, deterministic and live-linked | `mockups` | 0092 |
| L3 AI scenes and shoots with the garment locked | `shoots` | 0093 |
| L4 the marketing studio | `marketing` | 0094 |
| L5 the video studio | `media/video` (extended), `components/video` | 0095 |
| L6 flows | `flows` | 0096 |
| L7 brand import from a URL | `brand-studio/import` | 0102 |
| L8 the template library to the launch counts | `templates/seed`, `templates/kinds` | 0098 |
| — the rail panels L1 left unowned | `launch-panels` | 0108 |

### Plan v5 wave 5 — ops completion, the Store contract, Australia (O1 to O3)

| Workstream | Area | Decision |
|---|---|---|
| O1 ops completion: the scheduled cut, the AQL table, ΔE at QC, the commercial invoice, couriers, status emails, the factory scorecard | `ops/*` (extended), `ops/aql`, `ops/inspection`, `ops/notify`, `app/api/cron/ops-cut-batches` | 0100 |
| O2 the Store contract v2 | `store-contract`, `app/api/store` | 0106 |
| O3 Australia and Translate: the AUD ladder, the GST trigger as data, Australia's labels, the tech pack in Urdu | `markets`, `translate` | 0104 |
| — the studio top bar | `shell`, `components/shell` | 0103 |
| — the option-code map, the bill of materials | `option-codes`, `kpp/sources/consumption.ts` | 0099, 0101 |
| R1 to R3 review and hardening | reports to `docs/reviews/` (`security-v5.md`, `code-v5.md`, `coverage-v5.md`) | — |
| R4 documentation | this map, the README, the owner guide, the checklist | 0115 |

## Data flow: from a design to a package to an order

1. **Start.** A person starts from a sentence, a sketch, a template, a club kit, a crest
   (`lib/crest-to-kit`), a competitor's product (`lib/benchmarks`), a moodboard (`lib/inspiration`) or
   their own website (`lib/brand-studio/import`). Every one of those routes lands on the same thing: a
   **base article** from the catalogue (`lib/catalogue`, decision 0066), which is the makeable block
   with its sizes, its points of measure with grades and tolerances, its parameters with
   factory-approved ranges, its option codes, its allowed fabrics and its construction table.
2. **Edit.** The editor shell (`lib/editor`) gives each panel the design and a set of commands it may
   ask for. A structural choice is an approved option code or a parameter inside an approved range, so
   the design object cannot hold a value the article does not offer. Every edit saves a new version
   (`lib/projects`, decision 0007) and is validated on the way in (`lib/validation`, decision 0069).
3. **Draft.** The graded parametric drafter (`lib/parametric`, decision 0068) turns the article and the
   form into pattern pieces for every size. Every number it draws with lives in `draft-constants.json`,
   labelled and sourced; a test asserts the only literals left in the drafting layer are 0, 1 and 2. An
   article with no constants answers "not drafted yet" rather than falling back on a default.
4. **Check.** Guardrails (`lib/guardrails`) flag dpi, bleed, safe zone, seam crossings and colours the
   print cannot reach. Moderation (`lib/moderation`, decision 0073) screens uploads and text. The one
   **pre-export checklist** (`lib/compliance/checklist.ts`, decision 0089) is the F-G2 list, and it has
   exactly one implementation read through three adapters — the tech pack's Review tab, the production
   package, and ordering — so a design the Review tab calls clear cannot fail at hand-off for a reason
   Review never showed.
5. **The tech pack.** `lib/techpack` is one view of the design: measurements, construction notes,
   artwork, labels, and a source on every value. The PDF is sixteen pages and the Excel file eleven
   sheets (decision 0078). Exports go through the Export panel.
6. **The production package.** `lib/kpp` (decision 0070) assembles the whole folder a factory receives —
   tech pack, 1:1 print files per piece per size, pattern DXF, the bill of materials with consumption
   (decision 0101), labels, the quality plan — behind one gate that refuses a package with a field still
   needing input, a `[TBC]`, an incomplete point of measure or bill of materials, a colour outside the
   gamut, or a label line with no source. Big or model-backed file work goes through the
   **files-service seam** (`lib/files-service`), an interface rather than a service, so the heavy half
   can move out of the request without the callers changing.
7. **Sample and golden sample.** A brand orders a sample, the factory makes it, and a **golden sample**
   is signed off against a design version (`lib/make`, decision 0080). A run cannot be placed without
   one: `submit_make_order` refuses with `golden_sample_required`, and a carry-over from a parent
   version exists only where the two versions differ on the surface alone.
8. **Team order and release.** A club's roster becomes a team order (`lib/orders`); a roster can be
   pasted, imported or collected through a sign-up link (`lib/clubs/signup`, decision 0087). A
   **release** freezes the design version, the team list hash and the file settings, with hashes, so the
   files can be rebuilt and compared later (`lib/releases`, decision 0032). A committee approves with a
   name and a date and a kit manager locks the version (`lib/share/committee`).
9. **Hand-off.** The Store calls `public.submit_order_for_production`; a brand's own run calls
   `public.submit_make_order`. The wrapper is `lib/ops/contract.ts`. The Store's read side is the Store
   contract (decision 0106).
10. **Ops.** The order waits for the weekly cut-off, which a cron route cuts
    (`app/api/cron/ops-cut-batches`), goes into a batch, and gets a factory sheet and a print-files ZIP.
    Ops records factory status, QC with typed ΔE readings against the fabric's own tolerance, packing,
    shipping, exceptions and a commercial invoice, and keeps a scorecard per factory (decision 0100).
11. **The factory never logs in.** It gets a **job packet**: one tokenised link per batch, sent by
    WhatsApp or copied by ops, opening `job/[token]` — the pieces, the sizes, the names, the bill of
    materials and the files, never a price (`lib/job-packet`, decision 0072).
12. **Launch.** Once a design exists, the Launch canvas (`lib/launch`) turns it into content: mockups
    from the 3D model, AI scenes with the garment locked, marketing layouts, video, and flows that run a
    whole pack of assets in one go. The garment is always locked — every image starts from the
    deterministic render or the golden-sample photo, and `lib/media-check` rejects drift.
13. **Reorder.** A club reorders from its order history (`lib/clubs/reorder`); a new team order results
    and goes through steps 8 to 11 again.

Sideways: pattern requests for garments the library cannot draft go to ops (`/ops/pattern-requests`,
decision 0060); credits are a ledger beside all of it (`lib/credits`, decision 0044); platform settings
(`lib/settings`) feed credits, ops, the factory profile and guardrails (decision 0056); and `lib/markets`
and `lib/translate` decide what a market may be sold in and in which language the tech pack prints
(decision 0104).

## Where providers are stubbed

Nothing reaches a paid service without a key. Without one the feature says it is not available, or a
stand-in answers.

| Service | Real provider | Stand-in or default | Where |
|---|---|---|---|
| Assistant text and image reading | Anthropic or OpenAI (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) | `AI_PROVIDER_STUB=on` answers without the network, for browser tests only; refused where real people sign in | `lib/providers/stand-in.ts`, `stub.ts` |
| Photoreal images | Google (`GEMINI_API_KEY`) or fal.ai (`FAL_KEY`), `IMAGE_PROVIDER` picks | `stubImageProvider` in tests; with no key, "not available" | `lib/providers/image-stub.ts`, `select.ts` |
| Lifestyle scenes and try-on | Photoroom, Google, FASHN, fal (`LIFESTYLE_SCENE_PROVIDER`, `LIFESTYLE_TRYON_PROVIDER`) | Nothing is chosen by default; `stub` is a value | `lib/media/lifestyle/select.ts`, `stub.ts` |
| AI shoots with a model in them | The four picture providers above, behind `MEDIA_SHOOTS_LIVE` | Off. No preset holds a licence reference either (decision 0093 question 1) | `lib/shoots` |
| Image-to-video clip and AI video | fal (`FAL_KEY` and `MEDIA_VIDEO_LIVE=true`) | The stub, so a key for images alone never starts paid video | `lib/media/video/select.ts`, `stub.ts` |
| Stock photography | Unsplash (`UNSPLASH_ACCESS_KEY`), Pexels (`PEXELS_API_KEY`) | No key: the source is not offered | `lib/inspiration` |
| Pinterest boards | `PINTEREST_APP_ID` and a flag | Off | `lib/inspiration` |
| Pattern drafting by hand | The Sialkot team (people); `PATTERN_PROVIDER=claude-bridge` for the owner's own session | Unset: patterns shown as not available | `lib/patterns`, `lib/pattern-service` |
| Courier | None yet | `manual`: typed courier and tracking number | `lib/ops/shipping/provider.ts` |
| Third-party inspection | None yet | A stub: nothing is booked, no price and no turnaround shown | `lib/ops/inspection` |
| Email: share invites | Resend (`SHARE_EMAIL_PROVIDER`, `SHARE_EMAIL_KEY`, `SHARE_EMAIL_FROM`) | Without all three, nothing is sent and the member is shown the link to send themselves | `lib/share/email-server.ts` |
| Email: customer status | Resend (`OPS_EMAIL_PROVIDER`, `OPS_EMAIL_KEY`, `OPS_EMAIL_FROM`) | Without all three, nothing is sent; a record of why is kept either way | `lib/ops/notify` |
| Lead notices | None built | One info line in the server log, naming ids and numbers only | `lib/leads/notify.ts` |
| Factory messaging | WhatsApp Cloud API | Plain text through the adapter; outside the 24-hour window Meta needs an approved template, so ops copies the link | `lib/job-packet/notify.ts` |
| Payment, cart, checkout | The Store | Not in this repository | — |
| Bot check | Cloudflare Turnstile | Cloudflare's test keys locally and in CI; a deploy refuses them | `lib/config/env.ts` |
| 3D view | Trial code | Off unless `SHOW_3D=true` | decisions 0014, 0027 |
| Credit charging | The ledger | Off unless `CREDITS_ENFORCED=true`; the log records the would-be cost | decision 0051 |

Fixtures and seeds are labelled as made by Knitwright and not reviewed by a factory. No test ever makes
a live paid call, and no test emails anyone.

## How this repository is worked on

This is unusual, and the next person will get it wrong without reading it. Each item below cost
somebody a day.

### One shared local Supabase, which nobody may restart

There is **one** local Supabase on the fixed ports `supabase/config.toml` pins (54320 to 54324), shared
by every session working in this repository at once. So:

- **Never run `pnpm db:start`, `pnpm db:reset` or `pnpm db:env`**, and never `podman`/`docker` against
  it, unless you are the only person working. A reset destroys every other session's fixtures.
- **Never edit `supabase/config.toml`.**
- To apply migrations that landed after it started:
  `supabase migration up --local --include-all`. `--include-all` is needed because the plan assigns
  migration timestamps per workstream and workstreams land in parallel, so a new migration is routinely
  *older* than the last one applied; without the flag it is skipped in silence.
- Your fixture shares the database with every other spec. Anything you create from a grouping key
  another spec also uses lands on *their* row — `ops_cut_batches` groups by factory, fabric, article and
  cut-off and reuses a batch it has already cut, so vary the key with your own fabric per test. Make
  anything you filter a locator on unique per run too: CI retries once, and a retry that finds its own
  leftover row fails exactly like the attempt before it.
- In CI, reserve the ports before starting the stack:
  `sudo sysctl -w net.ipv4.ip_local_reserved_ports=54320-54324`. All five sit inside the kernel's
  ephemeral range, so `pnpm install`'s hundreds of outbound connections can be handed one as a source
  port, and the container then cannot bind it. That cost three full re-runs on 2026-11-02 before anyone
  worked out it was not a flake.

### The local run, start to finish

```
systemctl --user start podman.socket
export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock
cp supabase/.env.example supabase/.env     # TURNSTILE_SECRET_KEY: without it every sign-in fails
                                           # and every guarded page answers 404
pnpm install
pnpm db:start                              # only if nothing is running; otherwise: supabase migration up --local --include-all
export OWNER_EMAIL=you@example.com         # set by hand; the owner-only paths read it
pnpm --filter web build
pnpm --filter web e2e <your spec>
```

Podman works. Earlier briefs said "no Docker"; that was wrong, and wave 1 paid for it in pull requests
whose database and browser tests had never once been run.

### The browser tests are off the per-pull-request gate

They are the slowest job (about 13 minutes) and the whole account shares a pool of runners: with half a
dozen branches in flight they queued for an hour without starting, so a finished branch could not be
confirmed green. Since 2026-11-02 they run on `main` after a merge, and on a pull request only when it
carries the **`e2e` label** or someone starts the workflow by hand.

**Pass the label when you open the pull request — `gh pr create --label e2e` — not afterwards.** The job's
`if` is evaluated when the run starts, and nothing re-evaluates it, so a run already in flight stays
skipped however the label arrives later.

They are not skipped, only moved: a failure on `main` blocks the next merge and names the one merge that
caused it. So write them with the same care.

### `docs/decisions/README.md` is generated. Never edit it

Its table is written from the records by `node scripts/write-decision-index.mjs`. Write your record with
an `Index:` line (a shorter reading of its state than `Status:`) and an optional `Index title:` line,
then run the script. `tests/architecture/decision-index.test.ts` runs the generator's own `--check`, so a
stale index fails locally in a second.

It used to be edited by hand, which is how decision **0080** came to be written, merged and never indexed
at all.

### Two guards on identifiers, and why they exist

Three pairs of workstreams collided on an identifier **in one day**, 2026-11-02, each pair correct alone
and green alone, and one pair reached `main`:

| Collision | What broke |
|---|---|
| L2 and L4 both chose migration hour `20261201060000` | Applying both failed with `duplicate key value violates unique constraint "schema_migrations_pkey"` — which surfaced only after one had merged, as a CI failure on the other that looks nothing like its cause. |
| O3 and the top-bar change both took decision number `0103` | Caught before merge. |
| Z5 and Z7 both took decision number `0086` | **Reached `main`** and put two rows with the same number in the index. |

So:

- `tests/architecture/migration-names.test.ts` fails on two migrations sharing a 14-digit timestamp, or
  sharing a name after it, and its message names *both* files — the branch that reads the failure is
  usually not the branch that wrote the other one.
- `tests/architecture/decision-index.test.ts` fails on two records taking the same number, and on any
  numbered record missing from the index.

A workstream needing a migration the plan does not list takes its wave's date with the next free hour and
says so in the pull request. A workstream writing a record takes the next free number — and checks
`ls docs/decisions/` first, because another branch in flight may have taken it without being visible.

### Shared files take the union

`apps/web/tests/integration/isolation.test.ts` (the table lists), navigation, `lib/copy/vocabulary.ts`,
`lib/garment/spec-schema.ts`, `lib/settings/registry.ts`. Add only your own entry. Before your final
push, `git fetch origin && git merge origin/main`; on a conflict keep the **union** of both sides. New
tables go into the isolation test's lists in the existing shape.

Two of these were changed so they stop conflicting: `apps/web/vitest.config.mts`'s per-directory coverage
thresholds were one line of about a thousand characters that every workstream appended to, so every pair
of branches fought over it. It is now one name per line in alphabetical order, kept that way by
`tests/architecture/coverage-config.test.ts`. Add your name in its sorted place and nothing else.

### Interfaces before the other side exists

When a workstream's section says "through an interface", it defines the smallest TypeScript interface in
its own directory with a test double and depends on that; the orchestrator wires the real implementation
in a later wave. Nothing imports from another workstream's unmerged directory. `lib/validation/live-ports.ts`
is what that wiring looks like once both sides have landed.

### Commit and push after every step

Two orchestrator sessions died mid-wave. The first took eight agents' uncommitted work with it,
recoverable only out of `.claude/worktrees`; the second left a finished workstream unpushed, and it sat
invisible until someone went looking. A crash should cost one step, not a workstream.

## Running the checks

| Command | Runs |
|---|---|
| `pnpm typecheck` | `next typegen` then `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | unit and PDF tests (vitest projects `unit` and `pdf`) |
| `pnpm test:cov` | all tests with coverage thresholds (80% overall, 90% on new `lib/` directories) |
| `pnpm --filter web test:db` | database tests; need a running local Supabase |
| `pnpm --filter web exec vitest run --project unit tests/architecture/` | the source- and document-reading architecture tests |
| `pnpm e2e` | Playwright against `pnpm start`, so run `pnpm build` first (`apps/web/playwright.config.ts`) |
| `pnpm build` | production build |
| `bash scripts/check-invariants.sh` | no tracked env file, no MCP in runtime code |
| `node scripts/write-decision-index.mjs` | regenerates `docs/decisions/README.md` (`--check` to verify only) |

## CI

`.github/workflows/ci.yml` runs on pushes to `main`, on every pull request, and on request
(`workflow_dispatch`). Every action and image is pinned to an exact commit or digest, so a tag moved
later cannot change what runs. Dependabot proposes the updates.

| Job (name on GitHub) | Does |
|---|---|
| Secret scan and invariants | `scripts/check-invariants.sh`, then gitleaks over the whole history |
| Checks | install, `pnpm audit --prod --audit-level high`, reserve the Supabase ports, start local Supabase, the sign-in settings check, typecheck, lint, `test:cov`, build |
| End-to-end tests | the same setup, then build, install Chromium and run Playwright. **Only on `main`, on a pull request carrying the `e2e` label, or by hand.** The report is kept as an artifact on failure. |
| Standard gate | the one name to require. Passes when Checks passed and the browser tests passed *if they ran*: `skipped` is accepted because the job is deliberately off the pull-request gate, while `failure` and `cancelled` still fail the gate. |

Checks and End-to-end tests run side by side, each with a 35 minute limit; together in one job they took
about 25 minutes, which slow runners pushed past the limit.
