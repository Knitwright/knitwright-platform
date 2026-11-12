# 08 · UI: the Kittl shell (source of truth for all screens)

> **v3.7 update (9 Nov 2026): Kittl Projects page, font picker, Fabra tech pack editor and exported sheets, plus the screens we had no screenshots for.** The Fabra tech pack is gated, so its tabs and sheets were copied from YouTube frames. Layout and interaction only; no Kittl or Fabra logos, art or copy.
>
> **From screenshots:**
> - **Projects** (`/projects`) is now Kittl's Projects page:
>   - top tabs Recent · Projects · AI Creations;
>   - sub-tabs Projects · Folders · Shared · Trash, with a sort dropdown and search;
>   - a grid of a New project card, project cards with an artboard count, and tutorial cards.
>   - The Fabra-style home from v3.6 moves to **Recent**. AI Creations is a masonry grid of generated images.
> - **Font picker:** click the font name in the text panel. It has Fonts and Brand tabs, search, and filter chips (All, Kit-safe, Sports, Varsity, Sans Serif, Serif, Script, Stencil).
>   - **KIT-SAFE** tags mark fonts that hold up when sublimated, embroidered or heat-pressed at small sizes. Upload font is ♛.
>   - The Brand tab lists the club's fonts. Each font previews in its own face.
> - **Tech pack editor:** the third view in Garment Studio (2D · 3D · Tech pack).
>   - Tabs: Overview · Body · Measurements · Materials · Callouts · Artworks · Labels. Units: mm / cm / in.
>   - The 3D view shows red measurement points (A–H) and blue numbered callouts. Check fit (Simulate) sits top-right.
>   - Measurements are graded XS–3XL with tolerances; the sample size is M. 🔒 marks rows that only Knitwright QC edits (sample size, factory, AQL).
>   - **Preview sheets** opens the exported workbook.
> - **Exported tech pack sheets:** a spreadsheet-style preview of the .xlsx with sheet tabs Overview, Colourways, Measurements, Size chart, Callouts, Materials, Artworks and Labels.
>   - Every sheet shares the same header: brand box, product detail table, title, and "Open in Knitwright ↗".
>   - Download .xlsx and PDF are ♛ and open the upgrade modal. Ordering through Knitwright never needs an export.
>
> **Decided by us (no screenshots):**
> - **Version history:** from ≡ → Version History, or the clock icon in the project panel. It has an autosave toggle, named versions, and Restore. A version that was ordered is locked, because it is the one the factory made.
> - **Print on demand:** the last tab of Choose Artboard Size. It lists kit print areas (front crest, back number, sleeve, shorts leg) at production size.
> - **Task-bar "n more ⌄":** opens a menu of the actions that don't fit. Artboard: 3; Garment: 4; AI image: 2.
> - **Range plan board:** a List / Board toggle on Orders → Range plan. The board is Fabra-like: one column per drop, with cards for each style showing an attribute table (fabric, sizes, MOQ, target cost, status).
> - **Order detail:** Printify-style. Items, shipment and tracking, factory QC photos, order summary (subtotal, shipping, sampling, club discount, total), customer, and the locked design version with its tech pack.
> - **Colour and size pickers:** colourway and size menus on the Garment Studio pills. The size choice changes which measurement column is highlighted.
>
> **v3.6 update (9 Nov 2026): Garment Studio and Fabra flows from 10 Fabra screenshots, plus 3 Kittl editor shots.** We copy Fabra's layout and interaction only, not its logo, art or copy. Fabra's lime becomes our gold, and black becomes navy. Everything is in `prototype/index.html`, linked from the proto bar.
>
> **Garment Studio** (Fabra's "unified editor"): a full-screen 3D editor for one garment. The Kittl canvas stays the main editor; Garment Studio is where the garment itself is built.
> - **Ways in:**
>   - the **3D** toggle on the Garment board;
>   - the **Open in Garment Studio** button on the Garment board's right panel;
>   - **Create → Garment Studio (3D)**;
>   - the product configurator;
>   - the **Repeat print** card on Projects.
>
>   The **KW** logo goes back.
> - **Top bar:** KW logo, project name, File, a **BETA** tag, undo / redo in the centre, then the KW credit balance, Share and **Export**.
> - **Library column:**
>   - a Library / Tech pack switch;
>   - **Knitwright library:** Fabrics, Colours, Repeats, Graphics, Trims;
>   - **Your library** (club avatar): Fabrics, Palettes, Repeats, Brand kit, Uploads;
>   - **Tools:** Repeat prints ♛, Trim generator;
>   - a Get started video card and **Ask Knitwright**.
> - **Library panel:**
>   - search; chips (Polyester, Mesh, Interlock, Recycled);
>   - **Recommended** fabric tiles; **Recommended collections** with a strip of swatches and a count (Match-day jerseys, Training knits, Compression & stretch, Cricket whites, Fleece & warm-up, Recycled & eco);
>   - only fabrics the factory stocks and has tested for this base.
>   - Colours shows the club palette and print-safe colours. Repeats has pinstripe, hoops, fade, halftone, chevron and camo. Trims lists only what the factory stocks.
> - **Stage:** a grey 3D view of the kit on a mannequin.
>   - Bottom left: **colourway** and **size** pills.
>   - Bottom centre: **2D / 3D / tech pack** switch. 2D shows the flat pattern pieces with seam allowance; the third option shows the tech pack pages.
>   - Bottom right: **Fit checked** (Fabra's "Not sim ready") and the turntable, image and avatar icons.
> - **Design summary** (right): groups for Fabrics, Colours, Repeats, Graphics, Text, Trims and Stitches. Each group lists the parts in use, with a swatch, part, spec and count. When empty, a group says "No … yet", as in Fabra.
> - **Export panel:**
>   - tabs: **Tech pack · Images · Pattern · Artwork · On model · Flat lay**;
>   - "Export tech pack (8)" checklist: Overview, Colourways, Sample measurements, Size chart, Bill of materials, Construction callouts, Artworks, **Compliance labels** (ours), and Notes (*Coming soon*);
>   - the **Pattern** tab says Class A patterns stay with the factory, and Class B gets DXF on request;
>   - a gold note: ordering through Knitwright needs no export, because the tech pack goes to the factory free;
>   - **Export ♛** opens the upgrade modal.
> - **Welcome modal (first open):** a BETA tag, "Welcome to Garment Studio", **Works well** (dashed box) and **Coming soon** (grey box), *Don't show this again*, and **Start designing**.
>
> **Modals**
> - **Create a new design** (Create → New Kit Design, and Projects):
>   - Knitwright library: **Products** (factory-approved bases) and **Templates**;
>   - Start your own: **Kit from your crest**, and **Import your own pattern**, marked *Class B · 50+ pieces · checked by the factory first*.
>   - Rows show thumbnails and a ›.
> - **Product configurator** (from **Start designing** on product detail):
>   - left: a large render; right: the product name, then option chips for Sleeve, Collar, Fit and Body length.
>   - 🔒 marks options that aren't sampled yet; they can't be picked.
>   - **CREATE MY DESIGN →** opens Garment Studio.
> - **Upgrade to export tech packs:**
>   - Monthly / Yearly switch ("Save up to 22%");
>   - three cards: **Free** £0 forever (current plan, with 🔒 "Tech pack export" and "High-res exports"), **Starter** £9 / £7, **Studio Pro** £29 / £23 ("Everything in Starter, plus:");
>   - footer: the tech pack goes to our factory free.
>   - Prices are placeholders and match the main plans.
>
> **Projects home** (Fabra dashboard):
> - "Good evening, Lahore Lions".
> - Dashed cards: a big **Start a new design** (base product vs template art, plus **Start designing**), **Browse products and templates**, **Mood board**, **Range plan** (opens the collection plan) and **Repeat print** (opens Garment Studio on Repeats).
> - Then **Jump back in**, with chips (All, Designs, Range plans, Mood boards, Repeat prints, Fabrics, Trims), and cards tagged DESIGN or RANGE PLAN.
> - The Kittl-style Projects page shot is still to come; this layout holds until then.
>
> **Catalogue:** a **Customisation** filter (Fabra's Editable / Locked form) joins the category filter bar. It maps to our options: *Editable* is the options the factory has sampled; *Locked* is a fixed base.
>
> **Kittl editor**
> - **Artboard Size** (top of the artboard's right panel): "Artboard Size px" with a dropdown. **Popular:** Standard (Square), Kit front (print area), Kit back (name & number), Poster, Instagram Post, Instagram Story, Facebook Post, A4, A5, Presentation.
> - **Mockup edit mode** (double-click a mockup):
>   - a blue box with corner handles shows the print area inside the mockup, and the task bar hides;
>   - the right panel shows Mockup (thumb, name, collection), Mockup Color with **Match Artboard Color**, and **Layer → Opacity**;
>   - click outside to finish.

> **v3.5 update (9 Nov 2026): catalogue, products, listings, orders and store pages, from 19 Printify screenshots.** Printify's page layouts are copied into the Kittl shell (same rail, top bar, type and buttons). Printify's lime buttons become our navy (main action) or gold (Publish / Studio Pro). We copy layout and interaction only, never Printify's logo, art or copy. All prices and costs are placeholders. Every page is in `prototype/index.html`, linked from the proto bar.
>
> **Catalogue** (`#/products`, tabs Catalogue · My products · Trending ideas · Fabrics)
> - **Home:** search; 6 category tiles (Men's, Women's, Kids', Teamwear, Training, Accessories); a navy **Studio Pro promo banner** ("Club kits from one piece"); **Top picks**, **New arrivals**, an **Eco picks** grey band with 3 cards; **Discover more** link chips; a FAQ list.
> - **Product card:** square grey image, heart, badge (Bestseller / New / Eco), name, "By Knitwright · Sialkot", **From £x**, **From £y with Studio Pro** (20% off), sizes · colours.
> - **Category page** (`#/products/men`): grey hero with breadcrumb and count; sub-category chips with thumbnails; filter bar (All filters, Sport, Decoration, Fit, Fabric, Production class, Price, Sort); 4-column grid; pager.
>
> **Product detail** (`#/product/:code`)
> - Gallery with thumbs and heart; badges; title; bullets.
> - **Decoration method** tabs: Sublimation · Embroidery · Screen print · Heat transfer. Each one changes the line under it.
> - **Made by Knitwright** card (our version of Printify's provider card): sample time, QC photos, safety labels; **Start designing** and **Order a sample**.
> - **Fulfilment** box: one provider (Knitwright Sialkot → UK); Quality, Price (with Studio Pro), Shipping, Avg. production; then Colours, Sizes, Print areas, Features (branded inserts, neck labels, names and numbers). Our price ladder table sits under it.
> - Two-column sections: About, Key features, Care instructions, **Size guide** with a cm / in toggle; **Frequently bought together**.
>
> **My products** (`#/products/mine`)
> - Status chips (All, Published, Drafts, Publishing errors, Archived); 4 filter dropdowns and a search box.
> - Rows: checkbox, thumb, name and variant line, status pill, updated, sales channels (errors in red, for example "missing GPSR info"), then edit · copy · preview · ⋯. A row opens the listing editor.
>
> **Listing editor** (`#/products/listing`)
> - Tabs scroll to sections: **Mockups · Listing details · Personalization · Pricing · Publishing**. A sticky preview card and **Listing health** checklist sit on the right; a sticky bar at the bottom has **Save as draft** and a gold **Publish**.
> - **Mockups:** a primary tile spanning 2 rows, more tiles, **Mockup library** (opens the modal), **AI scene** (try-on workflow) and **Upload**.
> - **Listing details:** title, a rich-text description, **Improve listing** (AI, 2 credits), tags, size-table toggle and a **Product safety (GPSR)** table: what Knitwright fills in, and the EU responsible person still needed.
> - **Personalization:** names and numbers (12 letters, 0–99, +£5).
> - **Pricing:** size rows with production cost, retail price, profit and margin; a price histogram of similar UK club shirts.
> - **Publishing:** radio cards (Shopify, Knitwright team store), sync options, and a link to connect another channel.
> - **Mockup library modal:** a left rail (Product, Lifestyle, Teamwear, Flat lay, Video, Uploads), view tiles (Front, Back, sleeves, neck label), a checkbox grid, and a **Selected (6/10)** panel with Cancel / Add to listing.
>
> **Orders** (`#/orders`)
> - A **team and bulk discount banner** (10% at 20+, 15% at 50+, 20% at 100+); a settings strip (approval, shipping, DDP customs, notifications).
> - Our tabs stay (Orders, Samples, Collection plans, Quotes); then status chips (All, On hold, Awaiting approval, In production, Shipped, Delivered, Cancelled) and search.
> - The table gains date, customer and checkbox columns. **Cancelled** shows the empty state (`#/orders/empty`).
>
> **Store** (`#/store`, tabs Overview · Sales channels · Branding · Settings · Payouts)
> - **Sales channels** (`#/store/connect`): channel chips, then a 2-column grid of cards for Shopify (Recommended), Etsy, TikTok Shop, **Knitwright team store** (our version of Printify's Pop-Up Store), WooCommerce, and API or CSV.
> - **Connect to a sales channel** modal: radio cards, then Not now / Continue.
> - **Store settings** (`#/store/settings`): sub-tabs; **Product safety (GPSR)** tables ("Completed by Knitwright" and "Needed from you"); **Packaging (EPR)**: Germany LUCID number, France Triman, UK threshold note.
> - **Branding** (`#/store/branding`): 2×2 cards for packing inserts, neck labels, hang tags and gift messages, each with cost, details and Set up.
>
> **Trending ideas** (`#/products/trends`): sport chips and a masonry grid of sportswear trends (retro collars, gradient sleeves, hoops, pinstripe cricket…). Click opens the editor.
>
> **Editor:** the Kittl editor stays the editor. Printify's product creator gives only one thing: a **Product info** button at the top of the Garment board's right panel. It opens a modal with production cost, shipping, print area, file spec, print guidelines, **Download template** and **Preview on mockups**.
>
> **Not copied from Printify:** multiple print providers (we have one factory), Printify Express, and its plan names and prices.

> **v3.4 update (9 Nov 2026): menus, video mode, Export, Share Invite, Brand app and plans, from a third batch of 19 Kittl editor screenshots.** This adds to the v3.3 and v3.2 blocks below; where they differ, v3.4 wins. All of it is in `prototype/index.html` → Editor. The proto bar has a "Plans" link.
>
> **Prompt bar**
> - **Image mode footer:** + · Image ⌄ | model · **Match** · **1×** · **⋯** · wand · mic · send.
>   - **Match:** 21:9, 16:9, 5:4, 4:3, 3:2, 1:1, 2:3, 3:4, 4:5, 9:16, then **Match Input** ✓ (dashed-square icon). Each row has an orientation icon; the picked row is grey with a ✓.
>   - **1×:** 1 Image ✓ · 2 Images · 3 Images · 4 Images.
>   - **⋯:** Background ⓘ › with a Transparent / Opaque ✓ submenu. *Ours:* a **Keep garment exact** toggle (the garment lock).
> - **Video mode footer:** + · Video ⌄ | model · 16:9 · 4s · mute · **Reference Mode ⌄** · wand · mic · send.
>   - The placeholder reads "Describe your video. Optionally add reference images."
>   - **Reference Mode menu:** Reference Mode ✓ ("Bring elements into your scene") · Frames to Video ("Motion between two key frames").
>   - **Video model picker:**
>     - "Recommended models", then a focused Search models field;
>     - each card shows logo, name, a one-line description, ⏱ seconds and credits **per second**, a crown for paid models and a **NEW** pill.
>     - Our placeholder names: **Motion, Motion Fast, Motion Long ♛, Motion 480p**.
> - **References row:** the reference thumb (numbered, with our lock), then **→**, then a light-blue target tile showing the output type (image or video icon).
>
> **Board selection**
> - **Artboard:**
>   - task bar: AI Image board · AI Video board · Mockup · 2 more ⌄ | duplicate · download · ⋯;
>   - right panel: Color (−), Tools (AI Image Board, AI Video Board, Mockup), **Margin +**, **Selection Colors** and Browse Color Palettes.
> - **Empty AI board:**
>   - task bar: AI Image board · AI Video board · Mockup (greyed);
>   - right panel: Tools only (AI Image Board, AI Video Board, then greyed Mockup, Convert to Image, Remove Background ⌄, Upscale and Reframe).
>   - In Kittl the empty board is filled lilac; ours is light blue.
> - **Mockup:**
>   - task bar: AI Image board · AI Video board · Convert to Image;
>   - right panel: Mockup thumb, Mockup Color, Match Artboard Color, and Tools in that order. We keep Colourway / Roster player.
> - **Illustration:** Layer (opacity), **Illustration Colors**, Browse Color Palettes, Shape Builders, Border +, Shadow +.
> - **Nothing selected:**
>   - Project Colors includes a **"none" swatch** (white with a red slash) and "See all N colors";
>   - Tools are greyed, each with an ⓘ.
> - **Context menu** (right-click a board, or task bar ⋯):
>   - Copy (Ctrl + C) · Paste (Ctrl + V) · Copy/Paste as › · Duplicate · Delete ⌫;
>   - Set as Project Thumbnail · Quick Export · Add to Brand · Add Artboard;
>   - Convert to Image.
>
> **Bottom dock**
> - **Zoom %** opens: Fit to content · Fit to artboard · Fit to selection · 50% · 100% · 200%.
> - **Upgrade** opens **Choose Your Plan**.
>
> **≡ menu**
> - New Project · My Projects · Duplicate Project · Reset Toolbar to Default;
> - **View ›**: Grid (Ctrl + ') · Ruler & Guides (Shift + R) · Margin, each a toggle. *Ours:* **Seams and safe zones** (on).
> - **Settings ›**: Inches (in) · Pixels (px) ✓ · Millimetres (mm). *Ours:* a note that garment boards always use mm.
> - Dark Mode · Menu Labels;
> - Save (Ctrl + S) with "Saved … ago" · Version History.
>
> **Export**
> - The top select opens a checklist: **All artboards (N)** ✓, then each artboard with thumb, name and checkbox.
>   - With several picked, W and H read **Mix** and the label reads "Selected artboards (n)".
> - **Format:** PNG ✓ · JPEG · SVG ♛ · PDF ♛ (the last two greyed on free).
> - Transparent Background ♛ and Optimize Quality ♛.
> - The Garment board section (tech pack, production package) stays ours.
>
> **Share › Invite**
> - Link | Invite segmented tabs.
> - A focused email field with "Can view ⌄" inside, and a disabled Invite button.
> - Member rows:
>   - "Anyone at {team}": Can access;
>   - you: Owner;
>   - *ours:* **Knitwright factory desk**, Tech pack only.
> - Then View presentation and Publish project ›.
>
> **Left panels**
> - **More › Your apps:** white icon tiles with name, one-line description and a pin.
>   - Ours: Photos · Chat · Likes · Brand · Team · Textures (mesh, jacquard, grunge) · Pinterest;
>   - then Featured Apps / See all.
> - **AI Gallery item popover**, shown next to the card:
>   - "AI Video" or "AI Image";
>   - **Prompt** in a grey box clamped to 2 lines + More;
>   - **Model**;
>   - ♡ Add to Likes;
>   - outlined **Recreate** (*ours:* "Recreate with my kit", which runs with the garment lock);
>   - outlined **Add to Project**.
>   - Hovering a card shows a white ⋯; video cards have a play badge.
> - **Brand app in the editor:**
>   - header: ‹ · brand logo + name ⌄ (menu: Rename · Delete · + Add Brand) · ✕;
>   - tabs: All · Logos · Details · Colors · Fonts · ›;
>   - sections:
>     - Logos (2 big tiles);
>     - Details (✎ Edit);
>     - Colors (+ Add): Primary, Secondary and Accent palettes as split rounded bars;
>     - Fonts (+ Add): each font rendered in itself, ⋯ on hover;
>     - Graphics (Upload): a row with ›.
>   - *Ours:* a **Kit** section with Pantone mapping, ΔE and vector-crest checks.
>
> **Choose Your Plan** (full-width modal)
> - Monthly | Annual toggle with a blue "Save up to …" pill.
> - Three cards. Each has:
>   - name and pill;
>   - one-line pitch;
>   - a grey credits box ("N AI credits /mo", "Up to X images or Y videos");
>   - struck-through monthly price, then the annual price per month;
>   - the button, dark on the highlighted plan;
>   - "Save £X compared to monthly";
>   - a ✓/✗ feature list.
> - The highlighted plan has a warm corner glow (Kittl's is lime; ours is gold).
> - **Our plans are placeholders**, all prices to be confirmed:
>
>   | Plan | Monthly | Annual (per month) | Credits per month |
>   |---|---|---|---|
>   | Starter | £9 | £7 | 600 |
>   | Studio Pro ("Best for brands") | £29 | £23 | 2,400 |
>   | Club & Scale | £79 | £63 | 8,000 |
>
>   - A footnote says design, 3D, quotes and the tech pack summary are free, and that credits come back as order credit.
>
> **Still unconfirmed**, design these from the video frames until screenshots arrive:
> - mockup edit mode;
> - the open "2 more" and "7 more" menus;
> - the font list;
> - the Version History panel;
> - Choose Artboard Size › Print on Demand;
> - the dashboard Projects and Mockups pages.

> **v3.3 update (9 Nov 2026): selection states, modals and apps, from a second batch of 20 Kittl editor screenshots.** This adds to the v3.2 block below. Where they differ, v3.3 wins. All of it is in `prototype/index.html` → Editor; the proto bar at the bottom has an "Error toast" link.
>
> **Right panel by selection** (fixed header stays: avatar · Share · Export · **Order**, then project name)
> - **Text:**
>   - font select (large, shows the font name in itself) · weight ▾;
>   - Size / Letter spacing / Line height in one row of three inputs;
>   - alignment icons;
>   - **Transformation:** 4×3 tiles (Custom, Distort, Circle, Angle, Arch, Rise, Wave, Flag…), the selected tile has a blue border, plus a curve slider, and Reset / Confirm;
>   - then Text Colors (swatch + hex + %, "Browse Color Palettes"), Text Shadow +, Text Decoration +, Layer.
>   - *Ours:* a tip under Arch, "Arch suits player names on the back."
> - **Image:**
>   - Alignment (6 icons) · Transform (X, Y, W, H, rotate, flip);
>   - Layer with opacity and **Blending Mode ▾**;
>   - **Tools:** Reframe, Edit Area, Erase & Fill ♛, Vectorize, Remove Background;
>   - Border +, Shadow +, Photo Filter +, collapsed until + is pressed.
> - **Group:**
>   - Alignment · Transform;
>   - **Shape Builders** (unite, subtract, intersect, exclude);
>   - Border and Shadow expanded with sliders;
>   - **Selection Colors** (every colour in the group, each opens the picker).
> - **Mockup:**
>   - thumbnail with name and collection;
>   - **Mockup Color** swatch row;
>   - **Match Artboard Color** toggle;
>   - Layer, Tools.
>   - *Ours:* **Colourway** and **Roster player** selects, so a kit mockup can show any player's name and number.
>   - Mockup boards have a light-blue outline and an electric-blue label.
>
> **Task bars** (floating above the selection)
> - **Image:** Remove BG · Remix · Generate Video · Edit Area · "7 more ⌄" · download · ⋯
> - **Text:** Add Link · Edit Transform · Erase · lock · download · ⋯
> - **Group:** layers ⌄ · Ungroup · ⋯
>
> **Board connector dot → "Add…" menu:**
> - a 20 px title "Add…", then AI Image board, AI Video board, Mockup;
> - *ours:* a divider, then **Tech pack**.
>
> **Prompt bar**
> - **Mode menu**, each item with a one-line description:
>   - Agentic AI (Beta), Generate Image ✓, Generate Video;
>   - *ours:* **Ask Knitwright** (answers "why?" from the rulebook; no generation, no credits).
> - **+ menu → Browse Styles:** a split modal with the ✕ outside the top-right corner.
>   - Left: category list, Upload Style, and an **Auto-apply Model** card with a toggle.
>   - Right: Search styles, then a 5-column grid (image, name, model).
>   - Our categories are sportswear styles (Matchday poster, Retro kit, Esports, Flat lay…).
> - **+ menu → Prompt builder:** a split modal, "All categories are optional".
>   - Left: Style, Perspective, Effects, Colors, Environment, Lighting, and a **Surprise me** button at the bottom.
>   - Right: a 3-column image grid where the picked card gets a blue ring and dot; picks collect as chips in a dashed box with "Add to your prompt".
> - **+ menu → Prompts:** a modal with History / Presets tabs. Each preset row has a 160×106 image, a bold title and a 2-line prompt.
> - **Hero + icon** (AI Studio): Upload images · Prompt history.
>
> **Colour picker** (390 px popover, left of the right panel)
> - **Color | Brand** tabs, ✕;
> - SV square, then eyedropper · hue bar · alpha bar;
> - HEX ▾ · value · 100 %;
> - **Project colors** row.
> - The Brand tab lists the team's brand palette.
>
> **Share**
> - **Publish project ›:** back arrow, a Publish button, "OR", then a row of round icons (Facebook, Pinterest, X, WhatsApp, Email, Send copy).
> - **View presentation:** full-screen dark view.
>   - Top: KW, Back to Editor, centred title, comments, Share, avatar.
>   - Bottom: Slides, a "2 / 6" pager, Fullscreen, Restart.
>
> **Apps (More panel)**
> - **App page layout** (Kittl's Printify page), used for our **Shopify** app:
>   - back, name and Beta;
>   - hero tile, title, "Created by Knitwright";
>   - a full-width dark **Add** button, the terms line, and Permissions ▾.
> - **Pinterest app:**
>   - Beta, then a "Do you like this app?" card;
>   - connected account row;
>   - Browse / Pin tabs, Search boards, board grid (Quick Saves first).
>   - *Ours:* a "Suggest from this" note that sends a pin into the prompt as a reference.
>
> **Toast:** dark pill, top centre, red ✕ tile, "Generation failed" / "Please try again later. No credits were used."
>
> **Still unconfirmed**, design these from the video frames until screenshots arrive:
> - the "2 more" and "7 more" menus;
> - mockup edit mode;
> - the right-click menu;
> - Video mode;
> - the Match / 1× / ⋯ menus;
> - the Export dropdowns;
> - Share › Invite;
> - ≡ View and Settings submenus;
> - the font list;
> - the Brand app in the editor;
> - version history;
> - Print on Demand sizes;
> - the Projects and Mockups pages.

> **v3.2 update (9 Nov 2026): the editor, measured from 20 screenshots of the real Kittl editor.** This replaces §5.1–5.7 wherever they differ. The prototype's editor is rebuilt to match; open `prototype/index.html` → Editor. Sizes are Kittl's at a 1920 px window, and our prototype scales them for 1440.
>
> **Dashboard additions**
> - **Create menu** (from the rail's Create tile), a plain list with icons:
>   - AI Workflows · Creative Agent · Create Video · Create Image · Create Ad · Create Launch Pack;
>   - divider;
>   - Explore Templates · **New Kit Design** (ours) · New Project ↗.
> - **AI Studio opens on AI Workflows**, not Creative Agent:
>   - a grey rounded hero, "What do you want to create today?" in white;
>   - an Ask Creative Agent card: upload tile, + and add-image icons, mic, send;
>   - "Start a workflow" with category tabs (Discover · For you · 2027 Kits · UGC · Ads · Product scenes · Teamwear · Product listings · On brand · Social ›) and "Search workflows" on the right.
> - **Choose Artboard Size modal** (New Project), with a ✕ outside the top-right corner:
>   - left: tabs **Popular · Products (ours) · Social · Marketing · Store · Print (paid)**, then a 3-column card grid (icon, name, size);
>   - right: **Settings**, with Size W/H, Unit ▾, DPI, Orientation (portrait/landscape), Margin checkbox and a full-width dark **Create** button at the bottom;
>   - Products cards create a **garment board** on that base.
>
> **Editor layout, left to right: rail · panel · canvas · right panel**
> - **Rail (~90 px), icons with labels:**
>   - top: logo, ≡ menu, divider;
>   - main items: **Products (ours)** · Templates · Text · Illustrations · AI Gallery · Mockups · Uploads;
>   - divider, then More · Learn · Layers · Help.
>   - The active item gets a light-blue rounded square with a thin blue border. If the rail overflows, Kittl shows a round ⌃/⌄ scroll chip.
>   - **Brand and Team are not on the rail.** They are pinned apps under **More** (Kittl puts Brand there).
> - **Panel (~400 px).** Every panel has the same anatomy:
>   - title (20 px) + ✕;
>   - a 46 px search field with the icon on the right;
>   - underlined text tabs;
>   - **grey rounded section cards**, each with a title, a "Show All" link and a row of thumbnails with a round › button.
> - **Panel contents**, as copied:
>
>   | Panel | Contents |
>   |---|---|
>   | Templates | Tabs; For You / Trending Now / Shopify Listing rows |
>   | Text | **Add Headline** and **Add Paragraph** buttons, then style rows (ours: Varsity, Names and Numbers, Paragraphs) |
>   | Illustrations | Expand ⤢ icon; tabs All · Shapes · Sport · Crests · Abstract; a **"Most used" sort chip**; plain (no grey card) rows with "See All ⌄": Crests and badges, Basic Shapes, **Clothing**, Stripes and hoops |
>   | AI Gallery | Explore / My Creations tabs, chips, 2-column masonry |
>   | Mockups | Search, then curated rows with gold premium badges |
>   | Uploads | Database icon in the header; **Upload Files** and **Add Folder** buttons; All / Folders / Files tabs; folder rows (thumbnail, name, "n Uploads"; Kittl has "AI Generated" and "Pinterest" folders) |
>   | More | **Your apps** (pinnable rows: Brand, Team, Pinterest) / Discover; **Featured Apps** (Bulk Mockups – Colourways, Shopify, QR Code Generator, Names and Numbers). Kittl lists a Printify app here: that's our Products/Order flow, built in |
>   | Learn | Shorts row and Video Tutorials |
>   | Layers | Tree rows with › chevron and # frame icon; the selected row is light blue |
>
> - **Canvas:**
>   - plain light grey (#F0F1F5), **no dot grid**;
>   - a board's name sits above its top-left corner in grey, and turns blue when the board is selected;
>   - selection: 2 px blue outline, square corner handles, pill handles at the side midpoints;
>   - **connector dot**: a small filled circle about 25 px to the right of the selected board;
>   - a generating board is solid light blue with "◌ Generating" at its top-left.
> - **Floating task bar** above the selection (white, rounded, bordered):
>   - board: **AI Image board · AI Video board · Mockup · "2 more ⌄"**, divider, Duplicate · Download · ⋯ (garment boards: AI Image board · Mockup · Tech pack · 2 more);
>   - image element: **layer-order ⌄ · Erase · Find Similar**, divider, Duplicate · Download · ⋯, plus a round rotate handle under the element.
> - **Right panel (~370 px).**
>   - Header: avatar · **Share** (outlined) · **Export** (black) · **Order** (gold, ours). Under it: project name (grey) + version-history icon.
>   - **Nothing selected:**
>     - **Project Colors**: rows of swatch · HEX · 100%, then "⁘ See all 7 colors" and a full-width **Browse Color Palettes** button;
>     - **Tools**: bordered cards AI Image Board · AI Video Board · Mockup · Tech Pack (ours), greyed with an ⓘ until something is selected.
>   - **Artboard selected:**
>     - **Artboard Size** (px, portrait/landscape toggle), preset dropdown ("Custom"), W/H + link icon, **Clip Content** checkbox;
>     - **Layer** (opacity slider);
>     - **Color** (− collapses, swatch row);
>     - **Tools** (enabled).
> - **Bottom of canvas: prompt bar on top, dock underneath.**
>   - **Prompt bar, collapsed:** a wide rounded box reading "Describe image you want to create".
>   - **Prompt bar, open** (click, or the dock's ✦):
>     - the selected board is attached as reference "1" (ours adds a 🔒 garment-lock badge), plus an upload tile;
>     - the prompt text;
>     - a footer: **+** · **Image ⌄** (mode) | **model** · **Match** (aspect) · **1×** (count) · **⋯** … **Enhance prompt** (wand, tooltip) · mic · send (dark square).
>   - **+ menu:** Upload images · Browse styles · Prompt history · Prompt builder (ours adds Shoot ideas library).
>   - **Mode menu (ours):** Image · Video · Edit image · Agent · **Ask Knitwright** (the rulebook "Why?" assistant lives here).
>   - **Model picker:** a search field, a heading, then cards with logo, name, ⏱ seconds and credit cost, a premium badge and a ✓ on the selected one. Model names stay placeholders (Standard / 4K / Fast / Pro).
>   - **Dock**, 4 separate white groups:
>     1. Select ▾ · Artboard # · Shape ▾ · Pen · Text · Comment · **AI ✦** (active grey);
>     2. Undo · Redo | − zoom% +;
>     3. **credits** (Kittl's ⊕ is its credit icon; ours is the KW coin);
>     4. **Upgrade** (crown).
> - **≡ menu:**
>   - New Project · My Projects · Duplicate Project · Reset Toolbar to Default;
>   - View › · Settings ›;
>   - **Dark Mode** toggle · **Menu Labels** toggle (hides the rail labels);
>   - Save Ctrl+S "Autosaved n minutes ago" · Version History.
> - **Export popover** (under the Export button, no dimming):
>   - artboard dropdown; W · H · unit; format (PNG ▾) · dpi;
>   - "Max. export size: 800px" warning on Free;
>   - **Color**: RGB "Web & screens" ▾;
>   - **Additional Settings**: Transparent Background (paid), Optimize Quality (paid);
>   - full-width black **Export**.
>   - Ours adds a **Garment board** block: Tech pack (PDF + Excel), Production package (ZIP).
> - **Share popover:**
>   - "Share project" ✕;
>   - segmented **Link | Invite**;
>   - access dropdown ("Only invited users can access") with a help line;
>   - black **Copy link**;
>   - divider, then **View presentation** and **Publish project ›**. Ours adds **Request approval** (committee or factory).
> - **Ignore:** Kittl's "How satisfied are you…" survey toast and its in-app ad cards.
> - **Still from video frames only, so confirm with screenshots:**
>   - the text task bar and text inspector;
>   - the mockup board inspector (Mockup Color);
>   - the connector "Add…" menu;
>   - the Video mode panel;
>   - the colour picker and font picker Brand tabs;
>   - View › and Settings › submenus;
>   - Browse styles modal.

> **v3.1 update (8 Nov 2026), from the founder's real Kittl screenshots.** Where this file and the screenshots differ, the screenshots win. The prototype (`prototype/index.html`, now with 24 routes) and `09-screen-map.md` are updated to match:
> - The dashboard left rail is **96 px with icon + label**:
>   - order: Create (navy tile) · AI Studio · Templates · Mockups · **Marketing** · Products · Projects;
>   - a ⌄ button expands Orders · Store · Team;
>   - Help, ⋯ and avatar sit at the bottom.
>
>   This replaces §3's 232 px nav.
> - **Top bar inside each page:**
>   - Brand pill (briefcase + name, gold "New" tag until set up);
>   - centred page tabs;
>   - ⊕, **Upgrade** button, avatar;
>   - a gold help bubble at bottom right.
> - **AI Studio is the home page**, with tabs AI Workflows · Creative Agent · Image Generator · Video Generator.
>   - **Creative Agent:** hero in a grey rounded container, prompt card, "Quick-start a project" tiles.
>   - **Workflow pages:** "← AI Studio", a white card with the form on the left, footer image count + Generate n, and an Output example on the right.
> - **New Marketing page:** "Never run out of ideas for kit launches", featured concepts, ad gallery.
> - **Templates page:** grey header band with search and category tabs; rows of cards with a "Use template" pill.
> - **Brand empty state:** URL field, Import, OR, Create new, plus "Start from my crest".
> - **The editor (§5) is unchanged:** it comes from the tutorial frames.

Version 3.0 · 6 Nov 2026 · **This file overrides every UI description in `02-features.md`.** `02` still defines *what* each feature does: data, rules, validation, pricing, acceptance. **This file defines how every screen looks and behaves.** Where they disagree on layout, this file wins.

## The rule

**Copy Kittl's interface: information architecture, screen layouts, panel positions, interactions, keyboard shortcuts and flows.**

Change only:
1. Name and logo → **Knitwright** (monogram "KW").
2. Colours and type → Knitwright tokens (below).
3. Icons → our own set (Lucide, MIT), matched in meaning and position to Kittl's.
4. Copy text → our own words; same length and placement.
5. Content → sportswear-only templates, mockups and graphics.
6. **Additions** for manufacturing, each placed where Kittl puts the closest equivalent: Products panel, Garment board, Tech pack board, Order button.

Do **not** copy Kittl's logo, icon artwork, illustrations, template content, photos or marketing copy. Copying the layout and interaction patterns is fine; copying their brand assets is not.

**Sources** (in this pack):
- `research/kittl-fabra/video-ui-notes.md`: timestamped frames from Kittl's own tutorials. Video 4 at 02:06 shows the full editor chrome.
- `research/kittl-fabra/docs-notes.md` Part B: Kittl help-centre details.
- `prototype/index.html`: clickable prototype of the screens below. **Build to match the prototype, then refine spacing and states against the reference screenshots in `references/screens/`.**

---

## 1. Brand tokens (the "small changes")

| Token | Kittl (approx.) | Knitwright |
|---|---|---|
| Primary action | Black button | **KW Navy `#0B1F4B`**, white text |
| AI / board accent (Kittl's purple board labels, connectors, AI tags) | Purple | **KW Electric `#2F6BFF`** |
| Highlight / selected chips / "new" badges | Lime / yellow | **KW Gold `#F2B705`** with navy text |
| Canvas background | Light grey | `#ECEEF2` with 1 px dot grid `#D5D9E0` every 24 px |
| Panels | White | `#FFFFFF`, border `#E3E6EB` |
| Text | Near-black | `#15181E`; muted `#6B7280` |
| Danger | Red | `#D92D20` |
| Radius | — | 8 px inputs and chips, 12 px cards and panels, 16 px modals |
| Font | Kittl's sans | **Inter** (UI), 13 px base, 12 px labels, 15 px panel titles, 28–32 px dashboard hero |
| Premium mark | Crown | Small gold crown (our own drawing) |
| Currency for AI | "Tokens" with coin icon | **"Credits"** with a "KW" coin icon |

Dark mode: copy Kittl's (Menu › Settings › Dark mode) with inverted tokens. Phase 2.

---

## 2. App map (routes)

| Kittl | Knitwright route | Notes |
|---|---|---|
| Dashboard home ("What do you want to create today?") | `/home` | Hero with **Your projects \| Start with AI \| Start with a template**, prompt box, category tabs, template rows |
| Templates | `/templates`, `/templates/:category` | Categories become sportswear (§4.2) |
| Mockups (dashboard mockup generator) | `/mockups` | Pick a saved product or upload; every mockup in view shows it |
| AI Studio: AI Workflows · Creative Agent · Image Generator · Video Generator | `/ai-studio` | Same four tabs; workflows are sportswear (§4.5) |
| Projects | `/projects` | Grid of projects |
| Brand (Brand Studio) | `/brand` | Same tabs, plus a **Sportswear** tab (§4.6) |
| Editor | `/project/:id` | The infinite canvas (§5) |
| — (addition) | `/orders`, `/store` | Orders and storefront. Same dashboard shell, table layouts like Kittl's Projects list |
| Settings · Plan & billing · Get more credits | `/settings` | Copy Kittl |

The Teamwear club flow (configurator, roster, team store) uses the **same editor** with a club workspace. A club opens a **Kit template** from Templates and gets the same canvas. The roster lives in the **Team** panel (§5.4).

---

## 3. Dashboard shell

```
┌──────────┬──────────────────────────────────────────────────────────────────────────────┐
│ KW  ▾ws  │  [ Search "Try 'retro football kit'" ]                 ⓒ 1,240  🔔  (avatar) │  ← 64 px top bar
│ + Create │                                                                              │
│ ⌂ Home   │            WHAT DO YOU WANT TO CREATE TODAY?                                 │
│ ▣ Projects│        ( Your projects | Start with AI | Start with a template )            │
│ ✦ AI Studio│       [ ✦ Describe what you want to create…             ⬆ ]               │
│ ▤ Templates│                                                                           │
│ 👕 Mockups │  Discover · Teamwear · Training · Running · Gym · Combat · Esports ·      │
│ ◆ Brand    │  Launch packs · Social · Videos · Tech packs                              │
│ ▦ Products │                                                                           │
│ 📦 Orders  │  For you 120 ›   [card][card][card][card][card][card] →                   │
│ 🏪 Store   │  Kit launch packs 18 ›  [card]…                                            │
│ ───────── │  Videos 24 ›  [card]…                                                      │
│ ♡ Likes   │                                                                           │
│ ? Learn   │                                                                           │
│ ⚙ Settings│                                                                           │
└──────────┴──────────────────────────────────────────────────────────────────────────────┘
```

- **Left nav:** 232 px wide, labels on.
  - Top: workspace switcher ("Ahsham's Space ▾") and **+ Create** button, primary navy, full width.
  - Items as above. The active item has a soft grey pill.
  - **Products, Orders and Store** are Knitwright additions. Place them after Brand.
- **Top bar:** search centre-left (480 px), then right-aligned **credit balance pill**, bell and avatar.
- **Hero:**
  - uppercase heading;
  - a 3-segment control (pill, 40 px tall);
  - prompt box (640 px, 56 px tall) with upload icon, "+" and mode dropdown **Agentic AI ▾**, send arrow.
- **Category tabs:** horizontal and scrollable; the active tab is underlined.
- **Template rows:** title + count + "›", then a horizontal carousel of 208 × 260 px cards.
  - **Each card:**
    - preview;
    - type tag (e.g. "KIT LAUNCH", "JERSEY VIDEO"), top-left, 10 px uppercase on white;
    - board-count badge "# 12", bottom-right;
    - author;
    - crown if premium.
  - **On hover:**
    - **Use template** button (centre);
    - heart with like count;
    - ⋯ menu (Add to project / Open in new project).

---

## 4. Dashboard pages

### 4.1 Home
As above. **Start with AI** swaps the template rows for "Recent AI creations" and the AI Studio workflow grid.

### 4.2 Templates
- **Header:** "Templates" + search.
- **Category chip carousel:** Teamwear kits · Kit launch packs · Jerseys · Shorts · Training · Compression · Fight shorts · Hoodies · Social posts · Story ads · Videos · Size charts · **Tech packs**.
- **Toolbar:** **Filters** button (sport, article, style, colour, era, mood), then sort **Most used ▾**.
- **Grid:** masonry layout.
- **Hover card** as on the dashboard.
- The preview modal shows creator, uses, likes, flip-through of boards, and **Use template**.

### 4.3 Mockups (dashboard)
- **Left:** category list (Product renders · Flat lay · Hanger · Ghost · Teamwear · Training · Running · Combat · Esports · E-commerce).
- **Top:**
  - **Upload** dropzone, or **Use a product** (opens a picker of my saved Knitwright products);
  - colourway selector.
- **Grid:** every mockup in view shows the chosen product.
  - Card hover: **Edit** (opens the editor with the product linked) and **Download**.
  - Card modal: colourway, **Replace**, **Delete**.
  - Checkboxes for **bulk download**.

### 4.4 Projects
- A grid of project cards (thumbnail, name, edited time), with sort and a "New project" card.
- Card ⋯ menu: Duplicate, Rename, Delete, Move.

### 4.5 AI Studio
- **Brand switcher** top-left with completion pill ("80% completed"); menu: Manage brand · Change to › · + Add brand.
- **Tabs:** **AI Workflows | Creative Agent | Image Generator | Video Generator**.
- **Hero** prompt box (as on home), then "Recent AI creations".
- **Workflow categories:** Discover · For you · Kit launch · Product visuals · On-model · Matchday · Team store · Social ads · Videos · Tools.
- **Workflow cards:** sample output image, name, model chip, video badge.
- **Workflow page** (copy Kittl's "Product campaign kit" page exactly):
  - "← Back", workflow title, one-line description;
  - left: numbered form; right: **Output example** with "Powered by <model>";
  - footer: image count stepper + **Generate ⓒ 15**.
- **Sportswear workflows at launch:**
  - Kit launch post;
  - Team store promo;
  - Matchday graphic;
  - New signing;
  - Product listing set;
  - On-model try-on;
  - Flat-lay studio;
  - Size-chart card;
  - Feature callout post;
  - Kit reveal video;
  - Walk-out video;
  - Resize for all socials.
- **Form fields** (Product campaign kit = "Kit launch post"):
  1. Upload or **choose product** (picker tabs: Uploads · My AI creations · My products · <Brand>);
  2. **Apply your brand** (toggle + dropdown);
  3. Add your logo / crest;
  4. What do you want to highlight?;
  5. Pick a campaign (chips: New kit launch · Pre-order · Team store open · Last chance · Restock · Matchday · Sale · Limited drop · Sponsor thank-you);
  6. Pick a style (image tiles);
  7. Destination (Story 9:16 · Social post 4:5 · Square 1:1 · Banner 16:9 · Pin 2:3 · A4 print).
- **Results:** "Just now · 2 items" tiles. Click → **Image modal**:
  - size line ("1080 × 1350 px · PNG");
  - **Edit image** prompt with credit chip;
  - actions **Remove background · Edit area · Vectorize · Upscale · Add text**;
  - undo/redo;
  - footer **Open in editor · Download**.

### 4.6 Brand
Copy Kittl's Brand page.
- **Left card:** logo, website icon, ⋯, brand name, description, **Brand completion ⓘ %**.
- **Banner** "Your visual style is set!" with **Try in AI workflows** and **Learn more**.
- **Tabs:** **Overview | Logos | Colors | Fonts | Graphics | Visual style | Sportswear** (addition).
- **Overview:** cards with count pills (4 logos · 2 palettes · 4 styles · 13 graphics · Visual style Added).
- **Logos:** "+ Add" tile and logo tiles.
- **Colors:**
  - palettes as wide colour bars;
  - **Edit palette** modal: Name, swatch row (+), Cancel / Save changes.
  - Knitwright addition: each swatch shows Pantone TCX and a "print-safe" dot (green, or amber with tooltip).
- **Fonts:** role cards **Headline · Subheadline · Body · Accent** + **Name & number** (addition), each showing a "The quick brown fox…" preview. Edit modal: role, typeface, weight.
- **Graphics:** grid with "+ Add".
- **Visual style:**
  - left: reference image grid ("13 references");
  - right: three editable blocks **Setting · Art direction · Rules & boundaries**, each with ✎ Edit.
- **Sportswear (addition):**
  - crest and sponsor logos (vector check);
  - kit colours (primary/secondary/accent/trim mapped to palette swatches);
  - default size range;
  - care and brand labels;
  - packaging.
- **Edit brand** modal: tabs **Details | Voice and tone**.
  - **Details:** Name, Category (Club, Sportswear brand, Gym, Esports team, School), Website, About (1,000 characters).
  - **Voice and tone:** tag input with suggestions.
- **Import your brand** modal: URL field + **Import**, "or" **+ Create new**, with an illustration on the right.

---

## 5. Editor (the infinite canvas): `/project/:id`

```
┌────┬─────────────────────────────────────────────────────────────────────────────┬───────────────┐
│ KW │                                                     (avatars) ⬇  Share 🔗  [Order] │ ← 52 px top-right cluster
│ ≡  │                                                                              │ Project name ⟲│
│ ▤  │  ┌───────── PICK YOUR KIT ─────────┐   ┌──── MOCKUPS ────┐                   │ PROJECT COLORS│
│ 👕P│  │ [Garment: Home kit v7]  ●───────┼──▶│ Mockup: flat lay │                  │ ■ 0B1F4B 100% │
│ Tt │  │  Front | Back | Sleeves   3D ◐  │   └──────────────────┘                   │ ■ F2B705 100% │
│ ◇  │  └─────────────────────────────────┘   ┌ AI Image: pitch ┐ ⟳ Regenerate       │ See all · Browse│
│ ✦  │   ▢ note: "Swap in your design"         └─────────────────┘                   │ TOOLS          │
│ 🖼 │                                                                              │ AI Image board │
│ 👕M│                                                                              │ AI Video board │
│ ▦  │                                                                              │ Mockup         │
│ ♡  │                                                                              │ Tech pack ✚    │
│ ☁  │                                                                              │               │
│ ◆  │                                                                              │               │
│ 💬 │                                                                              │               │
│ ⊞  │        ┌───────────────────────────────────────────────────────────┐        │               │
│ ☰  │        │ ✦ Describe what you want to create…                        │        │               │
│    │        └───────────────────────────────────────────────────────────┘        │               │
│    │   [Select▾][#][◻▾][✒][T][💬][✦]   ↶ ↷    − 24% +    ⓒ 1,240              │               │
└────┴─────────────────────────────────────────────────────────────────────────────┴───────────────┘
```

### 5.1 Chrome
- **Left icon rail:** 56 px wide. Labels are off by default; Menu › Settings › Menu labels widens it to 76 px, with labels under the icons.
  - Order, top to bottom:
    1. KW logo (→ dashboard)
    2. ≡ menu
    3. Templates
    4. **Products** (addition, garment icon)
    5. Text
    6. Elements
    7. AI image
    8. **Mockups**
    9. Photos
    10. Pattern fills
    11. Likes
    12. Uploads
    13. **Brand**
    14. AI assistant (chat)
    15. **Team** (addition, clubs only)
    16. Apps
    17. Layers
  - Help and settings sit at the bottom.
  - Clicking an icon opens a **flyout panel** (320 px) next to the rail; clicking it again closes it.
- **Top-right cluster** (floating over the canvas, no full-width top bar, as in Kittl):
  - collaborator avatars;
  - **download icon** (Export panel);
  - **Share** button;
  - copy-link icon;
  - **Order** button (addition; primary navy; disabled with a tooltip until a Garment board validates).
- **Right inspector:** 280 px, always visible, with stacked sections and 16 px padding. Contents depend on the selection (§5.3).
- **Bottom centre:**
  - floating **prompt pill** "✦ Describe what you want to create" (640 px). Clicking it expands the **AI panel** (§5.6);
  - under it, the **tool dock**: Select ▾ (V) · Frame (F) · Shape ▾ (R/O) · Pen (P) · Text (T) · Comment (C) · AI ✦;
  - then Undo / Redo, zoom "− 24% +", and the **credit balance**.
- **Canvas:** infinite, with dot grid. Wheel to pan, Ctrl+wheel to zoom. Space-drag pans. Alt-drag duplicates.

### 5.2 Boards on the canvas

| Board | Label colour and icon | Created from | Content |
|---|---|---|---|
| **Artboard** | Grey label | Frame tool, templates, Text/Elements | Free design (posts, size charts, labels) |
| **Garment board** (addition) | Navy label, shirt icon | **Products** panel, or a Kit template | A Knitwright product: base article + design layers. Shows a **Front · Back · Sleeve L · Sleeve R · Collar** page switcher and a **2D / 3D** toggle at the top of the board. 2D shows the real panel shapes (print areas) with bleed and safe zones; 3D shows the model. Behaves like a Kittl artboard: drop text, elements, uploads and pattern fills onto a panel. |
| **Mockup board** | Electric label, mockup icon | Connector "Add… → Mockup", Mockups panel, Tools | Live-linked to its source board. Garment boards use the locked garment render. |
| **AI Image board** | Electric label, image icon | Connector, Tools, AI panel | Prompt, model, aspect and style saved on the board; **Regenerate** on hover |
| **AI Video board** | Electric label, video icon | Connector, Tools | First/end frame, preset, model, duration, audio |
| **Tech pack board** (addition) | Navy label, document icon | Garment board connector "Add… → Tech pack", Tools | A stack of A4-landscape pages (the 16-page layout in `02` F-S6), **live-linked** to the garment. Click a page to edit its fields in the inspector. Export as PDF (combined) or Excel. |
| **Note** | Grey sticky | Template | Instruction text |
| **Section label** | Gold label | Template | "1 PICK YOUR KIT" etc. |

- **Board label:** above the top-left corner, 12 px, icon + name. Double-click to rename.
- **Connector:** on hover, a **dot** appears at the board's right edge. Click → **Add…** menu: AI Image board · AI Video board · Mockup · **Tech pack** (garment only) · **Order sample** (garment only). Drag the dot into another board for fan-in.
- **Connector lines:** 2 px Electric, curved, with an arrowhead.
- **Generating state:** gradient placeholder, spinner and "Generating 00:23". On failure: red outline, "Failed, credits refunded", Retry.

### 5.3 Right inspector by selection

| Selection | Sections, top to bottom (copy Kittl where it has the same section) |
|---|---|
| Nothing | Project name + version history · **Project colors** (hex + opacity rows, "See all n colors", Browse color palettes) · **Tools** (AI Image board, AI Video board, Mockup, Tech pack) |
| Artboard | **Artboard size** (unit, portrait/landscape, preset ▾, W/H + link, ☑ Clip content) · Layer opacity · Color · Tools · Margin + · Selection colors |
| Text | Alignment · Transform · Layer · **Text colors** · Border · **Text style** (font, weight, size, letter-spacing, line-height, align, case) · Transformation · Text shadow · Text decoration |
| Image / element | Alignment · Transform · Layer · Color · Border · Shadow · Tools (Remove BG, Edit area, Erase & fill, Vectorize, Upscale) |
| **Garment board** (addition, same visual style) | **Product** (base name + code, class A/B, fabric, "Change base") · **Options** (Collar, Sleeve finish as tile chips; Body length, Sleeve length and Drop tail as sliders with range text; locked items show 🔒 + Why?) · **Colourways** (Home ▾, + New) · **Kit colours** (role swatches, Brand tab) · **Names & numbers** (toggle, font, colour, preview player) · **Size preview** (XS–3XL) · **Checks** (validation list with ✓ / ⚠ / ✕ and Why?) · **Price** (from £x at 1 / 50 / 100 / 300) · Tools (Mockup, Tech pack, AI Image, AI Video) |
| Panel layer on a garment (artwork, text, fill) | Kittl image/text sections, plus **Placement** in mm from the panel anchor, **Apply to sizes** (Grade / Fixed / Anchor) and **Print type** (Sublimation default) |
| Mockup board | Mockup (scene name, Replace scene) · **Colourway** · **Roster player** (clubs) · Background (Match artboard color, transparent) · Tools (Convert to image, AI Video board) |
| AI Image / Video board | Transform · Tools (Flatten, Upscale, Reframe; video: Flatten) · the board's prompt shown in the prompt pill |
| Tech pack board | Page list (thumbnails) · selected page's fields with provenance tags · **Export PDF / Excel** |

### 5.4 Left flyout panels

| Panel | Contents (copy Kittl's panel layout: search on top, chips, sections with "Show all ›") |
|---|---|
| Templates | Search with recent searches, chips (Teamwear, Social, Launch packs, Videos, Tech packs), rows For you / Trending / Kit launch packs. ⋯ menu → Add to project / Open in new project |
| **Products** (addition; modelled on Kittl's Printful app panel) | Search; chips by sport; sections **My products** (saved designs) and **Knitwright bases** (JSY-SS-01 …). Cards: render, name, "from £x · from 1 pc". Click → a Garment board is placed on the canvas, sized to its panels |
| Text | Add heading / subheading / body; text presets; **Brand** tab with the brand's font roles |
| Elements | Search; chips Shapes · Sport icons · Numbers · Badges · Textures · Ornaments; hover **Replace** (keeps size and colours) |
| AI image | Opens the AI panel in Generate Image mode |
| Mockups | Search; collections with Show all (Product renders, Flat lay, Teamwear, Training, Running, Combat, Esports, E-commerce); crown on premium |
| Photos | Stock search (Pexels/Unsplash) |
| Pattern fills | Stripes, hoops, camo, gradients, geometric; **+ Create pattern fill** opens the repeat maker |
| Likes | Liked templates and elements |
| Uploads | Upload button, uploads grid, "Clipped images" |
| Brand | Brand switcher; Logos, Colors, Fonts and Graphics sections; drag onto the canvas |
| AI assistant | Chat (Creative Agent) |
| **Team** (addition, clubs) | Roster list (name, number, size, status) · Add player · Share sign-up link · Import CSV · "Preview on garment" |
| Apps | Shopify · Etsy (later) · QR code · Pexels · Bulk mockups |
| Layers | Layer tree of the selected board |

### 5.5 Contextual task bar
A floating bar above the selection, 36 px tall, white, with shadow. Copy Kittl's content per type:
- **Image:** Remove BG · Remix · Generate video · more ▾ · duplicate · download · ⋯
- **Group:** fill ▾ · Ungroup · duplicate · download · ⋯
- **Element:** fill ▾ · Erase · Find similar · duplicate · download · ⋯
- **Artboard or Garment board:** AI Image board · AI Video board · Mockup · more ▾ (Tech pack, **Apply brand**, Set as thumbnail) · duplicate · download · ⋯
- **AI board:** AI Image board · AI Video board · Mockup · more ▾ (Flatten, Upscale, Reframe) · duplicate · download · ⋯
- **Video board:** player bar (play, scrubber, mute, Flatten, download)

### 5.6 AI panel (bottom, expands from the prompt pill)
- **Tabs:** Generate image · Remix image · Generate video · (Agentic AI).
- **Edit-board header:** "Edit AI Image board ×" when editing a board.
- **Reference strip:** reference thumbnails → output thumbnail. The garment reference is pinned with a 🔒 "Garment locked" tag (Knitwright rule).
- **Prompt** textarea, **Prompt builder** link and enhance ✦.
- **Suggestion chips:** Floodlit pitch · Changing room · Studio white · more…
- **Video presets:** Walk-out · Slow orbit · Sprint past · Ball juggle · Fabric macro · Flag wave · Dolly back · Smooth tracking.
- **Footer:**
  - **Style** button (Browse styles modal: Editorial, Matchday poster, Gritty training, Clean e-com, Retro film, Your styles);
  - model selector (cards with description, est. time and credits; video shows credits per second);
  - aspect ▾ (Match, 1:1, 4:5, 9:16, 16:9);
  - count (1–4) or duration (3–15 s);
  - audio toggle;
  - **Generate ⓒ n**, with the cost shown on hover.

### 5.7 Modals and panels to copy

| Panel | Contents |
|---|---|
| **Export panel** (top-right download) | Target ▾ (this board / Selected artboards (n) with a checklist) · W / H + unit (px, in, mm) · format PNG / JPEG / SVG / PDF / MP4 · DPI · "Export size: …" line · Color RGB (web) / CMYK (print) with "Printed colors may vary" · ☐ Remove background · ☐ Optimize quality · PDF: ☐ Combine into one file · **Export**. A garment-board target adds **Production package (ZIP)** and **Tech pack (PDF / Excel)** |
| **Quick export** (task-bar download) | Format ▾ · Size 1x / 2x / 3x · Advanced settings · Export |
| **Share** | Tabs **Link \| Invite**. Link: "Anyone with the link can view / edit" or "Only invited". Invite: email, Can view / Can edit, message, pending list |
| **Main menu ≡** | New project · My projects · Duplicate project · View › · Settings › (units in / px / **mm**, Dark mode, Menu labels) · Save ⌘S · Version history |
| **Color picker** | Tabs **Color \| Brand**; Solid / Linear / Radial; square + hue + alpha; eyedropper; HEX + %; Project colors. Knitwright addition: a print-safe warning line under HEX for garment panels |
| **Font panel** | Tabs **Fonts \| Brand**; search; chips Serif / Sans / Handmade / Sport; ♡ favourites |
| **Order** (addition) | A right-side drawer, styled like the Share popover but taller. Tabs **Sample \| Run \| Team store**. Sample: choose up to 3 sizes, price, date. Run: Printify-style **Select sizes** table (size rows, qty, unit price by tier, total). Team store: dates, margin, link. **Checkout** |

### 5.8 Keyboard shortcuts (copy Kittl)
| Key | Action |
|---|---|
| V | Select |
| F | Frame |
| R / O | Shape |
| P | Pen |
| T | Text |
| C | Comment |
| Space | Pan |
| Ctrl/⌘ + / − / 0 | Zoom in, zoom out, fit |
| Alt-drag | Duplicate |
| Ctrl/⌘ G / Shift G | Group / ungroup |
| ⌘S | Save |
| ⌘Z / ⌘⇧Z | Undo / redo |

---

## 6. How Knitwright features map into the Kittl shell

| Feature (`02`) | Where it lives now |
|---|---|
| F-S4 design editor | **Garment board** + **Products** panel + garment inspector. There is no separate editor; the Kittl canvas is the editor |
| F-S3 options and ranges | Garment inspector › Options |
| F-S5 "Why?" | ⓘ and **Why?** links in the Checks and Options sections; Ask in the AI assistant panel |
| F-S6 tech pack | **Tech pack board**, linked by connector; Export panel |
| F-S7 sample / run | **Order** button → Order drawer; connector "Add… → Order sample" |
| F-S1 inspiration | AI assistant panel + Photos + Likes; "Suggest from this" on any image's task bar (⋯ menu) |
| F-S2 benchmarks | AI Studio › Workflows › "Benchmark products" (workflow page format) |
| F-S9 Brand Studio | `/brand` (Kittl Brand page) + Brand panel |
| F-S10 collection plan | A **Collection** template: a canvas with section frames per group and Garment boards; Orders › Line plan table |
| F-T1–F-T6 Teamwear | Kit templates on the same canvas; **Team** panel; Order drawer › Team store |
| F-L1 mockups | Mockups panel / dashboard page; Mockup boards |
| F-L2 marketing | Artboards from templates; AI Studio workflows |
| F-L3 video | AI Video boards; video templates |
| F-L4 Flows | The canvas itself (boards + connectors); Kit launch pack templates |
| F-L5–F-L7 store, channels, dashboard | `/store`, `/orders`, Apps panel (Shopify) |

## 7. Accuracy process for the developer

1. Build each screen to match `prototype/index.html` (layout, spacing, components, states).
2. When the founder's Kittl screenshots arrive in `references/screens/kittl/`, put each one side by side with our build at the same window size (1440 × 900) and fix every difference in layout, spacing, order, labels or states that isn't one of the 6 allowed changes.
3. Every PR for a screen attaches a screenshot of our build next to the Kittl reference.
