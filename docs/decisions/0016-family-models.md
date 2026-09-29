# 0016: Registry models for bottoms, outerwear and close-fitting

Status: Accepted, with questions open for the owner (A5)
Date: 2026-09-29
Plan steps: 16 (bottoms), 19 (outerwear), 22 (close-fitting)

## Context

The registry held the tops family and three empty families. Milestone 2 fills them, one
step each, without changing the editor, the tech pack flow or the exports. Owner action
A5 (base-size measurements and grades for every type) has not been done.

## Decision

1. **Each family is data in its own folder** under `lib/garment/registry/`, built from the
   same shapes as tops: options, points of measure, panels, rules, seams, components and
   types. Small builders shared by the new families live in `registry/shared.ts`. The
   tops data is left as it was. Outerwear reuses the tops body, sleeve and neck points
   as they are, so a hoodie and a tee are measured the same way.
2. **New sections of the measurement table are new point groups** (`waist`, `rise`, `leg`
   for bottoms; `hood`, `zip`, `pocket`, `rib` for outerwear; `strap` for close-fitting). Every screen and export already lays the table out from `POINT_GROUPS`, so
   none of them changed. The spec schema did not change: a design never stores a group.
3. **No chart numbers.** As in step 5, the default charts stay empty until A5. Every type
   resolves through the same code: with no chart each size a design names comes back as
   "no chart", with every point "missing" and no number. The acceptance check runs on the
   made-up test charts, which now cover every type of every family automatically.
4. **One set of checks for every family** (`registry/families.test.ts`,
   `lib/sizing/families.test.ts`, and the source check in `lib/techpack/integrity.test.ts`):
   no digits in family data, full how-to-measure sentences, every panel joined by a seam in
   every valid combination, a valid starting design for every wearer, every type resolving
   at every size of every chart that applies, and every tech pack value with a source.
5. **Size systems are declared in the registry** (`registry/size-systems.ts`): adult sizes
   (men and women), youth sizes, and sports bra sizes. A type may name another system for a
   wearer; the sports bra does, for women and youth. A size run may carry a `system`; a run
   with none is the usual run of its wearer, so every existing run and chart is unchanged.
   Chart checks, chart selection and the CSV reader match runs by wearer and system, and a
   sports bra chart on the usual women's run is refused with a plain reason. The design
   spec does not store a system, so its schema did not change.
6. **Close-fitting seams follow a seam choice.** Each joining seam has an overlocked form and
   a flat (flatlock) form and only the chosen one applies. Seam class 4 (flat) and stitch
   type 607 (four needle flatlock) were added to the catalogue, unverified like the rest.
7. **Construction is a proposal**, as for tops: seam and stitch classes from general knitwear
   practice, shown as proposed, listed in `lib/garment/OWNER-QUESTIONS.md` for a factory.

## Consequences

- A design of a new type opens in the editor and the tech pack with no drawing ("There is
  no drawing for this garment type yet.") until its flat step lands.
- Leggings, sports bras and compression tops have no fit choice. A chart for them has no fit, which `selectChart` already handles.

## Open for the owner

`apps/web/lib/garment/OWNER-QUESTIONS.md` (one section per family) and
`docs/owner/size-charts.md` (the points of measure to send numbers for).
