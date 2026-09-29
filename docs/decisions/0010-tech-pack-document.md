# 0010: The tech pack document

Status: Accepted. The construction rules wait for a factory.
Date: 2026-09-29
Plan step: 8

## Context

A design has a spec, measurements and flats. The tech pack is the product's main output. Step 9
turns it into a PDF, an Excel file and SVG files, so the document has to be plain data that all
of them can read, and it must never say more than the design does.

## Decision

1. **`lib/techpack` is a pure library.** `buildTechPack(input)` takes the design, the size charts,
   the drawings, the history and the dates as arguments, and returns a `TechPack`. It reads no
   clock, database or network.
2. **Every value a factory reads is a `Cell`**: `{ status: "set", value, provenance }` or
   `{ status: "to-be-confirmed" }`. There is no way to hold a value without its source, and a
   missing value holds no number, no text and no zero.
3. **Nothing is invented.** No quantity, consumption, stitch density, weight, tolerance or price
   is ever worked out. A tolerance only ever comes from a size chart.
4. **There is no checked or verified state.** The sign-off holds a name and a date whose type only
   allows "to be confirmed", and one sentence: "Nobody has checked this specification yet."
5. **The table, the drawing and the document come from one version.** The table is made with the
   same `resolveAllSizes` call as the editor. The drawings are made from the measurements of the
   base size. Callouts are short codes (A, B, C in table order) that tie a drawing to its rows. A
   drawing that is not to scale carries no callouts.
6. **Seams and components are registry data.** Each seam names a seam class (ISO 4916) and a
   stitch class (ISO 4915), and each component names what the design implies. They are a starting
   proposal from general knitwear practice. The numbers are names of kinds, not quantities, and
   they live only in `registry/construction-classes.ts`. The rule that the registry holds no digits
   still covers everything else.
7. **The design gained fields**, as version 5 of the spec: components, construction overrides,
   labelling, and fabric consumption. A version 4 design is upgraded by adding them empty. A
   component or an override whose seam or slot goes away is removed and reported, like colours and
   artwork.
8. **The page is real headings, tables and lists.** Values show their source in words. "To be
   confirmed" uses the attention colours. The forms save through the same change queue as the
   editor, and the server stamps the source.

## Evidence

| Claim | Test |
|---|---|
| Changing a measurement changes the flat, the table and the document | `lib/techpack/three-way.test.ts` |
| No value lacks a source, for designs made by random changes | `lib/techpack/integrity.test.ts` |
| No quantity, density, measurement or label is invented, and the only digits are the version, dates and ISO numbers | `lib/techpack/integrity.test.ts` |
| Nothing is called checked or verified, and the sign-off is empty | `lib/techpack/integrity.test.ts` |
| Every section is present for every tops type, empty and full | `lib/techpack/build.test.ts` |
| Every seam joins only panels the design has, for every valid combination | `lib/garment/construction.test.ts` |
| The page shows every section, the count, a typed measurement and a fabric against its panels | `e2e/tech-pack.spec.ts` |
| Coverage of `lib/techpack` is at least 90% | Threshold set in `vitest.config.mts` |

## Alternatives

- A plain string for every value, with the source in a second field. It lets a value exist
  without its source, so it lost.
- Class numbers inside the tops family data. It would have ended the rule that the family data
  holds no digits. The catalogue is a separate list, and a test checks that digits appear in it
  only as class numbers.
- Extra components the user invents. It needs a kind for each, and a way to say when it stops
  applying, so it waits for a real need.

## Open for the owner and a factory

`apps/web/lib/garment/OWNER-QUESTIONS.md` lists every seam rule and component.
`apps/web/lib/techpack/OWNER-QUESTIONS.md` lists the choices about the document.

## Consequences

- "Made by" in the revision history says "Not recorded". The database keeps who saved a version
  but no name is stored to show.
- Only components the registry implies can be described. Extra items such as a swing tag are not
  supported yet.
- The drawings show the first colourway.
- Step 9 renders this document. It should call `allCells` to check every value before it writes.
