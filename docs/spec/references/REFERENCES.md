# Reference screens

These are the screens Knitwright borrows patterns from. For each one, the tables say which feature it informs, exactly what to take and what to skip. Never copy branding, copy text or artwork; take the interaction pattern only.

## Primary design references: Fabra and Kittl (founder decision, 28 Oct 2026)

- **Fabra** is the reference for the **design studio, 3D model and tech pack** (F-S4, F-S6, F-S10).
- **Kittl** is the reference for **mockups, marketing images, video, Flows and Brand Studio** (F-L1–F-L4, F-S9).
- Everything is adapted to sportswear, and to the locked-garment and manufacturable-by-construction rules.

The UI and flows were extracted frame by frame (about 140 frames, with auto-captions) from these tutorials. The timestamped notes are in `research/kittl-fabra/video-ui-notes.md`, and docs research is in `research/kittl-fabra/docs-notes.md`.

| Video | Product | Informs | What it shows |
|---|---|---|---|
| [Fabra V2 product demo](https://youtu.be/FwnkVNYqfbQ) (3:27) | Fabra (current UI) | F-S4, F-S6, F-S10 | Home action cards, create-new modal, product catalogue filters, editor with Form / Library / Specs toolbars, 2D \| 3D \| Tech pack views, Simulate, Design Summary, repeat and graphic inspectors, tech pack tabs and measurement grading table, Share, Export tabs, Excel tech pack, range plan and line plan, repeat print maker, mood board, Material Lab |
| [Fabra full product demo](https://youtu.be/meanQAaVXWo) (2:16) | Fabra (older UI) | F-S4, F-S6 | Customize silhouette options, click-to-all / drag-to-panel, Convert to repeat print, tech pack mode: Overview, Measure, Size chart, Callouts, BOM, Artwork; Excel export checklist |
| [Learn Kittl in 10 minutes](https://youtu.be/8xADe293vjU) (10:03) | Kittl | F-L1, F-L2, F-L3, F-L4 | Dashboard, template feed, Etsy-listing flow template, live-linked mockup board, AI restyle with Browse styles, Convert to image, Quick export, AI video board |
| [Kittl Flows full demo](https://youtu.be/JajGeyr4ip4) (22:03) | Kittl | F-L4, Launch shell, export | Full editor chrome, flow sections and instruction notes, Edit AI Image board panel, model picker with tokens per second, first/end frame video, prompt presets, connectors with fan-in/fan-out, units in/px/mm, multi-artboard zip export |
| [Kittl Brand Studio walkthrough](https://youtu.be/T2-K_9pp3-4) (8:07) | Kittl | F-S9, F-L2 | Import brand from URL, logos, palettes, fonts by role, graphics, visual style (setting, art direction, rules), voice and tone, completion %, Product campaign kit workflow form, image modal edits, Brand tabs in colour and font pickers |

## Founder's screenshots (25 Oct 2026)

Save the founder's screenshots into `references/screens/` with these file names so the feature specs can point at them:

| # | File name | What it shows | Informs | Take this |
|---|---|---|---|---|
| 1 | `founder-01-nokto-configurator.png` | NOKTO 3D configurator for a short-sleeve jersey | F-T1 | Full-bleed 3D stage with sport backdrop. Vertical tool rail: undo/redo, add, ideas (bulb), play, fullscreen, snapshot. View chip ("Front") in the bottom-left. Right panel: product title + info/account/cart icons; part pill ("Shirt"); accordion rows showing the current value as short codes (Model & fit · Short sleeve; Colours · 3 swatches; Pattern & design · Plain (F00); Collar & cuffs · C01). Footer: quantity stepper, price per piece with tier discount badge, total, Save / Quote / Add to cart |
| 2 | `founder-02-fashdeck-part-editor.png` | Fashdeck "Edit the garment, one part at a time" | F-S4 Parts tab | Part buttons in a grid (Front neck, Sleeves, Collar, Waist line, Flare variation, Colors). Selected part shows "Choose one reference" with illustrated tiles; the selected tile has an outline. Preview with "Input fabric" thumbnail. Caption strip of the current attributes ("Deep V neck · Puff sleeve · Midi · …"). "Custom AI edit" text box with an Apply button. **Skip:** whole-garment AI image rendering |
| 3 | `founder-03-fabra-design-plan-produce.png` | Fabra's three stages: Design, Plan, Produce | F-S3, F-S4, F-S6 | **Design:** 2D pattern pieces beside the 3D avatar, a selected piece ("Left sleeve") with Information / Material / Colors in a side panel, and a 2D · 3D · comments · tech pack toggle. **Plan:** range board with styles, colourways and SKUs counts; style cards with retail price, quantity, colourways and sizes (Phase 4 idea). **Produce:** tech pack tabs (Overview · Body size chart · Measurements · Callouts · Materials · Artworks); materials table with placement, colourway chips, article no. and quantity; trims & hardware; Measurements & Grading table with grade type (LINEAR / NON-LINEAR), grade, tol −/+, sizes XXS–XXL; POM lines drawn on the 3D garment |
| 4 | `founder-04-specform-create.png` | SpecForm "Create tech pack" upload | F-S2 (photo intake), F-S6 | Single upload card ("Garment photo or sketch. PNG, JPG or WebP") beside locked add-on cards: Technical drawing, 3D renders, Repeat print, Virtual fitting. Use the same card + add-on layout for benchmark photo intake |
| 5 | `founder-05-specform-techpack.mhtml` | SpecForm demo tech pack (Moto Jacket), saved page | F-S6, `04-production-package.md` | Pack stepper with completion status: 01 Overview · 02 Construction · 03 BOM · 04 Measurements (POM + grade) · 05 Graphics & prints · 06 Labels & packaging · 07 Colourway · 08 Artwork · 09 Review · 10 PDF. 14-page PDF: overview, B&W flats, colour renders, BOM (2 pages), construction details, construction annotations (numbered callouts + legend), measurement annotation (lettered POM drawing), size grading (base, sizes, grade rules, tolerance), fit reference (labelled "visualization only, not measured"), graphics, print placement (W × H cm), reference images per BOM item, colourways. Header block on every page; "Page x of y". POM drawing tool: grid scale, "click two points, value auto-fills". Buttons: Translate, Share link, Download PDF, Ask Mochi. **Skip:** `[TBC]` values in an exported pack |
| 6 | `founder-06-fash-studio-tryon.png` | Fash Studio Try On | F-L1 | Left nav (Explore · Try On · Image Generation · Create Videos · Marketing Studio · Apps). Centre card with three slots, each with presets + Upload: Garments, Model, Background (optional); one big Run button |
| 7 | `founder-07-printify-editor-info.png` | Printify product editor, info panel open | F-S4 | Left tool rail (Upload, AI, Add text, My library, Graphics, My templates, Shutterstock, Fiverr, Help). Top: info, undo/redo, Edit/Preview toggle. Info panel: product name, brand/model, "Fulfilled by Printify Choice", stock, **production cost range**, **print area size in px**, "Hide this info in the future". Canvas with dashed print area; side chips (Front side · Back side · Neck label inner); zoom % and pan tool; Save product |
| 8 | `founder-08-printify-editor-layers.png` | Printify editor with text selected | F-S4 Layers tab | Text toolbar (Position, font, size, bold, italic, align, colour, effects, duplicate, delete, "Apply to"). Right panel "Variants and layers": Position & size, rotate (deg), position left/top (%), align buttons. **Change:** Knitwright uses millimetres, not % |
| 9 | `founder-09-printify-product-created.png` | Printify "Product created" | F-S7 | Hand-off page: confirmation copy on the left, on-model mockup on the right, two actions: "Order a sample" and "Connect your store & publish" (repeated in a sticky footer) |
| 10 | `founder-10-printify-select-sizes.png` | Printify manual order, "Select sizes" modal | F-S7 order modal | Search across my products; filter chips (All products · Express delivery · Economy shipping); one row per size with thumbnail, size, "Fulfilled by", price, colour, stock, Select; "Discard order" |
| 11 | `founder-11-printify-catalog.png` | Printify catalogue home | F-S8, F-S9 | Left nav (store switcher, Dashboard, Catalog, My products, Orders, Settings, More, Pinned, Branding). Top tabs (For you · Men · Women · Kids · Accessories · Home and Living), search, category cards, country/currency selector |

## Public pages (capture with the script)

To capture these into `references/screens/`, run from the repo root:

```bash
npx playwright install chromium
node knitwright-build/references/capture-references.mjs
```

The script saves `<id>.png` (full page, 1440 px wide) for every row below. Re-run it before starting each phase, because these sites change often.

| id | URL | Informs | Take this | Skip this |
|---|---|---|---|---|
| nokto-ai-designer | https://noktosports.com/ki-designer | F-T2 Crest-to-kit | One card on the right: upload crest (PNG/JPG up to 6 MB) **or** pick up to 3 colours, optional club name, one big "Start" button. Example kits shown on the left. Result opens straight in the 3D configurator | Their 2-designs-per-week cap |
| nokto-how-it-works | https://noktosports.com/how-it-works | F-T3, F-T4, F-T5 | Four-step strip: design → share link → players enter their own name/number/size → PDF quote with quantity tiers, explicit approval before production | No team shop (we add one) |
| nokto-team | https://noktosports.com/team | F-T5 | Quantity tiers counted across the whole basket; names, numbers, crest and sponsors included | |
| spized-home | https://www.spized.com/en/ | F-T1, F-T6 | Template gallery as the starting point, team shop and team polls, price at 1 and at 20 pieces | Price level (we undercut) |
| owayo-home | https://www.owayo.com/ | F-T1, F-T6 | 3D designer with names and numbers included, published quantity tiers, organiser margin on the team shop | |
| fashdeck-home | https://www.fashdeck.com/ | F-S4 Parts tab, F-S8 fabric cards | Part editor (see founder screenshot 2); fabric cards that read like spec sheets (code, fibre, GSM, weave, MOQ) | Whole-garment AI rendering |
| blankbuilder-home | https://blankbuilder.app/ | F-S6 production files | Artwork on real pattern pieces, 3D beside it; per-panel true-size files named by part and size; adjustable bleed; artwork wrapping over side seams; placement spec sheet; 360° turntable | Their 19 basic blanks |
| blankbuilder-whats-new | https://blankbuilder.app/whats-new/ | F-S6 | Export details (v1.2 sublimation panel ZIP, v1.3 vector export) | |
| specform-product | https://specform.pro/product | F-S2, F-S6, F-G2 | Field provenance (observed / inferred / unknown), review queue, pre-export rules check, editable SVG flats | Reverse-engineering from a photo as the main input |
| fabra-pattern-editing | https://www.fabra.com/features/pattern-editing | F-S3 | Garment-level edits (sleeve length, fit) with live 3D; templates that "come with factory-ready specs" | Free-form pattern editing |
| fabra-pricing | https://www.fabra.com/pricing | Pricing | Free tier capped at 3 designs, monthly AI credits, free factory views | |
| printify-pricing | https://printify.com/pricing/ | Studio Pro | Free vs Premium (up to 20% off products) | |
| printify-integrations | https://printify.com/integrations/ | F-L6 | Channel list; connect store → publish → orders sync back | |
| printify-jerseys | https://printify.com/custom-jerseys/ | F-S8 article pages | Product card: price from, fabric, sizes, no minimum | Fixed blueprint with manual names/numbers |
| fash-studio-home | https://fash.studio/ | F-L1 | Flat-lay or render → on-model → video; model, pose and background pickers | Image-only workflow with no product data |
| mercer-pricing | https://www.mercer.design/pricing | F-T3 | Comments on a design, outside reviewers by link | Text-to-image hero |

## Still wanted from the founder

These would make the remaining specs precise:
- **Priority 1:** your factory's own tech pack or job sheet, CorelDRAW pattern screens, size chart, sublimation print-file export settings, price list, fabric list, and how an order arrives today (WhatsApp, private details blurred).
- **NOKTO:** the AI designer results grid, share link view, team sheet, quote PDF, and the inside of each accordion row (Colours, Pattern & design, Collar & cuffs).
- **Fashdeck:** the Generate concept form, fabric detail page, catalogue sharing.
- **Fabra:** the editor itself (logged in): changing a measurement, and the DXF export dialog.
- **Fash Studio:** a finished Try-On result, the video options, the Marketing Studio screen.
- **Printify:** the mockup gallery, the Shopify connection screens, the order detail page with statuses.
- **Pinterest:** nothing to capture; apply for API access in Phase 2, week 1.
