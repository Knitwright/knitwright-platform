# 02 · Features

Each feature has an ID used in the build plan (`06-build-plan.md`), the data it touches (`03-data-model.md`) and acceptance tests. Wireframes are layout guides, not visual design. "Ref" points to rows and screenshots in `references/REFERENCES.md`.

Feature groups:
- **T:** Teamwear
- **S:** Studio
- **L:** Launch
- **O:** Ops and factory
- **G:** Guardrails

## The Studio journey

A founder moves through six stages. Each stage hands the same design object to the next.

```
 1 INSPIRE            2 DESIGN               3 ENGINEER               4 MAKE                 5 LAUNCH CONTENT     6 SELL
 Inspiration board    Fabra-style 2D/3D      Product intelligence     Sample → golden        Kittl-style mockups, Connect store &
 (live, context-      editor on a base +     explains every rule;     sample → run           marketing, video     publish, storefront,
 aware) + benchmarks  collection plan        tech pack view + files   (Printify-style order) and Flows            drops, or order bulk
 F-S1, F-S2           F-S3, F-S4, F-S10      F-S5, F-S6               F-S7                   F-L1–F-L4            F-L5, F-L6, F-L7
```

The left rail of the Studio shows these six stages with a completion tick, like SpecForm's 01–10 pack steps (Ref: founder file 5). A user can jump back to any stage; later stages show what changed and must be re-confirmed.

---

## Shared foundation

### F-0 Design object and validation
Every surface edits one versioned `design` record (schema in `schemas/design-object.schema.json`). A design is always on a `base_article` and always has a `factory_profile` it validates against.

**Rules**
- Every save creates a new `design_version` with `parent_version`. Undo and history are free.
- `validate(design_version, factory_profile)` returns a list of checks: article offered, parameters in range, fabric available, panel artwork DPI, seam crossings, safe zones, colour gamut, moderation status. It runs on every save and blocks ordering or export on any `error`.
- Every check carries a rulebook reference so F-S5 can explain it.
- Status moves `draft → validated → approved → ordered`. Editing an ordered version creates a new draft.

**Acceptance**
- Every surface renders the same version identically.
- An invalid design cannot be ordered or exported. The UI lists each failing check with "Why?" and "Fix" links.

---

## Teamwear

### F-T1 Template gallery and quick configurator (Ref: founder screenshot 1 NOKTO configurator, spized-home, owayo-home)
**Flow:**
1. Pick sport, then article or kit bundle.
2. Pick a template.
3. Set primary, secondary and accent colours.
4. Drop the crest and up to 3 sponsors into fixed slots.
5. Pick collar and sleeve from the article's option list.
6. Toggle names and numbers.
7. See it on the 3D model and get the price.

A "Design in Studio" button opens the same design in the full editor.

**Layout, taken from NOKTO's configurator:**
- **Full-bleed 3D stage** on the left two-thirds, with a sport-appropriate backdrop (pitch, court, gym). A view chip in the bottom-left corner shows the current view (Front, Back, Left, Right, Collar).
- **Vertical tool rail** on the stage:
  - undo and redo;
  - add element (crest, sponsor, text);
  - ideas (opens F-T2 suggestions);
  - play (360° turntable);
  - fullscreen;
  - snapshot (downloads a PNG for WhatsApp).
- **Right panel:**
  - product name, then info, account and cart icons;
  - a pill row for the parts of the kit (Shirt · Shorts · Socks), each with a tick when done;
  - an accordion with one row per decision. Each row shows the current value as a short code: Model & fit (Short sleeve), Colours (3 swatches), Pattern & design (`Plain · P00`), Collar & cuffs (`C01 · colour & stripes`), Crest & sponsors, Names & numbers. Codes come from the catalogue (`option_def.value`), so the factory and the club use the same reference.
- **Sticky footer:**
  - quantity stepper;
  - price per piece, with the tier discount badge (e.g. "−24%") and total;
  - buttons: Save (icon), Quote, Add to cart.

```
┌──────────────────────────────────────────────────────────┬──────────────────────────────┐
│ ↶ ↷                                                     │ Short-sleeve jersey  ⓘ 👤 🛒 │
│                                                          │ [✓ Shirt] [ Shorts ] [ Socks]│
│ ＋                                                       ├──────────────────────────────┤
│ 💡     [ 3D jersey on a pitch backdrop, orbit/zoom ]     │ 👕 Model & fit   Short sleeve›│
│ ▶                                                        │ 💧 Colours       ■ ■ ■      ›│
│ ⛶                                                        │ ▨ Pattern        Plain · P00 ›│
│ 📷                                                       │ ⌄ Collar & cuffs C01        ›│
│                                                          │ ⛨ Crest & sponsors          ›│
│ [Front]                                                  │ #  Names & numbers   On     ›│
│                                                          ├──────────────────────────────┤
│                                                          │ [− 20 +]  £25.00/pc  −24%    │
│                                                          │           Total £500.00      │
│                                                          │ [💾] [ QUOTE ] [ ADD TO CART ]│
└──────────────────────────────────────────────────────────┴──────────────────────────────┘
```

**Acceptance**
- A club with its colours and crest finishes a kit in 90 seconds.
- First 3D render takes under 3 seconds on a mid-range laptop.
- On a phone, the right panel becomes a bottom sheet over the 3D stage.

### F-T2 Crest-to-kit (Ref: nokto-ai-designer)
**Flow:**
1. Upload a crest (PNG, JPG, SVG or PDF, up to 10 MB), or pick up to 3 colours.
2. Optionally enter the club name.
3. Pick the sport and "home / away / goalkeeper / all three".
4. Choose a feel: classic, modern, bold or plain.
5. In under 30 seconds, see 6–9 complete kits (shirt + shorts + socks colour) as cards. Clicking a card opens it in F-T1.

**How it works (deterministic, not image generation):**
1. The crest is vectorised; raster under print quality is flagged.
2. The palette is extracted (k-means in Lab, 3–5 colours, snapped to the sublimation gamut and the nearest Pantone).
3. A rules engine combines the palette × template family × feel into parameter sets: which template, which colour goes where, stripe and pattern options, accent placement.
4. Each candidate passes F-0 validation before it is shown.
5. An LLM call is used only to rank candidates and write a one-line description of each. It never draws.

**Acceptance**
- 95% of a 100-crest test set yields kits whose primary colour matches the crest's dominant colour (ΔE00 < 5).
- No candidate fails validation.
- The crest is placed unaltered.

### F-T3 Committee share link (Ref: nokto-how-it-works, mercer-pricing)
**Flow:** "Share for approval" creates a link (no account needed) to a read-only 3D view of the selected design versions. Viewers can:
- comment on a point of the model (a pin on the panel);
- vote on version A/B/C;
- press "Approve" with their name.

The kit manager sees comments and votes and can lock the approved version.

**Rules:** links expire after 30 days and can be revoked. Commenters give a name; an email is optional. Viewers cannot edit.

**Acceptance:** works on a phone without login; approval is recorded with name, timestamp and version.

### F-T4 Roster and size collection (Ref: nokto-how-it-works)
**Flow:**
1. The kit manager creates a roster: paste a list, upload a CSV, or share a "player sign-up" link.
2. Players enter name-on-shirt, number and size, with the size guide on the page.
3. Duplicate numbers are flagged.
4. The kit manager sees a grid of collected vs missing entries and can chase stragglers by WhatsApp link or email.
5. Saved sizes pre-fill next season's roster.

**Rules**
- Names are checked against the safe zone and character limits (maximum length per article and zone).
- Profanity is filtered.
- Numbers are 0–99 by default; configurable per sport.

**Acceptance:** a roster of 25 is collected through the sign-up link with zero spreadsheet work; per-player 3D preview shows name and number on the back.

### F-T5 Instant quote PDF (Ref: nokto-team)
**Flow:** "Quote" turns the basket (articles × quantities, personalisation, delivery postcode) into a branded PDF:
- quote number;
- price per piece by tier, with tiers counted across the whole basket;
- what's included (crest, sponsors, names and numbers);
- delivery estimate from the next batch cut-off;
- VAT treatment;
- validity of 30 days;
- a link back to pay.

**Acceptance:** the PDF is generated in under 5 seconds, and the numbers match checkout to the penny.

### F-T6 Team store and club page (Ref: spized-home, owayo-home)
**Team store:**
1. The kit manager opens a store for an approved design or bundle: open and close dates, roster attached or open sign-up, optional club margin (0/5/10/15/20%) paid to the club after close, and a minimum to proceed (default 10 pieces).
2. Players and parents buy from a short link or QR code without an account.
3. At close, the store becomes one order with one delivery address, or split delivery at courier cost.

**Club page:** `<club>.knitwright.com` shows the crest, colours, current kit, open stores, size guide and contact. Supporters can buy saved designs between seasons (Class A, MOQ 1).

**Acceptance**
- A club opens a store in under 10 minutes.
- A parent checks out in under 2 minutes on a phone.
- If the store closes below the minimum, buyers are refunded automatically, or the kit manager tops up the order.

### F-T7 Checkout and order tracking
**Checkout:** Stripe Checkout in GBP or AUD, through the UK entity as merchant of record. VAT is charged at checkout for the UK; GST for Australia once registered.
- **Club orders:** paid in full at order.
- **Team stores:** each buyer pays at checkout, and the order is created at close.

**Tracking statuses:** `paid → in batch → at factory → in production → QC passed → shipped → delivered`. Each status sends an email; the tracking page has the courier number. A delay pushes a new promised date automatically.

**Acceptance:** 100% of placed orders validate against a factory profile before ops sees them.

### F-T8 Club workspace and reorder
**Workspace holds:**
- members and roles (admin, kit manager, viewer);
- brand kit: colours, crest, sponsors, fonts;
- designs and versions;
- rosters by season;
- orders, invoices and tracking.

**Reorder:** any past order can be reordered in two clicks with sizes pre-filled, with no minimum on reorders of a saved design (Class A).

---

## Studio

### F-S1 Inspiration board: live, context-aware inspiration and suggestions (stage 1, and a side panel in stages 2–3)
**Purpose:** while the founder designs, show images related to what they are making and turn the ones they like into **manufacturable suggestions**. Inspiration informs; it never lands on the garment as pixels.

**The context query.** Every few seconds of inactivity, and on each meaningful change, the board builds a query from the design object:
- sport and base article;
- colourway (names of the dominant colours);
- style tags from options (e.g. "raglan", "mock neck", "gradient sleeves");
- the brand's mood words from the brand kit.

The user can pin or remove tags to steer it.

**Sources, in this order, with each card labelled by source:**

| Source | How | Rules |
|---|---|---|
| Knitwright library | Past Knitwright designs, templates and golden-sample photos (with permission) matching the tags | Fully owned; can become suggestions directly |
| The user's own Pinterest boards | Official Pinterest API v5 through the user's own Pinterest login (OAuth) and the boards they choose | Display with link back to the pin; no scraping; Standard access needed for production (apply in Phase 2); cache only per API terms |
| Licensed stock photography | Unsplash and Pexels APIs searched with the context query | Attribution shown; hotlinked per their API terms |
| Brand and competitor products | Product links the user adds (F-S2) shown as link-preview cards (title, price, Open Graph image) | Not stored beyond the preview; opens the source; never used as artwork |
| Behance and Pinterest search | "Search on Behance / Pinterest" buttons open the site with the context query in a new tab; the user can drop an image or link back onto the board | Behance has issued no new API keys since 2021; no scraping of either site |
| AI mood images | Generated from the context query through a commercial-licence image API (e.g. FLUX via a licensed provider), marked "AI mood image" | Inspiration only; never applied to panels |

**From inspiration to suggestion.** Clicking "Suggest from this" on any card asks the vision model to describe the *transferable elements* in Knitwright's vocabulary: colour blocking, stripe or gradient type, collar style, sleeve type, panel lines, pattern family. These map to:
- parameter sets on the current base article (only options and ranges the factory allows);
- surface layers (pattern fills from Knitwright's library, colour roles).

Up to 3 **suggestion cards** appear, each rendered by Knitwright's own renderer and pre-validated. Each card says in one line what it changes and why it fits, e.g. "Diagonal sleeve gradient in your navy and gold; sublimates cleanly; no seam crossing". One click applies it as a new version.

Things the base cannot do are said plainly, e.g. "That jacket's welded zip isn't available on this base. The closest is a half-zip mock neck."

**Moodboard.** The user saves cards to the design's moodboard. Saved items keep the source link and attribution. Third-party images are stored as references (URL + preview) unless the user uploaded them.

```
┌──────────────── Studio · Compression top · v4 ─────────────────┬──────── INSPIRATION ─────────┐
│                                                                │ tags: [compression][navy]    │
│                                                                │ [gold][mock neck] (+ add)    │
│              [ 3D model ]     [ flat panels ]                  │ ┌────┐┌────┐┌────┐           │
│                                                                │ │lib ││pin ││stock│ …        │
│                                                                │ └────┘└────┘└────┘           │
│                                                                │ Search on: Behance  Pinterest│
│                                                                │ ── SUGGESTIONS ──            │
│                                                                │ ▣ Diagonal sleeve gradient   │
│                                                                │   "sublimates cleanly" [Apply]│
│                                                                │ ▣ Contrast side panel        │
│                                                                │   "+£0.40/pc" [Apply]        │
└────────────────────────────────────────────────────────────────┴──────────────────────────────┘
```

**Acceptance**
- The board refreshes within 3 seconds of a change.
- Every suggestion passes F-0 validation before it is shown.
- No third-party image is ever written to a panel layer or a print file.
- Every card shows its source and opens it.

### F-S2 Benchmarks: compare products (Ref: specform-product for provenance tags)
**Purpose:** show the founder what comparable products are made of and what customers complain about, so they make better decisions. It is a comparison, never a copy.

**Flow:**
1. "New benchmark" → paste 1–5 product URLs, or upload photos/screenshots, or paste review text.
2. The server fetches each URL **once**, logged out, respecting robots.txt, with a polite user agent and no crawling beyond that page.
3. A vision-capable LLM extracts a **benchmark card** into a fixed schema:
   - product name, brand, price and currency;
   - fabric composition, GSM if stated, fit, size range;
   - feature list from Knitwright's construction taxonomy (gusset, flatlock seams, bonded hem, mesh venting, hidden key pocket, silicone waist gripper, drop-tail, raglan sleeve…);
   - claims (e.g. "squat-proof");
   - review complaint themes, if review text is available on the page or pasted.
4. Each field is tagged `observed` (stated on the page), `inferred` (from the image) or `unknown`. The user can confirm or correct any field.
5. **Compare view:** 2–5 cards side by side, with a feature matrix and complaint themes ranked by frequency.
6. **"Apply to my design":** maps the chosen *functional* features onto the base article's available options and ranges. Unsupported features are listed as "not available on this base". Each mapped feature links to its F-S5 explanation.

**Stored:** derived facts and the source URL only. No page HTML, no third-party images (except the user's own uploads, kept private), no review text beyond short theme summaries.

**Guardrails (F-G1):**
- Logos, brand names, prints and distinctive graphic elements are never carried into a design.
- If a benchmark is linked, the design-around check compares silhouette options and surface layout to the benchmark and warns on close matches.

```
┌───────────────────────────── Benchmark: Running shorts ─────────────────────────────┐
│ Product A ▾              │ Product B ▾              │ Product C ▾              │ + │
│ £45 · 88/12 poly/el      │ £38 · 100% poly          │ £60 · 86/14 nylon/el     │   │
│ 5" inseam · 2-in-1       │ 7" inseam                │ 5" inseam · liner        │   │
├──────────────────────────┴──────────────────────────┴──────────────────────────┴───┤
│ FEATURE                  A      B      C     │ COMPLAINTS (from reviews)           │
│ Zip back pocket          ●obs   –      ●obs  │ 1 Liner rides up        ████████ 31 │
│ Bonded hem               ●obs   ○inf   ●obs  │ 2 Pocket bounces        █████    19 │
│ Side split               ●obs   ●obs   –     │ 3 Waistband rolls       ████     14 │
│ Reflective trim          –      ●obs   ●obs  │                                     │
├──────────────────────────────────────────────┴─────────────────────────────────────┤
│ [ Apply features to a base article ▸ Shorts ]          obs = stated · inf = inferred│
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Acceptance**
- A URL becomes a card in under 20 seconds.
- 90% of `observed` fields on a 50-page test set are correct.
- No stored record contains copied page HTML or third-party images.

### F-S3 Base articles and parametric design (Ref: founder screenshot 3 Fabra "Design")
**Base article** = one graded block from the factory's pattern master. It holds:
- panel map;
- size range and points-of-measure (POM) table;
- **parameters with factory-approved ranges** (e.g. shorts: inseam 3–9 in; waistband elastic, drawcord or both; side split on/off; pockets from a list);
- **option sets** with catalogue codes (collars `C01…`, sleeves `S01…`, patterns `P00…`);
- fabrics allowed;
- the construction table: seam type per seam, stitch, hem and binding.

Changing a parameter recomputes the panel geometry from the block's rules. The 3D view and the POM table update. Out-of-range values are impossible in the UI.

**Implementation:**
- Each base article's geometry is a parametric script (FreeSewing-style, `@freesewing/core` MIT, or Knitwright's own) with a fixed set of parameters and a grading table.
- At article creation, the script's size-M output for default parameters is checked against the factory's master pattern (±2 mm).
- Every parameter range is signed off by a sample (see F-S7).

**Acceptance**
- For every article, every size × every parameter combination at range ends produces valid closed panels.
- Default-parameter output matches the master within 2 mm on every seam.

### F-S4 Studio home, catalogue and design editor (Ref: Fabra V2 demo video, `research/kittl-fabra/video-ui-notes.md` Videos 1–2; founder screenshots 2 Fashdeck, 3 Fabra)
The Studio follows **Fabra's** layout and workflow, adapted to sportswear and to Knitwright's "manufacturable by construction" rule. Fabra lets users drag pattern nodes freely; Knitwright's **Form** toolbar only exposes factory-approved options and ranges.

**Studio home** (Fabra dashboard pattern)
- **Left sidebar:**
  - **+ New** button (green, top);
  - workspace switcher;
  - **Products** (my designs);
  - **Brand kit**;
  - **Projects** (expandable): All · Designs · Collections (range plans) · Moodboards · Pattern fills · Mockups · Flows;
  - **Library** (expandable);
  - "Get started" video card; Help; Trash.
- **Top bar:**
  - search "Search templates, base products, fabrics, or more";
  - credits counter;
  - notifications;
  - avatar.
- **Body:**
  - greeting;
  - **action cards**, each with a + button: **Start a new design** ("Begin from a Knitwright base, a sportswear template, or a crest"), **Browse bases and templates**, **Moodboard** (F-S1), **Collection plan** (F-S10), **Pattern fill** (repeat maker), **Launch pack** (Flows, F-L4);
  - **Jump back in** row with filter chips: All · Designs · Collections · Moodboards · Mockups · Flows. Cards carry coloured type tags.

**Create a new design modal**
- **Knitwright library**:
  - **Base products**: "Start from a factory-approved base";
  - **Templates**: "Ready-made sportswear designs to remix" (`07-template-library.md`).
- **From your crest or logo**: opens F-T2 crest-to-kit for brands and clubs.
- **Your team**: shared designs.
- No "blank canvas / draft your own pattern" option. Custom patterns go through the pattern service request instead.

**Base product and template catalogue** (Fabra Products page)
- Tabs: **Base products | Templates**; sort: Newest / Most used.
- **Filter panel:**
  - **Sport**: Football, Cricket, Training, Running, Gym, Combat, Esports;
  - **Article type**: Jersey, Shorts, Long sleeve, Compression, Tee, Hoodie;
  - **Fit**: Regular, Slim, Compression;
  - **Gender**: Men, Women, Unisex, Kids;
  - **Production class**: A (from 1 piece), B (50–300);
  - **Fabric**;
  - **Style**: Stripes, Hoops, Gradient, Retro, Minimal…
- **Grid cards:** white 3D render, name, code, "From £x · from 1 pc" or "50+ pcs", tags (NEW, Class A).
- An icon marks bases with editable options ("Edit this product's form"). Tooltip: "Collar, sleeve finish, lengths and drop tail can be changed".

**Editor layout** (Fabra editor pattern)
- **Top bar:**
  - logo;
  - design name, auto-named from its options until renamed (e.g. "Crew neck · Coverstitch sleeve · +20 mm length");
  - **File** menu;
  - undo/redo (centre);
  - credits;
  - **Validate ✓** status chip;
  - **Share**;
  - **Export** (primary).
- **Left rail:** a segmented toggle between three toolbars.
  1. **Form toolbar** (Knitwright version of Fabra's form editing):
     - option groups as tiles: Collar (C01 crew rib · C02 V-neck · C03 crew binding), Sleeve finish (K01 · K02), Hem / drop tail;
     - **parameter sliders** with their approved range shown ("Body length +20 mm · range −30 to +40");
     - each change re-drafts the pattern pieces and re-simulates the 3D model automatically;
     - options without an approved golden sample show a lock and "Not yet sampled", with a **Why?** link.
  2. **Library toolbar:**
     - **Knitwright library**: Fabrics (the fabric programme, with spec cards), Colours (Pantone TCX search + sportswear palettes such as "Classic club colours", "Neon training", "Retro 90s"), **Pattern fills** (repeats: stripes, hoops, camo, gradients, geometric), **Graphics** (sport icons, numbers, textures);
     - **Your library**: Brand kit (logo, crest, sponsors, colours, fonts), Palettes, Pattern fills, Uploads;
     - **Inspiration** (opens the F-S1 board).
  3. **Specs toolbar:**
     - **Garment**: Select, Measure point, Measure line, Measure edge;
     - **Annotate**: Callout.

     These draw POM lines and callouts on the 2D or 3D view and write them to the tech pack.
- **Canvas:** one design, three views, toggled at the bottom centre **2D | 3D | Tech pack**. They can be shown side by side, and all are views of the same design version.
  - **2D view:** dotted grid with rulers; pattern pieces outlined, with sew line, bleed and safe zone; a 100 mm scale bar.
  - **3D view:** the base article's glTF on a neutral sportswear mannequin, with orbit and preset views.
  - **Tech pack view:** F-S6.
- **Bottom bar (left):** colourway selector (Home · Away · GK · + New colourway) and size selector (XS–3XL; artwork re-scales by grading).
- **Bottom bar (right):** **Simulate** button (re-simulates the 3D model after big edits) and a status chip ("Simulated", "Not sim ready").
- **Right panel: Design Summary** (Fabra), with sections:
  - **Fabrics:** each fabric and the pieces it is on, e.g. "F-POLY-INT — Front, Back, Sleeves +2";
  - **Colours:** role, Pantone and hex;
  - **Pattern fills;**
  - **Graphics;**
  - **Names & numbers;**
  - **Trims & labels;**
  - **Stitches:** read-only from the base construction table.

  Clicking any row opens its editor in the same panel.

**Applying things** (Fabra interactions)
- **Fabrics and colours:** click to apply to all pieces, or **drag onto a single panel**. On-canvas hint: "Click to apply to all or drag to apply to one panel".
- **Pattern fill popover:**
  - tile preview;
  - **Colours** row (recolour the fill with brand colours);
  - Width / Height in mm, with ratio lock;
  - Padding horizontal and vertical;
  - Rotation;
  - **Apply to all** or to the selected panel;
  - delete.
- **Graphic selected → Edit Graphic panel:**
  - name and preview;
  - **Remove background**;
  - **Convert to pattern fill**;
  - **Colours**;
  - **Type**: Sublimation (default) / Heat transfer / Embroidery (only if the factory profile supports it);
  - **Size** W × H in mm with lock;
  - **Position** X / Y in mm from the panel anchor (CF, HPS);
  - **Rotation**, flip and align;
  - **Apply to sizes**: grade / fixed / anchor;
  - delete.
- **Names & numbers:** pick the font from the licensed list, colour role and outline. Zones are fixed by the base (R-PER rules). A preview roster entry ("SMITH 7") shows on 3D.
- **Repeat / pattern-fill maker** (Fabra repeat print maker): upload an image or draw, then choose tile size (cm/in) and repeat style (Full drop · Half-drop · Brick · Mirror), with tile bounds, layers and background colour. **Publish** saves it to Your library. Uploads pass moderation (F-G1).
- **Guardrails:**
  - automatic bleed;
  - safe zones;
  - minimum DPI at print size (below 150 DPI flagged);
  - sublimation gamut warning;
  - seam-crossing warning;
  - moderation on upload.

  Each warning has a **Why?** link (F-S5).
- **Describe a change** box: an instruction becomes a design-object diff (Phase 4), previewed and applied on confirm, never a regenerated image.

**Share** (Fabra share popover)
- Invite by email with **Can view / Can comment / Can edit** and a message.
- **Copy link**, with link access "Only invited people" or "Anyone with the link can view".
- **People with access** list.
- A factory is invited as **Can view** (or uses the F-O2 job packet).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ KW  Crew neck · Coverstitch sleeve · +20mm   File   ↶ ↷        ✦ 1,240   Validate ✓  Share [Export]│
├──────────┬────────────────────────────────────────────────────────────┬────────────────────────────┤
│[Form|Lib|Specs]                                                       │ DESIGN SUMMARY             │
│ LIBRARY  │                                                            │ FABRICS                    │
│ Knitwright│     2D pattern pieces          │      3D jersey           │  F-POLY-INT  Front +3      │
│  Fabrics │     (grid, rulers, bleed)      │      on mannequin        │ COLOURS                    │
│  Colours │                                │                          │  ■ Navy 19-4024 TCX        │
│  Pattern │                                │                          │  ■ Gold 14-0957 TCX        │
│  fills   │                                │                          │ PATTERN FILLS              │
│  Graphics│                                │                          │  Diagonal stripe · Sleeves │
│ Your lib │                                │                          │ GRAPHICS                   │
│  Brand kit│                               │                          │  Crest · Front 70×80 mm    │
│  Palettes│                                │                          │ NAMES & NUMBERS  On        │
│  Uploads │                                │                          │ TRIMS & LABELS             │
│ Inspiration                               │                          │ STITCHES (from base)       │
│          │ [Home ▾] [Size M ▾]     2D | 3D | Tech pack      [Simulate ▶] Simulated ✓           │
└──────────┴────────────────────────────────────────────────────────────┴────────────────────────────┘
```

**Acceptance**
- A first-time founder goes from a base to a validated design in 30 minutes in a moderated test.
- Switching between 2D, 3D and Tech pack never loses state, and all three show the same version.
- Every save validates.
- Print files match the 3D view within the agreed colour delta.

### F-S5 Product intelligence: the "Why?" layer
**Purpose:** the system explains every constraint, default and tech-pack value in plain language, with the best practice behind it. Founders learn while designing, and trust the files.

**Where it appears**
- A **"Why?" link** on every validation warning, every parameter range and every option the base doesn't offer.
- A **"Why?" link** on every tech-pack field: seam type, stitch, tolerance, BOM line, label rule.
- A **"Best practice" card** when a part is selected. Example: compression top, neckline, "Mock necks on compression tops use a 2-layer self-fabric collar with a flatlock join, so there is no raised seam against the neck."
- An **"Ask" box** (SpecForm's "Ask Mochi" pattern), scoped to the current design.

**Rules**
- Answers are **grounded in Knitwright's rulebook**: a curated, versioned knowledge base written with the factory and pattern master. Entries cover:
  - construction per article (seam types, why flatlock vs overlock, stitch densities);
  - fabric choice (why 85/15 poly/elastane for compression, why poly for sublimation);
  - print rules (bleed, seam shift ±3 mm on sublimated panels, gamut);
  - fit and grading (why ±5 mm on inseam, grade rules);
  - labels and compliance per market;
  - cost drivers (what adds cost and how much).
- The LLM selects and phrases rulebook entries for the current context and cites them ("Rulebook R-SUB-004"). If no entry covers the question, it says so and logs the gap for the team. It never invents a manufacturing fact.
- Every validation check, option and tech-pack field has a `rule_id`.

**Examples**
- Warning: "Logo crosses the side seam." **Why?** "Front and back are printed and cut as separate panels, then sewn. Sewing shifts panels by up to 3 mm, so a logo across the seam may not line up. Move it 15 mm inside the seam, or keep it if a slight offset is fine (R-SUB-004)."
- Range: "Inseam 3–9 in." **Why?** "Below 3 in, the side split and hem can't both fit. Above 9 in, the block's thigh shaping no longer fits our size chart. Ask us for a longer base (R-SHO-002)."
- Tech pack: "Flatlock 607 on side seams." **Why?** "A flat, 4-needle seam sits flush on stretch fabric and doesn't chafe during movement; standard on compression (R-CON-011)."

**Acceptance**
- 100% of validation checks, options and tech-pack fields have a rulebook entry before an article goes live.
- In a 50-question test set, 0 answers state a fact not in the rulebook.

### F-S6 Tech pack view, exports and production package (Ref: Fabra V2 demo video tech pack, share and export screens; founder file 5 SpecForm tech pack; `articles/JSY-SS-01/techpack/`)
The tech pack is the **third view of the design** (Fabra pattern), not a separate document: **2D | 3D | Tech pack**. On wide screens the tech pack sits on the right and the 3D or 2D view stays on the left. Measurement pins and callout numbers match on both sides.

**Tech pack view.** A tab bar with a unit toggle (**mm | cm | in**) and a settings icon. Every field shows provenance: **From base** (green), **From design** (blue), **Needs your input** (amber), **Confirmed**.

| Tab | Content | Interactions |
|---|---|---|
| **Overview** | Logo, brand, collection/season, style name, style code (auto: `<brand>_<name>`), sample size, size range, base article code, production class, fabric, factory | Editable header fields; the rest come from the base |
| **Body** | Body size chart the garment is graded from (size standard, e.g. "Knitwright Adult Unisex"): chest, waist, hip, height per size; avatar with lettered rings | Read-only for founders (from base); "Show customers" toggle feeds the storefront size guide |
| **Measurements** | POM table. Toolbar: **+ Add measurement**, **Auto-map** (places the base's standard POMs), toggle **Measurement \| Grading**. Columns: letter, Measurement, **Grade type** (Linear / Non-linear / Ungraded), **Grade**, **Tol −**, **Tol +**, one column per size with the **sample size highlighted**, and a **Rule** column (rule ID) | Grades come from the base and are locked; parameter changes update the affected POMs. Founders can add **extra POMs** for their own QC (measured on the sample, not graded). **Specs toolbar** Measure line draws a POM on 2D or 3D and shows the live length |
| **Materials (BOM)** | Sections **Fabrics**, **Threads**, **Trims**, **Labels**, **Packaging**, each with **+**. Columns: Description · Print / colour · Code · Quantity · Unit · Notes | Fabrics and threads come from the base; trims and labels can be added from the factory's list only |
| **Callouts** | Construction callouts: **Callout \| References** (+ reference image). Rows come from the base construction table, e.g. "1 Crew neck 1x1 rib, 4-thread overlock" and "2 Sleeve hem 20 mm, 2-needle coverstitch"; numbered pins on 3D | Founders can add notes and reference images; construction itself is locked |
| **Artworks** | Every graphic and pattern fill: Artwork · **Type** (Sublimation / Heat transfer / Embroidery) · Tile width · Tile height · Angle · Size W × H · Position · Notes | Links back to the graphic in the editor |
| **Colourways** | One block per colourway: colour roles, Pantone TCX, hex, swatch ID, ΔE tolerance | Add, duplicate or rename colourways (shared with the bottom-bar selector) |
| **Personalisation** | Name and number zones, font, sizes and colours | From base rules R-PER |
| **Labels & packaging** | Care, size and brand labels per destination market; fold and bag | Auto-generated per market; brand label upload |
| **QC** | AQL plan, POMs to check, photo list | From base; read-only |
| **Review** | Every field still "Needs your input", plus the F-G2 pre-export check | Export is blocked until clear; no `[TBC]` is allowed |

**Export panel** (Fabra export tabs). A live 3D preview sits on the left; tabs across the top:

| Tab | Options | Output |
|---|---|---|
| **Tech pack** | Choose sections (Overview, Body size chart, Measurements, BOM, Callouts, Artworks, Colourways, Personalisation, Labels, QC) | **PDF** (16-page layout below) and **Excel** (one sheet per tab, with an "Open in Knitwright ↗" link cell). Free |
| **Images** | Select assets (Front · Back · Left · Right · All), PNG / JPG, size slider (e.g. 1200 × 1200 px "Recommended for manufacturing and Instagram"), toggles Include mannequin / Include background | Deterministic renders. Free |
| **Pattern** | Export as **DXF-AAMA / 1:1 PDF / SVG / PNG**; toggles "With pattern fills and graphics" and "With measurements" | Pattern files. Part of the paid production package if taken elsewhere |
| **Print files** | Per panel, per size, PDF/X-4 150 DPI with 10 mm bleed | Production print files. Part of the production package |
| **Production package** | Everything in `04-production-package.md` as one ZIP with a manifest | Paid if taken elsewhere (refunded as order credit); included when Knitwright makes it |
| **Mockups & media** | Opens the Mockup studio (F-L1) for on-model, lifestyle and flat-lay images | Credits |

**Tech pack PDF pages** (header block on every page: brand, style name, style #, season, base size, version; footer: style # and "Page x of y"):

| # | Page |
|---|---|
| 1 | Overview: style details and key construction features |
| 2 | Technical flats, black and white |
| 3 | Rendered colour views |
| 4–5 | Bill of materials |
| 6 | Construction details |
| 7 | Construction annotations (numbered callouts on the flat + legend) |
| 8 | Measurement annotation (lettered POM drawing + base-size table) |
| 9 | Size grading (POM × sizes, grade type, grade, tolerances) |
| 10 | Graphics & prints |
| 11 | Print placement (graphic, type, W × H mm, per panel) |
| 12 | Personalisation (names and numbers) |
| 13 | Labels & packaging |
| 14 | Colourways (fabric + colour per variant) |
| 15 | QC checklist |
| 16 | Reference images (golden-sample photos when available; otherwise renders labelled "render, not photo") |

The worked example is `articles/JSY-SS-01/techpack/JSY-SS-01_techpack.html` (with a factory sign-off page 17 used only during base onboarding).

**Rules**
- The tech pack and production package are views of the design version: regenerated, never hand-edited. Edits happen in the tabs, which write to the design object.
- Locked values (grades, construction, fabrics from the base) show a lock and a **Why?** link (F-S5).
- **Translate** produces the PDF in English and Urdu for Sialkot floor staff (Phase 3).

**Acceptance**
- A Sialkot factory produces a sample from the package alone, without questions, in the Phase 0 test (3 of 5 factories within tolerance).
- Every DXF opens in at least two CAD tools without manual fixes (test matrix in `04`).
- The Excel and PDF exports contain identical values for the same version.

### F-S7 Make: product created, sample, run (Ref: founder screenshots 9–10 Printify)
**"Product created" screen (Printify pattern).** "Save product" on a validated design opens a hand-off page:
- left: "Product created" with a short summary (article, fabric, colourway, price at 1/50/100);
- right: a hero render, or the golden-sample photo once one exists.

Four next steps:
1. **Order a sample** (primary until a golden sample exists);
2. **Shoot it** (opens F-L1);
3. **Connect your store & publish** (F-L6);
4. **Order a run** (enabled after golden-sample approval).

Plus "Create more products in this collection".

**Sample:**
- One piece per size requested (max 3 sizes), produced in the next Class A slot or as a Class B sample.
- Price and lead time are shown before payment.
- After receipt, the founder rates fit and colour and either approves (creating the **golden sample** record: photos, measured POM, ΔE readings) or requests changes (new version).

**Order modal ("Select sizes", Printify pattern).** For direct orders (a brand ordering stock to its own address):
- search across "My products";
- filter chips: All · Class A (from 1) · Class B (runs) · Ready to ship by <date>;
- one row per product × size: thumbnail, size, "Made by Knitwright · Sialkot", unit price at the current quantity tier, colour, availability, quantity input;
- the tier price recalculates as quantities change;
- a footer with the total, delivery date and "Checkout".

**Run:**
- **Class A:** any quantity from 1, in the weekly batch.
- **Class B:** 50–300 per style from the stock-colour programme, priced by tier.
- A run requires an approved golden sample of that design version, or of a parent version that differs only in surface.
- Payment: in full at order, or 40% deposit + 60% before shipping for runs over £2,000. The balance is invoiced by Knitwright as seller; this is not escrow.

**Acceptance:** a run cannot be placed without an approved golden sample; the delivery date shown equals cut-off + factory lead time + QC + freight from current factory profile data.

### F-S8 Catalogue and fabric programme (Ref: founder screenshot 11 Printify catalogue, fashdeck-home fabric cards)
**Catalogue home (Printify pattern):**
- top tabs: For you · Men · Women · Kids · Teamwear · Fightwear · Training;
- search bar;
- category cards with real sample photos;
- market and currency selector (UK | GBP, AU | AUD).

**Article page:**
- photos of real samples;
- price ladder by class and quantity;
- fabrics with spec cards (code, fibre blend, GSM, stretch, finish, colours available, swatch photo);
- size chart, fit notes, care, lead time.

**Fabric programme:** a small set of fabrics with a fixed palette. A physical swatch book is available to buy (credited on first order).

### F-S9 Brand workspace and Brand Studio (Ref: Kittl Brand Studio video, `research/kittl-fabra/video-ui-notes.md` Video 5)
**Brand Studio** works the same for clubs and brands, and the brand is applied everywhere.
- **Brand switcher** in the top bar with a **completion %** pill, and a menu: Manage brand · Switch to › · + Add brand.
- **Import your brand:** paste a website or Instagram URL. In about a minute it imports:
  - logos (including the favicon);
  - colour palettes;
  - fonts (closest licensed match);
  - graphics (product photos);
  - a written visual style.

  You can also **Create new** by hand. Clubs can start from their crest: the palette is extracted as in F-T2.
- **Brand page tabs:** Overview · Logos · Colours · Fonts · Graphics · Visual style · Sportswear.
  - **Overview:** cards with counts (4 logos, 2 palettes, 4 font styles, 13 graphics, visual style added) and a completion %.
  - **Colours:** named palettes (Primary, Secondary, Kit colours). Each colour has hex, Pantone TCX and its nearest sublimation-safe match, with a gamut warning.
  - **Fonts by role:** Headline · Subheadline · Body · Accent, plus **Name & number font** from the licensed kit-font list.
  - **Visual style:** three editable texts, **Setting**, **Art direction** and **Rules & boundaries**, written automatically from 5+ reference images. They feed every AI scene in F-L1–F-L4.
  - **Sportswear:** crest and sponsor logos (vector preferred, with a DPI check), care and brand label artwork, packaging, default size range.
- **Edit brand:**
  - **Details:** name, category (Club · Sportswear brand · Gym · Esports team · School), website, about (1,000 characters);
  - **Voice and tone:** tags such as Bold, Gritty, Community, Premium or Playful, used by "Write for me" copy.
- **Apply your brand** toggle and dropdown in every workflow and template. A **Brand** tab in every colour and font picker. A brand tab in the image picker.

**Workspace holds** (like the club workspace, with a product list instead of rosters):
- the brand (as above);
- designs and collections;
- moodboards;
- benchmarks;
- samples and golden samples;
- orders;
- storefront;
- members.

The left navigation follows the Studio home sidebar (F-S4): + New · workspace switcher · Products · Brand kit · Projects · Library, plus Orders, Store and Settings.

### F-S10 Collection plan and line plan (Ref: Fabra V2 demo video, range plan and line plan screens)
**Purpose:** a founder plans a whole drop, not one product, and sees real costs and margins before ordering. This is Fabra's range plan, connected to Knitwright's actual price tiers.

**Collection board** (Fabra "Range plan")
- **Canvas:** an infinite dotted canvas.
- **Left panel:** Designs, Graphics, Uploads, Colours.
- **Bottom dock:** select, hand, frame, marker, pen.
- **Groups:** frames named by the founder (e.g. "Core", "Training", "Matchday"), each showing counters: Styles · Style-colourways · SKUs.
- **Style cards:** each card shows:
  - render;
  - name;
  - status (Draft · Sampling · Approved · Ordered);
  - colourway;
  - retail price;
  - quantity;
  - sizes;
  - production class.
- **Right panel:** totals for Range (styles, colourways, SKUs), Groups, Colourways and Colours.

**Line plan** (Fabra line plan table, toggled from the top centre)
- **Rows:** one per style, expandable into size rows.
- **Columns:**
  - Style · Group · Status · Colourways · Fabric · Qty · Split (Wholesale / D2C);
  - **Unit cost**: auto-filled from Knitwright's price tier for the quantity, including freight and duty to the destination;
  - Wholesale · RRP · Margin.
- **Footer totals:** total units · production cost · wholesale revenue · D2C revenue · blended profit · blended margin, with the toggle "Assumes full-price sell-through".
- **Actions:**
  - **Order samples for all approved styles**;
  - **Create drop** (F-L5) from the plan, with quantities as targets.

**Acceptance**
- Changing a quantity re-prices the line from the current tiers, live.
- Totals match the checkout of the same basket to the penny.

---

## Launch

Launch follows **Kittl's** workflow (Ref: `research/kittl-fabra/video-ui-notes.md` Videos 3–5, `docs-notes.md`): live-linked mockups, a canvas editor for marketing assets, AI image and video boards, Flows that chain them, and a Brand Studio applied everywhere. All templates are sportswear-only (`07-template-library.md`).

**The one big difference from Kittl:** in Kittl, AI boards re-draw the product, so it can drift. In Knitwright **the garment is always locked**. Every image starts from the deterministic 3D render or the golden-sample photo. AI only changes the scene, model, pose, light and camera, and a garment checker rejects drift.

**Launch shell (Kittl editor pattern, shared by F-L1–F-L4)**
- **Left icon rail** (labels toggle in Settings): Templates · Text · Elements (sport graphics) · AI Image · Mockups · Photos · Pattern fills · Likes · Uploads · **Brand** · AI assistant · Apps (Shopify, Etsy) · Layers.
- **Top right:** export icon, **Share**, copy link, version history.
- **Right inspector:**
  - with nothing selected: project name, **Project colours** (plus "Browse colour palettes"), and **Tools** (AI Image board · AI Video board · Mockup);
  - with a board selected: **Artboard size** (unit px/in/mm, presets such as "Instagram post 4:5" and "Story 9:16", W/H, Clip content), Layer opacity, Colour, Margin, Selection colours.
- **Bottom centre:**
  - prompt pill "✦ Describe what you want to create";
  - tool dock: Select · Frame · Shape · Pen · Text · Comment · AI;
  - undo/redo, zoom %, **credit balance**.
- **Main menu (≡):** New project · My projects · Duplicate · Settings (units Inches / Pixels / **Millimetres**, dark mode, menu labels) · Save · Version history.
- **Contextual task bar** over the selection:
  - image: Remove BG · Remix · Generate video · more · duplicate · download · ⋯;
  - board: AI Image board · AI Video board · Mockup · more (Flatten, Upscale, Reframe) · duplicate · download · ⋯.
- **Colour and font pickers** have a **Brand** tab (F-S9), so brand palettes and Headline/Body styles apply in one click.

### F-L1 Mockup studio (Kittl mockups + Fabra On-model / Flat-lay + shoot ideas)
**Entry:** "Shoot it" from the Product-created screen (F-S7), **Mockups** in the left rail, or Export › Mockups & media in the editor.

**Mockup library panel** (Kittl collections pattern)
- Search, with collections showing **Show all** and a crown on premium (credit) items.
- **Free (deterministic, from 3D):** Product renders (front/back/¾/side) · Flat lay · Hanger · Folded stack · Ghost mannequin · 360° turntable.
- **Teamwear:** Changing-room kit layout · Team line-up (5 / 11) · Captain holding shirt · Floodlit pitch · Tunnel walk-out.
- **Training & gym:** Gym mirror · Track warm-up · Turf stretch.
- **Running:** City run · Trail at dawn.
- **Combat:** Cage corner · Dojo mat.
- **Esports:** RGB desk · Stage.
- **E-commerce:** White background 1:1 and 4:5 · Studio colour backdrop · Size-chart card · Colour-chart card.
- Filters: sport, article, mood, people (none / 1 / team), aspect.

**Mockup board** (live-linked, Kittl pattern)
- Clicking a mockup creates a **Mockup board** linked to the design version by a connector.
- **Changing the design updates every linked mockup in real time.** That includes colourway, artwork, and names/numbers per roster entry.
- **Colourway / roster switcher** on the board: one scene can render Home, Away and GK, or player "SMITH 7".
- Placement inside a photo scene is fixed by the scene's garment slot, because the garment is the 3D render warped to the slot. Users cannot drag the print area.
- **Convert to image** (Flatten) bakes a board into a plain image for downstream use.

**On-model / lifestyle (AI) — Fabra "On model" and Kittl AI image board, with the garment locked**

**Shoot ideas library:** the predefined concepts in `07-template-library.md`. Each concept bundles scene, lighting, camera, 3–6 poses, model presets and an output set.

**Custom shoot panel** (Fash Studio / Kittl pattern)
- **Garment:** locked; the render or golden-sample photo, plus up to 2 more Knitwright products for an outfit.
- **Model:** licensed AI presets with diverse body types, ages and skin tones; or upload a model with a consent tick.
- **Background:** preset, upload or text.
- **Pose** and **Camera** presets: Hero front, Running stride, Arms crossed, Ball at feet, Over-shoulder back (shows name and number).
- **Style:** a picker like Kittl's "Browse styles": Editorial, Matchday flash, Gritty training, Clean e-com, Retro film.
- **Aspect:** Match / 1:1 / 4:5 / 9:16 / 16:9; **image count** 1–4.
- **Generate:** the button shows the credit cost before running.

**Results**
- Each result appears as an **AI Image board** with a placeholder ("Generating 00:23") and a **Regenerate** button on hover.
- **Image modal** (Kittl): edit with a prompt (scene only), Remove background, Edit area (scene only), Upscale, Add text, then Download or Open in editor.

**Rules**
- The garment checker compares the garment region to the render: crest, sponsor and number legibility, panel positions, colour ΔE. Failures auto-regenerate once, then show "Couldn't keep your garment accurate, try another pose".
- Failed generations refund credits.
- AI people are labelled "AI-generated model".
- The storefront shows a true-colour sample photo beside AI images.

**Acceptance**
- Deterministic mockups render in under 5 s, free.
- From a shoot idea: 4 AI images in under 3 minutes, with at least 3 of 4 passing the checker first time.

### F-L2 Marketing studio (Kittl editor + "Product campaign kit" workflow)
Two ways in.

**1. Templates in the editor.** Pick a marketing template (`07-template-library.md`: kit launch, club life, team store, brand drop, e-commerce, print). It opens as artboards with slots for mockups, logo, text and brand colours.
- **Replace** keeps size and colours (Kittl pattern).
- Text uses the brand's Headline / Subheadline / Body styles.
- Every text field has **Write for me**, which writes AI copy in the brand's voice and tone.

**2. Campaign workflow form** (Kittl "Product campaign kit", sportswear version). Numbered steps on the left, an output example on the right:
1. **Product:** pick a design version or mockup (or upload a photo).
2. **Apply your brand:** toggle plus brand dropdown (club or brand).
3. **Logo or crest** (optional).
4. **What do you want to highlight?** e.g. "Pre-orders close Friday", "Names & numbers included".
5. **Campaign:** New kit launch · Pre-order · Team store open · Last chance · Restock · Matchday · Sale / promotion · Limited drop · Sponsor thank-you.
6. **Style:** image tiles such as Matchday poster · Editorial · Minimal · Badge callout · Grid · Retro.
7. **Destination:** Story 9:16 · Social post 4:5 · Social square 1:1 · Hero banner 16:9 · Pin 2:3 · A4 print.

Footer: image count plus **Generate (credit cost on the button)**. Results open in the image modal (edit prompt, Remove background, Edit area, Upscale, Add text, Download / Open in editor). AI here may restyle the layout and background, but placed mockups stay pixel-locked.

**Export** (Kittl export panel)
- **Quick export:** PNG at 1x / 2x / 3x.
- **Full export:**
  - target (this board or "Selected artboards (n)" checklist);
  - W/H in px / in / mm;
  - DPI (72 for screen, 300 for print);
  - live print size;
  - format **PNG / JPEG / SVG / PDF** (MP4 for video boards);
  - colour **RGB (web)** or **CMYK (print)**;
  - Remove background;
  - Optimise quality.

  Multiple boards export as a **zip**.
- Free plan exports are watermarked; paid exports go up to 300 DPI.

**Acceptance**
- A club makes a "new kit" post in 3 formats in under 5 minutes from a template.
- Brand fonts and colours apply in one click.

### F-L3 Video studio (Kittl AI Video board)
**Free deterministic videos from 3D:**
- 360° turntable (6 s);
- front-to-back flip (4 s);
- kit reveal (fabric close-up → shirt → crest, 8 s);
- home/away/GK carousel (9 s).

They export as MP4 at 9:16, 1:1 and 16:9, 1080p.

**AI video board.** Created from any mockup or image board via the task bar or connector.
- **Panel:** **First frame ⇄ End frame**, prompt, and **Prompt presets**, sportswear-specific:
  - Walk-out from tunnel;
  - Slow orbit (turnaround);
  - Sprint past camera;
  - Ball juggle;
  - Fabric macro push-in;
  - Flag wave in wind;
  - Dolly backward;
  - Smooth tracking.
- **Model picker:** cards with description, estimated time and **credits per second**. Commercial-licence models only; the list is configured in admin.
- **Aspect:** 9:16 / 1:1 / 16:9. **Duration:** 3–15 s. **Audio:** on/off.
- **Generate** shows the cost first. A placeholder shows "Generating mm:ss".
- **Player bar on the board:** play, scrubber, mute, Flatten, download.

**Social frames.** Video templates (`07`) place a clip under text, logo and a QR or link chip. Export as **MP4 with the text burned in**.

**Rules**
- The first frame is always a garment-locked image, and the checker samples frames.
- AI clips are labelled "AI-generated".
- Failed runs refund credits.

### F-L4 Flows: launch packs on one canvas (Kittl Flows)
**What a flow is.** An infinite canvas of boards joined by connectors. Each connector runs from a board's right-edge dot.

**Board types**

| Board | Input | Output | Cost |
|---|---|---|---|
| **Design board** | A Knitwright design version, with colourway and size | Live garment render | Free |
| **Mockup board** | Design board | Live-linked mockup (F-L1) | Free if deterministic, credits if AI scene |
| **AI Image board** | 1+ boards ("image 1", "image 2" in the prompt) | Scene images with garment locked | Credits |
| **AI Video board** | Image or mockup board (first/end frame) | Clip | Credits per second |
| **Marketing board** | Artboard from a marketing template | Post, story or banner | Free (AI copy uses credits) |
| **Info card** | Data from the tech pack and catalogue | Size chart, colour chart, fabric and feature callouts, care card | Free |

**Wiring**
- The connector dot offers **Add… → Mockup · AI Image board · AI Video board · Marketing board · Info card**.
- **Fan-out:** one design feeds many boards. **Fan-in:** drag a second connector into a board.

**Running a flow**
- Every board saves its own prompt, model, aspect and style.
- To re-run, swap the Design board's version (e.g. the new Away kit) and press **Regenerate** on a board, or **Run all downstream**. Kittl requires re-running boards one by one; Knitwright adds this as an improvement.
- Board task bar: Flatten · Upscale · Reframe · duplicate · download.

**Flow templates** (`07-template-library.md`: Club kit launch pack, Brand drop pack, Team store promo, Shopify product listing, Colourway set, Sponsor pack) open with Kittl's template affordances:
- a **Thumbnail** board;
- a **Watch tutorial** card;
- yellow section labels (e.g. "1 PICK YOUR KIT", "2 MOCKUPS", "3 SOCIAL POSTS", "4 VIDEO");
- grey **instruction notes** next to each step ("Swap in your design", "Press Regenerate", "Export all as zip").

**Run summary.** A side panel lists every output, its status and cost. **Export all** produces a zip with folders per format, and **Publish to store** sends listing images to F-L5/F-L6.

```
┌ CLUB KIT LAUNCH PACK ───────────────────────────────────────────────────────────────────────────┐
│ [Thumbnail] [▶ Watch tutorial]                                                                    │
│ 1 PICK YOUR KIT        2 MOCKUPS                      3 SOCIAL POSTS            4 VIDEO            │
│ ┌──────────┐  ●──────▶ ┌ Mockup: flat lay ┐ ●──────▶ ┌ "New kit" 4:5 ┐                            │
│ │ Design:  │  ●──────▶ ┌ Mockup: line-up ┐ ●──────▶ ┌ Story 9:16    ┐  ●───▶ ┌ AI video: walk-out ┐ │
│ │ Home v7  │  ●──────▶ ┌ AI: floodlit pitch┐                                                      │
│ └──────────┘  ●──────▶ ┌ Info: size chart ┐   (note: "Swap in your design, then Regenerate all")  │
│ [Run all ▶ 120 credits]                                       [Export all (zip)] [Publish to store]│
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Acceptance**
- The Club kit launch pack produces 14 assets in under 10 minutes.
- Swapping the design and pressing **Run all** regenerates every output without re-entering prompts.

### F-L5 Storefront and drops (Ref: printify-pricing pop-up store pattern)
**Storefront:** `<brand>.knitwright.com` or a custom domain (Pro). Themed from the brand kit. Each product page shows media, a garment-measurement size chart, a fit note, the delivery date and personalisation where allowed. Stripe Checkout through the Knitwright UK entity as merchant of record.

**Modes:**
- **Drop:** pre-order window with open/close dates and an optional target. Buyers pay at order. At close the drop becomes one Class A or B batch. A drop can be created from a collection plan (F-S10).
- **Made-to-order (Class A only):** single sales accumulate and join the weekly batch. UK and Australia buyers only.
- **Stocked:** later.

**Seller economics:** the seller sets retail. Knitwright keeps the base price plus shipping and duty. The seller's margin is paid out weekly after delivery confirmation via Stripe Connect Express (sellers in Stripe Connect countries; Pakistan payout support is in Stripe preview).

**Returns:** made-to-order personalised items cannot be returned except for defects. Standard-size products follow UK/EU 14-day cancellation rights; the policy and a size-confirmation tick are shown before payment. Defects are remade or refunded within 30 days with photos.

**Acceptance**
- A designer opens a storefront with 3 products in under 30 minutes.
- A drop of 30 pre-orders ships within 4 weeks of close.

### F-L6 Connect your store & publish (Ref: founder screenshot 9, printify-integrations; Kittl Apps panel)
"Connect your store & publish" starts a wizard:
1. Choose a channel: Knitwright storefront, Shopify, Etsy (Phase 4), TikTok Shop (later).
2. Connect (OAuth for Shopify).
3. Pick the products, and the mockups and videos from Mockup studio or a Flow run.
4. Set retail prices, with margin shown per product.
5. Publish.

**Shopify app:**
- push products with media and variants;
- register Knitwright as the fulfilment service;
- pull orders;
- sync tracking.

**Acceptance:** an order in a connected Shopify store appears in ops within 5 minutes.

### F-L7 Seller dashboard and payouts
Shows sales, margin per product, drop progress, payouts, orders, defects and remakes, plus a margin calculator that shows profit per unit at a given retail price (base + freight + duty + fees).

---

## Ops and factory

### F-O1 Weekly batching
- **Cut-offs:** Class A every Monday 12:00 PKT. Class B as orders are confirmed.
- Groups paid orders by factory profile, class, fabric and article. Shows pieces, sizes and value per batch.
- Ops can move or hold an order.
- Promised dates are recomputed on every change.

### F-O2 Factory job packet (magic link, no account)
Per batch, the factory receives a link (signed, expiring, revocable) to a page with:
- job sheet PDF;
- order list;
- size breakdown;
- name/number list;
- BOM;
- ZIP of print files and patterns;
- due date.

The factory can press "Received / In production / Ready for QC", add notes and upload photos. The packet is also sent as a WhatsApp message with the link, because Sialkot factories run on WhatsApp.

**Acceptance:** zero manual file preparation by ops per order; every status change is timestamped.

### F-O3 QC gate
A checklist per order covers:
- measurements against POM tolerances on a sample of pieces (AQL 2.5 major / 4.0 minor at inspection level II for runs; 100% for Class A);
- colour against the swatch with a ΔE reading;
- artwork placement;
- names and numbers against the roster;
- defect count;
- photos.

A failure blocks shipping and creates a remake line. Third-party inspection can be booked for runs over 300 pieces.

### F-O4 Packing and shipping
Produces:
- pack list per player (from the roster);
- bag labels;
- carton weight and dimensions;
- commercial invoice with HS codes and origin (for DCTS preference into the UK);
- courier booking and tracking stored, with an email to the customer.

### F-O5 Exceptions
Remakes, partial shipments, lost parcels and size swaps. Each has an owner and a due date.

### F-O6 Factory scorecard
Per factory, weekly: on-time rate, defect rate, colour ΔE pass rate, remake count, and golden samples approved per article. A factory–article pair is "active" only with an approved golden sample.

---

## Guardrails

### F-G1 Moderation and IP
**On every upload, every AI generation and before every order:**
- logo and trademark detection (a vision model plus a blocklist of brand names and marks);
- text screening of names and slogans;
- an offensive content filter;
- a rights-holder registry (rights holders can register marks and report);
- notice-and-takedown with a repeat-infringer policy;
- human review before any Class B run and before the first order of any storefront product.

**Product titles** containing "dupe", "inspired by <brand>" or a third-party brand name are blocked. Inspiration images (F-S1) can never be placed on panels.

### F-G2 Pre-export rules check (Ref: specform-product "Mochi")
A deterministic checklist before export or order:
- no tech-pack field still "needs your input" and no `[TBC]`;
- POM complete;
- BOM complete;
- labels present per destination market (fibre content, care, origin, size);
- colour spec within gamut;
- DPI;
- bleed;
- moderation status `clear`.

### F-G3 Compliance defaults
- PFAS-free finishes only.
- OEKO-TEX Standard 100 fabrics where available.
- Fibre and care labels generated per destination (UK/EU/AU rules).
- US and kids' sizes blocked until CPSIA testing exists.

### F-G4 Financial controls
- Factory deposits never exceed collected cash minus a refund reserve (default 10% of open pre-order value).
- Revenue and GMV are reported separately.
- Export rebates are never assumed in unit economics.
- Every payout is reconciled against delivered orders.
