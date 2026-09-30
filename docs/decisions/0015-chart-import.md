# 0015: A brand's own size chart, imported from a spreadsheet

Status: Accepted
Date: 2026-09-29
Plan step: 25

## Context

Decision 0006 left brand charts unstored: "Charts owned by a brand are not stored yet.
That comes with the import in step 25." A design stores only its base-size values, so a
chart with a value for every size cannot live in a design. There was no write path for
charts to reuse.

## Decision

1. **A brand's chart is stored in `public.brand_size_charts`**, one row per brand, wearer,
   garment type and fit (`any` for every fit), holding the `SizeChart` and `SizeRun` of
   `lib/sizing` as JSON. Members read their brand's rows. Only `replace_brand_chart` writes,
   run by the server's key, and it checks membership with `private.belongs_to`, the same
   check `append_spec_version` makes. A new import for the same key replaces the old row.
2. **The file goes through the step 3 upload helper.** `storeChartFile` in
   `lib/storage/store.ts` shares the write-and-record code with `storeImage`. Files are kind
   `chart` in the `uploads` bucket, which now accepts `text/csv` and `.xlsx`. The kind is
   judged from the bytes. The file is read before it is stored, and again from storage
   with the user's own rights when it is imported.
3. **Reading.** `.xlsx` with `read-excel-file` 9.3.10, pinned, as the ledger records for
   step 9. Numbers are kept as the text stored in the file (`parseNumber` returns the text),
   so no floating point touches them. A formula cell gives the result the spreadsheet stored;
   no formula is ever worked out. CSV with the existing `lib/sizing/csv.ts` parser, which is
   tested for quoting. Every cell is text; a value is read by `parseCm`, which refuses a cell
   starting with `=`, `+`, `-` or `@`.
4. **Limits**, in `lib/charts/limits.ts`: 512 KB file, 100 rows, 40 columns, 100 characters
   a cell. Before a spreadsheet is unpacked its zip table of contents is read: at most 200
   parts, 8 MB unpacked, and no part over 64 KB may grow more than 200 times.
5. **Mapping.** The person chooses the heading row, the point of measure column, the size
   columns (smallest first), the tolerance column, the base size, and names the person who
   produced the numbers (the chart source needs a real name; the date is the day of import).
   Rows are matched to points by id or name; an unrecognised row must be given a point or
   left out, otherwise the file is refused.
6. **Validation against the registry.** A row for a point the garment cannot have is
   refused. A file without a row for every point that **every** garment of the type has
   (`pointsAlwaysApplying`) is refused, and the message names each missing point. Points that
   apply only with some choices (a jersey's shoulder width, collar, placket) may be left out;
   a design with that choice then shows the value as missing.
7. **Values from the chart are `brand-supplied`.** `SizeChart` gains an optional
   `supplier` (`platform` or `brand`). Resolution gives chart values the chart's provenance,
   and the tech pack gives tolerances and chart sizes the same. Grade steps are the exact
   differences between adjacent sizes; a value that gets smaller as sizes go up is refused.
8. **A brand chart takes the place of every platform chart for the same wearer and garment
   type** (`withBrandCharts`), whatever their fit, so a design never mixes the two. The
   editor, the tech pack page and new designs load the brand's charts.

## Evidence

| Claim | Test |
|---|---|
| A valid file replaces the chart | `tests/integration/chart-import.test.ts` (imported twice, one row, second file's sizes) |
| A file missing a point is refused with its name, and the chart stays | same file; `lib/charts/mapping.test.ts` |
| Imported values resolve as `brand-supplied` | same file; `lib/sizing/brand-charts.test.ts`; `lib/techpack/brand-chart.test.ts` |
| Values checked against the registry | `lib/charts/mapping.test.ts` |
| Formulas are never worked out | `lib/charts/read-sheet.test.ts`, `lib/charts/mapping.test.ts` |
| Quoting, limits, hostile zip | `lib/charts/grid.test.ts`, `lib/charts/container.test.ts` |
| Only members of the brand import; browsers cannot write | `tests/integration/chart-import.test.ts`, isolation suite |

## Alternatives

- Import into a single design: the spec keeps base-size values only, so every other size
  would be lost, or the spec schema would need a new version. Refused.
- SheetJS or exceljs for reading: refused in step 9 for open advisories.
- Unpacking with a byte-capped inflater of our own: more code. The table of contents check
  catches ordinary zip bombs; an archive that lies about its sizes is still limited by the
  512 KB file cap. Revisit if uploads open to the public (step 26).

## Consequences

- Charts can be replaced but not removed yet, and no history of charts is kept beyond the
  stored files.
- Inches are read as well as centimetres since 2026-09-30 (owner decision): chosen on the mapping
  screen or per row in a units column, stored in centimetres to the nearest tenth of a millimetre
  (`lib/charts/units.ts`). Any other unit is refused.
- The shared local database also holds tables of other branches, so the isolation suite's
  "every table" checks fail there until the branches are integrated.
