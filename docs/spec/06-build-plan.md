# 06 · Build plan

Phases are gated by evidence, not dates. Dates are targets. A phase does not start until the previous gate passes; if a gate fails, fix the cause before building further. Feature IDs refer to `02-features.md`.

| Phase | Target dates | Theme | Gate to pass |
|---|---|---|---|
| 0 | 2 Nov – 13 Dec 2026 | Validate and build the file pipeline for 2 articles | **G0:** 3 of 5 factories make in-tolerance samples from the KPP alone; at least 10 deposits across the two landing pages; real landed cost known |
| 1 | 14 Dec 2026 – 21 Feb 2027 | Knitwright Teamwear MVP, UK | **G1:** 15 paid club orders by 31 Mar 2027; on-time ≥ 90%; defects < 2% |
| 2 | 22 Feb – 23 May 2027 | Studio core for brands: design → engineer → make, then inspire | **G2:** 30 paid samples; 10 converted to Class A/B runs; ops time per order < 20 min |
| 3 | 24 May – 12 Sep 2027 | Launch content (mockups, marketing, video, Flows) and sell + Australia | **G3:** 100 cumulative orders; 10 live storefronts with a sale; first Australian club orders delivered |
| 4 | from 13 Sep 2027 | Automation and breadth | 300 orders/month run rate; defects < 1.5%; ops time per order < 15 min |

## Phase 0 · Validate and prove the file pipeline (6 weeks)

**Non-software tasks (founder)**

| # | Task | Output |
|---|---|---|
| 0.1 | Factory file test: send the KPP for the jersey and shorts in 3 sizes to 5 Sialkot factories; measure POMs, ΔE, turnaround; ask for MOQ-1 weekly-slot and 50/100/300 quotes; gauge reaction to the job-packet model | Factory comparison sheet; 2 partner factories chosen; real price tiers |
| 0.2 | Interview 15–20 UK club kit secretaries (spend, timing, pain, current supplier) | Interview notes; per-club spend estimate |
| 0.3 | Interview 20 would-be or early sportswear founders (first order size, budget, what they paid Fiverr/agents, would they pre-pay a 50-piece run) | Interview notes; segment decision |
| 0.4 | Keyword and store-count pull (Keyword Planner or Ahrefs; Store Leads or BuiltWith for Shopify activewear stores) | Demand sheet |
| 0.5 | Ship one consolidated batch Sialkot → UK with a DDP quote and DCTS origin claim | Real landed cost per piece |
| 0.6 | Two legal consults: UK payments (principal model, pre-orders) and IP/consumer (benchmarks, returns, AI labelling) | Written advice; adjust F-G1, F-L2 |
| 0.7 | UK Ltd, Companies House ID verification, Stripe UK account, business bank | Live Stripe account |
| 0.8 | Swatch book for F-POLY-INT and F-POLY-PQ printed by the chosen factory; measure Lab values | `fabric_colour` and colour reference data |
| 0.10 | Start the rulebook with the factory's pattern master: construction, seam types, print rules, fit and tolerance rules for the jersey and shorts, written as short entries with an ID, a "why" and a best practice | 30–50 `rulebook_entry` rows (seed for F-S5) |
| 0.9 | Collect each factory's pattern master for the jersey and shorts (size M + grading) | Inputs for parametric scripts |

**Software tasks (CTO), in order**

| # | Task | Done when |
|---|---|---|
| 0.A | Repo, environments, CI, Postgres with `schemas/schema.sql` as first migration, R2, Modal service skeleton | Deploys to staging |
| 0.B | Parametric scripts for `JSY-SS-01` and `SHO-TR-01` from the factory pattern masters; grading table; golden tests | Every size × range end yields valid closed panels; size M matches the master within 2 mm |
| 0.C | glTF base models for both articles with UV = panel layout (contract 3D artist; Blender or Marvelous Designer from the size-M pattern) | Each UV island is one panel plus bleed; checker texture shows no stretching beyond 5% |
| 0.D | Design object + validator (Python, TS mirror) + 10 fixture designs | Validator parity tests pass |
| 0.E | KPP generator: DXF-AAMA, 1:1 PDF, SVG, print PDFs, POM, BOM, colour spec, tech pack, QC, manifest | Package builds in < 60 s; DXF passes the test matrix in `04` |
| 0.F | Minimal internal designer (not customer-facing): load article, set colours and layers, preview in 3D, export KPP | Founder can produce the test packages for 0.1 without engineering help |
| 0.G | Two landing pages with Stripe deposit (refundable): "Club kit from £22, names included, ~4 weeks" and "Launch your sportswear brand: 1 sample to 300 pieces" | Live with analytics; deposits recorded |

## Phase 1 · Knitwright Teamwear MVP (UK)

**Build order**

| Week | Features | Notes |
|---|---|---|
| 1 | F-0 hardening; catalogue pages for articles 1, 2, 3, 4, 7, 8; price ladder from factory profile. In parallel through weeks 1–6: parametric scripts, glTF models and golden samples for articles 3, 4, 7 and 8 (contract 3D artist + factory), repeating Phase 0 tasks 0.B–0.C | An article goes live only once its golden sample is approved; article pages show real sample photos |
| 2 | F-T1 template gallery + quick configurator on 3D; 30 templates (contract designer) | First customer-facing surface |
| 3 | F-T5 quote PDF; F-T7 Stripe Checkout (GBP, VAT); order tables | Quotes equal checkout |
| 4 | F-T4 roster and sign-up link; F-T6 team store with close logic and club margin | |
| 5 | F-O1 batching; F-O2 job packet with WhatsApp; batch KPP | |
| 6 | F-O3 QC gate; F-O4 packing, invoice with HS code and origin, courier booking; tracking emails | |
| 7 | F-T2 crest-to-kit; F-T3 committee link | Highest-converting hook; built once the order loop works |
| 8 | F-T8 club workspace and reorder; club page `<club>.knitwright.com`; F-G1 moderation (basic); F-G4 financial controls | |
| 9 | First 3 real club orders end to end; fix list; launch to cricket clubs for April season and football clubs for summer orders | |

**Done when:** gate G1. Also, a club with colours and crest opens a team store in under 10 minutes, and a parent checks out in under 2 minutes on a phone.

## Phase 2 · Studio core for brands

The order follows the money: first the stages that lead to a paid sample (design → engineer → make), then the stage that makes design better (inspire).

| Order | Weeks | Features |
|---|---|---|
| 1 | 1–2 | F-S4 Studio home (action cards, Jump back in), create-new modal and base/template catalogue with sportswear filters; F-S9 workspace + Brand Studio (manual entry first, URL import in Phase 3); F-S8 article pages, fabric programme, swatch-book purchase; seed the first 20 design templates (`07`) |
| 2 | 2–3 | F-S3 parametric parameters exposed for articles 1, 2, 5, 6, 7, 8 (only ranges signed off by golden samples) |
| 3 | 3–6 | F-S4 Fabra-style editor: Form / Library / Specs toolbars, 2D \| 3D \| Tech pack views side by side, Simulate, Design Summary panel, colourway and size selectors, click-to-all / drag-to-panel, pattern-fill popover, Edit Graphic panel (mm), names & numbers, pattern-fill maker, Share popover, guardrails, versions |
| 4 | 5–7 | F-S5 product intelligence v1: `rule_id` on every check, option and tech-pack field; "Why?" popovers from the rulebook (no LLM yet: show the entry text) |
| 5 | 6–8 | F-S6 tech pack view (Overview, Body, Measurements with grade types and locked grades, BOM, Callouts, Artworks, Colourways, Personalisation, Labels, QC, Review), Export panel (Tech pack PDF + Excel, Images, Pattern, Print files, Production package); F-G2 pre-export check |
| 6 | 7–9 | F-S7 Product-created screen, sample ordering, golden-sample approval, Select-sizes order modal, Class A weekly slot, Class B runs with deposit |
| 7 | 9–11 | F-S1 inspiration board: context query, Knitwright library and Unsplash/Pexels first, link-preview cards, Behance/Pinterest search buttons, moodboard, "Suggest from this" with validated suggestion cards; Pinterest OAuth boards once Standard access is granted (apply in week 1) |
| 8 | 10–12 | F-S5 v2: LLM-phrased answers and the "Ask" box grounded on the rulebook, with gap logging |
| 9 | 11–13 | F-S2 benchmarks: URL/photo intake, card, compare view, apply-to-design, design-around warning |
| 10 | 12–13 | F-G3 compliance labels per market; F-G1 human review queue before Class B runs; AI mood images in F-S1 |

**Done when:**
- Gate G2 passes.
- A first-time founder goes from a base article to a validated design in 30 minutes.
- A factory samples from the package with no questions.
- Every check, option and tech-pack field has a rulebook entry.

## Phase 3 · Launch content and sell, plus Australia

| Order | Features |
|---|---|
| 1 | Launch shell (Kittl-style canvas editor: icon rail, inspector, bottom dock, task bars, Brand tabs in pickers, units incl. mm) |
| 2 | F-L1 Mockup studio: deterministic mockups first (renders, flat lay, hanger, ghost, turntable) as live-linked Mockup boards with colourway/roster switcher; then AI scenes (shoot ideas library, custom shoot) with garment lock, checker, AI labels; image modal edits |
| 3 | F-L2 Marketing studio: 50 marketing templates, Write-for-me copy, campaign workflow form, Kittl-style export panel (px/in/mm, DPI, PNG/JPEG/SVG/PDF, RGB/CMYK, zip) |
| 4 | F-L3 Video studio: deterministic videos first; then AI video boards (first/end frame, sportswear prompt presets, model picker with credits per second, 3–15 s), MP4 export with text burned in |
| 5 | F-L4 Flows: board canvas, connectors, fan-out/fan-in, Regenerate and Run all downstream, Flatten/Upscale/Reframe, 6 flow templates, run summary, Export all, Publish to store |
| 6 | F-S9 Brand import from URL (logos, palettes, fonts, graphics, visual style, voice and tone) |
| 7 | F-L6 "Connect your store & publish" wizard with the Knitwright storefront as the first channel |
| 8 | F-L5 storefront: hosted store, drops (including from a collection plan), made-to-order (Class A, UK/AU), returns policy, size confirmation |
| 9 | F-L7 seller dashboard, margin calculator, Stripe Connect Express payouts |
| 10 | F-L6 Shopify app (fulfilment service, product push, order pull, tracking sync) |
| 11 | F-S10 Collection plan and line plan (priced from live tiers) |
| 12 | F-S6 Translate (tech pack in English + Urdu) |
| 13 | Australia: AUD pricing, GST registration trigger, AU courier and last-mile partner, AFL/netball/cricket templates |
| 14 | Studio Pro plan (custom domain, branding removed, discount, more credits) |

**Done when:** gate G3.

## Phase 4 · Automation and breadth (from September 2027)

Each item is gated by data from Phases 1–3:
- Chat edits as design diffs.
- Designer templates with a royalty per unit.
- Second Sialkot factory per class (redundancy).
- More base articles: rash guard variants, cycling jersey, netball dress, rugby jersey.
- Etsy integration.
- A stocked-fulfilment pilot with one seller in a UK 3PL.
- A Vietnam/China "graduation tier" for brands above 300 pieces per style, with Knitwright still principal.
- EU opening once Pakistan's GSP+ status from 2027 is clear.
- US only via batch import with a US importer of record, if tariffs make it viable.

## Working agreement for Claude Code

- Read `01-product-direction.md` decisions before proposing architecture; raise conflicts as questions, don't silently change them.
- Every feature PR names its feature ID, adds or updates acceptance tests from `02-features.md`, and keeps validator, renderer and DXF golden tests green.
- Catalogue, prices, country rules and factory capabilities are data, never constants in code.
- Never put generated imagery or inspiration images on a garment panel. Never store third-party page HTML or images from benchmarks or inspiration sources; store links, previews per API terms, and derived facts.
- Never let the AI state a manufacturing fact that is not in the rulebook; if no entry covers it, say so and log the gap.
- When a fact in this pack is marked as a placeholder (prices, tolerances, fabric codes), read it from config/seed data so the founder can change it without a deploy.
