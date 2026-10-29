# Fabra + Kittl: docs research notes (for Knitwright spec)

Researched 2026-10-28 using WebFetch/WebSearch on official pages only (fabra.com, help.fabra.com, kittl.com, help.kittl.com, kittl.com/blogs). No browser, no sign-up.
Conventions: **Bold** = exact on-screen / doc label as written in the source. "[INFERENCE]" = my reading, not stated in the source. "[NOT FOUND]" = looked for it and the official docs don't say. "[3RD-PARTY]" = from a non-official source.

Caveat: WebFetch returns a summarised version of each page, so labels are as close to verbatim as the tool allowed. Fabra's help articles are short Intercom FAQs, so many workflows are only partly documented.

---

# PART A: FABRA (fabra.com)

## A1. What it is / platform
- Browser-based 3D garment design studio. Its pitch: "Design Editor: Your whole design in one place - 3D, pattern, and tech pack in sync."
- **Fabra V2** turned it from a drag-and-drop 3D tool into an "end-to-end product design studio": pattern-level editing, 3D surface design, automated tech packs and range planning. A co-founder's LinkedIn post claims ~3,000 product templates. Sources: https://www.fabra.com/resources/article/whats-in-fabra-v2 and a LinkedIn post by Luke Grana (from search results).
- Tech: WebGPU 3D engine in the browser, nothing to install. Best on Chrome with an Apple Silicon Mac (M2 or later). Windows works, depending on the GPU. Designing is desktop-only. (whats-in-fabra-v2)
- **Fabi**: the built-in AI assistant ("your AI assistant inside Fabra") for creating new patterns, making edits and answering questions. https://help.fabra.com/en/articles/16145595-who-is-fabi
- Roadmap items marked as not shipped (V2 article): text tools, comments, custom size charts, moodboards, purchase orders, and "AI prompt-to-design" ("very soon"). [INFERENCE: some may have shipped since. The help centre has a "Can I add text to my design?" article, and the dashboard lists mood boards as a project type.]

## A2. Information architecture (dashboard)
Source: https://help.fabra.com/en/articles/16145648-how-is-the-dashboard-organized
- **Catalog**: Fabra's products and templates.
- **Workspace**
  - **Projects**: designs, range plans, mood boards, repeat prints, material and trim generation threads.
  - **Library**: brand kits, colors and colorways, uploaded graphics, generated materials, repeat prints, trims.
- **Tools**: Design Editor, Range Plan, Repeat Print Maker, Material Lab, Trim Generator.
- The features menu on the site (with Beta tags) lists Design Editor, Pattern Editing (BETA), Range Plan (BETA), Tech Pack, Repeat Print Maker (BETA), Asset Library, AI Tools (BETA).

## A3. Starting points: base products vs templates
- **Base product**: "a blank item - no colors, prints, or artwork." **Template**: "a designed version of that product, ready to remix." https://help.fabra.com/en/articles/16183624
- Three ways to start: (1) base product or template, (2) draft a pattern from scratch, (3) upload a DXF (paid). A fourth, "prompted" designs, appears in help titles. https://help.fabra.com/en/articles/16145660 and /16158545
- Starting from scratch: choose an avatar or size chart, then import a DXF or draft. "Make sure the pattern has sew lines before simulating." (features/pattern-editing FAQ)
- **Save as Template** stores a design in your account to reuse, remix or share. (features/asset-library)
- You can switch a design from one template to another (help article "Can I switch from one template to another?"; body not fetched).
- Categories: Streetwear, Merch, Sportswear, Athleisure, Swimwear, Kidswear, Sleepwear, Women's RTW (NEW), Men's RTW (NEW), Denim (NEW), plus bags. https://help.fabra.com/en/articles/16183672
- **Sportswear/athleisure**: the category pages are marketing copy only, and the catalog is JS-rendered, so no individual SKUs (leggings, bra, etc.) could be listed. [NOT FOUND]
  - Sportswear page hero: "Design your sportswear range." It says performance panels, ergonomic seams and technical fabrics are hard to judge on a flat sketch, and promises to "spec every zone and stitch". https://www.fabra.com/category/sportswear
  - Athleisure page hero: "Build your athleisure collection." Subhead: "Four-way stretch, flatlock seams, and second-skin fits don't translate on paper." https://www.fabra.com/category/athleisure
  - The materials library lists digital fabrics including cotton, mesh, fleece and nylon. Material Lab examples include "iridescent mesh" and "ribbed cotton jersey".
  - Both pages use the same 3-step framing: **Design** (start from a base, upload a pattern or draft your own, refine in 2D/3D) → **Plan** (map the collection, calculate costs) → **Produce** (download tech packs, share in the cloud).
- Only "simulation-ready (editable)" products allow fit edits. A note says so when you open one. https://help.fabra.com/en/articles/16183494

## A4. Design Editor
Sources: https://www.fabra.com/features/design-editor, https://help.fabra.com/en/articles/16159103, /16158545
- **Views**: **2D pattern**, **3D**, **Tech Pack**. You can show up to **two at once** in any combination and drag them to rearrange. "Any toolbar works with any view": for example, drag an asset onto the 3D model or into the Tech Pack's Bill of Materials.
- Editing domains: **Form** (shape/silhouette), **Surface** (graphics, prints, materials), **Tech Pack**.
- The left toolbar holds **Form tools**, **Spec Mode**, and the **Library** toolbar. A **2D/3D toggle** sits bottom-right. The **Simulate (Play)** button is also bottom-right. A **configuration panel** shows the materials applied per pattern piece.
- Surface: "Click any panel, trim, or surface to change its material, print, or color." In-editor **recommendations** suggest materials, trims, colors and prints for the current product, which you drag from the panel onto the garment.
- Graphic tools: **Convert to repeat** (artwork or logo to a seamless tile), **Remove backgrounds** (one click), **Recolor a repeat**. Background removal and convert-to-repeat are paid features. https://help.fabra.com/en/articles/16185665
- Graphics in both views: placing a graphic in 2D updates 3D instantly, and vice versa. You can preview artwork as **embroidery** or **puff print** (V2 article).
- **Edit Graphic** panel (right side, opens when a graphic is selected): **Width**, **Height**, **X/Y Position**, **Rotation** (degrees). On canvas you get a bounding box, corner handles to resize, a rotation handle above the graphic, and drag to move. [NOT FOUND: units for width and height. The marketing copy says "Print and graphic scaling with real-world dimensions".] https://help.fabra.com/en/articles/16183498
- Uploads go to **Library → Your Workspace → Graphics**. Accepts PNG, JPEG and SVG. SVG stays vector and can be recolored. A repeat tile uploaded as a graphic can be converted with the **"Convert to Repeat"** button. https://help.fabra.com/en/articles/16183765
- Colorways: add colorways and toggle between them live in the editor. Save them and manage them on the dashboard **"Colorways" page**, then reuse them across designs. A **color palette** is "a loose set of colors". A **colorway** is a full color/print recipe applied to specific design zones. https://help.fabra.com/en/articles/16159115 and /16183740
- Sizes: 11 sizes each for women's and men's adult sizing, based on US standard charts. Custom size charts are "Not now". They are planned, and you'll be able to build one from a Fabra base, from scratch, or by importing Excel. https://help.fabra.com/en/articles/16183041 and /16183755

## A5. 2D pattern editing ↔ 3D (Pattern Editing, BETA)
Sources: https://help.fabra.com/en/articles/16183540, /16183557, https://www.fabra.com/features/pattern-editing
1. Open the **Form tools** in the left toolbar. You can edit in the 2D pattern view ("more precise") or directly on the 3D garment.
2. **Cursor Tool** (also called the **Select** tool in another article): select and drag pattern points and segments, and reshape with **control points**.
3. **Draw Tool**: draw new pattern pieces or shapes, then refine them with the Cursor Tool.
4. **Symmetry**: select a piece and apply symmetry so edits mirror.
5. Connect every **sew line** (the engine needs these to know which edges join).
6. **Place Garment** positions the pieces around the 3D avatar.
7. **Simulate (Play)** (bottom-right) drapes and re-simulates.
- Marketing claims: point-by-point seam and curve edits; garment-level edits (lengthen sleeves, raise collars, ease fit); grading; live 3D preview of every change.
- Measurement changes flow into the Tech Pack automatically.
- **DXF**: import a patternmaker's block (paid), which simulates in 3D. Each import counts toward the design quota. A DXF is stored only inside its design, not as a reusable asset. DXF export is on Starter and Pro. [NOT FOUND: AAMA/ASTM variant, file limits.] https://help.fabra.com/en/articles/16185487
- No full 3D model export (GLB/OBJ) of designs. Exceptions: Trim Generator trims as **GLB** (paid), and Material Lab materials as a zip of texture PNGs. https://help.fabra.com/en/articles/16185521

## A6. Materials, prints, trims, assets
- **Asset Library** types: Materials, Color palettes, Trims ("coming soon" on one page), Graphics, Repeat prints. Expert-curated, royalty-free, and "meant for manufacturing". https://www.fabra.com/features/asset-library
- **Repeat Print Maker** (BETA, Starter and up). Inputs: library motifs, your uploads, or drawing with **Pen tool**, **Paintbrush tool**, **Pencil tool** and **Shape tools**. Repeat types: **Standard**, **Half-brick**, **Half-drop**, **Mirror**. Export as **Single Tile** or **Repeatable Format**. Vector prints can be recolored. https://help.fabra.com/en/articles/16184041
- Applying a material: drag from Library onto a pattern piece or panel. It is auto-added to the BOM.

## A7. AI tools (BETA)
Sources: https://www.fabra.com/features/ai-tools, help collection 19703823
| Tool | Input | Output | Flow |
|---|---|---|---|
| **Material Lab** | Text prompt only (e.g. "brown cowhide leather", "washed denim", "ribbed cotton jersey", "iridescent mesh") | **3 options** per generation | Prompt → review 3 → click to preview → **Publish** → appears in **Your Workspace → Materials**. Paid plans can download a zip of PNG texture maps. |
| **Trim Generator** | Text (e.g. "matte black metal zipper", "4-hole tortoiseshell button", "brushed brass buckle") | **3 options**, 3D trims that simulate on the garment | Prompt → 3 options → preview → **Publish** → **Your Workspace → Trims** → drag onto the product. GLB download on paid plans. |
| **Photo Shoot Export / Styled model export** | Choose **flat lay** or **model**, then describe a pose/scene or upload a reference image | AI marketing images (lookbook, ecom, social) | Export from the design. [NOT FOUND: resolution, format] |
| Standard 3D thumbnails | n/a | Front/back/left/right renders | Free plan: low-res plus watermark. Starter and Pro: high-res. |
- Material Lab and Trim Generator runs are "threads": they're saved as projects and shareable. [INFERENCE: chat-like history of generations]
- **Credit costs**: no numbers are published. Relative order from cheapest: trims < materials < AI exports (model shots/flat lays) are the most expensive. Another article ranks requests: simple changes/questions < iterating on a design < full designs from scratch. "Exact costs may evolve." Failed generations that error are not charged. Articles exist for "Can I see how much a generation will cost before I run it?" and "Can I see my credit balance and usage?" (bodies not fetched). https://help.fabra.com/en/articles/16184263, /16185897, /16184388

## A8. Range Plan / Line Plan (BETA)
Sources: https://help.fabra.com/en/articles/16184473, /16184475, /16184617, https://www.fabra.com/features/range-plan
- **Range Plan board**: a visual whiteboard. Open the **right toolbar → Designs** (recent designs) and drag a design onto the board. Group, compare and balance styles, with colorways side by side. You can jump back into the Design Editor from the board.
- **Range Plan / Line Plan toggle** (at the top) switches to the table view.
  - Rows expand **style → colorway → size**.
  - Quantities can be entered at any level. Enter a style total and split it later, or enter per colorway and let the **size curve** fill sizes, then adjust. Totals roll up. Unallocated quantity stays visible.
  - Prices: **cost**, **wholesale**, **RRP**. Set once per style. Colorways can override.
  - **Split** cell: allocates units across **Wholesale / DTC / Gifting**.
  - **Summary bar** (bottom): total units, buy cost, revenue per channel, projected blended profit. Margins are shown.
  - Codes, fabrics and colorways are pulled from the tech pack (no re-entry).
- **Design status**: concept → development → sampling → production.
- You can duplicate a range, rework it, and drop styles that didn't sell.
- **Line Sheet**: appears only as a pricing-table row (Free: none, Starter: 1 board, Pro: unlimited). [NOT FOUND: no docs. INFERENCE: probably a presentation/export of the range plan.]

## A9. Brand Kits
- "A reusable collection of design assets": graphics, color palettes, materials, repeat prints and other frequently used assets. Custom ("self-curated") Brand Kits are Pro-only (unlimited). No creation steps are documented. https://help.fabra.com/en/articles/16183748

## A10. Tech Pack (automated)
Sources: help collection https://help.fabra.com/en/collections/19703829-tech-packs, https://www.fabra.com/features/tech-pack
- **Generation**: in the Design Editor, toggle to **"Tech Pack"**. It's auto-created and linked live to the design, and every design type gets one. Base-product and template designs come largely pre-populated (POMs, construction callouts). Scratch and DXF designs get an empty tool, and you add the POMs and callouts yourself.
- **Sections** (docs and feature page): **Cover sheet**, **Materials / Bill of Materials (BOM)**, **Measurements** ("Measurement lines", "Size charts"), **Construction callouts**, **Artworks** (Artwork page). It also includes 3D previews. The BOM is a tab ("Go to the **Bill of Materials** tab" in **Tech Pack View**). [INFERENCE: these sections are tabs inside Tech Pack View.]
- **Spec Mode** (left toolbar): **Measurement Tool** draws measurement points/lines directly on the garment (2D or 3D). **Callout Tool** adds construction callouts and technical annotations.
- **BOM** can be filled 3 ways: (1) automatically from applied material, color, print and trim; (2) drag from the **Library** toolbar into the BOM (spares, alternate fabrics); (3) custom line items for packaging, polybags, hangtags, swing tickets, tissue, care labels. Specs default to "industry-standard". [NOT FOUND: BOM column names]
- **Measurement chart**: spreadsheet-like, with a row per **Point of Measure (POM)** (chest width, body length, sleeve length...) and a column per size. The example uses **cm**. [NOT FOUND: inch toggle]
  - **Sample size**: the reference size. It defaults from the **linked size chart** (e.g. "US Missy Straight") and can be changed per design. Changing it asks for confirmation and regrades everything, but keeps overrides.
  - Linked body size chart: supplies the size range and body measurements. A product can use a subset of its sizes.
- **Measurement View vs Grading View**: the same data shown two ways, both editable. Measurement View shows absolute values (S 52 / M 54 / L 56). Grading View shows deltas from the sample (−2 / 0 / +2). The sample is always 0.
- **Three grade types** (per POM):
  1. **Autograding**: derived from the linked body size chart and live-linked to it. Fabra also suggests values for POMs with no body equivalent (flag these for review). **Promote** turns an autograde into an editable manual grade and unlinks it.
  2. **Linear grading**: one value in the **Grade** column (e.g. +2 cm → 20/22/24/26).
  3. **Non-linear grading**: per-size deltas edited in Grading View (e.g. S −1, M 0, L +2, XL +5). Used for extended sizing.
- **Overrides**: type into a single cell and only that cell changes. Overrides persist through grade-rule or size-chart changes. Conflicts are highlighted for review.
- **Measurement source labels**: **Autograded**, **Manually graded**, **Overridden**.
- **Paste from Excel**: paste into Measurement View (absolute) or Grading View (deltas, sample column must be zeros). Fabra detects a mismatch and offers to switch view. It asks for confirmation before overwriting manual or overridden values.
- **Tolerances**: [NOT FOUND] Not mentioned anywhere in Fabra's help, feature pages or articles. Treat tolerance as a gap or opportunity. Industry rule of thumb (third-party): tolerance ≤ ½ the grade.
- **Export and sharing**: **Excel (.xlsx)** is the only tech-pack format documented ("Tech packs are exportable in Excel format"). [NOT FOUND: PDF export, despite the brief.] Artwork download from the Tech Pack is a paid feature. A **live shared link** to the Tech Pack is available, but the factory needs a Fabra account to view it, while exported files need no account. Viewing and downloading a shared Tech Pack needs a paid plan. Quotas: Free 0, Starter 5/month, Pro 30/month.
- After export, design changes keep syncing to the live Tech Pack (article: "What happens if I update the design after exporting the Tech Pack?"). [INFERENCE: you must re-export to get an updated file.]

## A11. Sharing and collaboration
- **Share** (top-right) → **Link** icon to copy a link, or invite by email. Per-person **View** or **Edit** (elsewhere called "View only" / "Full edit"). Revoke from the same panel. Shareable objects: design, range plan, repeat print, Material Lab thread, Trim Generation thread. Live co-editing works. Comments are "coming soon". Free-account viewers don't use up design quota. https://help.fabra.com/en/articles/16185668, /16185740

## A12. Pricing and credits
Source: https://www.fabra.com/pricing (fetched 2026-10-28)
| | Free | Starter | Pro |
|---|---|---|---|
| Price | $0 | $15/mo or $12/mo yearly ($144) | $50/mo or $33/mo yearly ($396) |
| AI credits | 300, "updated yearly", never expire | 2,000/mo (reset, no rollover) | 5,000/mo |
| Designs | 3 (replaceable) | Unlimited | Unlimited |
| Tech Pack exports | none (view locked) | 5/mo | 30/mo |
| Thumbnails | watermarked, low-res | high-res | high-res |
| DXF import/export | no | yes | yes |
| Range Plan / Line Sheet | none | 1 board | unlimited |
| Repeat Print Maker | ? | yes | yes |
| Custom Brand Kits | no | no | unlimited |
- Top-ups (paid plans only, never expire): 1,000 credits for $15, 5,000 for $60, 10,000 for $100.
- Note: the V2 article shows older Starter pricing ($25/mo or $16.50/mo yearly). The current pricing page shows $15/$12.
- Downgrade: your 3 most recent designs stay editable and the rest are locked. Refunds: 3 days (14 days for annual), plus EU/UK statutory rights.

---

# PART B: KITTL (kittl.com)

## B1. Editor and canvas
Sources: https://www.kittl.com/features/editor, https://www.kittl.com/features/infinite-canvas, help.kittl.com/editing-and-design/*
- **Infinite Canvas** holding unlimited **artboards**. Each artboard has custom dimensions or a preset set in the top bar, and supports guides, rulers, margins and bleeds. You can pin or lock content to an artboard. Artboards can be grouped by format (e.g. front and back print plus social posts plus mockups on one canvas).
- Vector suite: **Pen tool**, **Shape builder** (merge/subtract/intersect), anchor point controls, rounding corners, shape tools, clipping masks, textures, object shadows. Text: live text engine, 1,400+ fonts plus Monotype, glyphs panel, **Text Effects**, text transformations, custom font upload (paid).
- Layers, version history, keyboard shortcuts, the **Apps** panel (left toolbar).
- Contextual toolbar plus right panel **Tools** section (Mockup, AI Image Board, AI Video Board, Reframe, Remove Background, Edit Area, Erase & Fill, Vectorize, Upscale).
- Collaboration: **Share** (top-right next to Export), with a **Link** tab ("Anyone with a link can view/edit", "Only invited users can access") and an **Invite** tab (Can view / Can edit, Pending). Roles are Owner, Can edit, Can view. Viewers see a "Request edit access" button. Comment tool (C key) drops pins, with a Comments panel. Live avatars appear top-right. https://help.kittl.com/editing-and-design/real-time-collaboration

## B2. Template library
Source: https://help.kittl.com/editing-and-design/templates
- Category tabs: **Discover, Merchandise, Marketing, Social, Stationery, Branding, Business, Covers, Creative Flows, Videos**. Subcategories add filters for themes, styles and colors, plus sort. Curated rows include **For You** and **Trending Now**. Search shows style and category chips.
- Hover a template → **Use Template**. The preview shows creator, views, likes, comments, a heart (Likes) and share, with flip-through for multi-artboard templates. Inside a project, the Templates panel offers the three-dot menu → **Add to Project** / **Open in New Project**.
- Premium is marked with a crown icon (Pro, Expert, Max). POD templates come pre-sized per product.

## B3. Mockup generator
Sources: https://help.kittl.com/editing-and-design/mockup-generator, /create-mockups-from-your-dashboard, https://www.kittl.com/tools/mockups, /t-shirts, /sweatpants
- **In-editor flow**: select an artboard → open **Mockups** (left toolbar), **Mockup** (contextual toolbar) or **Tools → Mockup** → pick a scene. The mockup is placed on the canvas and **linked to the artboard**. Select the mockup to enter edit mode, drag to reposition the design inside the frame, and use corner handles to scale. **Mockup Color** changes only the product color. **Match Artboard Color** and the "minus" next to Color make the artboard background transparent. You can attach unlimited mockups to one artboard, and all of them **update in real time** when the artboard changes. If no artboard is selected, the mockup is inserted as a placeholder artboard.
- **Dashboard flow**: **Mockups** in the left menu → browse a category or search (**View all**) → **Upload** or drag a file, and it's applied to all mockups in view for side-by-side comparison → hover a card for **Edit** / **Download**, or open the modal for color picker, **Replace** (swap the design on one mockup) and **Delete** → checkboxes for **bulk download** → **Open in editor** for reposition or background removal.
- **Realism**: an "auto-wrap engine" / "design wrap". Designs "naturally adapt to the contours of the fabric", "follow folds and angles", and show natural folds and wrinkles. Real product photography. [NOT FOUND: user-facing displacement-strength controls. INFERENCE: displacement is baked into each mockup template.]
- **Mockup categories**: Billboard, Bottle, Brochure, Business Card, Candle, Can, Frame, Greeting Card, iPhone, Laptop, Magazine, Mug, Sticker, **Sweatpants**, Tag, **Tote Bag**, **T-shirt**, Tumbler, Wall, Website, Book, Poster, Instagram. Apparel variants: T-shirt in black, white, blank, oversized, polo and long sleeve, **on model or flat lay**, **front/back**. Hoodies appear in POD copy and Flows variants. [NOT FOUND: dedicated leggings, sports bra or jersey mockup category]
- Output: the sweatpants page says downloads are 3000×3000 px, watermark-free. Previews are low-res, and high-res needs a paid plan (pages conflict a little). 10,000+ premium templates and mockups on paid plans.
- **Regenerate / AI mockups**: mockups added in **Flows** are free (no tokens). The **Printful app** lets you "drop Printful mockups onto the canvas and generate new colors and angles". The **Bulk Mockups** app applies one design to many products and color variants at once. Within Flows, **Regenerate** reruns a board with its current inputs.

## B4. AI image generation and variations
Source: https://help.kittl.com/ai-tools/ai-image-generation
- Entry points: **AI Mode** (bottom toolbar) or **Tools → AI Image Board**. The mode selector offers **Agentic AI / Generate Image / Generate Video**.
- Controls: model picker (each model lists strengths and token cost, e.g. "ChatGPT Image 2". The Flows page mentions Nano Banana and Seedream 4. AI Workflows mention Recraft V4), aspect ratio (1:1, 16:9, 9:16, **Match input**), **number of images up to 4** (variations).
- **+** menu → **Browse styles** (Clipart, Vector, Photo, Logo, Artistic, Typography, Design, Pattern) with **Auto-apply model**. **Your Styles** takes uploaded style images. **Upload images** adds references from uploads, My AI Creations, a brand kit or Pinterest. Also **Prompt presets**, **Prompt builder** (Style, Lighting, Colors...) and a magic wand to enhance the prompt.
- After generating, the contextual bar offers **Remove BG**, **Remix**, **Generate Video**. Tools: Reframe, Edit Area (brush plus prompt), Erase & Fill, Vectorize, Upscale, Layerize Image. History lives at **AI Gallery → My Creations** (Recreate, Remix Image, Add to Project).
- Free-plan generations are public (AI Gallery Explore). Paid plans can keep them private.
- **Agentic AI** (beta, editor only): one plain-language prompt, and it picks the model, prompt, style and format. Up to 4 variations. About **20 tokens per image** and about **35 tokens per second of video**. https://help.kittl.com/ai-tools/use-agentic-ai
- **Creative Agent** (dashboard → **AI Studio → Creative Agent** tab): a chat that asks clarifying questions (**Skip** / **Surprise me**), takes up to 10 reference images, has an **Apply Brand** icon and quick-start tiles (**Product Shooting**, **Ad Creation**, **Design a Logo**). It suggests next steps under "What should we do next?". Edit tools: Remove Background, Edit Area, Layerize Image, Vectorize, Upscale, Add Text. Memory is per chat only. https://help.kittl.com/ai-tools/use-creative-agent
- **Reframe**: outpaints to 1:1, 16:9, 9:16, 4:3, 3:4, 2:1, 1:2 or Custom. Input 256–1440 px. No prompt. **20 tokens**. https://help.kittl.com/ai-tools/reframe
- **Background Remover**: free, no tokens, all plans. Results are saved to Uploads > Clipped Images, and **Edit cutout** has a **Restore** brush.
- Editor marketing also lists **Create Icon Sets** (up to 6 consistent visuals).

## B5. Video / animated content
Source: https://help.kittl.com/ai-tools/kittl-video
- Canvas: AI icon → **Generate Video**, or dashboard **AI Studio → Video Generator** (or **+ Create → Create Video**). Settings: model (per-second token cost shown, e.g. Veo 3.1 Fast), aspect ratio (16:9, 9:16...), duration ~3–30 s, **with audio / no audio**, frame mode: **Frames to Video** (start and end frame) or **Reference Mode** (multiple references).
- Input can be a design, photo, **mockup** (put the design in a scene, then animate it = an "animated mockup"), or text.
- Cost examples: 4 s Veo 3.1 Fast with audio ≈ 120 tokens. 8 s Veo 3.1 with audio ≈ 640 tokens.
- Output: MP4 tiles on the canvas. No timeline, trimming or keyframes. The **GIF Maker** app combines assets into a GIF.

## B6. Kittl Flows (node/board automation on the canvas)
Source: https://help.kittl.com/ai-tools/kittl-flows, https://www.kittl.com/features/ai/flows
- Board types: **Artboard** (the source, which the design must sit inside), **AI Image Board**, **AI Video Board**, **Mockup**.
- Start: select an artboard → contextual toolbar or **Tools** → pick a board type. The new board appears beside it, **linked by an arrow** that carries the design context and reference.
- Connect and chain: hover the right edge of any board → click the **connector dot** → **"Add..."** menu → choose a type. Any board can branch into many, so you get chains or trees.
- Generate per board: prompt + model + aspect ratio (+ duration and audio for video), optional **Enhance Prompt**, then the arrow button. The board shows a loading state, then the result in place.
- Actions: **Regenerate** (rerun against current inputs), **Convert to Image** / **Convert to Video** (flatten to an editable asset), **Upscale**, **Reframe**. Multi-select boards to run several at once. Right-click to **set as project thumbnail**. The download icon opens **Quick Export**. Everything is saved to **My Creations**.
- Dependencies: downstream boards must be regenerated after their parent finishes (no auto-cascade). Troubleshooting: follow the incoming arrow to find the source. A mockup added from the left toolbar creates a blank placeholder, so add it from the artboard connector instead.
- Cost: mockup boards are free. AI boards use tokens. Flows was "available for free for a limited time".
- Use cases: one-click variations (colors, themes, styles), sketch → design with Image Boards, design sets (icon packs), and POD variants (t-shirt, hoodie, mug, tote, sticker from one base). Templates have a **Creative Flows** template category. [NOT FOUND: a list of Flow templates]
- Related: **AI Workflows** are curated presets in **AI Hub** ("Start a workflow": Merchandise, Videos, Mockups, Product visuals, Tools, Branding). The marketing page lists T-Shirt Designs, Product Visuals, Product Mockups, Ads and Promotions, Social Media Content, Product Labels, Logo Designs, Vector Graphics. Guided inputs, shows the model (e.g. Recraft V4), count up to 4, Generate shows the total token cost, results run in the background with per-tile timers, then Edit / Download / Edit in New Project. https://help.kittl.com/ai-tools/use-ai-workflows-on-your-dashboard

## B7. Brand Studio
Sources: https://help.kittl.com/editing-and-design/set-up-and-apply-your-brand, https://www.kittl.com/features/brand-studio
- **Import from URL**: dashboard brand selector → **Add brand** → paste the website, store or brand page (Shopify, Etsy, WooCommerce, most stores) → **Import**. Runs async and notifies when ready. Extracts **color palette**, **fonts** (closest library match if not available), **logo** (add manually if not found), **graphics**, and **visual style** (from images on the page). Review and edit afterwards.
- Manual: **Create new** or copy a preset. Tabs: **Logos** (PNG/JPEG/SVG/WEBP, several allowed), **Colors** (named palettes, e.g. primary and accent), **Fonts** (roles, e.g. Headline → typeface and style), **Graphics**, **Visual style** (**Define style** needs **≥5 reference images or videos**, then Kittl writes a **Setting**, **Art direction**, **Rules & boundaries**). A progress % shows with a "Next step" card.
- **Tone of voice** is listed as part of a Brand, and Creative Agent uses "tone". [NOT FOUND: how tone is captured or edited]
- Applying it:
  - Editor color picker and font panel **Brand** tab. The left-panel **Brand** panel lets you drag logos and graphics. Brands can be switched per project.
  - **Apply Brand to artboard**: select the artboard → contextual **more** menu → **Apply Brand** → pick one. Swaps colors and fonts across the artboard. **Not live-linked**, so you must reapply after brand edits.
  - **Add to Brand** from the canvas (••• menu) saves an image as a logo or graphic.
  - AI Workflows: the **Apply your brand** toggle is on by default in on-brand workflows (e.g. Product Listing Premium, Home & Beauty, Color Pop, Raw Stone, **Fashion & Apparel**). It uses only the visual style for generation, and you add logos, colors and fonts afterwards. **Try in AI Workflows** button.
- Plans: one brand kit is free on every account. Multiple brands need a paid plan.

## B8. Export
Source: https://help.kittl.com/editing-and-design/download-settings
- **Quick Export** (contextual toolbar, current selection): PNG, JPEG, SVG, PDF, MP4. Size **1× / 2× / 3×**. PNG keeps transparency. Whole artboard selected → **Advanced Settings** link.
- **Export panel** (top-right **Export**): artboard dropdown (all or specific), width and height in project units (**px / in / mm**), **DPI** (300 for print, not for SVG), resulting pixel size shown ("Mix x Mix" for mixed sizes). Format: PNG/JPEG (digital), SVG/PDF (print). Color: **RGB** or **CMYK** (PDF and JPEG only, converted at export, with a "Printed colors may vary" notice). **Remove background** (transparent) and **Optimize quality** are premium. Multiple artboards download as a zip. PDF has **Combine artboards into one file**. File name is "[project] - [artboard]".
- Limits: Free = PNG/JPG max **800 px @ 72 DPI**. Pro/Expert/Max = **10,800 px @ 300 DPI**. SVG has no cap. Mobile is capped at 4096². Texture overlays break transparency. Only content inside the artboard exports (or enable **Clip content**).
- POD guidance (marketing): T-shirt front ~12×16 in (3600×4800 px @300), hoodie 11×14 in (3300×4200), mug wrap 9×3.5 in, tote 14×16 in. Etsy listing images use a square canvas. https://www.kittl.com/solutions/print-on-demand

## B9. Integrations (Apps panel)
Source: https://www.kittl.com/blogs/connect-your-apps-to-kittl/
- Editor **Apps** (left toolbar) → browse → connect.
  - **Printful**: browse the catalog, start from a blank product (artboard auto-sized to its print area), drop Printful mockups and generate new colors and angles, send the design to Printful as a print file, and reopen products you've made.
  - **Printify Extension** (privacy page https://www.kittl.com/privacy/apps/printify): browse the catalog, create products, push designs to your Printify library, and import Printify mockups.
  - Also **Pinterest**, **Bulk Mockups**, **Dropbox**, **Pexels**, **QR Code**, **GIF Maker**, **POD Presets** (per-platform sizes), **Search Content** (search/replace).
- **Etsy, Amazon, Shopify**: export-and-upload only (no native connector found). **Kittl MCP connector** (https://www.kittl.com/mcp) connects external assistants (Claude, ChatGPT).

## B10. Pricing and tokens
Sources: https://help.kittl.com/ai-tools/tokens, plan articles under help.kittl.com/subscription-billing/*, https://www.kittl.com/pricing
| | Free | Pro | Expert | Max (ex-Business) |
|---|---|---|---|---|
| Price [3RD-PARTY, softwares.com, read 2026-10-11] | $0 | $15/mo or $12/mo yearly | $35/mo or $26/mo yearly | $65/mo or $48/mo yearly |
| Tokens (per editor) | 100 one-time | 2,000/mo | 6,000/mo + 200/day (≈12k) | 12,000/mo + 600/day (≈30k) |
| Export | PNG/JPG 800px@72dpi | 10,800px@300dpi, SVG/PDF, transparent | same | same |
| Storage | 500 MB | 10 GB | 100 GB | 1 TB |
| Projects | 5 active | unlimited | unlimited | unlimited |
| License | personal only | commercial ≤500k copies | ≤500k | Enhanced, no limit |
| Premium templates/mockups | no | yes | yes | yes |
- Daily tokens reset at midnight UTC and are spent first. Monthly tokens reset on your purchase day. No rollover. Purchased extra tokens never expire (2,000 for $16 [3RD-PARTY via search]). Failed generations are refunded automatically. Cost is shown on hover over send/Generate. Top-up paths: **Settings → Plan & Billing → Get More Tokens**, or (Expert) **AI Tokens** in the bottom toolbar. Viewers are free, and extra editors are charged per plan.
- The official pricing page didn't render per-plan prices through WebFetch ("save up to $200" yearly). Verify the third-party prices.

---

# PART C: Patterns worth copying for Knitwright (my synthesis, INFERENCE)
1. **Fabra's two-pane view switcher** (2D / 3D / Tech Pack, any two, draggable) plus "any toolbar works in any view" (drag a material into the 3D view or into the BOM).
2. **The Fabra grading model**: POM rows × size columns. Measurement/Grading dual views over the same data. Per-POM grade type (Autograde from a linked body chart / Linear via a Grade column / Non-linear). **Promote** to unlink. Per-cell **Overrides** that survive regrades and flag conflicts. Source labels (Autograded / Manually graded / Overridden). Smart paste from Excel that detects absolute vs delta values. Changing the sample size triggers a confirm-and-regrade. **Add tolerances (Fabra lacks them).**
3. **Auto-BOM** from applied materials and trims, plus drag-from-library and custom lines (packaging, labels).
4. **Spec Mode** with Measurement Tool and Callout Tool drawn directly on the garment.
5. **The AI generate → 3 options → Publish to Library → reuse** loop (Material Lab / Trim Generator), stored as shareable "threads".
6. **Range Plan board ↔ Line Plan table** (style → colorway → size rows, size-curve fill, channel Split, summary bar, status pipeline).
7. **Kittl's artboard-linked mockups** (many mockups per artboard, live update) and the **Flows** connector-dot chaining (Artboard → Mockup → AI Image → AI Video, Regenerate, Convert to Image/Video). Mockups free, AI costs tokens.
8. **Kittl Brand import from URL** (async, review step), Visual style from ≥5 refs, **Apply Brand** per artboard (not live-linked), and an "Apply your brand" toggle in AI presets.
9. **Kittl's export panel** (units px/in/mm, DPI, RGB/CMYK, transparent BG, multi-artboard zip, combined PDF, 1×/2×/3× quick export) and per-plan pixel caps.
10. **Credits UX**: show the cost on hover before running, auto-refund failures, daily plus monthly buckets (Kittl), and top-ups that never expire (both).
