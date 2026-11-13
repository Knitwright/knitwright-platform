# 0150: Garment Studio, its Export panel, the beta welcome and the Create a new design modal

Status: Accepted (plan v6 G1, 2026-11-13)
Index: Accepted; the focused garment (`/project/<id>?focus=`) is Garment Studio in the v3.6 layout: top bar, library column and panels over the Library toolbar's own data and Brand Studio's palettes and uploads, grey stage with colourway and size menus, 2D / 3D / Tech pack and Fit checked, Fabra design summary; Export panel with six tabs and the eight-section checklist, Export ♛ wired to the plans' upgrade modal; beta welcome per browser; Create a new design rebuilt to d20; every editor control kept
Index title: Garment Studio
Date: 2026-11-13
Plan step: v6 wave 4, workstream G1. No migration.

## Context

`08` v3.6 (Garment Studio, the Export panel, the welcome modal, Create a new design, the product configurator,
Upgrade to export tech packs) and v3.7 (colour and size pickers); `09` screens 27, 28 and 29; prototype states s01–s07
and s16–s19, d20 and p04. The orchestrator's route decision for wave 4: Garment Studio is **not** a new
`/studio/[designId]` page (that address 308s to the canvas since decision 0145); it is the focused-garment mode of the
one canvas, `/project/<id>?focus=<garment board>`, which E3's inspector opens. G2 builds the tech pack view's content
and the sheets in parallel.

## Decision

1. **Garment Studio is the editor shell laid out again, not a second editor.** `components/garment-studio/GarmentStudio.tsx`
   replaces `EditorShell` (deleted with the old `TopBar` and `BottomBar`, and E1's `FocusedGarment` wrapper) and uses
   the same hooks: `useEditor` (saving, undo, conflicts), `useWorkspace` (the open tool), `useShell` (toolbar, views,
   size and form in the address), `slotPropsFor` and every slot panel. The server side (`GarmentEditor`) is unchanged
   apart from reading Brand Studio's record (falling back to an empty library) and taking the canvas's address, name
   and credits. It draws `data-editor-chrome`, so the dashboard bar is hidden as for the canvas (decision 0146).
2. **Layout** (`10` §4): a 64 px top bar (KW logo = back to the canvas, keeping `canvas-focus-back`; name, auto-name
   and version; File; BETA; undo / redo and the save line in the centre; KW credits, Share, Export), then columns of
   236 px (library column), 380 px (the open library panel or toolbar), the grey stage, and 360 px (Design summary,
   from `xl`, as before). Below `lg` the columns stack with the stage first, as the editor did.
3. **The library column** (`lib/garment-studio/shelves.ts`): Library | Tech pack (the tech pack is the existing
   `/studio/<id>/tech-pack` page, a link, so G2's view keeps its address), **Edit this design** (the editor's Form ·
   Library · Specs tablist, now horizontal), the Knitwright library (Fabrics, Colours, Repeats, Graphics, Trims), the
   club's library under its name and initials (Fabrics, Palettes, Repeats, Brand kit, Uploads), Tools (Repeat prints ♛,
   Trim generator) and Ask Knitwright (the assistant). An entry opens a **shelf** in the 380 px column, held in the
   address as `?shelf=`; with none, the open toolbar shows. Opening a tool from anywhere closes the shelf.
4. **The panels list real data only.** Fabrics, Colours and Repeats are the Library toolbar's own sections (Y3,
   decision 0076: the base's approved fabrics, the seeded print-safe palettes, the base's pattern-fill options and the
   generators' styles), applied by the same `applyItem` steps, to every panel or one ("Put it on"). Fabra's fabric
   chips filter the fabric cards' own words. The club's palettes and uploads come from Brand Studio (decision 0042).
   What has no data says so: Recommended collections, the club's own fabrics and repeats, the factory's trim list,
   the Knitwright graphics library and the Trim generator are "coming"; Graphics and Trims list what is on the design
   and open the Logos, Fabric and Labels tools. Repeat prints is Y8's repeat maker.
5. **The stage**: colourway and size pills with menus above them (s17, s18; `menuitemradio`, keyboard, Esc), New
   colourway in the colourway menu; 2D / 3D / Tech pack (the tech pack view in place is whatever G2 draws in
   `CanvasFrame`), with shift-press or "Side by side" kept; top right **Fit checked**, the turntable (Simulate), the
   picture (Photoreal) and the avatar (fit on your own players: coming, disabled with its reason).
6. **Fit checked** (`lib/garment-studio/fit.ts`) is read, never invented: "Fit checked" only when the stored checks
   block nothing **and** the 3D model matches the form; otherwise the checks' own label ("2 to fix", "Not checked
   yet") or "Not sim ready". It opens the findings list with a Why? on each, as the Validate chip did.
7. **The Design summary** keeps its sections, rows and doors and takes Fabra's look: section icons, uppercase titles,
   a swatch per row (colour rows carry their screen colour).
8. **The Export panel** (s16; `lib/garment-studio/export.ts`): Tech pack · Images · Pattern · Artwork · On model ·
   Flat lay, each backed by one of the Export panel's tabs (decision 0078) so no new address exists; the review gate
   applies. "Export tech pack (8)" lists Overview, Colourways, Sample measurements, Size chart, Bill of materials,
   Construction callouts, Artworks and Compliance labels, ticked and not switchable (both files carry every section),
   with Notes as coming. The Pattern tab says Class A patterns stay with the factory and Class B gets DXF on request.
   The gold note says ordering needs no export. **Export ♛** makes the workbook when the plan includes tech pack
   exports (`PLAN_SETTINGS.currentPlan`'s `techPackExports`), else opens "Upgrade to export tech packs" (P6's
   `openPlans({ kind: "techpack" })`, decision 0144). "Every export file and its options" opens the full Export panel
   in the right-hand panel, so every option it had keeps its door.
9. **The beta welcome** (s01; `lib/garment-studio/welcome.ts`, `WelcomeModal.tsx`): shown after hydration when the
   browser has no mark; "Don't show this again" (ticked by default) remembers it in `localStorage`, unticked only for
   the visit in `sessionStorage`; storage that throws counts as seen. The browser tests' stand-in marks it seen
   (`e2e/support.ts`), and `showStudioWelcome` brings it back for the spec that tests it.
10. **Moved, not lost.** The old top bar's Photoreal and Quote links moved into the File menu ("Photoreal picture",
    "Request a quote"); its Tech pack link is the column's switch; its Journey strip is not drawn in the studio
    (each step is in the File menu or the column); Validate is Fit checked. The tool rail is a wrapping row of chips
    above the Form panel on a wide screen and the same bottom bar on a phone.
11. **Create a new design** (`components/studio/home/CreateNew.tsx`, `lib/home/cards.ts`): rebuilt to d20 in the
    design system's modal, drawn into the body: Knitwright library (Products → the catalogue, whose **Design this**
    is P-wave's product configurator with 🔒 not-yet-sampled chips and CREATE MY DESIGN → Garment Studio; Templates)
    and Start your own (Kit from your crest → crest to kit; Import your own pattern, tagged Class B, "coming" because a
    pattern request is made from inside a design today). The v2.2 "Your team" way, which had nothing behind it, left.
12. E3's garment inspector button reads **Open in Garment Studio**. `/dev/garment-studio` (same `DEV_UI_ROUTES`
    switch) draws the studio with the real JSY-SS-01 and a made-up club: `?shelf=…`, `&view=2d`, `&welcome=1`.
13. A `stage` colour token joins `globals.css` for the grey stage (`10` §2: dark backgrounds as content).

## Consequences

- The studio is a client component that needs the garment rules, as the editor did, so `components/garment-studio/`
  joins the editor in `client-weight.test.ts`'s second pass.
- `lib/garment-studio/**` is held to 90% coverage.
- Owner questions (defaults chosen):
  1. Which panel should the studio open on: Fabra's Fabrics shelf, or the Form toolbar the editor opened on
     (default: the Form toolbar, so every existing link and test lands where it did; `?shelf=fabrics` opens Fabrics)?
  2. Should the existing free tech pack and file downloads (the full Export panel, the tech pack page) be gated behind
     the plan as Export ♛ is (default: no; only the studio's Export button follows the plan, nothing that was free
     before is taken away)?
  3. Repeat prints carries ♛ (Starter's "Repeat print maker"), but the repeat maker was free (default: mark shown,
     tool not gated)?
  4. "Don't show this again" is ticked by default, so the welcome shows once per browser as the brief asks (default:
     ticked; Fabra's shot shows it unticked)?
  5. The tech pack mode's 720 px tech pack column (`10` §4) is G2's to draw inside the Tech pack view; the studio
     keeps its other columns in that view meanwhile.
