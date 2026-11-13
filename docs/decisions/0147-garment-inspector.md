# 0147: The garment inspector, the element, group and mockup inspectors, mockup edit mode and Product info

Status: Accepted (plan v6 E3, 2026-11-13)
Index: Accepted; selecting a garment board shows its Product, Options, Colourways, Kit colours, Names & numbers, Size preview, Layers, Checks (stored lib/validation result, Why?) and Price on the canvas, every change through the editor's own action; element, group and mockup inspectors; mockup edit mode shows the scene's fixed print area; Product info modal; the full editor stays one press away
Index title: The garment inspector
Date: 2026-11-13
Plan step: v6 wave 3, workstream E3. No migration.

## Context

`08` §5.3 (right inspector by selection), §6 ("there is no separate editor; the Kittl canvas is the editor"), the
v3.5 "Editor" block (Product info) and the v3.6 "Mockup edit mode" block; screens 12–13; prototype states e15–e26 and
e41. E1 (decision 0145) left a garment opening the whole studio editor in focused mode (`?focus=`) and asked E3 for
the garment inspector on the canvas. E2 builds the right-panel shell in parallel, so this record's inspector is a
component of its own that E2 hosts.

## Decision

1. **One component, chosen by the selection.** `components/canvas/inspector/SelectionInspector.tsx` reads the canvas
   store and draws, by `lib/inspector/selection.ts` (pure, tested): one garment or launch-era design board → the
   garment inspector (or one of its layers); one mockup board → the mockup inspector (edit mode after a
   double-click); two or more boards → the group inspector; anything else → the `fallback` it is given. It is
   hosted inside E2's right panel (decision 0146): the launch shell passes E2's project panel (nothing selected)
   and the launch board inspector (any other board) as that fallback, so the canvas is never narrowed. The
   launch inspector's own nothing-selected branch, unreachable since E2, is removed.
2. **The store** gains `element: {boardId, id} | null` and `editing: string | null` with `selectElement` and
   `setEditing`. Both only hold while their board is the one selected (`staleFocus`): a click elsewhere finishes them.
3. **The garment inspector reads, then writes through the editor.** It reads its view when the board is selected
   with `readGarmentInspectorAction` (member, `LIMITS.read`; `lib/inspector/server.ts`): the design at its current
   version through the member's client, the base article, the stored validation result of that version (`results[0]`,
   exactly what the editor's Validate chip reads), and the factory's price book. Every change goes to the existing
   `applyDesignActionAction`, so it is parsed by `browserActionSchema`, stamped `user-edited`, applied by the garment
   library, refused if the article does not offer it, stored as a version, validated on save by `lib/validation`,
   and the canvas is revalidated. There is no new write path and no migration.
   - **Product**: base name, code, class, first fabric; "Change base" to the catalogue.
   - **Options**: the article's option tiles and range sliders exactly as the editor's Form toolbar builds them
     (`optionGroups`, `parameterSliders`), with the lock mark, "Not yet sampled" and Why? on every option or range no
     golden sample signed off. A slider stores the parameter on the design with `set-article` (the action decision
     0121 gave a caller), so validation's parameter checks judge it. **Option codes stay in the address** as the editor
     keeps them (`opt=group:CODE`): no design field holds an option code yet, and writing one into `article.parameters`
     would be refused by `parameters-in-range` as an unknown parameter. They are carried into the editor link.
   - **Colourways** (choose, + New = the editor's `addColourwayAction`), **Kit colours** (a swatch change sends the
     shown colourway whole as `update-colourway`, keeping each part's colour code), **Names & numbers** (on with the
     garment's usual places, off, lettering style; the editor's `buildNamesNumbersAction`), **Size preview** (the
     editor opens at that size), **Layers** (each opens the element inspector).
   - **Checks**: the stored checks, read as the editor's `findingLines` reads them (blockers ✕, warnings ⚠, unsampled
     options ⚠, each with Why?), then the passing checks ✓, with "passed / total". A version with no stored result
     says "Not checked yet" rather than showing a tick. Nothing is re-checked or softened; the D1 order gate is untouched.
   - **Price**: `priceFor` through `lib/make/prices.ts` at 1 / 50 / 100 / 300 pieces with each tier's own label, GBP
     (`08` shows £). A quantity with no tier says "not set", never £0. **Order sample** opens the make pages (the D1
     order path) until E4's Order drawer.
   - **Tools**: Mockup, Tech pack, AI image, AI video boards, added after the garment through `LaunchCommands.addBoard`.
   - **Open full editor**: focused mode (decision 0145) on the same canvas, with the options, parameters, colourway and
     size shown. The editor, every studio panel and every existing link to `?focus=` are unchanged.
4. **Element inspectors** (`ElementInspector.tsx`, `lib/inspector/elements.ts`): a layer of the design's artwork stack
   (decision 0035, `currentStack`): text → Text, picture → Image, pattern or image fill → Illustration, names and
   numbers → player mark. They show style, colours, size, **placement in mm from the panel anchor**, **print type**
   (Sublimation unless the layer names another) and layer opacity and blend, and open Panel layers or the full editor
   to change them, where the print rules for placement live.
5. **Group inspector**: Kittl's six alignment buttons over the selection's bounds (`lib/inspector/align.ts`), each move
   through `moveBoard` as a drag; the selection's W × H.
6. **Mockup inspector and edit mode**: scene thumb, name and collection; the kit the shirt wears (`setBoardSettings`,
   as L2's panel); roster player; Edit mockup; AI video board. Double-click (or Edit mockup) opens edit mode: the
   scene's garment slots drawn as blue boxes with corner marks over the board, and the panel shows the mockup, the
   print area and the backdrop; Esc, Done or a click elsewhere finishes. **The box is not draggable**: F-L1 says the
   print area is fixed by the scene's slot, and behaviour comes from `02` (decision 0131) where the prototype says
   "drag or resize".
7. **Product info** (`ProductInfoModal.tsx`, `lib/inspector/product-info.ts`): production cost (the one-piece tier and
   its label), time to make (the capability's lead time; freight is said to be added at checkout because no shipping
   price is on file), print area (the garment's panels), file (the artwork intake's minimum dpi), three print
   guidelines, **Download template** (the design's free front SVG drawing, `/api/projects/<id>/exports/svg?view=front`)
   and **Preview on mockups** (adds a Mockup board fed by the garment).
8. **Fixture**: `/dev/inspector?show=garment|info|text|image|group|mockup|edit` (same `DEV_UI_ROUTES` switch) with
   the real JSY-SS-01 article and placeholder ladder and a made-up design.

## Consequences

- The client never loads zod: the view is plain data (`lib/inspector/types.ts`), the changes are built from it
  without the garment rules (`lib/inspector/edits.ts`) and checked again on the server.
- For a garment or mockup board (outside edit mode) the launch board inspector is still drawn under E3's sections,
  so L2's scene, crop, roster and render controls and the garment board's run summary keep their doors.
- Owner questions (defaults chosen): should a new design land on its canvas with the garment selected instead of in the
  full editor (default: unchanged, every `?focus=garment` landing and test kept)? Should option codes get a design
  field so they survive without the address (default: address, as the editor)? Mockup colour, "Match artboard colour"
  and layer opacity in edit mode have no stored setting (default: shown as the scene's backdrop, not editable).
  "Apply to sizes (Grade / Fixed / Anchor)" has no field on a layer (default: not shown).
