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

## Review, 2026-09-29

A reviewer found nothing critical and two high problems, both fixed. The page showed a green
notice, "Nothing is left to confirm", while proposals were still unconfirmed. And the seam and
stitch classes the platform proposes read like a specification and were not listed as
unconfirmed.

What changed in the fix pass:

| Change | Test |
|---|---|
| The summary is only ever a warning or plain information. No tech pack code holds a tone or colour for "all good". | `lib/projects/tech-pack-view.test.ts` |
| A class the platform proposes carries `proposal: true` and the words "Proposed by Knitwright. Not confirmed by anyone." in attention colours. Proposals are listed under their own heading and counted apart. A class the user chose is theirs, not a proposal. | `lib/techpack/construction.test.ts`, `lib/techpack/completeness.test.ts` |
| The suggested page is one pass over every cell, so a suggestion cannot be left off it. | `lib/techpack/suggested.test.ts` |
| Each fabric field carries its own source, as version 6 of the spec. Saving one field no longer marks the others as typed in by the user. A version 5 design is upgraded by copying the old source onto each field that has a value. | `lib/garment/fabric-sources.test.ts`, `lib/projects/browser-action.test.ts` |
| A part can be marked "not used", which takes it out of the count of things to confirm. | `lib/techpack/components.test.ts` |
| Artwork shows the name of its picture. The file id is kept for drawing and is not shown as a value. | `lib/techpack/plain-sections.test.ts` |
| The scan for words such as "checked" reads every string in the page, the view models, the registry and the document. | `lib/techpack/wording.test.ts` |
| Only versions up to the one read are listed, and the page reads again when the history is newer. | `lib/projects/tech-pack-data.test.ts` |
| Weights, turns and dates carry a number or an ISO date beside their words, for step 9. | `lib/techpack/cover.test.ts` |

Class 602 was explained the wrong way round and is corrected. Class 406 was added and is
proposed for hems. **Nobody has checked any class number against ISO 4915 or ISO 4916.** Both
question files say so at the top.

## The browser tests

Browser runs of step 8 failed in one to four tests out of 78, different ones each time, always
a wait that ran out. Measured on the built app: a tech pack page loads in 250 to 400 ms and the
app's own work for it is about 5 ms. A sign-in takes 2 to 8 seconds, because every test passes
the real Cloudflare bot check, loaded from the internet. With six workers, six sign-ins at once
ran past the wait of five seconds.

The local run now uses four workers, waits of 15 seconds, and 60 seconds for a test. There are
no retries locally. Six runs in a row passed, 80 tests each. The sign-in itself was not made
faster, and the tests still depend on the network. A stand-in for the bot check in tests, or
one sign-in shared by each worker, is the real cure and is owed.

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

- "Made by" in the revision history names the person who saved each version (since 2026-09-30,
  owner decision): the name from their profile, set in Settings or given by Google, else their
  email address. Names come from `public.brand_member_names`, which answers only for the reader's
  own brand and only with its members; anyone else, or a version whose maker is gone, is
  "Not recorded". The PDF and the Excel file carry the same names.
- Only components the registry implies can be described. Extra items such as a swing tag are not
  supported yet.
- The drawings show the first colourway, or the one named in the address (`?colourway=`). The
  page has no control to choose it yet.
- The upgrade from version 5 to 6 is proven by unit tests only. No stored design was opened.
- Step 9 renders this document. It should call `allCells` to check every value before it writes.
