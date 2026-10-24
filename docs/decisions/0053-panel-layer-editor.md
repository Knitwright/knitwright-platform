# 0053: Per-panel layers in a Fabric.js editor: decision, data model and spike

Status: Proposed
Date: 2026-10-24
Plan step: platform v4, wave 2, W2-G (`plans/platform-v4.md`)

## Context

The spec's stage 3 asks for layers per panel and across panels (base colour, gradient, pattern fill, uploaded artwork, text, text on a path, crest, sponsor, name and number placeholders) in a Fabric.js v7 editor. Rewriting the editor on a guess is risky, so this step makes a decision, a data model and a contained spike, and changes nothing in the editor people use today.

## What the current model already covers

`lib/artwork-stack` (decision 0035) already has one layer kind for each thing on the spec's list except two:

| Spec wants | Today |
|---|---|
| Base colour | `ground` layer |
| Gradient | `pattern` layer with the existing gradient kit style (`lib/garment/kit-pattern.ts`) |
| Pattern fill | `pattern` layer behind the generator interface (0037) |
| Uploaded artwork | `graphic` (placed) and `image-fill` (tiled or panel) from the intake assets (0036) |
| Text | `text` layer |
| Crest, sponsor | `graphic` layers placed by zone or anchor |
| Name and number placeholders | `player-mark` layer, the sample is for drawings only |
| Text on a path | **not in the model** |
| Layers that cross panels | **partly**: a layer names several views, but the mapping from a view to its pieces is the `PieceMapper` interface, not built |

Order is blend order, opacity and five blends exist, colours are a list with colourways, and old designs derive a stack without a data rewrite (`deriveStack`, `currentStack`, `writeStack`). What the current **editor** (`components/studio`) lacks is not layers but direct manipulation: artwork is placed with number fields and lists, "with no dragging" (`ArtworkFields.tsx`), and the flat is a picture, not a surface a person works on. So the question is about the editing surface, not the data model.

## What Fabric.js v7 would add

Select, drag, resize, rotate, in-place text editing, z-order and per-object opacity and composite operation on a canvas, with a JSON form of the scene. Measured here:

- **Licence and version.** `fabric` 7.4.0 (published 2026-05-18, more than two weeks old), MIT, added at that exact version. `pnpm audit --prod --audit-level high` reports no known vulnerabilities. Its optional dependencies `jsdom` and `canvas` (a native module) also arrive in the lockfile (about 70 more packages); nothing here uses them, because Fabric runs only in the browser.
- **Bundle.** `pnpm --filter web build` (Turbopack): the Fabric chunk is **276 KB raw, 84 KB gzip**. It is reached only through `dynamic(() => import("./PanelCanvas"), { ssr: false })` from the prototype's editor, and only `components/panel-layers/PanelCanvas.tsx` imports `fabric` (a test enforces both). The design editor route's own client chunks are 490 KB raw, 148 KB gzip and do not reference the Fabric chunk. The prototype route also loads zod, as the design editor does (`client-weight` test, one entry added for `components/panel-layers/`).
- **Server rendering.** Fabric's `node` entry needs `jsdom` or `canvas`; its browser entry does not. With `ssr: false` the server never evaluates it and the production build succeeds. Importing `fabric` from any server component or from `lib/` would break this; the isolation test refuses it.
- **Behaviour checked in Chromium** (a scratch page, not committed): `loadFromJSON` keeps a custom `kw` property and `toObject(["kw"])` returns it; centred origin, angle, opacity and `globalCompositeOperation` come back as written; a real mouse drag moved a graphic by exactly the dragged distance in millimetres and the saved stack carried the new offset with every other field unchanged. A Textbox's own height differs from its font size (33.9 for 30), so text height is read from the font size.

## Decision (data model)

The **stack stays the truth** and Fabric is a view of one panel's layers (`lib/panel-layers`, pure, no import of the library):

1. `toFabric(stack, view, frame)` turns the layers of one view into Fabric JSON, bottom first. One Fabric unit is one millimetre. Each object carries `kw`: the whole layer as it was, and the geometry the mapping gave it.
2. `fromFabric(stack, view, doc, frame)` reads the canvas back. A value that still equals what was drawn keeps the layer's own value, so nothing is rounded or lost; an edited value is read (position, size, angle, text, opacity) and rounded to 0.01 mm. Layers on other views stay where they were, canvas order becomes blend order, and the result goes through the stack's own rules, so a canvas that makes the stack meaningless (a ground above other layers, a duplicate id, an empty text) is refused with the stack's sentence.
3. Fills (`ground`, `pattern`, `image-fill`) and `player-mark` are drawn as locked placeholders: flat colour, no pattern generator output and no picture on the canvas, and a mark at the centre because where it goes depends on the piece mapper. Only their opacity is read back.
4. Round-trip is tested with fast-check for every layer kind and for any panel centre, through `JSON.stringify`, and the edits are tested one by one.
5. Saving goes through the existing model: `designWithStack` re-reads the stack, calls `writeStack` (the dual write of 0035), validates the whole design, and `savePanelLayersAction` appends the next version through `append_spec_version`, with the brand from the session and a conflict if the design moved on.
6. Guardrails run live (`guardrailInput`, `layerChecks`) on the canvas as it is dragged: placed boxes (turned by their angle), asset pixel widths from the intake reader, ground and pattern reaching the bleed region, a contained panel picture stopping at the cut. The Checks list shows each finding with its fix. Names and numbers are not checked yet.

**Panel origin.** Offsets are measured from the centre of the panel's bounding box. This is the spike's choice, not a measurement: a layer's `placement` (zone or anchor) cannot be turned into a position until the piece mapper exists. The spike also uses the front piece of Knitwright's benchmark jersey (size 48, a fixture, not the club's pattern, said on the screen) because a design's own pieces are not joined to its views yet.

## Migration path

1. (This step) prototype behind `NEXT_PUBLIC_PANEL_LAYERS=on`, unlinked, existing editor untouched. The flag is read by name at request time on the server, so the server's environment decides, not the build.
2. Build the piece mapper (W3) and resolve `placement` to millimetres; give each design its real pieces. Until then the prototype's positions are relative to a panel centre.
3. Draw pattern generators and picture fills on the canvas from the same `render` functions the flat uses, so what is seen is what is printed.
4. Add the Fabric panel as one tool inside the existing editor, next to the numeric fields (which remain, for accuracy and keyboard use).
5. Only when the flats, tech pack and print files read the stack alone, retire the older fields (0035 already says this).

## Risks

- A second renderer: the canvas is not the print renderer, and blends and generators will differ until step 3 above. The stack, not the canvas, is what the print files read.
- Accessibility: a canvas is not keyboard or screen-reader friendly. The layer list (select, move, remove) is the keyboard path; numeric fields stay the accurate path.
- Text saved from the prototype lives only in the stack when it has no panel anchor (0035: "what the older fields cannot hold lives only in the stack"). The flats and tech pack that read the older fields do not show it yet.
- Fabric's optional native dependency (`canvas`) is installed by pnpm even though unused; a host that cannot build it must skip optional dependencies.
- Text on a path needs a schema change (`schemaVersion` 2 and a path field on the text layer), which older code refuses by design.
- Not verified: Firefox and Safari, touch input, very large scenes, undo and redo against `spec_versions`, the prototype end to end in CI with the flag on (see below).

## Recommendation (for the owner)

**Adopt for panels only, behind the flag, and keep the current renderer for output.** Fabric.js v7 earns its place as the editing surface of one panel at a time: it adds direct manipulation the editor does not have, the mapping to our stack is lossless and tested, the cost is 84 KB gzip fetched only when the tool opens, and nothing about how designs are stored or printed has to change. Do not adopt it as the renderer of record, and do not replace the numeric editor. Do not start a whole-garment, cross-panel Fabric editor before the piece mapper exists, because every cross-panel feature depends on it.

## What remains, with estimates (one engineer, working days, not measured)

| Item | Estimate | Needs |
|---|---|---|
| Piece mapper and real pieces per design, anchors to millimetres | 5 to 8 | W3 mapper |
| Draw generators and picture fills on the canvas | 3 to 5 | generators' `render` |
| Text on a path (schema v2, Fabric `path` text, print files) | 4 to 6 | owner decision below |
| Auto-vectorise raster logos (trace to the restricted vector model, colour reduction, a licence that is not GPL) | 8 to 12 | owner decision below |
| Seam-crossing overlays across panels (one laid-out scene, art split at seams, guardrail tie-in) | 10 to 15 | piece mapper |
| Name and number placement and checks | 2 to 3 | piece mapper, league rules |
| Undo and redo tied to versions, snapping to seam and safe zone, keyboard moves | 4 to 6 | |
| Tool inside the design editor, copy and wording pass | 3 to 4 | |

## Not done in this step

- The prototype is for the front view only, on a fixture panel.
- No reorder by dragging in the list (up and down buttons), no multi-select, no text style controls, no colour change.
- The end-to-end test for the flag-on page is written but runs only when the server is started with the flag on; the default CI server has it off, so CI exercises only the flag-off half. The flag-on behaviour was verified by hand in Chromium against a scratch harness, not against the real route and database.

## Owner questions

1. Is "adopt for panels only" the direction you want, or should this stop at the current editor?
2. Text on a path means a new stack version (2). Is that acceptable, and is a font list for it decided?
3. Raster logos to vectors: what quality bar, and is an open-source tracer with a permissive licence acceptable, or should it be a person's job?
4. Should the piece mapper (W3) come before any more of this?
5. Should the spike's text and graphics appear in the flat and tech pack before the editor adopts it?
