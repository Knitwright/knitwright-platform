# 0077: The Specs toolbar and the tech pack view

Status: Proposed
Date: 2026-10-30
Plan step: `plans/platform-v5.md`, wave 2, workstream Y4 (spec F-S6 tabs, spec F-S4 Specs toolbar)

## Context

Spec F-S6 makes the tech pack the **third view of the design**, not a document beside it:
**2D | 3D | Tech pack**, with eleven tabs (Overview, Body, Measurements, Materials (BOM), Callouts,
Artworks, Colourways, Personalisation, Labels & packaging, QC, Review), a **mm | cm | in** toggle,
and a provenance chip on every field — **From base**, **From design**, **Needs your input**,
**Confirmed**. Spec F-S4 puts a **Specs** toolbar in the left rail — Select, Measure point, Measure
line, Measure edge, Callout — whose marks write to the tech pack. Spec F-S6's acceptance test is
that "the Excel and PDF exports contain identical values for the same version", and its Review tab
blocks the export until nothing is waiting and the F-G2 check is clear.

What already existed: the tech pack document of waves past (`lib/techpack`, a `TechPack` built from
one `GarmentSpec`, with its own wording rules and its `[TBC]` discipline); wave 1's base article
catalogue (X1, decision 0066), rulebook and `Why?` (0067), design object v2 and `validation_results`
(0069) and production package (X5, 0070) with its F-G2 gate and its four provenance words; and
wave 2's editor shell (Y2, decision 0075) with the slot contract this workstream codes against.

## Decision

1. **The whole tech pack view is one pure function, and the panel only draws it.**
   `lib/techpack/view/buildTechPackView(input)` takes exactly what the slot contract hands a panel —
   the design, the base article, the shown size and colourway, the unit and mode toggles and
   whatever the Specs toolbar has drawn — and returns every tab, the point-of-measure table, the
   Review tab and the provenance counts. It fetches nothing, reads no clock and holds no state, so
   the same design gives the same view twice (`model.test.ts` asserts it). Coverage of the directory
   is 99.5% of statements and 96% of branches, against the plan's 90%.

2. **The four provenance words are the production package's, not this workstream's.**
   `FIELD_PROVENANCE` (`from_base`, `from_design`, `needs_input`, `confirmed`) comes from
   `lib/kpp/model` (X5, decision 0070), which took it from `docs/spec/04-production-package.md`. The
   tech pack a founder reads and the package a factory receives therefore label a value's source with
   the same word, and a rename breaks both at once rather than letting them drift apart.

3. **A cell with no value wears the amber chip whatever the caller asked for.** `cell()` in
   `fields.ts` turns an empty or blank text into `needs_input` and drops the lock, so no empty field
   can be drawn as if the base or the design had supplied it, and nothing is ever drawn as a zero,
   a dash with a number in it or `[TBC]`.

4. **Grades are locked from the base article; a missing tolerance stays missing.** Every row of the
   Measurements tab carries X1's own letter, grade type, grade, tolerances, per-size values and rule
   id, with `locked: true` and a lock plus a "Why?" beside the grade. The spec's ±10/5/3 mm defaults
   are never adopted: a point of measure with no tolerance keeps none and the Review tab lists it as
   a question for the factory (plan v5 decision 18). An extra point a founder adds is ungraded by
   construction — no grade, no tolerance, and a value only in the sample size's column.

5. **The Grading toggle shows the step between sizes, worked out from the article's own values.**
   Not from the nominal grade: a non-linear point grades by different amounts between sizes, and the
   number the factory cuts to is the one in the table. The first column has no step, and a step with
   a value missing at either end has none.

6. **`article.json` has a fourth grade type and it is kept.** Spec F-S6 names three (Linear,
   Non-linear, Ungraded); `JSY-SS-01` uses `fixed` for the back neck drop and the neck rib height,
   which do not change across the run, and X1 seeded it. It is shown as "Fixed". Folding it into
   Ungraded would lose a distinction the article makes.

7. **Four tabs say their data is not on file, rather than working it out.** The base article
   catalogue carries points of measure, parameters, options, construction and fabrics. It does not
   carry the **body size chart** (F-S6's Body tab), the **QC plan**, the **personalisation zones** or
   the **per-market labels**, and `article.json`'s own `qc`, `personalisation` and `labels` blocks
   were not seeded. Those tabs therefore name every field the spec asks for, say the value comes from
   the factory, and carry the rulebook's own rule (`R-FIT-001`, `R-QC-001`, `R-PER-001`, `R-LAB-002`)
   so the "Why?" opens a rule and not a gap. Deriving a body chart from the garment's chest width
   would be exactly the invented measurement the rules forbid.

8. **One list of values, grouped two ways, is what makes the Excel and the PDF agree.**
   `export-values.ts` holds every value of every exported tab once, each with its sheet, group, row
   and column. `excelSheets` groups it by tab, one sheet each (spec F-S6); `pdfPages` groups it by the
   16 pages of spec F-S6. `export-values.test.ts` compares the two value for value for five kinds of
   design — the worked article, the same in inches, one with drawn marks, a draft article and a
   design off the catalogue — so a value cannot reach one format and not the other. The two formats
   themselves are Y5's (`lib/techpack/exports/**`); nothing here edits them. What Y5 must not do is
   work a value out a second time.

   The **Review** tab is not exported: it is the editor's own list of what is missing, and spec F-S6's
   export section picker does not offer it. The **Body** size chart is carried on PDF page 1 with the
   Overview, because spec F-S6's page list has no page for it although its own section picker offers
   "Body size chart". That is a reading of the spec, and the owner question is below.

9. **The Review tab runs F-G2's list over the view, and says which items it cannot read.**
   Nine lines, in one order: no field waiting, no `[TBC]`, points of measure complete, bill of
   materials complete, a label for the destination market, then the colour gamut, the print
   resolution, the bleed and the moderation status. The last four are read off print files and
   uploads the tech pack view does not hold, so they are reported as read somewhere else and do not
   block on this tab — a check that did not run is not a check that passed. The export is held while
   any of the first five blocks. `lib/kpp/gate.ts` (X5) runs the same checklist over the package
   input; this one runs it over what the person is looking at.

10. **The Specs toolbar's thinking is in `lib/techpack/view/marks.ts`, tested without a browser.**
    A measure line's length is the length of the picked polyline in whole millimetres — the unit the
    article's points of measure are in; a tenth of a millimetre read off a drawing would be a
    precision the drawing does not have. A tool given too few places makes no mark at all, so a
    half-drawn line can never reach the tech pack. A measure mark becomes an extra point of measure;
    a callout becomes a numbered row on the Callouts tab, numbered on from the base's own rows.

11. **No view reports a click yet, so the place is given in fields, and the panel says so.**
    `components/studio/editor/specs/pick-bus.ts` is the seam (plan v5, lesson 9): a view that learns
    to report where a person clicked calls `reportPick`, and the toolbar listens while a drawing tool
    is held. The 2D pattern view is Y3's slot and the 3D viewer has no picking (decision 0075 says so
    in as many words), so `PICKING_VIEWS` lists both as not reporting and the panel's sentence is read
    from that list rather than written out, so it cannot go stale. The fields are also how a person
    who cannot use a pointer gives a place, so the tool is never pointer-only.

12. **A mark is not saved with the design, and the panel says that too.** The Specs toolbar and the
    tech pack view are two different slots, and the slot contract gives a panel the design and the
    commands and nothing else, so they share `components/studio/editor/specs/marks-store.ts`, keyed
    by project and version. Nothing is persisted: `EditorCommands.save` takes a `SpecAction`, and
    `lib/garment/action-schema.ts` has no action that stores a founder's own point of measure or a
    callout — `set-measurement` takes a `pointId` the garment registry must already know, and a mark
    drawn on a panel has no such id. A reload therefore loses the marks, and the panel carries that
    sentence where a person reads it. **This is a gap, not a design**, in the same shape as decision
    0075's form gap; the owner question is below.

13. **The panels are built but not wired into the shell.** They are default exports taking
    `EditorSlotProps`, as the slot contract requires, so the shell can load them with `next/dynamic`.
    Wiring them means editing `components/studio/editor/CanvasFrame.tsx` and `EditorShell.tsx` and
    `e2e/editor-shell.spec.ts`, which are Y2's files and assert the placeholders by name
    (`editor-slot-specs` "workstream Y4"). This workstream owns none of them, so the orchestrator
    wires all four of the wave's panels at once. Until then the shell still draws its placeholders,
    and these panels are tested by rendering them from the slot contract
    (`TechPackView.test.ts`, `SpecsToolbar.test.ts`) rather than through a browser.

14. **The row's name is not a cell.** A table either holds the row's name in its first cell or heads
    a leading column with `rowHeader`, never both: a name drawn twice would be exported twice, and a
    row's name is not a field with a source of its own.

## What is not done

- No migration, as the plan says. Nothing of this workstream is stored.
- No end-to-end test, because nothing draws these panels yet (decision 13).
- No reference image on a callout: an upload belongs to the Library toolbar (Y3) and the Callouts tab
  names the field and asks for it.
- The 3D view's numbered pins and lettered measurement pins are not drawn; the view model carries the
  numbers and the letters the pins would use.
- "Show customers", the Body tab's storefront toggle, is not built: it feeds the storefront size
  guide, and the Store is not built here (owner decision 1).
- Trims and labels cannot be added. Spec F-S6 allows them "from the factory's list only", and no
  factory list of trims exists in the data; the tables say so rather than offering a free-text box
  that would put an unorderable trim on a tech pack.

## Owner questions

1. **How is a founder's own point of measure, or a callout, stored?** There is no `SpecAction` for
   either (decision 12). The smallest fix is two more members of `specActionSchema` —
   `{ type: "set-extra-pom", pom: { letter, description, sampleMm, ruleId } }` and
   `{ type: "set-callout", callout: { id, panelId, xMm, yMm, label, note } }` — plus their cases in
   `apply-action.ts`, both in `lib/garment`, which belongs to no wave-2 workstream, and a place for
   them in the stored spec. **Who owns that change, and in which wave?** Until it lands, a mark
   shows on the tech pack and is lost on a reload.
2. **Where does the body size chart live, and who supplies it?** Spec F-S6's Body tab wants a size
   standard with chest, waist, hip and height per size, and the base article catalogue has no table
   for it. Is it a new catalogue table per size standard (shared between articles), or a block on the
   base article? Either way the numbers are the factory's, and the tab asks for them today.
3. **Which PDF page carries the body size chart?** Spec F-S6's own page list has sixteen pages and
   none of them is the body chart, while its export section picker offers "Body size chart". It is
   carried on page 1 with the Overview here. Should it have a page of its own — which would make the
   layout seventeen pages — or stay on page 1?
4. **Is `fixed` a fourth grade type for good?** `article.json` uses it and X1 seeded it, and it is
   shown as "Fixed" (decision 6). The spec's tab shows three. If the owner wants three, X1's
   `article_poms` rows change, not this view.
5. **Should the Review tab's four unread items be shown at all?** The colour gamut, the resolution,
   the bleed and the moderation status cannot be read from a tech pack view, and they are listed as
   read somewhere else (decision 9). The alternative is to leave them off this tab and let the Export
   panel carry them alone. Showing them is the choice here, because a founder reading a checklist of
   five items would think it was F-G2's whole list.

## Rules with no entry yet

`R-GAP-000` is used for:

- every field spec F-S6 names that no rulebook rule covers: the style name, style code, brand,
  collection, season, factory, base article code, production class, fabric list and HS code of the
  Overview tab;
- every row of the bill of materials, because the rulebook's `R-COST` rules are about cost and
  `R-SUB`/`R-CON` about printing and sewing, and none of them is about a BOM line;
- a founder's own point of measure and a founder's own callout, which no rule covers because nothing
  in the pack contemplates them;
- the Review tab's "no field is waiting", "no field reads [TBC]", points-of-measure, bill-of-materials
  and moderation lines.

Every other rule id used is the rulebook's own: `R-FIT-001` to `R-FIT-007` and `R-CON-004` through
X1's point-of-measure rows, `R-CON-001` to `R-CON-009` through the construction table, `R-QC-001`,
`R-QC-002`, `R-PER-001`, `R-PER-003`, `R-LAB-001`, `R-LAB-002`, `R-SUB-001` to `R-SUB-005`.

## Files

- `apps/web/lib/techpack/view/**` — the view model: the unit toggle, the provenance chips and cells,
  the tabs, the point-of-measure table, the bill of materials, the callouts and QC, the artworks,
  colourways, personalisation and labels, the Review tab's F-G2 check, the Specs toolbar's marks,
  the assembled view and the one list of export values.
- `apps/web/components/studio/editor/techpack-view/**` — the `tech-pack` slot: the tab bar, the unit
  toggle, the chip legend, the sections and tables, the Measurements tab and the Review tab.
- `apps/web/components/studio/editor/specs/**` — the `specs` slot: the five tools, the place picker,
  the marks the two panels share and the seam a view reports a click through.
