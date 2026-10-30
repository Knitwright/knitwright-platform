# 0078: The tech pack PDF as sixteen pages, the Excel file as eleven sheets, and the Export panel

Status: Proposed. The PDF and the Excel file are live through the routes that already serve them. The Export panel is built and
is not drawn by the shell yet: the shell still draws the slot placeholder, and wiring it is one import and one line in
`components/studio/editor/EditorShell.tsx`, which Y5 does not own.
Date: 2026-10-30
Plan step: `plans/platform-v5.md`, wave 2, workstream Y5. Spec: `docs/spec/02-features.md` F-S6, with
`docs/spec/articles/JSY-SS-01/techpack/JSY-SS-01_techpack.html` as the visual reference. Builds on 0011 (the exporters), 0070
(the production package), 0075 (the editor shell and the slot contract), 0077 (Y4's tech pack view).

## Context

The tech pack PDF was one long `Page` that flowed from the cover to the sign-off, in the order of `SECTION_IDS`. F-S6 asks for
something different: sixteen numbered pages in a fixed order, each with a header block (brand, style name, style number,
season, base size, version) and a footer that ends in "Page x of y"; an Excel file with one sheet for each of the eleven tabs
of the tech pack view, each carrying an "Open in Knitwright" link cell; and an Export panel with a live preview and six tabs.

Two facts shaped the work. The sixteen pages of F-S6 and the sixteen sections the platform already builds are **not** the same
sixteen: the specification splits the bill of materials over two pages and keeps personalisation apart from print placement,
and it has no page for the key that explains where each value came from, which this document needs because every value is
printed with a mark. And the Export panel is a slot (0075): it is handed the design and the commands and nothing else, and it
never fetches.

## Decision

### 1. One page plan, read by both files

`lib/techpack/exports/pages.ts` is the only place that says which part of the document belongs to which page. It holds the
sixteen pages with the specification's numbers and titles, the two pages after them, and `SECTION_PAGE`, which gives each
section its page. A section whose tables belong on two different pages names the page on the table itself: `ExportTable.page`.

`pagePlan(sections)` turns the sections into pages, and the PDF draws one `Page` for each. Every page is drawn, filled or not,
because a factory counts pages and a missing one reads as a page that was lost.

| # | Page | What fills it |
|---|---|---|
| 1 | Overview | `cover` |
| 2 | Technical flats | the two drawings with every colour and every callout taken out |
| 3 | Rendered colour views | the two drawings in the colourway the file is for, without callouts |
| 4 | Bill of materials: fabrics | the fabric table of `components`, and `fabric` (the mill's test) |
| 5 | Bill of materials: rib, thread, trims and labels | the other-parts table of `components` |
| 6 | Construction details | `construction` and `operations` |
| 7 | Construction annotations | the drawings with their callout marks, and the callout key (`flats`) |
| 8 | Measurement annotation | `how-to-measure` |
| 9 | Size grading | `measurements` |
| 10 | Graphics and prints | `artwork-and-colour` |
| 11 | Print placement | the artwork table of `artwork` |
| 12 | Personalisation | the player names and numbers table of `artwork` |
| 13 | Labels and packaging | `labelling` |
| 14 | Colourways | `colourways`, with one front drawn per colourway |
| 15 | QC checklist | `readiness` and `pattern-and-cutting` |
| 16 | Reference images | the photoreal pictures, each labelled an illustration |
| — | Sources and notes | the key of the marks, the seam and stitch classes, and the notes on single values |
| — | Still to confirm, and sign-off | `suggested` and `sign-off` (the specification's page 17, for base onboarding) |

The footer is the one the document already had — style, version, the date the copy was printed, then "Page x of y" — because
"x of y" has to count sheets of paper, and a page of the specification may run onto two.

### 2. Two pages the platform cannot fill from a design yet

`PAGE_GAPS` names them, in plain words, with `R-GAP-000`, because no rulebook entry covers either:

- **Page 7, construction annotations.** The marks the platform draws on a flat are the points of measure. Construction
  callouts numbered on the flat are not drawn yet, so the page says so and page 6 carries the construction itself.
- **Page 16, reference images.** No photograph of a sample is on file for any version yet, so the page says that every picture
  in the document is a render, not a photo.

The page prints the words and not the rule id: `R-GAP-000` means "no rule written yet", which tells a factory nothing it can
act on. The id stays in the data, for the pull request and for whoever writes the rule.

### 3. The Excel file is one sheet per tab, built from the same tables as the PDF

`lib/techpack/exports/tabs.ts` maps each page of the PDF to one of the eleven tabs of the tech pack view, so the two files are
built from the same tables and cannot disagree about a value — which is what F-S6's acceptance asks. A sheet reads in the
order of the document, not of the pages, so the measurement table comes before how it is measured.

`ExportSection.sheet` and `EXCEL_SHEETS` are gone: the tab map replaced them, and two places naming sheets would have drifted.
The flats' callout key and "How to measure" are now in the Excel file too; before, they were in the PDF only.

**The Body size chart sheet is written and empty**, with the sentence that the body size chart belongs to the base article and
is not in this document yet. Writing ten sheets where the view has eleven tabs would read as a sheet that was lost.

### 4. The "Open in Knitwright" link cell is written as text, and the caller supplies the address

`write-excel-file` writes no hyperlink relationship, and `excel/cells.ts` may not make a formula (a `HYPERLINK()` call is one),
so the link is the address itself in a cell, underlined and in link colour, which spreadsheet programs make clickable.

`buildWorkbook(pack, { openIn })` takes it, because only the caller knows which design and which version the file is of — the
tech pack holds no project id. **The download route does not pass it yet**: `lib/projects/export-download.ts` is not a file
Y5 owns. Until one line is added there, a downloaded file carries no link, and no sheet claims one.

### 5. An .xlsx file now gives the same bytes twice

An .xlsx file is a ZIP, and the writer stamped every entry with the clock, so the same design gave different bytes two seconds
later. `writeSheets` now re-stamps every entry at one fixed moment, as `lib/job-packet/zip.ts` and `lib/kpp/assemble.ts`
already did. A test moves the clock on by years and asks for the file again.

### 6. The Export panel is a slot, and every control changes the answer

`components/studio/editor/export/ExportPanel.tsx` is a default export taking `EditorSlotProps` and nothing else. Its model is
in `lib/techpack/exports/panel.ts` and `panel-outputs.ts`, so opening the panel pulls no PDF writer into the page (0011).

The preview is built from the design the slot was handed: `flatPreview` for the drawings and `modelForDraft` for the shape.
Nothing is fetched.

`outputsFor(tab, input, options)` answers with files to download, or with a plain sentence saying why there is none yet. There
is no control in the panel that a person can move without the answer moving, because a control that changes nothing is a claim
the platform cannot keep. What each tab can and cannot do today:

| Tab | What it gives | What it says instead |
|---|---|---|
| Tech pack | the PDF and the Excel file, at the version and colourway the editor shows | both files carry every section; leaving one out is coming |
| Images | the front and the back as SVG drawings, from the design itself | no side view (the garment is drawn front and back only); PNG and JPG at a chosen size are not made yet; a drawing has no mannequin and no background |
| Pattern | the pieces at full size as PDF, or as SVG, through the print-files route | the DXF is kept with the pattern, on the Pattern page; no picture of a pattern; measurements drawn on the pieces are not made yet |
| Print files | one zip of PDF and SVG per piece, for the size on the canvas or every size | — |
| Production package | — | the package is built for the factory when the order is placed, and has no download of its own yet (0070) |
| Mockups & media | a way through to the marketing media screen | mockups are made there until the launch studio lands (wave 4) |

### 7. The gate on export belongs to the Review tab

`lib/techpack/exports/review-gate.ts` holds `exportGate(review)`, a function of what the Review tab reports. While the Review
tab asks for anything, or a finding blocks the design, the panel offers **no address at all** — not a disabled button with a
link in it. There is no way round the gate in the panel, and the panel cannot declare a design clear on its own.

Y4 owns the Review tab, and the slot contract hands a panel the design and not the tech pack, so `reviewFromDesign` reports
only what the editor itself knows: the drafter's findings about the form. It sets `reviewed: false`, and the panel says so in
words — "The Review tab has not checked this version yet, so these files carry whatever the tech pack carries, including
anything still to be confirmed." It never claims the design is clear.

## What this does not do

- It does not wire the panel into the shell, or pass the Excel link address from the download route: both are files Y5 does
  not own. Each is one line, named on the pull request.
- It does not let a person leave a section out of the PDF or the Excel file.
- It does not make a PNG, a JPG, a side view, a DXF, a picture of a pattern, or a production package download.
- It does not touch `lib/techpack/view/**` (Y4's) or any other `components/studio/editor` panel.

## Owner questions

1. **Does a factory want "Page 4 of 16" in the header as well as "Page x of y" in the footer?** The header carries the page's
   title only today, because a number a factory cannot check against the document is a number the document should not state.
2. **Should pages 2 and 3 be the same two drawings twice?** Page 2 is the technical flat with no colour, page 3 the same two
   views in the colourway. For a garment whose only colour is in the fabric, the two pages differ very little.
3. **Who numbers the construction callouts on the flat?** Page 7 is the specification's "numbered callouts on the flat", and
   the platform has no construction callout marks — only the lettered points of measure. A factory's numbering convention
   would settle it.
4. **Is the Body size chart sheet wanted empty, or left out until the base article carries one?** The sheet is written with a
   sentence today, so a factory finds eleven tabs where the screen shows eleven.
5. **Which image sizes does a factory or a marketplace actually want?** 600, 1200 and 2048 pixels on the longest side are
   labelled defaults, with 1200 marked recommended as the specification's example does. No factory has asked for any of them.
