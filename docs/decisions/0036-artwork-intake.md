# 0036: Artwork intake: the club's own files, raster and vector, never storing an SVG

Status: Accepted
Date: 2026-10-14
Plan step: production outputs, W7b (`plans/production-outputs.md`)

## Context

The platform must print any design, including the club's own uploaded artwork. The upload path that exists
(`lib/storage/image.ts`, `lib/projects/artwork-images.ts`) keeps a PNG, JPEG or WebP at 2048 pixels, which is good
for a screen and far too small to print from, and it refuses TIFF, PDF and SVG. An SVG is also the one file type a
browser will run script from, so the isolation suite insists the exports bucket never allows `image/svg+xml`. W7b
adds a second path beside the first (the old logo path is untouched and keeps working) that takes the formats
designers use, keeps a print-quality copy, and holds the line on the SVG rule.

## Decision

1. **Formats and type.** PNG, JPEG, TIFF, PDF, SVG, and AI saved with PDF compatibility (treated as a PDF). The type
   is read from the first bytes (`sniff.ts`), never from the file name or the type the browser stated. A native AI
   file (it starts `%!PS-Adobe`) is refused with: "Save it from Illustrator with 'Create PDF compatible file', or
   export a PDF or SVG." File names are used only to make a plain list label, never in a path.
2. **Raster path** (`raster/`). The size a PNG, JPEG or TIFF claims is read from its header by hand
   (`header.ts`) and checked before the image library opens the file: over 100 megapixels, over 12 000 pixels on the
   longest side, or over 50 MB is refused unopened. The pixel cap is then set again on the decoder. The picture is
   turned by its orientation note, the embedded ICC profile is applied while converting to sRGB, 16-bit is reduced to
   8, and everything else (metadata, appended data) is dropped. Two copies are kept: a **print copy** at full size as a
   lossless TIFF (deflate), read only by the print files through the asset reader, and a **screen copy** at 2048 pixels
   (PNG when it is a PNG or has see-through parts, otherwise JPEG), which a browser may be given. A print copy too big
   for the exports bucket (48 MB kept, 50 MB allowed) is re-encoded as JPEG-in-TIFF at quality 95 when it has no
   see-through parts, and refused otherwise.
3. **Vector path** (`vector/`). An SVG is never stored. A strict reader (`xml.ts`) refuses document types, entity
   declarations (so an entity bomb cannot expand), processing instructions other than the XML declaration, and any
   entity but the five XML defines. An allow-list gate (`security.ts`) then reads **every** element and attribute,
   including those the converter would skip, and refuses: `script`, `foreignObject`, `iframe`, `object`, `embed`,
   audio, video, `link`, animation elements; any `on…` attribute; any `href` that is not `#id` (or a PNG/JPEG data
   address on an `image`); `javascript:`, `expression(`, `@import`, `url()` to anything but a local id; `use` that
   points outside the file, to nothing, or round in a circle; and files over the limits (5 MB; 20 000 nodes; depth 32;
   200 000 path commands; 2 000 `use` copies; 8 embedded pictures). What survives is converted (`convert.ts`) to a
   restricted JSON model (`vector/model.ts`, Zod): absolute paths of M L C Q Z, basic shapes turned into paths,
   solid and gradient fills, strokes, clip paths, transforms, and embedded pictures re-read as pixels and re-written
   as PNG. Styles are worked out at read time (attributes, then a simple style sheet of element and class rules, then
   the `style` attribute); nothing of the original markup is kept. The model is stored as JSON (kind `artwork-vector`),
   with a PNG screen copy drawn from the model (kind `artwork`). `to-svg.ts` can draw the model back as SVG text in
   memory for a download built on request; it writes only numbers, hex colours and ids the model made.
4. **Not done in the vector path, and said so to the person.** Live text is left out with "Text in the file was left
   out. Convert text to outlines for an exact match." (the plan's "render once with a bundled font" is not built:
   Knitwright has no bundled outline font to draw it with; outlined text, which is what a designer sends to a printer,
   works). Filters, masks, patterns, markers and symbols are left out with a sentence. Reading runs in the request
   with a deadline (20 s) and hard structural limits rather than in a separate worker thread with a memory limit; the
   readers are bounded in time and memory by those limits, and a worker is a follow-up if the deadline proves too loose.
5. **PDF** (`pdf/`). **The one-day rasteriser spike succeeded** with what is already installed: `pdfjs-dist`
   6.3.289 (Apache-2.0) drawing to the canvas of `@napi-rs/canvas` 1.0.9 (MIT, Skia), which `pdfjs-dist` pulls in as an
   optional dependency. The page is drawn at 300 dpi (less if the page is large, so the picture stays within 12 000
   pixels and 90 megapixels). The reader cannot draw on a see-through background, so each page is drawn on white and on
   black and the two are combined (`matte.ts`), which gives the empty part of a page its transparency. Candidates not
   chosen: poppler in a separate process (a system program, absent on the serverless host); `sharp` itself (its
   prebuilt libvips has no PDF support). Result of the spike: PDF intake is **raster only**. Turning simple PDF vector
   content into the restricted model, as the plan allows, is not built; a vector logo should be sent as SVG, and a
   PDF logo prints sharp up to its 300 dpi page picture. Safety: a PDF with JavaScript is **refused** (found by a scan
   of the file's names, with `#xx` disguises decoded, and again inside the opened file for what compression hides);
   embedded files, launch actions, web links and form actions are **dropped** and named; annotations are not drawn;
   only the first page is read; a password-locked file is refused. Nothing from the PDF is kept but the pixels.
   - *Licence and hosting.* No new package: `pdfjs-dist` moves from devDependencies to dependencies (Apache-2.0), and
     `@napi-rs/canvas` (MIT) arrives as its optional dependency, as a native
     binary per platform (`linux-x64-gnu` and `-musl` are in the lockfile). The deployed function must include that
     binary and a working memory of a few hundred MB for a 300 dpi page. Both packages are already listed in
     `docs/launch/licences.md`.
6. **Effective dpi** (`dpi.ts`). `effectiveDpi(asset, widthMm)` is pixels over the printed width in inches, and
   `dpiWarning` gives the plain sentence with the dpi to the nearest 1, the minimum (Knitwright default 150, owner
   input P5/P14) and the widest size at which the file still meets it. A vector never warns.
7. **Colour.** CMYK, grey, Adobe RGB and Display P3 are converted to sRGB through the embedded profile, and the
   profile's own name is read from its description tag and recorded. With no profile, an RGB picture is taken as sRGB
   and a CMYK one gets the library's standard conversion; both are said in a sentence. Spot colours in a PDF become
   screen colours, said every time. Out-of-gamut warnings against a print house profile wait for P5.
8. **Transparency.** Alpha is kept. A picture with an opaque white border is detected on the screen copy and the
   person is offered "Remove the white background" (the white connected to the edge only; white inside the art stays);
   sublimation prints no white ink, so the note says white will be the fabric's own colour. A change is shown first,
   and accepting it stores a **new** artwork carrying the first one's rights confirmation; the first is untouched.
9. **Seamless tiles** (`tile/`, shared with W7d). `seamReport` measures how different the pixels are where the right
   edge meets the left and the bottom meets the top, against how different neighbours are inside the picture, and
   gives a verdict ("The repeat looks seamless." or "The repeat shows a seam.") and a 0 to 100 mismatch.
   `makeSeamless` offers offset-and-blend (a half-size shift cross-faded into the original) or 2 x 2 mirroring. The
   route shows the numbers before and after, a 3 x 3 preview and the stated limit, and stores only on accept.
   `findRepeat` finds a picture's period along each axis by autocorrelation. All deterministic.
10. **Limits and abuse.** Rate-limit keys `artworkIntake` (20 per 10 minutes) and `artworkConvert` (40 per 10
    minutes) in `lib/server/limits.ts`; at most 2 files read at once per brand (per server process); the storage quota
    of `lib/storage/quota.ts` is checked for the total of the copies before anything is written, and the database keeps
    the rule; changes to a picture are held to 16 megapixels; every upload needs the rights statement of decision 0025
    ("I own this logo or have permission to use it on garments."), asked before the file is read.
11. **Records** (migration `20261015060100_user_artworks.sql`). `user_artworks`: brand, kind (`raster` or `vector`),
    the real source format, a plain label, SHA-256 of the source and of the print copy or vector JSON, file ids for
    the print copy, the vector JSON and the screen copy, pixel size, stated dpi, colour space, profile name, alpha,
    the rights confirmation (who, when, the wording version, which must be a logo-rights version) and the warnings.
    Row level security is on, members read their brand's rows, and there is no browser write grant. The server may
    insert and delete but not update, so a stored hash stays true. The migration also adds the file kinds
    `artwork-print` and `artwork-vector` to `files_kind_check` and appends `application/json` to the exports
    bucket's types for the vector JSON. Both are **contract changes** (W0 owns them), declared on the PR; the JSON
    type is appended to whatever the bucket allows, so other migrations' types survive in any order. **`image/svg+xml`
    is not added to any bucket.** The original upload is never stored.
12. **What others import.** `lib/artwork-intake/index.ts`: `createAssetReader(admin, brandId)` (the `AssetReader` of
    W7a; a raster's print copy is the sRGB TIFF, a vector's is its JSON), `readVectorModel(reader, assetId)`,
    `vectorModelSchema` and `modelToSvg`, `effectiveDpi`, `dpiWarning`, and from `tile/`: `findRepeat`, `seamReport`,
    `makeSeamless`, `previewGrid`, `toPixels`. W3 reads user assets only through the reader; W7d imports `tile/` and
    the reader read-only.

## Evidence

Unit tests beside each module under `lib/artwork-intake/` (coverage held at 90 %). The refusals: `vector/parse-refusals.test.ts`
(script, event attributes, `foreignObject`, external references, `@import`, entity bomb, `use` outside the file,
limits) and `service.test.ts` (each refused SVG writes nothing). The bucket-reading and "no SVG is stored or served"
checks, the rights columns and row level security run against a real database in
`tests/integration/user-artworks.test.ts`, and `user_artworks` is registered in `tests/integration/isolation.test.ts`.
Acceptance cases: the 600 dpi CMYK TIFF with an embedded profile (`raster/read.test.ts`), the 72 dpi picture at 400 mm
(`service.test.ts`), the 100 000 x 100 000 PNG refused from its header (`raster/read.test.ts`), the seamy tile before and
after with the 3 x 3 preview (`convert.test.ts`), the PDF with JavaScript, plain and hidden in a compressed stream
(`pdf/pdf.test.ts`).

## Alternatives

- Storing the SVG after cleaning it: one missed case becomes a stored XSS. JSON holds nothing a browser can run.
- A third-party SVG sanitiser: a new dependency for a small allow-list, and a sanitiser keeps markup; this keeps none.
- A PDF-to-vector converter for simple PDFs: more code than the spike day allowed; the raster path is safe and sharp
  enough at 300 dpi for the sizes of a chest logo. Revisit when a club needs a vector PDF at sleeve-length scale.
- Keeping the original upload for re-processing: it would be the one file a script could hide in.
- Storing the vector JSON in the table: it can reach a megabyte; files are what the quota, deletion and the print
  files already handle.

## Consequences

- **Deletion.** Deleting a brand already sweeps each brand folder in every bucket, so these files go with it.
  Deleting a single artwork is `deleteArtwork`. W4 owns `lib/deletion/**`: the line asked of W4 on the PR is that
  account and design deletion also list `user_artworks` rows (brand cascade covers them in the database).
- **Request size.** The route accepts 50 MB. A serverless host may cap a request body lower than that; on such a host
  large files need a direct-to-storage upload, which is not built here (the same limit already applies to the 8 MB logo path).
- **Open owner inputs.** P5 and P14 (print house dpi and ICC), P17 (a paid converter for native AI files).
- **Follow-ups.** Move the old logo upload to this path (the owner of those files, nobody in the plan); PDF vector
  content; a worker thread for reading; a bundled font for live text; the screens mounted in the studio (the
  components are built and need a place from the owner of the studio shell).
