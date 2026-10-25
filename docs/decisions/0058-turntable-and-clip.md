# 0058: Turntable recording and image-to-video clip

Status: Proposed
Date: 2026-10-27
Plan step: plans/platform-v4.md, workstream W3-D. Builds on 0054 (media sets), 0051 (credit gates), 0049 (glTF viewer), 0012 (usage metering).

## Context

Spec stage 4 wants a turntable (rendered from 3D, free) and a five second clip made from a lifestyle picture (paid, AI). The server has no GPU.

## Decision

1. **Turntable is recorded in the browser.** `components/media/video/record.ts` records the 3D canvas with `MediaRecorder` (WebM, MP4 where
   that is all the browser can do), 8 seconds, one full turn, 2.5 Mbit/s. The viewers (`components/garment3d/scene.ts`, `components/gltf/scene.ts`)
   gained one listener each for the event `knitwright:turn`, which sets their existing auto-rotate speed; nothing else in them changed. A browser
   with no `MediaRecorder` shows a plain message and saves nothing. `TurntableControl` is mounted under the 3D view in `Preview3D` (one line).
2. **Upload** `POST .../media/<set>/turntable` takes `video` and `poster` (a still frame, rewritten as plain PNG). Video type is read from its first bytes,
   never from the browser's claim; cap 8 MiB (poster 2 MiB, 4096 px). The server does not decode the video, so the 12 second length cap is enforced by the
   recorder and, on the server, by the size cap. It becomes the set's `turntable` item (view `three_quarter`); a second recording replaces the first.
3. **Where things live.** The poster follows the studio-render rules (watermarked file + clean PNG at `cleanPath`), so the existing item route serves it
   unchanged. The video is at `_private/<brand>/<set>/<kind>-<view>.video` in the images bucket (no column holds it; the path is derived). Migration
   `20261027030000_media_video.sql` lets that bucket take `video/webm` and `video/mp4` up to 30 MiB. **This is a migration the plan did not list**: the bucket
   refused video otherwise. It changes no table.
4. **Adding items to a finished set.** The database takes items only while a set is `running`, so `attach.ts` moves the set `succeeded -> running -> succeeded`
   around the write (history shows it). While it runs the set serves watermarked pictures only.
5. **Clip.** `VideoProvider` interface, a deterministic stub (a WebM header and info block, **not a playable video**, says "AI generated"), and a fal adapter
   for Kling image-to-video written from fal's public page. The stub is used unless `FAL_KEY` is set **and** `MEDIA_VIDEO_LIVE=true`. Never called in CI; adapter tests use a fake `fetch`.
   The clip is made from a lifestyle item whose checker verdict is `passed` (W3-B); with none, the request is refused in words. One clip per still view; a repeat call
   pays and calls nothing.
6. **Metering and credits.** The clip route reserves `CLIP_COST` (USD 0.25, a labelled estimate) from the photoreal allowance, whose monthly allowance and daily ceiling are the cap,
   runs the credits gate as `marketing_media` (no new output kind, so the spend is the same one-per-version charge as the set), and gives the reservation back on any failure or repeat.
7. **Serving.** `GET .../items/<item>/video`: a turntable is served to the brand's members at once (free); a **clip is read from storage only when the set is unlocked and finished**, else
   409 "available once credits are spent" and storage is not asked (tested). Before the spend the clip item has only its watermarked poster (the still) and no video address in the view.
8. **AI label.** Clip items carry the provider name, the response header `x-media-ai-generated: true`, `aiGenerated` in the view, and the stub file says so inside. A real provider's
   MP4 is stored as received: embedding the label in the file would need a remux; not done.

## Not verified

- No Docker here: the migration, the e2e spec and `pnpm build` were not run locally; CI is their first run. The e2e records in CI's Chromium; if it cannot record it asserts the fallback.
- The fal adapter has never been called. Model path, request fields, price and licence terms are from memory of public docs.
- The turntable button itself is not clicked in e2e (`SHOW_3D=false` there); the real recorder source and real upload route are. Visual quality of a recorded turn is unseen.
- The clip end to end (route to stored clip) has no e2e: it needs W3-B's passed lifestyle still. Unit tests cover it.
- A concurrent unlock during the brief `running` hop of an attach gets a conflict.

## Owner questions

- Is a clip charged under the set's one `marketing_media` spend, or does it need its own output kind and price?
- Kling or Wan, and the fal key/terms for video? Is 8 seconds / 8 MiB the right turntable?
- Should a turntable be free to download before credits are spent (as built), or watermarked like the rest?
