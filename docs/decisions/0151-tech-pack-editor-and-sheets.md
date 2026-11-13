# 0151: The tech pack editor and the eight exported sheets

Status: Accepted (plan v6 G2)
Index: Accepted; the Tech pack view is one self-contained editor (seven tabs, mm/cm/in, points and callouts on the garment, Check fit, Preview sheets) mounted on `/studio/<id>/tech-pack` above the factory file and as the editor's Tech pack slot; v2.2's Colourways, Personalisation, QC and Review fold into the seven; the eight-sheet .xlsx is `xlsx?layout=sheets` on the existing export route
Index title: Tech pack editor and sheets
Date: 2026-11-13
Plan step: v6 wave 4, G2. Builds on 0077 (tech pack view), 0078 (sixteen pages, eleven sheets), 0121 (marks kept on the design), 0144 (plans, preferred unit), 0148 (tech pack board). No migration.

## Context

Spec `09` screens 30 and 31, `08` v3.7, references s08–s15 and x01–x08. v5 built the tech pack view with eleven tabs
(`lib/techpack/view`, 0077) as the editor's Tech pack slot, and the factory file at `/studio/<id>/tech-pack` with
its forms, downloads, pattern and quote. v3.9 shows seven tabs, a stage with red points and blue callouts, and a
spreadsheet preview of an eight-sheet workbook. G1 builds the Garment Studio frame and its 2D / 3D / Tech pack
switch in parallel.

## Decision

1. **One self-contained editor** (`components/techpack-editor/TechPackEditor.tsx`). It takes a design, its base
   article and a header, fetches nothing, and draws the stage and the panel from `buildTechPackView`, so the panel,
   the preview and the .xlsx carry the same numbers. It is mounted twice:
   - on `/studio/<id>/tech-pack`, above the factory file (`TechPackDocument`'s new `editor` slot), saving through
     the page's `TechPackEdit` queue. The address, the factory file, its forms, downloads and every e2e spec on it
     are unchanged. `?tab=<id>` opens a tab (a v2.2 tab name opens the tab it folded into), so G1's switch and E4's
     tech pack board can link to `/studio/<id>/tech-pack` and land on it;
   - as the editor's Tech pack slot (`components/studio/editor/techpack-view/TechPackView.tsx`), saving through
     the shell's `save`, with a link to the page.
2. **Seven tabs, nothing lost** (`lib/techpack/editor/tabs.ts`). The eleven view tabs fold into the seven:
   Colourways → Materials, Personalisation → Artworks ("Names & numbers"), QC → Measurements ("Quality control",
   🔒), Review → Overview ("Still to fill", with Go to links). A test proves every section of the eleven is drawn
   exactly once. The Measurement | Grading toggle, "+ Add measurement", the "Why?" on a rule and the provenance
   counts are kept. The v2.2 slot components (`MeasurementsTab`, `ReviewTab`, `Sections`, `Chips`) are removed;
   the old Auto-map button, which had no action, is not carried over.
3. **🔒 rows** (`qc-only.ts`): the sample size, the factory and the whole QC part are Knitwright QC's. They draw a
   lock with "Only Knitwright QC edits this", and an empty one reads "Set by Knitwright QC", never a question.
4. **Measurements** come only from the base article (`buildMeasurements`): XS–3XL, the sample size M, one "Tol ±"
   column (both ends when uneven, nothing when the article gives none). The size picker on the stage changes the
   highlighted column. **Check fit** (`fit.ts`) reads the graded run: a value at every size, linear points growing,
   fixed points still, a tolerance on file. It measures nothing.
5. **The stage** (`stage.ts`) draws a front view in a 400 × 480 box. Points are placed by article code (`CH`, `BL` …)
   or a word of the description; one neither names is listed as "not drawn", never put somewhere it is not.
   Callouts number like the Callouts tab: the article's construction, then the founder's own. "Add callout on the
   3D view" places one where the garment is pressed and saves it as the existing `set-callout` action, its point
   stored with panel id `stage` in stage units (0121's mark shape, unchanged). It is a schematic front view, not
   the three.js model: the model needs the editor's draft and has no anchors to hang a letter on; G1's 3D stage
   can draw the same `stagePoints` / `stageCallouts` when it has them.
6. **The eight sheets** (`sheets.ts`, `workbook.ts`): Overview (+ still to fill), Colourways, Measurements (points +
   QC), Size chart (graded chart + body chart), Callouts, Materials, Artworks (+ names & numbers), Labels, each
   under the shared header (brand, product detail, title, Open in Knitwright). The preview modal and the file are
   built from the same blocks. The file is the existing export route's `xlsx?layout=sheets` (decision 0078's
   eleven-sheet workbook stays the default), recorded and named like any Excel export, written by the existing
   `writeSheets` (text cells only, same bytes for the same design).
7. **♛** (`plan.ts`): Download .xlsx and PDF in the preview open "Upgrade to export tech packs" while the current
   plan's `techPackExports` is 0 (P6's plan data; every brand is on Free until C1). The factory file's own
   downloads are not gated, as before.

## Consequences

- `components/techpack-editor/` joins `components/techpack/` in the client-weight test's second pass: it redraws the
  view in the browser, which needs the garment rules.
- `/dev/tech-pack` shows every tab, `?unit=in`, `?sheet=<id>`, `?bare` and `?plan=paid` with made-up data.

## Owner questions (defaults chosen)

1. Both downloads in the sheets preview are ♛ (spec `08` v3.7), while the factory file's downloads stay free. Default:
   keep both as they are until C1 brings real plans.
2. The body size chart (s09) is not in the catalogue; the Body tab says so rather than inventing one. Default: wait
   for the factory's chart.
3. The style code is spec F-S6's `<BRAND>_<NAME>`, not the design's style number. Default: unchanged.
