# 0036: Artwork intake: what we store, what we never store, and how PDFs are read

Status: Proposed
Date: 2026-10-14
Plan step: production outputs, W7b (`plans/production-outputs.md`)

## Context

A club must be able to give us its own artwork and have it printed well, or be told plainly why not. Uploaded files are the largest attack surface the app has taken on: an SVG can run script in a browser, a PDF can carry JavaScript and attached files, a small PNG can open into gigabytes of pixels, and an XML file can expand through entities. The older logo path (`lib/storage/image.ts`) keeps only PNG, JPEG and WebP up to 8 MB and 2048 pixels, which is right for a screen and far too small to print from. Decision 0035 gave the artwork stack an `AssetReader` interface and left its implementation to this step.

## Decision

1. **The type is read from the first bytes** (`sniff.ts`): PNG, JPEG, TIFF, PDF (header in the first kilobyte, so an Illustrator file saved with PDF compatibility is a PDF) and SVG. A native Illustrator file (PostScript) is refused with the sentence that says how to save it. The file name and the type the browser stated are never used.
2. **Pictures** are opened under a pixel cap read from the header before any decoding (100 megapixels, 12 000 px longest side, 50 MB file), turned upright, converted to sRGB with the embedded profile (CMYK, grey, Adobe RGB and Display P3 included) and reduced to 8 bits. Two copies are stored: a **print copy** as a lossless TIFF with the sRGB profile (kind `artwork-print`, bucket `exports`) and a **screen copy** of at most 2048 px (kind `artwork`, bucket `uploads`). Neither keeps metadata or appended data. If a print copy would not fit the bucket's 50 MB, it is reduced step by step and the record says so.
3. **Vectors** (SVG, and PDF pages) are never stored as given. They are read with a strict allow-list into a restricted vector model (`vector/model.ts`): `g`, `path` and `image` nodes, solid and gradient fills, strokes, clip paths, transforms. It is stored as JSON (kind `artwork-vector`, bucket `exports`, type `application/json`) with a PNG preview. The model has no way to say script, link, font, filter or style. **No SVG is ever stored in any bucket**, and the exports bucket never allows `image/svg+xml`; `vectorToSvg` builds SVG text from the model only for the preview and for a download built on request.
4. **Refused outright** for SVG: script, event attributes, `foreignObject`, frames, objects, media, animation, any reference outside the file (including `@import`, `url()` and `href` to anything but `#id` or a PNG or JPEG data address), entity and document type declarations, `xml-stylesheet`, files over 5 MB, more than 20 000 elements, 200 000 path commands, nesting over 32, `use` nesting that expands past the element limit, and a read that takes over 5 seconds.
5. **Text** in a vector is left out and flagged ("Convert text to outlines for an exact match"). The plan asked for it to be drawn once with a bundled font; that is not done (open item below).
6. **Every lookup behind the `AssetReader` names the brand** (`asset-reader.ts`): the artwork row by id **and** brand, and each of its files by id **and** brand. Another brand's asset, a missing one and a malformed id all give null. A row cannot be made to point the reader at another brand's file.
7. **Records**: `user_artworks` (migration `20261015060100`), brand-scoped, row level security, members read, only the server writes. File kinds `artwork-print` and `artwork-vector` and the bucket type `application/json` are added by the same migration (a **contract** change: W0 owns the kind list and bucket types). The upload's SHA-256 and the print copy's SHA-256 are kept; the upload itself is not.
8. **Effective dpi** is `pixels / (printed width in inches)`, worked out for each placed picture from the stack and the print scale. Below 150 dpi (a "Knitwright default, not from your print house" setting; open items P5 and P14) the warning says the dpi to the nearest whole number and the widest size at which the file still meets the minimum. A vector never warns.
9. **Tiles** (`tile/`, shared with W7d): the step across the repeat is compared with the picture's own biggest steps, so a stripe edge that belongs to the picture is not a seam. "Make it seamless" is offset-and-blend or 2 x 2 mirroring, shown 3 x 3 with the number before and after, and saved only on request as a new artwork that remembers its source. `findRepeat` finds a period by autocorrelation.

## The PDF rasteriser spike (one day, as the plan asked)

Candidates and what was found on 2026-10-14:

- **sharp (libvips)** has no PDF input in its prebuilt binaries (`sharp.format.pdf.input` is false).
- **poppler in an isolated worker** needs a system binary the serverless runtime does not have, so it is not available where this app is hosted.
- **`pdfjs-dist` 6.3.289** (Apache-2.0, already in `docs/launch/licences.md`) runs in Node and can read a page's drawing instructions without a canvas. It cannot paint a page in Node without a native canvas package, which would be a new dependency.

Result: a PDF's first page is read through pdfjs's operator list into the vector model when its content is simple vector (paths, solid colours, strokes, clips, forms). Pictures, shadings and pattern fills cannot be rasterised, so such a PDF is **refused with a sentence that says to export a PNG at print size or an SVG**. This is the plan's fallback ("raster-only for PDF if the spike fails") taken one step further, because there is no way to rasterise either. The reader never runs a script, action or form, ignores attached files, and says so when it finds them. To accept more PDFs later, add `@napi-rs/canvas` (MIT, prebuilt binaries) and rasterise at the dpi the placed size needs; that is a dependency decision for the owner.

Hosting constraint: `pdfjs-dist` loads its own worker file at run time, so it moved from `devDependencies` to `dependencies` and is listed in `serverExternalPackages` in `next.config.ts`. A production build was made to confirm the route builds with it.

## Evidence

- `lib/artwork-intake/**/*.test.ts`: refusals for a script, `onload`, an external `href`, a foreignObject, an import, an entity bomb and a `use` bomb; a clean SVG logo stored as JSON plus a preview with the drawing read back as pixels; a 600 dpi CMYK TIFF becoming an sRGB print copy with the profile named; a 100 000 x 100 000 pixel PNG refused from its header; the 64 dpi warning for a 1000 px picture at 400 mm; a tile's mismatch before and after; a PDF with JavaScript read, the script dropped and the sentence shown.
- `tests/integration/artwork-intake.test.ts` and the `user_artworks` entry in `tests/integration/isolation.test.ts` (run in CI against local Supabase): the buckets never allow SVG, an SVG written straight to a bucket is refused, a hostile SVG leaves the file table and the buckets unchanged, a clean SVG leaves no SVG anywhere, and another brand's asset is not found.

## Alternatives

- Sanitise the SVG and store it: any sanitiser bug becomes stored XSS. A model with no markup in it has no such class of bug.
- Store the original upload: it would carry whatever was hidden in it. The hash is kept instead.
- Upload straight from the browser to storage (needed for files over the platform's request limit): the server checks every upload today, so this is a larger change.

## Consequences

Easier: W3 draws one model from one reader; a design can use a logo, a full-panel picture or an all-over tile the same way. Harder: a vector with live text loses the text until it is outlined; a PDF with a picture in it is refused. Open items:

- **Text in vectors** is not drawn (no bundled font is wired in; `assets/fonts/Geist-Regular.ttf` exists for the PDF export).
- **The reader runs in the server process**, not a worker thread: no worker entry file is bundled by this Next.js build, so the limits (bytes, elements, depth, commands, time) are checked cooperatively. The reader holds no file or network handle. Move it to a worker if the bundler allows.
- **Request size**: the route accepts 50 MB, but a serverless host may cut a request body well below that. A larger upload needs a signed upload straight to storage.
- **Conversions in flight per brand** are counted per server process.
- **A browser can ask for the print copy's file by id** through the existing download route (`lib/storage/links.ts`, not owned here); it is the brand's own file.
- **Deletion**: `lib/deletion/**` (W4) must include the `artwork-print`, `artwork-vector` and `artwork` files of a brand's artworks. Brand deletion already cascades through the foreign keys; deleting a single design does not touch artwork, which belongs to the brand.
- Spot colours and overprint in a PDF are not honoured; out-of-gamut warnings wait for the print house profile (P5).
