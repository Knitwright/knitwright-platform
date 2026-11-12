# Plan v6: the platform rebuilt to build pack v3.9 (the Kittl shell), with the Store inside

Status: ACTIVE. Written 2026-11-12 by the orchestrating session.
Spec: `docs/spec/` (build pack **v3.9**, 9 Nov 2026). For UI, read `docs/spec/README.md`, then `10-design-system.md`
(exact values), `08-ui-kittl-shell.md` (per screen, newest block at the top), `09-screen-map.md` (every screen, its route
and feature IDs) and `prototype/index.html`. Open it in a browser, or read the source; `?shot=<name>` opens any state.
**The reference images are not in git.** They are at
`/home/scorpius/Knitwright/knitwright-platform/knitwright-build/references/prototype-screens/` (109 renders of our
screens, the target) and `.../references/screens/` (136 Kittl, Printify and Fabra screenshots, the feel). The Read tool
opens PNGs. Index: `docs/spec/references/prototype-screens/INDEX.md`.
Behaviour, data, rules and acceptance tests: `docs/spec/02-features.md`, unchanged from v2.2.
Builds on: `plans/platform-v5.md` (all 30 workstreams merged). Its rules and lessons still apply except where this file
says otherwise.

## Owner decisions for v6 (2026-11-12, decision 0131)

1. **The v2.2 UI is replaced.** Every screen copies the prototype's layout. Values come from `10`, behaviour from `02`.
   - Where the prototype and `02` disagree on layout, the prototype wins.
   - Where they disagree on behaviour, `02` wins.
2. **v3.9 overrules "the Store stays separate".** Checkout, team stores, club pages, storefronts, drops, sales channels,
   payouts and financial controls are built here (wave 5). Spec decision 1 still holds: Knitwright is principal and
   merchant of record, with no escrow and no factory marketplace.
3. **v5 decision 4 still holds:** keep the existing data model and add beside it. Supabase stays.
4. **No logos, artwork, template content or marketing copy from Kittl, Printify or Fabra.** Copy layout and interaction
   only (README rule).

## Where we start (gap audit, 2026-11-12)

- **UI:**
  - none of the v3 shell exists (rail, top bar, help bubble, tokens, component library);
  - of the 33 screens, a handful have v2.2 equivalents and the rest are missing;
  - the studio editor and the launch canvas are two shells with two data models, and there are no Garment, Tech pack or
    Order boards.
- **Behaviour defects** that do not depend on the UI:
  - validation does not gate ordering;
  - flows run on the stub in production;
  - the 3D view gets an empty print atlas;
  - the inspiration ports are unwired in production;
  - the erasure register misses five tables;
  - there is no roster purge;
  - template seeding is not in the deploy path.
- **Content and data:**
  - only JSY-SS-01 is drafted, and the other seven articles need the factory's pattern master;
  - no artist 3D models;
  - 5 mockup scenes missing;
  - HS codes for 7 articles.
- **Owner-blocked (unchanged):** ISO 3758, the AUD ladder, QC and freight days, the pattern master's name, Pantone
  data, licensed model presets, the hosted deployment, legal.
- **New owner actions (from 0131):** a Stripe account and Connect, a Shopify Partner app, plan prices, the refund reserve.

## How to use this plan

Each workstream is one local agent in its **own worktree**, on one branch `feat/v6-<id>-<slug>` cut from `main`, with
one PR into `main`. The orchestrator merges one PR at a time. Before code, read:

1. `plans/platform-v5.md` › "Rules every workstream follows" and "Lessons". Where they mention the Store, this file
   wins.
2. `apps/web/AGENTS.md`: this Next.js is not the one in your training data.
3. Your section below, the spec files it names, and the prototype states it names.

**Rules added in v6:**

- **Database:** there is one local database. Do **not** run `podman`, `pnpm db:start`, `db:reset` or `db:env`. Your
  local gate is install, typecheck, lint and unit tests. Write db and e2e tests with care; CI runs them.
- **Primary tree:** leave alone any file in the primary checkout that is not yours. Never `git checkout`, `switch` or
  bare `stash` there.
- **Identifiers:** use only your **assigned** decision number and migration hours (tables below). Never "the next
  free".
- **UI tickets meet `10` §11 (Definition of done):**
  - tokens only, with no raw hex or px outside `globals.css`;
  - every state from §9 (loading, empty, error, no-permission, premium);
  - keyboard and focus;
  - 1440 × 900 matches the reference image.

  Attach a side-by-side screenshot where the page renders without the database (component fixtures at `/dev/ui`).
  Otherwise say in the PR that the screenshot is owed to the orchestrator.
- **A moved screen keeps its behaviour.** When you move a v2.2 page into a v3 route:
  - redirect the old route (308);
  - keep its server actions and tests;
  - update the e2e specs and `tests/architecture/mounted.test.ts` entries that name it;
  - never leave a built feature with no door (the v5 reachability rule).
- **Commits:** commit and push after every step. Author: `Sameed Ilyas <127698326+SameedIlyas@users.noreply.github.com>`.

---

# Wave 0: behaviour defects (parallel, now; independent of the UI)

## D1. Validation gates ordering (F-0, F-T7, F-G2) · decision 0132 · migration `20261220010000`
- **Owns:** `lib/make/**`, `lib/brand-runs/**` (only the order gate), `lib/compliance/from-order.ts`, the
  `submit_order_for_production` function (new migration), `components/production/validation/**`.
- **Acceptance (F-0):** "An invalid design cannot be ordered or exported. The UI lists each failing check with 'Why?'
  and 'Fix' links." Concretely:
  - sample, run, brand run, release and `submit_order_for_production` refuse on any `error` finding of the version's
    validation;
  - the F-G2 checklist runs at order through `subjectForOrder`;
  - an ordered version is marked `ordered`, and editing it makes a new draft;
  - the findings list shows the finding's `action` as a Fix link;
  - `DESIGN_STATUSES` in `lib/production/contract/validation.ts` agrees with the database (`approved`).
- **Also:** list the 32 codes that map to `R-GAP-000` in the PR. Do not invent rule text. Add a test that fails if a
  new code is added without an entry or an explicit gap listing.

## D2. Flows run real capabilities (F-L4) · decision 0133
- **Owns:** `lib/flows/**`, `components/launch/LaunchShell.tsx` and `useLaunchShell.ts` (only the action wiring).
- **Wire the registry in `runFlowForBrand`:**
  - deterministic mockup (L2) and marketing render (L4) always;
  - AI scene (L3) and AI video (L5) through their existing adapters, which stay behind `MEDIA_SHOOTS_LIVE` /
    `MEDIA_VIDEO_LIVE`, with the stub kept as the fallback when the flag is off;
  - the run panel note says which kinds are live.
- **Board buttons:** Remove background, Remix and Generate video either run their action or are removed. A button never
  only selects.
- Wire AI image and video board runs (`useLaunchShell.ts`), which today say "the panel that runs it is not built yet".

## D3. The 3D texture is the print file (principle 3) · decision 0134
- **Owns:** `components/studio/editor/View3D.tsx`, `components/studio/editor/export/Preview.tsx`, `components/gltf/**`,
  `lib/gltf/**`.
- Pass the real panel pictures, rendered from the same panel artwork the print files use, to `ModelViewer` instead of
  `{}`.
- Add a test that the atlas a model receives is byte-identical to the panel layout's print images for a fixture design.
- `SHOW_3D` stays as it is (artist models are an owner input). The placeholder model must show the real atlas.

## D4. Inspiration and suggestions wired in production (F-S1) · decision 0135
- **Owns:** `lib/inspiration/**`.
- Pass real ports in `lib/inspiration/actions.ts` and `server.ts`:
  - the Knitwright library source;
  - the brand's mood words;
  - article sport tags;
  - card screening through moderation;
  - suggestion validation with the parameter-range and moderation checks.
- Pinterest stays off until an OAuth app exists. Make "off" a setting, not a `null` literal, and record the owner
  question.

## D5. Privacy and deploy housekeeping · decision 0136 · migration `20261220020000`
- **Owns:** `lib/deletion/**`, `lib/clubs/roster-retention/**` (new), `lib/templates/seed/**`,
  `lib/marketing/templates/run.mts`, `docs/runbooks/**`.
- **Erasure register:** add the five Z7 tables to `lib/deletion/team-data.ts`, with a test that every table holding an
  email or name column is listed.
- **Roster purge:** purge rosters older than two seasons (`05` security), as a cron route behind `CRON_SECRET`, with a
  database test.
- **Seeding:** template, bundle, tech-pack and marketing seeding become one idempotent command
  (`pnpm --filter web seed:templates`) named in `docs/runbooks/supabase-hosted.md`.
  - **Do not edit that runbook's uncommitted local changes in the primary tree.** Your worktree starts from `main`.
  - Add a test that the seed is idempotent.

---

# Wave 1: UI foundation (U1 now, in parallel with wave 0; U2 after U1 merges)

## U1. Design system and component library (`10` in full) · decision 0137
- **Owns:** `apps/web/app/globals.css`, `components/ui/**`, `app/dev/**` (new; 404 in production unless
  `DEV_UI_ROUTES=on`), `package.json` (adding `lucide-react` and Inter via `next/font`).
- **Tokens:**
  - colour (brand, neutrals, status, tech-pack marks) from `10` §2–§7;
  - Inter with cv11 and ss01;
  - the type scale, spacing, radius, elevation and motion;
  - a **light** theme. `10` has no dark mode, so the dark glass theme goes, along with `Aurora`, glass and thread
    utilities once nothing uses them.
- **Existing pages must keep rendering legibly on the light tokens.** Map the old token names (`--canvas`, `--ink`,
  `--cobalt`, …) to the new values in one place. Do not restyle pages; that is waves 2–4.
- **Components, every state in `10` §8:**
  - buttons: primary, secondary, premium, ghost, danger, link; lg/md/sm/xs; loading; disabled with a tooltip;
  - inputs: text, search, number with unit, select, segmented, toggle, checkbox, radio;
  - Tabs (underline and pill), FilterChip, StatusPill, Tag/Badge, Menu, Popover, Modal (480/720/960), Toast + a toast
    provider, Tooltip, Card variants, Table, Skeleton;
  - page-state components (`10` §9): Empty, Error with Retry and request ID, NoPermission, PremiumGate (♛);
  - KW coin and ♛ marks.
- **`/dev/ui`:** shows every component in every state. Its screenshot is the PR's evidence. Unit tests for behaviour
  (keyboard, focus trap, toasts).

## U2. Dashboard shell and the route map (`09` Global shell, `08` §2–§3) · decision 0138
- **Starts after U1 merges.**
- **Owns:** `components/shell/**`, `lib/shell/**`, `app/(app)/layout.tsx`, new route folders as **placeholders only**
  (each renders its title and the standard Empty state):
  - `/projects`;
  - `/ai-studio`, `/ai-studio/agent`, `/ai-studio/workflows`, `/ai-studio/workflow/[id]`, `/ai-studio/image`,
    `/ai-studio/video`;
  - `/mockups`, `/marketing`;
  - `/products`, `/products/[code]`;
  - `/orders`, `/store`, `/team`, `/settings`.
- **The shell:**
  - 96 px rail: Create popover, AI Studio, Templates, Mockups, Marketing, Products, Projects, ⌄ for Orders / Store /
    Team (clubs only), Help, ⋯, avatar;
  - 72 px top bar: Brand pill with gold New, page tabs slot, ⊕, Upgrade, avatar menu (the v5 account-menu items move
    here);
  - help bubble.
- **The Create popover's items route to what exists today** (studio new, crest-to-kit, launch, templates).
- **Route conflict:** `/brand` today is the product-runs page. Move it to `/orders/runs` with a redirect, and make
  `/brand` redirect to `/brand-studio` until P6 takes it over.
- Supersedes decision 0103's top bar.
- e2e: the shell's rail reaches every placeholder. Update `mounted.test.ts`.

---

# Wave 2: dashboard pages (parallel, after U2 merges)

Each owns its route folders, its components folder `components/<area>/v3/**`, and its e2e specs. Each moves the v2.2
page it replaces, with a redirect.

## P1. Projects (screen 14, d01–d06) · decision 0139 · migration `20261222010000`
- Recent (the v3.6 home), Projects, AI Creations; sub-tabs Projects, Folders, Shared, Trash; sort and search.
- New data: `project_folders`, soft delete with Trash and restore, shared-with-me from invites. Launch projects and
  studio projects listed together (one card type, with a kind tag) until E1 unifies them.

## P2. Templates, Mockups, Marketing (screens 7–9, d13–d15) · decision 0140
- Template rows and sport tabs over the existing template library.
- `/mockups` over `lib/mockups`: Use a product, categories, colourway, bulk download.
- `/marketing` over `lib/marketing`: featured concepts, ad gallery, Create an ad, Plan a launch pack.

## P3. AI Studio (screens 2–6, d07–d12, the workflows table in `09`) · decision 0141
- Workflows hub, Creative Agent (over the existing chat and Ask), and the workflow page format (form + Output example +
  Generate n).
- Each launch workflow in `09` gets a page wired to what exists.
- Missing workflows are built where deterministic: Retro kit remix, Change kit colour, Resize for all socials.
  Flat-lay, Try-on video and Remove background run behind their provider flags with the stub fallback.
- Image and Video generator tabs reuse the launch board panels.

## P4. Products (screens 10, 11, 22, 26, 28-configurator, p01–p08) · decision 0142
- Catalogue home, category page, product detail (decoration tabs, Made by Knitwright, Fulfilment, cm/in guide, price
  ladder, Frequently bought together), product configurator modal with 🔒 for unsampled options, My products, Trending
  ideas, Fabrics.
- **Design this** must open the editor on that base with the chosen options. Fix the dead link.
- Order swatch book is a button that creates a swatch order once C1 lands. Until then it uses the Empty "coming" state
  with no fake flow.

## P5. Orders (screens 15, 32, 33, p09–p13) · decision 0143
- Customer `/orders` with tabs Orders, Samples, Collection plans, Quotes; status pills; empty state.
- Order detail: tracking timeline, customer-visible QC photos, locked version + tech pack.
- Collection plans and the range plan board (one column per drop, MOQ, target cost, + Add style) move from
  `/studio/collections`.
- Payment status columns read C1's tables once they exist. Until then they show the ops status only.

## P6. Team, Brand, Settings, plans modal (screens 17–19, 29, d16–d19, e42) · decision 0144
- `/team` (Roster, Approvals, Seasons) from `/club` and the committee pages.
- `/brand` (empty and filled, the Kittl layout) from `/brand-studio`.
- `/settings`: Account, Plan & billing, Get more credits, Members, Units with mm, cm and in (a stored preference).
- Upgrade / Choose your plan modal: plans and prices as config rows labelled placeholder; purchase is wired in C1.

---

# Wave 3: the editor, one canvas (`08` §5, screen 12–13, e01–e44)

## E1. One infinite canvas (alone; the others wait for it) · decision 0145 · migration `20261224010000`
- **Unify the studio editor and the launch canvas into one `/project/[id]` canvas:**
  - pan and zoom on an infinite plane;
  - boards, connectors and selection;
  - one board model that adds the kinds `garment`, `tech_pack` and `order` beside the launch kinds.
- A garment board wraps a studio project's spec version. It is still the design object, validated as today.
- Migrate existing launch projects and studio projects into the unified model, or link them. Write the mapping down.
- Old routes redirect into the canvas.

## E2–E5 (parallel, after E1)
- **E2. Editor chrome** · 0146
  - labelled rail and flyouts (Products, Templates, Text, Illustrations, AI Gallery, Mockups, Uploads, More, Learn,
    Layers, Help);
  - right panel (Share · Export · Order, Project Colors, Tools);
  - task bar with "n more";
  - 4-group dock;
  - ≡, zoom and context menus;
  - shortcuts (`08` §5.8).
- **E3. Garment board and inspector** · 0147
  - the garment inspector (Product, Options, Colourways, Names & numbers, Checks with Why?, Price);
  - text, image, group, illustration and mockup inspectors;
  - mockup edit mode;
  - Product info modal.
- **E4. Tech pack board, Order board and Order drawer** · 0148
  - Sample, Run, Team store, Quote PDF. Checkout lands in C1.
  - Export popover (artboard checklist, formats).
  - Share popover (Invite incl. the factory-desk member, Publish, View presentation).
- **E5. Prompt bar and pickers** · 0149
  - prompt bar modes (Agentic, Image, Video, Ask Knitwright), model, aspect, count, video mode;
  - the + menu (Browse Styles, Prompt builder, Prompts);
  - font picker, colour picker (Color / Brand);
  - Choose Artboard Size with a Products tab;
  - version history panel;
  - error toast states with credits refunded.

# Wave 4: Fabra Garment Studio and tech pack (screens 27–31, s01–s19, x01–x08)

- **G1. Garment Studio** · 0150
  - `/studio/[designId]` to the v3.6 layout: library column and panels, 3D stage pills, Fit checked, Design summary;
  - Export panel tabs and the 8-item checklist;
  - beta welcome;
  - Create a new design modal;
  - Upgrade to export tech packs (wired to P6's plans).
- **G2. Tech pack editor and sheets** · 0151
  - 7 tabs (Overview, Body, Measurements, Materials, Callouts, Artworks, Labels);
  - A–H points and callouts drawn on 3D;
  - 🔒 QC-only rows;
  - Check fit;
  - Preview sheets;
  - the .xlsx with the 8 named sheets and the shared header.

  Where v2.2 has tabs v3.9 dropped (Colourways, Personalisation, QC, Review), fold them into the v3.9 tabs. Do not lose
  their data.

# Wave 5: the Store, inside (decision 0131)

- **C1. Payments core** · 0152 · migration `20261228010000`
  - Stripe Checkout (GBP, AUD) through the UK entity, webhooks, refunds;
  - order payment state feeding `submit_order_for_production`;
  - sample and run checkout from the Order drawer;
  - plans billing (Stripe Billing) for P6;
  - credit purchase;
  - F-G4 financial controls (factory deposits ≤ collected cash − refund reserve, reserve as a setting; GMV and revenue
    reported apart);
  - delete the `no-payment` tests.
  - Test mode only. No live keys in CI.
- **C2. Team stores and club pages (F-T6)** · 0153 · migration `20261228020000`
  - store windows, link + QR, no-account checkout, club margin, close into one order, auto-refund below minimum;
  - `<club>.knitwright.com` pages.
- **C3. Storefronts, drops, listing editor (F-L5, screen 23)** · 0154 · migration `20261228030000`
  - `<brand>.knitwright.com`;
  - drop windows from collection plans;
  - made-to-order joins the weekly batch;
  - listing editor (Mockups, Listing details with AI Improve, GPSR, Personalization, Pricing with profit, Publishing,
    Listing health);
  - returns policy.
- **C4. Sales channels (F-L6, screens 24)** · 0155
  - Shopify app (OAuth, push products, fulfilment service, pull orders, sync tracking) behind
    `SHOPIFY_APP_*`;
  - Etsy, TikTok Shop and WooCommerce cards say "later";
  - API / CSV.
- **C5. Store pages, payouts, seller dashboard (F-L7, screens 16, 25)** · 0156 · migration `20261228040000`
  - Overview, Channels, Branding, Settings (GPSR, EPR), Payouts;
  - Stripe Connect Express weekly payouts after delivery, reconciled against delivered orders;
  - margin calculator.
- **C6. Retire the Store contract** · 0157
  - Once C1–C5 are merged, remove `app/api/store/*`, `lib/store-contract/*` and `STORE_SERVICE_TOKEN`;
  - supersede decision 0106.

# Wave 6: AI and content completion
- **A1:** live-provider verification runs, once the owner supplies keys (owner action). Each adapter run once, its
  output judged, and the decision recorded.
- **A2:** the 5 missing mockup scenes, and per-scene provider mapping instead of 4 coarse ids.
- **Articles:** the seven remaining articles stay blocked on the factory's pattern master (v5 decision 10). Not a
  workstream until it arrives.

## Assigned identifiers (do not change)

| Decision | Workstream | Migration |
|---|---|---|
| 0131 | this plan | — |
| 0132–0136 | D1–D5 | D1 `20261220010000`, D5 `20261220020000` |
| 0137, 0138 | U1, U2 | — (U2 none) |
| 0139–0144 | P1–P6 | P1 `20261222010000`; P2–P6 use `202612220[2-6]0000` in order, only if needed |
| 0145–0149 | E1–E5 | E1 `20261224010000`; E2–E5 `202612240[2-5]0000`, only if needed |
| 0150, 0151 | G1, G2 | `20261226010000`, `20261226020000`, only if needed |
| 0152–0157 | C1–C6 | as listed above |
