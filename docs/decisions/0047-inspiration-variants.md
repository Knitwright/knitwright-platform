# 0047: Inspiration variants

Status: Proposed
Date: 2026-10-24
Plan step: platform v4, W2-A (`plans/platform-v4.md`)

## Context

Spec stage 3 asks for a side panel of alternatives for the current design. Each is a deterministic set of parameters drawn by our own flat renderer. One press applies one as a new version. Mood images are out of scope.

## Decision

1. `generateVariants(spec, { count, seed, gate })` in `lib/variants` is pure. The count is brought into 8 to 12. The same design and seed always give the same list, with the same ids (a short hash of the changes).
2. Three kinds, each a list of ordinary `SpecAction`s that the existing `applyAction` checks:
   - **Colourways.** The club's colours swapped about, a third colour brought forward, and palettes made by turning every colour's hue round the wheel in CIE Lab at the same lightness and chroma (reduced only when the colour would leave sRGB), plus a light or dark partner for the main colour. The swap is always offered first. No model is called.
   - **Kit styles.** Every other style the garment offers (`lib/kit-styles`), in the club's present colours.
   - **Placement.** Artwork moved between the named zones of its panel (the anchors the flat drawing already knows) and two items swapped. A zone another item holds is never chosen. Size, file and turn never change; artwork on a sleeve has one zone, so it does not move.
3. **Structure.** `structureKept` compares everything a variant may not change (garment, options, measurements, sizes, fabrics, construction, labelling, names and numbers) and the artwork items apart from where they sit. A candidate that fails is dropped. A garment with no kit styles gets no variants.
4. **Guardrails and the gate before display.** Each candidate runs through `runGuardrails` (`lib/guardrails`, 0045) and the validation gate (0039: the tech pack's readiness for the candidate, against the factory profile). A candidate that brings a blocker the design does not already have is dropped and the next is tried. Blockers the design already carries are ignored, or no variant would ever show for a design that is not yet ready. Warnings stay on the variant and the panel lists them.
5. **Apply.** The browser sends a variant id and the version it looked at; the server works the list out again for that version and applies the variant's actions through `saveTrustedActions` as ONE version (so one undo takes it back). The browser never sends changes. `decideApply`: the current version saves; one version behind where the design is now exactly this variant answers "already applied" with no second version; anything else is a conflict.
6. **UI.** A rail tool "Ideas" (`components/variants`) with tiles grouped by kind, each drawn by `buildFlat` and `renderSvg` as in the kit-style gallery. A future mood-image section would sit apart from it.
7. **No migration, no new dependency.**

## Not done, and not verified

- The seam, dpi, bleed and safe-zone guardrails run on **no items**: nothing yet turns a design's artwork into placed boxes on pattern panels (0045, "Not done"). Only the colour estimate has input. Placement moves are therefore limited to the named anchors, not judged against a seam.
- The version note says "Picked from the kit styles" because `ProposalSource` (not owned by this workstream) has no value for variants.
- Hue turns are Lab-based but unchecked against any print house; the colour estimate is Knitwright's own guess (0045).
- The gate runs the readiness build once for each candidate; no timing was measured.
- The end-to-end test and the version save through the database were not run in the cloud sandbox (no Docker). CI is their first run.
- The tool entry touched `lib/workspace/tools.ts`, `ToolIcon.tsx`, `PanelSections.tsx` and `tools.test.ts` (a rail tool needs all four).

## Owner questions

1. Should a design that already has blockers still show variants (today yes, only new blockers drop one)?
2. Which palettes does a club trust? Hue turns are mechanical, not designed.
3. Should the number shown be fixed at 10 (today) or be chosen by the person?
