# 0008: The PDF renderer

Status: Accepted locally, deployed check owed
Date: 2026-09-29
Plan step: 7

## Context

Step 9 needs a PDF with vector flats. The plan chose `@react-pdf/renderer` 4.9 or later,
with `pdfkit` as the fallback, and asked for a spike on a deployed preview first. The
library draws only its own primitives (Svg, Path, G, Text, Image) and cannot take an SVG
string. There is no deployment yet, because the owner has not logged in to the host. So
the spike ran on this machine, in plain Node and inside the built app.

## Decision

Use `@react-pdf/renderer` 4.9.0. Draw a flat as PDF primitives from the same geometry
model that the SVG renderer uses. Keep `pdfkit` as the fallback only if the deployed
check below fails. The check is still owed.

## Evidence

What was run, on Windows 11 with Node 24.9.0, `@react-pdf/renderer` 4.9.0 (MIT) and
`pdfjs-dist` 6.3.289 (Apache-2.0, used only by tests to read a PDF back):

1. **Plain Node** (`lib/flat/pdf-spike.test.ts`). One flat drawn with a dashed stitching
   line, a callout in a registered font and a raster logo (PNG made with `sharp`). The
   result starts with `%PDF-`, has one page of 595.28 by 841.89 points (A4), and text
   extraction finds the callout. The font name is in the file, so it was embedded.
2. **The built app** (`pnpm build`, then `pnpm start`, `e2e/pdf-spike.spec.ts`). A signed in
   member asks `GET /api/flat-spike`. The answer is a valid A4 PDF with the callout text.
   One request: 8,018 bytes, 68 ms to render, 529 ms for the whole request including the
   first cold load, heap 86 MB, resident memory of the whole Next server 206 MB.
3. **A real flat** (a team jersey with raglan sleeves, zip, curved hem, side panels, cuffs,
   callouts and a picture, from `renderPdfDocument`). 12,665 bytes. First render 128 ms,
   later renders 14 to 22 ms. Resident memory of the test process about 155 MB.
4. **Both renderers draw the same things** (`lib/flat/render-pdf.test.ts`). The same
   number of paths, texts and pictures, in the same order, in every layer. A label lands
   where the model says, so the drawing origin is honoured. Text that looks like a script
   comes out as plain text.
5. **Fonts.** The font is Geist Regular, from the `geist` package. Its licence is the SIL
   Open Font License 1.1, which allows embedding in documents. The file and the licence
   text are copied to `apps/web/assets/fonts/`. The font is read from disk at run time, so
   `next.config.ts` lists it under `outputFileTracingIncludes` for the route. The build
   output for the route lists the font file, which shows the host will ship it.
6. **Under tsx** (the tool that runs `scripts/render-flat-snapshots.mts`) the library
   fails to load, because tsx resolves one of its inner packages differently. That script
   does not use the PDF renderer, and the app and the tests are not affected.

The spike route `GET /api/flat-spike` is kept for now. It is `auth: "member"`, and it is
the quickest way to run the deployed check. Remove it when step 9 adds the real export
route, and move its font entry in `next.config.ts` to that route.

## What must be run again on the first preview deployment

1. Open the preview, sign in, and request `/api/flat-spike`. It must answer 200 with
   `content-type: application/pdf`, and the file must open as a one page A4 PDF that
   shows the callout text in Geist, the dashed line and the red logo square.
2. Run `e2e/pdf-spike.spec.ts` against the preview address. Do this by setting the base
   address and keys the spec reads, or by repeating step 1 by hand.
3. Read the `x-render-milliseconds`, `x-heap-used-mb` and `x-rss-mb` headers. Record them
   here. The function must finish well inside its time limit (see decision 0002) and stay
   under the memory limit of the plan the owner chooses.
4. Check that the font file was shipped with the function. A missing font shows as an
   error about a missing file in the host log.
5. If any of this fails, switch step 9 to `pdfkit` and write a new decision that
   supersedes this one.

## Alternatives

- **`pdfkit` directly.** Draws the same primitives with more control and less weight, but
  the plan prefers React elements, which the tech pack document also uses. It stays as
  the fallback.
- **Turning SVG into PDF with a converter.** Adds a second drawing path, and the two
  outputs could drift apart.
- **A headless browser.** Too heavy for a serverless function.

## Consequences

One geometry model feeds the SVG and the PDF, so a drawing cannot differ between them.
The PDF library cannot clip a picture, so artwork is not clipped to its panel in either
output. That is a known limit. The library adds about 50 packages, which the host bundles
with the function.
