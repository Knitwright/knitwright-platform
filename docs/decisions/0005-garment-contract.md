# 0005: The garment contract and the registry for tops

Status: Accepted, with questions open for the owner
Date: 2026-09-29
Plan step: 4

## Context

Everything after this step reads or changes a garment: the editor, the flats, the tech
pack, and later the AI. They need one description of a garment that all of them share,
and one list of what garments exist.

## Decision

1. **`lib/garment` is a pure library.** No screen, no database, no network.
2. **A design is a `GarmentSpec`**: the garment type, the wearer, one choice for every
   option that applies, measurements, fabrics, colourways and artwork. It holds nothing
   that can be worked out from the rest.
3. **Garments are data.** A type lists its options, the choices it offers, its points of
   measure and its panels. A new type is added by adding data. Bottoms, outerwear and
   close-fitting are present as empty families.
4. **The registry holds no numbers.** It says which points of measure a garment has and
   how to take them. What they measure comes from the size charts in step 5. A test
   fails if a digit appears in the registry.
5. **Measurements are whole tenths of a millimetre**, and each carries one of six
   sources. There is no source that means "checked".
6. **Some points of measure and panels depend on options.** Collar height applies only
   with a collar. Shoulder width applies only to a set-in sleeve.
7. **Impossible combinations are data, each with a reason** in plain words.
8. **Every change is a `SpecAction`, applied by `applyAction`.** It never changes its
   input and never returns an invalid design. When a change makes something no longer
   fit, that thing is removed and reported, so the screen can say what was dropped.
9. **Fabric is per panel and says where its details came from.** A design has a list of
   fabrics and a list of which panel uses which. A panel with no entry uses the first
   fabric. This was changed after the first build, because the tech pack lists fabric
   for each panel and no value may be shown without its source.

## Evidence

| Claim | Test |
|---|---|
| Every tops type validates | `lib/garment/spec.test.ts` |
| Every impossible combination is rejected with its reason | `lib/garment/rules.test.ts`, over every combination of choices of every type |
| No action returns an invalid design, changes its input, or answers differently twice | `lib/garment/apply-action.test.ts`, 300 random runs of up to 30 actions |
| Coverage of `lib/garment` is at least 90% | 100% of lines, 97% of branches. The threshold is set in `vitest.config.mts`. |

## Open for the owner

`apps/web/lib/garment/OWNER-QUESTIONS.md` lists the choices that need someone who knows
garments: which combinations are truly impossible, whether raglan belongs on tees, and
whether the how-to-measure sentences are right. Each is a change of a line or two of data.

## Consequences

- The editor in step 6 can build its controls from the registry alone.
- `update-fabric` replaces all of a fabric's details at once. The editor sends the whole
  fabric when one field changes.
- Artwork can be placed on the body and the sleeves only. Collars, cuffs and plackets
  have no anchors yet.
