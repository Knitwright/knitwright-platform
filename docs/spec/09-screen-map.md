# 09 · Screen map: every feature on a Kittl-style screen

Version 3.8 · 9 Nov 2026.
- **Pictures:** every screen below has images in `references/prototype-screens/`; `INDEX.md` there maps file names to screen numbers.
- **Exact values:** in `10-design-system.md`.

Based on the founder's Kittl screenshots (`references/screens/`), the Fabra/Kittl tutorial frames (`research/kittl-fabra/`) and Printify screenshots. **Every PRD feature in `02-features.md` has a home below.** Layout rules are in `08-ui-kittl-shell.md` §1 and §5 and in `prototype/index.html`; this file says which screen each feature lives on and what is on it.

## Global shell (from the founder's screenshots)

**Left rail.** 96 px wide, white, with a right border. Each item is an icon above a 12 px label; the active item has a 44 px grey rounded square behind its icon.

| Position | Item | Notes |
|---|---|---|
| Top | Logo | — |
| 1 | **Create** | Black square in Kittl; navy in Knitwright |
| 2 | AI Studio | — |
| 3 | Templates | — |
| 4 | Mockups | — |
| 5 | Marketing | — |
| 6 | **Products** | Knitwright addition |
| 7 | Projects | — |
| 8 | ⌄ | Expands to **Orders**, **Store**, **Team** (clubs only) |
| Bottom | **Help** | Replaces Kittl's MCP |
| Bottom | ⋯ (more), avatar | Square, coloured |

**Top bar** (inside each page, 72 px):
- **left:** Brand pill (briefcase icon + brand name, plus a gold "New" tag until the brand is set up);
- **centre:** page tabs, active tab underlined;
- **right:** ⊕ (invite / add credits), **Upgrade** button (navy with coin), avatar.

**Help bubble:** gold circle, bottom right, with a red dot when there are unread messages.

**Content container:** AI Studio pages sit in a light grey rounded container (`#F3F4F6`, 24 px radius) with a faint grid. Other pages use white.

## Screen map

| # | Screen (route) | Kittl reference | Features (`02` IDs) | What is on it (sportswear) |
|---|---|---|---|---|
| 1 | **Create menu** (popover from Create) | Kittl "+ Create" | — | New kit design · Kit from crest · Social post · Video · Mockup · Tech pack · Blank canvas · Import design |
| 2 | **AI Studio › Creative Agent** `/ai-studio/agent` (AI Studio itself opens on AI Workflows with the hero + Ask Creative Agent box, v3.2) | Screenshot 03 | F-S1 inspiration, F-S5 Ask, F-T2 (via agent) | "What do you want to create today?"; prompt card with + (attach), brand icon, mic, send; token note; **Quick-start**: Kit design · Product shoot · Kit launch ad · Team store promo · Matchday content · Tech pack. History / New chat |
| 3 | **AI Studio › AI Workflows** `/ai-studio/workflows` | Screenshot 04 | F-T2, F-S2, F-L1, F-L2, F-L3 | "Start a workflow". Tabs: Discover · For you · 2027 kits · Teamwear · Ads · UGC · Product scenes. Rows with "View all": Kit design, Product scenes, Ads, UGC, Product listings, Team & club, Mockups, Branding, Research, Tools. **Browse styles** drawer (Featured ▾, search, style tiles, Auto-apply model toggle) |
| 4 | **Workflow page** `/ai-studio/workflow/:id` | Screenshot 05 | per workflow | Back "← AI Studio"; white card: left form (title + link icon, description, numbered steps, footer with image count + **Generate n** disabled until valid); right **Output example** with "Powered by" line. Workflows defined in the table below |
| 5 | AI Studio › Image Generator | Kittl tab | F-L1 | Same layout as screen 4: prompt, references (garment 🔒), style, model, aspect, count |
| 6 | AI Studio › Video Generator | Kittl tab | F-L3 | First/end frame, sportswear presets, model with credits per second, duration 3–15 s, audio |
| 7 | **Templates** `/templates` | Screenshot 02 | F-T1 templates, 07 library | Grey header band "Templates for every sport, ready to edit" + search. Tabs: Discover · Football · Cricket · Training · Running · Gym · Combat · Esports · Launch packs · Social · Videos · Tech packs. Rows (For you · Trending · Kit launch packs · Team store promos · Videos · Matchday graphics · Size charts…) of square cards with a **Use template** pill under the image, author line and premium crown |
| 8 | **Mockups** `/mockups` | Kittl mockups page | F-L1 | "Use a product ▾" or Upload; categories (Product renders · Flat lay · Hanger · Ghost · Teamwear · Training · Running · Combat · Esports · E-commerce); every mockup shows the chosen product; colourway ▾; bulk select + download; card hover **Edit / Download** |
| 9 | **Marketing** `/marketing` | Screenshot 06 | F-L2, F-L4 | Social icons + "Never run out of ideas for kit launches"; buttons **Create an ad** and **Plan a launch pack**; **Featured concepts** row (Kit reveal · Pre-order countdown · Matchday · Player spotlight · Try-on UGC · Sponsor shout-out · Team store open); **Ad gallery** with chips All · Photo · Video · Concepts ▾ · Sport ▾ and a 4-column masonry layout. Click → "Use this concept" |
| 10 | **Products** `/products` (addition; Printify catalogue + Fabra filters) | Printify catalogue screenshot | F-S8, F-S3 | **v3.5:** Printify catalogue home (category tiles, Studio Pro banner, Top picks, New arrivals, Eco picks, Discover more, FAQ), tabs Catalogue · My products · Trending ideas · Fabrics; My products is a row list with status chips and channel status (see `08` v3.5). Earlier version: tabs **Base products · My products · Fabrics**. Left filters: Sport, Article, Fit, Gender, Class (A from 1 pc / B 50–300), Fabric. Cards: render, name, code, "From £22 · from 1 pc", class tag |
| 11 | **Product detail** `/products/:code` | Printify product page | F-S8, F-S5 | **v3.5:** adds decoration-method tabs, a "Made by Knitwright" card, a Fulfilment box, About / Key features / Care, a cm / in size guide and Frequently bought together. Gallery (sample photos + 3D), spec (fabric card: blend, GSM, stretch, finish), **price ladder** (1/20/50/100/300), size chart, options available (collar, cuffs, lengths), lead time, rules summary with Why? links. Buttons **Design this** (opens the editor with a Garment board), **Order swatch book** |
| 12 | **Editor** `/project/:id` | Videos 3–4 (editor chrome) | F-S4, F-S3, F-S5, F-S6, F-S7, F-T1, F-T4, F-L1–F-L4, F-G1, F-G2 | Kittl canvas: Garment board, Mockup / AI image / AI video / Artboard / **Tech pack** boards and connectors; labelled rail (v3.2, from the real editor): **Products** · Templates · Text · Illustrations · AI Gallery · Mockups · Uploads | More (pinned apps: Brand, **Team**, Pinterest; Featured: Bulk Mockups, Shopify, QR, Names and Numbers) · Learn · Layers · Help; right panel (Share · Export · **Order**, project colours, Tools, inspector by selection); prompt bar (+ · mode incl. **Ask Knitwright** · model · aspect · count) and 4-group dock; New Project opens **Choose Artboard Size** with a **Products** tab |
| 13 | **Order drawer** (in the editor) | Printify "Select sizes" + "Product created" | F-S7, F-T5, F-T6 | Tabs **Sample · Run · Team store · Quote PDF**. Sample: up to 3 sizes, price, date. Run: size rows × qty × tier price, total, delivery date. Team store: open/close dates, roster, club margin, link + QR. Quote: download PDF |
| 14 | **Projects** `/projects` | Kittl Projects + Fabra home | F-S9 | **v3.7:** Kittl Projects page. Top tabs Recent · Projects · AI Creations; sub-tabs Projects · Folders · Shared · Trash; sort + search; New project card, project cards with artboard count, tutorial cards. AI Creations = masonry of generated images. **Recent** keeps the v3.6 home: "Good evening" + dashed cards (Start a new design, Browse products and templates, Mood board, Range plan, Repeat print) + Jump back in chips. Grid with chips All · Kit designs · Launch packs · Tech packs · Collections |
| 15 | **Orders** `/orders` | Kittl list style + Printify orders | F-T7, F-S7, F-S10, F-O status | **v3.5:** team / bulk discount banner, settings strip, status chips, date and customer columns, empty state. Tabs **Orders · Samples · Collection plans · Quotes**. Orders table: number, product, qty, total, status pill (Paid · In batch · At factory · In production · QC passed · Shipped · Delivered), date. Row → tracking timeline + QC photos. **Collection plans** → line-plan table (style, group, status, colourways, qty, unit cost from tiers, wholesale, RRP, margin) with a totals bar |
| 16 | **Store** `/store` | Kittl list/cards | F-L5, F-L6, F-L7, F-T6 | **v3.5:** tabs Overview · Sales channels · Branding · Settings · Payouts (screens 24–25). Earlier tabs **Storefronts · Drops · Team stores · Channels · Payouts**. Storefront card (domain, products, sales). Drop card (countdown, pre-orders vs target). Team store card (closes in, sizes collected 18/25, club margin). Channels: Shopify Connect, Etsy (soon), TikTok (later). Payouts table |
| 17 | **Team** `/team` (club workspaces) | — (addition, same list style) | F-T3, F-T4, F-T8 | Tabs **Roster · Approvals · Seasons**. Roster table (name on shirt, number, size, status) + Add player, Sign-up link, Import CSV. Approvals: committee link, votes per version, comments, Approve |
| 18 | **Brand** `/brand` | Screenshot 01 (empty) + Video 5 (filled) | F-S9 | Empty: "Your brand, applied seamlessly", URL field, **Import**, OR, **+ Create new**, video on the right. Filled: tabs Overview · Logos · Colors · Fonts · Graphics · Visual style · Sportswear |
| 19 | Settings `/settings` | Kittl | — | Account, Plan & billing, Get more credits, Members, Units (mm default for garments) |
| 20 | **Factory job page** `/job/:token` | — (outside the Kittl shell, simple page) | F-O2 | Job sheet, files ZIP, status buttons, photo upload. Plain layout |
| 21 | **Ops console** `/ops` (internal) | — | F-O1, F-O3–F-O6 | Separate internal app with tables. Not part of the Kittl copy |
| 22 | **Category page** `/products/:category` (v3.5) | Printify category page | F-S8 | Grey hero + breadcrumb; sub-category chips with thumbs; filter bar (Sport, Decoration, Fit, Fabric, Production class, Price, Sort); 4-column grid of product cards (badge, From £x, From £y with Studio Pro, sizes · colours); pager |
| 23 | **Listing editor** `/products/:id/listing` (v3.5) | Printify product details / publish | F-L5, F-L1, F-T3 | Section tabs Mockups · Listing details · Personalization · Pricing · Publishing; Mockup library modal; AI Improve listing; GPSR table; names and numbers; cost / price / profit per size + price histogram; channel radio cards; preview + Listing health; sticky Save as draft / Publish |
| 24 | **Sales channels** `/store/channels` (v3.5) | Printify "Connect store" + modal | F-L5, F-L6, F-T6 | Channel cards: Shopify, Etsy, TikTok Shop, Knitwright team store, WooCommerce, API / CSV. "Connect to a sales channel" modal |
| 25 | **Store settings + Branding** `/store/settings`, `/store/branding` (v3.5) | Printify store settings, Branding | F-L5, compliance | GPSR (Completed by Knitwright / Needed from you), EPR (Germany LUCID, France Triman, UK). Branding: packing inserts, neck labels, hang tags, gift messages with costs |
| 27 | **Garment Studio** `/studio/:designId` (v3.6) | Fabra unified editor | F-S3, F-S4, F-S5, F-T5 | Library column (Knitwright library, club library, tools) · library panel (fabrics, colours, repeats, graphics, trims) · 3D stage with 2D / 3D / tech pack switch, colourway and size pills, Fit checked · Design summary · Export panel (tech pack checklist, images, pattern, artwork, on model, flat lay) · beta welcome modal |
| 28 | **Create a new design** + **Product configurator** (modals, v3.6) | Fabra "Create a new design" + product modal | F-S8, F-S3 | Products · Templates · Kit from crest · Import pattern (Class B). Configurator: sleeve, collar, fit, length chips, 🔒 for options not yet sampled, CREATE MY DESIGN → Garment Studio |
| 29 | **Upgrade to export tech packs** (modal, v3.6) | Fabra "Upgrade to access Tech Packs" | F-T5, billing | Monthly / Yearly · Free / Starter / Studio Pro with tech pack export limits; ordering through Knitwright needs no export |
| 30 | **Tech pack editor** (Garment Studio, Tech pack view, v3.7) | Fabra V2 tech pack | F-T1–F-T5 | Tabs Overview · Body · Measurements · Materials · Callouts · Artworks · Labels · mm / cm / in · points A–H and numbered callouts on the 3D view · graded XS–3XL with tolerance, sample M · 🔒 QC-only rows · Check fit · Preview sheets |
| 31 | **Tech pack sheets** (modal, v3.7) | Fabra exported .xlsx | F-T5 | Spreadsheet preview with 8 sheets: Overview, Colourways, Measurements, Size chart, Callouts, Materials, Artworks, Labels · shared header (brand, product detail, Open in Knitwright) · Download .xlsx / PDF ♛ |
| 32 | **Range plan board** `/orders/plan/board` (v3.7) | Fabra line plan (our design) | new (no PRD ID yet; links to F-O1) | List / Board toggle · one column per drop · style cards with fabric, sizes, MOQ, target cost, status · + Add style |
| 33 | **Order detail** `/orders/detail` (v3.7) | Printify order page (our design) | F-O2–F-O5 | Items · shipment and tracking · factory QC photos · summary (subtotal, shipping, sampling, discount, total) · customer · locked design version and tech pack. Also in v3.7 (editor): font picker, version history, Print on demand artboard tab, "n more" task-bar menus |
| 26 | **Trending ideas** `/products/trends` (v3.5) | Printify trending page | F-S1 | Sport chips + masonry of sportswear trends → opens the editor |

## AI workflows at launch (screen 4 format)

| Category | Workflow | Inputs (numbered steps) | Output | Cost |
|---|---|---|---|---|
| Kit design | **Crest to kit** (F-T2) | 1 Upload crest or pick up to 3 colours · 2 Club name · 3 Sport · 4 Kit set (Home / Away / GK / all) · 5 Feel (Classic · Modern · Bold · Plain) | 6–9 validated kits → Open in editor | Free (deterministic) |
| Kit design | Retro kit remix | 1 Pick a product · 2 Era (70s / 80s / 90s / 00s) · 3 Pattern family | 4 validated variants | Free |
| Product scenes | **On-model try-on** (F-L1) | 1 Choose product (garment locked) · 2 Apply brand · 3 Model preset · 4 Scene · 5 Pose · 6 Format | 1–4 images | Credits |
| Product scenes | Flat-lay studio | 1 Product · 2 Surface (grass, concrete, white, locker room) · 3 Format | 1–4 images | Credits |
| Ads | **Kit launch ad** (F-L2) | 1 Product · 2 Apply brand · 3 Logo/crest · 4 Highlight · 5 Campaign · 6 Style · 7 Destination | 1–4 posts | Credits |
| Ads | Team store promo | 1 Team store · 2 Deadline · 3 Style · 4 Destination | Post + story + QR | Credits |
| UGC | Try-on video | 1 Product · 2 Model · 3 Setting | 5–8 s clip | Credits per second |
| Product listings | Shopify listing set | 1 Product · 2 Background | 5 images + size chart image | Credits (renders free) |
| Team & club | Matchday graphic · New signing · Fixtures · Sponsor thank-you | Template-driven fields | Posts | Free (AI copy uses credits) |
| Branding | Club brand board | 1 Upload crest/logo | Brand board image + brand record | Credits |
| Research | **Benchmark products** (F-S2) | 1 Paste 1–5 product links or photos · 2 Product type | Benchmark cards + compare view → Apply to a product | Credits |
| Tools | Change kit colour · Resize for all socials · Remove background | Single input | Image / artboards | Free or low |

## Feature coverage check (every `02` ID)

| ID | Screen(s) |
|---|---|
| F-0 | Editor (Checks in the inspector) |
| F-T1 | Templates → Editor |
| F-T2 | Workflow "Crest to kit"; Create menu "Kit from crest" |
| F-T3 | Team › Approvals; editor Share |
| F-T4 | Team › Roster; editor More › Team |
| F-T5 | Order drawer › Quote PDF |
| F-T6 | Order drawer › Team store; Store › Team stores |
| F-T7 | Orders |
| F-T8 | Team; Projects; Orders (reorder) |
| F-S1 | Creative Agent; editor prompt bar (Agent mode), AI Gallery and More › Pinterest; "Suggest from this" in the image ⋯ menu |
| F-S2 | Workflow "Benchmark products" |
| F-S3 | Products; editor Garment inspector › Options |
| F-S4 | Editor (Garment board) |
| F-S5 | Why? links in the editor, Product detail and tech pack; Ask in the prompt bar (mode: Ask Knitwright) |
| F-S6 | Tech pack board; Export panel |
| F-S7 | Order drawer; Orders › Samples |
| F-S8 | Products; Product detail |
| F-S9 | Brand; Projects |
| F-S10 | Orders › Collection plans; "Collection" template in the editor |
| F-L1 | Mockups; workflows; editor Mockup / AI boards |
| F-L2 | Marketing; workflows; editor artboards |
| F-L3 | Video Generator; editor AI video boards |
| F-L4 | Editor (boards + connectors); Marketing "Plan a launch pack" |
| F-L5 | Store › Storefronts / Drops |
| F-L6 | Store › Channels; editor More › Shopify |
| F-L7 | Store › Payouts / overview |
| F-O1–F-O6 | Ops console (internal); factory job page |
| F-G1–F-G4 | Upload checks (editor), pre-export check (Export panel), labels (tech pack), finance (ops) |
