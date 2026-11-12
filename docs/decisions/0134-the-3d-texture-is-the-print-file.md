# 0134: The 3D view's atlas is painted from the print files' own art

Status: Accepted
Index: Accepted; the editor's 3D view and the export preview paint each UV island with the art of that panel's print file, made on the server
Index title: The 3D texture is the print file
Date: 2026-11-12
Plan step: v6 wave 0, D3. Spec principle 3 ("the texture is the print file"). Builds on decision 0049.

## Context

Decision 0049 laid the model's UV islands out to equal the print panels and gave `ModelViewer` a `panelPictures` prop
to paint them. Both callers (`components/studio/editor/View3D.tsx` and `components/studio/editor/export/Preview.tsx`)
passed `{}`, so every island showed its plain material colour and the 3D view never showed the design. The print path
(`lib/print`) cannot run in a browser: it reads the brand's artwork and draws with sharp.

## Decision

1. **The pictures are the print files' art.** `lib/gltf/panel-pictures.ts` plans and builds the panels' SVG print files
   exactly as the download does (`planPrintFiles`, then `createPrintFileBuilder().buildFile`), on the same pattern the
   layout was built from (the drafted size). Each picture is that file's scene with the art group only, windowed on the
   cut box and drawn at the pixel size of the panel's island, then written as a PNG. Guides, bleed and the margin note
   are left off: they belong to the paper, not the garment.
2. **The test** (`panel-pictures.test.ts`) drafts JSY-SS-01 in size M with the benchmark polka-dot stack and checks that
   the `<g id="art">` element of every atlas picture is byte-identical to that of the downloaded print file for the same
   piece, that each PNG has its island's pixel size, that the design's colours are in it, and that the bytes are
   deterministic. A blending (raster) scene is flattened at the atlas's resolution, not the print's; the scene is the same.
3. **Delivery.** `panelPicturesAction` (`lib/gltf/actions.ts`, member only, the `read` rate limit, no credits) reads one
   saved version, drafts the form the editor shows, loads the brand's print context (profile and artwork reader, no
   league rules, as the download does without one) and returns a PNG address per panel. `usePanelPictures` asks for it
   whenever the version, size, colourway or form changes; until the answer arrives the islands keep their material colour.
4. **Unchanged.** `SHOW_3D` is untouched. With no model the viewer still shows the form made from the flat. No artist
   model was invented; the placeholder model now shows the real atlas.

## Consequences

- One server read per change of the shown design while the 3D view or export preview is open. It builds one SVG print
  file per panel, which is cheap without blending layers.
- `CanvasFrame` passes `slot.design` to `View3D` (one line in a file D3 does not own).
- Not run in a browser in this change; the end-to-end suite covers the editor page.
