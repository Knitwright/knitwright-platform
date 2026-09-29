# 0017: Flats for bottoms, outerwear and close-fitting

Status: Accepted. The drawings wait for the owner (action A6).
Date: 2026-09-29
Plan steps: 17 (bottoms), 20 (outerwear), 23 (close-fitting)

## Context

Step 7 drew tops through one geometry model and two renderers (decision 0009). The other
families had registry entries (decision 0016) and no drawing: the editor and the tech pack
said "There is no drawing for this garment type yet."

## Decision

1. **The model, the layers, the renderers and the exports do not change.** A family's
   drawing code fills the same layers (Panels, Seams, Stitching, Details, Artwork,
   Measurements), the same outline and the same landmarks.
2. **Each family has its own drawing code** under `lib/flat/families/<family>/`, listed in
   `lib/flat/families/index.ts`. `buildFlat` sends a design of a family other than tops to
   its drawer; tops keep their templates unchanged, and a family with no drawer still gets
   no drawing. Shared parts (the dimension resolver, chains, paths, artwork placement,
   callouts) are reused.
3. **As in step 7, a drawing with measurements missing is drawn from proportions**, ratios
   against one width of the garment (the hip for bottoms). It is marked not to scale and
   carries no values. The owner's snapshot pictures of these families are drawn with no
   measurements at all, and say so, rather than with made-up sizes.
4. **Measurements that cannot be drawn together are named** in plain words and the drawing
   falls back to proportions, as for tops.
5. **Panels a view cannot show are hidden in one place** (`visiblePanels`): the other side
   of the legs, and parts seen only from the front, such as the gusset.

## Bottoms (step 17)

- The two legs are one panel on each view, meeting only at the crotch on the centre line.
- The front of the leg at the crotch is drawn at 0.92 of the flat thigh, because a flat
  thigh measure takes in the back of the leg as well. Asked in `lib/flat/OWNER-QUESTIONS.md`.
- The side is one smooth curve from the waistband over the hip to the crotch. It has no
  corner at the hip, so the hip line is where the side is widest, not a point it passes.
- The outside leg length is checked against the rise and the inside leg (within 8%), and
  shown by its callout. The hem sits the inside leg below the crotch.

## Outerwear (step 20)

- The body, sleeves, neck and stand collar are the tops shapes, from a tops frame with long
  sleeves, so a hoodie and a tee are drawn by the same code. Callouts of those points are
  the tops callouts.
- The hood is drawn up, as worn, on both views. Its bottom edge is the neck seam of the
  body, so the two share an edge. From the front the lining, or the inside of a single
  layer hood, shows through the face opening. The silhouette takes in the hood, and the
  face opening is the outline's opening.
- The zip length is checked against the front neck in both views, since the zip is on the
  front.

## Close-fitting (step 23)

- A compression top is a close-fitting tee, drawn by the tops code with its binding and
  flat seam stitching.
- Singlets, vests and sports bras have their own shape: straps, a deep armhole that meets
  the underarm level, and on a racerback an edge that runs in to the narrowest point of the
  back and out to the underarm. A sports bra ends in its underband.
- Binding along an armhole is made by moving the edge into the body along its normal at
  every point, and it ends on the side seam, so it is the same width all round, even round
  the curve of a racerback.
- Flat seams show as two rows of stitching inside the side seams.

## Evidence

| Claim | Test |
|---|---|
| Every panel closed, not crossing itself, symmetrical; one silhouette holding every panel; one opening; on all pairs of choices, both views, with no sizes and at two made-up sizes | `lib/flat/families.test.ts` |
| Every point of measure has a callout when to scale, and changing any one changes the drawing (M3) | `lib/flat/families.test.ts` |
| What each choice adds, and each problem named | `lib/flat/families/*/*.test.ts` |
| A changed drawing is noticed | SVG snapshots in `lib/flat/__snapshots__/families.test.ts.snap` |

## Open for the owner

Owner action A6: approve the pictures in `docs/owner/flats/` (see its README). The
proportions and drawing choices are listed in `apps/web/lib/flat/OWNER-QUESTIONS.md`.
