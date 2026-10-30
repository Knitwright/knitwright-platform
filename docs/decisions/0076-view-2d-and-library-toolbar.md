# 0076: The 2D pattern view and the Library toolbar

Status: Proposed
Date: 2026-10-30
Plan step: platform v5, wave 2, Y3 (`plans/platform-v5.md`, "Y3. 2D pattern view and Library toolbar (F-S4)")
Spec: `docs/spec/02-features.md` F-S4 — the 2D view, the Library toolbar, the pattern-fill popover and
the Edit Graphic panel.
Builds on: 0053 (Fabric.js for panels), 0035 (the artwork stack), 0066 (the base article catalogue),
0067 (the rulebook and `Why?`), 0068 (the graded drafter), 0071 (the factory model), 0075 (the editor
shell and the slot contract).

## Context

Y2 built the shell and published the slot contract: a panel is a default export taking
`EditorSlotProps` — the design as read-only facts and the commands it may call — and nothing else. A
slot never fetches, and `commands.setParameter` is refused outside the article's approved range, so a
panel cannot make an unmanufacturable design even by mistake.

Y3 fills two of those slots: the canvas's **2D view** and the rail's **Library** toolbar, with the
pattern-fill popover and the Edit Graphic panel under it.

## Decision

1. **The drawing is pure data; Fabric only paints it.** `lib/panel-layers/sheet.ts` turns the
   drafter's pattern pieces into a `PatternSheet`: the bleed, cut line, sew line and safe zone of
   each piece as closed lines in millimetres, the ruler marks, the grid spacing and the 100 mm scale
   bar. Every sum the screen needs is in `sheet-view.ts` (zoom, tick positions, the grid's step in
   pixels, a piece in words). `components/studio/editor/view-2d/PatternCanvas.tsx` holds no maths: it
   transforms the viewport so one Fabric unit is one millimetre and adds the shapes it was given.
   The drawing is therefore tested without a browser.

2. **Nothing on the 2D canvas can be selected or moved.** The 2D view is a drawing of the pattern the
   drafter made from the Form toolbar's values, which the article's approved ranges bound. Letting a
   person drag a pattern line here would be exactly the "drag pattern nodes freely" that F-S4 says
   Knitwright does not do. The prototype canvas of 0053 still edits *layers* on a panel; this one
   draws *pieces*.

3. **Fabric.js now has two canvases, and the isolation test holds both.**
   `components/panel-layers/fabric-isolation.test.ts` asserted that one file imported `fabric`. It
   now asserts two — the prototype's `PanelCanvas` and this view's `PatternCanvas` — that each is
   reached through its own `dynamic(..., { ssr: false })`, that **no module under `lib/` imports it**
   (the server evaluates those), and that the editor still does not reach the prototype's own
   components. `@/lib/panel-layers` is shared on purpose: it is pure and holds no Fabric.

4. **Bleed and safe zone come from the settings the checks use, and each carries its rule.** The 2D
   view draws the bleed from `guardrails.bleed_mm` and the safe zone from `guardrails.safe_zone_mm`,
   so the line a person sees is the line the checks measure against, and each is labelled with where
   its value came from (`sourceNote`). Their rule ids are **R-SUB-002** (10 mm bleed beyond the cut
   line on every panel) and **R-SUB-004** (critical elements keep 15 mm away from seams). The grid
   and the scale bar are drawing aids, so they take `R-GAP-000` and say in words that they are
   Knitwright's own and not a manufacturing measurement.

   **A discrepancy, recorded rather than smoothed over:** R-SUB-004 states **15 mm**, and the
   platform's `guardrails.safe_zone_mm` default is **10 mm**, labelled "Knitwright default". Neither
   number was invented here and neither is changed here: the view draws the setting the checks hold
   and names the rule that explains why there is a safe zone at all. See the owner questions.

5. **Every library list is data the platform really holds.** Fabrics are the base article's own
   allowed fabrics with the spec card X1 stores for each (role, weight, width, press shrink, source
   note) and the catalogue's own label. Pattern fills are the base article's approved `pattern_fill`
   options first, with their catalogue codes, then every style the pattern generators can draw, each
   with its repeat and colour count from the generator itself. Colours are the design's own colourway
   plus three seeded sportswear palettes.

6. **A seeded palette is a screen colour and says so.** `lib/panel-layers/palettes.ts` holds the
   three palettes F-S4 names ("Classic club colours", "Neon training", "Retro 90s") as labelled
   Knitwright drafts. Applying one fills the swatch and leaves the colour reference **empty**, as the
   design model has always required ("a colour picked for the screen is not a colour reference for a
   factory"). R-SUB-005 is the rule shown beside them: colours are checked against a printed
   strike-off, and club colours are picked from the printed swatch book.

7. **Pantone TCX is a licensed library, so it is a port with a stand-in.** No code looks a TCX code
   up. `ColourSearchPort` exists, and the only implementation says that Knitwright has no licence on
   file and invites the person to type the reference their brand uses. The same pattern covers the
   graphics library (nothing on file) and everything under **Your library** (brand kit, palettes,
   pattern fills, uploads), which a slot cannot read because it is not on `EditorDesign` and a slot
   never fetches. **Inspiration** is a labelled slot for wave 3's board (F-S1).

8. **Click applies to every panel; a drag applies to one; the keyboard has a picker.** A drag carries
   nothing but the item's id, in our own data type (`application/x-knitwright-library-item`); the 2D
   view looks the id up in the same library the toolbar built from the same design, so a drag can
   only carry something the design really offers. A drag is not keyboard-reachable (0064), so every
   item also has a panel picker and a button beside it.

9. **Every change is a design-diff patch through `commands.save`, never a picture.** A fabric becomes
   `add-fabric` (once) and `assign-fabric` per panel; a colour becomes `update-colourway`; an
   approved pattern-fill option goes through `commands.setOption`, so the shell checks it against the
   article; a kit style becomes `set-kit-pattern`; a graphic becomes `update-artwork` or
   `remove-artwork`. The shell validates, saves, shows the status and re-drafts.

10. **A control the stored design has no field for is not drawn.** Both editors are generated from
    what the design can hold: the popover from the style's own `ParamSpec` list narrowed to the
    fields `kitPatternSchema` keeps, the graphic panel from the artwork's tenths of a millimetre.
    What F-S4 asks for and nothing can store is listed in words with its reason and `R-GAP-000` —
    the pattern's height, padding and rotation; a graphic's own colours, a flip, and grading its
    placement by size. The plan's rule is a labelled default plus a question, never a dead parameter,
    and a control that silently does nothing is worse than one that is not there.

11. **The ratio lock carries the other millimetre settings.** With the lock on, changing one size
    scales every other millimetre setting that has a value by the same factor, each held inside its
    own declared range. With it off, only the one that moved changes.

12. **A method is offered only if a profile lists it.** The factory model (0071) records articles,
    fabrics, lead times, file formats and colour tolerance, but **not** which decoration methods a
    factory runs. So sublimation — the one method a base article states for itself, R-SUB-001 — is
    offered, and heat transfer, screen print and embroidery are shown **locked**, with the reason and
    a `Why?`, exactly as the Form toolbar locks an option no golden sample has approved. Nothing is
    guessed and nothing is hidden.

13. **Remove background is an interface with a stand-in that makes no call.** The only implementation
    refuses. The type it returns deliberately **cannot carry an image**: its only success is the id
    of a stored asset, so a provider's output can never become pixels on a panel (spec decision 13).
    A test reads the file and asserts there is no `dataUrl`, `base64`, buffer or URL in it, and that
    the stand-in is the only provider in the tree. Convert to pattern fill says that publishing a
    tile is the repeat maker's job (Y8).

14. **The canvas is not the accessible path.** Beside the drawing, each line is named in words with
    the distance it was drawn at and a `Why?`, and each piece is a row stating its measured box and
    the lines on it — which is also the drop target. The canvas itself is `aria-hidden`.

## What was left, and why

- **The one line that mounts the panels.** The shell draws `slotPlaceholder("library")` and
  `slotPlaceholder("view-2d")`; Y3 does not own the shell's files, so the panels are built to the
  contract and the mount is the orchestrator's. `e2e/editor-library-2d.spec.ts` is written against
  the real route and skips itself with that reason while the placeholder is still there, so it starts
  running the day the mount lands.
- **A fabric's weight.** `article.json` states a range ("140-160"), and `FabricSpec.weightGsm` is one
  integer. Applying a fabric stores the composition and leaves the weight unset; the range stays on
  the library card. Nothing is rounded into a number nobody gave.
- **Aligning a graphic anywhere but on its anchor.** Where an anchor sits on a pattern piece needs
  the piece mapper (0053), which is not built. "Centre on the anchor" is exact and is offered; the
  rest is said to be waiting, not guessed.
- **The styles a design cannot store.** Camo, gradients, checks, halftone and the rest are listed in
  the library with their repeat and colour count, and applying one says that only the eight kit
  styles can be stored today and that the repeat maker publishes a tile instead.

## Rules with no entry yet

`R-GAP-000` is used for: the grid spacing and the scale-bar length (drawing aids, not manufacturing
measurements); a fabric row of the library (the article's fabric list names no rule); every style the
pattern generators draw that is not one of the article's own approved options; and each control F-S4
asks for that no stored field holds (the pattern's height, padding and rotation; a graphic's colours,
flip and apply-to-sizes). None of these is a new manufacturing claim.

## Owner questions

1. **Is the safe zone 10 mm or 15 mm?** R-SUB-004 says critical elements keep 15 mm from seams; the
   platform's `guardrails.safe_zone_mm` is a 10 mm Knitwright default. Should the setting be reseeded
   to 15 mm against R-SUB-004, or does the 10 mm default come from somewhere this workstream cannot
   see? Until it is decided the view draws the setting and names the rule.
2. **Does Knitwright want a Pantone TCX licence?** Without one the Colours section cannot search
   codes, and a brand types its own reference. A licence would change this from a port with a
   stand-in to a real adapter. This one costs money, so it is the owner's.
3. **Which decoration methods does each factory run?** Heat transfer, screen print and embroidery
   stay locked until the factory model records them. Should `factory_capabilities` gain a methods
   column (a small migration in a later workstream), or is sublimation the only method for now?
4. **Should a pattern fill be able to hold a tile width and height, padding and rotation?** Today a
   kit pattern stores one size and, for dots, its spacing. Holding the rest means a new field on the
   stored design, which belongs to whoever owns `lib/garment/action-schema.ts`. Until then those
   three controls are listed as gaps.
5. **Should a graphic's placement be gradable per design?** The base article states `scale_by_size`
   per placement; a design cannot override it. Is per-design grading wanted, or does the article
   always decide?

## Files

- `apps/web/lib/panel-layers/sheet.ts`, `sheet-rules.ts`, `sheet-view.ts`, `view-2d.ts` — the 2D
  view's data and sums, pure and tested.
- `apps/web/lib/panel-layers/library.ts`, `library-ports.ts`, `palettes.ts`, `drag.ts`, `apply.ts` —
  the toolbar's lists, its unwired seams, and applying an item as a patch.
- `apps/web/lib/panel-layers/pattern-fill.ts`, `graphic-edit.ts`, `techniques.ts`, `background.ts` —
  the two editors and their seams.
- `apps/web/components/studio/editor/view-2d/**` — the slot panel, the Fabric canvas, the rulers,
  the legend and the piece list, with a contract test.
- `apps/web/components/studio/editor/library/**` — the toolbar, an item row, the pattern-fill
  popover and the Edit Graphic panel.
- `apps/web/components/panel-layers/fabric-isolation.test.ts` — widened to two canvases (Lesson 6).
- `apps/web/e2e/editor-library-2d.spec.ts` — both panels against F-S4, skipped until the slots are
  mounted.
