# 0038: Design from the user's image (W7d, phase A)

Status: Proposed
Date: 2026-10-14
Plan step: production outputs, W7d (`plans/production-outputs.md`)

## Context

A club hands over a mockup, a flat, a photo of a kit or a sketch and expects its design on the real pattern pieces. A picture cannot be turned into an exact copy: light, folds, angle and small lettering are lost or baked in. The owner's requirement is a close reading, shown beside the picture, with the limits stated, and nothing kept until the person accepts it. Phase A builds the pipeline up to the artwork stack; phase B adds the all-over pattern stage, which needs W7b's `findRepeat` and W7c's generator registry.

## Decision

1. **A staged pipeline in `lib/design-import/`**, every stage returning a confidence and a plain note, every value `read-from-image`: reading (`read.ts`), outline (`outline.ts`), landmarks (`landmarks.ts`), fit (`fit.ts`), marks (`marks.ts`), colours (`colours.ts`), the pattern stage behind an interface (`pattern.ts`), then the W7a stack and a report (`assemble.ts`, `report.ts`). W7a's types, `PieceMapper` and asset reader are imported and not changed.
2. **Text in the picture is data.** The vision call goes through the existing text-model provider with the rule of `lib/intent/image-input.ts`. The reply is parsed by a strict schema (unknown fields drop the whole reply, text is stripped of control characters and cut to 80 characters), so a picture cannot make the reader do anything but report what it shows. Words that look like instructions (`looksLikeOverride`) are still read as printed text and noted to the person. A reply that obeyed the picture is not valid JSON of the shape and is refused.
3. **Classical geometry first.** Outline by corner colour distance, largest connected region, holes filled, traced and simplified. Landmarks from the mask: the neck dip, the neck's top edge, where the sleeve steepens, where a sleeve's underside meets the side (read along the fitted side line, so a photo's lean does not fool it) and the hem. The model's guesses fill only landmarks the picture did not give, at low certainty and listed as guessed. A landmark the person drags wins. The image model (fal's edit model, already in `lib/providers/fal.ts`) is used only when no outline is found, within a budget of 2 edits, on a picture padded to a square; its pixels are flagged generated.
4. **Fit through `PieceMapper`.** A flat or mockup is fitted by a least-squares affine map from picture to design millimetres; a worn photo by a homography from its landmarks first (affine with a note when fewer than four are found). The share of the outline that lands on a piece for the size is read through the mapper and reported. Until W1's pattern library and W3's mapper are on `main`, the template is the benchmark tee (W0 fixture, measured from the DXF) stood upright from its own landmarks, behind a `LandmarkTemplate` interface; the report says so. Only front and back bodies are fitted (decision 0034: body only); a sleeve or collar view is left empty and named.
5. **Honest about what is missing.** A view not in the picture is left empty and named, never invented. Marks the reading could not read are not added. A crest, sponsor or badge is a `graphic` layer flagged "redrawn from a picture, replace with your own file"; phase A does not store its crop (that is W7b's asset store), so the layer names an asset id that does not exist yet and the accept answer lists those layers.
6. **Nothing is saved until accept.** `design_imports` (migration `20261015060200`) holds the proposal, the stored reading (so redoing a fit costs no vision call), the report, the overlay, the brand, the rights statement time and the cost. `accepted_stack` is null until the person accepts all or some layers; a check constraint ties the status to it, and a trigger refuses any change to an accepted or discarded row. Server writes only; members read their brand's rows. Applying the accepted stack to a project's design is phase B, because it needs W7b's assets for the crops.
7. **Switch, budget and cost.** `DESIGN_IMPORT=on` turns the feature on; off or unset, every route answers 404 and no screen is shown (owner question P12). At most 3 vision calls and 2 image edits per import; a per-person daily cap (`LIMITS.designImport`, 10 a day) and a per-brand daily cap in the service (10 in 24 hours), both proposed low (P16). Vision cost is the chosen model's token price (`MODEL_CATALOG`, `IMAGE_INPUT_TOKENS`); the image edit price is a catalog entry (`IMAGE_EDIT_CATALOG`) read from fal's published price recorded in `docs/data-processing.md` (fal.ai was not reachable from the build container, so it is to be re-read). The first vision call uses the route's reservation; each later call and each edit reserves its own and gives it back on failure.
8. **The reading asks for a JSON object in plain text,** so a model the provider layer forces onto the assistant's reply tool cannot be used (`pickVisionModel` takes the first configured model with free tool choice, today Claude Sonnet 5.5). Letting the request name its own tool is a small additive change to `lib/providers/text-model.ts` and is left to a `contract` PR if the owner wants a cheaper model.
9. **Words.** The screen says "close reading of your picture". The words "exact", "matches your picture" and "identical" are never used (a test scans the report, the limits and the screen). The six accuracy limits are always on screen beside the picture and the drawing.

## Evidence

Tests use synthetic pictures drawn from a known tee, with perspective for the photo case, and recorded replies; CI never makes a live call. Landmarks are within 6 px of the truth on a 400 px flat and within 8 px on a perspective, shaded photo-like input. No quality claim is made for real pictures: the golden set the owner owes (P13) is needed first.

## Alternatives

- Ask the model for landmarks and outlines: slower, dearer, and it would be the model's word for geometry we can measure.
- Always flatten with the image model: invents pixels, costs money on every picture.
- Save the proposal as the design and let the person edit it: the owner requires acceptance first.

## Consequences

Phase B needs W7b (`findRepeat`, intake and stored crops) and W7c (generator matching) for the pattern stage, W1 and W3 for the real template and mapper, a line in `lib/workspace/tools.ts` (W0's file) to mount `DesignImportPanel`, the `design-import` line in `vitest.config.mts` coverage thresholds, and the owner's golden set. Both providers receive the user's picture; `docs/data-processing.md` and the privacy page need the paragraph sent on the PR (owner question P12).
