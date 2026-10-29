# 05 · Architecture

Two engineers build this. The architecture is one web app, one Python files/AI service and one database. The hard, defensible part is the asset pipeline: 3D models whose UV layout equals the print panel layout, parametric graded blocks, and one renderer that feeds the browser preview, the print files and the tech pack from the same design object.

## System overview

```
                         ┌────────────────────────── Next.js app (TypeScript) ───────────────────────────┐
 Clubs, players  ──────▶ │ /teamwear  configurator · crest-to-kit · committee link · roster · team store   │
 Founders        ──────▶ │ /studio    benchmarks · parametric editor · package · samples · media          │
 Shoppers        ──────▶ │ <slug>.knitwright.com  club pages · storefronts (wildcard + custom domains)     │
 Ops (Sialkot)   ──────▶ │ /ops       batches · QC · packing · shipping · exceptions · scorecards         │
 Factories       ──────▶ │ /job/<token>  job packet (magic link, no account)                              │
                         └──────┬───────────────┬──────────────────┬───────────────────┬─────────────────┘
                                │ SQL (RLS)     │ jobs (HTTP+queue)│ webhooks          │ signed URLs
                          ┌─────▼─────┐  ┌──────▼──────────────┐ ┌─▼──────────────┐ ┌──▼──────────────┐
                          │ Postgres  │  │ Files & AI service  │ │ Stripe, Shopify│ │ Cloudflare R2   │
                          │ (Neon or  │  │ FastAPI on Modal    │ │ couriers, email│ │ assets, files,  │
                          │ Supabase) │  │ geometry · DXF · PDF│ │ WhatsApp       │ │ packages, media │
                          └───────────┘  │ print · validate    │ └────────────────┘ └─────────────────┘
                                         │ LLM + image APIs    │
                                         └─────────────────────┘
```

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Web app | Next.js (App Router), TypeScript, Tailwind | One codebase for all surfaces; route groups per surface |
| Hosting | Vercel or Cloudflare | Wildcard subdomains for clubs and storefronts; custom domains through Cloudflare for SaaS |
| 3D viewer | three.js via React Three Fiber, drei | One glTF per base article; one 2048 px texture per panel group (not a single 4096 atlas: iOS canvas limits) |
| 2D editor | Fabric.js | Panel layers, SVG import/export, pattern fills, clip paths, text on path |
| Textures in browser | OffscreenCanvas worker renders panel layers → textures at working resolution | Print resolution only on the server |
| Files & AI service | Python 3.12, FastAPI, on Modal | Scales to zero; CPU for files, GPU only if a self-hosted model is added |
| Geometry | Per-article parametric scripts in TypeScript (FreeSewing-style, `@freesewing/core` MIT) run in Node inside the service, or ported to Python (pick one and keep a golden test) | Inputs: article, parameters, size. Output: panels in mm |
| DXF | `ezdxf` with the ASTM D6673 add-on | |
| PDF | WeasyPrint (tech pack), reportlab/pikepdf (1:1 patterns, print PDF/X-4) | |
| Raster | skia-python (or node skia-canvas) | Server-side per-panel per-size rendering |
| Colour | littleCMS (via Pillow ImageCms) for ICC transforms; colormath for Lab/ΔE | |
| Database | Postgres 16 with JSONB; Drizzle ORM in TS; SQL migrations | RLS by workspace |
| Queue | Postgres-backed queue (pg-boss) or Modal queues | Jobs: package build, media generation, batch cut-off |
| Storage | Cloudflare R2 | Free egress matters: factories download large ZIPs |
| Auth | Email magic link + Google; separate ops SSO | Players and parents never need an account |
| Payments | Stripe Checkout + Stripe Connect Express (seller payouts) through the UK Ltd | Stripe does not onboard Pakistan-registered businesses |
| Email | Postmark or Resend | Status emails, quotes |
| WhatsApp | WhatsApp Business Cloud API | Job packet links to factories; straggler reminders for rosters |
| Observability | Sentry, Axiom/Logtail, uptime checks | |

## AI usage

All AI calls go through the files & AI service with:
- a fixed JSON schema for every response (structured outputs);
- logging of input hash, model, cost and latency;
- a feature flag per call site.

AI never writes to a design without user confirmation, and never puts generated pixels on a garment panel.

| Call site | Purpose | Model class | Output |
|---|---|---|---|
| Crest-to-kit ranking (F-T2) | Rank deterministic candidates, write one-line descriptions | Small vision LLM (e.g. Claude Haiku class) | `{candidate_id, rank, blurb}` |
| Intake from prompt or image | Map a request to base article, options, colours, placements | Small vision LLM | Design-object patch + confidence per field |
| Inspiration context query (F-S1) | Design object → search tags and query strings for library, Pinterest boards, Unsplash/Pexels | Small LLM, or rules first with LLM fallback | `{tags[], query}` |
| Suggestion from inspiration (F-S1) | Inspiration image → transferable elements in Knitwright vocabulary → parameter/layer patch on the current base | Mid-size vision LLM, then the deterministic validator | Up to 3 validated `suggestion` rows with one-line explanations |
| AI mood images (F-S1) | Context query → mood image, labelled, never applied to panels | Commercial image API | Images in `inspiration_item` (source `ai_mood`) |
| Product intelligence "Why?" and Ask (F-S5) | Retrieve rulebook entries by `rule_id` and context, then phrase an answer citing them | Retrieval over `rulebook_entry` (Postgres full-text + pgvector) + mid-size LLM | Answer + cited `rule_id`s; "not covered" logged as a rulebook gap |
| Tech pack field drafting (F-S6) | Draft overview sentences and construction descriptions from the construction table | Small LLM, grounded on rulebook entries | `techpack_field` values with provenance `from_base` |
| Benchmark extraction (F-S2) | Page text/images → benchmark card | Mid-size vision LLM (e.g. Claude Sonnet class) | Benchmark fields with provenance |
| Review themes | Cluster complaint text into themes | Small LLM | `[{theme, count, example_paraphrase}]` (no verbatim review storage) |
| Logo/trademark screening (F-G1) | Detect brand marks and text | Vision LLM + blocklist + perceptual hash against registry | `clear` / `flagged` + reasons |
| Chat edits (Phase 4) | Natural language → design-object diff | Mid-size LLM | JSON Patch limited to allowed paths |
| Mockup studio AI scenes (F-L1, also used by F-L2 and F-L4 boards) | Shoot concept or custom inputs (garment locked from render or golden-sample photo, model preset or consented upload, background, pose) → on-model and scene images | Commercial image APIs (candidates: FASHN, Google Virtual Try-On, Photoroom, FLUX Kontext via a commercial-licence provider) | Images + checker score per image |
| Garment checker (F-L1–F-L4) | Compare the garment region of a generated image with the render: crest, logos, numbers, colour ΔE | Segmentation + perceptual/colour metrics; vision LLM for crest/text legibility | Pass/fail + reasons; failures auto-regenerated once |
| AI video board (F-L3) | First/end frame + prompt preset → clip; model list configured in admin with credits per second | Commercial video APIs (candidates: Kling, Veo, Wan, Seedance via commercial providers; confirm licences) | 3–15 s MP4 |
| Campaign workflow (F-L2) | Product + brand + highlight + campaign + style + destination → layout and copy around a pixel-locked mockup | Image API for background and layout; LLM for copy in the brand's voice and tone | Images + editable artboard |
| Brand import (F-S9) | Website/Instagram URL → logos, palettes, fonts (nearest licensed), graphics, visual-style text | Server fetch of the user's own URL + vision LLM | Brand record with completion % |
| Flows runner (F-L4) | Board graph → topological run of downstream boards, with cost estimate and per-board status | Queue (pg-boss/Modal) calling the call sites above | Outputs per board; refunds on failure |

**Third-party inspiration APIs:**

| API | Used for | Constraints to respect |
|---|---|---|
| Pinterest API v5 | The user's own boards and pins, after the user logs in with Pinterest (OAuth) | Trial access first; apply for Standard access before launch (review includes a recording of the OAuth flow); no scraping or automated extraction; follow display and caching rules ([access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/)) |
| Unsplash API, Pexels API | Licensed stock imagery matching the context query | Attribution and hotlinking as each API requires; respect rate limits |
| Behance | Link-out search only | No public API keys since 2021; never scrape |
| Link previews | Product links the user adds | Open Graph title, price and image fetched once on the server; preview shown, not stored as an asset |

**Before building each AI call site:**
- Confirm current model IDs, pricing and licence terms. For Claude models, use the `claude-api` skill in Claude Code rather than memory.
- Use only commercial-licence tiers.
- Do not use non-commercial models (for example IDM-VTON, CatVTON, FLUX [dev] weights without a licence).

## Key flows

### Configurator render loop (browser)
1. Load the base article glTF, the `uv_panel_map` and the design version.
2. A worker renders each panel group's layers to a 2048 px OffscreenCanvas using the same layer semantics as the server renderer, defined in a shared spec with a golden test of 20 reference designs.
3. Upload the textures to the material map. Re-render only the panels a change touches (debounced to 50 ms).
4. Size preview: apply the base article's grading to artwork placement and swap the size's glTF morph target or scale.

### Save and validate
Each edit is a JSON Patch against the current draft:
1. The patch is debounced and saved as a new `design_version` (or coalesced into the draft within 10 s).
2. The TypeScript validator runs instantly in the client.
3. The authoritative Python validator runs on save, and its result is stored in `validation_result`.

### Order to factory
```
payment succeeded (Stripe webhook)
  → order_line rows with unit_cost_snapshot from factory profile
  → assigned to the open batch for (factory, class, fabric) or a new run batch
  → at cut-off: batch closes → files service builds batch KPP → job_packet created → WhatsApp + email to factory
  → factory updates status via job packet → ops QC → packing → shipment → tracking emails
```

### Team store close
At `closes_at`:
- If pieces ≥ `min_pieces`: create one order per team store, assign it to a batch and notify the kit manager.
- Otherwise: notify the kit manager with options (extend, top up, cancel). Auto-refund after 72 h if there is no action.

## Security and privacy

- Row-level security on every workspace table. The ops service role is separate and audited.
- Job packet and committee links are signed random tokens (stored hashed), expiring and revocable. They give view-only access except for factory status updates and comments.
- Uploads: virus scan, MIME sniffing, size limits, EXIF stripped.
- Benchmark fetcher:
  - server-side only, one request per URL, logged out;
  - honours robots.txt;
  - user agent `KnitwrightBenchmark/1.0 (+https://knitwright.com/bot)`;
  - stores no HTML;
  - rate limited per workspace.
- PII is minimised: roster data is purged after 2 seasons unless the club opts in, and parents' emails are used only for order communication.

## Environments and testing

- Environments: `dev`, `staging` (Stripe test mode, fake factory), `prod`.
- **Golden tests:**
  - parametric scripts (every article × size × range end);
  - client/server renderer parity (pixel diff below a threshold on 20 reference designs);
  - validator parity (TS vs Python on 200 fixtures);
  - DXF round trip (write, re-read, compare lengths).
- **End-to-end tests** (Playwright):
  - configurator → quote → checkout (Stripe test) → batch → job packet → QC → shipment;
  - team store open → 10 test buyers → close → batch;
  - Studio: benchmark (fixture page) → apply → validate → export package.
