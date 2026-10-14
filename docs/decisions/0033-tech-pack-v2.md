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

## Evidence

`lib/techpack/production/*.test.ts` (measured table with the four benchmark disagreements, readiness
items, sections), `lib/techpack/exports/{tables,excel/workbook}.test.ts` and
`exports/pdf/production.test.ts` (every cell of a full production pack in the PDF and the Excel file,
the same bytes twice), `lib/techpack/wording.test.ts`.

## Alternatives

- Put readiness in the cover: rejected, the list is long and names who acts, so it is a section.
- Add a `proposal` flag to each step of the order of work: rejected, the "confirm all" flow would then
  try to confirm steps nobody can edit yet.
- Compute measurements in the tech pack: rejected by the plan; W1 owns `measure/`.

## Consequences

Phase B passes real records and fills `production` in `lib/projects/tech-pack-data`. Two details wait
for W1 and W3: the rule that a seam is "joined" (a seam on two or more pieces that is not a hem) and the
fields of a print file report.
