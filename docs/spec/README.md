# Knitwright build pack

This folder is the brief for building Knitwright with Claude Code. Put it at the root of the repo, as `knitwright-build/`, and start each session with:

> Read `knitwright-build/README.md` and the files it lists, then work on Phase <n>, task <id> from `06-build-plan.md`.

## Contents

| File | What it holds |
|---|---|
| `01-product-direction.md` | What Knitwright is, settled decisions, principles, users, launch catalogue, pricing anchors, what is out of scope |
| `02-features.md` | Every feature with ID, flow, wireframe, rules and acceptance tests (Teamwear, Studio, Launch, Ops, Guardrails) |
| `03-data-model.md` | Entities, the design object, factory profile, conventions |
| `schemas/schema.sql` | Postgres DDL to start migrations from |
| `schemas/design-object.schema.json` | JSON Schema for `design_version.doc` |
| `04-production-package.md` | The Knitwright Production Package: every file, format, naming rule, the generation pipeline and the factory test |
| `05-architecture.md` | System diagram, stack, AI call sites, key flows, security, testing |
| `06-build-plan.md` | Phases 0–4 with gates, ordered tasks and the working agreement for Claude Code |
| `references/REFERENCES.md` | Competitor screens to borrow patterns from, what to take and what to skip |
| `references/capture-references.mjs` | Playwright script that saves those screens as PNGs into `references/screens/` |
| `research/Knitwright platform validation.md` | The validation research behind these decisions (demand, competitors, factories, risks, sources) |
| `articles/ONBOARDING.md` | How many base articles (8 in 3 waves), the 9-step process to get each one factory-approved and live, the go-live checklist |
| `articles/JSY-SS-01/` | Worked example: base article data, rulebook (45 rules), graded pattern (SVG + DXF, XS–3XL), pattern report, 17-page tech pack with factory sign-off. Seed data for `base_article`, `rulebook_entry` and the golden tests |
| `07-template-library.md` | Sportswear-only templates: 60 design, 15 kit bundles, 40 mockup scenes, 50 marketing, 12 video, 6 flows, 8 tech pack templates |
| `research/kittl-fabra/` | Frame-by-frame UI notes from 5 Fabra and Kittl tutorial videos, plus docs research |

## Version 2.2 (28 Oct 2026): Fabra and Kittl as the design references

The founder chose **Fabra** for the design studio, 3D and tech packs, and **Kittl** for mockups, marketing images and video. UI and flows were extracted from 5 tutorial videos (`research/kittl-fabra/`).
- **F-S4, Fabra-style Studio:**
  - home with action cards and "Jump back in";
  - create-new modal and base/template catalogue with sportswear filters;
  - editor with **Form / Library / Specs** toolbars and **2D | 3D | Tech pack** views side by side;
  - Simulate, Design Summary panel, colourway and size selectors;
  - click-to-all / drag-to-panel, pattern-fill and graphic inspectors in mm, pattern-fill maker, Share popover.

  The Form toolbar only exposes factory-approved options and ranges.
- **F-S6, the tech pack as a view:**
  - tabs Overview, Body, Measurements (grade type, locked grades, tolerances, sample column), BOM, Callouts, Artworks, Colourways, Personalisation, Labels, QC, Review;
  - Export panel: Tech pack PDF + Excel, Images, Pattern, Print files, Production package.
- **New F-S10, collection plan and line plan:** Fabra's range board and line plan, priced live from Knitwright's tiers.
- **F-S9, Brand Studio (Kittl):** URL import, palettes with sublimation-safe matches, fonts by role (plus a name & number font), visual style, voice and tone, completion %, and Brand tabs in every picker.
- **Launch rewritten on Kittl's model**, with the garment always locked and checked:
  - **F-L1 Mockup studio:** live-linked mockup boards with a colourway/roster switcher, sportswear mockup collections, shoot ideas and custom shoots;
  - **F-L2 Marketing studio:** templates, Write-for-me, a campaign workflow form and Kittl-style export;
  - **F-L3 Video studio:** deterministic videos, plus AI video boards with sportswear prompt presets;
  - **F-L4 Flows:** a board canvas with connectors, Run all downstream and 6 launch-pack templates;
  - storefront, connect store and seller dashboard are now F-L5–F-L7.
- **New `07-template-library.md`:** every template is sportswear-focused.
- **Data model:** `brand`, `template`, `project` / `board` / `board_edge`, `flow_run`, `collection_plan` / `plan_group` / `plan_style`, `credit_ledger`.
- **Build plan:** Phase 2 builds the Fabra-style editor and tech pack; Phase 3 ("Launch content and sell") runs to 12 Sep 2027.

## Version 2.1 (25 Oct 2026): the founder's Studio journey

Based on the founder's screenshots of NOKTO, Fashdeck, Fabra, SpecForm, Fash Studio and Printify (see `references/REFERENCES.md`):
- **Studio is now six stages:** Inspire → Design → Engineer → Make → Shoot → Sell (`02-features.md`).
- **New F-S1 Inspiration board.**
  - Live and context-aware: Knitwright library, the user's own Pinterest boards, Unsplash/Pexels, link previews, AI mood images, and Behance/Pinterest search buttons.
  - "Suggest from this" turns an image into validated, manufacturable suggestions.
  - Inspiration never lands on a garment.
- **New F-S5 Product intelligence.**
  - Every check, range and tech-pack value has a "Why?" grounded in Knitwright's rulebook.
  - Includes best-practice cards and an "Ask" box. The AI never invents a manufacturing fact.
- **F-S4 editor:** Printify's tool rail and canvas, Fashdeck's part tiles, Fabra's 2D/3D toggle and NOKTO's coded accordion, with mm positioning and a production-cost info panel.
- **F-S6 tech pack:**
  - SpecForm-style builder stepper with provenance.
  - A 16-page PDF following SpecForm's page order.
  - A Fabra-style grading table (grade type, grade, tolerance).
  - No `[TBC]` allowed in exports.
- **F-S7:** Printify-style "Product created" hand-off (order a sample, shoot it, connect store & publish, order a run) and a "Select sizes" order modal.
- **F-L1 Shoot Studio:** a shoot ideas library (12 concepts with poses and model presets) plus Fash Studio-style custom shoots (garment, model, background, Run), with the garment locked and checked.
- **New tables:**
  - inspiration: `moodboard`, `inspiration_item`, `pinterest_connection`, `suggestion`;
  - product intelligence: `rulebook_entry`, `techpack_field`;
  - shoots: `shoot_concept`, `shoot_pose`, `model_preset`, `shoot_job`.
- **Build plan:** Phase 2 runs to 23 May 2027 and includes the rulebook, tech pack builder and inspiration board. Phase 3 is "Shoot and sell".

## What changed from the 22 Oct 2026 spec

| Area | Before | Now | Why |
|---|---|---|---|
| Positioning | Store + Studio + Sell on one design object, teamwear first | **A sportswear factory network with software attached.** Teamwear is the beachhead; Studio is the brand-launch platform on the same backend | Demand is proven for clubs and inferred for founders; brokered marketplaces (Zilingo, Fashinza) failed, while owned production (Zyod) survived |
| Factories | Sialkot partners | Sialkot partners only; more factories later as Knitwright-managed capacity, never as an open marketplace | Factories bypassing the platform; holding payments for others is regulated in the UK |
| Money flow | Knitwright merchant of record | Knitwright is **principal** for every order: buys from the factory, sells to the customer; no escrow | Same |
| Production classes | Fixed catalogue blocks | **Class A** sublimated on demand (MOQ 1, weekly slot); **Class B** 50–300 runs on a pooled stock-colour fabric programme | Custom fabric needs ~1,000 m per colour; Vietnam MOQs 300–3,000 |
| Product range | Football, cricket, AU winter code | 8 base articles focused on sublimated polyester sportswear plus a stock-colour tee and hoodie; no fashion leggings | Sialkot's strength is polyester sublimation; Printful already sells MOQ-1 leggings |
| Files | DXF-AAMA + print PDFs | DXF-AAMA **plus factory-native 1:1 PDF and SVG**, POM tolerances, ΔE colour spec, golden sample | Sialkot works in CorelDRAW/PDF; DXF acceptance unproven |
| Research | Inspiration panel | **Benchmarks** of functional features and review complaints, with provenance tags and a design-around check; never copies | IP and scraping risk |
| Markets | UK, Australia | UK first, Australia second; EU and US closed at launch | US ~42% duty on poly knit tops and no de minimis; EU per-item duty and fees |
| Build order | Store MVP first | **Phase 0 validation** (factory file test, interviews, deposits) before customer-facing code | The plan fails if factories can't hit fit and colour from the files |
| Revenue | Credits for outputs, Brand Pro | Production margin first; Studio Pro; media at cost-plus; package download fee refunded on order | Founders pay for production, not files |

## Open questions to settle in Phase 0

1. Which 2 Sialkot factories become partners, and will they hand over graded pattern masters for the launch articles?
2. Real MOQ-1 weekly-slot price and 50/100/300 tiers per article.
3. Which pattern formats the factories actually use from the package (DXF, 1:1 PDF, SVG).
4. Colour tolerance the factory can hold on each fabric (target ΔE CMC 2:1 ≤ 1.5).
5. UK landed cost per piece (freight, DDP, last mile) from the test batch.
6. Founder segment: is there enough pull for 50–300-piece runs (interviews + deposits)?
7. Studio Pro price, package-download fee and club price ladder (placeholders in `01`).
8. The Australian winter code and partner clubs for Phase 3.
