# 0049: glTF base models whose UV layout is the print panel layout

Status: Proposed. No artist model exists; nothing was run in a browser or on a graphics card.
Date: 2026-10-24
Plan step: W2-C (plan v4), spec principle 2

## Context

Decision 0014 builds the 3D form from the flat, with two pictures, and decision 0034 makes the pattern piece the master.
The spec asks the 3D view to read a real glTF per article whose UV islands are the print panels, textured from the same
panel renders the print files use (decision 0031). Artists have not made models yet.

## Decision

1. **The panel layout** (`lib/gltf/layout.ts`) is built from the same printed things as the print files (`instancesOf`):
   front, back, left and right sleeve, collar, each as its opened outline in millimetres. They are packed in one 2048 by
   2048 picture, at one scale, in rows with 8 px between. A panel's rectangle is stored in glTF texture coordinates (u right,
   v down from the top). The same pattern gives the same layout.
2. **The contract.** A node for each panel, named for its panel id; its mesh centred on the node origin; its texture
   coordinates spanning exactly the panel's rectangle; one material per panel group (`material-body`, `material-sleeve`,
   `material-collar`); `asset.extras.knitwright` states the texture size (2048) and units (glTF positions in metres, the layout
   in millimetres).
3. **`validateModel(gltf, layout)`** reports each panel's island error in pixels and whether it is within tolerance (half a
   pixel by default), whether texture coordinates leave the picture, the origin error, material sharing and the stated texture
   size. This is the check an artist's model must pass. It reads accessors itself, from data addresses or from buffers
   the caller passes, so it needs no three.js and runs in tests and on the server.
4. **The placeholder** (`generatePlaceholder`) extrudes each panel outline by ear clipping, 4 mm thick, with the layout's
   UVs, and carries `placeholder: true` and the label "placeholder, not an artist model". It has no date or random id.
   Its panels stand flat around the body; it is not a garment shape.
5. **Grading.** `gradeModel` scales each panel node in its own plane by the ratio of that panel's millimetre size at the target
   size to the base size. UV islands do not move. The picture for a size is that size's panel render drawn into the same
   rectangles, so artwork shows at its true size on XS and 3XL. Positions of panels in 3D are not scaled.
6. **Viewer.** `components/gltf/ModelViewer` loads the model with three's own `GLTFLoader`, paints the panel renders into
   the 2048 picture, offers front, back, left, right and top views with orbit and zoom, keeps the label "A preview of shape and
   colour, not of fit or drape.", and shows the existing form when there is no model. three.js stays in one file
   (`components/gltf/scene.ts`) loaded on demand; `lib/gltf` imports no three.js. The architecture tests were extended for both.

## Dependencies

No new dependency. `GLTFLoader` ships with three 0.186.1, already pinned (MIT).

## Evidence

- Unit tests: layout (no overlap, one scale, deterministic), `validateModel` with passing and failing fixtures (shifted,
  scaled, outside, missing panel, off-centre, wrong texture size, shared materials), grading for XS, 48 and 3XL, accessors,
  ear clipping, and a smoke test that loads the placeholder and builds a scene with no graphics card.
- Coverage of `lib/gltf` is above 90 % on lines, functions and branches.
- Not tested: drawing in a browser, `ModelViewer` in a page, or any artist model. The XS and 3XL test patterns are the
  benchmark size stretched by plain factors, not a real grade.

## Alternatives

- One picture per panel: more draw calls, and an artist cannot be checked against one layout.
- Write the model with three's GLTFExporter: pulls three.js into the library, and the file would depend on its version.

## Consequences

Easier: an artist model can be accepted or refused by a number. Harder: the layout is per block, so a new block means a new
model. Revisit when the first artist model arrives.

## Owner questions

See `apps/web/lib/gltf/OWNER-QUESTIONS.md`: the artist models, the swatch book, whether grading by panel scale is enough,
the tolerance, and when to switch the editor to `ModelViewer`.
