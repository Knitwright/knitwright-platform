# 0054: Media sets, studio renders and watermark

Status: Proposed
Date: 2026-10-27
Plan step: plans/platform-v4.md, workstream W3-A. Builds on 0018 (photoreal images), 0044 (credits ledger) and 0051 (credit gates).

## Context

Spec stage 4 makes marketing media from a design: studio renders now, lifestyle images, a turntable and a clip later (wave 3, stage 2).
Media costs credits, so until credits are spent a person may see a picture but must not be able to get the clean file.

## Decision

1. **Contract** (`lib/media/contract.ts`, Zod). `MediaKind`, `MediaView`, `MediaItem`, `MediaSet`, plus `MediaGenerator`
   (`generate(request, signal)` returns pictures or a sentence) and `MediaProvider`. Stage 2 adds generators; nothing here changes.
   A generator returns clean PNGs; the set watermarks and stores them, so no generator can forget to.
2. **Tables** (`20261027010000_media.sql`): `media_sets` (unique on brand, project, version hash), `media_items` (unique on set, kind,
   view) and `media_set_history` (append-only, same rule as the credit ledger). Members read their brand's rows. The server's key has
   SELECT only; every write goes through `media_set_start`, `media_set_move`, `media_item_put` and `media_set_unlock`, which only
   `service_role` can run. No foreign key into another workstream's table: a design is a project id and a version number.
3. **Studio renders** (`lib/media/studio.ts`). Front and back reuse `renderReference` from `lib/images` (the design's own render);
   the flat lay is the front flat on a neutral surface (`#e6e4e1`) with a soft shadow, 1536 by 1024. Same version, same bytes (tested);
   no date or random value is used. Three-quarter and turntable are not attempted (no GPU on the server).
4. **Protected regions.** `lib/media/regions.ts` finds the crest, sponsor pictures, names and numbers on the drawing and maps them to pixels. A
   test crops those regions from the studio render and from the design's own render and requires equal bytes. The flat lay scales the
   front and is not compared byte for byte.
5. **Watermark** (`lib/media/watermark.ts`): diagonal bands and the words "Knitwright preview" drawn with sharp over the whole picture.
   The bands are there so the mark still covers the picture on a machine with no fonts.
6. **The clean file is never reachable before the spend.**
   - It is stored in the `images` bucket at `_private/<brand id>/<set id>/<kind>-<view>.png`. The storage read rule requires the first
     folder to be a brand the member belongs to; `_private` is not one, so no member or browser can read it. It has no `files` row.
   - The watermarked rendition is an ordinary file of the brand (`files` kind `render`).
   - Browsers ask `GET .../media/<set>/items/<item>`; the server picks the watermarked bytes unless the set is unlocked
     (`lib/media/serve.ts`, tested to never read the clean path before the unlock). Views never contain a clean path.
7. **Spending.** `POST .../media/<set>/unlock` is wrapped in `withCredits` with kind `marketing_media` (0051). The charge is once per brand, kind and design
   version hash, so pressing it twice charges once. The charge is refused before it is made when the set is not finished.
   Making the set is free (no paid model is called), so a failed set has nothing to give back. With `CREDITS_ENFORCED` off (the default) the
   gate only logs what it would have charged and the unlock goes through; the watermark rule is therefore a rule about credits, and
   with the flag off it is open on purpose.
   Photoreal images (0018) are charged under the same kind and version hash, so a version whose photoreal images were paid for is already
   paid for here. Owner question below.
8. **Jobs.** The existing `jobs` table allows only the kind `photoreal` and belongs to another workstream, so a set carries its own status
   (`queued`, `running`, `succeeded`, `failed`) with history, and runs with `after()` exactly as the photoreal job does. A request for a version
   that already has a set returns that set and starts nothing; a set that failed starts again. The browser polls `GET .../media/<set>`.
9. **No new dependency, no paid model, no committed media.**

## Not verified

- The sandbox has no Docker, so the database tests (`tests/integration/media.test.ts`, the isolation entries), the end-to-end spec
  and `pnpm build` were not run here; CI is their first run. The migration's functions, history trigger and unique rules were
  run against a plain PostgreSQL 16 with stub tables for brands, files, projects and users; row level security, grants and storage were not.
- Whether the `_private` folder is unreadable to members rests on `private.brand_id_from` returning null for text that is not an id
  (read in migration 20260929010000) and is tested only in `media.test.ts`.
- The watermark text depends on the system fonts of the machine; the bands do not.

## Known gaps

- Deleting a brand removes its rows (cascade) but `emptyBrandFolders` lists only `<brand id>/...`, so `_private/<brand id>/...` objects stay. That function
  is not in this workstream's paths; a one-line change there is needed.
- Clean pictures have no `files` row, so they do not count toward the brand's storage quota.
- The Studio media screen is W3-E; this workstream has the API only (no `components/media`).
- No daily cap or `lib/usage` metering: nothing paid is called. Stage 2 generators must meter their own provider calls.

## Owner questions

- Should paying for photoreal images and paying for the media set be one charge (as built, same kind and version) or two?
- Is the placeholder price (1 credit, `lib/credits/settings.ts`) for a whole set right, or should each kind be priced?

## Alternatives

- Signed URLs to the clean file after the spend. Rejected: a link can be passed on; the server sending the bytes keeps the rule in one place.
- A `files` row for the clean picture. Rejected: the files table requires the path inside the brand's folder, which members can read.
