# 0027: Beta scope, and player names and numbers

Status: Accepted. Which garments launch, the lettering and places, and the 3D verdict are asked in apps/web/lib/config/OWNER-QUESTIONS.md.
Date: 2026-10-11
Plan step: wave 3 (Platform and Store Guide, 2026-10-10)

## Context

The owner's Platform and Store Guide (pages 6 and 7) launches with nine club products and
leaves leggings, sports bras and rash guards to a second wave "only after the first one sells".
The studio already has registry models, flats and rules for leggings, the sports bra and the
compression top (decisions 0016, 0017, 0021). The 3D view (decision 0014) is a trial still
waiting for the owner's verdict (A10).

## Decision

### Part 1: what the beta offers

1. **One list decides which garments a new design may start as**:
   `LAUNCH_GARMENTS` in `apps/web/lib/config/launch-garments.ts`. It is an allow list, so a
   garment added to the registry later stays hidden until it is listed. Leggings, sports bra
   and compression top are left out.
2. **Every way to start a new design reads it**: the garment lists on `/studio/new` and
   `/studio/start` (`garmentTypeGroups`), the server schemas behind them (`offeredTypeSchema`),
   and a guided start from words, which answers "Not offered yet: Leggings." instead of
   starting another garment.
3. **Plain-English edits and pictures say it too.** Words that name a hidden garment are
   answered before any model is asked, at no cost. A change, question choice or picture
   reading that turns a design into a hidden garment is refused or taken out
   (`lib/intent/launch-scope.ts`), and the model is shown only offered types. A browser change
   of type to a hidden garment is refused by the server.
4. **Existing designs are untouched.** A design that already is a hidden garment opens, edits,
   keeps its type, and gives its tech pack and every export. No code, data or test of those
   garments was removed. The golden sets keep testing them: they call the resolvers directly,
   below the launch check, because they test reading words, not what is on sale.
5. **The 3D view is behind a server switch**, `SHOW_3D`, shown only for the exact value
   `true` and off by default. Its code, tests and the architecture guard stay.

### Part 2: player names and numbers

6. **A design records how names and numbers go on, never who wears them.** A new optional spec
   field `namesAndNumbers` (`lib/garment/names-numbers.ts`) holds the places, a lettering style
   from a fixed set of four, a colour name or code with an optional drawn colour, how they are
   made, a height for each place only if typed, and one sample name and number to draw. The
   roster belongs to the team order portal (guide p.5), which is not built.
7. **Places are standard anchors**: name on the upper back, number on the centre back (drawn
   below the name), an optional front number on the centre chest, and a number on the left
   thigh of bottoms. A garment offers only the places whose panel and anchor it has. When the
   type changes, places it lacks are removed and reported, like artwork.
8. **No spec version bump.** The field is optional and additive; every saved design still
   reads. A design saved with the field cannot be read by code older than this change.
9. **Nothing is guessed.** Style, colour, technique and every height stay unset ("To be
   confirmed" in the tech pack) until chosen. The drawing places an untyped sample at a drawing
   size that is never shown or written as a measurement, like `SCHEMATIC_CHEST`.
10. **One font in the drawings.** SVG and PDF draw the sample in the bundled font so the two
    match; the lettering style is a written instruction to the factory.
11. **Shown everywhere artwork is**: the editor, both flats, the tech pack artwork section (a
    table of its own), and the PDF, Excel and SVG exports. Plain English: "add names and numbers
    on the back" (and a few close phrases) is read by the rules at no cost, and the model may
    reply `add-names-numbers`. Three golden cases were added, not approved (A7).

## Evidence

Unit tests: `lib/config/launch-garments.test.ts`, `lib/intent/launch-scope.test.ts`, and
cases added to `lib/guided/start.test.ts`, `lib/intent/text-flow.test.ts`,
`lib/projects/schemas.test.ts`, `lib/projects/type-groups.test.ts`, `lib/config/env.test.ts`.
Part 2: `lib/garment/names-numbers.test.ts`, `lib/flat/player-marks.test.ts` (SVG and PDF read
back), `lib/techpack/player-marks.test.ts`, `lib/projects/names-numbers-controls.test.ts`, and
cases in `lib/intent/text-flow.test.ts`. An e2e test was written in `e2e/editor.spec.ts`.

## Alternatives

- A deny list of hidden garments: one edit to re-enable as well, but a new registry type would
  appear in the beta unasked.
- Removing the hidden garments from the registry: breaks existing designs and throws away work.
- Names and numbers as text artwork: artwork needs a width and height, which would force a
  guessed size, and it cannot say "the player's own name".
- Real lettering fonts in the drawings: needs licensed font files in both renderers; asked of
  the owner.
- Hiding the 3D view with a build flag (`NEXT_PUBLIC_`): needs a rebuild to change; a server
  variable needs a restart only.

## Consequences

To offer a garment, add its id to `LAUNCH_GARMENTS`. To show 3D, set `SHOW_3D=true`. The
golden sets no longer describe exactly what a beta user sees for hidden garments; the launch
check sits above them.
