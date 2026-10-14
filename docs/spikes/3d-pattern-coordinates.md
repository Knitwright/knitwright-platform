# Spike W6: one coordinate system for the 3D preview and the pattern pieces

Date: 2026-10-14. Status: design note, nothing built. Decision record: `docs/decisions/0034-3d-pattern-coordinates.md` (Proposed).
Plan: `plans/production-outputs.md`, section W6 (gap 5).

## 1. The question

A club accepts a design while looking at the 3D preview. The sublimation house needs one print file per pattern piece (W3). Today nothing connects the two. This note says how to connect them, what it costs, and what to try first.

## 2. What exists today

- `lib/garment3d/mesh.ts` builds the form from two silhouettes (front and back). Each side has **one UV set into that side's flat picture** (`uvOf`, normalised to the flat's drawing box). The form is closed by joining front and back along the outline. Units are metres in 3D and tenths of a millimetre in the flat (`METRES_PER_UNIT = 1e-4`).
- So a point on the 3D form already maps to a point on the flat. It does **not** map to a pattern piece: the flat is a drawing, not a cut piece. Sleeves, collar and the side seam are not separate surfaces. The form is a cushion from the side (decision 0014 says so).
- Placements (`lib/techpack/artwork.ts`) are an anchor plus offsets on a flat panel, not a position on a piece.
- three.js stays in one file by `tests/architecture/garment3d.test.ts`. Any option below must keep that.
- The benchmark DXFs (`docs/owner/reference/fashioninsta-2026-10-14/`) have four pieces each. Layer 1 holds the cut outline. The pieces sit rotated: in `pattern_1598.dxf` the front measures 719.6 x 259.7 mm, so length runs along x. Any mapping must read the piece's own axes from its landmarks, not assume y is up. There are no notches (no layer 4), so seam pairing cannot come from the benchmark file.
- The W0 contract (`lib/production/contract/`) has **not landed** on `main` (no `lib/production` directory yet). Field names below are from the plan text and may change.

## 3. How other tools do it (research)

Sources were read through web search summaries on 2026-10-14; where a source did not cover a point, this note says so.

- **CLO3D.** Pieces are drawn in a 2D window and sewn in 3D by pairing edges. A research paper notes that 3D design modules require the user to specify by hand which edge is sewn to which ([US 10617165B2](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10617165)). CLO's import guidance, as summarised in search, says to import DXF-ASTM (AAMA as fallback) with no seam allowance, as baselines, and with notches in the right places, because notches help auto sewing ([CLO support](https://support.clo3d.com/hc/en-us/categories/115000064648-Manual)). CLO's own simulation patents describe patterns placed around an avatar and assembled by seam definitions ([US 11410355B2](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11410355)). I found nothing that states how CLO stores texture coordinates. The common reading, which I could not trace to a CLO source, is that each piece's own 2D shape is its UV space.
- **Browzwear VStitcher.** Same shape: 2D pieces become a 3D garment, with prints carried through ([listing](https://platform.softwareone.com/product/vstitcher/PCP-6522-7115), [release note](https://fibre2fashion.com/news/textiles-technology-news/browzwear-releases-new-features-in-vstitcher-lotta-267708-newsdetails.htm?amp=true)). I could not find its print placement steps.
- **GarmentCode / PyGarment (ETH Zurich, MIT licence per the repository page).** Open-source parametric patterns as panels, edges and interfaces; drape by building one mesh from the panels and joining the vertices of stitched edge pairs, simulated with NVIDIA Warp ([paper](https://arxiv.org/abs/2306.03642), [dataset paper](https://arxiv.org/pdf/2405.17609), [repository](https://github.com/maria-korosteleva/GarmentCode)). It is Python and GPU, so it suits an offline job, not our Next.js server. Warp's and Qualoth's licences were not looked up.
- **Sublimation print software** (the RIPs and nesting tools print houses use): I found no source describing their 3D mapping. The usual practice, which the benchmark PDFs also follow, is that the print file is per piece at 1:1; any 3D view is a preview of that.

The shared pattern in all of these: **the pattern piece is the master; the 3D surface is derived from pieces and every 3D vertex remembers its piece and its position on the piece.** Our current form is the other way round (3D from a silhouette), which is why it cannot map back.

## 4. Options compared

| | A. Map zones, keep the cushion | B. Piece-built form (a UV per piece) | C. Draped from pieces (simulation) |
|---|---|---|---|
| Idea | Keep today's mesh. Map the flat's UV to piece mm with a per-piece affine map from landmarks. | Build each piece as its own mesh from its outline (triangulate the piece, inflate), join pieces along paired edges. Each vertex carries `(pieceId, x mm, y mm)`. | Pair seams, put pieces around a body, run cloth simulation (GarmentCode with Warp, or a port), bake `(pieceId, x, y)` per vertex. |
| Mapping accuracy | Good only where front flat and front piece agree. Sleeve and collar not covered. | Exact by construction for flat-lying pieces; stretch is whatever the inflation adds, and can be measured. | Exact UVs; fabric stretch can be measured per triangle. |
| Needs | W1 landmarks (HPS, CF neck, underarm, CF hem) on front and back pieces | A + seam pairing (notches or explicit pairs) + one inflation rule per piece | B + body model, solver, GPU or heavy CPU job, seam allowance handling |
| Fits the codebase | Yes, small. three.js file untouched | Mostly: `triangulate.ts` already makes a triangle region from a loop | No: Python and GPU; separate service and a licence review |
| Effort | 3 to 5 days | 3 to 4 weeks | 3 to 4 months |
| Shows | Zones and marks on today's 3D, converts to piece coordinates | Sleeves, collar and side seams as real parts; marks move across seams visibly | Hang and fit (blueprint layer F) |
| Main risk | The cushion misleads about seams: a mark near the side seam looks continuous but is cut in two | Seam pairing from W1 data that may lack notches; inflation distorts distances | Cost, licence, and a draped look that suggests fit we cannot promise |

## 5. Recommendation

1. **Now, as a one-week trial: option A**, written as a mapping layer that is **independent of the mesh**, so B can replace the mesh later without changing it.
2. **If the trial holds, option B** as the target. It is the smallest build that gives the guarantee the club needs: what they place in 3D is what the print house prints.
3. **Option C only when fit becomes a product promise** (blueprint layer F). Do not start it for print files.

### The mapping layer (shared by A and B)

For each 3D vertex store a **surface sample**: `{ pieceId, sizeLabel, xMm, yMm }` (millimetres floats, piece coordinates). Rules:

- Piece coordinates are the contract's: millimetres, float, rounded to 0.01 mm on write. 3D positions are metres (as today); the flat stays in tenths of mm. Conversions happen only at the edges of the layer.
- Option A computes `(xMm, yMm)` from the flat UV with a **two-point landmark fit** per piece, using two landmarks both drawings can name (for the front body: HPS and CF hem; the fit is a rotation, uniform scale and translation, with the scale reported). The proof in this folder shows the easy half (piece bounds to UV and back, round trip under 1e-13 mm on all four benchmark pieces) and that the DXF pieces are rotated, which is why bounds alone are not enough.
- A mark is placed in 3D by ray hit, converted to `{pieceId, xMm, yMm}`, and **stored in piece coordinates only**. W3's layout reads that. The 3D view redraws it by the reverse map. Nothing is stored in 3D coordinates.
- Honest limit for option A: a mark that crosses a seam is flagged ("this mark crosses the side seam; it prints on two pieces") rather than shown as continuous.

### Seam pairing (needed for B)

Order of preference: (1) explicit pairs in the W1 pattern library (`seamId` per edge, as the plan's notches carry); (2) notches matched by seam id; (3) length matching of unpaired edges, flagged as a suggestion. The benchmark file has no notches, so for it only (1) and (3) are available. CLO asks for notches for the same reason.

## 6. Data model: what we need from the W0 contract

From `plans/production-outputs.md` W0 (names provisional until the contract lands):

- `PatternPiece`: `id`, `name`, `sizeLabel`, cut outline as closed polyline (mm), `onFold`, `mirroredPairOf`, `landmarks` (`hps`, `shoulder-point`, `underarm`, `cf-neck`, `cf-hem`, `cap-top`), `grainLine`.
- **Edge ids and seam ids** on outline edges (the plan says notches carry a seam id; we also need every outline edge to have a stable id so a seam pair can name both sides). **Ask W0/W1 for this.**
- **Piece axes**: a declared up direction (HPS to hem) so rotated pieces like the benchmark's can be read. Can be derived from two landmarks, so only the landmark set is needed.
- `PrintZone`: polygon in piece coordinates per size, with its landmark references (W3). The 3D layer draws the zone through the reverse map.
- New record owned by this work, not by W0: `SurfaceSample` as above, and `PlacedMark { id, kind, pieceId, sizeLabel, xMm, yMm, rotationDeg, widthMm, source }`. `source` should read "placed in 3D" so provenance stays visible.
- `GradedPattern` version id, so a stored mark can say which pattern version it was placed against; a size change reuses the landmark-relative position, not the raw mm.

## 7. Effort and trial plan (one week, option A)

| Day | Work |
|---|---|
| 1 | Landmark fit (two-point similarity) with tests against the W0 fixtures; report scale and residual |
| 2 | `SurfaceSample` for every vertex of today's mesh, front and back body only |
| 3 | Ray hit to `PlacedMark`; reverse map draws W3 zones over the 3D form |
| 4 | Seam-crossing flag; size change keeps landmark-relative position |
| 5 | Review with the owner on the jersey; write up scale error and cases that fail |

Pass: crest, sponsor and back number placed in 3D land within 2 mm of the same mark placed on the flat piece; sleeve and collar explicitly out of scope; every failure listed. Fail: scale between flat and piece differs by more than 3 % on the body pieces, in which case go straight to B.

Option B afterwards: 3 to 4 weeks for one tee-shaped family (one person), plus 1 to 2 weeks per extra family.

## 8. Risks

- **The cushion is not the garment.** Mapping onto it is exact for the mapping and misleading about seams and sleeves. Mitigation: seam-crossing flag; label stays "a preview of shape and colour, not of fit or drape".
- **Landmark quality.** Landmarks in the fixtures are placed by hand (plan, W0). A bad landmark moves every mark. Mitigation: report the fit residual; refuse to map above a set limit.
- **Missing notches** in imported DXFs, as the benchmark shows.
- **Stretch.** Inflating a piece stretches fabric on screen; a mark that looks 30 x 7 cm in 3D must be 30 x 7 cm on the piece. We store piece mm, so the print is right, but the preview can look wrong. Measure per-triangle stretch in B and show it.
- **Shrink.** W3 scales art by the fabric's shrink at print time; the mapping layer stores pre-shrink piece mm and must not apply it.
- **Dependency drift:** W0 names change; keep the mapping layer behind one small adapter.
- **Licence and hosting** if C is ever chosen (GarmentCode is MIT per its page; Warp and Qualoth terms not looked up here).
- **Performance:** surface samples add four numbers per vertex (about 2,300 vertices a side today); negligible.

## 9. Open questions for the owner

1. Is sleeve and collar placement in 3D needed for the first print files, or is body only enough? (Decides A alone versus A then B.)
2. Do clubs place marks in 3D at all, or only approve them there while the technician places them on the flat?
3. Which families come first for B (tee and jersey share a block)?

## 10. The throwaway proof

`docs/spikes/uv-to-piece-proof.mjs` reads the benchmark jersey DXF (layer 1 outlines), and for each piece converts a UV point to piece mm and back. Output on 2026-10-14:

```
torso front_48: 80 pts, 719.6 x 259.7 mm, centre inside=true, round-trip error=1.4e-14 mm
torso back_48: 67 pts, 738.6 x 259.7 mm, centre inside=true, round-trip error=0.0e+0 mm
sleeve full right_48: 94 pts, 205.2 x 372.1 mm, centre inside=true, round-trip error=0.0e+0 mm
collar_48: 5 pts, 38.0 x 212.9 mm, centre inside=true, round-trip error=0.0e+0 mm
```

It proves only the easy half: the arithmetic is lossless. It does not test the hard half, which is whether a flat and a piece agree on shape.
