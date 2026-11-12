# Knitwright build pack (developer edition, v3.9)

> **In this repository** the pack lives at `docs/spec/` (not `knitwright-build/`). The screenshot folders
> (`references/prototype-screens/*.png`, `references/screens/**`) are not committed; read them from the local copy at
> `knitwright-build/references/` on the build machine. The plan built from this pack is `plans/platform-v6.md`.


Knitwright is a sportswear design, marketing and manufacturing platform. Clubs and new sportswear brands design kit, generate mockups and marketing, and order production from partner factories in Sialkot. We launch in the UK, then Australia.

The product is **one platform built on Kittl's interface**, with:
- **Printify's** catalogue, product, listing, order and store pages;
- **Fabra's** 3D Garment Studio, tech pack and range plan.

Everything is sportswear-specific, and every design stays tied to a real, factory-approved garment.

## Start here (30 minutes)

1. **Open `prototype/index.html` in Chrome.** It is a single offline file and needs no server or build. The **Prototype v3.7** bar at the bottom-left links to every screen. It is the visual target for the UI.
2. **Look at the pictures.** `references/prototype-screens/` has 109 images of every Knitwright screen and state at 1440 × 900, plus full-length captures of long pages. These are what to build. `references/screens/` has the 136 real Kittl, Printify and Fabra screenshots they were copied from. Use those for spacing, states and feel.
3. **Read `10-design-system.md`.** It covers colours, type, spacing, radius, shadows, motion, every component with all its states, and the loading / empty / error states. Build the component library from it before any screen.
4. **Read `08-ui-kittl-shell.md`** (the per-screen UI spec, newest blocks at the top) **and `09-screen-map.md`** (every screen with its route and feature IDs).
5. **Read `01-product-direction.md`, then `06-build-plan.md`.** The first covers settled decisions; the second covers phases, gates and the working agreement.
6. **Use the rest as reference while building a feature:**
   - `02-features.md`: behaviour, rules, acceptance tests;
   - `03-data-model.md` and `schemas/`;
   - `04-production-package.md`;
   - `05-architecture.md`.

**With Claude Code:** put this folder at the repo root as `knitwright-build/` and start each session with:

> Read `knitwright-build/README.md` and the files it lists, then work on Phase <n>, task <id> from `06-build-plan.md`.

## Rules that override everything else

- **UI:** copy the prototype's layout and interaction. The prototype copies Kittl, Printify and Fabra layouts, but never their logos, artwork, template content or marketing copy; ours must not either.
  - Where the prototype and `02-features.md` disagree on **layout**, the prototype wins.
  - Where they disagree on **behaviour, data or rules**, `02` wins.
- **Placeholders are config, not code.** This covers prices, plans (Starter / Studio Pro / Club & Scale), tolerances, fabric codes, lead times and copy.
- **The garment is always real.** A design is always on a factory-approved base article. The AI never puts generated imagery on a garment panel and never states a manufacturing fact that is not in the rulebook.
- **Ask, don't change.** Raise conflicts with `01-product-direction.md` as questions.

## Contents

| File | What it holds |
|---|---|
| **`prototype/index.html`** | **Clickable prototype (v3.7)**, opened in Chrome. It covers:<br>• **dashboard:** Projects, AI Studio, Templates, Mockups, Marketing, Brand;<br>• **Kittl editor:** canvas, boards, panels, inspectors, prompt bar, Export / Share / Order;<br>• **Printify pages:** catalogue, products, listings, orders, order detail, store;<br>• **Fabra screens:** Garment Studio (2D / 3D / tech pack), tech pack sheets, range plan board |
| **`references/prototype-screens/`** | **109 PNGs of every screen and state at 1440 × 900**, plus `-full` captures of long pages; `INDEX.md` lists them by area |
| **`10-design-system.md`** | **Tokens, components with every state, page states, voice, and the UI definition of done.** It wins over the prototype on exact values |
| **`08-ui-kittl-shell.md`** | UI source of truth: specs for every screen, newest changes at the top |
| **`09-screen-map.md`** | Every screen (33), its route, contents and feature IDs |
| `01-product-direction.md` | What Knitwright is, settled decisions, users, launch catalogue, pricing anchors, what's out of scope |
| `02-features.md` | Every feature with ID, flow, rules and acceptance tests (Teamwear F-T, Studio F-S, Launch F-L, Ops F-O, Guardrails F-G) |
| `03-data-model.md` | Entities, the design object, factory profile, conventions |
| `schemas/schema.sql` | Postgres DDL for the first migration |
| `schemas/design-object.schema.json` | JSON Schema for `design_version.doc` |
| `04-production-package.md` | The Knitwright Production Package (KPP): every file, format and naming rule, the generation pipeline, the factory test |
| `05-architecture.md` | System diagram, stack, AI call sites, key flows, security, testing |
| `06-build-plan.md` | Phases 0–4 with gates, ordered tasks, working agreement |
| `07-template-library.md` | Sportswear templates to seed: design, kit bundles, mockup scenes, marketing, video, flows, tech packs |
| `articles/ONBOARDING.md` | How base articles get factory-approved and go live |
| `articles/JSY-SS-01/` | Worked example and seed data:<br>• article data and a rulebook of 45 rules;<br>• graded pattern (SVG + DXF, XS–3XL) and pattern report;<br>• tech pack;<br>• the drafting script |
| `references/REFERENCES.md` | Competitor screens, what to take and what to skip; `capture-references.mjs` saves them as PNGs |
| **`references/screens/`** | **136 real screenshots of Kittl, Printify, Fabra and other tools** (personal details blurred), sorted by product, with an index (`README.md`), the tutorial video links (`LINKS.md`) and a saved copy of the SpecForm site |
| `research/` | Validation research and frame-by-frame UI notes from Kittl and Fabra tutorial videos (background only) |
| `CHANGELOG.md` | How the pack changed from v2.1 to v3.7 (history only) |

## Prototype notes for implementers

- **Deep links:** `prototype/index.html?shot=<name>` opens any state from the screen index directly (for example `?shot=s10-tech-pack-measurements`).
- The prototype is plain HTML, CSS and JS with hash routes (`#/projects`, `#/editor`, `#/orders/detail`…). Its code is throwaway: rebuild it in the real stack (`05-architecture.md`). Don't port it.
- **Design tokens:**
  - navy `#0B1F4B`;
  - electric blue `#2F6BFF`;
  - gold `#F2B705` (it replaces Kittl's and Fabra's lime);
  - font Inter; icons Lucide.
  - Premium features carry ♛; credits use the KW coin.
- **Sample data** (Lahore Lions FC, prices, measurements, orders) is invented. Use it for seed and fixtures only.
- **Screens with no screenshot behind them** were designed by us to fit the same system. Treat them as the spec. They are:
  - version history;
  - the Print on demand artboard tab;
  - the "n more" task-bar menus;
  - the range plan board;
  - the order detail page;
  - the colourway and size pickers.

## Open questions to settle in Phase 0

1. Which 2 Sialkot factories become partners, and will they hand over graded pattern masters for the launch articles?
2. Real MOQ-1 weekly-slot price and 50/100/300 tiers per article.
3. Which pattern formats the factories actually use from the package (DXF, 1:1 PDF, SVG).
4. Colour tolerance the factory can hold on each fabric (target ΔE CMC 2:1 ≤ 1.5).
5. UK landed cost per piece (freight, DDP, last mile) from the test batch.
6. Founder segment: is there enough pull for 50–300-piece runs (interviews + deposits)?
7. Studio Pro price, package-download fee and club price ladder (placeholders in `01`).
8. The Australian winter code and partner clubs for Phase 3.

## Contacts

- **Ahsham Javed Bajwa**, CEO: product, factories, priorities.
- **Sameed Ilyas**, CTO: architecture, code review, access.
