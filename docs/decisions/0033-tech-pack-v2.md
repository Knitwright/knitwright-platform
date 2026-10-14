# 0033: Tech pack v2 and "Ready for the factory"

Status: Proposed (phase A built; phase B waits for the pattern, fabric, print and release services)
Date: 2026-10-14
Plan step: `plans/production-outputs.md`, workstream W5

## Context

The fashionINSTA benchmark tech pack leaves six points as "confirm" that its own DXF answers,
contradicts that DXF on four stated values, has an empty sign-off and no definition of done. The
Knitwright tech pack (decisions 0007 to 0027) already gives every value a source. It had no pattern,
cutting, fabric-test or print sections, no measured-against-pattern table and no sign-off records.

## Decision

1. **Production records enter through one optional input.** `TechPackInput.production`
   (`lib/techpack/production/input.ts`) holds what the W0 contract gives (a `GradedPattern`,
   `PatternMeasurement[]`, `FabricProfile`, `PrintProfile`, `PrintRuleSet`, `PrintZone[]`) and small
   records of people. Every field is optional. Without any of it the document still builds, every new
   section says what is missing, and the readiness list is open. Phase A is built against the W0
   fixtures; phase B only passes the real services' output in.
2. **Five new sections, one extended.** "Ready for the factory", "Pattern and cutting", "Fabric",
   "Artwork and colour" and "Order of work" are added. The measurement section gains a table set
   against the pattern (target, measured, difference, inside or outside the tolerance, with a sentence
   for each point that is outside). "Sign-off" keeps its id and its first sentence and gains a line for
   each role and the strike-off; a line holds a name and a date only from a record.
3. **Nothing is measured here.** The tech pack reads `PatternMeasurement` values (source
   `measured-from-pattern`) and does only arithmetic on them: a difference, a comparison with the
   tolerance, areas of pieces from their outlines, a placement from the high point of shoulder and the
   centre line, and the closest gap in a dot repeat. A value a record does not give is "To be confirmed".
4. **The definition of "Ready for the factory"** is `lib/techpack/production/readiness.ts`: 8 groups and
   25 items, each met or a sentence naming who acts (owner, technician, print house, factory, club).
   The list is ready only when every item is met. Operations are proposals by design and do not block it.
5. **Defaults are not values.** A Knitwright default (bleed, dpi, marker efficiency) is never shown as a
   setting from the print house or factory, and counts as open in the list. A suggested fabric value
   never scales artwork.
6. **Exports carry the new sections** through the same tables the PDF and the Excel file are built from;
   the existing guard and tests (every cell once, with its source; no value outside a cell; no digit in
   an empty design) cover them. The wording test now scans `lib/techpack/production` and checks the
   record sentences ("Reviewed by", "accepted by", "Signed by", each with a name and a date).

7. **Phase B: the page is built from the artwork stack** (decision 0035). The `artwork-and-colour` section
   reads the design's `ArtworkStack` (the production input's, else the design's own through
   `currentStack`) and falls back to `kitPattern` and `artwork` only when a design has no stack
   (`lib/techpack/production/stack-source.ts`, `lib/techpack/artwork.ts`). It lists the design in plain
   words (`describeStack`), each colour with its role, screen colour and the codes a person typed (a
   Pantone code is shown as typed under "Other codes"; none is shipped, P6 and P15), every layer with its
   kind, zone or anchor, clear space and technique, and where each placed layer sits on every size,
   measured through W3's `PieceMapper` (`layer-placement.ts`, read-only use of `lib/print`). The repeat
   spec (`repeat-spec.ts`) gives any pattern's generator, settings and seed, or a repeating picture's tile
   and repeat size, as words and as a sorted-key JSON record, so a design has one whatever made it.
8. **Pictures and readings.** Each placed picture shows its effective dpi as printed (the print scale is
   applied), measured with W7b's `effectiveDpi`; the minimum is the print house's or Knitwright's 150,
   labelled as a default (P14). A design read from a picture carries W7d's report, its limits and the
   user's acceptance by name and date; the words are "close reading", never an exact copy.
9. **Two readiness items join the print group** (27 items in all): `print-image-dpi` (no placed picture
   below the minimum unless a named person accepted it; a picture whose size is not on record is open) and
   `print-picture-read` (a design read from a picture needs a named acceptance that covers its layers).
   A strike-off counts only for the release it was made for: `StrikeOffRecord.releaseId` (a `contract`
   change, additive) is compared with the frozen release in `proofItems`.
10. **Open owner inputs say so.** An open item that waits on P1 to P16 carries `ownerInput` (what is
    needed, and what is used until then), shown on the page and in the exports (`owner-inputs.ts`). P11 and
    P17 hold up no item.
11. **What is read from where.** `lib/projects/tech-pack-production.ts` reads the pictures the design places,
    the print profile and its lowest dpi, the newest release with its sign-offs, the newest accepted
    strike-off and the accepted reading a design came from, through each service's own reader. A read that
    fails leaves its part out, and the list says what is missing. The pattern, fabric test, zones and
    print files are not read yet: the pattern library, fabric library and print builder do not yet hand a
    design's records over, so those items stay open as before.

## Evidence

`lib/techpack/production/*.test.ts` (measured table with the four benchmark disagreements, readiness
items, sections), `lib/techpack/exports/{tables,excel/workbook}.test.ts` and
`exports/pdf/production.test.ts` (every cell of a full production pack in the PDF and the Excel file,
the same bytes twice), `lib/techpack/wording.test.ts`. Phase B: `production/{stack-artwork,layer-placement,image-dpi,picture-read,artwork-colour-stack}.test.ts`,
`artwork-stack.test.ts`, the stack designs in `integrity.test.ts`, `exports/tables.test.ts` and
`exports/pdf/stack.test.ts`, `lib/projects/tech-pack-production.test.ts`, `e2e/tech-pack-artwork.spec.ts`.

## Alternatives

- Put readiness in the cover: rejected, the list is long and names who acts, so it is a section.
- Add a `proposal` flag to each step of the order of work: rejected, the "confirm all" flow would then
  try to confirm steps nobody can edit yet.
- Compute measurements in the tech pack: rejected by the plan; W1 owns `measure/`.

## Consequences

Phase B passes real records and fills `production` in `lib/projects/tech-pack-data`. Two details wait
for W1 and W3: the rule that a seam is "joined" (a seam on two or more pieces that is not a hem) and the
fields of a print file report.
