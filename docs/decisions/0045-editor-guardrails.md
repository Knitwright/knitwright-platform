# 0045: Editor guardrails as pure functions

Status: Proposed
Date: 2026-10-24
Plan step: platform v4, V7 (`plans/platform-v4.md`)

## Context

The spec's stage 3 asks for warnings while a person designs: art that a seam will cut, pictures too coarse for their print size, bleed, clear space round names and numbers, and colours sublimation may not hold. They must be fast enough to run live in the editor and must not make claims Knitwright cannot back.

## Decision

1. `lib/guardrails` holds five pure checks over a plain input: panels (the contract's cut outline, sewn edge and mirror lines, in millimetres), placed items (a box on a panel, with the pixel width of a raster) and the colours used. Each returns findings `{code, check, severity, panel, itemId, locationMm, message, fix}`. `runGuardrails` runs all five, blockers first, with no clock or randomness.
2. `seamCross` compares an item's box with the sewn edge (the cut outline, and says so, when the pattern has no sewn edge) and with mirror lines. A fill is meant to cross seams and is not reported. It judges the box, not drawn pixels.
3. `minDpi` uses `effectiveDpi` from artwork intake. Under the minimum is a warning, under half of it a blocker. Vectors, text, and rasters with no known pixel size are skipped.
4. `bleed` computes the bleed region (cut outline offset outward, mitred, capped) and reports how far each fill stops short of it. The offset is an approximation for convex or gently curved panels.
5. `safeZone` requires names and numbers to be inside the sewn edge with clear space; outside is a blocker, too close a warning.
6. `gamut` is an approximation and says so in every message. It flags colours above two chroma limits (80 anywhere, 65 for green to blue hues). Both limits are Knitwright's own guesses, not measured from any printer or ink. It is only ever a warning. Real answers need the print house's ICC profile, which we do not have.
7. Settings (minimum dpi 150, bleed 10 mm, clear space 10 mm) are Knitwright defaults, labelled "Knitwright default, not from your print house" in every message that uses one, until a print house sets them.
8. `GUARDRAIL_MODULES` has the planned `CheckModule` shape. It is exported, not registered: V1 had not merged.

## Not done

- Nothing yet turns a design's artwork stack into `PlacedItem`s (it needs the piece mapper and zones per size). The checks take placed boxes.
- No "Checks" list under the canvas: the plan gives this workstream no component path, so no UI file was touched.
- Axis-aligned boxes only; a rotated item is judged by its box.
- Tests ran on made-up rectangular and elliptical panels, not on a real pattern block.

## Owner questions

1. The print house's ICC profile (replaces the gamut estimate).
2. Minimum dpi (150 is a default).
3. Clear space for names and numbers (10 mm is a default), and each league's rules.
4. Bleed (10 mm is a default).
5. Should a seam-crossing warning be a blocker for some artwork (a crest, a sponsor)?
