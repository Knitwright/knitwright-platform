# 0034: One coordinate system for the 3D preview and the pattern pieces

Status: Proposed
Date: 2026-10-14
Plan step: production outputs, W6 (`plans/production-outputs.md`)

## Context

A design accepted in the 3D preview must become per-piece print files (W3). Today the 3D form (decision 0014) is built from the flat's silhouette and each side has one UV set into the flat picture. It knows nothing about pattern pieces. The W0 contract that defines pieces and print zones has not landed yet, so field names here are provisional. Full reasoning: `docs/spikes/3d-pattern-coordinates.md`.

## Decision

1. The pattern piece is the master. Every placed mark is stored as `{ pieceId, sizeLabel, xMm, yMm, rotationDeg, widthMm }` in piece millimetres, never in 3D coordinates.
2. Each 3D vertex carries a surface sample `{ pieceId, xMm, yMm }`, so a click in 3D gives a piece point and W3 reads it directly.
3. Start with a one-week trial of the cheapest route: map today's body form to piece coordinates with a two-point landmark fit, behind an adapter that does not depend on the mesh. Body only; sleeves and collar are out of scope.
4. If the trial passes, build a form made from the pieces themselves (one mesh per piece, joined along paired seams). Do not start cloth simulation for print files.

## Evidence

Read-only research and a throwaway script (`docs/spikes/uv-to-piece-proof.mjs`): the UV to piece mm arithmetic round-trips under 1e-13 mm on the four benchmark pieces, and the benchmark pieces are rotated, so landmarks are needed. CLO3D, Browzwear and GarmentCode all treat the 2D piece as the master and derive 3D from it (sources in the spike). Not tested: whether the flat and the piece agree in shape well enough; that is the trial's question. Nothing was run in a browser.

## Alternatives

- Keep 3D and print separate: the club cannot be sure what they accepted is what prints.
- Draped simulation first (GarmentCode with Warp): 3 to 4 months, Python and GPU, shows fit we do not promise.
- Store marks in 3D coordinates: breaks on any size or mesh change.

## Consequences

Easier: one place for placement; W3 zones can be drawn on the 3D form; a size change moves marks by landmark. Harder: needs landmarks and edge or seam ids from W0/W1 (asked for in the spike); marks that cross seams must be flagged. Revisit if the trial's scale error between flat and piece exceeds 3 % on the body, or if the owner needs sleeve placement first. Open owner questions are listed in section 9 of the spike.
