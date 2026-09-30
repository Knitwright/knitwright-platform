# 0011: Exports: PDF, Excel and SVG

Status: Accepted locally. The deployed check of decision 0008 is owed.
Date: 2026-09-29
Plan step: 9

## Context

A design has a tech pack document (decision 0010) and drawings (decision 0009). Step 9 turns them into
three files a factory can open: a PDF, an Excel file and one SVG drawing for each view. The plan says the
files are built when they are asked for and are not stored, that every Excel cell is a typed value and
never a formula, and that each download is recorded with its version. The files must hold nothing the
document does not hold, and no value may reach a file without its source.

## Decision

1. **One route, three formats.** `GET /api/projects/[projectId]/exports/[format]`, with `format` one of
   `pdf`, `xlsx` or `svg`. The query takes `view` (`front` or `back`, required for an SVG and refused
   for the others), `version` (a whole number from 1 to 100,000, the current version when missing) and
   `colourway` (as on the tech pack page). It is wrapper output with `auth: "member"`, so a session and a
   brand are checked first, and the id is checked as a uuid. A design of another brand, and a version the
   design does not have, answer "not found", the same as the page. The route file sets `maxDuration = 60`
   (decision 0002). The rate limit is `LIMITS.export`: 30 in ten minutes for each address and each user,
   the scale of an upload, which lets a person download the four files seven times.
2. **Built in memory, sent once, never stored.** The order is fixed: load the design, build the file,
   record the download, send. If the download cannot be recorded, the answer is an error and no file is
   sent. Nothing is written to disk or to storage. "Streamed" in the plan means "not stored".
3. **The screen and the files come from the same reads.** `loadTechPackSource` in `lib/projects` reads a
   version, its history and its pictures, and `buildPackFor` makes the document. The page and the route both
   call them, so a file cannot disagree with the screen. The export code is never imported by
   `lib/techpack/index.ts`, so the page bundle holds no PDF or Excel library (checked in the built output).
4. **Every format is made from the same plain tables.** `lib/techpack/exports/tables.ts` turns the document
   into tables: text, and cells that keep their source. The PDF and the Excel file are both written from
   them, so they cannot disagree about what a section holds. A test checks that every cell of the
   document is in the tables exactly once.
5. **A last guard.** Before any file is written, `assertEverySetCellHasSource` walks every cell with
   `allCells`. A set cell with no value or no known source, a missing cell that holds anything, a number
   that is not finite, and a value outside a cell all stop the export. The types already forbid these, so
   a failure means a bug. It is logged and the person sees the general message.
6. **Excel.** The writer is `write-excel-file` 4.1.1 (import from `write-excel-file/node`), and the reader
   used only in tests is `read-excel-file` 9.3.10, both pinned exactly. In this writer any plain object in
   the data is a cell, and a cell of the type "Formula" becomes a formula. So every cell is made by five
   small functions in `excel/cells.ts`, and no code passes an object from the design, the user or the
   database through as a cell. Text is a String cell in the text format (`@`). A length is a Number cell
   in centimetres (`tenthsMm / 100`, format `0.0#`) with the unit in the header. Any other number is a
   Number cell with its unit in the header, and a number whose unit differs from its column stops the
   export. The source of every value is in the cell directly beside it, in words. A missing value is the
   words "To be confirmed" with an empty source cell. There is one sheet for each section that holds values
   (Cover, Measurements, Components, Construction, Colourways, Artwork, Labels and packing, Suggested values,
   Sign-off). A sheet holds its tables one under another with a blank row between, each with a bold
   heading and a bold header row. The rows down to the first header row stay in view. Column widths fit the
   text within a least and a most. Sentences of a section are under its tables.
7. **PDF.** A4 portrait, `@react-pdf/renderer` through `createElement`. Every one of the eleven sections
   starts with its title as text. The flats are drawn as vectors by `renderPdf`, front and back, and start a
   page of their own. Each value is printed with its source in words. A missing value prints "To be
   confirmed" in the attention colours. A proposal prints its caveat words. The footer of every page names
   the design (and the style number), the version and the date, and says "Page X of Y". A table that runs
   onto another page repeats its header row, and a row is never split. A table or a section that is well
   under a page is kept whole, judged by an estimate of its height (`pdf/keep.ts`), so a heading is not left
   alone at the foot of a page and no node taller than a page is cut off.
8. **Characters the font lacks.** Geist has no Chinese, Japanese, Arabic or emoji. Found by test: a
   character the font lacks does not throw, but it is drawn as the wrong glyph and garbles the letters
   after it. So every string that goes into the PDF is first made of characters the font has (read from
   the font's own character map). A line break becomes a space, a control or invisible mark is dropped,
   and any other missing character shows as a question mark. When one was replaced the cover says so.
9. **SVG.** The output of `renderSvg` for the one view asked for, with the callouts of the tech pack, its
   named layers and an XML declaration. A garment type with no drawing is "not found" with its sentence.
10. **Headers.** Every response has `content-type`, `content-disposition: attachment`, `cache-control:
    no-store`, `x-content-type-options: nosniff` and `content-length`. An SVG also has
    `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox`. The
    route sets every header itself, because `defineRoute` passes a raw response through unchanged.
    Found in the browser tests: a header set in `next.config.ts` wins over the same header set by a route
    handler, so the app-wide policy replaced the sandbox. `next.config.ts` therefore sets the sandbox
    policy (with the app-wide framing rules) for every response of the export route, in a rule placed
    after the rule for every path, since the later rule wins. `tests/architecture/next-config.test.ts`
    checks the order and every part of the policy; the browser test checks the header that arrives.
11. **File names.** A pure function makes them from the style number (or the design name), the version
    and the kind: `KW-001-v3-tech-pack.pdf`, `KW-001-v3-front.svg`. The plain name keeps only letters,
    digits, hyphen and underscore, is capped at 60 characters in its name part and falls back to `design`.
    A `filename*` in UTF-8 form keeps the original words, without control or direction marks, path
    characters or the characters Windows forbids. The browser saves under that name, so a space in a design
    name stays a space.
12. **Downloads are recorded** in `public.export_downloads`: the brand, the design, the version, the
    format, the view (for an SVG only), the user and the time. It follows the projects tables. Row level
    security lets a member of the brand read it and nothing else. No browser role may insert, update or
    delete. One `security definer` function, `record_export_download`, takes the user id, checks that the
    user belongs to the design's brand and that the version exists, and only the server's own key may run
    it. A trigger refuses to change or remove a row, or to empty the table, except when the design itself is
    deleted. The isolation suite lists the table, so its cross-brand checks run on it.
13. **Pictures for print.** A second, larger shrink: the longest side is at most 1600 pixels, at most eight
    pictures, three read at a time, and 4 MB of pictures in one export. These are provisional engineering
    limits (`exports/limits.ts`), not garment data, and a question about print resolution is in
    `OWNER-QUESTIONS.md`. A picture over a limit is drawn as the dashed box and each file says so in words.
14. **The font is shipped with the route.** `next.config.ts` lists `./assets/fonts/**` under
    `outputFileTracingIncludes` for the export route, as decision 0008 requires. A test fails if the entry
    is missing or names another route, and the built output was checked to hold the font file.
15. **The screen.** The tech pack page has a "Download" section with four buttons: PDF, Excel, SVG front
    and SVG back. Which address each calls, the name a file is saved under, what a failure says and the busy
    state are pure functions in `lib/projects/download-controls.ts`. The component holds markup and wiring.
    A press is announced ("Preparing the PDF. This can take a few seconds."), the others wait, and focus
    returns to the button. A failure is a plain sentence. There is no green "success" tone.

What had to be added to the rulings:

- `getProjectAt` reads a design at a named version. `getProject` calls it, so the page behaves as before.
  It also returns when that version was saved (`versionSavedAt`), which dates the document.
- The name, the style number and the season on a document are the design's current ones, also for an older
  version: they are not versioned, because a factory needs the style number in use now.
- The Excel file has stacked tables on each sheet, with the frozen rows counted to the first header row.
- The tests of the PDF are their own vitest project, run after the others (see the consequences).
- `record_export_download` has no foreign key to `spec_versions`, because such a key makes emptying that
  table fail with a different message from the one its own lock gives (found when the owner-level test
  failed). The function checks the version instead, and is the only way a row is written.

## Evidence

| Claim | Test |
|---|---|
| Text extraction finds every section title in the PDF, empty and full, for every tops type, and the PDF library gave no warning | `lib/techpack/exports/pdf/sections.test.ts` |
| The Excel file read back equals the document: every cell, its value and its source, numbers as numbers | `lib/techpack/exports/excel/workbook.test.ts` |
| Text that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is stored as text, read back as the same string, and no worksheet holds a formula element | `lib/techpack/exports/excel/workbook.test.ts`, `excel/cells.test.ts` |
| No value is in the PDF, the Excel file or the SVG without its source, for designs made by random changes | `pdf/sources.test.ts`, `excel/workbook.test.ts`, `guard.test.ts` |
| Changing one measurement changes the PDF text, the Excel cell and the SVG, to the same value | `lib/techpack/exports/formats.test.ts` |
| The files hold no digit that the document does not hold, apart from page numbers | `lib/techpack/exports/formats.test.ts` |
| One full design exports in every format well inside 30 seconds | `lib/techpack/exports/formats.test.ts` |
| A last guard refuses a document with a value that has no source, in every format | `lib/techpack/exports/guard.test.ts` |
| A character the font lacks cannot throw or garble the text around it | `pdf/glyphs.test.ts`, `pdf-text.test.ts` |
| A long table repeats its header row on every page and never splits a row | `pdf/parts.test.ts` |
| The download is recorded with the version, the format and the view, and nothing is sent if recording fails | `lib/projects/export-download.test.ts`, `export-record.test.ts`, `tests/integration/export-downloads.test.ts` |
| Another brand's design is not found and nothing is recorded, and a visitor with no session is refused | `e2e/exports.spec.ts`, `e2e/unauthenticated.spec.ts` |
| The new table is covered by the cross-brand checks, and its rows cannot be changed even by the owner of the table | `tests/integration/isolation.test.ts`, `tests/integration/export-downloads.test.ts` |
| File names and headers, with hostile names | `file-names.test.ts`, `headers.test.ts`, `e2e/exports.spec.ts` |
| The export route traces the font folder, and the test fails when the entry is removed | `tests/architecture/next-config.test.ts` |
| The page and the route read the same version the same way | `tests/integration/tech-pack-load.test.ts`, `lib/projects/tech-pack-data.test.ts` |
| A member signs in, makes a design, downloads all four files under the right names, and the first bytes and the design name are right | `e2e/exports.spec.ts` |
| The four buttons are named, reachable by keyboard, announce that they are busy and say why a download failed | `lib/projects/download-controls.test.ts`, `e2e/exports.spec.ts` |

## Review

The step 9 review found these. Each outcome is in the fix commit that follows the step.

| Finding | Outcome |
|---|---|
| M1: a version older than the newest 100 took the day the design last changed as its date | Fixed. `getProjectAt` returns the saved time of the version it read, and the document uses it. Tests: `tech-pack-data.test.ts`, `tests/integration/project-service.test.ts` |
| M2: the name, style number and season of an older version are today's | Kept, as a ruling: they are not versioned, because a factory needs the current style number. Written under "What had to be added to the rulings" |
| M3: the exports lack the note that pictures were left out | Not a fault. The page's sentence is not part of the document, so `buildPackFor` does not take it; the PDF prints `PICTURE_LEFT_OUT` in the flats and artwork sections, and the SVG holds it as a comment, whenever a picture was left out. The Excel file holds no pictures, so it has nothing to leave out. A test now checks that the export tells the PDF so (`export-download.test.ts`) |
| L4: the last guard ran twice for each request | Fixed. The call in `serveExport` is removed. Each writer keeps its own call, since the guard's test (R14) holds every writer to it. A test checks it runs once per request |
| L5: `downloadResponse` copied the bytes a second time | Fixed. The writers return bytes on their own buffer, so the response takes them as they are |
| L6: an unreachable `view ?? "front"` and an empty `Built` wrapper in `export-download.ts` | Removed. A drawing with no view is now refused as invalid input rather than drawn as the front |

## Alternatives

- **`exceljs` 4.4, the plan's choice.** Rejected. It has had no release since 2023 and two unfixed
  vulnerabilities were published against it in August 2026 (this was found by the lead before the step and
  was not checked again here).
- **SheetJS.** Not chosen. It was not evaluated in depth: the writer we picked was small, typed, kept
  current, and had a reader of the same family to test it with.
- **Writing the files by hand** (a zip and the XML). More code to keep correct, and it would still need
  the same care against formulas. Rejected.
- **Converting the SVG to a PDF with a tool.** Already rejected in decision 0008.
- **Storing the files** so a second download is a fetch. It would use file storage the free tier has little
  of, and a stored file could be out of date. Rejected by the plan.

## What is owed

- **The deployed check of decision 0008.** This step adds the export route that the check needs, and
  this machine cannot run it, because nothing is deployed. On the first preview: sign in, download a tech
  pack PDF for a design with a flat, and see that it answers 200 with `content-type: application/pdf` and
  opens as an A4 document with the dashed stitching, the callouts in Geist and any logo. Look in the host
  log for a missing font file. Record the render time, the heap and the resident memory of the function,
  and compare them with decision 0002 and the plan of the host. If it fails, switch to `pdfkit` and write
  a decision that replaces 0008 and this one.
- **Print resolution, the Excel contents and the file names** are questions for the owner: see
  `apps/web/lib/techpack/OWNER-QUESTIONS.md`, questions 14 to 19.
- **Nobody can see the record of downloads yet.**
- **The Excel file was opened only by a reader library.** No spreadsheet program opened it.

## Consequences

- Every export builds its file in memory. A PDF of a full design takes about one second of processor time
  on this machine and about 45 KB. Memory on a small host function has not been measured.
- Making a PDF is the slowest thing the tests do. With every test file running at once, a PDF test took
  five times as long as it does alone and ran past the five second wait. The wait was not raised. The PDF
  tests are a separate vitest project (`pdf`) that runs after the others, one file at a time. For that,
  the three projects have different group orders, which also means the database tests no longer run at the
  same time as the unit tests. `pnpm test` runs the `unit` and `pdf` projects.
- A character the PDF font lacks shows as a question mark. Chinese, Japanese and Arabic text in a design is
  therefore not readable in the PDF. The Excel file and the SVG hold it as typed.
- The SVG opens with an XML declaration, and its layers are those of `LAYERS` in `lib/flat/model.ts`.
- `export_downloads` grows by one row for each download. There is no cleanup and no way to see it yet.
